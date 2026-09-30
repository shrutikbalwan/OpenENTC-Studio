export interface Wire { from: string; to: string; [key: string]: unknown; }
export declare function connectNodes(wires: Wire[], from: string, to: string): Wire[];
export declare function disconnectNodes(wires: Wire[], from: string, to: string): Wire[];
