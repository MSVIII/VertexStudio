const test=require('node:test'),assert=require('node:assert/strict');
const S=require('./scene'),G=require('./geometry');
const copy=o=>JSON.parse(JSON.stringify(o));
const shape=(id,x=0)=>({id,name:id,type:'triangles',color:'#93ddc2',opacity:.7,lineWidth:11,pointSize:20,visible:true,locked:false,vertices:[{x:x/20,y:0},{x:(x+2)/20,y:0},{x:(x+1)/20,y:.1}]});
const document=()=>S.normalize({name:'Scene',objects:[shape('a'),shape('b',3),shape('c',6),shape('d',9)]});
test('grouping nonadjacent primitives makes one contiguous layer at their frontmost position',()=>{
  const d=document(),g=S.createGroup(d,['a','c'],'g','Robot');assert.deepEqual(g.children,['a','c']);assert.deepEqual(d.layers,[{kind:'object',id:'b'},{kind:'group',id:'g'},{kind:'object',id:'d'}]);assert.deepEqual(d.objects.map(o=>o.id),['b','a','c','d']);assert.equal(S.parent(d,'a').id,'g');
});
test('empty folders accept new primitives while unrelated objects remain on the canvas',()=>{
  const d=document();S.createGroup(d,[],'g','Object two');S.addObject(d,shape('e',12),'g');assert.deepEqual(S.group(d,'g').children,['e']);assert.deepEqual(d.objects.map(o=>o.id),['a','b','c','d','e']);S.addObject(d,shape('f',15));assert.equal(d.layers.at(-1).id,'f');assert.ok(!S.parent(d,'f'));
});
test('moving primitives between folders preserves selected relative order and permits empty folders',()=>{
  const d=document();S.createGroup(d,['a','b'],'one');S.createGroup(d,['c','d'],'two');S.assignObjects(d,['b','a'],'two');assert.deepEqual(S.group(d,'one').children,[]);assert.deepEqual(S.group(d,'two').children,['c','d','a','b']);S.assignObjects(d,['a','b'],null);assert.deepEqual(d.layers.slice(-2).map(n=>n.id),['a','b']);
});
test('folder visibility affects browser/export inclusion without erasing child visibility',()=>{
  const d=document(),g=S.createGroup(d,['a','b'],'g');g.visible=false;assert.deepEqual(S.visibleObjects(d).map(o=>o.id),['c','d']);assert.equal(S.object(d,'a').visible,true);
  const exported=JSON.parse(G.exportCode(d,'json'));assert.deepEqual(exported.draws.map(o=>o.name),['c','d']);g.visible=true;S.object(d,'b').visible=false;assert.equal(S.visibleObjects(d).length,3);
});
test('folder and child locks prevent geometry changes, regrouping, deletion, and reparenting',()=>{
  const d=document(),g=S.createGroup(d,['a','b'],'g');g.locked=true;assert.ok(S.isLocked(d,S.object(d,'a')));assert.throws(()=>S.requireEditable(d,['a']),/Unlock/);assert.throws(()=>S.assignObjects(d,['a'],null),/Unlock/);assert.throws(()=>S.addObject(d,shape('x'),'g'),/Unlock/);assert.throws(()=>S.ungroup(d,'g'),/Unlock/);g.locked=false;S.object(d,'b').locked=true;assert.throws(()=>S.removeGroup(d,'g'),/Unlock/);assert.equal(d.objects.length,4);
});
test('shared transforms translate, uniformly scale, and rotate around one common pivot',()=>{
  const source=[shape('a'),shape('b',4)],original=copy(source),result=S.transform(source,{dx:.15,dy:-.1,scale:2,angle:90,pivot:{x:.15,y:.05}});
  assert.ok(Math.abs(result[0].vertices[0].x-.4)<1e-10);assert.ok(Math.abs(result[0].vertices[0].y+.35)<1e-10);
  const a=result[0].vertices[0],b=result[1].vertices[0];assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-.4)<1e-10);assert.equal(result[0].lineWidth,11);assert.equal(result[0].pointSize,20);assert.equal(result[0].opacity,.7);assert.deepEqual(source,original);result.forEach(G.validateObject);
});
test('invalid transforms fail without mutating source coordinates',()=>{
  const source=[shape('a')],before=copy(source);for(const args of [{scale:0},{angle:NaN},{dx:1e8},{scale:1001}])assert.throws(()=>S.transform(source,args));assert.deepEqual(source,before);
});
test('whole-folder layer ordering moves a contiguous block and retains its internal stack',()=>{
  const d=document();S.createGroup(d,['a','b'],'g');assert.ok(S.moveLayer(d,[],'g',1));assert.deepEqual(d.objects.map(o=>o.id),['c','a','b','d']);assert.deepEqual(S.group(d,'g').children,['a','b']);assert.ok(S.moveLayer(d,['a'],null,1));assert.deepEqual(S.group(d,'g').children,['b','a']);
});
test('ungrouping preserves visual order and deletes only the container',()=>{
  const d=document();S.createGroup(d,['a','b'],'g');const before=d.objects.map(o=>o.id);assert.deepEqual(S.ungroup(d,'g'),['a','b']);assert.deepEqual(d.objects.map(o=>o.id),before);assert.equal(d.groups.length,0);assert.ok(d.layers.every(n=>n.kind==='object'));
});
test('duplicate folder creates independent IDs, vertices, colors, and a sibling container',()=>{
  const d=document();S.createGroup(d,['a','b'],'g','Robot');let id=0;const result=S.duplicate(d,[],'g',()=>`copy-${++id}`,.1,-.05);assert.equal(result.ids.length,2);assert.notEqual(result.groupId,'g');assert.equal(S.group(d,result.groupId).name,'Robot copy');const clone=S.object(d,result.ids[0]);assert.equal(clone.vertices[0].x,.1);assert.equal(clone.vertices[0].y,-.05);assert.equal(clone.color,S.object(d,'a').color);clone.vertices[0].x=99;assert.equal(S.object(d,'a').vertices[0].x,0);
});
test('deleting a folder removes its members while deleting children can leave a reusable empty folder',()=>{
  const d=document();S.createGroup(d,['a','b'],'g');S.removeObjects(d,['a','b']);assert.equal(d.groups.length,1);assert.equal(S.group(d,'g').children.length,0);S.addObject(d,shape('e'),'g');S.removeGroup(d,'g');assert.deepEqual(d.objects.map(o=>o.id),['c','d']);assert.equal(d.groups.length,0);
});
test('version two projects round-trip names, membership, ordering, locks, visibility and collapse state',()=>{
  const d=document(),g=S.createGroup(d,['a','b'],'g','Finished object');g.collapsed=true;g.locked=true;g.visible=false;const restored=G.parseProject(JSON.stringify({format:'vertex-studio-project',version:2,...d}));assert.deepEqual(restored,d);
  const empty=S.normalize({name:'Empty',objects:[]});S.createGroup(empty,[],'e');assert.equal(G.parseProject(JSON.stringify({format:'vertex-studio-project',version:2,...empty})).groups.length,1);
});
test('malformed folders cannot reference missing objects, duplicate members or orphan layers',()=>{
  const d=document();S.createGroup(d,['a','b'],'g');
  for(const edit of [x=>x.groups[0].children.push('missing'),x=>x.groups[0].children.push('a'),x=>x.layers.pop(),x=>x.layers.push({kind:'group',id:'g'}),x=>x.groups[0].id='a']){const invalid=copy(d);edit(invalid);assert.throws(()=>G.parseProject(JSON.stringify({format:'vertex-studio-project',version:2,...invalid})));}
});
