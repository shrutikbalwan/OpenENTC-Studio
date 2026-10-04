// @ts-check
// Helpers for interpreting simulation results held in the store.

/** @param {any} simulation @returns {boolean} */
export const isDcResult = (simulation) => Boolean(simulation?.nodes && simulation?.currents && !simulation.kind);
