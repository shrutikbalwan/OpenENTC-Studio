// Helpers for interpreting simulation results held in the store.

export const isDcResult = (simulation) => Boolean(simulation?.nodes && simulation?.currents && !simulation.kind);
