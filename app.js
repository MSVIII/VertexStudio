/* Vertex Studio — offline, dependency-free WebGL object editor. */
(() => {
  'use strict';
  const G=Geometry,S=Scene,$=id=>document.getElementById(id),clone=o=>JSON.parse(JSON.stringify(o));
  const palette=['#93ddc2','#8fa8ed','#c6a5df','#edb49a','#e5d49c','#eef0e8'];
  const icons={points:'<circle cx="6" cy="6" r="1"/><circle cx="18" cy="8" r="1"/><circle cx="10" cy="18" r="1"/>',lines:'<path d="m4 17 7-10m3 10 6-10"/>','line-strip':'<path d="m3 18 6-12 6 10 6-12"/>','line-loop':'<path d="m4 18 3-12 12-2 2 14z"/>',triangles:'<path d="m3 19 9-15 9 15z"/>','triangle-strip':'<path d="m2 18 5-12 6 12 5-12 4 12zM7 6h11"/>','triangle-fan':'<path d="m3 19 2-12 9-4 7 10-6 8zM3 19 14 3m-11 16 18-6"/>',polygon:'<path d="m4 17 1-11 9-3 7 8-5 10z"/>',quads:'<path d="m3 18 3-12h12l3 12z"/>','quad-strip':'<path d="m3 19 2-14h6l2 14h8l-2-14h-8M4 12h16"/>',circle:'<circle cx="12" cy="12" r="8"/>'};
  const svg=(type)=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[type]||icons.polygon}</svg>`;
  const eye='<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const lock='<svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg>';
  const notes={points:'Place individual points. Each click adds one vertex.',lines:'Plot pairs of vertices. Each pair makes a separate line.','line-strip':'Connect a series of vertices with an open line.','line-loop':'Connect vertices into a closed, unfilled outline.',triangles:'Plot groups of three vertices. Each group makes a triangle.','triangle-strip':'After the first three points, each point adds a triangle.','triangle-fan':'The first point is the center of your triangle fan.',polygon:'Plot a simple outline. Concave shapes are welcome.',quads:'Plot four corners around each convex quad. Repeat for more quads.','quad-strip':'Plot vertex pairs across the strip: left, right, then the next pair.',circle:'Click the center, then a radius point. A triangle fan fills the circle.'};
  let counter=0;
  const uid=()=>`obj-${Date.now().toString(36)}-${++counter}`;
  const obj=(name,type,color,points)=>({id:uid(),name,type,color,opacity:1,lineWidth:1,pointSize:6,visible:true,locked:false,vertices:points.map(([x,y])=>({x,y}))});
  const sample=()=>({name:'Alpine study',objects:[
    obj('Evening sun','circle','#e9bd91',Array.from({length:40},(_,i)=>[2.45+1.05*Math.cos(i/40*Math.PI*2),2.6+1.05*Math.sin(i/40*Math.PI*2)])),
    obj('Distant ridge','polygon','#728ba5',[[-4.3,-1.6],[-.9,3.2],[2.5,-1.6]]),
    obj('Distant shadow','triangles','#506881',[[-.9,3.2],[2.5,-1.6],[.15,-1.6]]),
    obj('Alpine peak','polygon','#93ddc2',[[-2.65,-2.6],[.8,2.45],[4.5,-2.6]]),
    obj('Light & shade','triangles','#4c9d89',[[.8,2.45],[4.5,-2.6],[1.65,-2.6]]),
    obj('Snow cap','polygon','#e3f0df',[[-.18,1.02],[.8,2.45],[1.85,1.02],[1.15,1.35],[.67,.95],[.3,1.3]])
  ].map(o=>({...o,vertices:o.vertices.map(p=>({x:p.x/5,y:p.y/5}))}))});
  let doc=sample(),selection=null,tool='select',primitive='polygon',paint='#93ddc2',opacity=1,lineWidth=1,pointSize=6;
  let selectionIds=[],selectedGroup=null,activeGroup=null;
  let insertedVertex=null,pointerInside=false;
  let draft=null,history=[],future=[],snap=true,showGrid=true,gridInFront=false,space=false,drag=null,pointer={x:0,y:0},view={x:0,y:0,scale:50};
  let width=0,height=0,dpr=1,dirty=false,storageAvailable=true,saveTimer,toastTimer,format='cpp',wheelHSV={h:155,s:.34,v:.87},dragLayer=null;
  const viewport=$('viewport'),grid=$('gridCanvas').getContext('2d'),overlay=$('overlayCanvas').getContext('2d');
  const gl=$('glCanvas').getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true});
  let program,positionLocation,colorLocation,scaleLocation,offsetLocation,pointLocation,buffer;
  if(gl) {
    function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
    program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec2 a_position; uniform vec2 u_scale; uniform vec2 u_offset; uniform float u_point; void main(){ gl_Position=vec4(a_position*u_scale+u_offset,0.0,1.0); gl_PointSize=u_point; }'));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; uniform vec4 u_color; void main(){ gl_FragColor=u_color; }'));gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    positionLocation=gl.getAttribLocation(program,'a_position');colorLocation=gl.getUniformLocation(program,'u_color');scaleLocation=gl.getUniformLocation(program,'u_scale');offsetLocation=gl.getUniformLocation(program,'u_offset');pointLocation=gl.getUniformLocation(program,'u_point');buffer=gl.createBuffer();
    gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.disable(gl.DEPTH_TEST);
  } else { $('webglError').hidden=false;document.querySelector('.webgl-label').textContent='WEBGL UNAVAILABLE'; }
  try { const stored=localStorage.getItem('vertex-studio.project.v1');if(stored){doc=G.parseProject(stored,{fitLegacy:true});if(doc.coordinatesFitted)setTimeout(()=>toast('Older canvas fitted proportionally into −1 to 1. Original project files are unchanged.'),500);} }catch(e){storageAvailable=false;toast('Local recovery was unavailable. Use Save project to keep your work.');}
  S.normalize(doc);
  function selected(){return selectionIds.length===1&&!selectedGroup?S.object(doc,selectionIds[0]):null;}
  function selectedItems(){return S.items(doc,selectionIds);}
  function groupInfo(){return S.group(doc,selectedGroup);}
  function selectionEditable(){return selectionIds.length>0&&!selectedItems().some(o=>S.isLocked(doc,o))&&!groupInfo()?.locked;}
  function snapshot(){return {doc:clone(doc),selection,selectionIds:[...selectionIds],selectedGroup,activeGroup};}
  function restore(state){doc=clone(state.doc);selectionIds=[...(state.selectionIds||[])];selection=state.selection;selectedGroup=state.selectedGroup||null;activeGroup=state.activeGroup||null;insertedVertex=null;}
  function changeScene(action,uiOptions){
    if(draft){toast('Finish or cancel the current object first.');return;}
    const before=snapshot();
    try{if(action()===false)return;history.push(before);if(history.length>80)history.shift();future=[];changed(uiOptions);}
    catch(e){restore(before);updateUI();render();toast(e.message);}
  }

  function remember(){history.push(snapshot());if(history.length>80)history.shift();future=[];}
  function changed({keepInputs=false}={}){dirty=true;clearTimeout(saveTimer);$('saveStatus').textContent='Saving on this device…';saveTimer=setTimeout(autosave,350);if(keepInputs)refreshFieldLabels();else updateUI();render();}
  // A blur commit must not replace the layer that the user is in the middle of clicking.
  function refreshFieldLabels(){
    $('sceneLabel').textContent=doc.name.toUpperCase();$('undo').disabled=!history.length;$('redo').disabled=!future.length;
    document.querySelectorAll('.layer-row[data-id]').forEach(row=>{const o=S.object(doc,row.dataset.id);if(o){row.querySelector('.layer-info strong').textContent=o.name;row.setAttribute('aria-label',o.name+' layer'+(S.isLocked(doc,o)?', locked':''));row.querySelector('.layer-thumb').style.color=o.color;}});
    document.querySelectorAll('.folder-row[data-group-id]').forEach(row=>{const g=S.group(doc,row.dataset.groupId);if(g){row.querySelector('.layer-info strong').textContent=g.name;row.setAttribute('aria-label',g.name+' folder');const controls=row.querySelectorAll('.layer-control');controls[0].setAttribute('aria-label',(g.visible?'Hide ':'Show ')+g.name);controls[1].setAttribute('aria-label',(g.locked?'Unlock ':'Lock ')+g.name);row.querySelector('.folder-chevron').setAttribute('aria-label',(g.collapsed?'Expand ':'Collapse ')+g.name);}});
    for(const select of [$('drawTarget'),$('moveToFolder')])for(const option of select.options){const g=S.group(doc,option.value);if(g)option.textContent=g.name+(g.locked?' (locked)':!g.visible?' (hidden)':'');}
    syncStrokeUI();
  }
  function autosave(){try{localStorage.setItem('vertex-studio.project.v1',projectJSON());storageAvailable=true;dirty=false;$('saveStatus').innerHTML='<i></i> Saved on this device';}catch(e){storageAvailable=false;$('saveStatus').textContent='Download a project to save';}}
  function projectJSON(){return JSON.stringify({format:'vertex-studio-project',version:3,...doc},null,2);}
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3600);}
  function undo(){if(draft){if(draft.vertices.length){draft.vertices.pop();updateDraft();render();}return;}if(!history.length)return;future.push(snapshot());const s=history.pop();restore(s);changed();}
  function redo(){if(draft||!future.length)return;history.push(snapshot());const s=future.pop();restore(s);changed();}
  function world(p){return {x:(p.x-view.x)/view.scale,y:(view.y-p.y)/view.scale};}
  function screen(p){return {x:view.x+p.x*view.scale,y:view.y-p.y*view.scale};}
  function rounded(n){return Math.round(n*1e8)/1e8;}
  function snapped(p){if(!snap)return {x:rounded(p.x),y:rounded(p.y)};const s=Math.min(1,G.gridStep(view.scale));return {x:rounded(Math.round(p.x/s)*s),y:rounded(Math.round(p.y/s)*s)};}
  function local(e){const r=viewport.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
  function fmt(n,step=G.gridStep(view.scale)){const places=Math.max(0,-Math.floor(Math.log10(step)));return (Math.abs(n)<step/100?0:n).toFixed(places);}
  function setTool(t){if(draft && t!=='draw'){toast('Finish or cancel your current object first.');return;}tool=t;document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b.dataset.tool===t);b.setAttribute('aria-pressed',String(b.dataset.tool===t));});viewport.style.cursor=t==='pan'?'grab':t==='draw'||t==='insert'?'crosshair':t==='transform'?'move':'default';if($('insertVertexTool'))$('insertVertexTool').setAttribute('aria-pressed',String(t==='insert'));updateStatus();render();}
  function setPrimitive(type){if(draft){toast('Finish or cancel your current object before changing primitives.');return;}selection=null;selectionIds=[];selectedGroup=null;primitive=type;document.querySelectorAll('[data-primitive]').forEach(b=>{b.classList.toggle('active',b.dataset.primitive===type);b.setAttribute('aria-pressed',String(b.dataset.primitive===type));});$('primitiveNote').textContent=notes[type];$('startDrawing').innerHTML=`＋ Draw ${G.LABELS[type].toLowerCase()} <kbd>P</kbd>`;setTool('draw');updateUI();render();}
  function startDrawing(){if(draft)return;const target=S.group(doc,activeGroup);if(target&&(target.locked||!target.visible)){toast('Show and unlock the destination folder before plotting.');return;}selection=null;selectionIds=[];selectedGroup=null;draft={id:uid(),name:G.LABELS[primitive]+' '+(doc.objects.length+1),type:primitive,color:paint,opacity,lineWidth,pointSize,visible:true,locked:false,vertices:[]};setTool('draw');updateUI();updateDraft();render();viewport.focus();}
  function updateDraft(){$('drawingBanner').hidden=!draft;if(draft){$('draftLabel').textContent='Plotting '+G.LABELS[draft.type].toLowerCase();$('draftCount').textContent=draft.type==='circle'?(draft.vertices.length?'Choose a radius point':'Choose the center'):draft.vertices.length+' vertices';}updateStatus();}
  function finishDrawing(){if(!draft)return;if(draft.type==='circle'&&draft.vertices.length<3){toast('Click a center, then a radius point to create the circle.');return;}try{G.validateObject(draft);}catch(e){toast(e.message);return;}remember();S.addObject(doc,draft,activeGroup);selection=draft.id;selectionIds=[draft.id];selectedGroup=null;draft=null;setTool('select');changed();updateDraft();toast('Object created. Drag its vertices to refine it.');}
  function cancelDrawing(){draft=null;updateDraft();setTool('select');updateUI();render();}
  function updateStatus(){
    $('statusHint').innerHTML='<i></i>'+(draft?(draft.type==='circle'?'Click center, then radius · Esc to cancel':'Click to plot · Enter to finish · Esc to cancel'):tool==='pan'?'Drag to pan · Scroll to zoom':tool==='draw'?'Click to plot in the chosen folder':tool==='insert'?'Click an edge to add a vertex · Drag a handle to reshape · V to select':tool==='transform'?'Drag to move · Corners scale · Top handle rotates':'Shift-click to add · Drag empty space to select · T to transform');
  }
  function setSelection(ids,groupId=null){
    selectionIds=[...new Set(ids)].filter(id=>S.object(doc,id));selectedGroup=groupId;selection=selectionIds.length===1&&!groupId?selectionIds[0]:null;
    if(groupId)activeGroup=groupId;
    else if(selectionIds.length){const parents=selectionIds.map(id=>S.parent(doc,id)?.id||null);activeGroup=parents.every(id=>id===parents[0])?parents[0]:null;}
    const o=selected();if(o){paint=o.color;opacity=o.opacity;lineWidth=G.lineWidth(o);pointSize=G.pointSize(o);syncColor();}
    updateUI();render();
  }
  function select(id,additive=false){const ids=additive?[...selectionIds]:[];if(id){const i=ids.indexOf(id);i>=0?ids.splice(i,1):ids.push(id);}setSelection(ids);}
  function selectGroup(id,additive=false){const g=S.group(doc,id);if(!g)return;if(additive){const all=g.children.every(id=>selectionIds.includes(id)),ids=all?selectionIds.filter(id=>!g.children.includes(id)):[...selectionIds,...g.children];setSelection(ids,ids.length===g.children.length&&ids.every(id=>g.children.includes(id))?g.id:null);}else setSelection(g.children,g.id);}
  function updateUI(){
    selectionIds=selectionIds.filter(id=>S.object(doc,id));if(selectedGroup&&!S.group(doc,selectedGroup))selectedGroup=null;if(activeGroup&&!S.group(doc,activeGroup))activeGroup=null;
    selection=selectionIds.length===1&&!selectedGroup?selectionIds[0]:null;
    $('projectName').value=doc.name;$('sceneLabel').textContent=doc.name.toUpperCase();$('sceneSubtitle').textContent=doc.objects.length?'A little geometry. A lot of possibility.':'YOUR NEXT IDEA STARTS HERE';
    $('emptyCanvas').hidden=doc.objects.length>0||!!draft;$('layerCount').textContent=doc.objects.length;
    $('undo').disabled=!history.length&&!draft?.vertices.length;$('redo').disabled=!future.length||!!draft;
    $('vertexTotal').textContent=doc.objects.reduce((n,o)=>n+o.vertices.length,0)+' vertices';
    renderLayers();renderProperties();syncStrokeUI();updateTransformUI();updateDraft();
    const editable=selectionEditable()&&!draft,folder=groupInfo();
    $('moveUp').disabled=!!draft||!S.moveLayer(doc,selectionIds,selectedGroup,1,false);$('moveDown').disabled=!!draft||!S.moveLayer(doc,selectionIds,selectedGroup,-1,false);
    $('duplicate').disabled=!(selectionIds.length||folder)||!!draft;$('deleteObject').disabled=!!draft||!(editable||folder&&!folder.locked&&!folder.children.length);
    $('groupSelection').disabled=!editable||!!selectedGroup;$('ungroupSelection').disabled=!!draft||!(folder&&!folder.locked||editable&&selectionIds.some(id=>S.parent(doc,id)));
    const mixed=selectionIds.length>1||!!selectedGroup,locked=!!selected()&&S.isLocked(doc,selected());
    $('multiColorHint').hidden=!mixed;$('colorControlsPanel').classList.toggle('color-disabled',mixed||locked);
    $('colorControlsPanel').querySelectorAll('input,button').forEach(el=>el.disabled=mixed||locked);
    $('colorWheel').setAttribute('aria-disabled',String(mixed||locked));
  }
  function folderOptions(select,placeholder){
    select.replaceChildren();const base=document.createElement('option');base.value=placeholder?'__choose__':'';base.textContent=placeholder?'Choose a destination…':'Canvas (ungrouped)';select.append(base);
    if(placeholder){const canvas=document.createElement('option');canvas.value='';canvas.textContent='Canvas (ungrouped)';select.append(canvas);}
    for(const g of doc.groups){const option=document.createElement('option');option.value=g.id;option.textContent=g.name+(g.locked?' (locked)':!g.visible?' (hidden)':'');option.disabled=g.locked;select.append(option);}
  }
  function renderLayers(){
    folderOptions($('drawTarget'),false);$('drawTarget').value=activeGroup||'';$('drawTarget').disabled=!!draft;
    const list=$('layerList'),scroll=list.scrollTop;list.replaceChildren();
    if(!doc.layers.length){const p=document.createElement('p');p.className='panel-subtitle';p.textContent='Your objects and folders will appear here.';list.append(p);}
    function controls(row,item,isGroup){
      const visibility=document.createElement('button');visibility.className='layer-control';visibility.title=(item.visible?'Hide ':'Show ')+item.name;visibility.setAttribute('aria-label',visibility.title);visibility.innerHTML=eye;visibility.style.opacity=item.visible?'1':'.35';visibility.onclick=e=>{e.stopPropagation();changeScene(()=>{item.visible=!item.visible;});};row.append(visibility);
      const locked=document.createElement('button');locked.className='layer-control';locked.title=(item.locked?'Unlock ':'Lock ')+item.name;locked.setAttribute('aria-label',locked.title);locked.innerHTML=lock;locked.style.opacity=item.locked?'1':'.3';locked.onclick=e=>{e.stopPropagation();changeScene(()=>{item.locked=!item.locked;});};row.append(locked);
    }
    function dragEvents(row,id,kind){
      row.ondragstart=e=>{e.stopPropagation();dragLayer={id,kind};e.dataTransfer.setData('text/plain',id);e.dataTransfer.effectAllowed='move';};
      row.ondragover=e=>{if(dragLayer&&dragLayer.id!==id){e.preventDefault();e.stopPropagation();row.classList.add('drag-over');}};
      row.ondragleave=()=>row.classList.remove('drag-over');
      row.ondrop=e=>{e.preventDefault();e.stopPropagation();if(!dragLayer||dragLayer.id===id)return;const payload=dragLayer;dragLayer=null;
        changeScene(()=>{
          if(payload.kind==='group'){const g=S.group(doc,payload.id);if(g.locked)throw new Error('Unlock this folder before reordering it.');const moved=S.reorderRoot(doc,g.id,kind==='group'?id:S.parent(doc,id)?.id||id);if(moved){selectionIds=[...g.children];selectedGroup=g.id;activeGroup=g.id;}return moved;}
          const ids=selectionIds.includes(payload.id)?selectionIds:[payload.id];
          const destination=kind==='group'?id:S.parent(doc,id)?.id||null;const moved=S.assignObjects(doc,ids,destination,kind==='group'?null:id);if(moved){selectionIds=[...ids];selectedGroup=null;activeGroup=destination;}return moved;
        });
      };
      row.ondragend=()=>{dragLayer=null;document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));};
    }
    function objectRow(o,inFolder=false){
      const row=document.createElement('div');row.className='layer-row'+(inFolder?' folder-child':'')+(selectionIds.includes(o.id)?' selected':'')+(!S.isVisible(doc,o)?' hidden-layer':'');row.draggable=!draft&&!S.isLocked(doc,o);row.tabIndex=0;row.dataset.id=o.id;row.setAttribute('role','button');row.setAttribute('aria-label',o.name+' layer'+(S.isLocked(doc,o)?', locked':''));row.setAttribute('aria-pressed',String(selectionIds.includes(o.id)));
      const thumb=document.createElement('span');thumb.className='layer-thumb';thumb.style.color=o.color;thumb.innerHTML=svg(o.type);row.append(thumb);
      const info=document.createElement('span');info.className='layer-info';const strong=document.createElement('strong');strong.textContent=o.name;const small=document.createElement('small');small.textContent=G.LABELS[o.type]+' · '+o.vertices.length+' vertices';info.append(strong,small);row.append(info);controls(row,o,false);
      row.onclick=e=>{if(!draft)select(o.id,e.shiftKey);};row.onkeydown=e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!draft)select(o.id,e.shiftKey);}};dragEvents(row,o.id,'object');return row;
    }
    for(const node of [...doc.layers].reverse()){
      if(node.kind==='object'){list.append(objectRow(S.object(doc,node.id)));continue;}
      const g=S.group(doc,node.id),container=document.createElement('div');container.className='layer-folder';
      const row=document.createElement('div');row.className='layer-row folder-row'+(selectedGroup===g.id?' selected':'')+(!g.visible?' hidden-layer':'');row.draggable=!draft&&!g.locked;row.dataset.groupId=g.id;row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-label',g.name+' folder');row.setAttribute('aria-pressed',String(selectedGroup===g.id));
      const collapse=document.createElement('button');collapse.className='folder-chevron';collapse.textContent=g.collapsed?'▸':'▾';collapse.setAttribute('aria-label',(g.collapsed?'Expand ':'Collapse ')+g.name);collapse.setAttribute('aria-expanded',String(!g.collapsed));collapse.onclick=e=>{e.stopPropagation();g.collapsed=!g.collapsed;renderLayers();autosave();};row.append(collapse);
      const thumb=document.createElement('span');thumb.className='folder-icon';thumb.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 6h7l2 3h9v11H3zM3 6V4h7l2 3h9v2"/></svg>';row.append(thumb);
      const info=document.createElement('span');info.className='layer-info';const strong=document.createElement('strong');strong.textContent=g.name;const small=document.createElement('small');small.textContent=g.children.length+' object'+(g.children.length===1?'':'s')+(activeGroup===g.id?' · drawing here':'');info.append(strong,small);row.append(info);controls(row,g,true);
      row.onclick=e=>{if(!draft)selectGroup(g.id,e.shiftKey);};row.onkeydown=e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();if(!draft)selectGroup(g.id,e.shiftKey);}};dragEvents(row,g.id,'group');container.append(row);
      if(!g.collapsed){for(const id of [...g.children].reverse())container.append(objectRow(S.object(doc,id),true));if(!g.children.length){const note=document.createElement('p');note.className='empty-folder-note';note.textContent='Drop layers here or start plotting.';container.append(note);}}
      list.append(container);
    }
    list.scrollTop=scroll;
  }

  function renderProperties(){
    const o=selected(),g=groupInfo();$('noSelection').hidden=!!o||!!g||selectionIds.length>1;$('selectionProperties').hidden=!o&&!g;$('multiSelectionNote').hidden=selectionIds.length<2||!!g;
    $('multiSelectionNote').textContent=selectionIds.length+' primitives selected. Transform or group them together.';
    if(!o&&!g)return;
    $('objectName').value=g?g.name:o.name;$('objectName').disabled=g?g.locked:S.isLocked(doc,o);$('objectType').textContent=g?'Layer folder':G.LABELS[o.type]+(S.isLocked(doc,o)?' · Locked':'');$('objectVertexCount').textContent=g?g.children.length+' objects':o.vertices.length+' vertices';
    $('vertexEditor').hidden=!!g;if(g)return;
    const canInsert=G.canInsertVertex(o),editable=canInsert&&!S.isLocked(doc,o)&&S.isVisible(doc,o);
    $('insertVertexTool').disabled=!editable;$('insertVertexTool').setAttribute('aria-pressed',String(tool==='insert'));
    $('insertVertexHint').textContent=canInsert?'Click an edge with I, or use + to insert its midpoint. Drag the new vertex to reshape this same layer.':'Insert into polygons, circles, outlines, single triangles or single quads. Strips and batches keep their topology.';
    $('vertexEditor').querySelector('.vertex-table-head').classList.toggle('with-insert',canInsert);
    const list=$('vertexList'),scroll=list.scrollTop;list.replaceChildren();
    o.vertices.forEach((p,i)=>{
      const row=document.createElement('div');row.className='vertex-row'+(canInsert?' with-insert':'')+(insertedVertex?.id===o.id&&insertedVertex.index===i?' inserted-vertex':'');
      const label=document.createElement('span');label.textContent=String(i+1).padStart(2,'0');row.append(label);
      for(const axis of ['x','y']){const input=document.createElement('input');input.type='number';input.step='any';input.min=-1;input.max=1;input.value=rounded(p[axis]);input.disabled=S.isLocked(doc,o);input.setAttribute('aria-label',`Vertex ${i+1} ${axis.toUpperCase()}`);input.onchange=input.onblur=()=>{const value=Number(input.value);if(!input.value.trim()||!Number.isFinite(value)||Math.abs(value)>1){toast('Enter a coordinate between −1 and 1.');renderProperties();return;}if(value===p[axis])return;const candidate=clone(o);candidate.vertices[i][axis]=value;if(candidate.type==='circle')candidate.type='polygon';try{G.validateObject(candidate);}catch(e){toast(e.message);renderProperties();return;}remember();o.vertices[i][axis]=value;if(o.type!==candidate.type){o.type=candidate.type;changed();}else changed({keepInputs:true});};row.append(input);}
      if(canInsert){const add=document.createElement('button');add.className='insert-midpoint';add.textContent='+';add.disabled=!editable||i>=G.edgeCount(o);add.setAttribute('aria-label','Insert vertex after vertex '+(i+1));add.title=i<G.edgeCount(o)?'Insert midpoint on edge '+(i+1)+'–'+((i+1)%o.vertices.length+1):'The open path ends here';add.onclick=()=>{const a=o.vertices[i],b=o.vertices[(i+1)%o.vertices.length];insertOnEdge(o.id,i,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});};row.append(add);}
      list.append(row);
    });list.scrollTop=scroll;
  }
  function insertOnEdge(id,index,point){
    changeScene(()=>{
      const o=S.object(doc,id);if(!o||!S.isVisible(doc,o))throw new Error('Show the primitive before adding vertices.');S.requireEditable(doc,[id]);
      const candidate=G.insertVertex(o,index,point);o.type=candidate.type;o.vertices=candidate.vertices;
      selectionIds=[id];selection=id;selectedGroup=null;activeGroup=S.parent(doc,id)?.id||null;insertedVertex={id,index:index+1};
      paint=o.color;opacity=o.opacity;lineWidth=G.lineWidth(o);pointSize=G.pointSize(o);syncColor();
    });
  }
  function insertionHit(p){
    const current=selected(),preferred=current&&G.canInsertVertex(current)?current:null;
    if(preferred&&(!S.isVisible(doc,preferred)||S.isLocked(doc,preferred)))return null;
    // An explicit selection limits insertion to that shape or folder, even if
    // another layer has an overlapping edge. With no selection, pick the frontmost edge.
    const candidates=selectionIds.length?[...selectedItems()].reverse():[...doc.objects].reverse();
    for(const o of candidates){
      if(!G.canInsertVertex(o)||!S.isVisible(doc,o)||S.isLocked(doc,o))continue;
      const hit=G.nearestEdge(o,world(p));if(!hit||hit.distance*view.scale>Math.max(12,G.isLine(o.type)?G.lineWidth(o)/2+4:0))continue;
      const a=o.vertices[hit.index],b=o.vertices[(hit.index+1)%o.vertices.length],distanceToEnd=Math.min(Math.hypot(hit.point.x-a.x,hit.point.y-a.y),Math.hypot(hit.point.x-b.x,hit.point.y-b.y))*view.scale;
      if(distanceToEnd<4)return null;return {...hit,object:o};
    }
    return null;
  }
  function moveLayer(delta){changeScene(()=>S.moveLayer(doc,selectionIds,selectedGroup,delta));}
  function deleteObject(){if(!selectionIds.length&&!selectedGroup)return;changeScene(()=>{if(selectedGroup)S.removeGroup(doc,selectedGroup);else S.removeObjects(doc,selectionIds);selectionIds=[];selection=null;selectedGroup=null;if(!S.group(doc,activeGroup))activeGroup=null;});}
  function duplicate(){if(!selectionIds.length&&!selectedGroup||draft)return;changeScene(()=>{const step=Math.min(.1,G.gridStep(view.scale)),b=selectionBounds(),dx=Math.min(step,1-b.maxX),dy=Math.max(-step,-1-b.minY),result=S.duplicate(doc,selectionIds,selectedGroup,uid,dx,dy);selectionIds=result.ids;selectedGroup=result.groupId;if(selectedGroup)activeGroup=selectedGroup;});}
  function makeFolder(empty=false){if(selectedGroup&&!empty){toast('This folder already groups the selected objects.');return;}changeScene(()=>{const g=S.createGroup(doc,empty?[]:selectionIds,uid());selectionIds=[...g.children];selection=null;selectedGroup=g.id;activeGroup=g.id;});if(empty&&groupInfo()){$('objectName').focus();$('objectName').select();}}
  function ungroupSelection(){changeScene(()=>{if(selectedGroup){selectionIds=S.ungroup(doc,selectedGroup);selectedGroup=null;activeGroup=null;}else{const ids=selectionIds.filter(id=>S.parent(doc,id));if(!ids.length)return false;S.assignObjects(doc,ids,null);activeGroup=null;}});}
  function selectionBounds(){return G.bounds(selectedItems());}
  function selectionPivot(){const b=selectionBounds();return {x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};}
  function applyObjects(objects){for(const candidate of objects)G.validateObject(candidate);for(const candidate of objects)S.object(doc,candidate.id).vertices=candidate.vertices;}
  function updateTransformUI(){
    $('transformPanel').hidden=!selectionIds.length||!!draft;$('selectionCount').textContent=selectionIds.length+' OBJECT'+(selectionIds.length===1?'':'S');
    const editable=selectionEditable();$('transformHint').textContent=editable?'Drag the selection to move it. T shows scale and rotation handles.':'Unlock all selected objects and their folders to transform.';
    for(const id of ['transformX','transformY','transformScale','transformAngle','applyTransform','flipHorizontal','flipVertical'])$(id).disabled=!editable;
    $('transformX').value=0;$('transformY').value=0;$('transformScale').value=100;$('transformAngle').value=0;
    folderOptions($('moveToFolder'),true);$('moveToFolder').value='__choose__';$('moveToFolder').disabled=!editable;
  }
  function flipSelection(axis){if(!selectionEditable())return;changeScene(()=>{S.requireEditable(doc,selectionIds);applyObjects(S.transform(selectedItems(),{pivot:selectionPivot(),flipX:axis==='x',flipY:axis==='y'}));});}
  function applyNumericTransform(){if(!selectionEditable())return;const read=id=>$(id).value.trim()?Number($(id).value):NaN;const params={dx:read('transformX'),dy:read('transformY'),scale:read('transformScale')/100,angle:read('transformAngle'),pivot:selectionPivot()};changeScene(()=>{S.requireEditable(doc,selectionIds);applyObjects(S.transform(selectedItems(),params));});}

  function syncStrokeUI(){
    if(!draft&&(selectionIds.length>1||selectedGroup)){$('strokeControls').hidden=true;return;}const o=draft||selected(),type=o?.type||primitive,points=type==='points';
    $('strokeControls').hidden=!points&&!G.isLine(type);if($('strokeControls').hidden)return;
    const size=o?(points?G.pointSize(o):G.lineWidth(o)):(points?pointSize:lineWidth);
    $('strokeLabel').textContent=points?'POINT SIZE':'LINE WIDTH';$('strokeSize').setAttribute('aria-label',points?'Point size in pixels':'Line width in pixels');
    $('strokeSize').value=size;$('strokeRange').value=size;$('strokeSize').disabled=$('strokeRange').disabled=!!o&&S.isLocked(doc,o);
    $('strokeHint').textContent=o&&S.isLocked(doc,o)?'Unlock this layer to change its size.':draft?'Size applies to the object being plotted.':o?'Size applies to '+o.name+'.':'Size applies to the next object.';
  }
  function applySize(value,commit=true){
    const o=draft||selected(),points=(o?.type||primitive)==='points',key=points?'pointSize':'lineWidth';
    if(!Number.isFinite(value)||value<.5||value>64){toast('Enter a size between 0.5 and 64 pixels.');syncStrokeUI();return;}
    if(o&&S.isLocked(doc,o))return;
    const before=o?(points?G.pointSize(o):G.lineWidth(o)):(points?pointSize:lineWidth);
    if(before===value)return;
    if(o&&!draft&&commit)remember();
    if(points)pointSize=value;else lineWidth=value;if(o)o[key]=value;
    if(o&&!draft&&commit)changed({keepInputs:true});else{syncStrokeUI();render();}
  }
  $('strokeSize').onchange=$('strokeSize').onblur=()=>applySize($('strokeSize').value.trim()?Number($('strokeSize').value):NaN);
  let sizeBefore=null;
  $('strokeRange').addEventListener('input',()=>{if(!sizeBefore)sizeBefore=snapshot();applySize(Number($('strokeRange').value),false);});
  $('strokeRange').addEventListener('change',()=>{if(sizeBefore&&selected()&&!draft&&JSON.stringify(sizeBefore.doc)!==JSON.stringify(doc)){history.push(sizeBefore);if(history.length>80)history.shift();future=[];changed();}sizeBefore=null;});
  function drawGrid(){
    grid.clearRect(0,0,width,height);grid.shadowBlur=0;
    const step=Math.min(1,G.gridStep(view.scale)),spacing=step*view.scale,a=screen({x:-1,y:1}),b=screen({x:1,y:-1});
    grid.fillStyle='#0f1418';grid.beginPath();grid.rect(0,0,width,height);grid.rect(a.x,a.y,b.x-a.x,b.y-a.y);grid.fill('evenodd');
    grid.save();grid.beginPath();grid.rect(a.x,a.y,b.x-a.x,b.y-a.y);grid.clip();
    const min={x:Math.max(-1,world({x:0,y:height}).x),y:Math.max(-1,world({x:0,y:height}).y)},max={x:Math.min(1,world({x:width,y:0}).x),y:Math.min(1,world({x:width,y:0}).y)};
    function lines(s,color){grid.strokeStyle=color;grid.lineWidth=1;grid.beginPath();for(let x=Math.ceil((min.x-1e-10)/s)*s;x<=max.x+1e-10;x+=s){const px=Math.round(screen({x,y:0}).x)+.5;grid.moveTo(px,a.y);grid.lineTo(px,b.y);}for(let y=Math.ceil((min.y-1e-10)/s)*s;y<=max.y+1e-10;y+=s){const py=Math.round(screen({x:0,y}).y)+.5;grid.moveTo(a.x,py);grid.lineTo(b.x,py);}grid.stroke();}
    if(showGrid){if(spacing>70)lines(step/5,gridInFront?'rgba(191,220,204,.12)':'#20292f');lines(step,gridInFront?'rgba(191,220,204,.32)':'#263036');}
    grid.strokeStyle='#586c62';grid.beginPath();grid.moveTo(a.x,view.y+.5);grid.lineTo(b.x,view.y+.5);grid.moveTo(view.x+.5,a.y);grid.lineTo(view.x+.5,b.y);grid.stroke();grid.restore();
    grid.strokeStyle='#4e6359';grid.lineWidth=1;grid.strokeRect(a.x,a.y,b.x-a.x,b.y-a.y);
    grid.font='9px Consolas,monospace';grid.fillStyle=gridInFront?'#d3e9dc':'#81998b';grid.textAlign='center';if(gridInFront){grid.shadowColor='#13221a';grid.shadowBlur=3;}
    const labelY=Math.min(Math.max(view.y+17,18),height-15);
    for(let x=Math.ceil((min.x-1e-10)/step)*step;x<=max.x+1e-10;x+=step){if(Math.abs(x)<step*.001)continue;const px=screen({x,y:0}).x;if(px>12&&px<width-12)grid.fillText(fmt(x,step),px,labelY);}
    grid.textAlign='right';const labelX=Math.min(Math.max(view.x-10,36),width-22);
    for(let y=Math.ceil((min.y-1e-10)/step)*step;y<=max.y+1e-10;y+=step){if(Math.abs(y)<step*.001)continue;const py=screen({x:0,y}).y;if(py>18&&py<height-15)grid.fillText(fmt(y,step),labelX,py+3);}
    if(view.x>5&&view.x<width-5&&view.y>5&&view.y<height-5)grid.fillText('0',view.x-10,view.y+17);
    grid.textAlign='left';grid.fillText('X',Math.min(b.x+13,width-16),Math.min(Math.max(view.y-8,18),height-15));grid.fillText('Y',Math.min(Math.max(view.x+10,15),width-20),Math.max(a.y-10,19));
    $('gridScale').innerHTML=`GRID <b>${fmt(step,step)}</b>`;$('resetView').textContent=Math.round(view.scale/planeScale()*100)+'%';
  }
  function drawGL(){if(!gl)return;gl.viewport(0,0,gl.canvas.width,gl.canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.uniform2f(scaleLocation,2*view.scale/width,2*view.scale/height);gl.uniform2f(offsetLocation,2*view.x/width-1,1-2*view.y/height);gl.uniform1f(pointLocation,6*dpr);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(positionLocation);gl.vertexAttribPointer(positionLocation,2,gl.FLOAT,false,0,0);
    const a=screen({x:-1,y:1}),b=screen({x:1,y:-1}),left=Math.max(0,Math.min(width,a.x)),right=Math.max(0,Math.min(width,b.x)),top=Math.max(0,Math.min(height,a.y)),bottom=Math.max(0,Math.min(height,b.y));
    gl.enable(gl.SCISSOR_TEST);gl.scissor(Math.floor(left*dpr),Math.floor((height-bottom)*dpr),Math.max(0,Math.ceil((right-left)*dpr)),Math.max(0,Math.ceil((bottom-top)*dpr)));
    const objects=draft&&(draft.type==='points'||G.isLine(draft.type))?[...doc.objects,draft]:doc.objects;
    for(const o of objects){if(!S.isVisible(doc,o))continue;let mesh;try{mesh=G.displayMesh(o,view.scale);}catch(e){continue;}gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(mesh.vertices.flatMap(p=>[p.x,p.y])),gl.DYNAMIC_DRAW);gl.uniform4fv(colorLocation,G.color(o.color,o.opacity));gl.drawArrays(mesh.mode,0,mesh.vertices.length);}
    gl.disable(gl.SCISSOR_TEST);
  }
  function pathVertices(v,close=false){overlay.beginPath();v.forEach((p,i)=>{const s=screen(p);i?overlay.lineTo(s.x,s.y):overlay.moveTo(s.x,s.y);});if(close)overlay.closePath();}
  function selectionFrame(){
    if(!selectionIds.length||!selectedItems().some(o=>S.isVisible(doc,o)))return null;const b=selectionBounds(),a=screen({x:b.minX,y:b.maxY}),c=screen({x:b.maxX,y:b.minY});
    return {left:a.x-12,top:a.y-12,right:c.x+12,bottom:c.y+12,cx:(a.x+c.x)/2,cy:(a.y+c.y)/2};
  }
  function frameHandles(f){return [{x:f.left,y:f.top},{x:f.right,y:f.top},{x:f.right,y:f.bottom},{x:f.left,y:f.bottom}];}
  function drawOverlay(){
    overlay.clearRect(0,0,width,height);const single=selected(),editing=!!single&&(tool==='select'||tool==='insert');
    for(const o of selectedItems()){
      if(!S.isVisible(doc,o))continue;overlay.strokeStyle=S.isLocked(doc,o)?'#8c9c95':'#d7f7e7';overlay.lineWidth=1;overlay.setLineDash([4,4]);
      if(['polygon','circle','line-loop'].includes(o.type)){pathVertices(o.vertices,true);overlay.stroke();}else if(['quads','quad-strip'].includes(o.type)){for(const face of G.quadFaces(o)){pathVertices(face,true);overlay.stroke();}}else if(['triangles','triangle-strip','triangle-fan'].includes(o.type)){try{for(const t of G.triangles(o)){pathVertices(t,true);overlay.stroke();}}catch(e){}}else if(o.type==='lines'){for(let i=0;i<o.vertices.length;i+=2){pathVertices(o.vertices.slice(i,i+2));overlay.stroke();}}else if(o.type==='line-strip'){pathVertices(o.vertices);overlay.stroke();}
      overlay.setLineDash([]);
      if(editing)o.vertices.forEach((p,i)=>{const s=screen(p),highlight=insertedVertex?.id===o.id&&insertedVertex.index===i;overlay.beginPath();overlay.arc(s.x,s.y,highlight?6:4,0,Math.PI*2);overlay.fillStyle=highlight?'#a7e9cf':'#1c3128';overlay.fill();overlay.strokeStyle=S.isLocked(doc,o)?'#8c9c95':'#c6f8de';overlay.stroke();if(o.vertices.length<=20||highlight){overlay.font='9px Consolas,monospace';overlay.fillStyle='#c1dfd0';overlay.fillText(i+1,s.x+8,s.y-8);}});
    }
    if(selectionIds.length&&(selectionIds.length>1||selectedGroup||tool==='transform')&&selectedItems().some(o=>S.isVisible(doc,o))){
      const f=selectionFrame();overlay.strokeStyle='#a7e9cf';overlay.lineWidth=1;overlay.setLineDash([5,4]);overlay.strokeRect(f.left,f.top,f.right-f.left,f.bottom-f.top);overlay.setLineDash([]);
      if(tool==='transform'&&selectionEditable()){
        overlay.fillStyle='#172b22';for(const p of frameHandles(f)){overlay.fillRect(p.x-4,p.y-4,8,8);overlay.strokeRect(p.x-4,p.y-4,8,8);}
        overlay.beginPath();overlay.moveTo(f.cx,f.top);overlay.lineTo(f.cx,f.top-24);overlay.stroke();overlay.beginPath();overlay.arc(f.cx,f.top-30,6,0,Math.PI*2);overlay.fill();overlay.stroke();
      }
      overlay.font='10px Consolas,monospace';overlay.fillStyle='#a7e9cf';overlay.fillText((groupInfo()?.name||selectionIds.length+' objects'),f.left,f.bottom+17);
    }
    if(tool==='insert'&&pointerInside&&!drag){const hit=insertionHit(pointer);if(hit){
      const a=screen(hit.object.vertices[hit.index]),b=screen(hit.object.vertices[(hit.index+1)%hit.object.vertices.length]),p=screen(hit.point);
      overlay.strokeStyle='#d8ffe9';overlay.lineWidth=2;overlay.beginPath();overlay.moveTo(a.x,a.y);overlay.lineTo(b.x,b.y);overlay.stroke();
      overlay.fillStyle='#173529';overlay.beginPath();overlay.arc(p.x,p.y,8,0,Math.PI*2);overlay.fill();overlay.stroke();overlay.beginPath();overlay.moveTo(p.x-4,p.y);overlay.lineTo(p.x+4,p.y);overlay.moveTo(p.x,p.y-4);overlay.lineTo(p.x,p.y+4);overlay.stroke();
      overlay.font='10px Consolas,monospace';overlay.fillStyle='#d8ffe9';overlay.fillText('Insert vertex',p.x+13,p.y-12);
    }}
    if(drag?.kind==='marquee'&&drag.moved){const x=Math.min(drag.start.x,pointer.x),y=Math.min(drag.start.y,pointer.y),w=Math.abs(pointer.x-drag.start.x),h=Math.abs(pointer.y-drag.start.y);overlay.fillStyle='#a7e9cf18';overlay.fillRect(x,y,w,h);overlay.strokeStyle='#a7e9cf';overlay.setLineDash([4,3]);overlay.strokeRect(x,y,w,h);overlay.setLineDash([]);}
    if(draft?.type==='circle'&&draft.vertices.length===1){const center=screen(draft.vertices[0]),radius=Math.hypot(world(pointer).x-draft.vertices[0].x,world(pointer).y-draft.vertices[0].y)*view.scale;overlay.beginPath();overlay.arc(center.x,center.y,radius,0,Math.PI*2);overlay.fillStyle=paint+'33';overlay.fill();overlay.strokeStyle=paint;overlay.stroke();}
    if(draft){const v=draft.vertices;overlay.lineWidth=1.5;overlay.strokeStyle=paint;overlay.fillStyle=paint;overlay.setLineDash([5,4]);
      if(v.length){pathVertices(v,draft.type==='polygon'||draft.type==='line-loop');overlay.stroke();const from=screen(v.at(-1)),to=screen(snapped(world(pointer)));overlay.beginPath();overlay.moveTo(from.x,from.y);overlay.lineTo(to.x,to.y);overlay.stroke();}
      overlay.setLineDash([]);v.forEach((p,i)=>{const s=screen(p);overlay.beginPath();overlay.arc(s.x,s.y,4,0,Math.PI*2);overlay.fill();overlay.font='10px Consolas,monospace';overlay.fillText(i+1,s.x+8,s.y-9);});
      const p=snapped(world(pointer)),s=screen(p);overlay.strokeStyle='#bbd7c7';overlay.lineWidth=1;overlay.beginPath();overlay.moveTo(s.x-8,s.y);overlay.lineTo(s.x+8,s.y);overlay.moveTo(s.x,s.y-8);overlay.lineTo(s.x,s.y+8);overlay.stroke();
    }
  }

  function render(){drawGrid();drawGL();drawOverlay();}
  function resize(){const r=viewport.getBoundingClientRect(),oldW=width,oldH=height;width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,2);for(const id of ['gridCanvas','glCanvas','overlayCanvas']){const c=$(id);c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);}grid.setTransform(dpr,0,0,dpr,0,0);overlay.setTransform(dpr,0,0,dpr,0,0);if(!oldW){resetPlane();}else{view.x+=(width-oldW)/2;view.y+=(height-oldH)/2;}render();}
  function planeScale(){return Math.max(30,Math.min(width-90,height-150)/2);}
  function constrainView(){view.x=Math.max(70-view.scale,Math.min(width-70+view.scale,view.x));view.y=Math.max(70-view.scale,Math.min(height-70+view.scale,view.y));}
  function resetPlane(){view={x:width/2,y:height/2+10,scale:planeScale()};render();}
  function fit(){const b=G.bounds(S.visibleObjects(doc)),dx=Math.max(.2,b.maxX-b.minX),dy=Math.max(.2,b.maxY-b.minY);view.scale=Math.min(planeScale()*8,Math.max(planeScale(),Math.min(Math.max(40,width-110)/dx,Math.max(40,height-180)/dy)));view.x=width/2-(b.minX+b.maxX)/2*view.scale;view.y=height/2+(b.minY+b.maxY)/2*view.scale+10;constrainView();render();}
  function zoom(factor,at={x:width/2,y:height/2}){const anchor=world(at);view.scale=Math.min(50000,Math.max(planeScale()*.5,view.scale*factor));view.x=at.x-anchor.x*view.scale;view.y=at.y+anchor.y*view.scale;constrainView();render();}
  function distanceToLine(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
  function hitObject(p){for(const o of [...doc.objects].reverse()){if(!S.isVisible(doc,o)||S.isLocked(doc,o))continue;const w=world(p);try{const triangles=G.isLine(o.type)||o.type==='points'?(()=>{const m=G.displayMesh(o,view.scale).vertices,t=[];for(let i=0;i<m.length;i+=3)t.push(m.slice(i,i+3));return t;})():G.triangles(o);if(triangles.some(([a,b,c])=>{const t=[G.cross(a,b,w),G.cross(b,c,w),G.cross(c,a,w)];return t.every(x=>x>=0)||t.every(x=>x<=0);}))return o;}catch(e){}const v=o.vertices.map(screen);if(o.type==='points'&&v.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<9))return o;if(G.isLine(o.type)){for(let i=0;i<v.length-(o.type==='line-loop'?0:1);i+=o.type==='lines'?2:1){if(distanceToLine(p,v[i],v[(i+1)%v.length])<7)return o;}}}return null;}
  function beginObjectDrag(kind,p){
    if(!selectionEditable()){toast('Unlock all selected objects and folders before transforming.');return false;}
    drag={kind,start:p,world:world(p),before:snapshot(),originals:clone(selectedItems()),pivot:selectionPivot(),moved:false,error:null};return true;
  }
  viewport.addEventListener('pointerdown',e=>{
    if(e.target!==viewport)return;viewport.focus();const p=local(e);pointer=p;pointerInside=true;
    if(e.button===1||space||tool==='pan'){e.preventDefault();drag={kind:'pan',start:p,x:view.x,y:view.y};viewport.setPointerCapture(e.pointerId);viewport.style.cursor='grabbing';return;}
    if(e.button!==0)return;
    if(tool==='draw'){if(e.detail>1)return;if(!draft)startDrawing();if(!draft)return;const raw=world(p);if(!G.inPlane(raw)){toast('Plot inside the −1 to 1 canvas.');return;}const point=snapped(raw);if(draft.type==='circle'&&draft.vertices.length===1){try{draft.vertices=G.circleVertices(draft.vertices[0],Math.hypot(point.x-draft.vertices[0].x,point.y-draft.vertices[0].y));finishDrawing();}catch(error){toast(error.message);}return;}if(draft.vertices.some(v=>Math.hypot(v.x-point.x,v.y-point.y)<1e-9)){if(draft.vertices.length>=3&&Math.hypot(draft.vertices[0].x-point.x,draft.vertices[0].y-point.y)<1e-9&&['polygon','line-loop'].includes(draft.type))finishDrawing();else toast('A vertex already exists here. Choose another grid point.');return;}draft.vertices.push(point);updateDraft();render();return;}
    if(tool==='insert'){
      const o=selected();if(o&&S.isVisible(doc,o)&&!S.isLocked(doc,o)){const index=o.vertices.findIndex(v=>{const q=screen(v);return Math.hypot(q.x-p.x,q.y-p.y)<4;});if(index>=0){drag={kind:'vertex',id:o.id,index,start:p,before:snapshot(),original:clone(o.vertices),moved:false};insertedVertex={id:o.id,index};viewport.setPointerCapture(e.pointerId);return;}}
      const hit=insertionHit(p);if(hit)insertOnEdge(hit.object.id,hit.index,hit.point);else toast(selectedItems().some(o=>S.isLocked(doc,o))?'Unlock this primitive and its folder before adding vertices.':'Click an edge between existing vertices. Use polygons, outlines, or a single triangle.');return;
    }
    const f=selectionFrame();
    if(tool==='transform'&&f&&selectionEditable()){
      const rotate=Math.hypot(p.x-f.cx,p.y-(f.top-30))<11,scale=frameHandles(f).some(h=>Math.hypot(h.x-p.x,h.y-p.y)<10);
      if(rotate||scale){beginObjectDrag(rotate?'rotate':'scale',p);viewport.setPointerCapture(e.pointerId);return;}
    }
    const current=selected();if(tool==='select'&&!e.shiftKey&&current&&S.isVisible(doc,current)&&!S.isLocked(doc,current)){const index=current.vertices.findIndex(v=>{const s=screen(v);return Math.hypot(s.x-p.x,s.y-p.y)<10;});if(index>=0){drag={kind:'vertex',id:current.id,index,start:p,before:snapshot(),original:clone(current.vertices),moved:false};viewport.setPointerCapture(e.pointerId);return;}}
    const hit=hitObject(p);
    if(hit){
      const folder=!e.altKey?S.parent(doc,hit.id):null,unit=folder?folder.children:[hit.id];
      if(e.shiftKey){const all=unit.every(id=>selectionIds.includes(id));const ids=all?selectionIds.filter(id=>!unit.includes(id)):[...selectionIds,...unit];setSelection(ids);return;}
      if(e.altKey||!selectionIds.includes(hit.id))setSelection(unit,folder?.id||null);
      if(beginObjectDrag('objects',p))viewport.setPointerCapture(e.pointerId);return;
    }
    if(tool==='transform'&&f&&p.x>=f.left&&p.x<=f.right&&p.y>=f.top&&p.y<=f.bottom){if(beginObjectDrag('objects',p))viewport.setPointerCapture(e.pointerId);return;}
    drag={kind:'marquee',start:p,base:e.shiftKey?[...selectionIds]:[],additive:e.shiftKey,moved:false};viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove',e=>{
    const p=local(e);pointer=p;pointerInside=true;const w=world(p);$('cursorPosition').innerHTML=G.inPlane(w)?`X <b>${w.x.toFixed(4)}</b> Y <b>${w.y.toFixed(4)}</b>`:'Outside −1…1';
    if(drag){
      if(drag.kind==='pan'){view.x=drag.x+p.x-drag.start.x;view.y=drag.y+p.y-drag.start.y;constrainView();render();return;}
      if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)<3&&!drag.moved)return;drag.moved=true;
      if(drag.kind==='marquee'){drawOverlay();return;}
      try{
        if(drag.kind==='vertex'){const o=S.object(doc,drag.id);o.vertices[drag.index]=snapped({x:Math.max(-1,Math.min(1,w.x)),y:Math.max(-1,Math.min(1,w.y))});if(o.type==='circle')o.type='polygon';}
        else{
          let params;
          if(drag.kind==='objects'){const delta=snapped({x:w.x-drag.world.x,y:w.y-drag.world.y});params={dx:delta.x,dy:delta.y};}
          else if(drag.kind==='scale'){const a={x:drag.world.x-drag.pivot.x,y:drag.world.y-drag.pivot.y},b={x:w.x-drag.pivot.x,y:w.y-drag.pivot.y};params={scale:Math.max(.001,Math.min(1000,(a.x*b.x+a.y*b.y)/(a.x*a.x+a.y*a.y||1))),pivot:drag.pivot};}
          else{let angle=(Math.atan2(w.y-drag.pivot.y,w.x-drag.pivot.x)-Math.atan2(drag.world.y-drag.pivot.y,drag.world.x-drag.pivot.x))*180/Math.PI;if(e.shiftKey)angle=Math.round(angle/15)*15;params={angle,pivot:drag.pivot};}
          const candidates=S.transform(drag.originals,params);for(const c of candidates)S.object(doc,c.id).vertices=c.vertices;
        }
        drag.error=null;
      }catch(error){drag.error=error;}
      render();return;
    }
    if(draft||tool==='insert')drawOverlay();
  });
  function endDrag(){
    if(!drag)return;const ended=drag;drag=null;viewport.style.cursor=tool==='pan'?'grab':tool==='draw'||tool==='insert'?'crosshair':tool==='transform'?'move':'default';
    if(ended.kind==='marquee'){
      if(!ended.moved){if(!ended.additive)select(null);else render();return;}
      const left=Math.min(ended.start.x,pointer.x),right=Math.max(ended.start.x,pointer.x),top=Math.min(ended.start.y,pointer.y),bottom=Math.max(ended.start.y,pointer.y),ids=[...ended.base];
      for(const o of doc.objects){if(!S.isVisible(doc,o)||S.isLocked(doc,o))continue;const b=G.bounds([o]),a=screen({x:b.minX,y:b.maxY}),c=screen({x:b.maxX,y:b.minY}),pad=o.type==='points'?G.pointSize(o)/2:G.isLine(o.type)?G.lineWidth(o)/2:0;if(c.x+pad>=left&&a.x-pad<=right&&c.y+pad>=top&&a.y-pad<=bottom)ids.push(...(S.parent(doc,o.id)?.children||[o.id]));}
      const unique=[...new Set(ids)],g=doc.groups.find(g=>g.children.length&&g.children.length===unique.length&&g.children.every(id=>unique.includes(id)));setSelection(unique,g?.id||null);return;
    }
    if(ended.kind==='pan'||!ended.moved){render();return;}
    try{if(ended.error)throw ended.error;if(ended.kind==='vertex')G.validateObject(S.object(doc,ended.id));else selectedItems().forEach(G.validateObject);if(JSON.stringify(ended.before.doc)!==JSON.stringify(doc)){history.push(ended.before);if(history.length>80)history.shift();future=[];changed();}else{updateUI();render();}}
    catch(e){restore(ended.before);updateUI();render();toast(e.message);}
  }
  viewport.addEventListener('pointerup',endDrag);
  function cancelActiveDrag(){if(drag?.before)restore(drag.before);else if(drag?.kind==='pan'){view.x=drag.x;view.y=drag.y;}drag=null;updateUI();render();}
  viewport.addEventListener('pointercancel',cancelActiveDrag);
  viewport.addEventListener('lostpointercapture',()=>{if(drag)cancelActiveDrag();});
  viewport.addEventListener('pointerleave',()=>{pointerInside=false;if(!drag)drawOverlay();});

  viewport.addEventListener('dblclick',e=>{if(e.target===viewport&&draft)finishDrawing();});viewport.addEventListener('contextmenu',e=>e.preventDefault());
  viewport.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(-Math.max(-200,Math.min(200,e.deltaY))*.0015),local(e));},{passive:false});
  function hsvToHex(h,s,v){let c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;const rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return '#'+rgb.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');}
  function hexToHSV(hex){const [r,g,b]=G.color(hex),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;let h=d===0?0:max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);return {h:(h+360)%360,s:max?d/max:0,v:max};}
  function drawWheel(){const c=$('colorWheel'),ctx=c.getContext('2d'),n=c.width,r=n/2-2,img=ctx.createImageData(n,n);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const dx=x-n/2,dy=y-n/2,dist=Math.hypot(dx,dy);if(dist>r)continue;const hex=hsvToHex((Math.atan2(dy,dx)*180/Math.PI+360)%360,dist/r,wheelHSV.v),rgba=G.color(hex),i=(y*n+x)*4;img.data[i]=rgba[0]*255;img.data[i+1]=rgba[1]*255;img.data[i+2]=rgba[2]*255;img.data[i+3]=Math.min(255,(r-dist)*255);}ctx.putImageData(img,0,0);positionWheelMarker();}
  function positionWheelMarker(){const size=$('colorWheel').getBoundingClientRect().width,r=size/2-2;const a=wheelHSV.h*Math.PI/180;$('wheelMarker').style.left=(size/2+Math.cos(a)*wheelHSV.s*r)+'px';$('wheelMarker').style.top=(size/2+Math.sin(a)*wheelHSV.s*r)+'px';}
  function syncColor(){wheelHSV=hexToHSV(paint);$('hexColor').value=paint.toUpperCase();$('opacity').value=Math.round(opacity*100);$('brightness').value=Math.max(1,Math.round(wheelHSV.v*100));$('brightnessValue').textContent=Math.round(wheelHSV.v*100)+'%';$('colorChip').style.background=paint;document.querySelectorAll('.swatch').forEach(b=>b.classList.toggle('active',b.dataset.color===paint.toLowerCase()));drawWheel();}
  function applyPaint(hex,alpha=opacity,commit=true){const o=selected();if(o&&S.isLocked(doc,o)&&!draft){toast('Unlock the layer to change its color.');syncColor();return;}if(o&&hex===o.color&&alpha===o.opacity&&!draft){paint=hex;opacity=alpha;syncColor();return;}if(o&&commit)remember();paint=hex;opacity=alpha;if(draft){draft.color=hex;draft.opacity=alpha;}else if(o){o.color=hex;o.opacity=alpha;if(commit)changed({keepInputs:true});}syncColor();render();}
  let wheelDrag=false,wheelBefore=null;
  function wheelPick(e){const r=$('colorWheel').getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;const h=(Math.atan2(dy,dx)*180/Math.PI+360)%360,s=Math.min(1,Math.hypot(dx,dy)/(r.width/2-2));applyPaint(hsvToHex(h,s,wheelHSV.v),opacity,false);}
  $('colorWheel').addEventListener('pointerdown',e=>{if(selectionIds.length>1||selectedGroup||selected()&&S.isLocked(doc,selected())){toast('Unlock the layer to change its color.');return;}wheelDrag=true;wheelBefore=snapshot();$('colorWheel').setPointerCapture(e.pointerId);wheelPick(e);});$('colorWheel').addEventListener('pointermove',e=>{if(wheelDrag)wheelPick(e);});
  function endWheel(){if(!wheelDrag)return;wheelDrag=false;if(selected()&&!draft){history.push(wheelBefore);future=[];changed();}}
  $('colorWheel').addEventListener('pointerup',endWheel);$('colorWheel').addEventListener('pointercancel',endWheel);
  let brightBefore=null;$('brightness').addEventListener('pointerdown',()=>brightBefore=snapshot());$('brightness').addEventListener('input',()=>{if(!brightBefore)brightBefore=snapshot();applyPaint(hsvToHex(wheelHSV.h,wheelHSV.s,Number($('brightness').value)/100),opacity,false);});$('brightness').addEventListener('change',()=>{if(selected()&&!S.isLocked(doc,selected())&&!draft&&brightBefore){history.push(brightBefore);future=[];changed();}brightBefore=null;});
  $('hexColor').onchange=$('hexColor').onblur=()=>{let hex=$('hexColor').value.trim();if(!hex.startsWith('#'))hex='#'+hex;if(!/^#[0-9a-f]{6}$/i.test(hex)){toast('Use a six-digit hex color, for example #93DDC2.');syncColor();return;}applyPaint(hex.toLowerCase());};
  $('opacity').onchange=$('opacity').onblur=()=>{const a=Number($('opacity').value);if(!Number.isFinite(a)||a<0||a>100){toast('Opacity must be between 0 and 100.');syncColor();return;}applyPaint(paint,a/100);};
  function safeFileName(name=doc.name){return name.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'untitled-object';}
  function download(text,name,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  function saveProject(){if(draft){toast('Finish or cancel your current object before saving.');return false;}download(projectJSON(),safeFileName()+'.vstudio.json','application/json');autosave();toast('Editable project downloaded.');return true;}
  function clearProject(){if(draft)cancelDrawing();remember();doc=S.normalize({name:'Untitled object',objects:[]});selection=null;selectionIds=[];selectedGroup=null;activeGroup=null;resetPlane();$('confirmDialog').close();changed();}
  async function openProject(file){if(!file)return;if(file.size>10*1024*1024){toast('Choose a project smaller than 10 MB.');return;}try{const imported=G.parseProject(await file.text(),{fitLegacy:true});if(draft)cancelDrawing();remember();doc=imported;selection=null;selectionIds=[];selectedGroup=null;activeGroup=null;changed();fit();toast(imported.coordinatesFitted?'Older project fitted proportionally into −1 to 1. Original file unchanged.':'Project opened. Your previous canvas is available with Undo.');}catch(e){toast(e.message);}finally{$('projectFile').value='';}}
  function exportDocument(){const onlySelection=$('exportScope').value==='selection',ids=new Set(selectionIds);return {name:onlySelection?(groupInfo()?.name||doc.name+' selection'):doc.name,objects:S.visibleObjects(doc).filter(o=>!onlySelection||ids.has(o.id))};}
  function refreshExport(){try{const exported=exportDocument(),data=G.compile(exported.objects);$('exportPreview').textContent=G.exportCode(exported,format);const native=format==='cpp'?G.nativeDraws(exported.objects):null,count=native?native.reduce((n,d)=>n+d.vertices.length,0):data.vertices.length/7;$('exportSummary').textContent=`${data.draws.length} draw calls  /  ${count} exported vertices  /  ${(count*(native?3:7)*4).toLocaleString()} bytes`;$('downloadExport').textContent='Download '+({cpp:'.cpp',js:'.js',json:'.json'}[format])+' ↓';$('exportNote').textContent=format==='cpp'?'Course-style GLUT program with simple GLfloat arrays and glDrawArrays (Modules 1–4). Uses only <GL/glut.h>. Build and run the active .cpp in your OpenGL workspace. Native point/line widths depend on your OpenGL driver. Hidden layers are omitted.':'Position XYZ + color RGBA · 7 floats per vertex. Hidden objects and hidden folders are omitted. Draw ranges include lineWidth and pointSize in screen pixels. Draw in order with alpha blending and depth testing disabled.';document.querySelectorAll('[data-format]').forEach(b=>b.classList.toggle('active',b.dataset.format===format));return true;}catch(e){toast(e.message);return false;}}
  function openExport(){if(draft){toast('Finish or cancel your current object before exporting.');return;}const option=$('exportScope').querySelector('[value="selection"]');option.disabled=!selectionIds.length;option.textContent=groupInfo()?'Selected folder: '+groupInfo().name:'Selected primitives ('+selectionIds.length+')';if(!selectionIds.length)$('exportScope').value='canvas';if(refreshExport())$('exportDialog').showModal();}
  document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
  $('insertVertexTool').onclick=()=>{setTool(tool==='insert'?'select':'insert');viewport.focus();};
  for(const type of ['points','lines','line-strip','line-loop','triangles','triangle-strip','triangle-fan','quads','quad-strip','polygon','circle']){const b=document.createElement('button');b.className='primitive-button'+(type===primitive?' active':'');b.dataset.primitive=type;b.setAttribute('aria-pressed',String(type===primitive));b.innerHTML=svg(type)+`<span>${G.LABELS[type]}</span>`;b.onclick=()=>setPrimitive(type);$('primitiveGrid').append(b);}
  for(const hex of palette){const b=document.createElement('button');b.className='swatch';b.style.background=hex;b.dataset.color=hex;b.title=hex.toUpperCase();b.setAttribute('aria-label','Use color '+hex);b.onclick=()=>applyPaint(hex);$('swatches').append(b);}
  $('primitiveNote').textContent=notes[primitive];$('startDrawing').onclick=startDrawing;$('emptyStart').onclick=startDrawing;$('addLayer').onclick=startDrawing;$('finishDrawing').onclick=finishDrawing;$('cancelDrawing').onclick=cancelDrawing;
  $('undo').onclick=undo;$('redo').onclick=redo;$('fitView').onclick=fit;$('fitView2').onclick=fit;$('zoomIn').onclick=()=>zoom(1.4);$('zoomOut').onclick=()=>zoom(1/1.4);$('resetView').onclick=resetPlane;
  $('toggleSnap').onclick=()=>{snap=!snap;$('toggleSnap').classList.toggle('toggled',snap);$('toggleSnap').setAttribute('aria-pressed',String(snap));toast('Grid snapping '+(snap?'on':'off'));};$('toggleGrid').onclick=()=>{showGrid=!showGrid;$('toggleGrid').classList.toggle('toggled',showGrid);$('toggleGrid').setAttribute('aria-pressed',String(showGrid));render();};
  $('toggleGridFront').onclick=()=>{gridInFront=!gridInFront;viewport.classList.toggle('grid-in-front',gridInFront);$('toggleGridFront').classList.toggle('toggled',gridInFront);$('toggleGridFront').setAttribute('aria-pressed',String(gridInFront));render();};
  $('moveUp').onclick=()=>moveLayer(1);$('moveDown').onclick=()=>moveLayer(-1);$('deleteObject').onclick=deleteObject;$('duplicate').onclick=duplicate;
  $('objectName').onchange=$('objectName').onblur=()=>{const o=selected(),g=groupInfo(),target=g||o;if(!target||(g?g.locked:S.isLocked(doc,o)))return;const name=$('objectName').value.trim()||(g?'Folder':G.LABELS[o.type]);if(name===target.name)return;changeScene(()=>{target.name=name;},{keepInputs:true});};
  $('projectName').onchange=$('projectName').onblur=()=>{const name=$('projectName').value.trim()||'Untitled object';if(name===doc.name)return;remember();doc.name=name;changed({keepInputs:true});};
  $('newFolder').onclick=()=>makeFolder(true);$('groupSelection').onclick=()=>makeFolder(false);$('ungroupSelection').onclick=ungroupSelection;$('applyTransform').onclick=applyNumericTransform;$('flipHorizontal').onclick=()=>flipSelection('x');$('flipVertical').onclick=()=>flipSelection('y');
  $('drawTarget').onchange=()=>{activeGroup=$('drawTarget').value||null;selectionIds=[];selectedGroup=null;selection=null;updateUI();render();};
  $('moveToFolder').onchange=()=>{const destination=$('moveToFolder').value;if(destination==='__choose__')return;changeScene(()=>{S.assignObjects(doc,selectionIds,destination||null);selectedGroup=null;activeGroup=destination||null;});};
  const rootDrop=$('rootDropZone');rootDrop.ondragover=e=>{if(dragLayer){e.preventDefault();rootDrop.classList.add('drag-over');}};rootDrop.ondragleave=()=>rootDrop.classList.remove('drag-over');rootDrop.ondrop=e=>{e.preventDefault();rootDrop.classList.remove('drag-over');if(!dragLayer)return;const payload=dragLayer;dragLayer=null;changeScene(()=>{if(payload.kind==='group'){if(S.group(doc,payload.id).locked)throw new Error('Unlock the folder first.');return S.reorderRoot(doc,payload.id,null);}const ids=selectionIds.includes(payload.id)?selectionIds:[payload.id];S.assignObjects(doc,ids,null);activeGroup=null;selectedGroup=null;});};

  $('saveProject').onclick=saveProject;$('openProject').onclick=()=>{if(draft){toast('Finish or cancel your current object before opening a project.');return;}$('projectFile').click();};$('projectFile').onchange=e=>openProject(e.target.files[0]);
  $('newProject').onclick=()=>doc.objects.length||doc.groups.length||draft?$('confirmDialog').showModal():clearProject();$('confirmNew').onclick=clearProject;$('cancelNew').onclick=()=>$('confirmDialog').close();$('saveAndNew').onclick=()=>{if(saveProject())clearProject();};
  $('openExport').onclick=openExport;$('exportLink').onclick=openExport;$('helpButton').onclick=()=>$('helpDialog').showModal();document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('exportScope').onchange=refreshExport;
  document.querySelectorAll('[data-format]').forEach(b=>b.onclick=()=>{format=b.dataset.format;refreshExport();});$('downloadExport').onclick=()=>{const exported=exportDocument();download(G.exportCode(exported,format),safeFileName(exported.name)+({cpp:'.cpp',js:'.js',json:'.vertices.json'}[format]),format==='json'?'application/json':'text/plain');toast(format==='cpp'?'OpenGL viewer source downloaded.':'Vertex array downloaded.');};
  $('copyExport').onclick=async()=>{try{await navigator.clipboard.writeText($('exportPreview').textContent);toast('Vertex array copied.');}catch(e){const s=getSelection(),r=document.createRange();r.selectNodeContents($('exportPreview'));s.removeAllRanges();s.addRange(r);toast('Code selected. Press Ctrl+C to copy.');}};
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;const typing=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);if(typing)return;
    if(drag){if(e.key==='Escape'){e.preventDefault();cancelActiveDrag();}return;}
    const mod=e.ctrlKey||e.metaKey,key=e.key.toLowerCase();if(mod){if(key==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if(key==='y'){e.preventDefault();redo();}else if(key==='s'){e.preventDefault();saveProject();}else if(key==='d'){e.preventDefault();duplicate();}else if(key==='g'){e.preventDefault();e.shiftKey?ungroupSelection():selectionIds.length&&makeFolder(false);}else if(key==='a'){e.preventDefault();if(!draft)setSelection(doc.objects.filter(o=>S.isVisible(doc,o)&&!S.isLocked(doc,o)).map(o=>o.id));}return;}
    if(e.code==='Space'){e.preventDefault();space=true;viewport.style.cursor='grab';return;}
    if(key==='escape'){if(draft)cancelDrawing();else if(tool==='insert')setTool('select');else select(null);}else if(key==='enter'&&draft){e.preventDefault();finishDrawing();}else if(key==='backspace'&&draft){e.preventDefault();draft.vertices.pop();updateDraft();render();}else if(key==='delete'||key==='backspace'){e.preventDefault();deleteObject();}else if(key==='v')setTool('select');else if(key==='t')setTool('transform');else if(key==='i')setTool('insert');else if(key==='p')startDrawing();else if(key==='h')setTool('pan');else if(key==='f')fit();else if(key==='?')$('helpDialog').showModal();else if(key==='+'||key==='=')zoom(1.4);else if(key==='-')zoom(1/1.4);
  });document.addEventListener('keyup',e=>{if(e.code==='Space'){space=false;viewport.style.cursor=tool==='pan'?'grab':tool==='draw'?'crosshair':'default';}});window.addEventListener('blur',()=>{space=false;endDrag();});
  window.addEventListener('beforeunload',e=>{if(dirty)autosave();if((!storageAvailable&&(doc.objects.length||doc.groups.length))||draft?.vertices.length){e.preventDefault();e.returnValue='';}});
  new ResizeObserver(()=>{resize();positionWheelMarker();}).observe(viewport);
  syncColor();updateUI();
})();
