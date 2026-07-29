import { getIsotope, randomNeutronCount } from './IsotopeData.js';
import { computeTravelTime } from './constants.js';

export const EVENTS = {
  ATOM_HIT: 'atom_hit',
  ATOM_FISSIONED: 'atom_fissioned',
  ATOM_ABSORBED: 'atom_absorbed',
  NEUTRON_SCATTERED: 'neutron_scattered',
  NEUTRON_ESCAPED: 'neutron_escaped',
  NEUTRON_SPAWNED: 'neutron_spawned',
  NEUTRON_ARRIVED: 'neutron_arrived',
  CASCADE_COMPLETE: 'cascade_complete',
};

// Safety cap: a neutron bouncing forever in a highly-scattering medium
// (U-238 thermal scatter is 81.6%) would never resolve. Real neutrons do
// eventually leak out of a finite geometry; this cap approximates that
// escape, tracked honestly as "escaped" rather than silently dropped.
const MAX_SCATTERS_PER_NEUTRON = 6;

const DEFAULT_ORIGIN = { x: 0, y: 0, z: 20 };

// Real elastic scattering off a heavy nucleus barely changes a neutron's
// energy (max fractional loss per collision is roughly 4A/(A+1)^2, under 2%
// for these isotopes) — full thermalization realistically needs hundreds of
// collisions and, in practice, a light-element moderator (water, graphite),
// not scattering off more fuel atoms. Simulating hundreds of collisions per
// neutron isn't practical here, so this is a per-scatter thermalization
// PROBABILITY standing in for that — a documented simplification, not an
// accurate per-collision energy-transfer calculation.
const FAST_TO_THERMAL_ON_SCATTER = 0.35;

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
  constructor(id, fromPosition, toAtom, spawnTime, travelTime, energyState) {
    this.id = id;
    this.from = fromPosition;
    this.to = toAtom;
    this.spawnTime = spawnTime;
    this.travelTime = travelTime;
    this.energyState = energyState; // 'fast' | 'thermal'
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
    this.stats = {
      fissioned: 0, absorbed: 0, scattered: 0, escaped: 0,
      energyReleased: 0, maxCascadeDepth: 0, liveNeutrons: 0, kEff: null,
    };
    this._activeCascadeDepth = 0;
    this._depthByNeutron = new Map();
    this.generationCounts = new Map();
    this.containmentActive = false;
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

  resetIsotope(isotopeId) {
    for (const atom of this.atoms.values()) {
      if (atom.isotopeId === isotopeId) atom.alive = true;
    }
  }

  /**
   * Full reset triggered on isotope switch — clears EVERY in-flight
   * neutron (regardless of which isotope it was targeting, so nothing
   * from the previous selection keeps resolving invisibly in the
   * background), resets all cascade stats and generation tracking to
   * zero, and revives the given isotope's atoms. Atoms belonging to
   * OTHER isotopes keep whatever alive/dead state they were left in —
   * they're simply hidden while inactive, and get revived automatically
   * if/when that isotope is reselected.
   */
  hardReset(isotopeIdToRevive) {
    this.neutrons.clear();
    this._depthByNeutron.clear();
    this.generationCounts = new Map();
    this._activeCascadeDepth = 0;
    this.stats = {
      fissioned: 0, absorbed: 0, scattered: 0, escaped: 0,
      energyReleased: 0, maxCascadeDepth: 0, liveNeutrons: 0, kEff: null,
    };
    if (isotopeIdToRevive) this.resetIsotope(isotopeIdToRevive);
  }

  setContainment(active) {
    this.containmentActive = active;
  }

  strikeAtom(atomId, { origin = null, depth = 0 } = {}) {
    const atom = this.atoms.get(atomId);
    if (!atom || !atom.alive) return;
    this._maybeResetGeneration();
    this._spawnNeutron(origin ?? DEFAULT_ORIGIN, atom, depth);
  }

  bombardAtoms(count = 5, origin = null) {
    const alive = [...this.atoms.values()].filter(a => a.alive);
    return this._bombard(alive, count, origin);
  }

  bombardIsotope(isotopeId, count = 5, origin = null) {
    const alive = [...this.atoms.values()].filter(a => a.alive && a.isotopeId === isotopeId);
    return this._bombard(alive, count, origin);
  }

  _bombard(candidateAtoms, count, origin) {
    if (candidateAtoms.length === 0) return 0;
    this._maybeResetGeneration();
    const shuffled = [...candidateAtoms].sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, Math.min(count, candidateAtoms.length));
    for (const atom of targets) {
      this._spawnNeutron(origin ?? DEFAULT_ORIGIN, atom, 0);
    }
    return targets.length;
  }

  _maybeResetGeneration() {
    if (this.neutrons.size === 0) {
      this.generationCounts = new Map();
      this.stats.kEff = null;
    }
  }

  /**
   * `countAsNewBirth: false` is used for scatter continuations — a
   * scattered neutron is still the SAME neutron continuing its journey,
   * not a new one born from fission, so it must not inflate the generation
   * counts that k_eff is computed from. Only genuine fission-spawned or
   * initial user-fired neutrons count as new births.
   */
  _spawnNeutron(fromPosition, toAtom, depth, { energyState = 'fast', countAsNewBirth = true } = {}) {
    const id = this._nextNeutronId++;
    const travelTime = computeTravelTime(fromPosition, toAtom.position, energyState);
    const n = new Neutron(id, fromPosition, toAtom, this.time, travelTime, energyState);
    this.neutrons.set(id, n);
    this._depthByNeutron.set(id, depth);
    this.stats.liveNeutrons++;

    if (countAsNewBirth) {
      this.generationCounts.set(depth, (this.generationCounts.get(depth) || 0) + 1);
      this._updateKEff();
    }

    this._emit(EVENTS.NEUTRON_SPAWNED, {
      id, from: fromPosition, to: toAtom.position, isotopeId: toAtom.isotopeId,
      travelTime, depth, energyState,
    });
  }

  _updateKEff() {
    const depths = [...this.generationCounts.keys()].sort((a, b) => b - a);
    if (depths.length < 2 || depths[0] !== depths[1] + 1) return;
    const n1 = this.generationCounts.get(depths[0]);
    const n0 = this.generationCounts.get(depths[1]);
    this.stats.kEff = n0 > 0 ? +(n1 / n0).toFixed(3) : null;
  }

  step(dt) {
    this.time += dt;
    const arrivedIds = [];

    for (const n of this.neutrons.values()) {
      const t = (this.time - n.spawnTime) / n.travelTime;
      if (t >= 1 && !n.arrived) {
        n.arrived = true;
        arrivedIds.push(n.id);
      }
    }

    for (const id of arrivedIds) this._resolveArrival(id);

    if (this.neutrons.size === 0 && this._activeCascadeDepth > 0) {
      this._emit(EVENTS.CASCADE_COMPLETE, { ...this.stats });
      this._activeCascadeDepth = 0;
    }
  }

  _resolveArrival(neutronId) {
    const n = this.neutrons.get(neutronId);
    const depth = this._depthByNeutron.get(neutronId) ?? 0;
    const energyState = n.energyState;
    this.neutrons.delete(neutronId);
    this._depthByNeutron.delete(neutronId);
    this.stats.liveNeutrons--;
    this._activeCascadeDepth = Math.max(this._activeCascadeDepth, depth);
    this.stats.maxCascadeDepth = Math.max(this.stats.maxCascadeDepth, depth);

    const atom = n.to;
    this._emit(EVENTS.NEUTRON_ARRIVED, { id: neutronId, position: atom.position, depth });
    if (!atom.alive) return;

    this._emit(EVENTS.ATOM_HIT, { atomId: atom.id, position: atom.position, isotopeId: atom.isotopeId, depth, energyState });

    const iso = getIsotope(atom.isotopeId);

    // --- Stage 1: does this collision scatter, or does it get absorbed? ---
    const pScatter = iso.scatterProbability[energyState] ?? 0;
    if (Math.random() < pScatter) {
      this.stats.scattered++;
      const aliveNeighbors = atom.neighbors.filter(nb => nb.alive);

      if (aliveNeighbors.length === 0) {
        this.stats.escaped++;
        this._emit(EVENTS.NEUTRON_ESCAPED, { atomId: atom.id, position: atom.position, isotopeId: atom.isotopeId, depth });
        return;
      }

      const newTarget = aliveNeighbors[Math.floor(Math.random() * aliveNeighbors.length)];
      const newEnergyState = (energyState === 'fast' && Math.random() < FAST_TO_THERMAL_ON_SCATTER)
        ? 'thermal' : energyState;

      this._emit(EVENTS.NEUTRON_SCATTERED, { atomId: atom.id, position: atom.position, isotopeId: atom.isotopeId, depth });
      this._spawnNeutron(atom.position, newTarget, depth, { energyState: newEnergyState, countAsNewBirth: false });
      return;
    }

    // --- Stage 2: absorbed — fission or capture? ---
    let pFission = iso.fissionProbability[energyState] ?? iso.fissionProbability.thermal;

    if (this.containmentActive) {
      const kEffNow = this.stats.kEff ?? 1;
      const excess = Math.max(0, kEffNow - 1.0);
      const suppression = Math.min(0.9, excess * 0.6);
      pFission *= (1 - suppression);
    }

    const fissioned = Math.random() < pFission;

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
      this._spawnNeutron(atom.position, target, depth + 1);
    }
  }

  reset() {
    for (const atom of this.atoms.values()) atom.alive = true;
    this.neutrons.clear();
    this._depthByNeutron.clear();
    this.generationCounts = new Map();
    this.time = 0;
    this._activeCascadeDepth = 0;
    this.stats = {
      fissioned: 0, absorbed: 0, scattered: 0, escaped: 0,
      energyReleased: 0, maxCascadeDepth: 0, liveNeutrons: 0, kEff: null,
    };
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