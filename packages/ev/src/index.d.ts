export declare const G: number;
export interface Cell { label: string; nominal: number; max: number; min: number; ah: number; massKg: number; resistance: number }
export declare const CELLS: Readonly<Record<string, Cell>>;
export interface Pack { series: number; parallel: number; cells: number; nominalVoltage: number; maxVoltage: number; minVoltage: number; capacityAh: number; energyKwh: number; resistance: number; cellMassKg: number; packMassKg: number; specificEnergy: number; sag: number; loss: number; loadedVoltage: number; cRate: number }
export declare function batteryPack(options: { cell: Cell; series: number; parallel: number; current?: number; packagingFactor?: number }): Pack;
export declare function designPack(options: { cell: Cell; targetVoltage: number; targetKwh: number }): Pack;
export interface Vehicle { massKg?: number; crr?: number; cd?: number; area?: number; rho?: number; speedKmh?: number; gradePercent?: number; accel?: number; rotatingFactor?: number; drivetrainEfficiency?: number; auxKw?: number; regenEfficiency?: number; wheelRadius?: number; gearRatio?: number }
export interface RoadLoad { speed: number; forces: { rolling: number; aero: number; grade: number; inertia: number; total: number }; wheelPower: number; batteryPower: number; wheelTorque: number; motorRpm: number; motorTorque: number; consumptionWhKm: number | null }
export declare function roadLoad(vehicle?: Vehicle): RoadLoad;
export declare function constantSpeedRange(options: Vehicle & { usableKwh: number }): RoadLoad & { rangeKm: number };
export interface Motor { peakTorque?: number; peakPowerKw?: number; maxRpm?: number }
export declare function motorTorque(rpm: number, motor: Motor): number;
export declare function baseSpeedRpm(motor: Motor): number;
export declare function accelerationRun(options?: Vehicle & { mu?: number; drivenAxleShare?: number; motor?: Motor; targetKmh?: number; maxTime?: number }): { zeroToTarget: number | null; topSpeedKmh: number; rpmLimitedTopSpeedKmh: number; curve: [number, number][]; distance: number; gripLimitedForce: number };
export declare function gearRatioForTopSpeed(options: { topSpeedKmh: number; maxRpm: number; wheelRadius: number }): number;
export declare function chargingTime(options?: { capacityKwh?: number; fromSoc?: number; toSoc?: number; chargerKw?: number; efficiency?: number; taperSoc?: number; endFraction?: number }): { minutes: number; energyKwh: number; gridKwh: number; curve: [number, number, number][] };
