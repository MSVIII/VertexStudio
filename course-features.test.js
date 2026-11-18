const test=require('node:test'),assert=require('node:assert/strict');
const G=require('./geometry'),S=require('./scene');
const shape=(type,vertices,extra={})=>({id:type,name:type,type,vertices:vertices.map(([x,y])=>({x,y})),color:'#93ddc2',opacity:.6,lineWidth:9,pointSize:13,visible:true,locked:false,...extra});
const quad=()=>shape('quads',[[-.7,-.4],[-.2,-.4],[-.1,.3],[-.6,.5]]);
const strip=()=>shape('quad-strip',[[-.8,-.6],[-.2,-.6],[-.7,0],[-.1,0],[-.9,.6],[.2,.7]]);
const copy=o=>JSON.parse(JSON.stringify(o));

test('quads and quad strips follow Module 2 corner order and preserve coverage',()=>{
  for(const o of [quad(),strip()]){
    G.validateObject(o);const faces=G.quadFaces(o),mesh=G.triangles(o);
    assert.equal(mesh.length,faces.length*2);
    const expected=faces.reduce((sum,q)=>sum+Math.abs(G.area(q)),0),actual=mesh.reduce((sum,q)=>sum+Math.abs(G.area(q)),0);
    assert.ok(Math.abs(expected-actual)<1e-12);
    const native=G.nativeDraws([o])[0];assert.equal(native.mode,o.type==='quads'?7:8);assert.deepEqual(native.vertices,o.vertices);
  }
  assert.deepEqual(G.quadFaces(strip())[0],[strip().vertices[0],strip().vertices[1],strip().vertices[3],strip().vertices[2]]);
  for(const o of [shape('quads',[[0,0],[.5,0],[.5,.5],[0,.5],[1,1]]),shape('quad-strip',[[0,0],[.5,0],[0,.5],[.5,.5],[0,1]]),shape('quads',[[0,0],[.5,.5],[0,.5],[.5,0]]),shape('quads',[[0,0],[1,0],[.2,.2],[0,1]])])assert.throws(()=>G.validateObject(o),/four|pairs|convex/);
});

test('circle covers the requested center and radius with a closed triangle fan',()=>{
  const center={x:.3,y:-.2},radius=.4,o={...shape('circle',[]),vertices:G.circleVertices(center,radius)};
  G.validateObject(o);assert.equal(o.vertices.length,64);
  o.vertices.forEach(p=>assert.ok(Math.abs(Math.hypot(p.x-center.x,p.y-center.y)-radius)<1e-12));
  const fan=G.renderVertices(o);assert.ok(Math.hypot(fan[0].x-center.x,fan[0].y-center.y)<1e-12);assert.deepEqual(fan[1],fan.at(-1));assert.equal(G.triangles(o).length,64);assert.equal(G.nativeDraws([o])[0].mode,6);
  assert.doesNotThrow(()=>G.circleVertices({x:0,y:0},1));
  for(const r of [0,-1,Infinity,.71])assert.throws(()=>G.circleVertices(center,r));
  const edited=G.insertVertex(o,0,{x:(o.vertices[0].x+o.vertices[1].x)/2,y:(o.vertices[0].y+o.vertices[1].y)/2});assert.equal(edited.type,'polygon');assert.equal(edited.id,o.id);
});

test('horizontal and vertical flips mirror the shared center and leave styles and layers intact',()=>{
  const objects=[quad(),strip()],before=copy(objects),b=G.bounds(objects),pivot={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};
  for(const axis of ['flipX','flipY']){
    const flipped=S.transform(objects,{pivot,[axis]:true});
    flipped.forEach((o,i)=>{G.validateObject(o);assert.equal(o.id,objects[i].id);assert.equal(o.lineWidth,9);assert.equal(o.opacity,.6);o.vertices.forEach((p,j)=>{const source=objects[i].vertices[j];assert.ok(Math.abs(p.x-(axis==='flipX'?2*pivot.x-source.x:source.x))<1e-12);assert.ok(Math.abs(p.y-(axis==='flipY'?2*pivot.y-source.y:source.y))<1e-12);});});
    const twice=S.transform(flipped,{pivot,[axis]:true});twice.forEach((o,i)=>o.vertices.forEach((p,j)=>assert.ok(Math.hypot(p.x-objects[i].vertices[j].x,p.y-objects[i].vertices[j].y)<1e-12)));
  }
  assert.deepEqual(objects,before);
});

