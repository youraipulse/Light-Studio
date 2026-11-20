import test from 'node:test';
import assert from 'node:assert/strict';
import {worldToStage,stageDeltaToWorld,lightFootprint} from './lighting-math.js';
test('pointer movement and shader image coordinates agree across aspect ratios',()=>{
 for(const aspect of [.4,.75,1,1.5,2.4])for(const [w,h] of [[1070,598],[350,440],[1400,600]])for(const [x,y] of [[-.8,.7],[.65,-.7],[0,0]]){
  const start=worldToStage(0,0,w,h,aspect),end=worldToStage(x,y,w,h,aspect);
  const delta=stageDeltaToWorld(end.x-start.x,end.y-start.y,w,h,aspect);
  assert.ok(Math.abs(delta.x-x)<1e-12);assert.ok(Math.abs(delta.y-y)<1e-12);
 }
});
test('a light adds nothing beyond its declared spread',()=>{
 for(const r of [.25,.55,1.15,3]){assert.equal(lightFootprint(0,r),1);for(const d of [r,r+.01,r*2,100])assert.equal(lightFootprint(d,r),0);}
});
test('the penumbra fades continuously without secondary bright bands',()=>{
 for(const r of [.25,1.15,3]){let previous=1;for(let i=0;i<=200;i++){const value=lightFootprint(r*i/200,r);assert.ok(value<=previous+1e-12&&value>=0);previous=value;}}
});
