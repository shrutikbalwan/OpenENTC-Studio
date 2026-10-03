export interface SourceSymbol { symbol: string; p: number }
export interface CodeEntry { symbol: string; p: number; code: string }
export interface CodeFigures { entropy: number; averageLength: number; efficiency: number; redundancy: number; kraft: number; variance: number }
export interface Complex { re: number; im: number }
export declare function entropy(probabilities: number[], base?: number): number;
export declare function binaryEntropy(p: number): number;
export declare function textSource(text: string): { symbol: string; count: number; p: number }[];
export declare function huffman(symbols: SourceSymbol[]): CodeFigures & { codes: CodeEntry[]; steps: { p: number; members: string[] }[][] };
export declare function shannonFano(symbols: SourceSymbol[]): CodeFigures & { codes: CodeEntry[]; splits: { depth: number; top: string[]; bottom: string[] }[] };
export declare function encodeWithCode(text: string, codes: CodeEntry[]): string;
export declare function decodeWithCode(bits: string, codes: CodeEntry[]): string;
export declare function lzwEncode(text: string): { alphabet: string[]; output: { phrase: string; code: number }[]; codes: number[]; added: { code: number; phrase: string }[]; dictionarySize: number; bitsPerCode: number; compressedBits: number; originalBits: number };
export declare function lzwDecode(codes: number[], alphabet: string[]): string;
export declare function bscCapacity(p: number): number;
export declare function becCapacity(e: number): number;
export declare function awgnCapacity(bandwidth: number, snrDb: number): { capacity: number; spectralEfficiency: number; snr: number; shannonLimitDb: number };
export declare function minimumEbN0Db(eta: number): number;
export declare function mutualInformation(matrix: number[][], inputs: number[]): { information: number; hx: number; hy: number; hxGivenY: number; hyGivenX: number; py: number[] };
export declare function channelCapacity(matrix: number[][], options?: { tolerance?: number; maxIterations?: number }): { capacity: number; upperBound: number; inputDistribution: number[]; iterations: number };
export declare const PRIMITIVE_TAPS: Readonly<Record<number, number[]>>;
export declare const GOLD_PAIRS: Readonly<Record<number, number[][]>>;
export declare function lfsr(taps: number[], options?: { seed?: number[] | null; length?: number | null }): { sequence: number[]; states: string[]; degree: number };
export declare function periodicCorrelation(a: number[], b?: number[]): number[];
export declare function sequenceProperties(sequence: number[]): { length: number; ones: number; zeros: number; runs: Record<number, number>; correlation: number[]; offPeak: number[] };
export declare function goldCodes(degree: number): { degree: number; length: number; pair: number[][]; family: number[][]; bound: number[] };
export declare function createRandom(seed?: number): { uniform(): number; gaussian(): number };
export declare function dsss(options?: { degree?: number; bits?: number; ebN0Db?: number; jsrDb?: number; jammerFrequency?: number; seed?: number; spread?: boolean }): { chipsPerBit: number; processingGainDb: number; errors: number; bits: number; ber: number; theoryBer: number; chips: number[]; received: number[]; despread: number[]; code: number[] };
export declare function erfc(x: number): number;
export declare function fhss(options?: { degree?: number; channelBits?: number; hops?: number; baseFrequency?: number; spacing?: number; seed?: number[] | null }): { pattern: { hop: number; channel: number; frequency: number }[]; channels: number; use: number[]; bandwidth: number; processingGainDb: number };
export declare function fftInPlace(re: number[], im: number[], inverse?: boolean): void;
export declare function qamMap(bits: number[], scheme?: 'qpsk' | '16qam'): { symbols: Complex[]; bitsPerSymbol: number };
export declare function qamDemap(symbols: Complex[], scheme?: 'qpsk' | '16qam'): number[];
export declare function ofdmLink(options?: { subcarriers?: number; cp?: number; symbols?: number; scheme?: 'qpsk' | '16qam'; channel?: number[]; snrDb?: number; seed?: number }): { bits: number; errors: number; ber: number; equalised: Complex[]; raw: Complex[]; channelResponseDb: number[]; delaySpread: number; cpCoversChannel: boolean; efficiency: number; txPreview: number[] };
