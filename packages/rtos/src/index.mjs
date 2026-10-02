// Real-time scheduling: a tick-by-tick uniprocessor simulator for periodic tasks under RM, DM,
// EDF, LLF, fixed priorities, FCFS and round robin, with shared resources (no protocol,
// priority inheritance, immediate priority ceiling), plus utilisation bounds and exact
// response-time analysis.

export const POLICIES = Object.freeze({
  rm: 'Rate monotonic (fixed, shorter period = higher priority)',
  dm: 'Deadline monotonic (fixed, shorter deadline = higher priority)',
  edf: 'Earliest deadline first (dynamic)',
  llf: 'Least laxity first (dynamic)',
  fixed: 'Fixed priorities (as entered, 1 = highest)',
  fcfs: 'First come, first served (non-preemptive)',
  rr: 'Round robin (time quantum)',
});
export const PROTOCOLS = Object.freeze({ none: 'No protocol (priority inversion possible)', pip: 'Priority inheritance', pcp: 'Immediate priority ceiling' });

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export const lcm = (values) => values.reduce((acc, value) => (acc * value) / gcd(acc, value), 1);

function normalise(tasks) {
  return tasks.map((task, index) => {
    const t = { name: task.name || `T${index + 1}`, period: Number(task.period), wcet: Number(task.wcet), deadline: Number(task.deadline ?? task.period), offset: Number(task.offset ?? 0), priority: Number(task.priority ?? index + 1), sections: (task.sections || []).map((s) => ({ resource: s.resource, start: Number(s.start), length: Number(s.length) })) };
    if (!(Number.isInteger(t.period) && t.period > 0 && Number.isInteger(t.wcet) && t.wcet > 0 && Number.isInteger(t.deadline) && t.deadline > 0 && Number.isInteger(t.offset) && t.offset >= 0)) throw new RangeError(`${t.name}: period, execution time, deadline and offset must be positive whole numbers of ticks.`);
    if (t.wcet > t.deadline) throw new RangeError(`${t.name}: execution time is longer than its deadline.`);
    for (const s of t.sections) if (!(s.start >= 0 && s.length > 0 && s.start + s.length <= t.wcet)) throw new RangeError(`${t.name}: a critical section must lie inside the execution time.`);
    return t;
  });
}

/** Static priority value (smaller = more urgent) for fixed-priority policies. */
function staticRank(policy, tasks) {
  const order = tasks.map((task, index) => index);
  if (policy === 'rm') order.sort((a, b) => tasks[a].period - tasks[b].period || a - b);
  else if (policy === 'dm') order.sort((a, b) => tasks[a].deadline - tasks[b].deadline || a - b);
  else order.sort((a, b) => tasks[a].priority - tasks[b].priority || a - b);
  const rank = new Array(tasks.length);
  order.forEach((taskIndex, position) => { rank[taskIndex] = position; });
  return rank;
}

/**
 * Simulate `horizon` ticks (default: offset + hyperperiod). Each job runs at most one tick per
 * tick; a job inside a critical section holds its resource. Returns the timeline (which task
 * ran each tick), every job's release/finish/response, deadline misses and context switches.
 */
