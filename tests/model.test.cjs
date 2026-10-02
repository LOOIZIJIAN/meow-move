const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../app/src/main/assets/model.js');

// Fictional parser examples. These are not anyone's training history.
const notes = [
  '# 练胸 2/1/2000\n杠铃卧推\n1. 20kg*10, 2min\n2. 22.5kg*8, 2.5min\n下斜推胸（单边）\n1. 10kg*10, 2min\n2. 10kg*9,',
  '# 练背 5/1/2000\n俯身杠铃划船\n1. 反手 30kg*10, 2min\n2. 正手 32.5kg*8, 2min',
  '# 练背 8/1/2000\n俯身杠铃划船\n1. 反手 35kg*8, 2.5min',
  '# 练腿 9/1/2000\n保加利亚蹲\n1. 自重*8, 1.5min',
];
const fixture = () => {
  const state = M.blank();
  for (const note of notes) M.addNote(state, note);
  return state;
};
const publicSeed = () => JSON.parse(fs.readFileSync(__dirname + '/../app/src/main/assets/seed.json', 'utf8'));

test('the public app starts empty and has generic exercises for every muscle', () => {
  const state = publicSeed();
  M.validate(state);
  assert.deepEqual(state.sessions, []);
  assert.deepEqual(state.sources, []);
  assert.equal(state.active, null);
  assert(state.catalog.length > 0);
  for (const muscle of M.MUSCLES) assert(state.catalog.some(e => e.muscle === muscle));
  const browserSeed = fs.readFileSync(__dirname + '/../app/src/main/assets/seed.js', 'utf8');
  assert.equal(browserSeed, 'window.MeowSeed = ' + JSON.stringify(state) + ';\n');
});

test('fictional Markdown imports retain all source text and valid set references', () => {
  const state = fixture();
  M.validate(state);
  assert.equal(state.sessions.length, 4);
  assert.equal(state.sources.length, 4);
  assert.equal(M.stats(state).sets, 8);
  assert.deepEqual(state.sources.map(s => s.raw), notes);
  for (const source of state.sources) assert(state.sessions.some(s => s.sourceId === source.id));
});

test('rest times, missing values and explicit one-side weights remain distinct', () => {
  const chest = fixture().sessions[0];
  assert.equal(chest.exercises[0].sets[1].restSec, 150);
  const press = chest.exercises[1];
  assert.equal(press.sets[0].kind, 'side');
  assert.equal(press.sets[0].weight, 10);
  assert.equal(press.sets[1].restSec, null);
});

test('unknown units, asymmetric repetitions and drop sets keep their original meaning', () => {
  const unknown = M.parseSet('1. 19*7, 2');
  assert.equal(unknown.unit, null);
  assert.equal(unknown.restSec, null);
  const side = M.parseSet('1. 5kg right*11 left*9, 2min');
  assert.equal(side.complex, true);
  assert.equal(side.reps, null);
  assert.deepEqual(side.sideReps, {right: 11, left: 9});
  const drop = M.parseSet('1. 8kg*6 + 5kg*4, 2min');
  assert.equal(drop.complex, true);
  assert.equal(drop.reps, null);
});

test('trends compare the same exercise, grip and weight basis', () => {
  const state = fixture();
  const row = M.exerciseId('俯身杠铃划船');
  assert.deepEqual(M.series(state, row, 'recorded', '反手').map(p => p.value), [30, 35]);
  assert.deepEqual(M.series(state, row, 'recorded', '正手').map(p => p.value), [32.5]);
  assert.equal(M.series(state, row, 'total', '反手').length, 0);
  const press = M.exerciseId('下斜推胸');
  assert.equal(M.series(state, press, 'recorded').length, 0);
  assert.equal(M.series(state, press, 'side')[0].value, 10);
});

test('live workouts survive serialization and preserve inputs across exercise switches', () => {
  const state = fixture();
  const bench = M.exerciseId('杠铃卧推');
  const other = M.exerciseId('下斜推胸');
  M.begin(state, ['胸'], [bench, other]);
  state.active.draft.weight = '24';
  state.active.draft.reps = '7';
  state.active.draft.feeling = '吃力';
  M.select(state, other);
  M.select(state, bench);
  assert.equal(state.active.draft.weight, '24');
  const set = M.complete(state);
  assert.equal(set.weight, 24);
  assert.equal(set.reps, 7);
  assert.equal(set.feeling, '吃力');
  const restored = JSON.parse(JSON.stringify(state));
  M.validate(restored);
  assert.equal(restored.active.exercises[0].sets[0].weight, 24);
  const finished = M.finish(restored);
  assert.equal(restored.active, null);
  assert.equal(restored.sessions.length, 5);
  assert.equal(finished.exercises.length, 1);
});

