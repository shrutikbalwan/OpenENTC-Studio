import test from 'node:test';
import assert from 'node:assert/strict';
import { lcm, responseTimeAnalysis, RTOS_EXAMPLES, simulateSchedule, utilisationTests } from '../packages/rtos/src/index.mjs';

const example = (id) => RTOS_EXAMPLES.find((entry) => entry.id === id);
const order = (result, letters) => result.timeline.map((slot) => (slot ? letters[slot.task] : '.')).join('');

test('RM misses where EDF succeeds; utilisation tests', () => {
  const tasks = example('rm-vs-edf').tasks;
  const rm = simulateSchedule(tasks, { policy: 'rm' });
  assert.equal(rm.schedulable, false);
  assert.equal(rm.perTask[1].misses, 1);
  assert.equal(order(rm, '12').slice(0, 9), '112221122'); // T2 finishes at 8 > deadline 7
  assert.equal(simulateSchedule(tasks, { policy: 'edf' }).schedulable, true);
  const u = utilisationTests(tasks);
  assert.ok(Math.abs(u.utilisation - (2 / 5 + 4 / 7)) < 1e-12);
  assert.equal(u.rmSufficient, false); assert.equal(u.edfFeasible, true);
  assert.ok(Math.abs(utilisationTests([{ period: 1, wcet: 1 }, { period: 1, wcet: 1 }, { period: 1, wcet: 1 }]).rmBound - 3 * (2 ** (1 / 3) - 1)) < 1e-12);
  assert.equal(lcm([4, 6, 10]), 60);
});

test('simulated worst-case responses equal exact response-time analysis (random synchronous task sets)', () => {
  let seed = 7;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let checked = 0;
  for (let trial = 0; trial < 300; trial += 1) {
    const n = 2 + Math.floor(random() * 3);
    const tasks = Array.from({ length: n }, (_, k) => { const period = [4, 5, 6, 8, 10, 12, 15, 20][Math.floor(random() * 8)]; return { name: `T${k + 1}`, period, wcet: 1 + Math.floor(random() * Math.max(1, period / n)) }; });
    if (lcm(tasks.map((task) => task.period)) > 600) continue;
    for (const policy of ['rm', 'dm']) {
      const analysis = responseTimeAnalysis(tasks, { policy });
      if (!analysis.every((entry) => entry.schedulable)) continue;
      const simulation = simulateSchedule(tasks, { policy });
      assert.equal(simulation.schedulable, true);
      simulation.perTask.forEach((entry, index) => assert.equal(entry.worstResponse, analysis[index].response, `${JSON.stringify(tasks)} ${policy}`));
      checked += 1;
    }
  }
  assert.ok(checked > 100, `checked ${checked}`);
});

test('EDF schedules every implicit-deadline set with U ≤ 1', () => {
  let seed = 3;
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let trial = 0; trial < 200; trial += 1) {
    const tasks = Array.from({ length: 3 }, () => { const period = [3, 4, 6, 8, 12][Math.floor(random() * 5)]; return { period, wcet: 1 + Math.floor(random() * (period - 1)) }; });
    const u = utilisationTests(tasks).utilisation;
    assert.equal(simulateSchedule(tasks, { policy: 'edf' }).schedulable, u <= 1 + 1e-12, JSON.stringify(tasks));
  }
});

test('priority inversion and the resource protocols', () => {
  const tasks = example('priority-inversion').tasks;
  const none = simulateSchedule(tasks, { policy: 'fixed', protocol: 'none' });
  assert.equal(order(none, 'HML').slice(0, 14), 'LLLLHMMMMMMLHH'); // Medium runs while High waits for Low's bus
  assert.equal(none.perTask[0].worstResponse, 10);
  const pip = simulateSchedule(tasks, { policy: 'fixed', protocol: 'pip' });
  assert.equal(order(pip, 'HML').slice(0, 8), 'LLLLHLHH'); // Low inherits High's priority
  assert.equal(pip.perTask[0].worstResponse, 4);
  const pcp = simulateSchedule(tasks, { policy: 'fixed', protocol: 'pcp' });
  assert.equal(order(pcp, 'HML').slice(0, 8), 'LLLLLHHH'); // Low runs at the ceiling once it locks
  const bound = responseTimeAnalysis(tasks, { policy: 'fixed', protocol: 'pip' });
  assert.equal(bound[0].blocking, 4); assert.ok(bound[0].response >= pip.perTask[0].worstResponse);
});

test('round robin, FCFS, LLF and input checks', () => {
  assert.equal(order(simulateSchedule(example('round-robin').tasks, { policy: 'rr', quantum: 2 }), 'ABC').slice(0, 12), 'AABBCCAABBCA');
  assert.equal(order(simulateSchedule([{ name: 'A', period: 10, wcet: 4 }, { name: 'B', period: 10, wcet: 2, offset: 1 }], { policy: 'fcfs' }), 'AB').slice(0, 6), 'AAAABB');
  assert.equal(simulateSchedule(example('rm-vs-edf').tasks, { policy: 'llf' }).schedulable, true);
  const dm = example('deadline-monotonic').tasks;
  assert.equal(simulateSchedule(dm, { policy: 'dm' }).schedulable, true); assert.equal(simulateSchedule(dm, { policy: 'rm' }).schedulable, false);
  assert.throws(() => simulateSchedule([{ period: 5, wcet: 6 }]), /longer than its deadline/);
  assert.throws(() => simulateSchedule([{ period: 5, wcet: 2 }], { policy: 'lottery' }), /Unknown policy/);
});