export function simulateSchedule(input, { policy = 'rm', protocol = 'none', quantum = 2, horizon = null, maxHorizon = 5000 } = {}) {
  if (!POLICIES[policy]) throw new RangeError(`Unknown policy "${policy}".`);
  if (!PROTOCOLS[protocol]) throw new RangeError(`Unknown resource protocol "${protocol}".`);
  const tasks = normalise(input);
  if (!tasks.length) throw new RangeError('Add at least one task.');
  const hyper = lcm(tasks.map((task) => task.period));
  const length = Math.min(maxHorizon, horizon ?? Math.max(...tasks.map((task) => task.offset)) + hyper);
  const rank = staticRank(policy, tasks);
  const ceilings = new Map();
  tasks.forEach((task, index) => { for (const s of task.sections) ceilings.set(s.resource, Math.min(ceilings.get(s.resource) ?? Infinity, rank[index])); });
  const jobs = [], ready = [], timeline = [], events = [];
  const owner = new Map(); // resource → job
  let running = null, switches = 0, sliceUsed = 0, lastRun = null;

  const basePriority = (job, now) => {
    if (policy === 'edf') return job.absoluteDeadline;
    if (policy === 'llf') return job.absoluteDeadline - now - job.remaining;
    if (policy === 'fcfs' || policy === 'rr') return job.release;
    return rank[job.task];
  };
  const effective = (job, now) => {
    let value = basePriority(job, now);
    if (protocol === 'pcp' && job.holding.size && ['rm', 'dm', 'fixed'].includes(policy)) for (const r of job.holding) value = Math.min(value, ceilings.get(r));
    if (protocol === 'pip') for (const other of ready) if (other.blockedOn && owner.get(other.blockedOn) === job) value = Math.min(value, effective(other, now));
    return value;
  };
  const sectionAt = (job) => tasks[job.task].sections.find((s) => job.executed >= s.start && job.executed < s.start + s.length) ?? null;

  for (let now = 0; now < length; now += 1) {
    // Releases.
    tasks.forEach((task, index) => {
      if (now >= task.offset && (now - task.offset) % task.period === 0) {
        const job = { task: index, number: Math.floor((now - task.offset) / task.period) + 1, release: now, absoluteDeadline: now + task.deadline, remaining: task.wcet, executed: 0, finish: null, missed: false, holding: new Set(), blockedOn: null, blockedTicks: 0 };
        jobs.push(job); ready.push(job);
        events.push({ time: now, type: 'release', task: index, job: job.number });
      }
    });
    // Deadline misses (record once; the job keeps running late).
    for (const job of ready) if (!job.missed && now >= job.absoluteDeadline && job.remaining > 0) { job.missed = true; events.push({ time: job.absoluteDeadline, type: 'miss', task: job.task, job: job.number }); }
    // Resource requests: a job about to enter a section needs its resource free.
    for (const job of ready) {
      const section = sectionAt(job);
      job.blockedOn = section && !job.holding.has(section.resource) && owner.has(section.resource) && owner.get(section.resource) !== job ? section.resource : null;
    }
    const eligible = ready.filter((job) => !job.blockedOn);
    let chosen = null;
    if (policy === 'fcfs' && running && ready.includes(running)) chosen = running;
    else if (policy === 'rr') {
      if (running && ready.includes(running) && !running.blockedOn && sliceUsed < quantum) chosen = running;
      else {
        const queue = eligible.filter((job) => job !== running).sort((a, b) => (a.queued ?? a.release) - (b.queued ?? b.release) || a.task - b.task);
        if (running && ready.includes(running)) running.queued = now; // back of the queue
        chosen = queue[0] ?? (running && ready.includes(running) && !running.blockedOn ? running : null);
        sliceUsed = 0;
      }
    } else {
      chosen = eligible.reduce((best, job) => { if (!best) return job; const a = effective(job, now), b = effective(best, now); return a < b || (a === b && (job === running || (best !== running && (job.release < best.release || (job.release === best.release && job.task < best.task))))) ? job : best; }, null);
    }
    for (const job of ready) if (job.blockedOn) job.blockedTicks += 1;
    if (chosen !== lastRun && chosen && lastRun) switches += 1;
    if (chosen && chosen !== running) sliceUsed = 0;
    running = chosen;
    if (!chosen) { timeline.push(null); lastRun = null; continue; }
    // Lock on entering a section, run one tick, unlock on leaving.
    const section = sectionAt(chosen);
    if (section && !chosen.holding.has(section.resource)) { chosen.holding.add(section.resource); owner.set(section.resource, chosen); events.push({ time: now, type: 'lock', task: chosen.task, resource: section.resource }); }
    timeline.push({ task: chosen.task, job: chosen.number, resource: section?.resource ?? null, priority: effective(chosen, now) });
    chosen.remaining -= 1; chosen.executed += 1; sliceUsed += 1; lastRun = chosen;
    for (const resource of [...chosen.holding]) {
      const s = tasks[chosen.task].sections.find((entry) => entry.resource === resource && chosen.executed === entry.start + entry.length);
      if (s || chosen.remaining === 0) { chosen.holding.delete(resource); owner.delete(resource); events.push({ time: now + 1, type: 'unlock', task: chosen.task, resource }); }
    }
    if (chosen.remaining === 0) {
      chosen.finish = now + 1;
      if (chosen.finish > chosen.absoluteDeadline && !chosen.missed) { chosen.missed = true; events.push({ time: chosen.absoluteDeadline, type: 'miss', task: chosen.task, job: chosen.number }); }
      events.push({ time: now + 1, type: 'finish', task: chosen.task, job: chosen.number });
      ready.splice(ready.indexOf(chosen), 1);
      running = null;
    }
  }
  // Deadlines that fall exactly at the end of the window.
  for (const job of ready) if (!job.missed && job.remaining > 0 && job.absoluteDeadline <= length) { job.missed = true; events.push({ time: job.absoluteDeadline, type: 'miss', task: job.task, job: job.number }); }
  const perTask = tasks.map((task, index) => {
    const own = jobs.filter((job) => job.task === index);
    const done = own.filter((job) => job.finish !== null);
    const responses = done.map((job) => job.finish - job.release);
    return { name: task.name, jobs: own.length, completed: done.length, misses: own.filter((job) => job.missed).length, worstResponse: responses.length ? Math.max(...responses) : null, averageResponse: responses.length ? responses.reduce((a, b) => a + b, 0) / responses.length : null, blockedTicks: own.reduce((sum, job) => sum + job.blockedTicks, 0) };
  });
  const busy = timeline.filter(Boolean).length;
  return { tasks, policy, protocol, length, hyperperiod: hyper, timeline, events, jobs: jobs.map(({ holding, ...job }) => (void holding, job)), perTask, contextSwitches: switches, utilisationObserved: busy / length, schedulable: perTask.every((entry) => entry.misses === 0) };
}

