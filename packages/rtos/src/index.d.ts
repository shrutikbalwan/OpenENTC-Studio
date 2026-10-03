export type Policy = 'rm' | 'dm' | 'edf' | 'llf' | 'fixed' | 'fcfs' | 'rr';
export type Protocol = 'none' | 'pip' | 'pcp';
export declare const POLICIES: Readonly<Record<Policy, string>>;
export declare const PROTOCOLS: Readonly<Record<Protocol, string>>;
export interface TaskInput { name?: string; period: number; wcet: number; deadline?: number; offset?: number; priority?: number; sections?: { resource: string; start: number; length: number }[] }
export declare function lcm(values: number[]): number;
export interface ScheduleResult {
  tasks: Required<TaskInput>[]; policy: Policy; protocol: Protocol; length: number; hyperperiod: number;
  timeline: ({ task: number; job: number; resource: string | null; priority: number } | null)[];
  events: { time: number; type: 'release' | 'finish' | 'miss' | 'lock' | 'unlock'; task: number; job?: number; resource?: string }[];
  jobs: { task: number; number: number; release: number; absoluteDeadline: number; remaining: number; executed: number; finish: number | null; missed: boolean; blockedOn: string | null; blockedTicks: number }[];
  perTask: { name: string; jobs: number; completed: number; misses: number; worstResponse: number | null; averageResponse: number | null; blockedTicks: number }[];
  contextSwitches: number; utilisationObserved: number; schedulable: boolean;
}
export declare function simulateSchedule(tasks: TaskInput[], options?: { policy?: Policy; protocol?: Protocol; quantum?: number; horizon?: number | null; maxHorizon?: number }): ScheduleResult;
export declare function utilisationTests(tasks: TaskInput[]): { utilisation: number; rmBound: number; rmSufficient: boolean; hyperbolicBound: boolean; edfFeasible: boolean | null; density: number };
export declare function responseTimeAnalysis(tasks: TaskInput[], options?: { policy?: Policy; protocol?: Protocol }): { name: string; priority: number; blocking: number; response: number; schedulable: boolean; iterations: number }[];
export declare const RTOS_EXAMPLES: readonly { id: string; name: string; policy: Policy; protocol?: Protocol; tasks: TaskInput[] }[];
