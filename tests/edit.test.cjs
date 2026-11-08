const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../app/src/main/assets/model.js');
const X = require('../app/src/main/assets/edit.js');

// Fictional log: a shoulder press filed under legs, two spellings of one row and an unused lunge.
const fixture = () => {
  const state = M.blank();
  M.addNote(state, '# 练肩 2/3/2000\n史密斯推肩\n1. 30kg*10, 2min\nSeated Row\n1. 40kg*10, 2min');
  M.addNote(state, '# 练背 4/3/2000\nSeated-Row\n1. 42.5kg*8, 2min\nleg cuel\n1. 20kg*12, 1min');
  state.catalog.find(e => e.name === '史密斯推肩').muscle = '腿';
  state.catalog.push({ id: 'custom-lunge', name: '行走箭步蹲', muscle: '腿', defaultKind: 'recorded', archived: false });
  M.validate(state);
  return state;
};
const id = (state, name) => state.catalog.find(e => e.name === name).id;

test('muscle and default weight mode can be changed and survive validation', () => {
  const state = fixture(), eid = id(state, '史密斯推肩'), before = M.stats(state).muscles['肩'] || 0;
  assert.equal(X.editExercise(state, eid, { muscle: '肩', defaultKind: 'total' }, 5), true);
  assert.equal(state.catalog.find(e => e.id === eid).muscle, '肩');
  assert.equal(M.stats(state).muscles['肩'], before + 1);
  assert.throws(() => X.editExercise(state, eid, { muscle: '脚' }), /部位/);
  M.validate(state);
});

test('only unused exercises can be deleted, and the deletion holds across an import', () => {
  const state = fixture(), old = M.clone(state);
  assert.throws(() => X.removeExercise(state, id(state, '史密斯推肩')), /已经记录过 1 组/);
  X.removeExercise(state, 'custom-lunge', 9);
  assert(!state.catalog.some(e => e.id === 'custom-lunge'));
  const merged = M.merge(state, old).state;
  assert(!merged.catalog.some(e => e.id === 'custom-lunge'));
});

test('merging moves every set and keeps one entry per workout', () => {
  const state = fixture(), from = id(state, 'Seated-Row'), into = id(state, 'Seated Row');
  state.goals = [];
  assert.equal(X.mergeExercise(state, from, into, 7), 1);
  assert(!state.catalog.some(e => e.id === from));
  assert.deepEqual(M.series(state, into).map(p => p.value), [40, 42.5]);
  M.validate(state);
});

test('tidy finds the misfiled, duplicate, unused and misspelled exercises without changing anything', () => {
  const state = fixture(), before = JSON.stringify(state), t = X.tidy(state);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(t.muscle.map(x => [x.name, x.to]), [['史密斯推肩', '肩']]);
  assert.deepEqual(t.duplicate.map(g => [g.into.name, g.from.map(x => x.name)]).flat(2).sort(), ['Seated Row', 'Seated-Row'].sort());
  assert.deepEqual(t.unused.map(x => x.name), ['行走箭步蹲']);
  assert.deepEqual(t.spelling.map(x => x.to), ['leg curl']);
});

test('a workout can get new times, title and muscles, lose an exercise, or be removed for good', () => {
  const state = fixture(), s = state.sessions[1], old = M.clone(state);
  X.editSession(state, s.id, { date: '2000-03-05', start: '19:40', end: '21:05', title: '背 · 补练', muscles: ['背', '腿'] }, 11);
  const t = M.timing(s);
  assert.deepEqual([s.date, t.start, t.end, t.minutes, s.title], ['2000-03-05', '19:40', '21:05', 85, '背 · 补练']);
  assert.equal(X.editSession(state, s.id, { start: '23:30', end: '00:30' }).endedAt - s.startedAt, 3600000);
  assert.throws(() => X.editSession(state, s.id, { start: '9点' }), /时:分/);
  X.removeSessionExercise(state, s.id, id(state, 'leg cuel'));
  assert.equal(s.exercises.length, 1);
  assert.throws(() => X.removeSessionExercise(state, s.id, s.exercises[0].exerciseId), /最后一个动作/);
  X.removeSession(state, s.id, 12);
  assert.equal(state.sessions.length, 1);
  assert.equal(M.merge(state, old).state.sessions.length, 1);
  M.validate(state);
});
