const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/src/main/assets/model.js');
const P = require('../app/src/main/assets/plan.js');

const fixture = () => {
  const state = M.blank();
  M.addNote(state, '# 练背 2/3/2000\n高位下拉\n1. 50kg*10, 2min\n2. 50kg*10, 2min');
  return state;
};
const text = JSON.stringify({ date: '2000-03-09', title: '拉 · 背和二头', note: '下拉加一点', items: [
  { exercise: '高位下拉', sets: 3, reps: '8-10', weight: 52.5, rest: 120 },
  { exercise: '锤式弯举', muscle: '二头', sets: 2, reps: 12 },
  { exercise: '面拉', muscle: '肩', sets: 2, reps: 15 } ] });

test('a plan is read in plain words and refuses what it cannot place', () => {
  const state = fixture(), p = P.parse('```json\n' + text + '\n```', state);
  assert.equal(p.items[0].exerciseId, state.catalog[0].id);
  assert.deepEqual([p.items[0].minReps, p.items[0].maxReps, p.items[0].weight], [8, 10, 52.5]);
  assert.deepEqual(p.muscles, ['背', '二头', '肩']);
  assert.throws(() => P.parse('{"items":[{"exercise":"新动作"}]}', state), /muscle/);
  assert.throws(() => P.parse('不是json', state), /JSON/);
  assert.throws(() => P.parse('{"items":[{"exercise":"高位下拉","reps":"很多"}]}', state), /次数/);
});

test('starting a plan fills targets and the planned weight, and finishing scores completion', () => {
  const state = fixture();
  assert(P.receive(state, text, 1));
  assert.equal(P.receive(state, text, 2), false);
  assert.equal(P.today(state, '2000-03-09').status, 'new');
  P.start(state, state.aiPlan.plan, 3);
  const a = state.active;
  assert.equal(a.title, '拉 · 背和二头');
  assert.equal(a.exercises.length, 3);
  assert.equal(a.draft.weight, 52.5);
  assert.equal(a.draft.reps, 10);
  for (const reps of [10, 9, 6]) { a.draft.reps = reps; M.complete(state); }
  M.select(state, a.exercises[1].exerciseId);
  a.draft.weight = 12; a.draft.reps = 12; M.complete(state); a.draft.reps = 12; M.complete(state);
  const s = P.finish(state, 4);
  assert.deepEqual(s.plan.result.items.map(x => x.status), ['partial', 'done', 'skipped']);
  assert.equal(s.plan.result.percent, Math.round((2 + 0.5 + 2) / 7 * 100));
  assert.equal(state.aiPlan.status, 'done');
  assert.equal(P.today(state, '2000-03-09'), null);
  M.validate(state);
  M.validate(JSON.parse(JSON.stringify(state)));
});

test('a set-aside plan stays hidden, and a newer plan replaces it', () => {
  const state = fixture();
  P.receive(state, text, 1); P.dismiss(state, 2);
  assert.equal(P.today(state, '2000-03-09'), null);
  P.receive(state, text.replace('拉 · 背和二头', '拉 · 第二版'), 3);
  assert.equal(P.today(state, '2000-03-09').plan.title, '拉 · 第二版');
  assert.equal(P.today(state, '2000-03-10'), null);
});
