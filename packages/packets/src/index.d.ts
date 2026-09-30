export interface CapturedPacket { index: number; timestamp: number; capturedLength: number; originalLength: number; data: Uint8Array; interfaceId?: number; linkType?: number; }
export interface PacketTrace { kind: 'packet-trace'; linkType: number; snaplen: number; packets: readonly CapturedPacket[]; }
export declare function parsePcap(input: Uint8Array | ArrayBuffer): PacketTrace;
export declare function parsePcapNg(input: Uint8Array | ArrayBuffer): PacketTrace & { format: 'pcapng' };
