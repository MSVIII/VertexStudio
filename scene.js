/* Layer folders, selection operations, and shared Cartesian transforms. */
(function(root){
  'use strict';
  const copy=o=>JSON.parse(JSON.stringify(o));
  const group=(doc,id)=>(doc.groups||[]).find(g=>g.id===id);
  const object=(doc,id)=>doc.objects.find(o=>o.id===id);
  const parent=(doc,id)=>(doc.groups||[]).find(g=>g.children.includes(id));
  const isVisible=(doc,o)=>o.visible!==false&&parent(doc,o.id)?.visible!==false;
  const isLocked=(doc,o)=>!!(o.locked||parent(doc,o.id)?.locked);
  const visibleObjects=doc=>doc.objects.filter(o=>isVisible(doc,o));
  const items=(doc,ids)=>{const set=new Set(ids);return doc.objects.filter(o=>set.has(o.id));};
  function normalize(doc){doc.groups??=[];doc.layers??=doc.objects.map(o=>({kind:'object',id:o.id}));return sync(doc);}
  function sync(doc){
    const objects=new Map(doc.objects.map(o=>[o.id,o])),groups=new Map(doc.groups.map(g=>[g.id,g])),seen=new Set(),seenGroups=new Set(),ordered=[];
    function append(id){if(typeof id!=='string'||!objects.has(id)||seen.has(id))throw new Error('Invalid or repeated object in the layer folders.');seen.add(id);ordered.push(objects.get(id));}
    for(const node of doc.layers){
      if(!node||node.kind!=='object'&&node.kind!=='group')throw new Error('Invalid layer entry.');
      if(node.kind==='object')append(node.id);
      else{const g=groups.get(node.id);if(!g||seenGroups.has(g.id))throw new Error('Invalid or repeated folder.');seenGroups.add(g.id);g.children.forEach(append);}
    }
    if(seen.size!==objects.size||seenGroups.size!==groups.size)throw new Error('Every object and folder must appear exactly once in the layers.');
    doc.objects=ordered;return doc;
  }
  function parseLayout(raw,objects){
    if(raw.version===1)return normalize({name:String(raw.name||'Untitled object').slice(0,100),objects});
    if(!Array.isArray(raw.groups)||raw.groups.length>1000||!Array.isArray(raw.layers)||raw.layers.length>2000)throw new Error('Invalid folder layout in project.');
    const ids=new Set(objects.map(o=>o.id));
    const groups=raw.groups.map(g=>{
      if(!g||typeof g.id!=='string'||ids.has(g.id)||!Array.isArray(g.children)||g.children.length>1000)throw new Error('Invalid folder data in project.');
      ids.add(g.id);return {id:g.id,name:String(g.name||'Folder').slice(0,100),visible:g.visible!==false,locked:g.locked===true,collapsed:g.collapsed===true,children:[...g.children]};
    });
    return sync({name:String(raw.name||'Untitled object').slice(0,100),objects,groups,layers:raw.layers.map(n=>({kind:n?.kind,id:n?.id}))});
  }
  function requireEditable(doc,ids){if(items(doc,ids).some(o=>isLocked(doc,o)))throw new Error('Unlock every selected object and folder first.');}
  function requireGroup(doc,id){const g=group(doc,id);if(!g)throw new Error('That folder no longer exists.');if(g.locked)throw new Error('Unlock the destination folder first.');return g;}
  function removeReferences(doc,ids){const set=new Set(ids);doc.layers=doc.layers.filter(n=>n.kind!=='object'||!set.has(n.id));doc.groups.forEach(g=>g.children=g.children.filter(id=>!set.has(id)));}
  function uniqueName(doc){let i=1;while(doc.groups.some(g=>g.name==='Group '+i))i++;return 'Group '+i;}
  function createGroup(doc,ids,id,name=uniqueName(doc)){
    const selected=items(doc,ids);requireEditable(doc,ids);
    if(object(doc,id)||group(doc,id))throw new Error('A layer with that ID already exists.');
    const chosen=new Set(selected.map(o=>o.id));
    const rootIndexes=doc.layers.map((n,i)=>n.kind==='object'?chosen.has(n.id)?i:-1:group(doc,n.id).children.some(id=>chosen.has(id))?i:-1);
    const front=Math.max(-1,...rootIndexes),before=doc.layers.filter((n,i)=>i<=front&&(n.kind==='group'||!chosen.has(n.id))).length;
    removeReferences(doc,selected.map(o=>o.id));
    const g={id,name,visible:true,locked:false,collapsed:false,children:selected.map(o=>o.id)};doc.groups.push(g);
    doc.layers.splice(front<0?doc.layers.length:before,0,{kind:'group',id});sync(doc);return g;
  }
  function addObject(doc,o,groupId=null){
    const g=groupId?requireGroup(doc,groupId):null;
    if(object(doc,o.id)||group(doc,o.id))throw new Error('A layer with that ID already exists.');
    doc.objects.push(o);if(g)g.children.push(o.id);else doc.layers.push({kind:'object',id:o.id});sync(doc);
  }
  function assignObjects(doc,ids,groupId=null,afterId=null){
    const selected=items(doc,ids);if(!selected.length)return false;requireEditable(doc,ids);
    const g=groupId?requireGroup(doc,groupId):null;
    if(afterId&&ids.includes(afterId))return false;
    removeReferences(doc,ids);const list=g?g.children:doc.layers;
    const index=afterId?list.findIndex(n=>(typeof n==='string'?n:n.id)===afterId)+1:list.length;
    list.splice(index,0,...selected.map(o=>g?o.id:{kind:'object',id:o.id}));sync(doc);return true;
  }
  function ungroup(doc,id){
    const g=requireGroup(doc,id);requireEditable(doc,g.children);const index=doc.layers.findIndex(n=>n.id===id);
    doc.layers.splice(index,1,...g.children.map(id=>({kind:'object',id})));doc.groups=doc.groups.filter(v=>v.id!==id);sync(doc);return [...g.children];
  }
  function removeObjects(doc,ids){requireEditable(doc,ids);removeReferences(doc,ids);const set=new Set(ids);doc.objects=doc.objects.filter(o=>!set.has(o.id));sync(doc);}
  function removeGroup(doc,id){const g=requireGroup(doc,id);const ids=[...g.children];removeObjects(doc,ids);doc.groups=doc.groups.filter(g=>g.id!==id);doc.layers=doc.layers.filter(n=>n.id!==id);sync(doc);}
  function moveLayer(doc,ids,groupId,delta,apply=true){
    let list,chosen;
    if(groupId){const g=group(doc,groupId);if(!g||g.locked)return false;list=doc.layers;chosen=new Set([groupId]);}
    else{
      const selected=items(doc,ids);if(!selected.length||selected.some(o=>isLocked(doc,o)))return false;
      const parents=selected.map(o=>parent(doc,o.id)?.id||null);if(parents.some(p=>p!==parents[0]))return false;
      list=parents[0]?group(doc,parents[0]).children:doc.layers;chosen=new Set(ids);
    }
    const idOf=n=>typeof n==='string'?n:n.id;
    const indexes=list.map((n,i)=>chosen.has(idOf(n))?i:-1).filter(i=>i>=0);
    if(!indexes.length)return false;
    const edge=delta>0?Math.max(...indexes):Math.min(...indexes),neighbor=edge+delta;
    if(neighbor<0||neighbor>=list.length)return false;
    if(!apply)return true;
    const selected=list.filter(n=>chosen.has(idOf(n))),remaining=list.filter(n=>!chosen.has(idOf(n))),anchor=list[neighbor];
    const target=remaining.indexOf(anchor)+(delta>0?1:0);remaining.splice(target,0,...selected);list.splice(0,list.length,...remaining);sync(doc);return true;
  }
  function reorderRoot(doc,id,targetId){
    if(id===targetId)return false;const i=doc.layers.findIndex(n=>n.id===id);if(i<0)return false;
    const [node]=doc.layers.splice(i,1),index=targetId?doc.layers.findIndex(n=>n.id===targetId)+1:doc.layers.length;
    doc.layers.splice(index,0,node);sync(doc);return true;
  }
  function transform(objects,{dx=0,dy=0,scale=1,angle=0,pivot={x:0,y:0},flipX=false,flipY=false}={}){
    if(![dx,dy,scale,angle,pivot.x,pivot.y].every(Number.isFinite)||scale<.001||scale>1000)throw new Error('Use a scale from 0.1% to 100000% and finite transform values.');
    const r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
    return objects.map(o=>({...o,vertices:o.vertices.map(p=>{
      const x=(p.x-pivot.x)*scale*(flipX?-1:1),y=(p.y-pivot.y)*scale*(flipY?-1:1),q={x:pivot.x+x*c-y*s+dx,y:pivot.y+x*s+y*c+dy};
      if(!Number.isFinite(q.x)||!Number.isFinite(q.y)||Math.abs(q.x)>1+1e-12||Math.abs(q.y)>1+1e-12)throw new Error('Keep the entire selection between −1 and 1.');
      q.x=Math.max(-1,Math.min(1,q.x));q.y=Math.max(-1,Math.min(1,q.y));
      return q;
    })}));
  }
  function duplicate(doc,ids,groupId,newId,dx,dy){
    const selected=items(doc,groupId?group(doc,groupId).children:ids);if(!groupId&&selected.some(o=>parent(doc,o.id)?.locked))throw new Error('Unlock the destination folder first.');const clones=transform(selected,{dx,dy}).map(o=>({...copy(o),id:newId(),name:o.name+' copy',locked:false}));
    if(groupId){
      const original=group(doc,groupId),g={...copy(original),id:newId(),name:original.name+' copy',locked:false,children:clones.map(o=>o.id)};
      doc.objects.push(...clones);doc.groups.push(g);doc.layers.splice(doc.layers.findIndex(n=>n.id===groupId)+1,0,{kind:'group',id:g.id});sync(doc);return {ids:g.children,groupId:g.id};
    }
    clones.forEach((o,i)=>{const source=selected[i],g=parent(doc,source.id);if(g?.locked)throw new Error('Unlock the destination folder first.');doc.objects.push(o);const list=g?g.children:doc.layers,index=list.findIndex(n=>(typeof n==='string'?n:n.id)===source.id);list.splice(index+1,0,g?o.id:{kind:'object',id:o.id});});sync(doc);return {ids:clones.map(o=>o.id),groupId:null};
  }
  const api={group,object,parent,isVisible,isLocked,visibleObjects,items,normalize,sync,parseLayout,requireEditable,createGroup,addObject,assignObjects,ungroup,removeObjects,removeGroup,moveLayer,reorderRoot,transform,duplicate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Scene=api;
})(typeof globalThis!=='undefined'?globalThis:this);
