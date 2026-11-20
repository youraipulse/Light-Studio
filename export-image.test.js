import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exportTiles} from './export-image.js';
test('native tiles cover landscape, portrait and irregular images without resize or overlap',()=>{
 for(const [width,height] of [[7680,4320],[4320,7680],[8192,8192],[2573,1801],[11,7]]){
  let area=0;const tiles=[...exportTiles(width,height)];
  for(const t of tiles){assert.ok(t.width<=1024&&t.height<=1024);assert.ok(t.x+t.width<=width&&t.y+t.height<=height);assert.deepEqual(t.region,[t.x/width,1-(t.y+t.height)/height,(t.x+t.width)/width,1-t.y/height]);area+=t.width*t.height;}
  assert.equal(area,width*height);assert.equal(tiles.at(-1).x+tiles.at(-1).width,width);assert.equal(tiles.at(-1).y+tiles.at(-1).height,height);
 }
});