/** Liu & Layland and EDF utilisation tests. */
export function utilisationTests(input) {
  const tasks = normalise(input);
  const u = tasks.reduce((sum, task) => sum + task.wcet / task.period, 0);
  const n = tasks.length;
  const bound = n * (2 ** (1 / n) - 1);
  const hyperbolic = tasks.reduce((product, task) => product * (task.wcet / task.period + 1), 1);
  const implicit = tasks.every((task) => task.deadline === task.period);
  return { utilisation: u, rmBound: bound, rmSufficient: u <= bound, hyperbolicBound: hyperbolic <= 2, edfFeasible: implicit ? u <= 1 : null, density: tasks.reduce((sum, task) => sum + task.wcet / Math.min(task.deadline, task.period), 0) };
}

/**
 * Exact response-time analysis for fixed priorities (synchronous release, D ≤ T):
 * Rᵢ = Cᵢ + Bᵢ + Σ_{j ∈ hp(i)} ⌈Rᵢ / Tⱼ⌉·Cⱼ, iterated to a fixed point. Blocking Bᵢ is the longest
 * lower-priority critical section on a resource whose ceiling is at least i's priority
 * (priority inheritance / ceiling protocols).
 */
export function responseTimeAnalysis(input, { policy = 'rm', protocol = 'none' } = {}) {
  const tasks = normalise(input);
  const rank = staticRank(policy, tasks);
  const ceilings = new Map();
  tasks.forEach((task, index) => { for (const s of task.sections) ceilings.set(s.resource, Math.min(ceilings.get(s.resource) ?? Infinity, rank[index])); });
  return tasks.map((task, i) => {
    const higher = tasks.filter((_, j) => rank[j] < rank[i]);
    let blocking = 0;
    if (protocol !== 'none') for (let j = 0; j < tasks.length; j += 1) if (rank[j] > rank[i]) for (const s of tasks[j].sections) if (ceilings.get(s.resource) <= rank[i]) blocking = Math.max(blocking, s.length);
    let r = task.wcet + blocking, previous = -1, iterations = 0;
    while (r !== previous && r <= task.deadline * 10 && iterations < 1000) {
      previous = r;
      r = task.wcet + blocking + higher.reduce((sum, h) => sum + Math.ceil(previous / h.period) * h.wcet, 0);
      iterations += 1;
    }
    return { name: task.name, priority: rank[i] + 1, blocking, response: r, schedulable: r <= task.deadline, iterations };
  });
}

export const RTOS_EXAMPLES = Object.freeze([
  { id: 'rm-vs-edf', name: 'RM fails, EDF succeeds (U = 0.97)', policy: 'rm', tasks: [{ name: 'T1', period: 5, wcet: 2 }, { name: 'T2', period: 7, wcet: 4 }] },
  { id: 'liu-layland', name: 'Three tasks under the Liu–Layland bound (U = 0.75)', policy: 'rm', tasks: [{ name: 'T1', period: 4, wcet: 1 }, { name: 'T2', period: 5, wcet: 1 }, { name: 'T3', period: 10, wcet: 3 }] },
  { id: 'harmonic', name: 'Harmonic periods: RM reaches 100 %', policy: 'rm', tasks: [{ name: 'T1', period: 4, wcet: 1 }, { name: 'T2', period: 8, wcet: 2 }, { name: 'T3', period: 16, wcet: 8 }] },
  { id: 'priority-inversion', name: 'Priority inversion (Mars Pathfinder)', policy: 'fixed', protocol: 'none', tasks: [{ name: 'High', period: 20, wcet: 3, offset: 4, priority: 1, sections: [{ resource: 'bus', start: 1, length: 2 }] }, { name: 'Medium', period: 20, wcet: 6, offset: 5, priority: 2 }, { name: 'Low', period: 20, wcet: 5, offset: 0, priority: 3, sections: [{ resource: 'bus', start: 1, length: 4 }] }] },
  { id: 'deadline-monotonic', name: 'Constrained deadlines: DM vs RM', policy: 'dm', tasks: [{ name: 'T1', period: 10, wcet: 3, deadline: 10 }, { name: 'T2', period: 12, wcet: 3, deadline: 5 }, { name: 'T3', period: 15, wcet: 4, deadline: 15 }] },
  { id: 'round-robin', name: 'Round robin with a 2-tick quantum', policy: 'rr', tasks: [{ name: 'A', period: 20, wcet: 5 }, { name: 'B', period: 20, wcet: 4 }, { name: 'C', period: 20, wcet: 3 }] },
]);