test('invalid input adds no phantom set; bodyweight needs no numeric weight', () => {
  const state = fixture();
  M.begin(state, ['腿'], [M.exerciseId('保加利亚蹲')]);
  state.active.draft.kind = 'recorded';
  state.active.draft.weight = '';
  assert.throws(() => M.complete(state));
  assert.equal(state.active.exercises[0].sets.length, 0);
  state.active.draft.kind = 'body';
  const set = M.complete(state);
  assert.equal(set.weight, null);
  assert.equal(set.unit, null);
  assert.equal(set.reps, 8);
});

test('weekly counts use calendar dates with Monday boundaries', () => {
  assert.equal(M.weekly(fixture(), new Date(2000, 0, 9)), 3);
  assert.equal(M.weekStart(new Date(2000, 0, 2)), '1999-12-27');
  assert.equal(M.weekStart(new Date(2000, 0, 3)), '2000-01-03');
});

test('restore merges once and keeps the current unfinished workout', () => {
  const state = fixture();
  M.begin(state, ['胸'], [M.exerciseId('杠铃卧推')]);
  const activeId = state.active.id;
  const result = M.merge(state, fixture());
  assert.equal(result.added, 0);
  assert.equal(result.state.active.id, activeId);
  assert.equal(result.state.sessions.length, 4);
  const firstRestore = M.merge(publicSeed(), fixture());
  assert.equal(firstRestore.added, 4);
  assert.equal(M.merge(firstRestore.state, fixture()).added, 0);
  assert.throws(() => M.merge(state, {app: 'other'}));
});

test('restore recovers edits and preferences without overwriting newer local edits', () => {
  const local = fixture(), backup = fixture();
  backup.preferences.weeklyGoal = 5;
  backup.sessions[0].exercises[0].sets[0].weight = 26;
  backup.sessions[0].exercises[0].sets[0].editedAt = 1000;
  const restored = M.merge(local, backup);
  assert.equal(restored.updated, 1);
  assert.equal(restored.state.sessions[0].exercises[0].sets[0].weight, 26);
  assert.equal(restored.state.preferences.weeklyGoal, 5);
  restored.state.sessions[0].exercises[0].sets[0].weight = 28;
  restored.state.sessions[0].exercises[0].sets[0].editedAt = 2000;
  const kept = M.merge(restored.state, backup);
  assert.equal(kept.updated, 0);
  assert.equal(kept.state.sessions[0].exercises[0].sets[0].weight, 28);
});

test('AI exports preserve missing rest, original text and side-weight semantics', () => {
  const state = fixture();
  const md = M.exportMarkdown(state, '2000-01-02', '2000-01-02');
  const csv = M.exportCsv(state, '2000-01-02', '2000-01-02');
  assert(md.includes('10 kg / 单边'));
  assert(md.includes('休息未记录'));
  assert(md.includes('22.5kg*8, 2.5min'));
  assert.equal(csv.split('\r\n').length, 5);
  assert(csv.includes('单边重量'));
  assert(!md.includes('练背'));
});

test('duplicate imports, invalid dates and unknown future schemas are rejected safely', () => {
  const state = fixture();
  assert.equal(M.addNote(state, notes[0]), false);
  state.schema = 99;
  assert.throws(() => M.validate(state));
  assert.throws(() => M.parseNote('# 练胸 31/2/2000\n卧推\n1. 20kg*10'));
});

test('CSV escapes formula-like notes and embedded quote characters', () => {
  const state = fixture();
  state.sessions[0].note = '=1+1';
  state.sessions[0].exercises[0].sets[0].feeling = '@SUM(1,2)';
  state.sessions[0].exercises[0].sets[0].note = 'contains "quotes"';
  const csv = M.exportCsv(state);
  assert(csv.includes('"\'@SUM(1,2)"'));
  assert(csv.includes('contains ""quotes""'));
  assert(csv.includes('"\'=1+1"'));
});
