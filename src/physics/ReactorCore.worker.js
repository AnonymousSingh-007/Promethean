// This worker owns ALL physics. The main thread sends commands; this worker
// runs the entire cascade to completion headlessly (microseconds of CPU),
// then sends back a complete time-stamped event log for the PlaybackEngine
// to render at its own pace. Physics is never starved by rendering again.

import { ChainReaction, EVENTS } from './ChainReaction.js';
import { ISOTOPES } from './IsotopeData.js';

let reactor = null;
let currentIsotopeId = 'U235';

function init() {
  reactor = new ChainReaction({ neighborRadius: 4.6, maxNeighbors: 6 });

  for (const isotopeId of Object.keys(ISOTOPES)) {
    buildCluster(reactor, isotopeId, 80, 4.2);
  }
  reactor.buildNeighborGraph();
  reactor.setActiveIsotope(currentIsotopeId);
}

function buildCluster(chainReaction, isotopeId, count, radius) {
  const CLUSTER_LAYOUT = {
    U235:  { x: -18, y:  14, z: 0 },
    Th232: { x:   0, y:  14, z: 0 },
    Pu239: { x:  18, y:  14, z: 0 },
    U238:  { x: -18, y:   0, z: 0 },
    Cf252: { x:   0, y:   0, z: 0 },
    Pu241: { x:  18, y:   0, z: 0 },
    U233:  { x: -18, y: -14, z: 0 },
    Np237: { x:   0, y: -14, z: 0 },
    Am241: { x:  18, y: -14, z: 0 },
  };

  const center = CLUSTER_LAYOUT[isotopeId] ?? { x: 0, y: 0, z: 0 };
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const jitter = 0.14;
    const pos = {
      x: Math.cos(theta) * r * radius + (Math.random() - 0.5) * jitter * 2 + center.x,
      y: y * radius + (Math.random() - 0.5) * jitter * 2 + center.y,
      z: Math.sin(theta) * r * radius + (Math.random() - 0.5) * jitter * 2 + center.z,
    };
    chainReaction.addAtom(pos, isotopeId);
  }
}

function runCascadeHeadless(isotopeId, count, origin) {
  const eventLog = [];
  let simClock = 0;
  const DT = 1 / 500; // 500Hz physics — fine-grained enough that nothing resolves in big ugly batches
  const MAX_SIM_TIME = 30; // safety ceiling — prevents infinite loops on stuck cascades

  // Wire the event recorder — every physics event gets timestamped with
  // the current simulation clock and appended to the log.
  const unsubs = Object.values(EVENTS).map(eventName =>
    reactor.on(eventName, (payload) => {
      eventLog.push({ type: eventName, simTime: simClock, payload });
    })
  );

  const fired = reactor.bombardIsotope(isotopeId, count, origin);

  // Run the physics to completion — the entire cascade resolves in a tight
  // loop here. No rendering, no yielding, no frame budget. Pure computation.
  while (reactor.neutrons.size > 0 && simClock < MAX_SIM_TIME) {
    reactor.step(DT);
    simClock += DT;
  }

  // Unsubscribe all recorders
  unsubs.forEach(fn => fn());

  return { eventLog, stats: { ...reactor.stats }, fired };
}

init();

self.onmessage = ({ data }) => {
  const { type, payload } = data;

  if (type === 'FIRE') {
    const { isotopeId, count, origin } = payload;
    const result = runCascadeHeadless(isotopeId, count, origin);
    self.postMessage({
      type: 'CASCADE_READY',
      payload: {
        eventLog: result.eventLog,
        stats: result.stats,
        fired: result.fired,
        isotopeId,
      },
    });
  }

  if (type === 'SET_ISOTOPE') {
    currentIsotopeId = payload.isotopeId;
    reactor.hardReset(payload.isotopeId);
    reactor.setActiveIsotope(payload.isotopeId);
    self.postMessage({ type: 'RESET_COMPLETE', payload: { isotopeId: payload.isotopeId } });
  }

  if (type === 'SET_CONTAINMENT') {
    reactor.setContainment(payload.active);
  }

  if (type === 'SET_CONTROL_RODS') {
    reactor.setControlRodInsertion(payload.insertion);
  }

  if (type === 'RESET') {
    reactor.hardReset(payload?.isotopeId ?? currentIsotopeId);
    self.postMessage({ type: 'RESET_COMPLETE', payload: {} });
  }
};