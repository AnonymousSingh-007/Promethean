import { getIsotope, randomNeutronCount } from './IsotopeData.js';

// ChainReaction is a pure simulation — no Three.js, no rendering, no DOM.
// It owns a graph of atoms in 3D space and a live queue of in-flight neutrons.
// Every frame you call `step(dt)`, and it emits events (via the callback list below)
// that the VFX layer subscribes to and turns into particles/shaders/hit-stop.
//
// Why a graph instead of a real physics engine:
// - We don't need collision accuracy, we need EXPONENTIAL BRANCHING that looks good.
// - Each atom just needs neighbors (precomputed once from spatial proximity).
// - A neutron "in flight" is just a lerp from source atom to target atom over a fixed duration.
// - On arrival, roll fissionProbability. Success -> emit N new neutrons to random neighbors.
// This is O(neutrons) per frame, trivially fast, and gives you cascades of arbitrary depth.

export const EVENTS = {
  ATOM_HIT: 'atom_hit',
  ATOM_FISSIONED: 'atom_fissioned',
  ATOM_ABSORBED: 'atom_absorbed', // hit but did not fission
  NEUTRON_SPAWNED: 'neutron_spawned',
  NEUTRON_ARRIVED: 'neutron_arrived',
  CASCADE_COMPLETE: 'cascade_complete',
};

const NEUTRON_TRAVEL_TIME = 0.35; // seconds, tune for pacing/legibility

class Atom {
  constructor(id, position, isotopeId) {
    this.id = id;
    this.position = position; // THREE.Vector3-like {x,y,z}, kept as plain object so this stays framework-agnostic
    this.isotopeId = isotopeId;
    this.alive = true;
    this.neighbors = []; // filled by ChainReaction.buildNeighborGraph()
  }
}

class Neutron {
  constructor(id, fromAtom, toAtom, spawnTime) {
    this.id = id;
    this.from = fromAtom;
    this.to = toAtom;
    this.spawnTime = spawnTime;
    this.arrived = false;
  }
}

export class ChainReaction {
  constructor({ neighborRadius = 3.5, maxNeighbors = 6 } = {}) {
    this.atoms = new Map();       // id -> Atom
    this.neutrons = new Map();    // id -> Neutron
    this.neighborRadius = neighborRadius;
    this.maxNeighbors = maxNeighbors;
    this.listeners = {};
    this.time = 0;
    this._nextAtomId = 0;
    this._nextNeutronId = 0;
    this.stats = { fissioned: 0, absorbed: 0, energyReleased: 0, maxCascadeDepth: 0, liveNeutrons: 0 };
    this._activeCascadeDepth = 0;
    this._depthByNeutron = new Map();
  }

  on(event, cb) {
    (this.listeners[event] ??= []).push(cb);
    return () => this.off(event, cb);
  }

  off(event, cb) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(fn => fn !== cb);
  }

  _emit(event, payload) {
    (this.listeners[event] || []).forEach(fn => fn(payload));
  }

  // --- Setup ---------------------------------------------------------------

  addAtom(position, isotopeId) {
    const id = this._nextAtomId++;
    const atom = new Atom(id, position, isotopeId);
    this.atoms.set(id, atom);
    return atom;
  }

  /** Call once after all atoms are placed. O(n^2) but clusters are small (tens-hundreds), fine for a weekend build. */
  buildNeighborGraph() {
    const list = [...this.atoms.values()];
    for (const a of list) {
      const dists = list
        .filter(b => b.id !== a.id)
        .map(b => ({ b, d: dist(a.position, b.position) }))
        .filter(({ d }) => d <= this.neighborRadius)
        .sort((x, y) => x.d - y.d)
        .slice(0, this.maxNeighbors);
      a.neighbors = dists.map(x => x.b);
    }
  }

  // --- Triggering a strike ---------------------------------------------------
  // Call this when the user's "throw" gesture lands on an atom (raycast hit in SceneManager).

  strikeAtom(atomId, { depth = 0 } = {}) {
    const atom = this.atoms.get(atomId);
    if (!atom || !atom.alive) return;
    this._spawnNeutron(null, atom, depth);
  }

  _spawnNeutron(fromAtom, toAtom, depth) {
    const id = this._nextNeutronId++;
    const n = new Neutron(id, fromAtom, toAtom, this.time);
    this.neutrons.set(id, n);
    this._depthByNeutron.set(id, depth);
    this.stats.liveNeutrons++;
    this._emit(EVENTS.NEUTRON_SPAWNED, {
      id, from: fromAtom ? fromAtom.position : toAtom.position, to: toAtom.position, depth,
    });
  }

  // --- Simulation step ---------------------------------------------------

  step(dt) {
    this.time += dt;
    const arrivedIds = [];

    for (const n of this.neutrons.values()) {
      const t = (this.time - n.spawnTime) / NEUTRON_TRAVEL_TIME;
      if (t >= 1 && !n.arrived) {
        n.arrived = true;
        arrivedIds.push(n.id);
      }
    }

    for (const id of arrivedIds) {
      this._resolveArrival(id);
    }

    if (this.neutrons.size === 0 && this._activeCascadeDepth > 0) {
      this._emit(EVENTS.CASCADE_COMPLETE, { ...this.stats });
      this._activeCascadeDepth = 0;
    }
  }

  _resolveArrival(neutronId) {
    const n = this.neutrons.get(neutronId);
    const depth = this._depthByNeutron.get(neutronId) ?? 0;
    this.neutrons.delete(neutronId);
    this._depthByNeutron.delete(neutronId);
    this.stats.liveNeutrons--;
    this._activeCascadeDepth = Math.max(this._activeCascadeDepth, depth);
    this.stats.maxCascadeDepth = Math.max(this.stats.maxCascadeDepth, depth);

    const atom = n.to;
    this._emit(EVENTS.NEUTRON_ARRIVED, { id: neutronId, position: atom.position, depth });

    if (!atom.alive) return; // already fissioned earlier in this cascade, treat as absorbed into debris

    this._emit(EVENTS.ATOM_HIT, { atomId: atom.id, position: atom.position, isotopeId: atom.isotopeId, depth });

    const iso = getIsotope(atom.isotopeId);
    const fissioned = Math.random() < iso.fissionProbability;

    if (!fissioned) {
      this.stats.absorbed++;
      this._emit(EVENTS.ATOM_ABSORBED, { atomId: atom.id, position: atom.position, isotopeId: atom.isotopeId });
      return;
    }

    atom.alive = false;
    this.stats.fissioned++;
    this.stats.energyReleased += iso.energy;
    this._emit(EVENTS.ATOM_FISSIONED, {
      atomId: atom.id, position: atom.position, isotopeId: atom.isotopeId, energy: iso.energy, depth,
    });

    const emitCount = randomNeutronCount(iso.neutronsEmitted);
    const targets = pickRandomAliveNeighbors(atom, emitCount);
    for (const target of targets) {
      this._spawnNeutron(atom, target, depth + 1);
    }
  }

  reset() {
    for (const atom of this.atoms.values()) atom.alive = true;
    this.neutrons.clear();
    this._depthByNeutron.clear();
    this.time = 0;
    this._activeCascadeDepth = 0;
    this.stats = { fissioned: 0, absorbed: 0, energyReleased: 0, maxCascadeDepth: 0, liveNeutrons: 0 };
  }
}

function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function pickRandomAliveNeighbors(atom, count) {
  const alive = atom.neighbors.filter(n => n.alive);
  if (alive.length === 0) return [];
  const shuffled = [...alive].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, alive.length));
}
