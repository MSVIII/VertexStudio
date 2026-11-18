const test=require('node:test'),assert=require('node:assert/strict');
const G=require('./geometry'),S=require('./scene');
const shape=(type='polygon',coords=[[0,0],[2,0],[2,2],[0,2]])=>({id:'shape',name:'Original layer',type,color:'#c6a5df',opacity:0.15,lineWidth:11,pointSize:24,visible:true,locked:false,vertices:coords.map(([x,y])=>({x:x/4,y:y/4}))});
const copy=o=>JSON.parse(JSON.stringify(o));
test('inserting a point preserves the polygon outline, appearance and original source data',()=>{
  const o=shape(),before=copy(o),updated=G.insertVertex(o,0,{x:0.25,y:0.05});assert.equal(updated.vertices.length,5);assert.deepEqual(updated.vertices[1],{x:0.25,y:0.0});assert.equal(G.area(updated.vertices),G.area(o.vertices));assert.deepEqual(o,before);
  for(const key of ['id','name','color','opacity','lineWidth','pointSize','visible','locked'])assert.equal(updated[key],o[key]);
});
test('insertion projects onto diagonal edges instead of rounding to the integer grid',()=>{
  const o=shape('polygon',[[0,0],[3,2],[0,4]]),updated=G.insertVertex(o,0,{x:0.35,y:0.275}),p=updated.vertices[1];assert.ok(Math.abs(G.cross(o.vertices[0],o.vertices[1],p))<1e-10);assert.ok(!Number.isInteger(p.x));assert.ok(Math.abs(G.area(updated.vertices)-G.area(o.vertices))<1e-10);
});
test('the closing edge inserts after the last vertex without changing the first vertex',()=>{
  const o=shape(),updated=G.insertVertex(o,3,{x:-0.025,y:0.25});assert.deepEqual(updated.vertices[0],o.vertices[0]);assert.deepEqual(updated.vertices.at(-1),{x:0.0,y:0.25});assert.doesNotThrow(()=>G.validateObject(updated));
});
test('concave polygons preserve area and winding when a boundary point is inserted',()=>{
  for(const coords of [[[0,0],[4,0],[4,4],[2,2],[0,4]],[[0,4],[2,2],[4,4],[4,0],[0,0]]]){const o=shape('polygon',coords),a=o.vertices[1],b=o.vertices[2],updated=G.insertVertex(o,1,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});assert.ok(Math.abs(G.area(updated.vertices)-G.area(o.vertices))<1e-10);assert.doesNotThrow(()=>G.triangulate(updated.vertices));}
});
test('open strips only expose real segments and closed loops expose their closing edge',()=>{
  const o=shape('line-strip',[[0,0],[2,0],[2,2]]);assert.equal(G.edgeCount(o),2);const updated=G.insertVertex(o,1,{x:0.5,y:0.25});assert.equal(updated.type,'line-strip');assert.equal(updated.vertices.length,4);assert.throws(()=>G.insertVertex(o,2,{x:0.25,y:0.25}),/edge/);
  const loop=shape('line-loop');assert.equal(G.edgeCount(loop),4);assert.equal(G.insertVertex(loop,3,{x:0.0,y:0.25}).type,'line-loop');
});
test('individual OpenGL triangles become editable polygon outlines on the same layer',()=>{
  for(const type of ['triangles','triangle-strip','triangle-fan']){const o=shape(type,[[0,0],[2,0],[0,2]]),updated=G.insertVertex(o,0,{x:0.25,y:0.0});assert.equal(updated.id,o.id);assert.equal(updated.type,'polygon');assert.equal(updated.vertices.length,4);assert.equal(G.renderVertices(updated).length,3);updated.vertices[1].y=-.25;assert.equal(G.renderVertices(updated).length,6);}
});
test('duplicates, nonexistent segments, locked paths and unsupported primitive batches are rejected',()=>{
  const o=shape();for(const point of [{x:0.0,y:0.0},{x:0.5,y:0.0},{x:NaN,y:0.0},{x:Infinity,y:0.25}])assert.throws(()=>G.insertVertex(o,0,point));
  for(const index of [-1,4,1.5])assert.throws(()=>G.insertVertex(o,index,{x:0.25,y:0.0}),/edge/);
  assert.throws(()=>G.insertVertex({...o,locked:true},0,{x:0.25,y:0.0}),/Unlock/);
  for(const type of ['points','lines'])assert.throws(()=>G.insertVertex(shape(type),0,{x:0.25,y:0.0}),/polygon/);
  assert.ok(!G.canInsertVertex(shape('triangles',[[0,0],[1,0],[0,1],[2,0],[3,0],[2,1]])));
});
test('nearest-edge picking includes the closing segment and ignores degenerate edges',()=>{
  const o=shape(),right=G.nearestEdge(o,{x:0.525,y:0.25});assert.equal(right.index,1);assert.ok(Math.abs(right.distance-.025)<1e-10);assert.deepEqual(right.point,{x:0.5,y:0.25});assert.equal(G.nearestEdge(o,{x:-0.025,y:0.25}).index,3);
  const duplicates=shape('line-strip',[[0,0],[0,0],[2,0]]);assert.equal(G.nearestEdge(duplicates,{x:0.25,y:0.05}).index,1);assert.equal(G.nearestEdge(o,null),null);
});
test('a legacy outline with an explicit closing duplicate remains editable',()=>{
  const o=shape('polygon',[[0,0],[2,0],[2,2],[0,2],[0,0]]),updated=G.insertVertex(o,3,{x:0.0,y:0.25});assert.equal(updated.vertices.length,6);assert.deepEqual(updated.vertices.at(-1),{x:0.0,y:0.0});assert.equal(G.area(updated.vertices),.25);assert.equal(G.triangulate(updated.vertices).length,6);
});
test('new vertices survive grouped project saving and edited geometry reaches the exported array',()=>{
  const doc=S.normalize({name:'Grouped shape',objects:[shape()]});S.createGroup(doc,['shape'],'folder','Object');const original=S.object(doc,'shape'),updated=G.insertVertex(original,0,{x:0.25,y:0.0});original.vertices=updated.vertices;original.vertices[1].y=-.25;
  assert.equal(doc.objects.length,1);assert.deepEqual(S.group(doc,'folder').children,['shape']);const reopened=G.parseProject(JSON.stringify({format:'vertex-studio-project',version:2,...doc}));assert.equal(reopened.objects[0].vertices.length,5);assert.equal(reopened.groups[0].children[0],'shape');
  const exported=JSON.parse(G.exportCode(reopened,'json'));assert.equal(exported.draws.length,1);assert.equal(exported.draws[0].count,9);assert.ok(exported.vertices.some((x,i)=>i%7===0&&x===.25&&exported.vertices[i+1]===-.25));
});
