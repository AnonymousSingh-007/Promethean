import { getIsotope, randomNeutronCount } from './IsotopeData.js';
import { NEUTRON_TRAVEL_TIME } from './constants.js';

// ChainReaction is a pure simulation — no Three.js, no rendering, no DOM.
// It owns a graph of atoms in 3D space and a live queue of in-flight neutrons.
// Every frame you call `step(dt)`, and it emits events that the VFX layer
// subscribes to and turns into particles/shaders/hit-stop.

export const EVENTS = {
  ATOM_HIT: 'atom_hit',
  ATOM_FISSIONED: 'atom_fissioned',
  ATOM_ABSORBED: 'atom_absorbed',
  NEUTRON_SPAWNED: 'neutron_spawned',
  NEUTRON_ARRIVED: 'neutron_arrived',
  CASCADE_COMPLETE: 'cascade_complete',
};

// Default point neutrons originate from when no explicit origin is given
// (e.g. a cascade continuation always has a real source atom; only the
// very first strike in a chain needs a fallback).
const DEFAULT_ORIGIN = { x: 0, y: 0, z: 14 };

class Atom {
  constructor(id, position, isotopeId) {
    this.id = id;
    this.position = position;
    this.isotopeId = isotopeId;
    this.alive = true;
    this.neighbors = [];
  }
}

class Neutron {
  constructor(id, fromPosition, toAtom, spawnTime) {
    this.id = id;
    this.from = fromPosition; // plain {x,y,z} — where this neutron visually started
    this.to = toAtom;         // Atom instance — the actual sim target
    this.spawnTime = spawnTime;
    this.arrived = false;
  }
}

export class ChainReaction {
  constructor({ neighborRadius = 3.5, maxNeighbors = 6 } = {}) {
    this.atoms = new Map();
    this.neutrons = new Map();
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

  // --- Triggering strikes ---------------------------------------------------

  /**
   * Fire a single neutron at a specific atom (used by THROW).
   * `origin` is a plain {x,y,z} — pass the hand's 3D position so the neutron
   * visibly travels from your hand to the target, rather than popping in place.
   */
  strikeAtom(atomId, { origin = null, depth = 0 } = {}) {
    const atom = this.atoms.get(atomId);
    if (!atom || !atom.alive) return;
    this._spawnNeutron(origin ?? DEFAULT_ORIGIN, atom, depth);
  }

  /**
   * Bombard the cluster with `count` neutrons aimed at random alive atoms at once —
   * this is what the FIST gesture triggers. `origin` should be the hand's 3D
   * position so all of them visibly launch from your fist toward the cluster.
   */
  bombardAtoms(count = 5, origin = null) {
    const alive = [...this.atoms.values()].filter(a => a.alive);
    if (alive.length === 0) return;
    const shuffled = [...alive].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, Math.min(count, alive.length));
    for (const atom of targets) {
      this._spawnNeutron(origin ?? DEFAULT_ORIGIN, atom, 0);
    }
  }

  _spawnNeutron(fromPosition, toAtom, depth) {
    const id = this._nextNeutronId++;
    const n = new Neutron(id, fromPosition, toAtom, this.time);
    this.neutrons.set(id, n);
    this._depthByNeutron.set(id, depth);
    this.stats.liveNeutrons++;
    this._emit(EVENTS.NEUTRON_SPAWNED, {
      id, from: fromPosition, to: toAtom.position, depth,
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

    if (!atom.alive) return;

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
      this._spawnNeutron(atom.position, target, depth + 1); // real source atom this time — cascade neutrons always travel visibly
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