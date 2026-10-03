export declare function erlangB(traffic: number, channels: number): number;
export declare function erlangC(traffic: number, channels: number, holdingTime?: number | null, waitLimit?: number): { probabilityWait: number; stable: boolean; meanWait: number | null; probabilityWaitLonger: number | null };
export declare function channelsForGos(traffic: number, gos: number): number;
export declare function trafficForGos(channels: number, gos: number): number;
export declare function offeredTraffic(options: { users: number; callsPerHour: number; holdingSeconds: number }): number;
export declare function clusterSizes(limit?: number): { n: number; i: number; j: number }[];
export declare const SECTORING: Readonly<Record<string, { label: string; interferers: number; sectors: number }>>;
export interface ReusePlan { cluster: number; i: number; j: number; q: number; sir: number; sirDb: number; worstSirDb: number | null; channelsPerCell?: number; channelsPerSector?: number; capacity?: number }
export declare function reusePlan(options: { cluster: number; pathLossExponent?: number; sectoring?: string; totalChannels?: number | null; cells?: number | null }): ReusePlan;
export declare function clusterForSir(requiredSirDb: number, pathLossExponent?: number, sectoring?: string): number | null;
export declare function hexLayout(options: { i: number; j: number; rings?: number }): { cluster: number; groups: number; cells: { q: number; r: number; group: number; x: number; y: number }[] };
export declare function freeSpaceLoss(frequencyMHz: number, distanceKm: number): number;
export declare function hataMobileCorrection(frequencyMHz: number, mobileHeight: number, city?: 'medium' | 'large'): number;
export declare const ENVIRONMENTS: Readonly<Record<string, string>>;
export interface HataOptions { frequencyMHz: number; baseHeight: number; mobileHeight: number; environment?: string }
export declare function hataLoss(options: HataOptions & { distanceKm: number }): number;
export declare function logDistanceLoss(options: { frequencyMHz: number; distanceKm: number; exponent?: number; referenceKm?: number }): number;
export declare function cellRadius(options: HataOptions & { maxLossDb: number }): number;
export declare function maxAllowedLoss(options: { eirpDbm: number; rxSensitivityDbm: number; rxGainDb?: number; otherLossDb?: number; fadeMarginDb?: number }): number;
export declare function fadeMargin(sigmaDb: number, edgeCoverage: number): number;
export declare function inverseNormal(p: number): number;
export declare function erfc(x: number): number;
export interface HandoffOptions { separation?: number; txPowerDbm?: number; frequencyMHz?: number; exponent?: number; sigmaDb?: number; decorrelationM?: number; hysteresisDb?: number; timeToTriggerM?: number; thresholdDbm?: number; stepM?: number; seed?: number }
export declare function simulateHandoff(options: HandoffOptions): { positions: number[]; powerA: number[]; powerB: number[]; serving: string[]; events: { position: number; to: string }[]; handoffs: number; pingPong: number; outageFraction: number };
export declare function idealHandoffPoint(options: { separation: number; exponent: number; hysteresisDb: number }): number;
