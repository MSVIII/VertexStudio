// Build real GLUT exports with only the course FreeGLUT/OpenGL libraries.
// Usage: node verify-cpp.cjs [path-to-MSYS2-UCRT64-g++]
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const G=require('./geometry');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vertex-studio-course-cpp-'));
const shape=(type,points)=>({id:type,name:type+' '+String.fromCharCode(92),type,color:'#93ddc2',opacity:.5,lineWidth:12.5,pointSize:24,visible:true,vertices:points.map(([x,y])=>({x,y}))});
const objects=Object.keys(G.MODES).map(type=>type==='circle'?{...shape(type,[]),vertices:G.circleVertices({x:0,y:0},.4)}:shape(type,type==='polygon'?[[0,0],[.8,0],[.8,.8],[.4,.4],[0,.8]]:type==='points'?[[1e-9,2e-9]]:type==='lines'?[[0,0],[.5,.5]]:type==='triangles'?[[0,0],[.5,0],[0,.5]]:type==='quad-strip'?[[0,0],[.5,0],[0,.5],[.5,.5]]:[[0,0],[.5,0],[.5,.5],[0,.5]]));
const compiler=process.argv[2]||'g++';
for(const [name,doc] of [['all-primitives',{name:'All primitives',objects}],['empty',{name:'Empty',objects:[]}],['course-example',G.parseProject(fs.readFileSync(path.join(__dirname,'examples','course-primitives.vstudio.json'),'utf8'))]]){
  const draws=G.nativeDraws(doc.objects),code=G.exportCode(doc,'cpp');assert.deepEqual(code.match(/^#include.*$/gm),['#include <GL/glut.h>']);
  const counts=draws.map((d,i)=>`static_assert(sizeof(object${i+1}Vertices) / sizeof(GLfloat) / 3 == ${d.vertices.length}, "vertex count");`).join('\n');
  const file=path.join(temp,name+'.cpp');fs.writeFileSync(file,code+'\n'+counts+'\n');
  const r=spawnSync(compiler,['-std=c++17','-Wall','-Wextra','-pedantic-errors',file,'-o',path.join(temp,name+'.exe'),'-lfreeglut','-lopengl32'],{encoding:'utf8',timeout:30000});
  if(r.error||r.status!==0){console.error(r.error||r.stderr||r.stdout||('Compiler exited with status '+r.status+'; check the toolchain runtime/PATH.'));process.exit(1);}
  console.log('Built and linked GLUT export: '+name+' ('+draws.length+' layers).');
}
console.log('Only -lfreeglut and -lopengl32 are linked. All exported array counts verified.');
