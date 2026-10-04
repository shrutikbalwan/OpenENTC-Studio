export type DevicePermission = 'serial' | 'usb' | 'debug' | 'capture' | 'sdr' | 'programmer';
export interface DeviceGrant { permission: DevicePermission; target: string; granted: true; expiresAt: number; }
export interface DevicePermissionRecord { permission: DevicePermission; allowed: boolean; grantedTargets: string[]; }
export interface DevicePermissionPolicy {
  readonly environment: 'desktop' | 'browser';
  readonly permissions: readonly DevicePermission[];
  inspect(): readonly DevicePermissionRecord[];
  selectTarget(permission: DevicePermission, target: string): DeviceGrant;
  revokeTarget(target: string): void;
  revokePermission(permission: DevicePermission): void;
  revokeAll(): void;
  assertGranted(permission: DevicePermission, target: string): true;
}
export declare const DEVICE_PERMISSIONS: readonly DevicePermission[];
export declare const DEFAULT_GRANT_TTL_MS: number;
export declare function createDevicePermissionPolicy(options?: { environment?: 'desktop' | 'browser'; allowed?: DevicePermission[]; grantTtlMs?: number; now?: () => number }): DevicePermissionPolicy;
export type SerialSessionState = 'disconnected' | 'reconnecting' | 'connected' | 'closed';
export interface SerialFrame { timestamp: string; text: string; bytes: number; }
export interface SerialSessionSnapshot {
  state: SerialSessionState; paused: boolean; target: string; baud: number; encoding: 'utf-8' | 'ascii'; lineEnding: 'none' | 'lf' | 'cr' | 'crlf'; timestamps: boolean;
  reconnectAttempts: number; maxReconnectAttempts: number; bufferBytes: number; maxBufferBytes: number; droppedBytes: number; frames: readonly SerialFrame[];
}
export interface SerialSession {
  inspect(): SerialSessionSnapshot;
  connect(): SerialSessionSnapshot;
  disconnect(options?: { unexpected?: boolean }): SerialSessionSnapshot;
  reconnect(): SerialSessionSnapshot;
  markReconnectFailed(): SerialSessionSnapshot;
  setPaused(value: boolean): SerialSessionSnapshot;
  ingest(value: string): SerialSessionSnapshot;
  formatTransmit(value: string): string;
  exportText(): string;
  clear(): SerialSessionSnapshot;
  close(): SerialSessionSnapshot;
}
export declare function createSerialSession(options: { permissionPolicy: DevicePermissionPolicy; target: string; baud?: number; encoding?: 'utf-8' | 'ascii'; lineEnding?: 'none' | 'lf' | 'cr' | 'crlf'; timestamps?: boolean; maxBufferBytes?: number; maxReconnectAttempts?: number; now?: () => string }): SerialSession;