test('range validation and whole-selection transforms reject overflow without partial changes',()=>{
  for(const x of [-1,1,.0000001])assert.doesNotThrow(()=>G.validateObject(shape('points',[[x,0]])));
  for(const x of [-1.00001,1.00001,NaN,Infinity])assert.throws(()=>G.validateObject(shape('points',[[x,0]])),/between/);
  const source=[quad(),strip()],before=copy(source);
  for(const params of [{dx:.9},{dy:-1},{scale:3},{angle:35,pivot:{x:1,y:1}}])assert.throws(()=>S.transform(source,params),/between/);
  assert.deepEqual(source,before);
  const edge=shape('points',[[1,1],[-1,-1]]);assert.doesNotThrow(()=>S.transform([edge],{angle:90}));
});

test('legacy fitting preserves proportions, folder order and visibility while v3 stays strict',()=>{
  const d=S.normalize({name:'Legacy',objects:[{...quad(),vertices:quad().vertices.map(p=>({x:p.x*10+15,y:p.y*10-20}))},{...strip(),visible:false,vertices:strip().vertices.map(p=>({x:p.x*10+15,y:p.y*10-20}))}]});
  S.createGroup(d,d.objects.map(o=>o.id),'folder');const original=copy(d),text=JSON.stringify({format:'vertex-studio-project',version:2,...d});
  assert.throws(()=>G.parseProject(text),/between/);
  const fitted=G.parseProject(text,{fitLegacy:true});assert.equal(fitted.coordinatesFitted,true);assert.deepEqual(fitted.groups,d.groups);assert.deepEqual(fitted.layers,d.layers);assert.equal(fitted.objects[1].visible,false);fitted.objects.forEach(G.validateObject);
  const lengths=o=>Math.hypot(o.vertices[1].x-o.vertices[0].x,o.vertices[1].y-o.vertices[0].y);
  assert.ok(Math.abs(lengths(fitted.objects[0])/lengths(fitted.objects[1])-lengths(d.objects[0])/lengths(d.objects[1]))<1e-12);assert.deepEqual(d,original);
  const roundTrip=G.parseProject(JSON.stringify({format:'vertex-studio-project',version:3,...fitted}));assert.deepEqual(roundTrip,fitted);assert.equal(roundTrip.coordinatesFitted,false);
  assert.throws(()=>G.parseProject(JSON.stringify({format:'vertex-studio-project',version:3,...d}),{fitLegacy:true}),/between/);
});

test('course C++ retains native primitives, exact counts and a reusable drawing function',()=>{
  const convex=shape('polygon',[[0,0],[.8,0],[.8,.8],[0,.8]]),concave=shape('polygon',[[0,0],[.8,0],[.8,.8],[.4,.4],[0,.8]],{id:'concave'}),circle={...shape('circle',[]),vertices:G.circleVertices({x:0,y:0},.3)};
  const objects=[quad(),strip(),convex,concave,circle];
  assert.deepEqual(G.nativeDraws(objects).map(o=>[o.mode,o.vertices.length]),[[7,4],[8,6],[9,4],[4,9],[6,66]]);
  const code=G.exportCode({name:'Shapes',objects},'cpp');
  for(const required of ['void drawObject()','GL_QUADS, 0, 4','GL_QUAD_STRIP, 0, 6','GL_POLYGON, 0, 4','GL_TRIANGLES, 0, 9','GL_TRIANGLE_FAN, 0, 66'])assert.ok(code.includes(required));
  assert.ok(code.indexOf('// quads')<code.indexOf('// quad-strip'));
  assert.deepEqual(code.match(/^#include.*$/gm),['#include <GL/glut.h>']);
});

test('single quads support insertion without breaking independent quad batches',()=>{
  const o=quad(),p=o.vertices[0],q=o.vertices[1],edited=G.insertVertex(o,0,{x:(p.x+q.x)/2,y:(p.y+q.y)/2});assert.equal(edited.type,'polygon');assert.equal(edited.vertices.length,5);assert.ok(Math.abs(G.area(edited.vertices)-G.area(o.vertices))<1e-12);
  assert.ok(!G.canInsertVertex({...o,vertices:o.vertices.concat(o.vertices)}));assert.ok(!G.canInsertVertex(strip()));
});
