// Recreate the bundled editable examples and matching complete OpenGL viewers.
const fs=require('node:fs');
const path=require('node:path');
const G=require('./geometry');
const S=require('./scene');
let id=0;
const shape=(name,type,color,points)=>({id:'example-'+(++id),name,type,color,opacity:1,visible:true,locked:false,vertices:points.map(([x,y])=>({x:x/5,y:y/5}))});
const doc={name:'Alpine study',objects:[
  shape('Evening sun','circle','#e9bd91',Array.from({length:40},(_,i)=>[2.45+1.05*Math.cos(i/40*Math.PI*2),2.6+1.05*Math.sin(i/40*Math.PI*2)])),
  shape('Distant ridge','polygon','#728ba5',[[-4.3,-1.6],[-.9,3.2],[2.5,-1.6]]),
  shape('Distant shadow','triangles','#506881',[[-.9,3.2],[2.5,-1.6],[.15,-1.6]]),
  shape('Alpine peak','polygon','#93ddc2',[[-2.65,-2.6],[.8,2.45],[4.5,-2.6]]),
  shape('Light & shade','triangles','#4c9d89',[[.8,2.45],[4.5,-2.6],[1.65,-2.6]]),
  shape('Snow cap','polygon','#e3f0df',[[-.18,1.02],[.8,2.45],[1.85,1.02],[1.15,1.35],[.67,.95],[.3,1.3]])
]};
const out=path.join(__dirname,'examples');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'alpine-study.vstudio.json'),JSON.stringify({format:'vertex-studio-project',version:3,...S.normalize(doc)},null,2));
fs.writeFileSync(path.join(out,'alpine-study.cpp'),G.exportCode(doc,'cpp'));
const sized={name:'Point & line study',objects:[
  shape('Canvas tile','polygon','#263f45',[[-4,-3],[4,-3],[4,3],[-4,3]]),
  {...shape('Wide line','lines','#edb49a',[[-3,-2],[3,-2]]),lineWidth:24},
  {...shape('Mountain path','line-strip','#93ddc2',[[-3,-1],[0,2],[3,-1]]),lineWidth:16},
  {...shape('Frame','line-loop','#8fa8ed',[[-4,-3],[4,-3],[4,3],[-4,3]]),lineWidth:5},
  {...shape('Plot points','points','#c6a5df',[[-3,-1],[0,2],[3,-1]]),pointSize:30}
]};
fs.writeFileSync(path.join(out,'point-line-study.vstudio.json'),JSON.stringify({format:'vertex-studio-project',version:3,...S.normalize(sized)},null,2));
fs.writeFileSync(path.join(out,'point-line-study.cpp'),G.exportCode(sized,'cpp'));
console.log('Created Alpine study and point/line study with matching OpenGL .cpp viewers.');
const grouped=S.normalize(JSON.parse(JSON.stringify(doc)));
S.createGroup(grouped,grouped.objects.filter(o=>['Alpine peak','Light & shade','Snow cap'].includes(o.name)).map(o=>o.id),'group-foreground','Foreground mountain');
S.createGroup(grouped,grouped.objects.filter(o=>['Distant ridge','Distant shadow'].includes(o.name)).map(o=>o.id),'group-distant','Distant mountain');
grouped.groups.forEach(g=>g.collapsed=true);
fs.writeFileSync(path.join(out,'grouped-alpine-study.vstudio.json'),JSON.stringify({format:'vertex-studio-project',version:3,...grouped},null,2));
fs.writeFileSync(path.join(out,'grouped-alpine-study.cpp'),G.exportCode(grouped,'cpp'));
console.log('Created the grouped Alpine study with two independent objects on one canvas.');

const primitives=S.normalize({name:'Course primitive study',objects:[
  shape('Quad tile','quads','#8fa8ed',[[-4,-3],[-1,-3],[-.5,-.5],[-3.5,0]]),
  shape('Quad ribbon','quad-strip','#93ddc2',[[.5,-3],[3,-3],[.8,-1],[3.2,-1],[.2,1],[3.5,1]]),
  {...shape('Circle fan','circle','#edb49a',[]),vertices:G.circleVertices({x:-.45,y:.55},.25)}
]});
S.createGroup(primitives,primitives.objects.map(o=>o.id),'course-group','Course primitives');
fs.writeFileSync(path.join(out,'course-primitives.vstudio.json'),JSON.stringify({format:'vertex-studio-project',version:3,...primitives},null,2));
fs.writeFileSync(path.join(out,'course-primitives.cpp'),G.exportCode(primitives,'cpp'));
console.log('Created course quads, quad strip, and triangle-fan circle example.');
