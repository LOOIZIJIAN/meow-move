const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../app/src/main/assets/timer.js');
const M=require('../app/src/main/assets/model.js');

test('a standalone timer starts without creating any training history',()=>{
 const state=M.blank();state.restTimer=T.start(state.restTimer,120,1000);
 M.validate(state);assert.equal(state.active,null);assert.deepEqual(state.sessions,[]);
 assert.equal(T.remaining(state.restTimer,31000),90000);
});
test('pausing and resuming retain fractional time across serialization',()=>{
 const running=T.start(T.blank(),150,1000),paused=T.pause(running,1633);
 assert.equal(paused.remainingMs,149367);assert.equal(T.remaining(paused,999999),149367);
 const restored=JSON.parse(JSON.stringify(paused));T.validate(restored);
 const resumed=T.resume(restored,10000);assert.equal(resumed.endAt,159367);
 assert.equal(T.remaining(resumed,11000),148367);
});
test('a running timer resumes from its deadline after the app is reopened',()=>{
 const reopened=JSON.parse(JSON.stringify(T.start(T.blank(),90,1000)));
 assert.equal(T.remaining(reopened,40000),51000);
 assert.equal(T.settle(reopened,91000).status,'done');
 assert.equal(T.remaining(reopened,200000),0);
});
test('expiry is settled once without negative time or automatic repeating',()=>{
 let state=T.settle(T.start(T.blank(),1,1000),2000);
 assert.equal(state.status,'done');assert.equal(state.remainingMs,0);
 state={...state,notified:true};assert.deepEqual(T.settle(state,999999),state);
 const next=T.start(state,1,3000);assert.notEqual(next.cycleId,state.cycleId);
 assert.equal(next.notified,false);
});
test('adjusting a running rest changes only this interval and is bounded',()=>{
 const state=T.start(T.blank(),120,1000);
 const extended=T.adjust(state,15,11000);assert.equal(extended.durationSec,120);
 assert.equal(T.remaining(extended,11000),125000);
 assert.equal(T.adjust(extended,-300,11000).status,'done');
 assert.equal(T.remaining(T.adjust(extended,99999,11000),11000),3600000);
});
test('adjusting a paused timer preserves the paused state',()=>{
 const paused=T.pause(T.start(T.blank(),60,1000),11000);
 const extended=T.adjust(paused,15,999999);
 assert.equal(extended.status,'paused');assert.equal(extended.remainingMs,65000);
 assert.equal(T.remaining(extended,1999999),65000);
});
test('reset retains the selected duration and clears stale notification identity',()=>{
 const reset=T.reset(T.pause(T.start(T.blank(),180,1000),2000));
 assert.equal(reset.status,'idle');assert.equal(reset.durationSec,180);
 assert.equal(reset.remainingMs,180000);assert.equal(reset.cycleId,null);
 assert.equal(reset.sessionId,null);
});
test('invalid custom durations and malformed state are rejected',()=>{
 for(const value of [0,-1,3601,1.5,'bad'])assert.throws(()=>T.blank(value));
 assert.throws(()=>T.select(T.start(T.blank(),120,1000),60));
 assert.throws(()=>T.validate({...T.blank(),status:'running',endAt:0}));
 assert.throws(()=>T.validate({...T.blank(),remainingMs:NaN}));
 assert.equal(T.select(T.blank(),3600).remainingMs,3600000);
});
test('saving a set starts the common timer and finishing clears its workout timer',()=>{
 const state=M.blank(),eid=M.exerciseId('测试动作');
 state.catalog.push({id:eid,name:'测试动作',muscle:'胸',defaultKind:'total'});
 M.begin(state,['胸'],[eid]);state.active.draft.weight='20';state.active.draft.reps='8';state.active.draft.restSec=90;
 M.complete(state);assert.equal(state.restTimer.status,'running');
 assert.equal(state.restTimer.sessionId,state.active.id);
 assert.equal(state.active.restUntil,state.restTimer.endAt);
 M.finish(state);assert.equal(state.restTimer.status,'idle');
});
test('backup merging preserves this device timer and accepts legacy records',()=>{
 const current=M.blank(),backup=M.blank();
 current.restTimer=T.pause(T.start(current.restTimer,90,1000),2000);
 backup.restTimer=T.start(backup.restTimer,300,5000);
 const merged=M.merge(current,backup).state;
 assert.deepEqual(merged.restTimer,current.restTimer);
 delete backup.restTimer;assert.doesNotThrow(()=>M.validate(backup));
 assert.deepEqual(M.merge(current,backup).state.restTimer,current.restTimer);
});
