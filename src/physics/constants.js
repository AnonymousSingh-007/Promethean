// Shared sim/VFX timing constants. Previously NEUTRON_TRAVEL_TIME was duplicated
// in ChainReaction.js and ParticleSystem.js and could silently drift out of sync —
// centralizing it here so trail visuals always match sim timing exactly.

export const NEUTRON_TRAVEL_TIME = 0.5; // seconds, neutron flight time from source to target