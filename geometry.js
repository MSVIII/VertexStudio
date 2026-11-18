/* Shared geometry and export functions; no dependencies. */
(function (root) {
  'use strict';
  const MODES = { points: 0, lines: 1, 'line-loop': 2, 'line-strip': 3, triangles: 4, 'triangle-strip': 5, 'triangle-fan': 6, polygon: 4, quads: 4, 'quad-strip': 4, circle: 6 };
  const LABELS = { points: 'Points', lines: 'Lines', 'line-loop': 'Line loop', 'line-strip': 'Line strip', triangles: 'Triangles', 'triangle-strip': 'Triangle strip', 'triangle-fan': 'Triangle fan', polygon: 'Polygon', quads: 'Quads', 'quad-strip': 'Quad strip', circle: 'Circle' };
  const inPlane = p => Number.isFinite(p?.x)&&Number.isFinite(p?.y)&&Math.abs(p.x)<=1&&Math.abs(p.y)<=1;
  function circleVertices(center,radius,segments=64) {
    if(!inPlane(center)||!Number.isFinite(radius)||radius<=1e-6||!Number.isInteger(segments)||segments<8||segments>256)throw new Error('Choose a center and a positive circle radius.');
    if(Math.abs(center.x)+radius>1+1e-12||Math.abs(center.y)+radius>1+1e-12)throw new Error('The entire circle must fit between −1 and 1. Choose a smaller radius.');
    return Array.from({length:segments},(_,i)=>({x:Math.max(-1,Math.min(1,center.x+radius*Math.cos(i/segments*2*Math.PI))),y:Math.max(-1,Math.min(1,center.y+radius*Math.sin(i/segments*2*Math.PI)))}));
  }
  const isLine = type => ['lines','line-loop','line-strip'].includes(type);
  const lineWidth = o => o.lineWidth === undefined ? 1 : o.lineWidth;
  const pointSize = o => o.pointSize === undefined ? 6 : o.pointSize;
  const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  function area(v) { return v.reduce((s,p,i) => { const q=v[(i+1)%v.length]; return s+p.x*q.y-q.x*p.y; },0)/2; }
  function onSegment(a,b,p) { return Math.abs(cross(a,b,p))<1e-9 && p.x>=Math.min(a.x,b.x)-1e-9 && p.x<=Math.max(a.x,b.x)+1e-9 && p.y>=Math.min(a.y,b.y)-1e-9 && p.y<=Math.max(a.y,b.y)+1e-9; }
  function intersects(a,b,c,d) {
    const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
    return (ab1*ab2<0 && cd1*cd2<0) || onSegment(a,b,c) || onSegment(a,b,d) || onSegment(c,d,a) || onSegment(c,d,b);
  }
  function triangulate(vertices) {
    let v=vertices.map(p=>({...p}));
    if(v.length>1 && Math.hypot(v[0].x-v.at(-1).x,v[0].y-v.at(-1).y)<1e-9) v.pop();
    if(v.length<3) throw new Error('A polygon needs at least three vertices.');
    for(let i=0;i<v.length;i++) for(let j=i+1;j<v.length;j++) {
      if(j===i+1 || (i===0 && j===v.length-1)) continue;
      if(intersects(v[i],v[(i+1)%v.length],v[j],v[(j+1)%v.length])) throw new Error('Polygon edges cross or touch. Move the vertices to make a simple outline.');
    }
    if(Math.abs(area(v))<1e-10) throw new Error('These vertices have no area. Move one off the line.');
    // Strip redundant points on straight edges before clipping ears.
    let changed=true;
    while(changed && v.length>3) { changed=false; for(let i=0;i<v.length;i++) if(Math.abs(cross(v[(i+v.length-1)%v.length],v[i],v[(i+1)%v.length]))<1e-10) { v.splice(i,1);changed=true;break; } }
    if(area(v)<0) v.reverse();
    const out=[];
    while(v.length>3) {
      let found=false;
      for(let i=0;i<v.length;i++) {
        const a=v[(i+v.length-1)%v.length], b=v[i], c=v[(i+1)%v.length];
        if(cross(a,b,c)<=1e-10) continue;
        if(v.some(p=>p!==a&&p!==b&&p!==c&&cross(a,b,p)>=-1e-10&&cross(b,c,p)>=-1e-10&&cross(c,a,p)>=-1e-10)) continue;
        out.push(a,b,c);v.splice(i,1);found=true;break;
      }
      if(!found) throw new Error('Unable to triangulate this polygon. Check its outline.');
    }
    return out.concat(v);
  }
  function validateObject(o) {
    if(!Object.hasOwn(MODES,o.type)) throw new Error('Unknown primitive.');
    const n=o.vertices.length;
    if(n<({points:1,lines:2,'line-loop':2,'line-strip':2,quads:4,'quad-strip':4}[o.type]||3)) throw new Error('Add more vertices to finish this primitive.');
    if(o.type==='lines' && n%2) throw new Error('Lines need pairs of vertices. Add one more vertex.');
    if(o.type==='triangles' && n%3) throw new Error('Triangles need groups of three vertices.');
    if(o.type==='quads' && n%4)throw new Error('Quads need groups of four vertices.');
    if(o.type==='quad-strip' && n%2)throw new Error('A quad strip needs at least four vertices, then pairs of vertices.');
    if(o.vertices.some(p=>!inPlane(p))) throw new Error('Coordinates must be finite and between −1 and 1.');
    for(const size of [lineWidth(o),pointSize(o)]) if(!Number.isFinite(size)||size<0.5||size>64) throw new Error('Point and line sizes must be between 0.5 and 64 pixels.');
    if(o.type==='polygon'||o.type==='circle') triangulate(o.vertices);
    if(o.type==='quads'||o.type==='quad-strip')for(const quad of quadFaces(o)) {
      const turns=quad.map((p,i)=>cross(p,quad[(i+1)%4],quad[(i+2)%4]));
      if(!(turns.every(t=>t>1e-10)||turns.every(t=>t< -1e-10)))throw new Error('Each quad must be convex with four distinct corners. Check the plotting order.');
    }
    return true;
  }
  function quadFaces(o) {
    const v=o.vertices,out=[];
    for(let i=0;i+3<v.length;i+=o.type==='quads'?4:2)out.push(o.type==='quads'?v.slice(i,i+4):[v[i],v[i+1],v[i+3],v[i+2]]);
    return out;
  }
  function renderVertices(o) {
    if(o.type==='polygon')return triangulate(o.vertices);
    if(o.type==='quads'||o.type==='quad-strip')return quadFaces(o).flatMap(q=>[q[0],q[1],q[2],q[0],q[2],q[3]]);
    if(o.type==='circle') {
      const v=o.vertices,center=v.reduce((p,q)=>({x:p.x+q.x/v.length,y:p.y+q.y/v.length}),{x:0,y:0});
      return [center,...v,v[0]];
    }
    return o.vertices;
  }
  const canInsertVertex=o=>!!o&&(['polygon','circle','line-loop','line-strip'].includes(o.type)||o.type==='quads'&&o.vertices.length===4||['triangles','triangle-strip','triangle-fan'].includes(o.type)&&o.vertices.length===3);
  const edgeCount=o=>canInsertVertex(o)?o.vertices.length-(o.type==='line-strip'?1:0):0;
  function projectOnEdge(a,b,p){
    const dx=b.x-a.x,dy=b.y-a.y,length2=dx*dx+dy*dy;
    if(!length2)return null;
    const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/length2));
    const point={x:a.x+t*dx,y:a.y+t*dy};return {t,point,distance:Math.hypot(p.x-point.x,p.y-point.y)};
  }
  function nearestEdge(o,p){
    if(!canInsertVertex(o)||!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return null;
    let nearest=null;
    for(let index=0;index<edgeCount(o);index++){
      const hit=projectOnEdge(o.vertices[index],o.vertices[(index+1)%o.vertices.length],p);
      if(hit&&(!nearest||hit.distance<nearest.distance))nearest={...hit,index};
    }
    return nearest;
  }
  function insertVertex(o,index,p){
    if(!canInsertVertex(o))throw new Error('Add vertices to a polygon, line loop, line strip, or single triangle.');
    if(o.locked)throw new Error('Unlock this primitive before adding vertices.');
    if(!Number.isInteger(index)||index<0||index>=edgeCount(o))throw new Error('Choose an existing edge.');
    if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))throw new Error('The new vertex must have finite coordinates.');
    const hit=projectOnEdge(o.vertices[index],o.vertices[(index+1)%o.vertices.length],p);
    if(!hit||hit.t<=1e-8||hit.t>=1-1e-8)throw new Error('Click between existing vertices, away from the corners.');
    const vertices=o.vertices.map(p=>({...p}));vertices.splice(index+1,0,hit.point);
    // An independent triangle becomes an editable outline; adding a fourth vertex
    // must not change GL_TRIANGLES into an incomplete group of four vertices.
    const candidate={...o,type:['triangles','triangle-strip','triangle-fan','quads','circle'].includes(o.type)?'polygon':o.type,vertices};
    validateObject(candidate);return candidate;
  }
  // Expand points and strokes into triangles, avoiding driver-specific wide-line limits.
  // Sizes are screen pixels: zoom changes positions while stroke thickness stays constant.
  function displayMesh(o,pixelsPerUnit) {
    if(!(pixelsPerUnit>0)||!Number.isFinite(pixelsPerUnit)) throw new Error('Invalid display scale.');
    if(o.type!=='points'&&!isLine(o.type)) return {mode:MODES[o.type],vertices:renderVertices(o)};
    const out=[],half=(o.type==='points'?pointSize(o):lineWidth(o))/(2*pixelsPerUnit);
    const at=(p,dx,dy)=>({x:p.x+dx,y:p.y+dy});
    const quad=(a,b,c,d)=>out.push(a,b,c,a,c,d);
    if(o.type==='points') {
      for(const p of o.vertices) quad(at(p,-half,-half),at(p,half,-half),at(p,half,half),at(p,-half,half));
    } else if(o.type==='lines') {
      for(let i=0;i+1<o.vertices.length;i+=2) {
        const a=o.vertices[i],b=o.vertices[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
        if(!len)continue;const nx=-dy/len*half,ny=dx/len*half;
        quad(at(a,nx,ny),at(a,-nx,-ny),at(b,-nx,-ny),at(b,nx,ny));
      }
    } else {
      const closed=o.type==='line-loop',v=o.vertices.filter((p,i,a)=>!i||p.x!==a[i-1].x||p.y!==a[i-1].y);
      if(closed&&v.length>1&&v[0].x===v.at(-1).x&&v[0].y===v.at(-1).y)v.pop();
      if(v.length<2)return {mode:4,vertices:out};
      const normals=v.slice(0,closed?v.length:v.length-1).map((p,i)=>{const q=v[(i+1)%v.length],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);return {x:-dy/len,y:dx/len};});
      const offsets=v.map((p,i)=>{
        const prev=normals[(i-1+normals.length)%normals.length],next=normals[i%normals.length];
        if(!closed&&(i===0||i===v.length-1)){const n=i===0?next:prev;return {x:n.x*half,y:n.y*half};}
        let mx=prev.x+next.x,my=prev.y+next.y,len=Math.hypot(mx,my);
        if(len<1e-10)return {x:next.x*half,y:next.y*half};
        mx/=len;my/=len;const m=half/Math.max(0.25,mx*next.x+my*next.y);
        return {x:mx*m,y:my*m};
      });
      for(let i=0;i<normals.length;i++) { const j=(i+1)%v.length,a=v[i],b=v[j],n=offsets[i],m=offsets[j];quad(at(a,n.x,n.y),at(a,-n.x,-n.y),at(b,-m.x,-m.y),at(b,m.x,m.y)); }
    }
    return {mode:4,vertices:out};
  }
  function triangles(o) {
    const v=renderVertices(o),out=[];
    if(['triangles','polygon','quads','quad-strip'].includes(o.type)) for(let i=0;i+2<v.length;i+=3) out.push([v[i],v[i+1],v[i+2]]);
    if(o.type==='triangle-fan'||o.type==='circle') for(let i=1;i+1<v.length;i++) out.push([v[0],v[i],v[i+1]]);
    if(o.type==='triangle-strip') for(let i=0;i+2<v.length;i++) out.push([v[i],v[i+1],v[i+2]]);
    return out;
  }
  function color(hex,alpha=1) { return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).concat(alpha); }
  function gridStep(scale) { const raw=48/scale, power=10**Math.floor(Math.log10(raw)), f=raw/power;return (f<=1?1:f<=2?2:f<=5?5:10)*power; }
  function bounds(objects) {
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const o of objects)for(const p of o.vertices){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
    return minX===Infinity?{minX:-1,maxX:1,minY:-1,maxY:1}:{minX,maxX,minY,maxY};
  }
  function compile(objects) {
    const vertices=[],draws=[];
    // Array order is back-to-front. Keep it when drawing with depth testing disabled.
    for(const o of objects.filter(o=>o.visible)) {
      validateObject(o);const v=renderVertices(o),first=vertices.length/7,rgba=color(o.color,o.opacity);
      for(const p of v) vertices.push(p.x,p.y,0,...rgba);
      draws.push({name:o.name,mode:MODES[o.type],first,count:v.length,lineWidth:lineWidth(o),pointSize:pointSize(o)});
    }
    return {layout:['x','y','z','r','g','b','a'],stride:7,bounds:bounds(objects.filter(o=>o.visible)),vertices,draws};
  }
  function exportCode(doc,format) {
    const scene=typeof module!=='undefined'&&module.exports?require('./scene'):root.Scene;
    const data=compile(scene.visibleObjects(doc));
    if(format==='json') return JSON.stringify({format:'vertex-studio-array',version:1,...data},null,2)+'\n';
    if(format==='js') return `// Vertex Studio · ${doc.name.replace(/[\r\n]/g,' ')}\n// Interleaved position.xyz + color.rgba; 28-byte stride.\n// Draw in array order with blending enabled and depth testing disabled.\nexport const vertices = new Float32Array(${JSON.stringify(data.vertices)});\nexport const draws = ${JSON.stringify(data.draws,null,2)};\nexport const bounds = ${JSON.stringify(data.bounds)};\n`;
    const viewer=typeof module!=='undefined'&&module.exports?require('./cpp-viewer'):root.CppViewer;
    return viewer.create(nativeDraws(scene.visibleObjects(doc)),doc.name);
  }
  function nativeDraws(objects) {
    return objects.map(o=>{
      validateObject(o);let mode=MODES[o.type],vertices=o.vertices;
      if(o.type==='quads')mode=7;
      else if(o.type==='quad-strip')mode=8;
      else if(o.type==='polygon'){
        const v=o.vertices,turns=v.map((p,i)=>cross(p,v[(i+1)%v.length],v[(i+2)%v.length]));
        if(turns.every(t=>t>=-1e-10)||turns.every(t=>t<=1e-10))mode=9;
        else vertices=triangulate(v);
      }else if(o.type==='circle')vertices=renderVertices(o);
      return {name:o.name,mode,vertices,rgba:color(o.color,o.opacity),lineWidth:lineWidth(o),pointSize:pointSize(o)};
    });
  }
  // Fit legacy world coordinates as a whole; never clip individual vertices.
  function fitObjectsToPlane(objects) {
    const b=bounds(objects),cx=(b.minX+b.maxX)/2,cy=(b.minY+b.maxY)/2,scale=1.8/Math.max(b.maxX-b.minX,b.maxY-b.minY,1);
    return objects.map(o=>({...o,vertices:o.vertices.map(p=>({x:(p.x-cx)*scale,y:(p.y-cy)*scale}))}));
  }
  function parseProject(text,{fitLegacy=false}={}) {
    const d=JSON.parse(text);
    if(d.format!=='vertex-studio-project'||![1,2,3].includes(d.version)||!Array.isArray(d.objects)||d.objects.length>1000) throw new Error('Choose a valid Vertex Studio project (.vstudio.json).');
    const ids=new Set();let total=0;
    let objects=d.objects.map((o,i)=>{
      if(!o||!Array.isArray(o.vertices)||(total+=o.vertices.length)>100000||!/^#[0-9a-f]{6}$/i.test(o.color)||!Number.isFinite(o.opacity)||o.opacity<0||o.opacity>1) throw new Error('The project contains invalid object data.');
      const obj={id:typeof o.id==='string'&&!ids.has(o.id)?o.id:'import-'+i,name:String(o.name||'Object').slice(0,100),type:o.type,color:o.color,opacity:o.opacity,lineWidth:lineWidth(o),pointSize:pointSize(o),visible:o.visible!==false,locked:o.locked===true,vertices:o.vertices.map(p=>({x:p?.x,y:p?.y}))};ids.add(obj.id);
      if(obj.vertices.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>1e7||Math.abs(p.y)>1e7))throw new Error('The project contains invalid coordinates.');return obj;
    });
    const fitted=objects.some(o=>o.vertices.some(p=>!inPlane(p)));
    if(fitted&&fitLegacy&&d.version<3)objects=fitObjectsToPlane(objects);
    objects.forEach(validateObject);
    const scene=typeof module!=='undefined'&&module.exports?require('./scene'):root.Scene;
    const result=scene.parseLayout(d,objects);Object.defineProperty(result,'coordinatesFitted',{value:fitted&&fitLegacy});return result;
  }
  const api={MODES,LABELS,inPlane,circleVertices,quadFaces,isLine,lineWidth,pointSize,cross,area,triangulate,validateObject,renderVertices,canInsertVertex,edgeCount,nearestEdge,insertVertex,displayMesh,triangles,color,gridStep,bounds,compile,nativeDraws,fitObjectsToPlane,exportCode,parseProject};
  if(typeof module!=='undefined'&&module.exports) module.exports=api; else root.Geometry=api;
})(typeof globalThis!=='undefined'?globalThis:this);
