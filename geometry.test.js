const test=require('node:test');
const assert=require('node:assert/strict');
const G=require('./geometry');
const shape=(type,points,extra={})=>({id:'a',name:'Test',type,color:'#93ddc2',opacity:1,visible:true,locked:false,vertices:points.map(([x,y])=>({x,y})),...extra});
const poly=points=>shape('polygon',points);
test('concave triangulation preserves area in either winding',()=>{
  const p=poly([[0,0],[4,0],[4,4],[2,2],[0,4]]);
  for(const v of [p.vertices,[...p.vertices].reverse()]){const triangles=G.triangulate(v);assert.equal(triangles.length,9);let area=0;for(let i=0;i<triangles.length;i+=3)area+=Math.abs(G.area(triangles.slice(i,i+3)));assert.equal(area,12);}
});
test('redundant collinear and repeated closing vertices are handled',()=>{
  const p=poly([[0,0],[1,0],[2,0],[2,2],[0,2],[0,0]]);assert.equal(G.triangulate(p.vertices).length,6);
});
test('crossing, touching, and degenerate polygons fail with clear errors',()=>{
  assert.throws(()=>G.validateObject(poly([[0,0],[1,1],[0,1],[1,0]])),/cross|area/);
  assert.throws(()=>G.validateObject(poly([[0,0],[.5,0],[1,0]])),/area/);
  assert.throws(()=>G.validateObject(poly([[0,0],[1,0],[1,1],[.5,0],[0,1]])),/cross|touch/);
});
test('primitive constraints validate complete groups',()=>{
  assert.throws(()=>G.validateObject(shape('lines',[[0,0],[1,1],[2,2]])),/pairs/);
  assert.throws(()=>G.validateObject(shape('triangles',[[0,0],[1,1],[2,2],[3,3]])),/three/);
  assert.doesNotThrow(()=>G.validateObject(shape('points',[[0,0]])));
  assert.doesNotThrow(()=>G.validateObject(shape('triangle-strip',[[0,0],[.3,1],[.6,0],[.9,1]])));
  assert.throws(()=>G.validateObject(shape('points',[[Infinity,0]])),/finite/);
});
test('grid switches from integers to decimals at higher magnification',()=>{
  assert.equal(G.gridStep(50),1);assert.equal(G.gridStep(500),.1);assert.equal(G.gridStep(5000),.01);assert.equal(G.gridStep(10),5);
});
test('export includes color, alpha, modes and back-to-front ranges; skips hidden',()=>{
  const a=shape('triangles',[[0,0],[1,0],[.5,1]],{name:'Back',opacity:.5});
  const b=shape('lines',[[0,0],[1,1]],{id:'b',name:'Front'});
  const hidden=shape('points',[[100,100]],{visible:false});
  const d=G.compile([a,hidden,b]);assert.equal(d.vertices.length,35);assert.deepEqual(d.draws,[{name:'Back',mode:4,first:0,count:3,lineWidth:1,pointSize:6},{name:'Front',mode:1,first:3,count:2,lineWidth:1,pointSize:6}]);assert.equal(d.vertices[6],.5);assert.equal(d.vertices[3],147/255);assert.equal(d.bounds.maxX,1);
});
test('polygon exports actual triangles, preserving exact Cartesian coordinates',()=>{
  const d=G.compile([poly([[.25,.5],[.75,.5],[.75,1],[.25,1]])]);assert.equal(d.draws[0].count,6);assert.equal(d.vertices[0]%.25,0);assert.equal(d.draws[0].mode,4);
});
test('all formats encode the scene and C++ uses the course GLUT vertex-array approach',()=>{
  const d={name:'Scene',objects:[shape('points',[[.25,-.5]])]};const json=JSON.parse(G.exportCode(d,'json'));assert.equal(json.vertices[0],.25);assert.match(G.exportCode(d,'cpp'),/0.25f, -0.5f/);assert.match(G.exportCode(d,'js'),/Float32Array/);assert.match(G.exportCode({name:'Empty',objects:[]},'cpp'),/Empty scene/);
  const cpp=G.exportCode(d,'cpp');for(const required of ['int main','glutCreateWindow','glutDisplayFunc','glutMainLoop','glVertexPointer','glDrawArrays','glOrtho','GL_ONE_MINUS_SRC_ALPHA'])assert.ok(cpp.includes(required),required);assert.ok(!/windows.h|wglCreateContext|glew|glfw|glm|stroke_mesh/.test(cpp));assert.deepEqual(cpp.match(/^#include.*$/gm),['#include <GL/glut.h>']);
});
test('project round-trip retains editable source geometry and properties',()=>{
  const d={format:'vertex-studio-project',version:1,name:'Test',objects:[poly([[0,0],[1,0],[1,1],[0,1]])]};const parsed=G.parseProject(JSON.stringify(d));assert.equal(parsed.objects[0].vertices.length,4);assert.equal(parsed.objects[0].color,'#93ddc2');assert.equal(parsed.name,'Test');
});
test('project import rejects wrong versions, invalid colors, bad alpha and data',()=>{
  assert.throws(()=>G.parseProject('{"format":"other","objects":[]}'));
  for(const extra of [{opacity:2},{color:'red'},{type:'unknown'},{type:'constructor'},{vertices:[{x:'1',y:0}]}]){const s=shape('points',[[0,0]],extra);assert.throws(()=>G.parseProject(JSON.stringify({format:'vertex-studio-project',version:1,objects:[s]})));}
});
test('C++ export retains tiny coordinates and escapes comment line continuations',()=>{
  const d={name:'Trailing backslash'+String.fromCharCode(92),objects:[shape('points',[[1e-9,2e-9]],{name:'Layer'+String.fromCharCode(92)})]};const code=G.exportCode(d,'cpp');assert.match(code,/1e-9f, 2e-9f/);assert.ok(!code.split('\n').some(line=>line.endsWith(String.fromCharCode(92))));
});
test('old projects receive backward-compatible point and line size defaults',()=>{
  const d=G.parseProject(JSON.stringify({format:'vertex-studio-project',version:1,objects:[shape('points',[[0,0]])]}));assert.equal(d.objects[0].lineWidth,1);assert.equal(d.objects[0].pointSize,6);
});
test('custom sizes survive editable project save/reopen and every export format',()=>{
  const o=shape('line-strip',[[0,0],[1,1]],{lineWidth:12.5,pointSize:24}),project={format:'vertex-studio-project',version:1,name:'Sized',objects:[o]};
  const d=G.parseProject(JSON.stringify(project));assert.equal(d.objects[0].lineWidth,12.5);assert.equal(d.objects[0].pointSize,24);
  const json=JSON.parse(G.exportCode(d,'json'));assert.equal(json.draws[0].lineWidth,12.5);assert.equal(json.draws[0].pointSize,24);
  assert.match(G.exportCode(d,'js'),/"lineWidth": 12.5/);assert.match(G.exportCode(d,'cpp'),/glLineWidth\(12.5f\)/);
});
test('invalid point/line sizes are rejected rather than passed to the renderer',()=>{
  for(const key of ['lineWidth','pointSize'])for(const value of [0,-2,65,NaN,Infinity,'5',null])assert.throws(()=>G.validateObject(shape('points',[[0,0]],{[key]:value})),/sizes/);
  for(const value of [.5,1,64])assert.doesNotThrow(()=>G.validateObject(shape('points',[[0,0]],{pointSize:value,lineWidth:value})));
});
test('wide lines and square points keep the requested pixel size across zoom levels',()=>{
  for(const scale of [25,100,500]) {
    const m=G.displayMesh(shape('lines',[[0,0],[2,0]],{lineWidth:20}),scale);assert.equal(m.mode,4);assert.equal(m.vertices.length,6);
    const b=G.bounds([{vertices:m.vertices}]);assert.ok(Math.abs((b.maxY-b.minY)*scale-20)<1e-10);assert.equal(b.minX,0);assert.equal(b.maxX,2);
    const point=G.displayMesh(shape('points',[[1,2]],{pointSize:32}),scale),p=G.bounds([{vertices:point.vertices}]);assert.equal(point.vertices.length,6);assert.ok(Math.abs((p.maxX-p.minX)*scale-32)<1e-10);assert.ok(Math.abs((p.maxY-p.minY)*scale-32)<1e-10);
  }
});
test('joined strips and closed loops have contiguous non-overlapping miter geometry',()=>{
  const mesh=G.displayMesh(shape('line-loop',[[0,0],[1,0],[1,1],[0,1]],{lineWidth:10}),100);assert.equal(mesh.vertices.length,24);
  let area=0;for(let i=0;i<mesh.vertices.length;i+=3)area+=Math.abs(G.area(mesh.vertices.slice(i,i+3)));assert.ok(Math.abs(area-.4)<1e-10);
  const strip=G.displayMesh(shape('line-strip',[[0,0],[1,0],[1,1]],{lineWidth:10}),100).vertices;assert.deepEqual(strip[5],strip[6]);assert.deepEqual(strip[2],strip[7]);
});
test('stroke tessellation handles duplicate points and sharp turns without invalid numbers',()=>{
  for(const type of ['lines','line-strip','line-loop'])for(const coords of [[[0,0],[0,0]],[[0,0],[1,0],[0,0]],[[0,0],[1,0],[1,0],[2,.0001]]]){const mesh=G.displayMesh(shape(type,coords,{lineWidth:64}),100);assert.ok(mesh.vertices.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));}
  assert.throws(()=>G.displayMesh(shape('points',[[0,0]]),0),/scale/);
});
