export interface Point { x: number; y: number; label?: number; target?: number }
export interface Dataset { name: string; regression: boolean; train: Point[]; test: Point[] }
export declare const DATASETS: Readonly<Record<string, string>>;
export declare function makeDataset(name?: string, options?: { count?: number; noise?: number; seed?: number; testFraction?: number }): Dataset;
export declare const ACTIVATIONS: Readonly<Record<string, { f(x: number): number; d(y: number): number }>>;
export interface Network { sizes: number[]; activation: string; layers: { w: number[][]; b: number[] }[] }
export declare function createNetwork(sizes: number[], options?: { activation?: string; seed?: number }): Network;
export declare function forward(net: Network, input: number[], output?: 'softmax' | 'linear'): number[][];
export declare function backward(net: Network, input: number[], target: number | number[], output?: 'softmax' | 'linear'): { loss: number; grads: { w: number[][]; b: number[] }[]; output: number[] };
export declare function gradientCheck(net: Network, input: number[], target: number | number[], output?: 'softmax' | 'linear', h?: number): number;
export interface EpochRecord { epoch: number; trainLoss: number; testLoss: number; trainAccuracy: number | null; testAccuracy: number | null }
export declare function train(net: Network, dataset: Dataset, options?: { epochs?: number; learningRate?: number; batchSize?: number; optimizer?: 'adam' | 'sgd'; momentum?: number; l2?: number; seed?: number; snapshots?: number; grid?: number }): { history: EpochRecord[]; frames: { epoch: number; map: number[][] }[]; final: EpochRecord };
export declare function decisionMap(net: Network, grid?: number): number[][];
export declare function regressionCurve(net: Network, points?: number): number[][];
export declare const LOGIC_SETS: Readonly<Record<string, number[][]>>;
export declare function perceptron(samples: number[][], options?: { rate?: number; weights?: number[]; bias?: number; maxEpochs?: number }): { weights: number[]; bias: number; converged: boolean; epochs: number; steps: { epoch: number; x: number[]; target: number; net: number; output: number; error: number; w: number[]; b: number }[] };
