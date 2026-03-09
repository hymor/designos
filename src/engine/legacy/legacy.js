// Architecture: frames use translate(x,y) transform so children (relative coords) follow automatically.

import { S, dom } from '../core/state.js';
import { ns, clamp, deep, uid, movePt, toast, svgPt, snapV, snapPt } from '../utils/utils.js';
import { createUndo } from '../history/undo.js';
import { createSmartGuides } from '../interaction/smartGuides.js';
import { createFrameTree } from '../layout/frameTree.js';
import { createSnapGrid } from '../interaction/snapGrid.js';
import { createGradients } from '../render/gradients.js';
import { pathTightBBox } from '../geometry/geometry.js';
import { PRESETS, TOOLS } from '../core/constants.js';
import * as tableModule from '../table/table.js';

// use dom.* at runtime so setHostContext() from bootstrap works (no destructure)

// ── UTILS (from state/utils) ──
function absPos(el){
  if(el.frameId){var f=S.frames.find(function(f){return f.id===el.frameId});if(f){var fp=absPos(f);return{x:fp.x+el.x,y:fp.y+el.y};}}
  if(el.tableCell){var tab=S.els.find(function(e){return e.id===el.tableCell.tableId})||S.frames.find(function(f){return f.id===el.tableCell.tableId});if(tab){var tp=absPos(tab);return{x:tp.x+el.x,y:tp.y+el.y};}}
  return{x:el.x,y:el.y};
}
function measureText(el){
  var txt=el.text||' ';
  var fs=el.fs||18,fw=el.fw||'400',ff=el.fontFamily||'system-ui,sans-serif';
  var lineH=fs*(el.lineHeight!=null&&el.lineHeight!==''?+el.lineHeight:1.2);
  var lines=txt.split('\n');
  var m=ns('text');m.id='_textMeasure';m.setAttribute('visibility','hidden');m.setAttribute('x',0);m.setAttribute('y',fs);
  m.setAttribute('font-size',fs);m.setAttribute('font-weight',fw);m.setAttribute('font-family',ff);
  m.setAttribute('font-style',el.fontStyle||'normal');
  if(el.letterSpacing!=null&&el.letterSpacing!=='')m.style.letterSpacing=(typeof el.letterSpacing==='number'?el.letterSpacing:parseFloat(el.letterSpacing))+'px';
  else m.style.letterSpacing='';
  lines.forEach(function(line,idx){
    var tspan=ns('tspan');
    tspan.setAttribute('x',0);
    tspan.setAttribute('y',fs+idx*lineH);
    tspan.textContent=line||' ';
    m.appendChild(tspan);
  });
  dom.defsEl.appendChild(m);
  var b=m.getBBox();
  if(m.parentNode)m.parentNode.removeChild(m);
  return{w:Math.max(1,b.width),h:Math.max(lineH,lines.length*lineH)};
}
function getBBox(item){
  if(item.type==='group') return getGroupBBox(item);
  if(item.type==='table'){ var bb=tableModule.getTableBBox(item); var ab=absPos(item); return{x:ab.x,y:ab.y,w:bb.w,h:bb.h}; }
  if(item.type==='text'){
    var ab=absPos(item);
    var m=measureText(item);
    return{x:ab.x,y:ab.y,w:item.w||m.w||1,h:item.h||m.h||1};
  }
  if(item.type==='path'&&item.pts&&item.pts.length){
    var closed=item.d&&item.d.endsWith('Z');
    var b=pathTightBBox(item.pts,closed);
    var px=b.minX,py=b.minY,pw=b.maxX-b.minX||1,ph=b.maxY-b.minY||1;
    if(item.frameId){
      var pff=S.frames.find(function(f){return f.id===item.frameId;});
      if(pff){var pffa=absPos(pff);return{x:pffa.x+px,y:pffa.y+py,w:pw,h:ph};}
    }
    return{x:px,y:py,w:pw,h:ph};
  }
  var ab=absPos(item);
  var w=item.w||0,h=item.h||0;
  if(item.type==='line'){return{x:ab.x+Math.min(0,w),y:ab.y+Math.min(0,h),w:Math.abs(w),h:Math.abs(h)};}
  if(!item.rotation)return{x:ab.x,y:ab.y,w:w,h:h};
  var rad=item.rotation*Math.PI/180;
  var cx=ab.x+w/2,cy=ab.y+h/2,hw=w/2,hh=h/2;
  var cos=Math.abs(Math.cos(rad)),sin=Math.abs(Math.sin(rad));
  var rw=hw*cos+hh*sin,rh=hw*sin+hh*cos;
  return{x:cx-rw,y:cy-rh,w:rw*2,h:rh*2};
}
function applyTr(){
  var t='translate('+S.px+','+S.py+') scale('+S.zoom+')';
  dom.framesG.setAttribute('transform',t); dom.elsLoose.setAttribute('transform',t);
  dom.selOv.setAttribute('transform',t); dom.sgG.setAttribute('transform',t);
 dom.ghost.setAttribute('transform',t); dom.ghostEllipse.setAttribute('transform',t); dom.ghostLine.setAttribute('transform',t); dom.fghost.setAttribute('transform',t);
  var zoomVal=document.getElementById('zoom-val');if(zoomVal)zoomVal.textContent=Math.round(S.zoom*100)+'%';
  drawSnapGrid();
}

// ── UNDO / REDO ──
function applyHistSnap(idx){
  var d=JSON.parse(S.history[idx]);
  dom.framesG.innerHTML=''; dom.elsLoose.innerHTML=''; dom.selOv.innerHTML=''; dom.defsEl.innerHTML=''; dom.sgG.innerHTML='';
  S.frames=d.frames; S.els=d.els; S.nid=d.nid; S.components=d.components||[]; S.selId=null; S.selIds=[];
  if(S.rootOrder!==undefined)delete S.rootOrder;
  rerenderAll();
  refreshLayers(); refreshProps(); refreshCompPanel();
}
var _undoApi=createUndo(S,dom,{applyHistSnap,toast});
function snapshot(){_undoApi.snapshot();scheduleAutoSave();}
var refreshUndoUI=_undoApi.refreshUndoUI,undo=_undoApi.undo,redo=_undoApi.redo;

// ── SMART GUIDES ──
var _sg=createSmartGuides({getBBox,ns});
var applySmartGuides=_sg.applySmartGuides,clearGuides=_sg.clearGuides;

// ── FRAME TREE (find/remove) ──
var _ft=createFrameTree(S);
var findFrame=_ft.findFrame,findEl=_ft.findEl,isFrameId=_ft.isFrameId,isElId=_ft.isElId;
var removeDomForItem=_ft.removeDomForItem,removeSubtreeOfFrame=_ft.removeSubtreeOfFrame;

var _snapGrid=createSnapGrid({toast});
var drawSnapGrid=_snapGrid.drawSnapGrid;

var _grad=createGradients({ns});
var buildGradDef=_grad.buildGradDef,defGrad=_grad.defGrad,hexToRgba=_grad.hexToRgba,gradCSS=_grad.gradCSS;

function cloneFrameTree(masterFrame, newAbsX, newAbsY, parentFrameId, componentSourceId){
  // Create frame instance (root or nested)
  const nf = deep(masterFrame);
  const newId = uid();

  nf.id = newId;
  nf.type = 'frame';
  nf.isInstance = true;
  nf.componentId = componentSourceId;
  delete nf.isComponent; // instances are not masters

  // parent relation + local coords
  nf.frameId = parentFrameId || null;
  if(parentFrameId){
    const p = findFrame(parentFrameId);
    const pAbs = p ? absPos(p) : {x:0,y:0};
    nf.x = newAbsX - pAbs.x;
    nf.y = newAbsY - pAbs.y;
  }else{
    nf.x = newAbsX;
    nf.y = newAbsY;
  }

  const masterAbs = absPos(masterFrame);
  nf.children = [];

  // Register frame first so absPos/find works for nested children
  S.frames.push(nf);

  // Clone children recursively
  (masterFrame.children || []).forEach(cid=>{
    if(isFrameId(cid)){
      const mf = findFrame(cid);
      if(!mf) return;
      const childAbs = absPos(mf);
      const dx = childAbs.x - masterAbs.x;
      const dy = childAbs.y - masterAbs.y;
      const newChildAbsX = newAbsX + dx;
      const newChildAbsY = newAbsY + dy;
      const childInst = cloneFrameTree(mf, newChildAbsX, newChildAbsY, nf.id, componentSourceId);
      nf.children.push(childInst.id);
    } else if(isElId(cid)){
      const me = findEl(cid);
      if(!me) return;
      const ne = deep(me);
      ne.id = uid();
      ne.frameId = nf.id;
      ne.isInstance = true;
      ne.componentId = componentSourceId;
      delete ne.isComponent;
      // локальные координаты сохраняем (они уже relative к masterFrame)
      S.els.push(ne);
      nf.children.push(ne.id);
    }
  });

  return nf;
}
// ── COMPONENTS ──
function makeComponent(){
  var id=S.selId;if(!id){toast('Select a frame or element first');return;}
  var fr=S.frames.find(function(f){return f.id===id});
  var el=S.els.find(function(e){return e.id===id});
  var src=fr||el;if(!src){toast('Nothing selected');return;}
  // Check if already a component master
  if(src.isComponent){toast('Already a component');return;}
  // Mark the source
  src.isComponent=true;
  src.componentId=src.id;
  var name=(src.name||'Component').replace(/ copy$/,'');
  src.name=name;
  // Register in components registry
  S.components.push({id:uid(),name:name,sourceId:src.id});
  if(fr)renderFrame(fr);else renderEl(el);
  refreshLayers();refreshCompPanel();refreshProps();snapshot();
  toast('✦ Component created: '+name);
  showTab('comps');
}
function instantiateComponent(comp){
  const src = S.frames.find(f=>f.id===comp.sourceId) || S.els.find(e=>e.id===comp.sourceId);
  if(!src){ toast('Source not found'); return; }

  const r = dom.canvas.getBoundingClientRect();
  const cx = (r.width/2 - S.px)/S.zoom + 40;
  const cy = (r.height/2 - S.py)/S.zoom + 40;

  if(src.type === 'frame'){
    // clone full subtree (frames + els)
    const instFrame = cloneFrameTree(src, cx, cy, null, comp.sourceId);
    instFrame.name = comp.name + ' (instance)';

    renderFrame(instFrame);
    selectEl(instFrame.id);
  } else {
    const nd = deep(src);
    nd.id = uid();
    nd.x = cx; nd.y = cy;
    nd.isInstance = true;
    nd.componentId = comp.sourceId;
    nd.name = comp.name + ' (instance)';
    delete nd.isComponent;
    delete nd.frameId; // place as loose
    S.els.push(nd);
    renderElInto(nd, dom.elsLoose);
    selectEl(nd.id);
  }

  setTool('select');
  refreshLayers();
  refreshCompPanel();
  snapshot();
  toast('⬡ Instance placed');
}
function syncInstances(sourceId){

 
  const src = S.frames.find(f=>f.id===sourceId) || S.els.find(e=>e.id===sourceId);
  if(!src) return;

  const instances = [].concat(S.frames, S.els).filter(item => item.isInstance && item.componentId === sourceId);

  instances.forEach(inst=>{
    if(src.type === 'frame'){
      if(inst.type !== 'frame') return;

      // 1) wipe existing subtree (children objects)
      removeSubtreeOfFrame(inst);

      // 2) sync frame props but preserve identity/placement
      const keep = { id: inst.id, x: inst.x, y: inst.y, frameId: inst.frameId, name: inst.name };
      const fresh = deep(src);

      Object.assign(inst, fresh);

      inst.id = keep.id;
      inst.x = keep.x; inst.y = keep.y;
      inst.frameId = keep.frameId;
      inst.name = keep.name;
      inst.isInstance = true;
      inst.componentId = sourceId;
      delete inst.isComponent;

      inst.children = [];

      // 3) rebuild children subtree from master into existing inst frame
      const instAbs = absPos(inst);
      const masterAbs = absPos(src);

      (src.children||[]).forEach(cid=>{
        if(isFrameId(cid)){
          const mf = findFrame(cid);
          if(!mf) return;
          const childAbs = absPos(mf);
          const dx = childAbs.x - masterAbs.x;
          const dy = childAbs.y - masterAbs.y;
          const childInst = cloneFrameTree(mf, instAbs.x + dx, instAbs.y + dy, inst.id, sourceId);
          inst.children.push(childInst.id);
        } else if(isElId(cid)){
          const me = findEl(cid);
          if(!me) return;
          const ne = deep(me);
          ne.id = uid();
          ne.frameId = inst.id;
          ne.isInstance = true;
          ne.componentId = sourceId;
          delete ne.isComponent;
          S.els.push(ne);
          inst.children.push(ne.id);
        }
      });

      // 4) rerender root frame (it will render nested)
      renderFrame(inst);

    } else {
      // element instance: safe sync (no children references)
      if(inst.type === 'frame') return;

      const keep = { id: inst.id, x: inst.x, y: inst.y, frameId: inst.frameId, name: inst.name };
      const fresh = deep(src);

      Object.assign(inst, fresh);

      inst.id = keep.id;
      inst.x = keep.x; inst.y = keep.y;
      inst.frameId = keep.frameId;
      inst.name = keep.name;
      inst.isInstance = true;
      inst.componentId = sourceId;
      delete inst.isComponent;

      if(inst.frameId){
        const fc = getFCG(inst.frameId);
        if(fc) renderElInto(inst, fc);
      } else {
        renderElInto(inst, dom.elsLoose);
      }
    }
  });

  if(instances.length) toast('Synced '+instances.length+' instance'+(instances.length>1?'s':''));
  refreshLayers();
  refreshProps();
  snapshot();
}
function detachInstance(){
  var id=S.selId;if(!id)return;
  var item=S.frames.find(function(f){return f.id===id})||S.els.find(function(e){return e.id===id});
  if(!item||!item.isInstance){toast('Not an instance');return;}
  delete item.isInstance;delete item.componentId;item.name=item.name.replace(' (instance)','');
  if(item.type==='frame')renderFrame(item);else renderEl(item);
  refreshLayers();refreshProps();snapshot();toast('Detached from component');
}
function refreshCompPanel(){
  var cl=document.getElementById('comp-list');if(!cl)return;
  if(!S.components.length){cl.innerHTML='<div style="padding:0 14px;font-size:11px;color:var(--text3)">No components yet.</div>';return;}
  var h='';
  S.components.forEach(function(comp){
    var src=S.frames.find(function(f){return f.id===comp.sourceId})||S.els.find(function(e){return e.id===comp.sourceId});
    var exists=!!src;
    h+='<div class="comp-list-item" data-cid="'+comp.id+'" title="Click to place instance">';
    h+='<span>✦ '+comp.name+'</span>';
    if(exists)h+='<button class="inst-btn" onclick="event.stopPropagation();instantiateComp(\''+comp.id+'\')">Place</button>';
    else h+='<span style="font-size:10px;color:var(--text3)">deleted</span>';
    h+='</div>';
  });
  cl.innerHTML=h;
}
window.instantiateComp=function(compId){
  var comp=S.components.find(function(c){return c.id===compId});if(comp)instantiateComponent(comp);
};
function showTab(tab){
  document.getElementById('layers-tab').style.display=tab==='layers'?'flex':'none';
  document.getElementById('comps-tab').style.display=tab==='comps'?'block':'none';
  document.getElementById('tab-layers').classList.toggle('on',tab==='layers');
  document.getElementById('tab-comps').classList.toggle('on',tab==='comps');
}


// ── REPARENTING ──
var dropTargetId=null;
function setDropTarget(fid){
  if(dropTargetId===fid)return;
  // Clear old highlight
  if(dropTargetId){
    var oldFg=document.getElementById('fg'+dropTargetId);
    if(oldFg){var oldBg=oldFg.querySelector('rect');if(oldBg)oldBg.removeAttribute('data-drop');}
  }
  dropTargetId=fid;
  if(fid){
    var newFg=document.getElementById('fg'+fid);
    if(newFg){var newBg=newFg.querySelector('rect');if(newBg)newBg.setAttribute('data-drop','1');}
  }
}
function moveGroupToFrameSpace(grp, targetFrameId){
  // targetFrameId: id фрейма или null (в loose)
  var targetFr = targetFrameId ? S.frames.find(f=>f.id===targetFrameId) : null;
  var targetAbs = targetFr ? absPos(targetFr) : {x:0,y:0};

  function rec(g){
    g.frameId = targetFrameId || null;

    g.children.forEach(function(cid){
      var item = findAny(cid); if(!item) return;

      // берём АБСОЛЮТ до смены frameId
      var ab = absPos(item);

      // меняем контейнер
      item.frameId = targetFrameId || null;

      // переводим в локальные координаты нового контейнера
      if(item.type === 'path'){
        var dx2 = targetAbs ? -targetAbs.x : 0;
        var dy2 = targetAbs ? -targetAbs.y : 0;
        movePath(item,dx2,dy2);
      } else {
        item.x = ab.x - targetAbs.x;
        item.y = ab.y - targetAbs.y;
      }

      if(item.type === 'group') rec(item);
    });
  }

  rec(grp);
}
function reparentEl(el,newFrameId){
  var oldFrameId=el.frameId;
  if(oldFrameId===newFrameId)return;

  var isFrameEl=!!S.frames.find(function(f){return f.id===el.id;});
  var isGroupEl=!!S.groups.find(function(g){return g.id===el.id;});

  var ap=absPos(el);
  var ax=ap.x, ay=ap.y;

  // Remove from old DOM
  var oldDomId = isFrameEl ? ('fg'+el.id) : isGroupEl ? ('gg'+el.id) : ('g'+el.id);
  var oldG=document.getElementById(oldDomId); if(oldG) oldG.remove();

  // Remove from old frame children list
  if(oldFrameId){
    var oldFr=S.frames.find(function(f){return f.id===oldFrameId});
    if(oldFr) oldFr.children=oldFr.children.filter(function(c){return c!==el.id});
  }

  // Attach to new parent
  el.frameId=newFrameId||null;
  if(isGroupEl){
    moveGroupToFrameSpace(el, newFrameId || null);
  }
  if(el.type==='path'&&el.pts&&el.pts.length){
    var oldOrig=oldFrameId?(function(){var of=S.frames.find(function(f){return f.id===oldFrameId});return of?absPos(of):{x:0,y:0};})():{x:0,y:0};
    var newOrig=newFrameId?(function(){var nf=S.frames.find(function(f){return f.id===newFrameId});return nf?absPos(nf):{x:0,y:0};})():null;
    function toCanvas(vx,vy){return{x:oldOrig.x+vx,y:oldOrig.y+vy};}
    function toNewLocal(c){if(newOrig)return{x:c.x-newOrig.x,y:c.y-newOrig.y};return{x:c.x,y:c.y};}
    el.pts=el.pts.map(function(p){
      var np=deep(p);
      var c=toNewLocal(toCanvas(p.x,p.y));
      np.x=c.x; np.y=c.y;
      if(np.cx1!=null){var c1=toNewLocal(toCanvas(p.cx1,p.cy1));np.cx1=c1.x;np.cy1=c1.y;}
      if(np.cx2!=null){var c2=toNewLocal(toCanvas(p.cx2,p.cy2));np.cx2=c2.x;np.cy2=c2.y;}
      return np;
    });
    el.d=penPtsToD(el.pts,el.d&&el.d.endsWith('Z'));
    var px=el.pts.map(function(p){return p.x;}), py=el.pts.map(function(p){return p.y;});
    el.x=Math.min.apply(null,px); el.y=Math.min.apply(null,py);
    el.w=Math.max.apply(null,px)-el.x; el.h=Math.max.apply(null,py)-el.y;
  }
  if(newFrameId){
    var newFr=S.frames.find(function(f){return f.id===newFrameId});
    if(newFr){
      newFr.children.push(el.id);
      if(el.type!=='path'){
        var nap=absPos(newFr);
        el.x=ax-nap.x; el.y=ay-nap.y;
      }

      if(isFrameEl) renderFrame(el);
      else if(isGroupEl) renderGroup(el);
      else { var fc=getFCG(newFrameId); if(fc) renderElInto(el,fc); }

      if(getAL(newFr)){ applyAutoLayout(newFr); renderFrame(newFr); }
    }
  } else {
    if(el.type!=='path') el.x=ax; el.y=ay;
    if(isFrameEl) renderFrame(el);
    else if(isGroupEl) renderGroup(el);
    else renderElInto(el,dom.elsLoose);
  }

  if(oldFrameId){
    var oldFrAL=S.frames.find(function(f){return f.id===oldFrameId});
    if(oldFrAL&&getAL(oldFrAL)){ applyAutoLayout(oldFrAL); renderFrame(oldFrAL); }
  }
}

// ── AUTO LAYOUT ENGINE ──
function defaultAL(){
  return{enabled:true,dir:'h',gap:8,padT:12,padR:12,padB:12,padL:12,
         alignCross:'start',wrap:false,hugW:true,hugH:true};
}
function getAL(fr){return fr.autoLayout&&fr.autoLayout.enabled?fr.autoLayout:null;}
function canFreeDragChild(cap){
  if(!cap||!cap.frameId)return true;
  var parentFr=S.frames.find(function(f){return f.id===cap.frameId;});
  if(!parentFr)return true;
  if(getAL(parentFr))return false;
  return true;
}
function canFreeDragGroup(grp){
  if(!grp||!grp.frameId)return true;
  var parentFr=S.frames.find(function(f){return f.id===grp.frameId;});
  if(!parentFr)return true;
  return !getAL(parentFr);
}
function getLineEndpointsAbs(line){
  var x1=line.x,y1=line.y,x2=line.x+(line.w||0),y2=line.y+(line.h||0);
  if(line.frameId){
    var pf=S.frames.find(function(f){return f.id===line.frameId;});
    if(pf){var pa=absPos(pf);return [{x:pa.x+x1,y:pa.y+y1},{x:pa.x+x2,y:pa.y+y2}];}
  }
  return [{x:x1,y:y1},{x:x2,y:y2}];
}

function applyAutoLayout(fr){
  var al=getAL(fr);
  if(!al)return;
  var children=fr.children.map(function(cid){return S.els.find(function(e){return e.id===cid;});}).filter(Boolean);
  if(!children.length){
    if(al.hugW){fr.w=al.padL+al.padR;}
    if(al.hugH){fr.h=al.padT+al.padB;}
    return;
  }
  var isH=al.dir==='h';
  var gap=al.gap||0;
  var padL=al.padL||0,padR=al.padR||0,padT=al.padT||0,padB=al.padB||0;

  if(al.wrap&&isH){
    // Wrap mode: flow children into rows
    var innerW=fr.w-padL-padR;
    var rows=[],row=[],rowW=0;
    children.forEach(function(c){
      var cw=c.w||0;
      if(row.length&&rowW+gap+cw>innerW){rows.push(row);row=[c];rowW=cw;}
      else{if(row.length)rowW+=gap;rowW+=cw;row.push(c);}
    });
    if(row.length)rows.push(row);
    var cy=padT;
    rows.forEach(function(r){
      var rowH=0;r.forEach(function(c){rowH=Math.max(rowH,c.h||0);});
      var cx=padL;
      r.forEach(function(c){
        c.x=cx;
        c.y=cy+(al.alignCross==='center'?(rowH-c.h)/2:al.alignCross==='end'?rowH-c.h:0);
        cx+=c.w+gap;
      });
      cy+=rowH+gap;
    });
    if(al.hugH){fr.h=cy-gap+padB;}
    return;
  }

  // Single-axis layout
  // 1. Measure fill vs fixed children
  var fixedTotal=0,fillCount=0;
  children.forEach(function(c){
    var sz=isH?c.w:c.h;
    var isFill=isH?(c.alFillW):(c.alFillH);
    if(isFill)fillCount++;
    else fixedTotal+=sz;
  });
  var totalGap=gap*(children.length-1);
  var innerMain=isH?fr.w-padL-padR:fr.h-padT-padB;
  var fillSz=fillCount>0?Math.max(0,(innerMain-fixedTotal-totalGap)/fillCount):0;

  // 2. Position children along main axis
  var cursor=isH?padL:padT;
  var innerCross=isH?fr.h-padT-padB:fr.w-padL-padR;
  children.forEach(function(c,i){
    var mainSz=isH?(c.alFillW?fillSz:c.w):(c.alFillH?fillSz:c.h);
    var crossSz=isH?c.h:c.w;
    var isFillCross=isH?c.alFillH:c.alFillW;
    if(isFillCross){crossSz=innerCross;if(isH)c.h=crossSz;else c.w=crossSz;}
    // Assign main size if fill
    if(isH&&c.alFillW){c.w=Math.max(1,mainSz);}
    if(!isH&&c.alFillH){c.h=Math.max(1,mainSz);}
    // Cross axis position
    var crossPos;
    if(al.alignCross==='center')crossPos=(innerCross-crossSz)/2;
    else if(al.alignCross==='end')crossPos=innerCross-crossSz;
    else crossPos=0;
    if(isH){c.x=cursor;c.y=padT+crossPos;}
    else{c.y=cursor;c.x=padL+crossPos;}
    cursor+=mainSz+gap;
  });

  // 3. Hug frame to content
  var contentMain=cursor-gap+(isH?padR:padB);
  if(al.hugW){if(isH)fr.w=Math.max(1,contentMain);else{var maxW=0;children.forEach(function(c){maxW=Math.max(maxW,c.w);});fr.w=maxW+padL+padR;}}
  if(al.hugH){if(!isH)fr.h=Math.max(1,contentMain);else{var maxH=0;children.forEach(function(c){maxH=Math.max(maxH,c.h);});fr.h=maxH+padT+padB;}}
}

function runALAndRender(fr){
  applyAutoLayout(fr);
  renderFrame(fr);
  drawSel();
  refreshProps();
}

function toggleAutoLayout(fr){
  if(!fr.autoLayout||!fr.autoLayout.enabled){
    fr.autoLayout=defaultAL();
    runALAndRender(fr);
    toast('⊞ Auto Layout ON');
  } else {
    fr.autoLayout.enabled=false;
    renderFrame(fr);
    refreshProps();
    toast('Auto Layout OFF');
  }
  snapshot();
}

function wrapInAutoLayout(){
  var ids=S.selIds.length?S.selIds.slice():(S.selId?[S.selId]:[]);
  if(!ids.length){toast('Select objects to wrap in Auto Layout');return;}
  var items=ids.map(findAny).filter(Boolean);
  if(!items.length)return;

  // combined absolute bounding box
  var x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  items.forEach(function(item){
    var bb=getBBox(item);
    x1=Math.min(x1,bb.x);y1=Math.min(y1,bb.y);
    x2=Math.max(x2,bb.x+bb.w);y2=Math.max(y2,bb.y+bb.h);
  });
  if(x1===Infinity)return;

  // create frame with no fill and auto-layout enabled
  var fr={id:uid(),type:'frame',x:x1,y:y1,w:x2-x1,h:y2-y1,
    fill:'none',rx:0,opacity:1,stroke:'none',strokeWidth:0,
    name:'Auto Layout '+(S.nid++),
    children:[],frameId:null,groupId:null,isMask:false,
    autoLayout:defaultAL()};
  S.frames.push(fr);

  items.forEach(function(item){
    var isFr2=S.frames.indexOf(item)>=0&&item!==fr;
    var isGr2=item.type==='group';

    // capture absolute bbox before any mutations
    var bb=getBBox(item);

    // detach from old parent frame
    var oldFrameId=item.frameId;
    if(oldFrameId){
      var oldFr=S.frames.find(function(f){return f.id===oldFrameId;});
      if(oldFr)oldFr.children=oldFr.children.filter(function(c){return c!==item.id;});
    }

    // remove stale DOM
    var domId=(isFr2?'fg':isGr2?'gg':'g')+item.id;
    var oldDom=document.getElementById(domId);if(oldDom)oldDom.remove();

    // attach to new frame
    item.frameId=fr.id;
    fr.children.push(item.id);

    // convert to frame-local coords
    if(item.type==='path'){
      // pts may be absolute (no old frame) or old-frame-local (had frameId)
      var ptsOffX=0,ptsOffY=0;
      if(oldFrameId){
        var olf=S.frames.find(function(f){return f.id===oldFrameId;});
        if(olf){var ola=absPos(olf);ptsOffX=ola.x;ptsOffY=ola.y;}
      }
      item.pts=item.pts.map(function(p){return movePt(p,ptsOffX-x1,ptsOffY-y1);});
      item.d=penPtsToD(item.pts,item.d&&item.d.endsWith('Z'));
    } else if(isGr2){
      moveGroupToFrameSpace(item,fr.id);
    } else {
      item.x=bb.x-x1;
      item.y=bb.y-y1;
    }
  });

  applyAutoLayout(fr);
  renderFrame(fr);
  clearSel();selectEl(fr.id);
  refreshLayers();snapshot();
  toast('Auto Layout ⇄ created');
}

// ── GRADIENT (buildGradDef, defGrad, hexToRgba, gradCSS in gradients.js) ──
function fillVal(el){
  if(el.fillVisible===false)return 'none';
  if(el.fillMode==='linear'||el.fillMode==='radial')return buildGradDef(el)||el.fill;
  return el.fill;
}

// ── TOOLS ──
function setTool(tool){
  if(S.penEditId)exitPenEditMode();
  var prev=S.tool;
  S.tool=tool;
  document.querySelectorAll('.tbtn').forEach(function(b){b.classList.remove('on','frame-on')});
  var b=document.getElementById('t-'+tool);
  if(b){if(tool==='frame')b.classList.add('frame-on');else b.classList.add('on');}
  if(dom.canvas)dom.canvas.style.cursor=tool==='hand'?'grab':tool==='eyedropper'?'crosshair':tool==='select'?'default':'crosshair';
  if(tool!=='select')clearSel();
  if(tool==='image')document.getElementById('img-input').click();
  if(tool!=='eyedropper'&&prev==='eyedropper')edBadgeHide();
}
TOOLS.forEach(function(t){var b=document.getElementById('t-'+t);if(b)b.addEventListener('click',function(){setTool(t)});});
var tEyedropper=document.getElementById('t-eyedropper');if(tEyedropper)tEyedropper.addEventListener('click',function(){
  if(S.tool==='eyedropper')setTool('select');else activateEyedropper();
});

// ── KEYBOARD ──
function isEditingInput(){
  var a=document.activeElement;
  if(!a)return false;
  var tag=(a.tagName||'').toUpperCase();
  if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return true;
  if(a.isContentEditable)return true;
  return false;
}
document.addEventListener('keydown',function(e){
  if(e.target===dom.ted)return;
  if(isEditingInput())return;
  if(e.code==='Space'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&S.tool!=='hand'){
    e.preventDefault();
    S._spacePan=true;
    S._prevTool=S.tool;
    setTool('hand');
    return;
  }
  if((e.key==='g'||e.key==='G')&&!e.ctrlKey&&!e.metaKey){toggleSnap();return;}
  if(e.key==='i'&&!e.ctrlKey&&!e.metaKey){activateEyedropper();return;}
  if((e.key==='a'||e.key==='A')&&e.shiftKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();wrapInAutoLayout();return;}
  if(e.key==='0'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();zoomTo100();return;}
  if(e.key==='1'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();zoomToFitAll();return;}
  var map={v:'select',f:'frame',r:'rect',o:'ellipse',l:'line',t:'text',p:'pen',h:'hand'};
  if(map[e.key]&&!e.ctrlKey&&!e.metaKey)setTool(map[e.key]);
  if(e.code==='Space'){e.preventDefault();return;}
  if(e.key==='Delete'||e.key==='Backspace'){
    if(S.penEditId&&S.penEditSelNodes.length>0){
      e.preventDefault();
      var el=S.els.find(function(e2){return e2.id===S.penEditId});
      if(el&&el.type==='line'){toast('Line has 2 endpoints — drag to edit');return;}
      if(el&&el.pts&&(el.pts.length-S.penEditSelNodes.length)>=2){
        var toRemove=S.penEditSelNodes.slice().sort(function(a,b){return b-a;});
        toRemove.forEach(function(idx){el.pts.splice(idx,1);});
        var isClosed=el.d&&el.d.endsWith('Z');
        el.d=penPtsToD(el.pts,isClosed);
        renderEl(el);S.penEditSelNode=-1;S.penEditSelNodes=[];drawPenEditNodes();snapshot();
      } else {toast('Path needs at least 2 nodes');}
    } else if(S.selId||S.selIds.length){e.preventDefault();delSel();}
  }
  if(e.key==='Escape'){
    var spm=document.getElementById('svg-paste-modal');
    if(spm&&spm.style.display!=='none'){cancelSVGPaste();return;}
    var rm=document.getElementById('recent-modal');
    if(rm&&rm.style.display!=='none'){hideRecent();return;}
    if(S.tool==='eyedropper'){setTool(S._prevTool||'select');return;}
    if(S.penActive){penCommit(false);}else if(S.penEditId){exitPenEditMode();}else{clearSel();commitText();}
  }
  if(e.key==='Enter'&&S.penActive){e.preventDefault();penCommit(true);}
  if(e.ctrlKey||e.metaKey){
    if(e.key==='s'){e.preventDefault();saveProject();}
    if(e.key==='z'&&!e.shiftKey){e.preventDefault();undo();}
    if(e.key==='z'&&e.shiftKey){e.preventDefault();redo();}
    if(e.key==='y'){e.preventDefault();redo();}
    if(e.key==='c'){e.preventDefault();copyItems();}
    if(e.key==='x'){e.preventDefault();cutItems();}
    if(e.key==='v'){if(S.clipboard.length){e.preventDefault();pasteItems();}}
    if(e.key==='d'){e.preventDefault();copyItems();pasteItems();}
    if(e.key==='k'||e.key==='K'){e.preventDefault();makeComponent();}
    if(e.key==='g'||e.key==='G'){e.preventDefault();if(e.shiftKey)ungroupSel();else groupSel();}
    if(e.key==='m'||e.key==='M'){e.preventDefault();makeMask();}
    if(e.key==='['){e.preventDefault();zOrder(e.shiftKey?'bot':'bwd');}
  }
  var nudge=e.shiftKey?10:1;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].indexOf(e.key)>=0){
    e.preventDefault();
    var dx=e.key==='ArrowLeft'?-nudge:e.key==='ArrowRight'?nudge:0;
    var dy=e.key==='ArrowUp'?-nudge:e.key==='ArrowDown'?nudge:0;
    nudgeSel(dx,dy);
  }
});
document.addEventListener('keyup',function(e){
  if(e.target===dom.ted)return;
  if(isEditingInput())return;
  if(e.code==='Space'&&S._spacePan){
    S._spacePan=false;
    if(!S.panning)setTool(S._prevTool||'select');
  }
});
function nudgeSel(dx,dy){
  var ids=S.selIds.length?S.selIds:(S.selId?[S.selId]:[]);
  if(!ids.length)return;
  ids.forEach(function(id){
    var fr=S.frames.find(function(f){return f.id===id});
    var grp=S.groups.find(function(g){return g.id===id});
    var el=S.els.find(function(e){return e.id===id});
    if(fr){fr.x+=dx;fr.y+=dy;renderFrame(fr);}
    else if(grp){
      function nudgeGroup(g2,ddx,ddy){
        g2.children.forEach(function(cid){
          var item=findAny(cid);if(!item)return;
          if(item.type==='group'){item.x=(item.x||0)+ddx;item.y=(item.y||0)+ddy;nudgeGroup(item,ddx,ddy);}
          else if(item.type==='path'){movePath(item,ddx,ddy);}
          else{item.x=(item.x||0)+ddx;item.y=(item.y||0)+ddy;}
        });
      }
      nudgeGroup(grp,dx,dy);
      renderGroup(grp);
    }
    else if(el){
      if(el.type==='path'){movePath(el,dx,dy);}
      else{el.x+=dx;el.y+=dy;}
      renderEl(el);
    }
  });
  drawSel();refreshProps();snapshot();
}

// ── ZOOM / PAN ──
if(dom.canvas)dom.canvas.addEventListener('wheel',function(e){
  e.preventDefault();
  var r=dom.canvas.getBoundingClientRect(),cx=e.clientX-r.left,cy=e.clientY-r.top;
  var f=e.deltaY<0?1.1:0.9,nz=clamp(S.zoom*f,.05,20);
  S.px=cx-(cx-S.px)*(nz/S.zoom); S.py=cy-(cy-S.py)*(nz/S.zoom); S.zoom=nz;
  applyTr(); drawSel(); S.frames.filter(function(f){return !f.frameId;}).forEach(function(f){renderFrame(f);});
},{passive:false});
var zIn=document.getElementById('z-in');if(zIn)zIn.addEventListener('click',function(){adjZ(1.2)});
var zOut=document.getElementById('z-out');if(zOut)zOut.addEventListener('click',function(){adjZ(.8)});
function adjZ(f){
  var r=dom.canvas.getBoundingClientRect(),cx=r.width/2,cy=r.height/2,nz=clamp(S.zoom*f,.05,20);
  S.px=cx-(cx-S.px)*(nz/S.zoom); S.py=cy-(cy-S.py)*(nz/S.zoom); S.zoom=nz;
  applyTr(); drawSel(); S.frames.filter(function(f){return !f.frameId;}).forEach(function(f){renderFrame(f);});
}
function zoomTo100(){
  var r=dom.canvas.getBoundingClientRect();
  S.zoom=1;
  S.px=r.width/2; S.py=r.height/2;
  applyTr(); drawSel(); drawSnapGrid();
  S.frames.filter(function(f){return !f.frameId;}).forEach(function(f){renderFrame(f);});
  toast('100%');
}
function zoomToFitAll(){
  var r=dom.canvas.getBoundingClientRect(),pad=40;
  var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  function addBBox(bb){minX=Math.min(minX,bb.x);minY=Math.min(minY,bb.y);maxX=Math.max(maxX,bb.x+bb.w);maxY=Math.max(maxY,bb.y+bb.h);}
  S.frames.filter(function(f){return !f.frameId;}).forEach(function(f){addBBox(getBBox(f));});
  S.els.filter(function(e){return !e.frameId&&!e.groupId;}).forEach(function(e){addBBox(getBBox(e));});
  S.groups.filter(function(g){return !g.groupId&&!g.frameId;}).forEach(function(g){addBBox(getGroupBBox(g));});
  var w=maxX-minX,h=maxY-minY;
  if(!(w>0&&h>0)){zoomTo100();toast('Fit all');return;}
  var zoomW=(r.width-2*pad)/w,zoomH=(r.height-2*pad)/h;
  S.zoom=clamp(Math.min(zoomW,zoomH),.05,20);
  S.px=r.width/2-S.zoom*(minX+w/2); S.py=r.height/2-S.zoom*(minY+h/2);
  applyTr(); drawSel(); drawSnapGrid();
  S.frames.filter(function(f){return !f.frameId;}).forEach(function(f){renderFrame(f);});
  toast('Fit all');
}

// ── FRAMES ──
function mkFrame(x,y,w,h,name){
  var ax=x,ay=y;
  var parentFr=frameAt(ax+w/2,ay+h/2);
  var pAbs = parentFr ? absPos(parentFr) : null;
  var rx = parentFr ? ax - pAbs.x : ax;
  var ry = parentFr ? ay - pAbs.y : ay;
  var f={id:uid(),type:'frame',x:rx,y:ry,w:w,h:h,fill:'#ffffff',rx:0,opacity:1,
         name:name||('Frame '+(S.nid-1)),children:[],frameId:parentFr?parentFr.id:null};
  S.frames.push(f);
  if(parentFr)parentFr.children.push(f.id);
  renderFrame(f); refreshLayers(); return f;
}
function getFCG(fid){return document.getElementById('fc'+fid)}

function rerenderAll(){
  dom.framesG.innerHTML = '';
  dom.elsLoose.innerHTML = '';
  dom.selOv.innerHTML = '';
  dom.sgG.innerHTML = '';
  S.frames
    .filter(function(f){ return !f.frameId && !f.groupId; })
    .forEach(function(f){ renderFrame(f); });
  renderLooseWithMasks();
}
function renderLooseWithMasks(){
  renderChildrenWithMasks(getRootLooseChildIds(), dom.elsLoose, null, null);
}
function getRootChildIds(){
  var ids = [];
  S.frames
    .filter(function(f){ return !f.frameId && !f.groupId; })
    .forEach(function(f){ ids.push(f.id); });
  S.groups
    .filter(function(g){ return !g.frameId && !g.groupId; })
    .forEach(function(g){ ids.push(g.id); });
  S.els
    .filter(function(e){ return !e.frameId && !e.groupId && !e.tableCell; })
    .forEach(function(e){ ids.push(e.id); });
  return ids;
}
function getRootLooseChildIds(){
  var ids = [];
  S.groups
    .filter(function(g){ return !g.frameId && !g.groupId; })
    .forEach(function(g){ ids.push(g.id); });
  S.els
    .filter(function(e){ return !e.frameId && !e.groupId && !e.tableCell; })
    .forEach(function(e){ ids.push(e.id); });
  return ids;
}

function buildClipShapeForItem(item){
  var s = null;
  if(item.type === 'rect'){
    var x = item.x, y = item.y, w = item.w || 0, h = item.h || 0;
    if(w < 0){ x += w; w = -w; }
    if(h < 0){ y += h; h = -h; }
    w = Math.max(1, w);
    h = Math.max(1, h);
    s = ns('rect');
    s.setAttribute('x', x);
    s.setAttribute('y', y);
    s.setAttribute('width', w);
    s.setAttribute('height', h);
    s.setAttribute('rx', Math.min(item.rx || 0, w / 2, h / 2));
    return s;
  }
  if(item.type === 'ellipse'){
    var x = item.x, y = item.y, w = item.w || 0, h = item.h || 0;
    if(w < 0){ x += w; w = -w; }
    if(h < 0){ y += h; h = -h; }
    var rx = Math.max(0.5, Math.abs(w / 2));
    var ry = Math.max(0.5, Math.abs(h / 2));
    s = ns('ellipse');
    s.setAttribute('cx', x + w / 2);
    s.setAttribute('cy', y + h / 2);
    s.setAttribute('rx', rx);
    s.setAttribute('ry', ry);
    return s;
  }
  if(item.type === 'path'){
    s = ns('path');
    s.setAttribute('d', item.d || '');
    return s;
  }
  return null;
}
function ensureClipForItem(item){
  var clipId = 'layerMaskClip-' + item.id;
  var old = document.getElementById(clipId);
  if(old) old.remove();
  var cp = ns('clipPath');
  cp.id = clipId;
  cp.setAttribute('clipPathUnits', 'userSpaceOnUse');
  var shape = buildClipShapeForItem(item);
  if(shape) cp.appendChild(shape);
  dom.defsEl.appendChild(cp);
  return clipId;
}
function renderItemIntoContainer(item, parentNode){
  if(!item) return;
  if(item.type === 'group'){
    renderGroup(item);
    var gg = document.getElementById('gg' + item.id);
    if(gg) parentNode.appendChild(gg);
    return;
  }
  if(item.type === 'frame'){
    renderFrame(item);
    var fg = document.getElementById('fg' + item.id);
    if(fg) parentNode.appendChild(fg);
    return;
  }
  if(item.type === 'table'){
    tableModule.renderTable(item, parentNode, {
      ns: ns,
      findAny: findAny,
      renderElInto: function(el, pg, inGroup){ renderElInto(el, pg, inGroup); },
      onTableHit: onTableHit,
      openTed: openTed
    });
    return;
  }
  renderElInto(item, parentNode, false);
}
function onTableHit(e, tableEl){
  if(S.tool!=='select')return;
  e.stopPropagation();
  var add=e.shiftKey||e.ctrlKey||e.metaKey;
  if(!add&&tableEl.frameId&&getActiveFrameId()!==tableEl.frameId){ selectEl(tableEl.frameId); return; }
  var wasMulti=(S.selIds&&S.selIds.length>1&&isSelected(tableEl.id)&&!add);
  var preSelIds=wasMulti?S.selIds.slice():null;
  if(!wasMulti) selectEl(tableEl.id, add);
  var pt=svgPt(e);
  if(e.altKey){ var ids=preSelIds?preSelIds:[tableEl.id]; var newIds=duplicateIds(ids); startMultiDrag(newIds, newIds[newIds.length-1], pt); return; }
  if(preSelIds){ startMultiDrag(preSelIds, tableEl.id, pt); return; }
  if(!add){
    var bb=tableModule.getTableBBox(tableEl);
    S.dragging=true; S.dragEl=tableEl;
    var baseTx=0, baseTy=0;
    if(tableEl.frameId){
      var pf=S.frames.find(function(f){ return f.id===tableEl.frameId; });
      if(pf){ var pab=absPos(pf); baseTx=-pab.x; baseTy=-pab.y; }
    }
    S.dragS={ mx: pt.x, my: pt.y, ox: bb.x, oy: bb.y, baseTx: baseTx, baseTy: baseTy, rx: tableEl.x, ry: tableEl.y };
  }
}
function renderChildrenWithMasks(childIds, parentNode, ownerFrameId, ownerGroupId){
  var activeClipId = null;
  var activeMaskedWrap = null;
  childIds.forEach(function(cid){
    var item = findAny(cid);
    if(!item) return;
    if(item.isMask && canBeMaskSource(item) && buildClipShapeForItem(item)){
      activeClipId = ensureClipForItem(item);
      activeMaskedWrap = ns('g');
      activeMaskedWrap.id = 'maskWrap-' + item.id;
      activeMaskedWrap.setAttribute('clip-path', 'url(#' + activeClipId + ')');
      parentNode.appendChild(activeMaskedWrap);
      renderItemIntoContainer(item, parentNode);
      var maskDom = parentNode.lastChild;
      if(maskDom){
        maskDom.setAttribute('data-mask-source', '1');
        maskDom.setAttribute('opacity', '0');
        maskDom.setAttribute('pointer-events', 'none');
      }
      return;
    }
    if(activeMaskedWrap){
      renderItemIntoContainer(item, activeMaskedWrap);
    } else {
      renderItemIntoContainer(item, parentNode);
    }
  });
}

function _buildFrameSVG(fr){
  var old=document.getElementById('fg'+fr.id);if(old)old.remove();
  var cpId='clip'+fr.id;var ocp=document.getElementById(cpId);if(ocp)ocp.remove();
  var cp=ns('clipPath');cp.id=cpId;
  var cpr=ns('rect');cpr.setAttribute('x','0');cpr.setAttribute('y','0');cpr.setAttribute('width',fr.w);cpr.setAttribute('height',fr.h);
  cp.appendChild(cpr);dom.defsEl.appendChild(cp);
  var fg=ns('g');fg.id='fg'+fr.id;
  var tx=fr.x,ty=fr.y;
  if(fr.rotation){
    fg.setAttribute('transform','translate('+tx+','+ty+') rotate('+fr.rotation+','+fr.w/2+','+fr.h/2+')');
  } else {
    fg.setAttribute('transform','translate('+tx+','+ty+')');
  }
  if(fr.opacity!=null&&fr.opacity<1)fg.setAttribute('opacity',fr.opacity);
  var strokeColor=fr.isComponent?'#f7c948':fr.isInstance?'#c4a0f7':'#3ecf8e';
  var alLabel=getAL(fr)?(getAL(fr).dir==='h'?' ⇄':' ⇅'):'';
  var headerH=24/S.zoom;
  var headerHit=ns('rect');
  headerHit.setAttribute('x',0);headerHit.setAttribute('y',-headerH);
  headerHit.setAttribute('width',Math.max(fr.w,1));headerHit.setAttribute('height',headerH);
  headerHit.setAttribute('fill','transparent');headerHit.setAttribute('stroke','none');
  headerHit.style.cursor='move';
  fg.appendChild(headerHit);
  var lblG=ns('g');lblG.setAttribute('pointer-events','none');
  var lbl=ns('text');lbl.setAttribute('x',0);lbl.setAttribute('y',-6/S.zoom);
  lbl.setAttribute('font-size',11/S.zoom);lbl.setAttribute('fill',strokeColor);lbl.setAttribute('font-family','system-ui,sans-serif');
  lbl.textContent=(fr.isComponent?'✦ ':fr.isInstance?'⬡ ':'')+fr.name+alLabel;
  lblG.appendChild(lbl);
  var hint=ns('text');hint.setAttribute('x',fr.w);hint.setAttribute('y',-6/S.zoom);
  hint.setAttribute('font-size',10/S.zoom);hint.setAttribute('fill','#4a4a52');hint.setAttribute('text-anchor','end');hint.setAttribute('font-family','system-ui,sans-serif');
  hint.textContent=Math.round(fr.w)+'×'+Math.round(fr.h);lblG.appendChild(hint);
  fg.appendChild(lblG);
  var bg=ns('rect');bg.setAttribute('x',0);bg.setAttribute('y',0);bg.setAttribute('width',fr.w);bg.setAttribute('height',fr.h);
  bg.setAttribute('fill',fr.fill);bg.setAttribute('rx',fr.rx||0);
  bg.setAttribute('stroke','none');
  fg.appendChild(bg);
  var fc=ns('g');fc.id='fc'+fr.id;fc.setAttribute('clip-path','url(#clip'+fr.id+')');
  fg.appendChild(fc);
  renderChildrenWithMasks(fr.children || [], fc, fr.id, null);
  function frameSurfaceMousedown(cap,e){
    if(S.tool!=='select')return;
    e.stopPropagation();
    var add=e.shiftKey||e.ctrlKey||e.metaKey;
    if(!add&&cap.frameId&&getActiveFrameId()!==cap.frameId){selectEl(cap.frameId);return;}
    var wasMulti=(S.selIds&&S.selIds.length>1&&isSelected(cap.id)&&!add);
    var preSelIds=wasMulti?S.selIds.slice():null;
    if(!wasMulti){selectEl(cap.id,add);}
    var pt=svgPt(e);
    if(e.altKey){var ids=preSelIds?preSelIds:[cap.id];var newIds=duplicateIds(ids);startMultiDrag(newIds,newIds[newIds.length-1],pt);return;}
    if(preSelIds){startMultiDrag(preSelIds,cap.id,pt);return;}
    if(!add){startFrameDrag(cap,pt);}
  }
  (function(cap){
    headerHit.addEventListener('mousedown',function(e){frameSurfaceMousedown(cap,e);});
    bg.addEventListener('mousedown',function(e){frameSurfaceMousedown(cap,e);});
  })(fr);
  return fg;
}

function startFrameDrag(fr, pt){
  if(fr.locked===true)return;
  S.dragging=true;
  S.dragEl=fr;
  S.dragS={mx:pt.x,my:pt.y,ox:fr.x,oy:fr.y};
}

function renderFrame(fr){
  var oldFg=document.getElementById('fg'+fr.id);
  var anchorFg=oldFg?oldFg.nextSibling:null;
  var anchorParent=oldFg?oldFg.parentNode:null;
  var fg=_buildFrameSVG(fr);
  if(!fg)return ;
  if(fr.frameId){
    var parentFc=getFCG(fr.frameId);
    if(parentFc){
      if(anchorParent===parentFc&&anchorFg)parentFc.insertBefore(fg,anchorFg);
      else parentFc.appendChild(fg);
      return;
    }
  }
  if(anchorParent===dom.framesG&&anchorFg)dom.framesG.insertBefore(fg,anchorFg);
  else dom.framesG.appendChild(fg);
}

function frameAt(ax,ay){
  // Return innermost frame at point (supports nesting)
  var best=null;
  S.frames.forEach(function(f){
    var ab=f.frameId?absPos(f):{x:f.x,y:f.y};
    if(ax>=ab.x&&ax<=ab.x+f.w&&ay>=ab.y&&ay<=ab.y+f.h){
      if(!best){best=f;return;}
      // Prefer deeper/smaller frame
      var ba=best.frameId?absPos(best):{x:best.x,y:best.y};
      if(f.w*f.h<best.w*best.h)best=f;
    }
  });
  return best;
}


var ICONS={frame:'⬚',rect:'▭',ellipse:'◯',line:'╱',text:'T',table:'▦',image:'🖼',path:'✏',group:'⊞'};
function convertRectToPath(r){
  if(!r||r.type!=='rect')return;
  var x=r.x,y=r.y,w=Math.max(1,r.w||0),h=Math.max(1,r.h||0);
  var pts=[
    {x:x,y:y,type:'corner'},
    {x:x+w,y:y,type:'corner'},
    {x:x+w,y:y+h,type:'corner'},
    {x:x,y:y+h,type:'corner'}
  ];
  var d=penPtsToD(pts,true);
  var pathEl={
    id:uid(),
    type:'path',
    pts:pts,
    d:d,
    fill:r.fill!==undefined?r.fill:S.defFill,
    stroke:r.stroke!==undefined?r.stroke:'none',
    strokeWidth:r.strokeWidth||0,
    strokeAlign:r.strokeAlign||'center',
    opacity:r.opacity!==undefined?r.opacity:1,
    frameId:r.frameId||null,
    name:(r.name||'Rectangle')+' (path)',
    rotation:r.rotation||0
  };
  var idx=S.els.indexOf(r);
  if(idx>=0)S.els.splice(idx,1);
  if(r.frameId){
    var pf=S.frames.find(function(f){return f.id===r.frameId});
    if(pf&&pf.children){var ci=pf.children.indexOf(r.id);if(ci>=0)pf.children.splice(ci,1);pf.children.push(pathEl.id);}
  }
  S.els.push(pathEl);
  var oldG=document.getElementById('g'+r.id);
  if(oldG)oldG.remove();
  renderEl(pathEl);
  selectEl(pathEl.id);
  refreshLayers();
  refreshProps();
  drawSel();
  snapshot();
  toast('Converted to path');
}
function convertEllipseToPath(e){
  if(!e||e.type!=='ellipse')return;
  var x=e.x,y=e.y,w=Math.max(1,e.w||0),h=Math.max(1,e.h||0);
  var cx=x+w/2,cy=y+h/2,rx=w/2,ry=h/2;
  var k=4/3*(Math.sqrt(2)-1);
  var pts=[
    {x:cx+rx,y:cy,type:'smooth',cx1:cx+rx,cy1:cy+k*ry,cx2:cx+rx,cy2:cy-k*ry},
    {x:cx,y:cy-ry,type:'smooth',cx1:cx+k*rx,cy1:cy-ry,cx2:cx-k*rx,cy2:cy-ry},
    {x:cx-rx,y:cy,type:'smooth',cx1:cx-rx,cy1:cy-k*ry,cx2:cx-rx,cy2:cy+k*ry},
    {x:cx,y:cy+ry,type:'smooth',cx1:cx-k*rx,cy1:cy+ry,cx2:cx+k*rx,cy2:cy+ry}
  ];
  var d=penPtsToD(pts,true);
  var pathEl={
    id:uid(),
    type:'path',
    pts:pts,
    d:d,
    fill:e.fill!==undefined?e.fill:S.defFill,
    stroke:e.stroke!==undefined?e.stroke:'none',
    strokeWidth:e.strokeWidth||0,
    strokeAlign:e.strokeAlign||'center',
    opacity:e.opacity!==undefined?e.opacity:1,
    frameId:e.frameId||null,
    name:(e.name||'Ellipse')+' (path)',
    rotation:e.rotation||0
  };
  var idx=S.els.indexOf(e);
  if(idx>=0)S.els.splice(idx,1);
  if(e.frameId){
    var pf=S.frames.find(function(f){return f.id===e.frameId});
    if(pf&&pf.children){var ci=pf.children.indexOf(e.id);if(ci>=0)pf.children.splice(ci,1);pf.children.push(pathEl.id);}
  }
  S.els.push(pathEl);
  var oldG=document.getElementById('g'+e.id);
  if(oldG)oldG.remove();
  renderEl(pathEl);
  selectEl(pathEl.id);
  refreshLayers();
  refreshProps();
  drawSel();
  snapshot();
  toast('Converted to path');
}
function mkEl(type,ax,ay,w,h,extra){
  extra=extra||{};
  var fr=frameAt(ax+w/2,ay+h/2);
  var frAbs = fr ? absPos(fr) : null;
  var rx2 = fr ? ax - frAbs.x : ax;
  var ry2 = fr ? ay - frAbs.y : ay;
  var el=Object.assign({
    id:uid(),type:type,x:rx2,y:ry2,w:w,h:h,
    fill:type==='line'?'none':S.defFill,
    stroke:type==='line'?S.defFill:'none',
    strokeWidth:type==='line'?2:0,
    strokeAlign:'center',
    rx:0,opacity:1,fillMode:'solid',gradient:null,
    frameId:fr?fr.id:null,name:type+' '+(S.nid-1),
    textBoxMode:type==='text'?'auto':null
  },extra);
  S.els.push(el); if(fr)fr.children.push(el.id);
  renderEl(el); refreshLayers(); return el;
}
function containerHasMask(el){
  var childIds = getContainerChildIds(el);
  for(var i = 0; i < childIds.length; i++){
    var it = findAny(childIds[i]);
    if(it && it.isMask) return true;
  }
  return false;
}
function renderEl(el){
  if(el.groupId){
    var grp=S.groups.find(function(g){return g.id===el.groupId});
    if(grp){renderGroup(grp);return;}
  }
  if(containerHasMask(el)){
    if(el.frameId){
      var fr=S.frames.find(function(f){return f.id===el.frameId});
      if(fr){ var fc=getFCG(fr.id); if(fc){ fc.innerHTML=''; renderChildrenWithMasks(fr.children||[],fc,fr.id,null); } return; }
    } else {
      dom.elsLoose.innerHTML='';
      renderChildrenWithMasks(getRootLooseChildIds(),dom.elsLoose,null,null);
      return;
    }
  }
  if(el.type==='table'){
    var oldT=document.getElementById('g'+el.id);if(oldT)oldT.remove();
    var parent=el.frameId?(getFCG(el.frameId)||dom.elsLoose):dom.elsLoose;
    tableModule.renderTable(el,parent,{
      ns:ns,
      findAny:findAny,
      renderElInto:function(ell,pg,ig){renderElInto(ell,pg,ig);},
      onTableHit:onTableHit,
      openTed:openTed,
      selectEl:function(targetId,add){selectEl(targetId,!!add);}
    });
    return;
  }
  if(el.frameId){var fc=getFCG(el.frameId);if(fc)renderElInto(el,fc);else{el.frameId=null;renderElInto(el,dom.elsLoose);}}
  else renderElInto(el,dom.elsLoose);
}
function renderElInto(el,pg,inGroup){
  var old=document.getElementById('g'+el.id);
  var anchor=old?old.nextSibling:null;
  var anchorParent=old?old.parentNode:null;
  if(el.type==='text'){
    var gid='g'+el.id;
    var n;while((n=document.getElementById(gid))&&n.parentNode)n.parentNode.removeChild(n);
    for(var i=pg.childNodes.length-1;i>=0;i--){if(pg.childNodes[i].id===gid)pg.removeChild(pg.childNodes[i]);}
  } else {
    if(old)old.remove();
  }
  var g=ns('g');g.id='g'+el.id;
  var s=null;
  if(el.type==='rect'){
    s=ns('rect');s.setAttribute('x',el.x);s.setAttribute('y',el.y);
    s.setAttribute('width',Math.max(1,el.w));s.setAttribute('height',Math.max(1,el.h));s.setAttribute('rx',el.rx||0);
  } else if(el.type==='ellipse'){
    s=ns('ellipse');s.setAttribute('cx',el.x+el.w/2);s.setAttribute('cy',el.y+el.h/2);
    s.setAttribute('rx',Math.abs(el.w/2));s.setAttribute('ry',Math.abs(el.h/2));
  } else if(el.type==='line'){
    s=ns('line');s.setAttribute('x1',el.x);s.setAttribute('y1',el.y);s.setAttribute('x2',el.x+el.w);s.setAttribute('y2',el.y+el.h);s.setAttribute('stroke-linecap','round');
  } else if(el.type==='text'){
    s=ns('text');
    var fs=el.fs||18;
    var textAlign=el.textAlign||'left';
    var anchorMap={left:'start',center:'middle',right:'end'};
    var textAnchorVal=anchorMap[textAlign]||'start';
    var measured=measureText(el);
    var blockW=Math.max(0,el.w||measured.w||0);
    var lineH=fs*(el.lineHeight!=null&&el.lineHeight!==''?+el.lineHeight:1.2);
    var anchorX=textAlign==='center'?(el.x+blockW/2):textAlign==='right'?(el.x+blockW):el.x;
    var textY=el.y+fs;
    s.setAttribute('text-anchor',textAnchorVal);
    s.setAttribute('font-size',fs);s.setAttribute('font-weight',el.fw||'400');s.setAttribute('font-family',el.fontFamily||'system-ui,sans-serif');
    s.setAttribute('font-style',el.fontStyle||'normal');
    if(el.letterSpacing!=null&&el.letterSpacing!=='')s.style.letterSpacing=(typeof el.letterSpacing==='number'?el.letterSpacing:parseFloat(el.letterSpacing))+'px';
    else s.style.letterSpacing='';
    var lines=(el.text||'').split('\n');
    lines.forEach(function(line,idx){
      var tspan=ns('tspan');
      tspan.setAttribute('x',anchorX);
      tspan.setAttribute('y',textY+idx*lineH);
      tspan.textContent=line||' ';
      s.appendChild(tspan);
    });
  } else if(el.type==='path'){
    s=ns('path');
    s.setAttribute('d',el.d||'');
    s.setAttribute('stroke-linecap','round');s.setAttribute('stroke-linejoin','round');
  } else if(el.type==='image'){
    s=ns('image');s.setAttribute('x',el.x);s.setAttribute('y',el.y);
    s.setAttribute('width',Math.max(1,el.w));s.setAttribute('height',Math.max(1,el.h));
    s.setAttribute('preserveAspectRatio','xMidYMid meet');if(el.imgData)s.setAttribute('href',el.imgData);
  }
  if(s){
    var align=(el.strokeAlign||'center');
    var strokeVisible=el.strokeVisible!==false;
    var effectiveStroke=strokeVisible?(el.stroke||'none'):'none';
    var effectiveSw=strokeVisible?(el.strokeWidth||0):0;
    var hasStroke=el.stroke&&el.stroke!=='none'&&(el.strokeWidth||0)>0&&strokeVisible;
    var useStrokeAlign=hasStroke&&(align==='inside'||align==='outside')&&(el.type==='rect'||el.type==='ellipse'||el.type==='path');
    if(useStrokeAlign){
      var sw=el.strokeWidth||0;
      var mid=ns('mask');mid.id='strokeMask-'+(align==='inside'?'in':'out')+'-'+el.id;
      mid.setAttribute('maskUnits','userSpaceOnUse');
      if(align==='inside'){
        var mShape=el.type==='rect'?ns('rect'):el.type==='ellipse'?ns('ellipse'):ns('path');
        if(el.type==='rect'){mShape.setAttribute('x',el.x);mShape.setAttribute('y',el.y);mShape.setAttribute('width',Math.max(1,el.w));mShape.setAttribute('height',Math.max(1,el.h));mShape.setAttribute('rx',el.rx||0);}
        else if(el.type==='ellipse'){mShape.setAttribute('cx',el.x+el.w/2);mShape.setAttribute('cy',el.y+el.h/2);mShape.setAttribute('rx',Math.abs(el.w/2));mShape.setAttribute('ry',Math.abs(el.h/2));}
        else{mShape.setAttribute('d',el.d||'');mShape.setAttribute('stroke-linecap','round');mShape.setAttribute('stroke-linejoin','round');}
        mShape.setAttribute('fill','white');mid.appendChild(mShape);
      } else {
        var b=el.type==='path'&&el.pts&&el.pts.length?pathTightBBox(el.pts,el.d&&el.d.endsWith('Z')):{minX:el.x,minY:el.y,maxX:el.x+(el.w||0),maxY:el.y+(el.h||0)};
        var mx=b.minX-sw,my=b.minY-sw,mw=(b.maxX-b.minX)+2*sw,mh=(b.maxY-b.minY)+2*sw;
        var mR=ns('rect');mR.setAttribute('x',mx);mR.setAttribute('y',my);mR.setAttribute('width',mw);mR.setAttribute('height',mh);mR.setAttribute('fill','white');mid.appendChild(mR);
        var mCut=el.type==='rect'?ns('rect'):el.type==='ellipse'?ns('ellipse'):ns('path');
        if(el.type==='rect'){mCut.setAttribute('x',el.x);mCut.setAttribute('y',el.y);mCut.setAttribute('width',Math.max(1,el.w));mCut.setAttribute('height',Math.max(1,el.h));mCut.setAttribute('rx',el.rx||0);}
        else if(el.type==='ellipse'){mCut.setAttribute('cx',el.x+el.w/2);mCut.setAttribute('cy',el.y+el.h/2);mCut.setAttribute('rx',Math.abs(el.w/2));mCut.setAttribute('ry',Math.abs(el.h/2));}
        else{mCut.setAttribute('d',el.d||'');mCut.setAttribute('stroke-linecap','round');mCut.setAttribute('stroke-linejoin','round');}
        mCut.setAttribute('fill','black');mid.appendChild(mCut);
      }
      var defs=ns('defs');defs.appendChild(mid);g.appendChild(defs);
      var sFill=s.cloneNode(true);
      sFill.setAttribute('fill',fillVal(el));sFill.setAttribute('stroke','none');sFill.setAttribute('stroke-width',0);sFill.setAttribute('opacity',el.opacity!=null?el.opacity:1);
      g.appendChild(sFill);
      var sStroke=s.cloneNode(true);
      sStroke.setAttribute('fill','none');sStroke.setAttribute('stroke',effectiveStroke);sStroke.setAttribute('stroke-width',effectiveSw);
      sStroke.setAttribute('opacity',el.opacity!=null?el.opacity:1);
      sStroke.setAttribute('mask','url(#'+mid.id+')');
      g.appendChild(sStroke);
    } else {
      if(el.type!=='image'){
        s.setAttribute('fill',fillVal(el));
        if(el.type==='text'){s.setAttribute('stroke','none');s.setAttribute('stroke-width',0);}
        else{s.setAttribute('stroke',effectiveStroke);s.setAttribute('stroke-width',effectiveSw);}
      }
      s.setAttribute('opacity',el.opacity!=null?el.opacity:1);
      g.appendChild(s);
    }
  }
  // Apply rotation around element centre.
  // getBBox always returns absolute dom.canvas coords. The g lives either in:
  //   elsLoose  → no extra translate, absolute coords are fine as-is
  //   fc (frame content group) → parent fg has translate(fr.x, fr.y)
  //   gg (group container)  → gg itself may be in fc, so same frame offset applies
  // Correct local center = absoluteCenter - frameAbsPos (0 for loose elements).
  if(el.rotation){
    var rcx,rcy;
    if(el.type==='path'&&el.pts&&el.pts.length){
      var _bb=getBBox(el);
      rcx=_bb.x+_bb.w/2;
      rcy=_bb.y+_bb.h/2;
      if(el.frameId){
        var _pfr=S.frames.find(function(f){return f.id===el.frameId;});
        if(_pfr){var _pabs=absPos(_pfr);rcx-=_pabs.x;rcy-=_pabs.y;}
      }
    } else {
      rcx=el.x+(el.w||0)/2;
      rcy=el.y+(el.h||0)/2;
    }
    g.setAttribute('transform','rotate('+el.rotation+','+rcx+','+rcy+')');
  }
  if(!inGroup){
    (function(cap){
      g.addEventListener('mousedown',function(e){
        if(S.tool!=='select')return;
        if(S.penEditId)return;
        e.stopPropagation();
        console.log('down', cap.type, cap.id);

        var add = e.shiftKey||e.ctrlKey||e.metaKey;

        // If element is inside a mask group, dom.canvas click should usually act on the whole mask group.
        // BUT: if в дереве выбран любой дочерний элемент маски (маска или контент) — двигаем именно его.
        var parentMaskGroup = null;
        if(cap.groupId){
          var pg=S.groups.find(function(g){return g.id===cap.groupId;});
          if(pg&&pg.isMaskGroup)parentMaskGroup=pg;
        }
        var childSoloSelected = !!(S.selIds && S.selIds.length===1 && S.selId===cap.id);
        var selectedChildOfMask = !!(parentMaskGroup && S.selIds && S.selIds.length===1 && parentMaskGroup.children && parentMaskGroup.children.indexOf(S.selId)>=0);

        if(selectedChildOfMask){
          var toDrag=findAny(S.selId);
          if(toDrag){
            var ptC=svgPt(e);
            if(e.altKey){
              var newIdsC=duplicateIds([toDrag.id]);
              startMultiDrag(newIdsC,newIdsC[0],ptC);
              return;
            }
            if(!add){
              if(toDrag.type==='group'){
                if(!canFreeDragGroup(toDrag))return;
                var cbC=getGroupBBox(toDrag);
                S.dragging=true;
                S.dragEl=toDrag;
                var baseTxC=0,baseTyC=0;
                if(toDrag.frameId){
                  var pfC=S.frames.find(function(f){return f.id===toDrag.frameId;});
                  if(pfC){var pabC=absPos(pfC);baseTxC=-pabC.x;baseTyC=-pabC.y;}
                }
                S.dragS={mx:ptC.x,my:ptC.y,ox:cbC.x,oy:cbC.y,baseTx:baseTxC,baseTy:baseTyC};
              } else {
                if(!canFreeDragChild(toDrag))return;
                S.dragging=true;
                S.dragEl=toDrag;
                var abC=toDrag.type==='path'?getBBox(toDrag):absPos(toDrag);
                S.dragS={mx:ptC.x,my:ptC.y,ox:abC.x,oy:abC.y,rx:toDrag.x,ry:toDrag.y};
              }
            }
          }
          return;
        }

        if(parentMaskGroup && !childSoloSelected){
          var grp=parentMaskGroup;

          if(!add && grp.frameId && getActiveFrameId()!==grp.frameId){
            selectEl(grp.frameId);return;
          }

          var wasMultiGrp=(S.selIds && S.selIds.length>1 && isSelected(grp.id) && !add);
          var preSelIdsGrp=wasMultiGrp?S.selIds.slice():null;

          if(!wasMultiGrp){
            selectEl(grp.id,add);
          }

          var ptGrp=svgPt(e);

          if(e.altKey){
            var idsGrp=preSelIdsGrp?preSelIdsGrp:[grp.id];
            var newIdsGrp=duplicateIds(idsGrp);
            startMultiDrag(newIdsGrp,newIdsGrp[newIdsGrp.length-1],ptGrp);
            return;
          }

          if(preSelIdsGrp){
            startMultiDrag(preSelIdsGrp,grp.id,ptGrp);
            return;
          }

          if(!add){
            if(!canFreeDragGroup(grp))return;
            var cb=getGroupBBox(grp);
            S.dragging=true;
            S.dragEl=grp;
            var baseTx=0,baseTy=0;
            if(grp.frameId){
              var pf=S.frames.find(function(f){return f.id===grp.frameId;});
              if(pf){
                var pab=absPos(pf);
                baseTx=-pab.x;baseTy=-pab.y;
              }
            }
            S.dragS={mx:ptGrp.x,my:ptGrp.y,ox:cb.x,oy:cb.y,baseTx:baseTx,baseTy:baseTy};
          }
          return;
        }

        // Default element behavior (non‑mask groups)
        if(!add && cap.frameId && getActiveFrameId()!==cap.frameId){
          selectEl(cap.frameId);return;
        }

        var wasMulti = (S.selIds && S.selIds.length>1 && isSelected(cap.id) && !add);
        var preSelIds = wasMulti ? S.selIds.slice() : null;

        if(!wasMulti){
          // Table cell: keep table selected so selection stays visible in layer tree; dblclick will open cell editor.
          if(cap.tableCell){
            var tab=findAny(cap.tableCell.tableId);
            if(tab)selectEl(tab.id,add);
          } else {
            selectEl(cap.id, add);
          }
        }

        var pt = svgPt(e);

        if(e.altKey){
          var ids = preSelIds ? preSelIds : [cap.id];
          var newIds = duplicateIds(ids);
          startMultiDrag(newIds, newIds[newIds.length-1], pt);
          return;
        }

        if(preSelIds){
          startMultiDrag(preSelIds, cap.id, pt);
          return;
        }

        if(!add){
          if(!canFreeDragChild(cap))return;
          if(cap.tableCell){
            var tab=findAny(cap.tableCell.tableId);
            if(tab){ var abT=absPos(tab); var baseTx=0,baseTy=0; if(tab.frameId){ var pft=S.frames.find(function(f){return f.id===tab.frameId}); if(pft){ var pabT=absPos(pft); baseTx=-pabT.x; baseTy=-pabT.y; } } S.dragging=true; S.dragEl=tab; S.dragS={mx:pt.x,my:pt.y,ox:abT.x,oy:abT.y,baseTx:baseTx,baseTy:baseTy,rx:tab.x,ry:tab.y}; }
            return;
          }
          S.dragging=true;
          S.dragEl=cap;
          console.log('drag start', S.dragEl&&S.dragEl.type, S.dragEl&&S.dragEl.id);
          var ab=cap.type==='path'?getBBox(cap):absPos(cap);
          S.dragS={mx:pt.x,my:pt.y,ox:ab.x,oy:ab.y,rx:cap.x,ry:cap.y};
        }
      });
      g.addEventListener('dblclick',function(e){
        console.log('[el dblclick]',cap.type,cap.id,'tableCell=',!!cap.tableCell,'target=',e.target&&e.target.id);
        if(cap.type==='text'){e.stopPropagation();e.preventDefault();openTed(cap);}
        else if(cap.type==='path'||cap.type==='line'){e.stopPropagation();enterPenEditMode(cap.id);}
      });
    })(el);
  }
  if(el.type==='text'&&tedId===el.id&&dom.ted.style.display!=='none')g.style.display='none';
  // Table cell: transparent hit rect so whole cell area is clickable (not just text)
  if(el.tableCell){
    var cellHit=ns('rect');
    cellHit.setAttribute('x',el.x);
    cellHit.setAttribute('y',el.y);
    cellHit.setAttribute('width',Math.max(1,el.w||0));
    cellHit.setAttribute('height',Math.max(1,el.h||0));
    cellHit.setAttribute('fill','transparent');
    cellHit.setAttribute('stroke','none');
    g.appendChild(cellHit);
  }
  if(anchor&&anchorParent===pg)pg.insertBefore(g,anchor);else pg.appendChild(g);
}

// ── Z-ORDER ──
function zOrder(dir){
  if(!S.selId)return;
  var frIdx=S.frames.findIndex(function(f){return f.id===S.selId});
  if(frIdx>=0){
    var arr=S.frames;
    if(dir==='top'&&frIdx<arr.length-1)arr.push(arr.splice(frIdx,1)[0]);
    else if(dir==='bot'&&frIdx>0)arr.unshift(arr.splice(frIdx,1)[0]);
    else if(dir==='fwd'&&frIdx<arr.length-1){var t=arr[frIdx];arr[frIdx]=arr[frIdx+1];arr[frIdx+1]=t;}
    else if(dir==='bwd'&&frIdx>0){var t=arr[frIdx];arr[frIdx]=arr[frIdx-1];arr[frIdx-1]=t;}
    dom.framesG.innerHTML=''; S.frames.filter(function(f){return !f.frameId;}).forEach(function(f){renderFrame(f);}); toast('Order changed'); refreshLayers(); snapshot(); return;
  }
  var el=S.els.find(function(e){return e.id===S.selId});if(!el)return;
  if(el.frameId){
    var fr=S.frames.find(function(f){return f.id===el.frameId});if(!fr)return;
    var arr=fr.children,idx=arr.indexOf(el.id);
    if(dir==='top'&&idx<arr.length-1)arr.push(arr.splice(idx,1)[0]);
    else if(dir==='bot'&&idx>0)arr.unshift(arr.splice(idx,1)[0]);
    else if(dir==='fwd'&&idx<arr.length-1){var t=arr[idx];arr[idx]=arr[idx+1];arr[idx+1]=t;}
    else if(dir==='bwd'&&idx>0){var t=arr[idx];arr[idx]=arr[idx-1];arr[idx-1]=t;}
    var fc=getFCG(fr.id);if(fc){fc.innerHTML='';fr.children.forEach(function(cid){var c=S.els.find(function(e){return e.id===cid});if(c)renderElInto(c,fc);});}
  } else {
    var loose=S.els.filter(function(e){return !e.frameId});
    var idx=loose.findIndex(function(e){return e.id===S.selId});
    if(dir==='top'&&idx<loose.length-1)loose.push(loose.splice(idx,1)[0]);
    else if(dir==='bot'&&idx>0)loose.unshift(loose.splice(idx,1)[0]);
    else if(dir==='fwd'&&idx<loose.length-1){var t=loose[idx];loose[idx]=loose[idx+1];loose[idx+1]=t;}
    else if(dir==='bwd'&&idx>0){var t=loose[idx];loose[idx]=loose[idx-1];loose[idx-1]=t;}
    S.els=S.els.filter(function(e){return !!e.frameId}).concat(loose);
    dom.elsLoose.innerHTML=''; loose.forEach(function(e){renderElInto(e,dom.elsLoose);});
  }
  toast('Order changed'); refreshLayers(); snapshot();
}

// ── SELECT / DESELECT / DELETE ──
function selectEl(id,additive){
  if(!additive){S.selIds=[id];}
  else{var i=S.selIds.indexOf(id);if(i<0)S.selIds.push(id);else S.selIds.splice(i,1);}
  S.selId=S.selIds[S.selIds.length-1]||null;
  drawSel(); refreshProps(); refreshLayers();
  if (window.__designosAPI && window.__designosAPI.onSelectionChange) window.__designosAPI.onSelectionChange();
}
function clearSel(){S.selId=null;S.selIds=[];S.swapSrc=null;dom.selOv.innerHTML='';refreshProps();refreshLayers();updateExpBtn();if (window.__designosAPI && window.__designosAPI.onSelectionChange) window.__designosAPI.onSelectionChange();}
function delSel(){
  var ids=S.selIds.length?S.selIds.slice():(S.selId?[S.selId]:[]);
  function deleteFrame(fid){
    var fr=S.frames.find(function(f){return f.id===fid});if(!fr)return;
    fr.children.forEach(function(cid){
      var cf=S.frames.find(function(f){return f.id===cid});
      if(cf){deleteFrame(cid);return;}
      S.els=S.els.filter(function(e){return e.id!==cid});
      var g=document.getElementById('g'+cid);if(g)g.remove();
      var gd=document.getElementById('grad'+cid);if(gd)gd.remove();
    });
    if(fr.frameId){var pf=S.frames.find(function(f){return f.id===fr.frameId});if(pf)pf.children=pf.children.filter(function(c){return c!==fid});}
    S.frames=S.frames.filter(function(f){return f.id!==fid});
    var fg2=document.getElementById('fg'+fid);if(fg2)fg2.remove();
    var cp2=document.getElementById('clip'+fid);if(cp2)cp2.remove();
  }
  ids.forEach(function(sid){
    var grp=S.groups.find(function(g){return g.id===sid});
    if(grp){
      grp.children.forEach(function(cid){var item=findAny(cid);if(item)item.groupId=null;});
      var ggel=document.getElementById('gg'+grp.id);if(ggel)ggel.remove();
      var gmsk=document.getElementById('gmask'+grp.id);if(gmsk)gmsk.remove();
      S.groups=S.groups.filter(function(g){return g.id!==grp.id});
      return;
    }
    var fr=S.frames.find(function(f){return f.id===sid});
    if(fr){
      var parentId=fr.frameId;
      deleteFrame(sid);
      if(parentId){var alFr2=S.frames.find(function(f){return f.id===parentId});if(alFr2&&getAL(alFr2)){applyAutoLayout(alFr2);renderFrame(alFr2);}}
    } else {
      var el=S.els.find(function(e){return e.id===sid});
      var elParentId=el?el.frameId:null;
      if(el&&el.type==='table'&&el.cells){
        for(var tr=0;tr<el.cells.length;tr++){ for(var tc=0;tc<(el.cells[tr]||[]).length;tc++){ var cid=el.cells[tr][tc]; S.els=S.els.filter(function(e){return e.id!==cid}); var cg=document.getElementById('g'+cid);if(cg)cg.remove(); } }
      }
      if(el&&el.frameId){var pf=S.frames.find(function(f){return f.id===el.frameId});if(pf)pf.children=pf.children.filter(function(c){return c!==sid});}
      var gd=document.getElementById('grad'+sid);if(gd)gd.remove();
      S.els=S.els.filter(function(e){return e.id!==sid});
      var g=document.getElementById('g'+sid);if(g)g.remove();
      // Re-run AL on parent frame
      if(elParentId){var alFr=S.frames.find(function(f){return f.id===elParentId});if(alFr&&getAL(alFr)){applyAutoLayout(alFr);renderFrame(alFr);}}
    }
  });
  clearSel(); toast('Deleted'); snapshot();
}


// ── GROUPS ──
function moveItemBy(item,dx,dy){
  if(!item||(!dx&&!dy))return;
  if(item.type==='group'){
    item.children.forEach(function(cid){moveItemBy(findAny(cid),dx,dy);});
    renderGroup(item);
  } else if(item.type==='path'){
    movePath(item,dx,dy);
    renderEl(item);
  } else if(S.frames.indexOf(item)>=0){
    item.x+=dx; item.y+=dy; renderFrame(item);
  } else {
    item.x=(item.x||0)+dx; item.y=(item.y||0)+dy; renderEl(item);
  }
}
function swapEls(a,b){
  var ba=(a.type==='group')?getGroupBBox(a):getBBox(a);
  var bb=(b.type==='group')?getGroupBBox(b):getBBox(b);
  var acx=ba.x+ba.w/2,acy=ba.y+ba.h/2;
  var bcx=bb.x+bb.w/2,bcy=bb.y+bb.h/2;
  moveItemBy(a,bcx-acx,bcy-acy);
  moveItemBy(b,acx-bcx,acy-bcy);
  drawSel();snapshot();
}
function getGroupBBox(grp){
  var x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  grp.children.forEach(function(cid){
    var item=findAny(cid); if(!item)return;
    var bb=getBBox(item);
    x1=Math.min(x1,bb.x);y1=Math.min(y1,bb.y);
    x2=Math.max(x2,bb.x+bb.w);y2=Math.max(y2,bb.y+bb.h);
  });
  if(x1===Infinity)return{x:grp.x,y:grp.y,w:grp.w||0,h:grp.h||0};
  return{x:x1,y:y1,w:x2-x1,h:y2-y1};
}
function findAny(id){
  return S.frames.find(function(f){return f.id===id})||
         S.els.find(function(e){return e.id===id})||
         S.groups.find(function(g){return g.id===id})||null;
}

function isSelected(id){
  return S.selIds && S.selIds.indexOf(id)>=0;
}
// Frame context: the frame the user is currently "inside".
// Once any child (or the frame itself) is selected, clicks on siblings
// skip surface selection and go straight to the child — no double-click needed.
// Context clears when dom.canvas background is clicked (clearSel with no selection).
function getActiveFrameId(){
  var ids=(S.selIds&&S.selIds.length)?S.selIds:(S.selId?[S.selId]:[]);
  for(var i=0;i<ids.length;i++){
    var item=findAny(ids[i]);if(!item)continue;
    if(item.frameId)return item.frameId;          // child → parent frame is active
    if(S.frames.indexOf(item)>=0)return item.id;  // frame selected → it is active
  }
  return null;
}

// Убираем из selection тех, кто вложен в выбранного родителя (group/frame)
function topLevelSelIds(ids){
  var set={}; ids.forEach(id=>set[id]=1);

  function hasSelectedParent(it){
    // group parent chain
    var g=it && it.groupId ? S.groups.find(x=>x.id===it.groupId) : null;
    while(g){
      if(set[g.id]) return true;
      g = g.groupId ? S.groups.find(x=>x.id===g.groupId) : null;
    }
    // frame parent chain
    var f=it && it.frameId ? S.frames.find(x=>x.id===it.frameId) : null;
    while(f){
      if(set[f.id]) return true;
      f = f.frameId ? S.frames.find(x=>x.id===f.frameId) : null;
    }
    return false;
  }

  return ids.filter(function(id){
    var it=findAny(id); if(!it) return false;
    return !hasSelectedParent(it);
  });
}

// --- DUPLICATION HELPERS ---
// minimal: duplicate element (shape/image/text/line/path)
function dupElStandalone(el){
  var nd=deep(el);
  nd.id=uid();
  nd.name=(el.name||el.type)+' copy';
  S.els.push(nd);
  renderEl(nd);
  return nd;
}

// duplicate group tree (children recursively)
function dupGroupTree(grp){
  var ng=deep(grp);
  ng.id=uid();
  ng.name=(grp.name||'Group')+' copy';
  S.groups.push(ng);

  ng.children=(grp.children||[]).map(function(cid){
    var it=findAny(cid); if(!it) return null;
    if(it.type==='group'){
      var cg=S.groups.find(g=>g.id===cid);
      var newChild=dupGroupTree(cg);
      newChild.groupId=ng.id;
      newChild.frameId=ng.frameId||null;
      return newChild.id;
    }
    if(it.type==='frame'){
      var cf=S.frames.find(f=>f.id===cid);
      var newFrame=dupFrameTree(cf);
      newFrame.groupId=ng.id;
      newFrame.frameId=ng.frameId||null;
      return newFrame.id;
    }
    var ne=deep(it);
    ne.id=uid();
    ne.name=(it.name||it.type)+' copy';
    ne.groupId=ng.id;
    ne.frameId=ng.frameId||null;
    S.els.push(ne);
    return ne.id;
  }).filter(Boolean);

  renderGroup(ng);
  return ng;
}

// duplicate frame tree (children recursively)
function dupFrameTree(fr){
  var nf=deep(fr);
  nf.id=uid();
  nf.name=(fr.name||'Frame')+' copy';
  nf.children=[];
  S.frames.push(nf);

  (fr.children||[]).forEach(function(cid){
    var cg=S.groups.find(g=>g.id===cid);
    if(cg){
      var ng=dupGroupTree(cg);
      ng.frameId=nf.id; ng.groupId=null;
      nf.children.push(ng.id);
      return;
    }
    var cf=S.frames.find(f=>f.id===cid);
    if(cf){
      var ncf=dupFrameTree(cf);
      ncf.frameId=nf.id; ncf.groupId=null;
      nf.children.push(ncf.id);
      return;
    }
    var ce=S.els.find(e=>e.id===cid);
    if(ce){
      var ne=deep(ce);
      ne.id=uid();
      ne.name=(ce.name||ce.type)+' copy';
      ne.frameId=nf.id;
      ne.groupId=null;
      S.els.push(ne);
      nf.children.push(ne.id);
    }
  });

  renderFrame(nf);
  return nf;
}

function duplicateIds(ids){
  // дублируем только top-level, чтобы не задвоить детей выбранных групп/фреймов
  ids = topLevelSelIds(ids);

  var newIds=[];
  ids.forEach(function(id){
    var it=findAny(id); if(!it) return;
    var dup=null;
    if(it.type==='group'){
      var g=S.groups.find(x=>x.id===id);
      dup=dupGroupTree(g);
      dup.frameId=it.frameId||null;
      dup.groupId=it.groupId||null;
      addChildToParent(dup.frameId,dup.groupId,dup.id);
      renderGroup(dup);
      newIds.push(dup.id);
      return;
    }
    if(it.type==='frame'){
      var f=S.frames.find(x=>x.id===id);
      dup=dupFrameTree(f);
      dup.frameId=it.frameId||null;
      dup.groupId=it.groupId||null;
      addChildToParent(dup.frameId,dup.groupId,dup.id);
      renderFrame(dup);
      newIds.push(dup.id);
      return;
    }
    dup=dupElStandalone(it);
    dup.frameId=it.frameId||null;
    dup.groupId=it.groupId||null;
    addChildToParent(dup.frameId,dup.groupId,dup.id);
    renderEl(dup);
    newIds.push(dup.id);
  });

  return newIds;
}

function getItemAbsXY(it){
  if(!it) return {x:0,y:0,w:0,h:0};
  if(it.type==='group'){
    var bb=getGroupBBox(it);
    return {x:bb.x,y:bb.y,w:bb.w||1,h:bb.h||1};
  }
  if(it.type==='path'){
    var bb2=getBBox(it);
    return {x:bb2.x,y:bb2.y,w:bb2.w||1,h:bb2.h||1};
  }
  var ab=absPos(it);
  return {x:ab.x,y:ab.y,w:it.w||1,h:it.h||1};
}

function startMultiDrag(ids, primaryId, pt){
  ids = topLevelSelIds(ids);

  S.dragging=true;
  S.dragEl=findAny(primaryId)||findAny(ids[ids.length-1]); // чтобы старый код не ломался
  S.dragMulti={
    ids:ids.slice(),
    primaryId:(primaryId||ids[ids.length-1]),
    start:{mx:pt.x,my:pt.y},
    orig:{},
    lastDx:0,lastDy:0
  };

  ids.forEach(function(id){
    var it=findAny(id); if(!it) return;
    var a=getItemAbsXY(it);
    S.dragMulti.orig[id]={absX:a.x,absY:a.y,frameId:it.frameId||null,type:it.type,w:a.w,h:a.h};
  });

  // выделение остаётся на ids
  S.selIds=ids.slice();
  S.selId=ids[ids.length-1];
  drawSel(); refreshLayers(); refreshProps();
}

function renderGroup(grp){
  var old=document.getElementById('gg'+grp.id);
  var anchorGg=old?old.nextSibling:null;
  var anchorGgParent=old?old.parentNode:null;
  if(old)old.remove();
  var bb=getGroupBBox(grp);
  grp.x=bb.x;grp.y=bb.y;grp.w=bb.w||1;grp.h=bb.h||1;
  var gg=ns('g');gg.id='gg'+grp.id;
    // If group is inside a frame, children coords are effectively absolute in your model.
  // Frame's fc is in frame-local space, so compensate by shifting group by -frameAbs.
  //if(grp.frameId){
  //  var pf = S.frames.find(function(f){ return f.id===grp.frameId; });
  //  if(pf){
  //    var pab = absPos(pf);
  //    gg.setAttribute('transform','translate('+(-pab.x)+','+(-pab.y)+')');
  //  }
  //}
  // Hit rect first (behind children) so clicks on children reach child elements, not the group
  var hitX=bb.x,hitY=bb.y;
  if(grp.frameId){
    var hpf=S.frames.find(function(f){return f.id===grp.frameId;});
    if(hpf){var hpfa=absPos(hpf);hitX=bb.x-hpfa.x;hitY=bb.y-hpfa.y;}
  }
  (function(cap){
    var hit=ns('rect');
    hit.setAttribute('x',hitX);hit.setAttribute('y',hitY);
    hit.setAttribute('width',bb.w||1);hit.setAttribute('height',bb.h||1);
    hit.setAttribute('fill','transparent');hit.setAttribute('stroke','none');
    hit.addEventListener('mousedown',function(e){
      if(S.tool!=='select')return;
      e.stopPropagation();

      var add = e.shiftKey||e.ctrlKey||e.metaKey;

      if(!add && cap.frameId && getActiveFrameId()!==cap.frameId){
        selectEl(cap.frameId);return;
      }

      var wasMulti = (S.selIds && S.selIds.length>1 && isSelected(cap.id) && !add);
      var preSelIds = wasMulti ? S.selIds.slice() : null;

      if(!wasMulti){
        selectEl(cap.id, add);
      }

      var pt = svgPt(e);

      if(e.altKey){
        var ids = preSelIds ? preSelIds : [cap.id];
        var newIds = duplicateIds(ids);
        startMultiDrag(newIds, newIds[newIds.length-1], pt);
        return;
      }

      if(preSelIds){
        startMultiDrag(preSelIds, cap.id, pt);
        return;
      }

      if(!add){
        if(!canFreeDragGroup(cap))return;
        var cb=getGroupBBox(cap);
        S.dragging=true;
        S.dragEl=cap;
        var baseTx=0, baseTy=0;
        if(cap.frameId){
          var pf=S.frames.find(function(f){return f.id===cap.frameId});
          if(pf){
            var pab=absPos(pf);
            baseTx=-pab.x; baseTy=-pab.y;
          }
        }
        S.dragS={mx:pt.x,my:pt.y,ox:cb.x,oy:cb.y, baseTx:baseTx, baseTy:baseTy};
      }
    });
    gg.appendChild(hit);
  })(grp);
  renderChildrenWithMasks(grp.children || [], gg, grp.frameId || null, grp.id);
  if(grp.frameId){var pfc=getFCG(grp.frameId);if(pfc){
    if(anchorGgParent===pfc&&anchorGg)pfc.insertBefore(gg,anchorGg);else pfc.appendChild(gg);
    return;
  }}
  if(anchorGgParent===dom.elsLoose&&anchorGg)dom.elsLoose.insertBefore(gg,anchorGg);else dom.elsLoose.appendChild(gg);
}

function addChildToParent(parentFrameId, parentGroupId, childId){
  if(parentGroupId){
    var pg=S.groups.find(g=>g.id===parentGroupId);
    if(pg && pg.children.indexOf(childId)<0) pg.children.push(childId);
    return;
  }
  if(parentFrameId){
    var pf=S.frames.find(f=>f.id===parentFrameId);
    if(pf && pf.children.indexOf(childId)<0) pf.children.push(childId);
    return;
  }
}

function duplicateElOnly(el){
  var nd=deep(el);
  nd.id=uid();
  nd.name=(el.name||el.type)+' copy';
  // сохраняем frameId / groupId как у оригинала (копия появляется рядом в том же контейнере)
  S.els.push(nd);

  if(nd.groupId){
    addChildToParent(null, nd.groupId, nd.id);
    var g=S.groups.find(x=>x.id===nd.groupId); if(g) renderGroup(g);
  } else if(nd.frameId){
    addChildToParent(nd.frameId, null, nd.id);
    var fc=getFCG(nd.frameId); if(fc) renderElInto(nd, fc);
  } else {
    renderElInto(nd, dom.elsLoose);
  }
  return nd;
}

function duplicateGroupTree(grp, map){
  map = map || {};
  var ng=deep(grp);
  ng.id=uid();
  ng.name=(grp.name||'Group')+' copy';
  map[grp.id]=ng.id;

  // регистрируем группу сразу, чтобы findAny работал на вложенности
  S.groups.push(ng);

  // children будут новые id
  ng.children = (grp.children||[]).map(function(cid){
    var it=findAny(cid); if(!it) return null;

    // дублируем рекурсивно
    if(it.type==='group'){
      var cg=S.groups.find(g=>g.id===cid);
      var newChild = duplicateGroupTree(cg, map);
      newChild.groupId = ng.id;
      newChild.frameId = ng.frameId || null;
      return newChild.id;
    }
    if(it.type==='frame'){
      var cf=S.frames.find(f=>f.id===cid);
      var newFrame = duplicateFrameTree(cf, map);
      newFrame.groupId = ng.id;
      newFrame.frameId = ng.frameId || null;
      return newFrame.id;
    }

    // обычный элемент
    var ne=deep(it);
    ne.id=uid();
    ne.name=(it.name||it.type)+' copy';
    ne.groupId = ng.id;
    ne.frameId = ng.frameId || null;
    S.els.push(ne);
    return ne.id;
  }).filter(Boolean);

  return ng;
}

function duplicateFrameTree(fr, map){
  map = map || {};
  var nf=deep(fr);
  nf.id=uid();
  nf.name=(fr.name||'Frame')+' copy';
  map[fr.id]=nf.id;

  // register first
  nf.children=[];
  S.frames.push(nf);

  var frAbs=absPos(fr);
  var nfAbs=absPos(nf); // пока примерно = nf.x/y (если top-level), ниже скорректируем через child abs

  (fr.children||[]).forEach(function(cid){
    // child can be group/frame/el
    var cg=S.groups.find(g=>g.id===cid);
    if(cg){
      var ng=duplicateGroupTree(cg, map);
      // дочерняя группа у фрейма
      ng.frameId = nf.id;
      ng.groupId = null;
      nf.children.push(ng.id);
      return;
    }
    var cf=S.frames.find(f=>f.id===cid);
    if(cf){
      var ncf=duplicateFrameTree(cf, map);
      ncf.frameId = nf.id;
      ncf.groupId = null;
      nf.children.push(ncf.id);
      return;
    }
    var ce=S.els.find(e=>e.id===cid);
    if(ce){
      var ne=deep(ce);
      ne.id=uid();
      ne.name=(ce.name||ce.type)+' copy';
      ne.frameId = nf.id;
      ne.groupId = null;
      S.els.push(ne);
      nf.children.push(ne.id);
    }
  });

  return nf;
}

// Создать копию и сразу подготовить drag на ней
function altDuplicateStartDrag(original, startPt){
  var dup=null;

  if(original.type==='group'){
    var g=S.groups.find(x=>x.id===original.id);
    dup = duplicateGroupTree(g, {});
    // копия появляется в том же контейнере
    dup.frameId = original.frameId||null;
    dup.groupId = original.groupId||null;
    addChildToParent(dup.frameId, dup.groupId, dup.id);
    renderGroup(dup);
  } else if(original.type==='frame'){
    var f=S.frames.find(x=>x.id===original.id);
    dup = duplicateFrameTree(f, {});
    dup.frameId = original.frameId||null;
    dup.groupId = original.groupId||null;
    addChildToParent(dup.frameId, dup.groupId, dup.id);
    renderFrame(dup);
  } else {
    dup = duplicateElOnly(original);
  }

  // выделяем копию
  S.selIds=[dup.id]; S.selId=dup.id; drawSel(); refreshLayers(); refreshProps();

  // стартуем drag на копии
  S.dragging=true; S.dragEl=dup;
  if(dup.type==='group'){
    var bb=getGroupBBox(dup);
    S.dragS={mx:startPt.x,my:startPt.y,ox:bb.x,oy:bb.y};
  } else {
    S.dragS={mx:startPt.x,my:startPt.y,ox:dup.x,oy:dup.y};
  }
}
function groupSel(){
  var ids=S.selIds.length?S.selIds.slice():(S.selId?[S.selId]:[]);
  if(ids.length<2){toast('Select 2+ objects to group');return;}

  var items=ids.map(findAny).filter(Boolean);

  // общий frameId (если все из одного фрейма)
  var f0 = (items[0] && items[0].frameId) || null;
  var sameFrame = items.every(it => (it.frameId||null) === f0);
  var parentFrameId = sameFrame ? f0 : null;

  var x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  items.forEach(function(item){
    var bb=getBBox(item);
    x1=Math.min(x1,bb.x);y1=Math.min(y1,bb.y);
    x2=Math.max(x2,bb.x+bb.w);y2=Math.max(y2,bb.y+bb.h);
  });

  var grp={
    id:uid(),type:'group',
    x:x1,y:y1,w:x2-x1,h:y2-y1,
    children:ids.slice(),
    name:'Group '+(S.nid-1),
    frameId: parentFrameId,
    groupId:null,isMask:false
  };

  // убрать детей из children родительского фрейма и проставить groupId
  ids.forEach(function(id){
    var item=findAny(id);if(!item)return;
    item.groupId=grp.id;
    if(item.frameId){
      var pf=S.frames.find(function(f){return f.id===item.frameId});
      if(pf) pf.children=pf.children.filter(function(c){return c!==id});
    }
  });

  // добавить группу в children родительского фрейма (если он общий)
  if(parentFrameId){
    var pf2=S.frames.find(function(f){return f.id===parentFrameId});
    if(pf2) pf2.children.push(grp.id);
  }

  S.groups.push(grp);
  renderGroup(grp);
  selectEl(grp.id);refreshLayers();snapshot();
  toast('Grouped ('+ids.length+')');
}
function ungroupSel(){
  var ids=S.selIds.length?S.selIds.slice():(S.selId?[S.selId]:[]);
  ids.forEach(function(id){
    var grp=S.groups.find(function(g){return g.id===id});if(!grp)return;
    delete grp.isMask;
    if(grp.isMaskGroup && grp.children.length){
      var m=findAny(grp.children[0]);if(m)delete m.isMask;
    }
    grp.children.forEach(function(cid){
      var item=findAny(cid);if(!item)return;
      item.groupId=null;
      // re-render into correct container
      if(item.type==='frame')renderFrame(item);
      else if(item.type==='group')renderGroup(item);
      else renderElInto(item, item.frameId?getFCG(item.frameId):dom.elsLoose);
    });
    var gg=document.getElementById('gg'+id);if(gg)gg.remove();
    S.groups=S.groups.filter(function(g){return g.id!==id});
  });
  clearSel();refreshLayers();snapshot();toast('Ungrouped');
}
function sameContainerForMask(items){
  if(!items.length) return true;
  var first = items[0];
  var key0 = (first.frameId || 'root') + '|' + (first.groupId || 'nogroup');
  return items.every(function(it){
    return ((it.frameId || 'root') + '|' + (it.groupId || 'nogroup')) === key0;
  });
}
/** Returns ordered child ids of the container that holds the item (frame, group, or root). */
function getContainerChildIds(item){
  if(!item) return [];
  if(item.groupId){
    var g = S.groups.find(function(gr){ return gr.id === item.groupId; });
    return (g && g.children) ? g.children.slice() : [];
  }
  if(item.frameId){
    var fr = S.frames.find(function(f){ return f.id === item.frameId; });
    return (fr && fr.children) ? fr.children.slice() : [];
  }
  return getRootLooseChildIds();
}
function canBeMaskSource(item){
  if(!item) return false;
  return item.type === 'rect' || item.type === 'ellipse' || item.type === 'path';
}
function makeMask(){
  var ids = S.selIds.length ? S.selIds.slice() : (S.selId ? [S.selId] : []);
  if(ids.length < 2){
    toast('Select 2+ objects: last selected = mask');
    return;
  }
  var items = ids.map(findAny).filter(Boolean);
  if(items.length < 2){
    toast('Mask items not found');
    return;
  }
  if(!sameContainerForMask(items)){
    toast('Mask works only for layers in the same container');
    return;
  }
  var maskId = ids[ids.length - 1];
  var maskItem = findAny(maskId);
  if(!canBeMaskSource(maskItem)){
    toast('Mask source must be rect / ellipse / path');
    return;
  }
  items.forEach(function(it){
    if(it) delete it.isMask;
  });
  maskItem.isMask = true;
  var f0 = (items[0] && items[0].frameId) || null;
  var sameFrame = items.every(function(it){ return (it.frameId || null) === f0; });
  var parentFrameId = sameFrame ? f0 : null;
  var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  items.forEach(function(item){
    var bb = getBBox(item);
    x1 = Math.min(x1, bb.x); y1 = Math.min(y1, bb.y);
    x2 = Math.max(x2, bb.x + bb.w); y2 = Math.max(y2, bb.y + bb.h);
  });
  var maskFirstIds = [maskId].concat(ids.filter(function(id){ return id !== maskId; }));
  var grp = {
    id: uid(),
    type: 'group',
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    children: maskFirstIds,
    name: 'Mask ' + (S.nid++),
    frameId: parentFrameId,
    groupId: null,
    isMaskGroup: true
  };
  ids.forEach(function(id){
    var item = findAny(id);
    if(!item) return;
    item.groupId = grp.id;
    if(item.frameId){
      var pf = S.frames.find(function(f){ return f.id === item.frameId; });
      if(pf) pf.children = pf.children.filter(function(c){ return c !== id; });
    }
  });
  if(parentFrameId){
    var pf2 = S.frames.find(function(f){ return f.id === parentFrameId; });
    if(pf2) pf2.children.push(grp.id);
  }
  S.groups.push(grp);
  rerenderAll();
  refreshLayers();
  refreshProps();
  drawSel();
  snapshot();
  toast('⬡ Mask applied');
  S.selId = grp.id;
  S.selIds = [grp.id];
  drawSel();
  refreshProps();
}
function releaseMask(){
  var item = findAny(S.selId);
  if(!item || !item.isMask){
    toast('Selected layer is not a mask');
    return;
  }
  delete item.isMask;
  rerenderAll();
  refreshLayers();
  refreshProps();
  drawSel();
  snapshot();
  toast('Mask released');
}
function releaseMaskGroup(grpId){
  var grp = S.groups.find(function(g){ return g.id === grpId; });
  if(!grp || !grp.isMaskGroup) return;
  var maskChild = grp.children.length ? findAny(grp.children[0]) : null;
  if(maskChild) delete maskChild.isMask;
  grp.children.forEach(function(cid){
    var item = findAny(cid);
    if(!item) return;
    item.groupId = null;
    if(item.type === 'frame') renderFrame(item);
    else if(item.type === 'group') renderGroup(item);
    else renderElInto(item, item.frameId ? getFCG(item.frameId) : dom.elsLoose);
  });
  var gg = document.getElementById('gg' + grpId);
  if(gg) gg.remove();
  if(grp.frameId){
    var pf = S.frames.find(function(f){ return f.id === grp.frameId; });
    if(pf) pf.children = pf.children.filter(function(c){ return c !== grpId; });
  }
  S.groups = S.groups.filter(function(g){ return g.id !== grpId; });
  clearSel();
  rerenderAll();
  refreshLayers();
  refreshProps();
  snapshot();
  toast('Mask released');
}

// ── PEN TOOL ──
var penPreview=null;
function penStart(){
  S.penPts=[];S.penActive=true;S.penElId=null;
  var old=document.getElementById('pen-preview');if(old)old.remove();
  penPreview=ns('path');penPreview.id='pen-preview';
  penPreview.setAttribute('fill','none');
  penPreview.setAttribute('stroke',S.defFill);
  penPreview.setAttribute('stroke-width',2);
  penPreview.setAttribute('stroke-linecap','round');
  penPreview.setAttribute('stroke-linejoin','round');
  dom.elsLoose.appendChild(penPreview);
}
function penPtsToD(pts,close){
  if(!pts||pts.length===0)return'';
  var d='M'+pts[0].x+','+pts[0].y;
  for(var i=1;i<pts.length;i++){
    var prev=pts[i-1],cur=pts[i];
    var hasPrevH=prev.cx2!=null, hasCurH=cur.cx1!=null;
    if(hasPrevH&&hasCurH){
      d+=' C'+prev.cx2+','+prev.cy2+' '+cur.cx1+','+cur.cy1+' '+cur.x+','+cur.y;
    } else if(hasPrevH){
      d+=' Q'+prev.cx2+','+prev.cy2+' '+cur.x+','+cur.y;
    } else if(hasCurH){
      d+=' Q'+cur.cx1+','+cur.cy1+' '+cur.x+','+cur.y;
    } else {
      d+=' L'+cur.x+','+cur.y;
    }
  }
  if(close){
    // Closing segment may need bezier if last/first nodes have handles
    var last=pts[pts.length-1],first=pts[0];
    var hasLastH=last.cx2!=null, hasFirstH=first.cx1!=null;
    if(hasLastH&&hasFirstH){
      d+=' C'+last.cx2+','+last.cy2+' '+first.cx1+','+first.cy1+' '+first.x+','+first.y;
    } else if(hasLastH){
      d+=' Q'+last.cx2+','+last.cy2+' '+first.x+','+first.y;
    } else if(hasFirstH){
      d+=' Q'+first.cx1+','+first.cy1+' '+first.x+','+first.y;
    }
    d+='Z';
  }
  return d;
}
function penUpdatePreview(mouseX,mouseY){
  if(!penPreview||!S.penPts.length)return;
  var tmpPts=S.penPts.concat([{x:mouseX,y:mouseY}]);
  penPreview.setAttribute('d',penPtsToD(tmpPts,false));
}
function penCommit(close){
  S.penActive=false;
  if(penPreview){penPreview.remove();penPreview=null;}
  if(S.penPts.length<2)return;
  var d=penPtsToD(S.penPts,close);
  // compute bbox
  var xs=S.penPts.map(function(p){return p.x;});
  var ys=S.penPts.map(function(p){return p.y;});
  var bx=Math.min.apply(null,xs),by=Math.min.apply(null,ys);
  var bw=Math.max.apply(null,xs)-bx,bh=Math.max.apply(null,ys)-by;
  var fr=null;
  // check if any point is inside a frame
 S.frames.forEach(function(f){
  var ab = absPos(f);
  if(S.penPts[0].x>=ab.x && S.penPts[0].x<=ab.x+f.w &&
     S.penPts[0].y>=ab.y && S.penPts[0].y<=ab.y+f.h) fr=f;
  });
  var frAbs = fr ? absPos(fr) : null;
  // store pts as frame-local when inside a frame (consistent with moveGroupToFrameSpace)
  var elPts = frAbs
    ? S.penPts.map(function(p){return movePt(p,-frAbs.x,-frAbs.y);})
    : S.penPts.map(function(p){return Object.assign({},p);});
  var elD = frAbs ? penPtsToD(elPts, close) : d;
  var el={id:uid(),type:'path',x:0,y:0,w:bw,h:bh,
          fill:close?S.defFill:'none',stroke:S.defFill,strokeWidth:2,strokeAlign:'center',
          opacity:1,fillMode:'solid',gradient:null,rx:0,rotation:0,
          d:elD,pts:elPts,
          frameId:fr?fr.id:null,name:'Path '+(S.nid++)};
  S.els.push(el);
  if(fr)fr.children.push(el.id);
  renderEl(el);
  S.penPts=[];
  selectEl(el.id);setTool('select');refreshLayers();snapshot();
}

// ── PEN NODE EDIT MODE ──
function pathLocalToCanvas(px,py,pathEl){
  var pts=pathEl.pts||[];
  if(!pts.length)return{x:px,y:py};
  var cx_pl,cy_pl;
  if(S.penEditId===pathEl.id&&S.penEditPathCenter){cx_pl=S.penEditPathCenter.x;cy_pl=S.penEditPathCenter.y;}
  else{var xs=pts.map(function(p){return p.x;}),ys=pts.map(function(p){return p.y;});var minX=Math.min.apply(null,xs),maxX=Math.max.apply(null,xs),minY=Math.min.apply(null,ys),maxY=Math.max.apply(null,ys);cx_pl=(minX+maxX)/2;cy_pl=(minY+maxY)/2;}
  var rot=pathEl.rotation||0;
  var rx=px,ry=py;
  if(rot){
    var rad=rot*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
    var dx=px-cx_pl,dy=py-cy_pl;
    rx=cx_pl+dx*cos-dy*sin;ry=cy_pl+dx*sin+dy*cos;
  }
  if(pathEl.frameId){
    var fr=S.frames.find(function(f){return f.id===pathEl.frameId;});
    if(fr)return frameLocalToCanvas(fr,rx,ry);
  }
  return{x:rx,y:ry};
}
function pathDToCanvas(d,pathEl){
  if(!d)return'';
  function tf(x,y){var p=pathLocalToCanvas(x,y,pathEl);return p.x.toFixed(4)+' '+p.y.toFixed(4);}
  var out=[],cx=0,cy=0,sx=0,sy=0;
  var segs=[];var re2=/([MmLlHhVvCcQqSsTtZz])((?:[^MmLlHhVvCcQqSsTtZz])*)/g,seg;
  while((seg=re2.exec(d))!==null){
    var ns=(seg[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)||[]).map(Number);
    segs.push({c:seg[1],n:ns});
  }
  segs.forEach(function(s){
    var c=s.c,n=s.n;
    if(c==='M'){for(var i=0;i<n.length;i+=2){cx=n[i];cy=n[i+1];out.push((i===0?'M':'L')+tf(cx,cy));if(i===0){sx=cx;sy=cy;}}}
    else if(c==='m'){for(var i=0;i<n.length;i+=2){cx+=n[i];cy+=n[i+1];out.push((i===0?'M':'L')+tf(cx,cy));if(i===0){sx=cx;sy=cy;}}}
    else if(c==='L'){for(var i=0;i<n.length;i+=2){cx=n[i];cy=n[i+1];out.push('L'+tf(cx,cy));}}
    else if(c==='l'){for(var i=0;i<n.length;i+=2){cx+=n[i];cy+=n[i+1];out.push('L'+tf(cx,cy));}}
    else if(c==='H'){for(var i=0;i<n.length;i++){cx=n[i];out.push('L'+tf(cx,cy));}}
    else if(c==='h'){for(var i=0;i<n.length;i++){cx+=n[i];out.push('L'+tf(cx,cy));}}
    else if(c==='V'){for(var i=0;i<n.length;i++){cy=n[i];out.push('L'+tf(cx,cy));}}
    else if(c==='v'){for(var i=0;i<n.length;i++){cy+=n[i];out.push('L'+tf(cx,cy));}}
    else if(c==='C'){for(var i=0;i<n.length;i+=6){out.push('C'+tf(n[i],n[i+1])+' '+tf(n[i+2],n[i+3])+' '+tf(n[i+4],n[i+5]));cx=n[i+4];cy=n[i+5];}}
    else if(c==='c'){for(var i=0;i<n.length;i+=6){out.push('C'+tf(cx+n[i],cy+n[i+1])+' '+tf(cx+n[i+2],cy+n[i+3])+' '+tf(cx+n[i+4],cy+n[i+5]));cx+=n[i+4];cy+=n[i+5];}}
    else if(c==='Q'){for(var i=0;i<n.length;i+=4){out.push('Q'+tf(n[i],n[i+1])+' '+tf(n[i+2],n[i+3]));cx=n[i+2];cy=n[i+3];}}
    else if(c==='q'){for(var i=0;i<n.length;i+=4){out.push('Q'+tf(cx+n[i],cy+n[i+1])+' '+tf(cx+n[i+2],cy+n[i+3]));cx+=n[i+2];cy+=n[i+3];}}
    else if(c==='S'){for(var i=0;i<n.length;i+=4){out.push('S'+tf(n[i],n[i+1])+' '+tf(n[i+2],n[i+3]));cx=n[i+2];cy=n[i+3];}}
    else if(c==='s'){for(var i=0;i<n.length;i+=4){out.push('S'+tf(cx+n[i],cy+n[i+1])+' '+tf(cx+n[i+2],cy+n[i+3]));cx+=n[i+2];cy+=n[i+3];}}
    else if(c==='Z'||c==='z'){out.push('Z');cx=sx;cy=sy;}
  });
  return out.join(' ');
}
function canvasToFrameLocal(canvasX,canvasY,fr){
  var origin=fr.frameId?frameLocalToCanvas(S.frames.find(function(f){return f.id===fr.frameId;}),fr.x,fr.y):{x:fr.x,y:fr.y};
  var qx=canvasX-origin.x,qy=canvasY-origin.y;
  var rad=((fr.rotation||0)*Math.PI/180),cos=Math.cos(rad),sin=Math.sin(rad);
  var cx=fr.w/2,cy=fr.h/2;
  return{x:cx+(qx-cx)*cos+(qy-cy)*sin,y:cy-(qx-cx)*sin+(qy-cy)*cos};
}
function canvasToPathLocal(canvasX,canvasY,pathEl){
  if(!pathEl.rotation&&!pathEl.frameId)return{x:canvasX,y:canvasY};
  var pts=pathEl.pts||[];
  var cx_pl,cy_pl;
  if(S.penEditId===pathEl.id&&S.penEditPathCenter){cx_pl=S.penEditPathCenter.x;cy_pl=S.penEditPathCenter.y;}
  else{var xs=pts.map(function(p){return p.x;}),ys=pts.map(function(p){return p.y;});cx_pl=(Math.min.apply(null,xs)+Math.max.apply(null,xs))/2;cy_pl=(Math.min.apply(null,ys)+Math.max.apply(null,ys))/2;}
  var flx,fly;
  if(pathEl.frameId){
    var fr=S.frames.find(function(f){return f.id===pathEl.frameId;});
    if(!fr)return{x:canvasX,y:canvasY};
    var fl=canvasToFrameLocal(canvasX,canvasY,fr);
    flx=fl.x;fly=fl.y;
  } else {
    flx=canvasX;fly=canvasY;
  }
  var rot=pathEl.rotation||0;
  if(!rot)return{x:flx,y:fly};
  var rad=(rot*Math.PI/180),cos=Math.cos(rad),sin=Math.sin(rad);
  var dx=flx-cx_pl,dy=fly-cy_pl;
  return{x:cx_pl+dx*cos+dy*sin,y:cy_pl-dx*sin+dy*cos};
}
function drawPenEditNodes(){
  dom.selOv.innerHTML='';
  var el=S.els.find(function(e){return e.id===S.penEditId});
  if(!el||!el.pts||!el.pts.length)return;
  var toCanvas=function(px,py){return pathLocalToCanvas(px,py,el);};
  var pathDCanvas=pathDToCanvas(el.d||'',el);
  var pathPrev=ns('path');
  pathPrev.setAttribute('d',pathDCanvas);pathPrev.setAttribute('fill','none');
  pathPrev.setAttribute('stroke','#7b61ff');pathPrev.setAttribute('stroke-width',1.5/S.zoom);
  pathPrev.setAttribute('stroke-dasharray',6/S.zoom+','+3/S.zoom);
  pathPrev.setAttribute('pointer-events','none');dom.selOv.appendChild(pathPrev);
  el.pts.forEach(function(pt,idx){
    function drawHandle(hx,hy,side){
      var c1=toCanvas(pt.x,pt.y),c2=toCanvas(hx,hy);
      var stem=ns('line');
      stem.setAttribute('x1',c1.x);stem.setAttribute('y1',c1.y);
      stem.setAttribute('x2',c2.x);stem.setAttribute('y2',c2.y);
      stem.setAttribute('stroke','rgba(123,97,255,0.7)');stem.setAttribute('stroke-width',1/S.zoom);
      stem.setAttribute('pointer-events','none');dom.selOv.appendChild(stem);
      var hs=4/S.zoom;
      var sq=ns('rect');
      sq.setAttribute('x',c2.x-hs);sq.setAttribute('y',c2.y-hs);
      sq.setAttribute('width',hs*2);sq.setAttribute('height',hs*2);
      sq.setAttribute('fill','#1c1c1e');sq.setAttribute('stroke','#7b61ff');
      sq.setAttribute('stroke-width',1.5/S.zoom);
      sq.setAttribute('transform','rotate(45 '+c2.x+' '+c2.y+')');
      sq.setAttribute('pointer-events','all');sq.style.cursor='crosshair';
      (function(i,s){
        sq.addEventListener('mousedown',function(ev){
          ev.stopPropagation();
          S.penEditSelNode=i;S.penEditDragHandleNode=i;S.penEditDragHandleSide=s;S.penEditDragMoved=false;
        });
      })(idx,side);
      dom.selOv.appendChild(sq);
    }
    if(pt.cx2!=null)drawHandle(pt.cx2,pt.cy2,'cp2');
    if(pt.cx1!=null)drawHandle(pt.cx1,pt.cy1,'cp1');
  });
  el.pts.forEach(function(pt,idx){
    var c=toCanvas(pt.x,pt.y);
    var isSel=S.penEditSelNodes.indexOf(idx)>=0;
    var hasHandles=pt.cx2!=null||pt.cx1!=null;
    var isSmooth=hasHandles&&pt.type==='smooth';
    var nodeClr=hasHandles?(isSmooth?'#3ecf8e':'#e8a020'):'#fff';
    var nd=ns('circle');
    nd.setAttribute('cx',c.x);nd.setAttribute('cy',c.y);nd.setAttribute('r',5/S.zoom);
    nd.setAttribute('fill',isSel?'#7b61ff':nodeClr);
    nd.setAttribute('stroke',isSel?'#fff':nodeClr);
    nd.setAttribute('stroke-width',1.5/S.zoom);
    nd.setAttribute('pointer-events','all');
    nd.classList.add('pen-edit-node');
    if(isSel)nd.classList.add('active-node');
    (function(i){
      nd.addEventListener('mousedown',function(ev){
        ev.stopPropagation();
        var alreadyIn=S.penEditSelNodes.indexOf(i)>=0;
        if(alreadyIn){
          if(ev.shiftKey){
            var idxIn=S.penEditSelNodes.indexOf(i);
            S.penEditSelNodes.splice(idxIn,1);
            S.penEditSelNode=S.penEditSelNodes.length?S.penEditSelNodes[0]:-1;
            drawPenEditNodes();return;
          }
          // click on selected node without Shift: keep selection, start drag (do not redraw — keeps node in DOM so dblclick fires)
        } else {
          if(ev.shiftKey){S.penEditSelNodes.push(i);}
          else{S.penEditSelNodes=[i];}
          drawPenEditNodes();
        }
        S.penEditSelNode=i;S.penEditDragNodeIdx=i;S.penEditDragMoved=false;
        var starts={};
        S.penEditSelNodes.forEach(function(ii){
          var p=el.pts[ii];
          starts[ii]={ox:p.x,oy:p.y,ocx1:p.cx1,ocy1:p.cy1,ocx2:p.cx2,ocy2:p.cy2};
        });
        S.penEditDragStart={starts:starts};
      });
      nd.addEventListener('dblclick',function(ev){
        ev.stopPropagation();penToggleNodeType(i);
      });
    })(idx);
    dom.selOv.appendChild(nd);
  });
}
function penToggleNodeType(idx){
  var el=S.els.find(function(e){return e.id===S.penEditId});
  if(!el||!el.pts)return;
  if(el.type==='line')return;
  var pt=el.pts[idx];
  var n=el.pts.length;
  var isClosed=el.d&&el.d.endsWith('Z');
  if(pt.cx2!=null||pt.cx1!=null){
    delete pt.cx1;delete pt.cy1;delete pt.cx2;delete pt.cy2;pt.type='corner';
  } else {
    var prev=idx>0?el.pts[idx-1]:(isClosed?el.pts[n-1]:null);
    var next=idx<n-1?el.pts[idx+1]:(isClosed?el.pts[0]:null);
    if(prev&&next){
      var chx=next.x-prev.x,chy=next.y-prev.y;
      var len=Math.sqrt(chx*chx+chy*chy)||1;
      var ux=chx/len,uy=chy/len;
      var d1=Math.sqrt((pt.x-prev.x)*(pt.x-prev.x)+(pt.y-prev.y)*(pt.y-prev.y));
      var d2=Math.sqrt((next.x-pt.x)*(next.x-pt.x)+(next.y-pt.y)*(next.y-pt.y));
      pt.cx1=pt.x-ux*d1/3;pt.cy1=pt.y-uy*d1/3;
      pt.cx2=pt.x+ux*d2/3;pt.cy2=pt.y+uy*d2/3;
    } else if(next){
      pt.cx2=pt.x+(next.x-pt.x)/3;pt.cy2=pt.y+(next.y-pt.y)/3;
      pt.cx1=pt.x-(next.x-pt.x)/6;pt.cy1=pt.y-(next.y-pt.y)/6;
    } else if(prev){
      pt.cx1=pt.x+(prev.x-pt.x)/3;pt.cy1=pt.y+(prev.y-pt.y)/3;
      pt.cx2=pt.x-(prev.x-pt.x)/6;pt.cy2=pt.y-(prev.y-pt.y)/6;
    }
    pt.type='smooth';
  }
  el.d=penPtsToD(el.pts,isClosed);
  var pDom=document.getElementById('g'+el.id);
  if(pDom){var pEl=pDom.querySelector('path');if(pEl)pEl.setAttribute('d',el.d);}
  drawPenEditNodes();snapshot();
}
function enterPenEditMode(elId){
  var el=S.els.find(function(e){return e.id===elId});
  if(!el)return;
  if(el.type==='line'){
    el.pts=[{x:el.x,y:el.y,type:'corner'},{x:el.x+(el.w||0),y:el.y+(el.h||0),type:'corner'}];
    el.d='M'+el.x+','+el.y+' L'+(el.x+(el.w||0))+','+(el.y+(el.h||0));
  }
  if(el.type!=='path'&&el.type!=='line')return;
  if(!el.pts||!el.pts.length)return;
  clearSel();
  var closed=el.d&&el.d.endsWith('Z');
  var b=pathTightBBox(el.pts,closed);
  S.penEditPathCenter={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};
  S.penEditId=elId;S.penEditSelNode=-1;S.penEditSelNodes=[];S.penEditDragNodeIdx=-1;S.penEditDragStart=null;
  drawPenEditNodes();
  toast(el.type==='line'?'Drag endpoints to edit line · Esc = exit':'Node Edit · drag nodes/handles · dblclick node = bezier toggle · Del = remove · Esc = exit');
}
function exitPenEditMode(){
  var id=S.penEditId;
  var el=id?S.els.find(function(e){return e.id===id}):null;
  if(el&&el.type==='line'&&el.pts&&el.pts.length>=2){
    el.x=el.pts[0].x;el.y=el.pts[0].y;
    el.w=el.pts[1].x-el.pts[0].x;el.h=el.pts[1].y-el.pts[0].y;
    delete el.pts;delete el.d;
    renderEl(el);
  }
  S.penEditId=null;S.penEditPathCenter=null;S.penEditSelNode=-1;S.penEditSelNodes=[];S.penEditDragNodeIdx=-1;S.penEditDragStart=null;
  S.penEditDragHandleNode=-1;S.penEditDragHandleSide='';S.penEditDragMoved=false;S.penEditMarquee=null;
  dom.selOv.innerHTML='';
  if(id)selectEl(id);
  snapshot();
}

// ── SELECTION OVERLAY ──
function drawSel(){
  updateExpBtn();
  if(S.penEditId)return;

  dom.selOv.innerHTML='';
  var ids=S.selIds.length?S.selIds:(S.selId?[S.selId]:[]);
  if(!ids.length)return;

if(ids.length===1){
    var id=ids[0];
    var el=S.els.find(function(e){return e.id===id});
    var fr=S.frames.find(function(f){return f.id===id});
    var gr=S.groups.find(function(g){return g.id===id});
    var T=el||fr||gr; if(!T)return;
    var isF=!!fr;
    var isTextEdit=T.type==='text'&&tedId===T.id&&dom.ted.style.display!=='none';
    var color=(isF||isTextEdit)?'#3ecf8e':'#7b61ff';

    var ab, w, h;
    if(T.type==='group'){
      var gbb=getGroupBBox(T);
      ab={x:gbb.x,y:gbb.y}; w=gbb.w||1; h=gbb.h||1;
    } else if(T.type==='path'&&T.pts&&T.pts.length){
      var bb=getBBox(T); ab={x:bb.x,y:bb.y}; w=bb.w; h=bb.h;
    } else if(T.type==='text'&&tedId===T.id&&dom.ted.style.display!=='none'){
      ab=absPos(T);
      w=dom.ted.offsetWidth/S.zoom;
      h=dom.ted.offsetHeight/S.zoom;
    } else if(T.type==='table'){
      var tbb=getBBox(T); ab={x:tbb.x,y:tbb.y}; w=tbb.w; h=tbb.h;
    } else {
      ab=absPos(T); w=T.w||0; h=T.h||0;
    }
    var rot=(T.type==='group')?0:(T.rotation||0);
    var cx=ab.x+w/2, cy=ab.y+h/2;
    var hw=w/2, hh=h/2;
    var sw=1/S.zoom, hs=7/S.zoom;

    // Outer group rotated around object centre
    var grp=ns('g');
    grp.setAttribute('transform','rotate('+rot+','+cx+','+cy+')');
    dom.selOv.appendChild(grp);

    // Bounding rect (in unrotated local space, tight to object)
    var r=ns('rect');
    r.setAttribute('x',ab.x); r.setAttribute('y',ab.y);
    r.setAttribute('width',w); r.setAttribute('height',h);
    r.setAttribute('rx',2/S.zoom); r.setAttribute('fill','none');
    r.setAttribute('stroke',color); r.setAttribute('stroke-width',sw);
    r.setAttribute('pointer-events','none');
    grp.appendChild(r);

    if(T.type!=='line'){
      // Resize handles at 8 corners/edges in unrotated space
      var hpts=[
        {x:ab.x,      y:ab.y,      d:'nw'},
        {x:ab.x+w/2,  y:ab.y,      d:'n'},
        {x:ab.x+w,    y:ab.y,      d:'ne'},
        {x:ab.x+w,    y:ab.y+h/2,  d:'e'},
        {x:ab.x+w,    y:ab.y+h,    d:'se'},
        {x:ab.x+w/2,  y:ab.y+h,    d:'s'},
        {x:ab.x,      y:ab.y+h,    d:'sw'},
        {x:ab.x,      y:ab.y+h/2,  d:'w'}
      ];
      var cursors={nw:'nwse-resize',n:'ns-resize',ne:'nesw-resize',e:'ew-resize',
                   se:'nwse-resize',s:'ns-resize',sw:'nesw-resize',w:'ew-resize'};

      hpts.forEach(function(hp){
        var hr=ns('rect');
        hr.setAttribute('x',hp.x-hs/2); hr.setAttribute('y',hp.y-hs/2);
        hr.setAttribute('width',hs); hr.setAttribute('height',hs);
        hr.setAttribute('rx',1.5/S.zoom);
        hr.setAttribute('fill','#fff'); hr.setAttribute('stroke',color);
        hr.setAttribute('stroke-width',sw); hr.style.cursor=cursors[hp.d];
        (function(dir,tgt,isFr){
          hr.addEventListener('mousedown',function(e){
            e.stopPropagation();
            S.resizing=true; S.resDir=dir; S.resEl=tgt;

            var pt=svgPt(e);

            // --- GROUP resize start ---
            if(tgt && tgt.type==='group'){
              var bb=getGroupBBox(tgt);
              // якорь = противоположная сторона/угол
              var ax = (dir.indexOf('w')>=0) ? (bb.x+bb.w) : bb.x;
              var ay = (dir.indexOf('n')>=0) ? (bb.y+bb.h) : bb.y;

              // соберем все элементы внутри группы (рекурсивно)
              function collectIds(g, out){
                out=out||[];
                g.children.forEach(function(cid){
                  var it=findAny(cid); if(!it) return;
                  out.push(it.id);
                  if(it.type==='group') collectIds(it, out);
                  // (фреймы можно тоже включать; на первом этапе ок)
                });
                return out;
              }
              var ids=collectIds(tgt, []);

              // сохраним оригинальные состояния (чтобы не копилось округление при drag)
              var orig={};
              ids.forEach(function(id){
                var it=findAny(id); if(!it) return;
                var snap={type:it.type, frameId:it.frameId||null};

                // абсолютная позиция для перерасчета локальных координат
                var ab = absPos(it);
                snap.absX = ab.x; snap.absY = ab.y;
                snap.w = it.w; snap.h = it.h;

                if(it.type==='path'){
                  snap.pts = deep(it.pts||[]);
                  snap.d = it.d||'';
                }
                orig[id]=snap;
              });

              S.resS={
                mx:pt.x,my:pt.y,
                bbx:bb.x,bby:bb.y,bbw:bb.w||1,bbh:bb.h||1,
                anchorX:ax, anchorY:ay,
                orig:orig
              };
              return;
            }
            // --- normal element/frame resize start ---
            var ab2=tgt.type==='path'?getBBox(tgt):absPos(tgt);
            var rw=tgt.type==='path'?(ab2.w||1):tgt.w;
            var rh=tgt.type==='path'?(ab2.h||1):tgt.h;
            S.resS={mx:pt.x,my:pt.y,ax:ab2.x,ay:ab2.y,w:rw,h:rh,
              origD:tgt.type==='path'?tgt.d:null,
              origPts:tgt.type==='path'?deep(tgt.pts):null};
          });
        })(hp.d, T, isF);
        grp.appendChild(hr);
      });

      // Rotation handle — above top-centre edge
      var rotOffset=20/S.zoom;
      var rotHx=ab.x+w/2, rotHy=ab.y-rotOffset;
      // Stem
      var stem=ns('line');
      stem.setAttribute('x1',ab.x+w/2); stem.setAttribute('y1',ab.y);
      stem.setAttribute('x2',rotHx);    stem.setAttribute('y2',rotHy+5/S.zoom);
      stem.setAttribute('stroke',color); stem.setAttribute('stroke-width',sw);
      stem.setAttribute('pointer-events','none');
      grp.appendChild(stem);
      // Handle circle
      var rh=ns('circle');
      rh.setAttribute('cx',rotHx); rh.setAttribute('cy',rotHy); rh.setAttribute('r',5/S.zoom);
      rh.setAttribute('fill','#fff'); rh.setAttribute('stroke',color); rh.setAttribute('stroke-width',sw);
      rh.style.cursor='crosshair';
      (function(tgt){
        rh.addEventListener('mousedown',function(e){
          e.stopPropagation();
          var ap=absPos(tgt);
          var bcx=ap.x+(tgt.w||0)/2, bcy=ap.y+(tgt.h||0)/2;
          S.rotating=true; S.rotEl=tgt;
          var pt=svgPt(e);
          S.rotS={cx:bcx,cy:bcy,startAngle:tgt.rotation||0,
                  initAngle:Math.atan2(pt.y-bcy,pt.x-bcx)*180/Math.PI};
        });
      })(T);
      grp.appendChild(rh);
    } else if(T.type==='line'&&T.locked!==true){
      // Редактирование линии как в Figma: две ручки на концах
      var eps=getLineEndpointsAbs(T);
      var lineColor=color;
      eps.forEach(function(p,idx){
        var circ=ns('circle');
        circ.setAttribute('cx',p.x);circ.setAttribute('cy',p.y);circ.setAttribute('r',5/S.zoom);
        circ.setAttribute('fill','#fff');circ.setAttribute('stroke',lineColor);circ.setAttribute('stroke-width',sw);
        circ.style.cursor='move';
        circ.setAttribute('pointer-events','all');
        (function(i,line){
          circ.addEventListener('mousedown',function(e){
            if(line.locked===true)return;
            e.stopPropagation();
            S.lineEditEndpoint=i;
            S.lineEditEl=line;
            var both=getLineEndpointsAbs(line);
            S.lineEditOther={x:both[1-i].x,y:both[1-i].y};
          });
        })(idx,T);
        grp.appendChild(circ);
      });
    }

  } else {
    // Multi-select: axis-aligned group box (no rotation)
    var gbb=getSelBBox(); if(!gbb)return;
    var sw=1/S.zoom;
    var r=ns('rect');
    r.setAttribute('x',gbb.x); r.setAttribute('y',gbb.y);
    r.setAttribute('width',gbb.w); r.setAttribute('height',gbb.h);
    r.setAttribute('rx',2/S.zoom); r.setAttribute('fill','none');
    r.setAttribute('stroke','#7b61ff'); r.setAttribute('stroke-width',sw);
    r.setAttribute('stroke-dasharray',6/S.zoom+','+3/S.zoom);
    r.setAttribute('pointer-events','none'); dom.selOv.appendChild(r);

    ids.forEach(function(id){
      var item=findAny(id);
      if(!item)return;

      var irot = (item.type==='group') ? 0 : (item.rotation||0);

      var iab, iw, ih;
      if(item.type==='group'){
        var gbb=getGroupBBox(item);
        iab={x:gbb.x,y:gbb.y}; iw=gbb.w||0; ih=gbb.h||0;
      } else if(item.type==='path'&&item.pts&&item.pts.length){
        var bb=getBBox(item);
        iab={x:bb.x,y:bb.y}; iw=bb.w||0; ih=bb.h||0;
      } else {
        iab=absPos(item); iw=item.w||0; ih=item.h||0;
      }

      var ig=ns('g');
      ig.setAttribute('transform','rotate('+irot+','+(iab.x+iw/2)+','+(iab.y+ih/2)+')');

      var ir=ns('rect');
      ir.setAttribute('x',iab.x); ir.setAttribute('y',iab.y);
      ir.setAttribute('width',iw); ir.setAttribute('height',ih);
      ir.setAttribute('rx',1/S.zoom); ir.setAttribute('fill','none');
      ir.setAttribute('stroke','rgba(123,97,255,0.5)'); ir.setAttribute('stroke-width',1/S.zoom);
      ir.setAttribute('pointer-events','none');
      ig.appendChild(ir); dom.selOv.appendChild(ig);

      // Swap badge on each item (active = swap source selected)
      var isActive=(S.swapSrc===id);
      var br=9/S.zoom, sc2=br*0.5, ah2=sc2*0.4;
      var badge=ns('circle');
      badge.setAttribute('cx',iab.x+iw/2);badge.setAttribute('cy',iab.y+ih/2);badge.setAttribute('r',br);
      badge.setAttribute('fill',isActive?'#7b61ff':'#1c1c1e');
      badge.setAttribute('stroke',isActive?'#fff':'#7b61ff');
      badge.setAttribute('stroke-width',1.5/S.zoom);badge.style.cursor='pointer';
      dom.selOv.appendChild(badge);

      // Arrows icon inside badge
      var bgi=ns('g');
      bgi.setAttribute('transform','translate('+(iab.x+iw/2)+','+(iab.y+ih/2)+')');
      bgi.setAttribute('pointer-events','none');
      var iconColor=isActive?'#fff':'#7b61ff';
      var ad='M'+(-sc2)+','+(-sc2*0.38)+' H'+sc2+
             ' M'+(sc2-ah2)+','+(-sc2*0.38-ah2*0.65)+' L'+sc2+','+(-sc2*0.38)+' L'+(sc2-ah2)+','+(-sc2*0.38+ah2*0.65)+
             ' M'+sc2+','+(sc2*0.38)+' H'+(-sc2)+
             ' M'+(-sc2+ah2)+','+(sc2*0.38-ah2*0.65)+' L'+(-sc2)+','+(sc2*0.38)+' L'+(-sc2+ah2)+','+(sc2*0.38+ah2*0.65);
      var aic=ns('path');aic.setAttribute('d',ad);aic.setAttribute('fill','none');
      aic.setAttribute('stroke',iconColor);aic.setAttribute('stroke-width',1.1/S.zoom);
      aic.setAttribute('stroke-linecap','round');aic.setAttribute('stroke-linejoin','round');
      bgi.appendChild(aic);dom.selOv.appendChild(bgi);

      (function(itemId){
        badge.addEventListener('mousedown',function(e){e.stopPropagation();});
        badge.addEventListener('click',function(e){
          e.stopPropagation();
          if(!S.swapSrc){
            S.swapSrc=itemId; drawSel();
          } else if(S.swapSrc===itemId){
            S.swapSrc=null; drawSel();
          } else {
            var a=findAny(S.swapSrc),b=findAny(itemId);
            S.swapSrc=null;
            if(a&&b)swapEls(a,b);
          }
        });
      })(id);
    });

    // For exactly 2 items: also show quick-swap button at midpoint
    if(ids.length===2){
      var it1=findAny(ids[0]),it2=findAny(ids[1]);
      if(it1&&it2){
        var bb1=(it1.type==='group')?getGroupBBox(it1):getBBox(it1);
        var bb2=(it2.type==='group')?getGroupBBox(it2):getBBox(it2);
        var midX=(bb1.x+bb1.w/2+bb2.x+bb2.w/2)/2;
        var midY=(bb1.y+bb1.h/2+bb2.y+bb2.h/2)/2;
        var btnR=10/S.zoom,sc=btnR*0.48,ah=sc*0.38;
        var btnBg=ns('circle');
        btnBg.setAttribute('cx',midX);btnBg.setAttribute('cy',midY);btnBg.setAttribute('r',btnR);
        btnBg.setAttribute('fill','#1c1c1e');btnBg.setAttribute('stroke','#3ecf8e');
        btnBg.setAttribute('stroke-width',1.5/S.zoom);dom.selOv.appendChild(btnBg);
        var g2=ns('g');g2.setAttribute('transform','translate('+midX+','+midY+')');
        g2.setAttribute('pointer-events','none');
        var d2='M'+(-sc)+','+(-sc*0.38)+' H'+sc+
               ' M'+(sc-ah)+','+(-sc*0.38-ah*0.65)+' L'+sc+','+(-sc*0.38)+' L'+(sc-ah)+','+(-sc*0.38+ah*0.65)+
               ' M'+sc+','+(sc*0.38)+' H'+(-sc)+
               ' M'+(-sc+ah)+','+(sc*0.38-ah*0.65)+' L'+(-sc)+','+(sc*0.38)+' L'+(-sc+ah)+','+(sc*0.38+ah*0.65);
        var ar2=ns('path');ar2.setAttribute('d',d2);ar2.setAttribute('fill','none');
        ar2.setAttribute('stroke','#3ecf8e');ar2.setAttribute('stroke-width',1.2/S.zoom);
        ar2.setAttribute('stroke-linecap','round');ar2.setAttribute('stroke-linejoin','round');
        g2.appendChild(ar2);dom.selOv.appendChild(g2);
        var btnHit=ns('circle');
        btnHit.setAttribute('cx',midX);btnHit.setAttribute('cy',midY);btnHit.setAttribute('r',btnR);
        btnHit.setAttribute('fill','transparent');btnHit.style.cursor='pointer';
        (function(a,b){
          btnHit.addEventListener('mousedown',function(e){e.stopPropagation();});
          btnHit.addEventListener('click',function(e){e.stopPropagation();S.swapSrc=null;swapEls(a,b);});
        })(it1,it2);
        dom.selOv.appendChild(btnHit);
      }
    }
  }
}
function getSelBBox(){
  if(!S.selIds.length)return null;
  var x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;

  S.selIds.forEach(function(id){
    var item=findAny(id); if(!item)return;
    var bb = (item.type==='group') ? getGroupBBox(item) : getBBox(item);
    x1=Math.min(x1,bb.x); y1=Math.min(y1,bb.y);
    x2=Math.max(x2,bb.x+bb.w); y2=Math.max(y2,bb.y+bb.h);
  });

  if(x1===Infinity)return null;
  return {x:x1,y:y1,w:x2-x1,h:y2-y1};
}

// ── CANVAS EVENTS ──
if(dom.canvas)dom.canvas.addEventListener('mousedown',function(e){
  if(e.target===dom.ted)return; commitText();
  if(S.tool==='eyedropper'){
    var color=edSampleAt(e.clientX,e.clientY);
    if(color){
      var ids=S.selIds.length?S.selIds:(S.selId?[S.selId]:[]);
      if(ids.length){
        ids.forEach(function(id){
          var item=findAny(id);if(!item)return;
          if(S.frames.indexOf(item)>=0){item.fill=color;renderFrame(item);}
          else{item.fill=color;renderEl(item);}
        });
        refreshProps();snapshot();toast('Fill \u2192 '+color);
      }
    }
    setTool(S._prevTool||'select');
    return;
  }
  var pt=svgPt(e);
  if(S.tool==='hand'){S.panning=true;dom.canvas.style.cursor='grabbing';S.panS={mx:e.clientX,my:e.clientY,px:S.px,py:S.py};return;}
  if(S.penEditId){
    // Start marquee selection (drag to select nodes by box)
    S.penEditMarquee={x1:pt.x,y1:pt.y,x2:pt.x,y2:pt.y,addToSel:!!(e.shiftKey||e.ctrlKey||e.metaKey)};
    var mr=ns('rect');mr.setAttribute('class','pen-edit-marquee');mr.setAttribute('fill','rgba(123,97,255,0.12)');mr.setAttribute('stroke','#7b61ff');mr.setAttribute('stroke-width',1.5/S.zoom);mr.setAttribute('pointer-events','none');
    mr.setAttribute('x',pt.x);mr.setAttribute('y',pt.y);mr.setAttribute('width',0);mr.setAttribute('height',0);
    dom.selOv.insertBefore(mr,dom.selOv.firstChild);
    return;
  }
  if(S.tool==='pen'){
    if(!S.penActive)penStart();
    var sp2=snapPt(pt);
    if(S.penPts.length>2){
      var fp=S.penPts[0],ddx=sp2.x-fp.x,ddy=sp2.y-fp.y;
      if(Math.sqrt(ddx*ddx+ddy*ddy)<12/S.zoom){penCommit(true);return;}
    }
    S.penPts.push({x:sp2.x,y:sp2.y});
    if(penPreview)penPreview.setAttribute('d',penPtsToD(S.penPts,false));
    var nd=ns('circle');nd.setAttribute('cx',sp2.x);nd.setAttribute('cy',sp2.y);nd.setAttribute('r',4/S.zoom);
    nd.setAttribute('fill','#fff');nd.setAttribute('stroke',S.defFill);nd.setAttribute('stroke-width',1.5/S.zoom);
    nd.setAttribute('pointer-events','all');nd.classList.add('pen-node');
    (function(idx){nd.addEventListener('click',function(ev){ev.stopPropagation();if(idx===0&&S.penPts.length>2)penCommit(true);});})(S.penPts.length-1);
    dom.selOv.appendChild(nd);
    return;
  }
  if(S.tool==='select'){
    var t=e.target;
    var svgRoot=document.getElementById('svg');
    var clickOnEmpty=(t===canvas)||(t===svgRoot);
    if(clickOnEmpty){
      S.bandAdd=(e.shiftKey||e.ctrlKey||e.metaKey);
      if(!S.bandAdd)clearSel();
      S.bandSel=true;
      var cr=dom.canvas.getBoundingClientRect();
      S.bandStart={cx:e.clientX-cr.left,cy:e.clientY-cr.top};
      dom.bandRect.style.left=S.bandStart.cx+'px';dom.bandRect.style.top=S.bandStart.cy+'px';
      dom.bandRect.style.width='0';dom.bandRect.style.height='0';
      dom.bandRect.style.display='block';
    }
    return;
  }
  if(S.tool==='text'){
    var sp=snapPt(pt);
    S.textDraw={x:sp.x,y:sp.y,area:false};
    dom.ghostEllipse.style.display='none'; dom.ghost.style.display='';
 dom.ghost.setAttribute('x',sp.x);dom.ghost.setAttribute('y',sp.y);dom.ghost.setAttribute('width',1);dom.ghost.setAttribute('height',1);
    return;
  }
  if(S.tool==='table'){
    var sp=snapPt(pt);
    var fr=frameAt(sp.x,sp.y);
    S.tableCreatePending={sp:sp,fr:fr};
    var tcm=document.getElementById('table-create-modal');
    var tri=document.getElementById('table-rows-input');
    var tci=document.getElementById('table-cols-input');
    if(tcm&&tri&&tci){ tri.value='3'; tci.value='3'; tcm.style.display='flex'; tri.focus(); }
    return;
  }
  if(S.tool==='image')return;
  if(S.tool==='frame'){
    var sp=snapPt(pt); S.frameDraw=true; S.ds=sp; dom.fghost.style.display='';
    dom.fghost.setAttribute('x',sp.x);dom.fghost.setAttribute('y',sp.y);dom.fghost.setAttribute('width',1);dom.fghost.setAttribute('height',1); return;
  }
  var sp=snapPt(pt); S.drawing=true; S.ds=sp;
  if(S.tool==='line'){
 dom.ghost.style.display='none'; dom.ghostEllipse.style.display='none'; dom.ghostLine.style.display='';
    dom.ghostLine.setAttribute('x1',sp.x);dom.ghostLine.setAttribute('y1',sp.y);dom.ghostLine.setAttribute('x2',sp.x);dom.ghostLine.setAttribute('y2',sp.y);
  } else if(S.tool==='ellipse'){
 dom.ghost.style.display='none'; dom.ghostEllipse.style.display=''; dom.ghostLine.style.display='none';
    dom.ghostEllipse.setAttribute('cx',sp.x);dom.ghostEllipse.setAttribute('cy',sp.y);dom.ghostEllipse.setAttribute('rx',0.5);dom.ghostEllipse.setAttribute('ry',0.5);
  } else {
    dom.ghostEllipse.style.display='none'; dom.ghostLine.style.display='none'; dom.ghost.style.display='';
 dom.ghost.setAttribute('x',sp.x);dom.ghost.setAttribute('y',sp.y);dom.ghost.setAttribute('width',1);dom.ghost.setAttribute('height',1);
  }
});

if(dom.canvas)dom.canvas.addEventListener('dblclick',function(e){
  if(S.penEditId){
    exitPenEditMode();
    e.preventDefault();
    e.stopPropagation();
  }
});

if(dom.canvas)dom.canvas.addEventListener('mousemove',function(e){
  if(S.tool==='eyedropper'){edBadgeUpdate(e);return;}
  if(S.lineEditEndpoint!==undefined&&S.lineEditEl){
    var pt=svgPt(e),sp=snapPt(pt);
    var line=S.lineEditEl;
    var i=S.lineEditEndpoint;
    var other=S.lineEditOther;
    var p0=i===0?sp:other,p1=i===1?sp:other;
    if(line.frameId){
      var pf=S.frames.find(function(f){return f.id===line.frameId;});
      if(pf){var pa=absPos(pf);
        line.x=p0.x-pa.x;line.y=p0.y-pa.y;
        line.w=p1.x-p0.x;line.h=p1.y-p0.y;
      }
    } else {
      line.x=p0.x;line.y=p0.y;line.w=p1.x-p0.x;line.h=p1.y-p0.y;
    }
    renderEl(line);drawSel();
    return;
  }
  if(S.penEditId&&S.penEditMarquee){
    var pt=svgPt(e);
    S.penEditMarquee.x2=pt.x;S.penEditMarquee.y2=pt.y;
    var mr=dom.selOv.querySelector('.pen-edit-marquee');
    if(mr){
      var x1=S.penEditMarquee.x1,y1=S.penEditMarquee.y1,x2=S.penEditMarquee.x2,y2=S.penEditMarquee.y2;
      var x=Math.min(x1,x2),y=Math.min(y1,y2),w=Math.abs(x2-x1),h=Math.abs(y2-y1);
      mr.setAttribute('x',x);mr.setAttribute('y',y);mr.setAttribute('width',w);mr.setAttribute('height',h);
    }
    return;
  }
  if(S.penEditId&&S.penEditDragHandleNode>=0){
    var pt=svgPt(e),sp=snapPt(pt);
    var el=S.els.find(function(e2){return e2.id===S.penEditId});
    if(el&&el.pts&&el.pts[S.penEditDragHandleNode]){
      var loc=canvasToPathLocal(sp.x,sp.y,el);
      var node=el.pts[S.penEditDragHandleNode];
      if(e.altKey&&node.type==='smooth'){node.type='corner';} // Alt breaks symmetry
      if(S.penEditDragHandleSide==='cp2'){
        node.cx2=loc.x;node.cy2=loc.y;
        if(node.type==='smooth'){node.cx1=2*node.x-loc.x;node.cy1=2*node.y-loc.y;}
      } else {
        node.cx1=loc.x;node.cy1=loc.y;
        if(node.type==='smooth'){node.cx2=2*node.x-loc.x;node.cy2=2*node.y-loc.y;}
      }
      S.penEditDragMoved=true;
      var isClosed=el.d&&el.d.endsWith('Z');el.d=penPtsToD(el.pts,isClosed);
      var pDom=document.getElementById('g'+el.id);
      if(pDom){var pEl=pDom.querySelector('path');if(pEl)pEl.setAttribute('d',el.d);}
      drawPenEditNodes();
    }
    return;
  }
  if(S.penEditId&&S.penEditDragNodeIdx>=0&&S.penEditDragStart&&S.penEditDragStart.starts){
    var pt=svgPt(e),sp=snapPt(pt);
    var el=S.els.find(function(e2){return e2.id===S.penEditId});
    if(el&&el.pts&&el.pts[S.penEditDragNodeIdx]){
      var loc=canvasToPathLocal(sp.x,sp.y,el);
      var ds=S.penEditDragStart;
      var o=ds.starts[S.penEditDragNodeIdx];
      var ddx=loc.x-o.ox,ddy=loc.y-o.oy;
      S.penEditSelNodes.forEach(function(idx){
        var node=el.pts[idx];
        var s=ds.starts[idx];
        if(!node||!s)return;
        node.x=s.ox+ddx;node.y=s.oy+ddy;
        if(s.ocx1!=null){node.cx1=s.ocx1+ddx;node.cy1=s.ocy1+ddy;}
        if(s.ocx2!=null){node.cx2=s.ocx2+ddx;node.cy2=s.ocy2+ddy;}
      });
      S.penEditDragMoved=true;
      var isClosed=el.d&&el.d.endsWith('Z');el.d=penPtsToD(el.pts,isClosed);
      if(el.type==='line'&&el.pts.length===2){
        el.x=el.pts[0].x;el.y=el.pts[0].y;el.w=el.pts[1].x-el.pts[0].x;el.h=el.pts[1].y-el.pts[0].y;
        renderEl(el);
      } else {
        var pDom=document.getElementById('g'+el.id);
        if(pDom){var pEl=pDom.querySelector('path');if(pEl)pEl.setAttribute('d',el.d);}
      }
      drawPenEditNodes();
    }
    return;
  }
  if(S.tool==='pen'&&S.penActive&&S.penPts.length>0){
    var pt2=svgPt(e);penUpdatePreview(pt2.x,pt2.y);
  }
  if(S.panning){S.px=S.panS.px+(e.clientX-S.panS.mx);S.py=S.panS.py+(e.clientY-S.panS.my);applyTr();return;}
  if(S.dragging&&S.dragEl){
        // ---- MULTI DRAG ----
    if(S.dragMulti && S.dragMulti.ids && S.dragMulti.ids.length){
      var pt=svgPt(e);
      var dx = pt.x - S.dragMulti.start.mx;
      var dy = pt.y - S.dragMulti.start.my;

      // SHIFT = lock axis (works also with ALT+SHIFT)
      if(e.shiftKey){
        if(Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }

      // snap delta (как в figma: snap на перемещение)
      dx = snapV(dx);
      dy = snapV(dy);

      S.dragMulti.lastDx = dx;
      S.dragMulti.lastDy = dy;

      // двигаем каждый объект
      S.dragMulti.ids.forEach(function(id){
        var it=findAny(id); if(!it) return;
        var o=S.dragMulti.orig[id]; if(!o) return;

        // groups: только transform до mouseup
        if(it.type==='group'){
          var domGG=document.getElementById('gg'+it.id);
          if(domGG) domGG.setAttribute('transform','translate('+dx+','+dy+')');
          return;
        }

        // paths: transform до mouseup, сохраняем rotation
        if(it.type==='path'){
          var domP=document.getElementById('g'+it.id);
          if(domP){
            var rot=it.rotation||0;
            var pbbM=getBBox(it);
            var rcxM=pbbM.x+pbbM.w/2, rcyM=pbbM.y+pbbM.h/2;
            if(it.frameId){
              var _pfrM=S.frames.find(function(f){return f.id===it.frameId;});
              if(_pfrM){var _pabsM=absPos(_pfrM);rcxM-=_pabsM.x;rcyM-=_pabsM.y;}
            }
            var trStrM='translate('+dx+','+dy+')';
            if(rot)trStrM+=' rotate('+rot+','+rcxM+','+rcyM+')';
            domP.setAttribute('transform',trStrM);
          }
          return;
        }

        // обычные элементы/фреймы — запекаем сразу в x/y
        var newAbsX = o.absX + dx;
        var newAbsY = o.absY + dy;

        if(it.frameId){
          var pf=S.frames.find(function(f){return f.id===it.frameId});
          var pAbs = pf ? absPos(pf) : {x:0,y:0};
          it.x = newAbsX - pAbs.x;
          it.y = newAbsY - pAbs.y;
        } else {
          it.x = newAbsX;
          it.y = newAbsY;
        }

        if(it.type==='frame') renderFrame(it);
        else renderEl(it);
      });

      // hover frame highlight по primary
      var pIt=findAny(S.dragMulti.primaryId);
      if(pIt){
        var pA=getItemAbsXY(pIt);
        var cx=pA.x + (pA.w||0)/2 + dx;
        var cy=pA.y + (pA.h||0)/2 + dy;

        var hovFr=null;
        for(var fi=S.frames.length-1;fi>=0;fi--){
          var ff=S.frames[fi];
          var ffAb=absPos(ff);
          if(cx>=ffAb.x&&cx<=ffAb.x+ff.w&&cy>=ffAb.y&&cy<=ffAb.y+ff.h){hovFr=ff;break;}
        }
        setDropTarget(hovFr?hovFr.id:null);
      }

      dom.selOv.innerHTML='';
      drawSel(); refreshProps();
      return;
    }
    // ---- /MULTI DRAG ----
    var pt=svgPt(e),dx=pt.x-S.dragS.mx,dy=pt.y-S.dragS.my;
    if(S.dragging&&S.dragEl){
      console.log('drag move', S.dragEl.type, S.dragEl.id, dx, dy);
    }
    var isFr=S.frames.indexOf(S.dragEl)>=0;
    if(isFr){
      console.log('drag: isFr branch', S.dragEl.id);
      var nx=snapV(S.dragS.ox+dx);
      var ny=snapV(S.dragS.oy+dy);
      var sg=applySmartGuides(S.dragEl,nx,ny);
      console.log('before move', S.dragEl.type, S.dragEl.x, S.dragEl.y);
      S.dragEl.x=nx+sg.dx;
      S.dragEl.y=ny+sg.dy;
      console.log('after move', S.dragEl.type, S.dragEl.x, S.dragEl.y);
      renderFrame(S.dragEl);
    } else {
      var nx,ny,absX,absY;
      var isGroup=S.groups.indexOf(S.dragEl)>=0;
      var isPath=S.dragEl.type==='path';
      console.log('single-drag else', S.dragEl.id, S.dragEl.type, 'isGroup='+isGroup, 'isPath='+isPath, 'frameId='+S.dragEl.frameId);
      if(isGroup){
        console.log('drag: isGroup branch', S.dragEl.id);
        // Move group: translate SVG transform, update state on mouseup
        nx=snapV(S.dragS.ox+dx); ny=snapV(S.dragS.oy+dy);
        var ddx=nx-S.dragS.ox, ddy=ny-S.dragS.oy;
        var domGG=document.getElementById('gg'+S.dragEl.id);
        if(domGG){
          var bx = S.dragS.baseTx||0, by = S.dragS.baseTy||0;
          domGG.setAttribute('transform','translate('+ddx+','+ddy+')');
        }
        absX=nx; absY=ny;
      } else if(isPath){
        console.log('drag: isPath branch', S.dragEl.id);
        // Move path: translate SVG transform, preserve rotation; update pts on mouseup
        nx=snapV(S.dragS.ox+dx); ny=snapV(S.dragS.oy+dy);
        var ddxp=nx-S.dragS.ox, ddyp=ny-S.dragS.oy;
        var domP=document.getElementById('g'+S.dragEl.id);
        if(domP){
          var rot=S.dragEl.rotation||0;
          var pbb2=getBBox(S.dragEl);
          var rcx=pbb2.x+pbb2.w/2, rcy=pbb2.y+pbb2.h/2;
          if(S.dragEl.frameId){
            var _pfr=S.frames.find(function(f){return f.id===S.dragEl.frameId;});
            if(_pfr){var _pabs=absPos(_pfr);rcx-=_pabs.x;rcy-=_pabs.y;}
          }
          var trStr='translate('+ddxp+','+ddyp+')';
          if(rot)trStr+=' rotate('+rot+','+rcx+','+rcy+')';
          domP.setAttribute('transform',trStr);
        }
        absX=nx; absY=ny;
        var pbb=getBBox(S.dragEl);
        var cx2p=absX+pbb.w/2, cy2p=absY+pbb.h/2;
        var hovFrP=null;
        for(var fip=S.frames.length-1;fip>=0;fip--){
          var ffp=S.frames[fip];
          if(ffp.id===S.dragEl.frameId)continue;
          var ffAbP=absPos(ffp);
          if(cx2p>=ffAbP.x&&cx2p<=ffAbP.x+ffp.w&&cy2p>=ffAbP.y&&cy2p<=ffAbP.y+ffp.h){hovFrP=ffp;break;}
        }
        setDropTarget(hovFrP?hovFrP.id:null);
      } else if(S.dragEl.frameId){
        var pf=S.frames.find(function(f){return f.id===S.dragEl.frameId});
        var fc=getFCG(S.dragEl.frameId);
        if(pf&&fc){
          var rawRelX=S.dragS.rx+dx, rawRelY=S.dragS.ry+dy;
          nx=snapV(rawRelX); ny=snapV(rawRelY);
          console.log('before move (inFrame)', S.dragEl.id, S.dragEl.x, S.dragEl.y);
          S.dragEl.x=nx; S.dragEl.y=ny;
          console.log('after move (inFrame)', S.dragEl.id, S.dragEl.x, S.dragEl.y);
          absX=pf.x+nx; absY=pf.y+ny;
        } else {
          nx=snapV(S.dragS.ox+dx); ny=snapV(S.dragS.oy+dy);
          var sg=applySmartGuides(S.dragEl,nx,ny);
          console.log('before move (pf null)', S.dragEl.id, S.dragEl.x, S.dragEl.y);
          S.dragEl.x=nx+sg.dx; S.dragEl.y=ny+sg.dy;
          console.log('after move (pf null)', S.dragEl.id, S.dragEl.x, S.dragEl.y);
          absX=S.dragEl.x; absY=S.dragEl.y;
        }
      } else {
        nx=snapV(S.dragS.ox+dx); ny=snapV(S.dragS.oy+dy);
        console.log('before move (loose)', S.dragEl.id, S.dragEl.x, S.dragEl.y, 'nx=', nx, 'ny=', ny);
        try {
          var sg=applySmartGuides(S.dragEl,nx,ny);
          S.dragEl.x=nx+sg.dx; S.dragEl.y=ny+sg.dy;
          console.log('after move (loose)', S.dragEl.id, S.dragEl.x, S.dragEl.y);
        } catch(err){
          console.error('loose drag error', err);
          S.dragEl.x=nx; S.dragEl.y=ny;
        }
        absX=S.dragEl.x; absY=S.dragEl.y;
      }
      if(!isPath){
  // для group и обычных элементов одинаково
  var w = S.dragEl.w||0, h = S.dragEl.h||0;
  // у group w/h обновляется через renderGroup, но на drag мы можем взять bbox
  if(isGroup){
    var bb=getGroupBBox(S.dragEl);
    w=bb.w||1; h=bb.h||1;
  }
  var cx2=(absX||S.dragEl.x)+w/2, cy2=(absY||S.dragEl.y)+h/2;

  var hovFr=null;
  for(var fi=S.frames.length-1;fi>=0;fi--){
    var ff=S.frames[fi];
    if(ff.id===S.dragEl.frameId)continue;
    var ffAb=absPos(ff);
    if(cx2>=ffAb.x&&cx2<=ffAb.x+ff.w&&cy2>=ffAb.y&&cy2<=ffAb.y+ff.h){hovFr=ff;break;}
  }
  setDropTarget(hovFr?hovFr.id:null);

  // рендерим только не-group (group двигается transform-ом до mouseup)
  if(!isGroup) renderEl(S.dragEl);
}
    }
    dom.selOv.innerHTML=''; refreshProps(); return;
  }
  if(S.rotating&&S.rotEl){
    var pt=svgPt(e);
    var rs=S.rotS;
    var curAngle=Math.atan2(pt.y-rs.cy,pt.x-rs.cx)*180/Math.PI;
    var delta=curAngle-rs.initAngle;
    var newRot=rs.startAngle+delta;
    if(e.shiftKey)newRot=Math.round(newRot/15)*15; // snap to 15°
    S.rotEl.rotation=((newRot%360)+360)%360;
    if(S.frames.find(function(f){return f.id===S.rotEl.id;}))renderFrame(S.rotEl);
    else renderEl(S.rotEl);
    drawSel();refreshProps();return;
  }
  if(S.resizing&&S.resEl){
    var pt=svgPt(e),rs=S.resS,el2=S.resEl,d=S.resDir;
    var dx=pt.x-rs.mx,dy=pt.y-rs.my;
    var shiftLock=e.shiftKey;
      // --- GROUP scaling ---
  if(el2 && el2.type==='group'){
    var bbx=rs.bbx, bby=rs.bby, bbw=rs.bbw, bbh=rs.bbh;
    var nx=bbx, ny=bby, nw=bbw, nh=bbh;

    // считаем новый bbox по dir
    if(d.indexOf('e')>=0) nw = Math.max(1, snapV(bbw + dx));
    if(d.indexOf('s')>=0) nh = Math.max(1, snapV(bbh + dy));
    if(d.indexOf('w')>=0){
      nx = snapV(bbx + dx);
      nw = Math.max(1, (bbx+bbw) - nx);
    }
    if(d.indexOf('n')>=0){
      ny = snapV(bby + dy);
      nh = Math.max(1, (bby+bbh) - ny);
    }

    if(shiftLock&&bbw&&bbh){
      var s=Math.min(nw/bbw,nh/bbh);
      s=Math.max(s,1/bbw,1/bbh);
      nw=snapV(bbw*s); nh=snapV(bbh*s);
      var ax0=rs.anchorX,ay0=rs.anchorY;
      nx=(d.indexOf('w')>=0)?ax0-nw:ax0;
      ny=(d.indexOf('n')>=0)?ay0-nh:ay0;
    }

    var sx = nw / (bbw||1);
    var sy = nh / (bbh||1);

    var ax0 = rs.anchorX, ay0 = rs.anchorY;

    // применяем scale ко всем сохраненным оригиналам
    Object.keys(rs.orig).forEach(function(id){
      var snap=rs.orig[id];
      var it=findAny(id); if(!it) return;

      if(snap.type==='path'){
        if(it.importedSVG){
          var scM2=[sx,0,0,sy,ax0*(1-sx),ay0*(1-sy)];
          it.d=svgTransformD(snap.d,scM2);
          it.pts=extractPtsFromD(it.d);
        }else{
          it.pts=(snap.pts||[]).map(function(p){
            var np=deep(p);
            np.x=ax0+(p.x-ax0)*sx;np.y=ay0+(p.y-ay0)*sy;
            if(np.cx1!=null){np.cx1=ax0+(p.cx1-ax0)*sx;np.cy1=ay0+(p.cy1-ay0)*sy;}
            if(np.cx2!=null){np.cx2=ax0+(p.cx2-ax0)*sx;np.cy2=ay0+(p.cy2-ay0)*sy;}
            return np;
          });
          it.d=penPtsToD(it.pts,it.d&&it.d.endsWith('Z'));
        }
        renderEl(it);
        return;
      }

      // новое ABS положение
      var newAbsX = ax0 + (snap.absX-ax0)*sx;
      var newAbsY = ay0 + (snap.absY-ay0)*sy;

      // размеры
      if(it.type==='line'){
        // линия: w/h — это вектор
        it.w = (snap.w||0) * sx;
        it.h = (snap.h||0) * sy;
      } else {
        it.w = (snap.w||0) * sx;
        it.h = (snap.h||0) * sy;
      }

      // обратно в local координаты (если внутри фрейма)
      if(snap.frameId){
        var pf=S.frames.find(function(f){return f.id===snap.frameId});
        var pAbs = pf ? absPos(pf) : {x:0,y:0};
        it.x = newAbsX - pAbs.x;
        it.y = newAbsY - pAbs.y;
      } else {
        it.x = newAbsX;
        it.y = newAbsY;
      }

      // перерисовка
      if(it.type==='frame') renderFrame(it);
      else if(it.type==='group') renderGroup(it);
      else renderEl(it);
    });

    // перерисовать саму группу (bbox + hitrect)
    renderGroup(el2);

    drawSel(); refreshProps(); 
    return;
  }
  // --- /GROUP scaling ---
    var isFr=S.frames.indexOf(el2)>=0;
    var ax=rs.ax,ay=rs.ay,aw=rs.w,ah=rs.h;
    if(d.indexOf('e')>=0)aw=Math.max(1,snapV(rs.w+dx));
    if(d.indexOf('s')>=0)ah=Math.max(1,snapV(rs.h+dy));
    if(d.indexOf('w')>=0){ax=snapV(rs.ax+dx);aw=Math.max(1,rs.w+(rs.ax-ax));}
    if(d.indexOf('n')>=0){ay=snapV(rs.ay+dy);ah=Math.max(1,rs.h+(rs.ay-ay));}
    if(shiftLock&&rs.w&&rs.h){
      var s=Math.min(aw/rs.w,ah/rs.h);
      s=Math.max(s,1/rs.w,1/rs.h);
      aw=snapV(rs.w*s); ah=snapV(rs.h*s);
      ax=(d.indexOf('w')>=0)?(rs.ax+rs.w-aw):rs.ax;
      ay=(d.indexOf('n')>=0)?(rs.ay+rs.h-ah):rs.ay;
    }
    if(el2.type==='path'){
      var sx2=aw/(rs.w||1),sy2=ah/(rs.h||1);
      var ancX=d.indexOf('w')>=0?rs.ax+rs.w:rs.ax;
      var ancY=d.indexOf('n')>=0?rs.ay+rs.h:rs.ay;
      if(el2.importedSVG){
        var scM=[sx2,0,0,sy2,ancX*(1-sx2),ancY*(1-sy2)];
        el2.d=svgTransformD(rs.origD,scM);
        el2.pts=extractPtsFromD(el2.d);
      }else{
        el2.pts=(rs.origPts||[]).map(function(p){
          var np=deep(p);
          np.x=ancX+(p.x-ancX)*sx2;np.y=ancY+(p.y-ancY)*sy2;
          if(np.cx1!=null){np.cx1=ancX+(p.cx1-ancX)*sx2;np.cy1=ancY+(p.cy1-ancY)*sy2;}
          if(np.cx2!=null){np.cx2=ancX+(p.cx2-ancX)*sx2;np.cy2=ancY+(p.cy2-ancY)*sy2;}
          return np;
        });
        el2.d=penPtsToD(el2.pts,el2.d&&el2.d.endsWith('Z'));
      }
      renderEl(el2);drawSel();refreshProps();return;
    }
    if(isFr){el2.x=ax;el2.y=ay;el2.w=aw;el2.h=ah;renderFrame(el2);}
    else{
      if(el2.frameId){var pf=S.frames.find(function(f){return f.id===el2.frameId});if(pf){el2.x=ax-pf.x;el2.y=ay-pf.y;}}else{el2.x=ax;el2.y=ay;}
      el2.w=aw;el2.h=ah;renderEl(el2);
    }
    drawSel(); refreshProps(); return;
  }
  if(S.bandSel&&S.bandStart){
    var cr=dom.canvas.getBoundingClientRect(),cx=e.clientX-cr.left,cy=e.clientY-cr.top;
    var bx=Math.min(cx,S.bandStart.cx),by=Math.min(cy,S.bandStart.cy);
    var bw=Math.abs(cx-S.bandStart.cx),bh=Math.abs(cy-S.bandStart.cy);
    if(bw>4||bh>4){dom.bandRect.style.display='block';dom.bandRect.style.left=bx+'px';dom.bandRect.style.top=by+'px';dom.bandRect.style.width=bw+'px';dom.bandRect.style.height=bh+'px';}
    return;
  }
  if(S.textDraw){
    var pt=svgPt(e),sp=snapPt(pt),td=S.textDraw;
    if(!td.area&&(Math.abs(sp.x-td.x)>5||Math.abs(sp.y-td.y)>5))td.area=true;
    if(td.area){
      var tx=Math.min(sp.x,td.x),ty=Math.min(sp.y,td.y),tw=Math.abs(sp.x-td.x),th=Math.abs(sp.y-td.y);
 dom.ghost.setAttribute('x',tx);dom.ghost.setAttribute('y',ty);dom.ghost.setAttribute('width',tw);dom.ghost.setAttribute('height',th);
    }
    return;
  }
  if(S.frameDraw||S.drawing){
    var pt=svgPt(e),sp=snapPt(pt),ds=S.ds;
    if(S.drawing&&S.tool==='ellipse'){
      var ew=Math.abs(sp.x-ds.x),eh=Math.abs(sp.y-ds.y);
      if(e.shiftKey){var side=Math.max(ew,eh); var endX=ds.x+(sp.x>=ds.x?side:-side),endY=ds.y+(sp.y>=ds.y?side:-side); ew=side;eh=side; sp={x:endX,y:endY}; }
      var ex=Math.min(sp.x,ds.x),ey=Math.min(sp.y,ds.y);
      dom.ghostEllipse.setAttribute('cx',ex+ew/2);dom.ghostEllipse.setAttribute('cy',ey+eh/2);dom.ghostEllipse.setAttribute('rx',ew/2);dom.ghostEllipse.setAttribute('ry',eh/2);
    } else if(S.drawing&&S.tool==='line'){
      dom.ghostLine.setAttribute('x1',ds.x);dom.ghostLine.setAttribute('y1',ds.y);dom.ghostLine.setAttribute('x2',sp.x);dom.ghostLine.setAttribute('y2',sp.y);
    } else {
      var g2=S.frameDraw?dom.fghost:dom.ghost;
      if(S.tool==='line'){/* line uses ghostLine, not g2 */}
      else{
        var rw=Math.abs(sp.x-ds.x),rh=Math.abs(sp.y-ds.y);
        if(!S.frameDraw&&(S.tool==='rect'||S.tool==='ellipse')&&e.shiftKey){var side=Math.max(rw,rh); var endX=ds.x+(sp.x>=ds.x?side:-side),endY=ds.y+(sp.y>=ds.y?side:-side); rw=side;rh=side; sp={x:endX,y:endY}; }
        g2.setAttribute('x',Math.min(sp.x,ds.x));g2.setAttribute('y',Math.min(sp.y,ds.y));g2.setAttribute('width',rw);g2.setAttribute('height',rh);
      }
    }
  }
});

if(dom.canvas)dom.canvas.addEventListener('mouseup',function(e){
  if(S.textDraw){
    var pt=svgPt(e),sp=snapPt(pt),td=S.textDraw;
    var el;
    if(td.area){
      var x=Math.min(sp.x,td.x),y=Math.min(sp.y,td.y),w=Math.max(20,Math.abs(sp.x-td.x)),h=Math.max(20,Math.abs(sp.y-td.y));
      el=mkEl('text',x,y,w,h,{text:'',fs:18,fw:'400',fill:'#000000',textAlign:'left',lineHeight:1.2,letterSpacing:0,fontStyle:'normal',textBoxMode:'area'});
    }else{
      el=mkEl('text',td.x,td.y,1,1,{text:'',fs:18,fw:'400',fill:'#000000',textAlign:'left',lineHeight:1.2,letterSpacing:0,fontStyle:'normal',textBoxMode:'auto'});
    }
    S.textDraw=null; dom.ghost.style.display='none';
    selectEl(el.id); openTed(el); snapshot();
    return;
  }
  if(S.penEditId&&S.penEditMarquee){
    var mq=S.penEditMarquee;
    var mr=dom.selOv.querySelector('.pen-edit-marquee');if(mr)mr.remove();
    var x1=mq.x1,y1=mq.y1,x2=mq.x2,y2=mq.y2;
    var minX=Math.min(x1,x2),maxX=Math.max(x1,x2),minY=Math.min(y1,y2),maxY=Math.max(y1,y2);
    var th=5;
    if(Math.abs(x2-x1)<th&&Math.abs(y2-y1)<th){
      S.penEditSelNode=-1;S.penEditSelNodes=[];
    } else {
      var el=S.els.find(function(e2){return e2.id===S.penEditId});
      if(el&&el.pts){
        var toCanvas=function(px,py){return pathLocalToCanvas(px,py,el);};
        var inside=[];
        el.pts.forEach(function(p,idx){
          var c=toCanvas(p.x,p.y);
          if(c.x>=minX&&c.x<=maxX&&c.y>=minY&&c.y<=maxY)inside.push(idx);
        });
        if(mq.addToSel){
          var set=new Set(S.penEditSelNodes);inside.forEach(function(i){set.add(i);});
          S.penEditSelNodes=Array.from(set);
        } else {S.penEditSelNodes=inside;}
        S.penEditSelNode=S.penEditSelNodes.length?S.penEditSelNodes[0]:-1;
      }
    }
    S.penEditMarquee=null;
    drawPenEditNodes();
    return;
  }
  if(S.penEditId&&(S.penEditDragNodeIdx>=0||S.penEditDragHandleNode>=0)){
    var wasMoved=S.penEditDragMoved;
    S.penEditDragNodeIdx=-1;S.penEditDragStart=null;
    S.penEditDragHandleNode=-1;S.penEditDragHandleSide='';S.penEditDragMoved=false;
    if(wasMoved){drawPenEditNodes();}
    snapshot();return;
  }
  if(S.lineEditEndpoint!==undefined){
    S.lineEditEndpoint=undefined;S.lineEditEl=null;S.lineEditOther=null;
    drawSel();snapshot();return;
  }
  if(S.panning){
    S.panning=false;
    if(S._spacePan){
      // пробел ещё зажат — остаёмся в hand, просто меняем курсор
      dom.canvas.style.cursor='grab';
    } else {
      dom.canvas.style.cursor=S.tool==='hand'?'grab':'default';
    }
    return;
  }
  if(S.dragging){
        // ---- MULTI DRAG FINISH ----
    if(S.dragMulti && S.dragMulti.ids && S.dragMulti.ids.length){
      var dx=S.dragMulti.lastDx||0, dy=S.dragMulti.lastDy||0;

      function applyDeltaToGroup(grp,odx,ody){
        grp.children.forEach(function(cid){
          var item=findAny(cid); if(!item) return;
          if(item.type==='group'){item.x=(item.x||0)+odx; item.y=(item.y||0)+ody; applyDeltaToGroup(item,odx,ody);}
          else if(item.type==='path'){item.pts=item.pts.map(function(p){return movePt(p,odx,ody);}); item.d=penPtsToD(item.pts,item.d&&item.d.endsWith('Z'));}
          else {item.x=(item.x||0)+odx; item.y=(item.y||0)+ody;}
        });
      }

      S.dragMulti.ids.forEach(function(id){
        var it=findAny(id); if(!it) return;

        if(it.type==='group'){
          if(dx||dy) applyDeltaToGroup(it,dx,dy);
          var domGG=document.getElementById('gg'+it.id);
          if(domGG) domGG.removeAttribute('transform');
          renderGroup(it);
          return;
        }

        if(it.type==='path'){
          if(dx||dy){
            it.pts=it.pts.map(function(p){return movePt(p,dx,dy);});
            it.d=penPtsToD(it.pts,it.d&&it.d.endsWith('Z'));
          }
          var domP=document.getElementById('g'+it.id);
          if(domP) domP.removeAttribute('transform');
          renderEl(it);
          return;
        }
      });

      S.dragging=false;
      S.dragEl=null;
      S.dragMulti=null;
      clearGuides();
      setDropTarget(null);
      refreshLayers();
      drawSel(); snapshot();
      return;
    }
    // ---- /MULTI DRAG FINISH ----
    S.dragging=false; clearGuides();
    var el=S.dragEl; S.dragEl=null;
    if(el&&S.groups.indexOf(el)>=0){
      // Read DOM transform offset and bake into all children
      var ggdom=document.getElementById('gg'+el.id);
      var tStr=ggdom?ggdom.getAttribute('transform')||'':'';
      var tm=/translate\s*\(\s*([\-\d.]+)[,\s]+([\-\d.]+)/.exec(tStr);
      var offX=tm?parseFloat(tm[1]):0, offY=tm?parseFloat(tm[2]):0;
            if(offX||offY){
        function applyDelta(grp2,odx,ody){
          grp2.children.forEach(function(cid){
            var item=findAny(cid);if(!item)return;
            if(item.type==='group'){item.x=(item.x||0)+odx;item.y=(item.y||0)+ody;applyDelta(item,odx,ody);}
            else if(item.type==='path'){movePath(item,odx,ody);}
            else{item.x=(item.x||0)+odx;item.y=(item.y||0)+ody;}
          });
        }
        applyDelta(el,offX,offY);
      }

      if(ggdom)ggdom.removeAttribute('transform');
      renderGroup(el);
      // transform можно просто убрать — renderGroup снова поставит базу
      if(ggdom)ggdom.removeAttribute('transform');
      renderGroup(el);
    }
    if(el&&el.type==='path'){
      var pgdom=document.getElementById('g'+el.id);
      var ptStr=pgdom?pgdom.getAttribute('transform')||'':'';
      var ptm=/translate\s*\(\s*([\-\d.]+)[,\s]+([\-\d.]+)/.exec(ptStr);
      var poffX=ptm?parseFloat(ptm[1]):0, poffY=ptm?parseFloat(ptm[2]):0;
      if(poffX||poffY){
        movePath(el,poffX,poffY);
        if(pgdom)pgdom.removeAttribute('transform');
        renderEl(el);
      }
    }
    var elIsFrame=el&&!!S.frames.find(function(f){return f.id===el.id;});
    if(elIsFrame){
      renderFrame(el);
    }
    if(el){
      var ab,cw,ch;
      if(el.type==='path'&&el.pts&&el.pts.length){
        var _bb=getBBox(el);
        ab={x:_bb.x,y:_bb.y}; cw=_bb.w; ch=_bb.h;
      } else {
        ab=absPos(el); cw=el.w||0; ch=el.h||0;
      }
      var cx=ab.x+cw/2, cy=ab.y+ch/2;
      var newFr=null;
      // Find innermost frame at centre point, excluding self and own children
      for(var fi=S.frames.length-1;fi>=0;fi--){
        var ff=S.frames[fi];
        if(ff.id===el.id)continue; // can't drop into self
        // Skip descendants of the dragged frame
        var isDesc=false;
        var cur=ff;
        while(cur&&cur.frameId){if(cur.frameId===el.id){isDesc=true;break;}cur=S.frames.find(function(f){return f.id===cur.frameId;});}
        if(isDesc)continue;
        var ffAb=absPos(ff);
        if(cx>=ffAb.x&&cx<=ffAb.x+ff.w&&cy>=ffAb.y&&cy<=ffAb.y+ff.h){
          if(!newFr||ff.w*ff.h<newFr.w*newFr.h)newFr=ff;
        }
      }
      var newFrId=newFr?newFr.id:null;
      if(newFrId!==el.frameId){
        reparentEl(el,newFrId);
        toast(newFrId?'↳ Moved into '+newFr.name:'↑ Removed from frame');
      } else if(elIsFrame){
        renderFrame(el);
      }
      setDropTarget(null);
      refreshLayers();
    }
    drawSel(); snapshot(); return;
  }
  if(S.rotating){S.rotating=false;S.rotEl=null;drawSel();snapshot();return;}
  if(S.resizing){
    S.resizing=false;
    var resEl=S.resEl;S.resEl=null;
    // If resized element is a child of an AL frame, re-run layout
    if(resEl&&resEl.frameId){
      var pf=S.frames.find(function(f){return f.id===resEl.frameId});
      if(pf&&getAL(pf)){applyAutoLayout(pf);renderFrame(pf);}
    }
    // If resized element IS an AL frame, re-run layout
    if(resEl&&resEl.type==='frame'&&getAL(resEl)){applyAutoLayout(resEl);renderFrame(resEl);}
    drawSel();snapshot();return;
  }
if(S.bandSel){
  S.bandSel=false;
  var br=dom.bandRect.getBoundingClientRect(), cr=dom.canvas.getBoundingClientRect();
  dom.bandRect.style.display='none';
  if(br.width<=4 || br.height<=4) return;

  // px -> world coords
  var x1=(br.left  - cr.left - S.px)/S.zoom;
  var y1=(br.top   - cr.top  - S.py)/S.zoom;
  var x2=(br.right - cr.left - S.px)/S.zoom;
  var y2=(br.bottom- cr.top  - S.py)/S.zoom;

  var bx1=Math.min(x1,x2), by1=Math.min(y1,y2);
  var bx2=Math.max(x1,x2), by2=Math.max(y1,y2);

  function intersects(bb){
    return (bb.x+bb.w > bx1 && bb.x < bx2 && bb.y+bb.h > by1 && bb.y < by2);
  }

  var hitIds=[];

  // frames
  S.frames.forEach(function(f){
    var bb=getBBox(f);
    if(intersects(bb)) hitIds.push(f.id);
  });

  // groups
  S.groups.forEach(function(g){
    var bb=getBBox(g); // getBBox уже умеет group -> getGroupBBox
    if(intersects(bb)) hitIds.push(g.id);
  });

  // all els (включая внутри фреймов)
  S.els.forEach(function(el){
    var bb=getBBox(el);
    if(intersects(bb)) hitIds.push(el.id);
  });

  hitIds = topLevelSelIds(hitIds);

  if(hitIds.length){
    if(S.bandAdd){
      // add to selection
      var set={};
      (S.selIds||[]).forEach(id=>set[id]=1);
      hitIds.forEach(id=>set[id]=1);
      S.selIds=Object.keys(set);
    } else {
      // replace selection
      S.selIds=hitIds;
    }
    S.selId=S.selIds[S.selIds.length-1];
    drawSel(); refreshProps(); refreshLayers(); snapshot();
  }
  return;
}
  if(S.frameDraw){
    S.frameDraw=false; dom.fghost.style.display='none';
    var pt=svgPt(e),sp=snapPt(pt),ds=S.ds;
    var x=Math.min(sp.x,ds.x),y=Math.min(sp.y,ds.y),w=Math.abs(sp.x-ds.x),h=Math.abs(sp.y-ds.y);
    if(w<10&&h<10)return;
    var fr=mkFrame(x,y,Math.max(20,w),Math.max(20,h)); selectEl(fr.id); setTool('select'); snapshot(); return;
  }
  if(S.drawing){
    S.drawing=false; dom.ghost.style.display='none'; dom.ghostEllipse.style.display='none'; dom.ghostLine.style.display='none';
    var pt=svgPt(e),sp=snapPt(pt),ds=S.ds;
    var w=Math.abs(sp.x-ds.x),h=Math.abs(sp.y-ds.y);
    if((S.tool==='rect'||S.tool==='ellipse')&&e.shiftKey){ var side=Math.max(w,h); var endX=ds.x+(sp.x>=ds.x?side:-side),endY=ds.y+(sp.y>=ds.y?side:-side); w=side;h=side; sp={x:endX,y:endY}; }
    var x=Math.min(sp.x,ds.x),y=Math.min(sp.y,ds.y);
    if(w<4&&h<4)return;
    var el;if(S.tool==='line')el=mkEl('line',ds.x,ds.y,sp.x-ds.x,sp.y-ds.y);
    else el=mkEl(S.tool,x,y,Math.max(1,w),Math.max(1,h));
    // Run AL on parent frame if exists
    if(el.frameId){var pf=S.frames.find(function(f){return f.id===el.frameId});if(pf&&getAL(pf)){applyAutoLayout(pf);renderFrame(pf);}}
    selectEl(el.id); if(S.tool!=='rect'&&S.tool!=='ellipse'&&S.tool!=='line') setTool('select'); snapshot();
  }
});
document.addEventListener('mouseup',function(){
  if(S.dragging){S.dragging=false;S.dragEl=null;setDropTarget(null);}
  if(S.resizing){S.resizing=false;S.resEl=null;}
  if(S.rotating){S.rotating=false;S.rotEl=null;}
  S.panning=false;
  if(S.bandSel){S.bandSel=false;dom.bandRect.style.display='none';}
});

// ── IMAGE ──
var imgInput=document.getElementById('img-input');if(imgInput)imgInput.addEventListener('change',function(e){
  var file=e.target.files[0];if(!file)return;
  var reader=new FileReader();reader.onload=function(ev){
    var r=dom.canvas.getBoundingClientRect();var cx=(r.width/2-S.px)/S.zoom,cy=(r.height/2-S.py)/S.zoom;
    var img=new Image();img.onload=function(){
      var mW=400,mH=400,w=img.width,h=img.height;
      if(w>mW){h=h*(mW/w);w=mW;}if(h>mH){w=w*(mH/h);h=mH;}
      var el=mkEl('image',cx-w/2,cy-h/2,w,h,{imgData:ev.target.result,fill:'none',stroke:'none',strokeWidth:0});
      selectEl(el.id);setTool('select');snapshot();
    };img.src=ev.target.result;
  };reader.readAsDataURL(file);e.target.value='';
});
if(dom.canvas)dom.canvas.addEventListener('dragover',function(e){e.preventDefault();});
if(dom.canvas)dom.canvas.addEventListener('drop',function(e){
  e.preventDefault();var file=e.dataTransfer.files[0];if(!file||!file.type.startsWith('image/'))return;
  var reader=new FileReader();reader.onload=function(ev){
    var pt=svgPt(e);var img=new Image();img.onload=function(){
      var mW=400,mH=400,w=img.width,h=img.height;
      if(w>mW){h=h*(mW/w);w=mW;}if(h>mH){w=w*(mH/h);h=mH;}
      var el=mkEl('image',pt.x-w/2,pt.y-h/2,w,h,{imgData:ev.target.result,fill:'none',stroke:'none',strokeWidth:0});
      selectEl(el.id);setTool('select');snapshot();
    };img.src=ev.target.result;
  };reader.readAsDataURL(file);
});

// ── SVG VECTOR IMPORT ──
// Matrix format: [a,b,c,d,e,f] → transforms (x,y) to (a*x+c*y+e, b*x+d*y+f)
// svgMulM(a,b)(p) = a(b(p))  — b applied first, then a
function svgMulM(a,b){
  return[
    a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
    a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
    a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]
  ];
}
function svgApplyM(m,x,y){return{x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]};}
function svgParseTransform(str){
  if(!str)return[1,0,0,1,0,0];
  var result=[1,0,0,1,0,0];
  // handle multiple transforms like "translate(x,y) scale(s)"
  var re=/(\w+)\(([^)]+)\)/g,match;
  var parts=[];while((match=re.exec(str))!==null)parts.push({fn:match[1],args:match[2].trim().split(/[\s,]+/).map(Number)});
  parts.reverse(); // rightmost applied first
  parts.forEach(function(p){
    var m;
    if(p.fn==='matrix'){m=p.args.slice(0,6);}
    else if(p.fn==='translate'){m=[1,0,0,1,p.args[0]||0,p.args[1]||0];}
    else if(p.fn==='scale'){var sx=p.args[0]||1,sy=p.args[1]!=null?p.args[1]:sx;m=[sx,0,0,sy,0,0];}
    else if(p.fn==='rotate'){var a=p.args[0]*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
      var rcx=p.args[1]||0,rcy=p.args[2]||0;
      m=[cos,sin,-sin,cos,rcx-cos*rcx+sin*rcy,rcy-sin*rcx-cos*rcy];}
    else{m=[1,0,0,1,0,0];}
    result=svgMulM(result,m);
  });
  return result;
}
function svgTransformD(d,m){
  if(!d)return'';
  var out=[],cx=0,cy=0,sx=0,sy=0;
  function ap(x,y){var p=svgApplyM(m,x,y);return p.x.toFixed(3)+' '+p.y.toFixed(3);}
  var segs=[];var re2=/([MmLlHhVvCcQqSsTtZz])((?:[^MmLlHhVvCcQqSsTtZz])*)/g,seg;
  while((seg=re2.exec(d))!==null){
    var ns=(seg[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)||[]).map(Number);
    segs.push({c:seg[1],n:ns});
  }
  segs.forEach(function(s){
    var c=s.c,n=s.n;
    switch(c){
      case'M':for(var i=0;i<n.length;i+=2){cx=n[i];cy=n[i+1];out.push((i===0?'M':'L')+ap(cx,cy));if(i===0){sx=cx;sy=cy;}}break;
      case'm':for(var i=0;i<n.length;i+=2){cx+=n[i];cy+=n[i+1];out.push((i===0?'M':'L')+ap(cx,cy));if(i===0){sx=cx;sy=cy;}}break;
      case'L':for(var i=0;i<n.length;i+=2){cx=n[i];cy=n[i+1];out.push('L'+ap(cx,cy));}break;
      case'l':for(var i=0;i<n.length;i+=2){cx+=n[i];cy+=n[i+1];out.push('L'+ap(cx,cy));}break;
      case'H':for(var i=0;i<n.length;i++){cx=n[i];out.push('L'+ap(cx,cy));}break;
      case'h':for(var i=0;i<n.length;i++){cx+=n[i];out.push('L'+ap(cx,cy));}break;
      case'V':for(var i=0;i<n.length;i++){cy=n[i];out.push('L'+ap(cx,cy));}break;
      case'v':for(var i=0;i<n.length;i++){cy+=n[i];out.push('L'+ap(cx,cy));}break;
      case'C':for(var i=0;i<n.length;i+=6){out.push('C'+ap(n[i],n[i+1])+' '+ap(n[i+2],n[i+3])+' '+ap(n[i+4],n[i+5]));cx=n[i+4];cy=n[i+5];}break;
      case'c':for(var i=0;i<n.length;i+=6){out.push('C'+ap(cx+n[i],cy+n[i+1])+' '+ap(cx+n[i+2],cy+n[i+3])+' '+ap(cx+n[i+4],cy+n[i+5]));cx+=n[i+4];cy+=n[i+5];}break;
      case'Q':for(var i=0;i<n.length;i+=4){out.push('Q'+ap(n[i],n[i+1])+' '+ap(n[i+2],n[i+3]));cx=n[i+2];cy=n[i+3];}break;
      case'q':for(var i=0;i<n.length;i+=4){out.push('Q'+ap(cx+n[i],cy+n[i+1])+' '+ap(cx+n[i+2],cy+n[i+3]));cx+=n[i+2];cy+=n[i+3];}break;
      case'S':for(var i=0;i<n.length;i+=4){out.push('S'+ap(n[i],n[i+1])+' '+ap(n[i+2],n[i+3]));cx=n[i+2];cy=n[i+3];}break;
      case's':for(var i=0;i<n.length;i+=4){out.push('S'+ap(cx+n[i],cy+n[i+1])+' '+ap(cx+n[i+2],cy+n[i+3]));cx+=n[i+2];cy+=n[i+3];}break;
      case'Z':case'z':out.push('Z');cx=sx;cy=sy;break;
    }
  });
  return out.join(' ');
}
function svgResolveColor(val,inherited){
  if(!val||val==='inherit')return inherited;
  if(val==='none'||val==='transparent')return'none';
  if(val.startsWith('#')){return val.length===4?'#'+val[1]+val[1]+val[2]+val[2]+val[3]+val[3]:val.toLowerCase();}
  return rgbToHex(val)||inherited;
}
function svgWalk(node,matrix,inh,result,cssMap){
  var tag=(node.tagName||'').toLowerCase().replace(/^[a-z]+:/,'');
  if(!tag||tag==='defs'||tag==='clippath'||tag==='mask'||tag==='style'||tag==='#text')return;
  var tStr=node.getAttribute&&node.getAttribute('transform');
  var localM=tStr?svgParseTransform(tStr):[1,0,0,1,0,0];
  var m=tStr?svgMulM(matrix,localM):matrix;
  // Resolve style: attribute < CSS class < inline style (cascade)
  function getAttr(attr){return node.getAttribute&&node.getAttribute(attr);}
  var fill=inh.fill,stroke=inh.stroke,sw=inh.sw,op=inh.op;
  // 1. attribute-level
  var fa=getAttr('fill');if(fa)fill=svgResolveColor(fa,fill);
  var sa=getAttr('stroke');if(sa)stroke=svgResolveColor(sa,stroke);
  var swa=getAttr('stroke-width');if(swa)sw=parseFloat(swa)||sw;
  var opa=getAttr('opacity');if(opa)op=parseFloat(opa)||op;
  // 2. CSS classes
  if(cssMap){
    var cls=(getAttr('class')||'').trim().split(/\s+/);
    cls.forEach(function(c){
      var e=cssMap[c];if(!e)return;
      if(e.fill!==undefined)fill=svgResolveColor(e.fill,fill);
      if(e.stroke!==undefined)stroke=svgResolveColor(e.stroke,stroke);
      if(e.sw!==undefined)sw=e.sw;
      if(e.op!==undefined)op=e.op;
    });
  }
  // 3. inline style overrides
  var sty=getAttr('style')||'';
  if(sty){
    var fs=sty.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/);if(fs)fill=svgResolveColor(fs[1].trim(),fill);
    var ss=sty.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/);if(ss)stroke=svgResolveColor(ss[1].trim(),stroke);
    var sws=sty.match(/(?:^|;)\s*stroke-width\s*:\s*([^;]+)/);if(sws)sw=parseFloat(sws[1])||sw;
    var ops=sty.match(/(?:^|;)\s*opacity\s*:\s*([^;]+)/);if(ops)op=parseFloat(ops[1])||op;
  }
  var childInh={fill:fill,stroke:stroke,sw:sw,op:op};
  if(tag==='g'||tag==='svg'||tag==='symbol'){
    for(var i=0;i<node.childNodes.length;i++)svgWalk(node.childNodes[i],m,childInh,result,cssMap);
    return;
  }
  if(tag==='path'){
    var d=node.getAttribute('d');if(!d)return;
    result.push({type:'path',d:svgTransformD(d,m),fill:fill||'#000',stroke:stroke||'none',sw:sw||0,op:op||1});
  }else if(tag==='rect'){
    var rx2=parseFloat(node.getAttribute('x')||0),ry2=parseFloat(node.getAttribute('y')||0);
    var rw=parseFloat(node.getAttribute('width')||0),rh=parseFloat(node.getAttribute('height')||0);
    var rrx=parseFloat(node.getAttribute('rx')||0);
    var p1=svgApplyM(m,rx2,ry2),p2=svgApplyM(m,rx2+rw,ry2),p3=svgApplyM(m,rx2+rw,ry2+rh),p4=svgApplyM(m,rx2,ry2+rh);
    var xs=[p1.x,p2.x,p3.x,p4.x],ys=[p1.y,p2.y,p3.y,p4.y];
    var bx=Math.min.apply(null,xs),by=Math.min.apply(null,ys);
    result.push({type:'rect',x:bx,y:by,w:Math.max.apply(null,xs)-bx,h:Math.max.apply(null,ys)-by,rx:rrx,fill:fill||'#000',stroke:stroke||'none',sw:sw||0,op:op||1});
  }else if(tag==='ellipse'||tag==='circle'){
    var ecx=parseFloat(node.getAttribute('cx')||0),ecy=parseFloat(node.getAttribute('cy')||0);
    var erx=tag==='circle'?parseFloat(node.getAttribute('r')||0):parseFloat(node.getAttribute('rx')||0);
    var ery=tag==='circle'?erx:parseFloat(node.getAttribute('ry')||0);
    var pc=svgApplyM(m,ecx,ecy);
    var scX=Math.sqrt(m[0]*m[0]+m[1]*m[1]),scY=Math.sqrt(m[2]*m[2]+m[3]*m[3]);
    result.push({type:'ellipse',x:pc.x-erx*scX,y:pc.y-ery*scY,w:erx*scX*2,h:ery*scY*2,fill:fill||'#000',stroke:stroke||'none',sw:sw||0,op:op||1});
  }else if(tag==='line'){
    var lx1=parseFloat(node.getAttribute('x1')||0),ly1=parseFloat(node.getAttribute('y1')||0);
    var lx2=parseFloat(node.getAttribute('x2')||0),ly2=parseFloat(node.getAttribute('y2')||0);
    var lp1=svgApplyM(m,lx1,ly1),lp2=svgApplyM(m,lx2,ly2);
    result.push({type:'path',d:'M'+lp1.x.toFixed(3)+' '+lp1.y.toFixed(3)+' L'+lp2.x.toFixed(3)+' '+lp2.y.toFixed(3),fill:'none',stroke:stroke||'#000',sw:sw||1,op:op||1});
  }else if(tag==='polygon'||tag==='polyline'){
    var pts2=(node.getAttribute('points')||'').match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)||[];
    pts2=pts2.map(Number);var pout=[];
    for(var i=0;i<pts2.length;i+=2){var pp=svgApplyM(m,pts2[i],pts2[i+1]);pout.push((i===0?'M':'L')+pp.x.toFixed(3)+' '+pp.y.toFixed(3));}
    if(tag==='polygon')pout.push('Z');
    result.push({type:'path',d:pout.join(' '),fill:fill||'#000',stroke:stroke||'none',sw:sw||0,op:op||1});
  }
}
function parseSVGCSSClasses(svgEl){
  var cssMap={};
  svgEl.querySelectorAll('style').forEach(function(s){
    var css=s.textContent||'';
    var ruleRe=/\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g,rm;
    while((rm=ruleRe.exec(css))!==null){
      var cls=rm[1],props=rm[2],entry={};
      var fm=props.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/);if(fm)entry.fill=fm[1].trim();
      var sm=props.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/);if(sm)entry.stroke=sm[1].trim();
      var swm=props.match(/(?:^|;)\s*stroke-width\s*:\s*([^;]+)/);if(swm)entry.sw=parseFloat(swm[1]);
      var om=props.match(/(?:^|;)\s*opacity\s*:\s*([^;]+)/);if(om)entry.op=parseFloat(om[1]);
      cssMap[cls]=entry;
    }
  });
  return cssMap;
}
function importSVGShapes(svgText){
  var parser=new DOMParser();
  var doc=parser.parseFromString(svgText,'image/svg+xml');
  var svgEl=doc.querySelector('svg');
  if(!svgEl){toast('Could not parse SVG');return;}
  var cssMap=parseSVGCSSClasses(svgEl);
  var vb=svgEl.getAttribute('viewBox');
  var initM=[1,0,0,1,0,0];
  if(vb){var vbp=vb.trim().split(/[\s,]+/).map(Number);if(vbp.length>=4&&(vbp[0]||vbp[1]))initM=[1,0,0,1,-vbp[0],-vbp[1]];}
  var shapes=[];
  for(var i=0;i<svgEl.childNodes.length;i++)svgWalk(svgEl.childNodes[i],initM,{fill:'#000',stroke:'none',sw:0,op:1},shapes,cssMap);
  if(!shapes.length){toast('No shapes found in SVG');return;}
  // Compute bbox
  var allX=[],allY=[];
  shapes.forEach(function(s){
    if(s.type==='path'){
      var coords=(s.d.match(/[-+]?(?:\d+\.?\d*|\.\d+)/g)||[]).map(Number);
      for(var i=0;i<coords.length-1;i+=2){allX.push(coords[i]);allY.push(coords[i+1]);}
    }else{allX.push(s.x,s.x+s.w);allY.push(s.y,s.y+s.h);}
  });
  if(!allX.length){toast('No shapes found');return;}
  var minX=Math.min.apply(null,allX),minY=Math.min.apply(null,allY);
  var bw=Math.max.apply(null,allX)-minX,bh=Math.max.apply(null,allY)-minY;
  // Placement: scale to max 600×600, center in viewport
  var mW=600,mH=600,sc=1;
  if(bw>mW)sc=Math.min(sc,mW/bw);if(bh>mH)sc=Math.min(sc,mH/bh);
  var r=dom.canvas.getBoundingClientRect();
  var vcx=(r.width/2-S.px)/S.zoom,vcy=(r.height/2-S.py)/S.zoom;
  var dx=vcx-bw*sc/2,dy=vcy-bh*sc/2;
  var pm=[sc,0,0,sc,dx-minX*sc,dy-minY*sc];
  // Create elements
  var newIds=[];
  shapes.forEach(function(s){
    var el;
    if(s.type==='path'){
      var td=svgTransformD(s.d,pm);
      var tpts=extractPtsFromD(td);
      el={id:uid(),type:'path',d:td,pts:tpts,importedSVG:true,fill:s.fill,stroke:s.stroke,strokeWidth:s.sw,strokeAlign:'center',opacity:s.op,name:'Path '+(S.nid++),frameId:null,groupId:null,x:0,y:0,w:0,h:0,isMask:false};
      S.els.push(el);renderElInto(el,dom.elsLoose);
    }else{
      var np=svgApplyM(pm,s.x,s.y);
      el=mkEl(s.type,np.x,np.y,s.w*sc,s.h*sc,{fill:s.fill,stroke:s.stroke,strokeWidth:s.sw,opacity:s.op,rx:s.rx||0});
    }
    if(el)newIds.push(el.id);
  });
  if(!newIds.length){toast('Import failed');return;}
  if(newIds.length>1){S.selIds=newIds;S.selId=newIds[0];groupSel();}
  else selectEl(newIds[0]);
  setTool('select');refreshLayers();snapshot();
  toast('Imported '+shapes.length+' shape'+(shapes.length>1?'s':'')+' as paths ✓');
}

// Extract pts WITH bezier handles from an absolute SVG d string
function extractPtsFromD(d){
  var pts=[],segs=[];
  var re=/([MmLlHhVvCcQqSsTtZz])((?:[^MmLlHhVvCcQqSsTtZz])*)/g,seg;
  while((seg=re.exec(d))!==null){
    var ns=(seg[2].match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)||[]).map(Number);
    segs.push({c:seg[1],n:ns});
  }
  var prevOutX=null,prevOutY=null;
  segs.forEach(function(s){
    var c=s.c.toUpperCase(),n=s.n;
    if(c==='M'||c==='L'){
      for(var i=0;i+1<n.length;i+=2){pts.push({x:n[i],y:n[i+1]});prevOutX=null;prevOutY=null;}
    }else if(c==='C'){
      for(var i=0;i+5<n.length;i+=6){
        if(pts.length>0){pts[pts.length-1].cx2=n[i];pts[pts.length-1].cy2=n[i+1];}
        prevOutX=n[i+2];prevOutY=n[i+3];
        pts.push({x:n[i+4],y:n[i+5],cx1:n[i+2],cy1:n[i+3]});
      }
    }else if(c==='Q'){
      for(var i=0;i+3<n.length;i+=4){
        if(pts.length>0){pts[pts.length-1].cx2=n[i];pts[pts.length-1].cy2=n[i+1];}
        pts.push({x:n[i+2],y:n[i+3],cx1:n[i],cy1:n[i+1]});
        prevOutX=null;prevOutY=null;
      }
    }else if(c==='S'){
      for(var i=0;i+3<n.length;i+=4){
        var pp=pts[pts.length-1];
        var rx=pp?2*pp.x-(prevOutX!=null?prevOutX:pp.x):n[i];
        var ry=pp?2*pp.y-(prevOutY!=null?prevOutY:pp.y):n[i+1];
        if(pts.length>0){pts[pts.length-1].cx2=rx;pts[pts.length-1].cy2=ry;}
        prevOutX=n[i];prevOutY=n[i+1];
        pts.push({x:n[i+2],y:n[i+3],cx1:n[i],cy1:n[i+1]});
      }
    }
  });
  return pts;
}
// Move a path element by dx,dy — handles both imported SVG paths and native pen paths
function movePath(el,dx,dy){
  if(!dx&&!dy)return;
  if(el.importedSVG){
    el.d=svgTransformD(el.d,[1,0,0,1,dx,dy]);
    el.pts=el.pts.map(function(p){return movePt(p,dx,dy);});
  }else{
    el.pts=el.pts.map(function(p){return movePt(p,dx,dy);});
    el.d=penPtsToD(el.pts,el.d&&el.d.endsWith('Z'));
  }
  var px=el.pts.map(function(p){return p.x;}), py=el.pts.map(function(p){return p.y;});
  el.x=Math.min.apply(null,px); el.y=Math.min.apply(null,py);
  el.w=Math.max.apply(null,px)-el.x; el.h=Math.max.apply(null,py)-el.y;
}

// ── SVG PASTE CHOICE MODAL ──
var _pendingSVG={text:null,dataURL:null};
function showSVGChoiceModal(svgText,dataURL){
  _pendingSVG={text:svgText,dataURL:dataURL};
  document.getElementById('svg-paste-modal').style.display='flex';
}
function confirmSVGPaste(mode){
  document.getElementById('svg-paste-modal').style.display='none';
  if(mode==='image'){pasteImageDataURL(_pendingSVG.dataURL,'image/svg+xml');}
  else if(mode==='paths'){importSVGShapes(_pendingSVG.text);}
  _pendingSVG={text:null,dataURL:null};
}
function cancelSVGPaste(){
  document.getElementById('svg-paste-modal').style.display='none';
  _pendingSVG={text:null,dataURL:null};
}
window.confirmSVGPaste=confirmSVGPaste;
window.cancelSVGPaste=cancelSVGPaste;

// ── PASTE IMAGE FROM CLIPBOARD ──
function pasteImageDataURL(dataURL, mimeHint){
  var isSVG = mimeHint==='image/svg+xml' || dataURL.indexOf('image/svg+xml')===5;
  if(isSVG){
    // SVG: get viewBox/width/height from markup to determine natural size
    var r=dom.canvas.getBoundingClientRect();
    var cx=(r.width/2-S.px)/S.zoom;
    var cy=(r.height/2-S.py)/S.zoom;
    var w=400,h=400;
    try{
      var txt=atob(dataURL.split(',')[1]);
      var vb=txt.match(/viewBox=["']([^"']+)["']/);
      if(vb){var p=vb[1].trim().split(/[\s,]+/);if(p.length===4){w=parseFloat(p[2])||400;h=parseFloat(p[3])||400;}}
      else{
        var wm=txt.match(/\bwidth=["']([0-9.]+)/);var hm=txt.match(/\bheight=["']([0-9.]+)/);
        if(wm)w=parseFloat(wm[1]);if(hm)h=parseFloat(hm[1]);
      }
      var mW=600,mH=600;
      if(w>mW){h=h*(mW/w);w=mW;}if(h>mH){w=w*(mH/h);h=mH;}
    }catch(ex){}
    var el=mkEl('image',cx-w/2,cy-h/2,w,h,{imgData:dataURL,fill:'none',stroke:'none',strokeWidth:0});
    selectEl(el.id);setTool('select');snapshot();
    toast('SVG pasted ✓');
  } else {
    var img=new Image();
    img.onload=function(){
      var mW=600,mH=600,w=img.width,h=img.height;
      if(w>mW){h=h*(mW/w);w=mW;}if(h>mH){w=w*(mH/h);h=mH;}
      var r=dom.canvas.getBoundingClientRect();
      var cx=(r.width/2-S.px)/S.zoom;
      var cy=(r.height/2-S.py)/S.zoom;
      var el=mkEl('image',cx-w/2,cy-h/2,w,h,{imgData:dataURL,fill:'none',stroke:'none',strokeWidth:0});
      selectEl(el.id);setTool('select');snapshot();
      toast('Image pasted ✓');
    };
    img.src=dataURL;
  }
}

function _readSVGBlob(blob,fallbackRasterFn){
  var r1=new FileReader(),r2=new FileReader();
  var svgText=null,dataURL=null;
  function tryShow(){if(svgText!==null&&dataURL!==null)showSVGChoiceModal(svgText,dataURL);}
  r1.onload=function(ev){svgText=ev.target.result;
    // Sanity: must look like SVG
    if(svgText&&(svgText.indexOf('<svg')>=0||svgText.indexOf('<?xml')>=0)){tryShow();}
    else{svgText=null;if(dataURL!==null&&fallbackRasterFn)fallbackRasterFn();}
  };
  r2.onload=function(ev){dataURL=ev.target.result;tryShow();};
  r1.readAsText(blob);r2.readAsDataURL(blob);
}
document.addEventListener('paste',function(e){
  if(e.target===dom.ted)return;
  var items=e.clipboardData&&e.clipboardData.items;
  if(!items)return;

var svgItem=null,imgItem=null,textItem=null;
  for(var i=0;i<items.length;i++){
    if(items[i].type==='image/svg+xml'){svgItem=items[i];}
    else if(items[i].type.startsWith('image/')&&!imgItem){imgItem=items[i];}
    else if(items[i].type==='text/plain'&&!textItem){textItem=items[i];}
  }
  if(svgItem){
    // Direct SVG mime type (rare)
    e.preventDefault();
    var blob=svgItem.getAsFile();if(!blob)return;
    _readSVGBlob(blob,null);
  }else if(textItem&&imgItem){
    // Illustrator pastes SVG markup as text/plain + PNG preview
    e.preventDefault();
    var _rasterBlob=imgItem.getAsFile();
    function _fallbackRaster(){
      if(!_rasterBlob)return;
      var rd=new FileReader();
      rd.onload=function(ev){pasteImageDataURL(ev.target.result,imgItem.type);};
      rd.readAsDataURL(_rasterBlob);
    }
    textItem.getAsString(function(txt){
      var t=txt?txt.trimLeft():'';
      if(t.indexOf('<svg')===0||t.indexOf('<?xml')===0){
        var b64=btoa(unescape(encodeURIComponent(txt)));
        showSVGChoiceModal(txt,'data:image/svg+xml;base64,'+b64);
      }else{
        _fallbackRaster();
      }
    });
  }else if(imgItem){
    // Raster only
    e.preventDefault();
    var _rb=imgItem.getAsFile();if(!_rb)return;
    var rd2=new FileReader();
    rd2.onload=function(ev){pasteImageDataURL(ev.target.result,imgItem.type);};
    rd2.readAsDataURL(_rb);
  }
});

// ── TEXT EDITOR ──
var tedId=null;
function resizeTed(){
  if(!tedId)return;
  var el=S.els.find(function(e){return e.id===tedId});
  if(!el)return;
  var zoom=S.zoom;
  var isArea=el.textBoxMode==='area'||el.textBoxMode==='fixed';
  if(isArea){
    var fixedW=Math.max(1,(el.w||60)*zoom);
    dom.ted.style.width=fixedW+'px';
    dom.ted.style.height='1px';
    var contentH=Math.max(1,dom.ted.scrollHeight);
    dom.ted.style.height=contentH+'px';
    el.h=contentH/zoom;
  }else{
    dom.ted.style.width='1px';
    dom.ted.style.height='1px';
    var w=Math.max(1,dom.ted.scrollWidth);
    var h=Math.max(1,dom.ted.scrollHeight);
    dom.ted.style.width=w+'px';
    dom.ted.style.height=h+'px';
    el.w=w/zoom;
    el.h=h/zoom;
  }
  drawSel();
}
function openTed(el){
  tedId=el.id;
  var r=dom.canvas.getBoundingClientRect();
  var ab=absPos(el);
  var zoom=S.zoom;
  var fs=el.fs||18;
  var lineHVal=(el.lineHeight!=null&&el.lineHeight!=='')?+el.lineHeight:1.2;
  dom.ted.style.display='block';
  dom.ted.style.position='fixed';
  dom.ted.style.left=(ab.x*zoom+S.px+r.left)+'px';
  dom.ted.style.top=(ab.y*zoom+S.py+r.top)+'px';
  dom.ted.style.margin='0';
  dom.ted.style.padding='0';
  dom.ted.style.border='1px dashed #7b61ff';
  dom.ted.style.outline='none';
  dom.ted.style.background='transparent';
  dom.ted.style.boxSizing='border-box';
  dom.ted.style.borderRadius='0';
  dom.ted.style.resize='none';
  dom.ted.style.overflow='hidden';
  var isArea=el.textBoxMode==='area'||el.textBoxMode==='fixed';
  dom.ted.wrap=isArea?'soft':'off';
  dom.ted.style.whiteSpace=isArea?'pre-wrap':'pre';
  dom.ted.style.wordBreak='break-word';
  dom.ted.style.fontSize=(fs*zoom)+'px';
  dom.ted.style.fontWeight=el.fw||'400';
  dom.ted.style.fontFamily=el.fontFamily||'system-ui,sans-serif';
  dom.ted.style.fontStyle=el.fontStyle||'normal';
  dom.ted.style.lineHeight=String(lineHVal);
  var align=el.textAlign||'left';
  dom.ted.style.textAlign=(align==='center'||align==='right')?align:'left';
  if(el.letterSpacing!=null&&el.letterSpacing!==''){
    dom.ted.style.letterSpacing=((typeof el.letterSpacing==='number'?el.letterSpacing:parseFloat(el.letterSpacing))*zoom)+'px';
  }else{dom.ted.style.letterSpacing='';}
  dom.ted.style.color=el.fill==='none'?'#000':el.fill;
  dom.ted.value=el.text||'';
  dom.ted.style.width=Math.max(1,(el.w||60)*zoom)+'px';
  dom.ted.style.height=Math.max(1,(el.h||fs*lineHVal)*zoom)+'px';
  var g=document.getElementById('g'+el.id);if(g)g.style.display='none';
  requestAnimationFrame(function(){
    resizeTed();
    dom.ted.focus({preventScroll:true});
    dom.ted.setSelectionRange(dom.ted.value.length,dom.ted.value.length);
  });
}
if(dom.ted)dom.ted.addEventListener('input',function(){
  if(!tedId)return;
  var el=S.els.find(function(e){return e.id===tedId});
  if(el)el.text=dom.ted.value;
  resizeTed();
});
if(dom.ted)dom.ted.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();commitText();}else if(e.ctrlKey&&e.key==='Enter'){e.preventDefault();commitText();}});
function updateTextBounds(el){
  if(!el.text)return;
  var m=measureText(el);
  if(el.textBoxMode==='area'||el.textBoxMode==='fixed'){
    el.h=Math.max(el.h||0,m.h);
  }else{
    el.w=Math.max(1,m.w);
    el.h=Math.max(1,m.h);
  }
}
function commitText(){
  if(!tedId)return;
  var activeId=tedId;
  var el=S.els.find(function(e){return e.id===activeId});
  if(!el){
    dom.ted.style.display='none';
    dom.ted.value='';
    tedId=null;
    drawSel();
    return;
  }
  el.text=dom.ted.value;
  dom.ted.style.display='none';
  dom.ted.value='';
  tedId=null;
  if(!el.text.trim()){
    if(el.frameId){
      var pf=S.frames.find(function(f){return f.id===el.frameId});
      if(pf)pf.children=pf.children.filter(function(c){return c!==el.id});
    }
    S.els=S.els.filter(function(e){return e.id!==activeId});
    var dead=document.getElementById('g'+activeId);
    if(dead)dead.remove();
    if(S.selId===activeId){S.selId=null;S.selIds=[];dom.selOv.innerHTML='';}
    refreshLayers();
    refreshProps();
    drawSel();
    return;
  }
  if(el.textBoxMode==='area'||el.textBoxMode==='fixed'){
    el.h=dom.ted.offsetHeight/S.zoom;
  }else{
    el.w=dom.ted.offsetWidth/S.zoom;
    el.h=dom.ted.offsetHeight/S.zoom;
  }
  updateTextBounds(el);
  if(el.tableCell){
    var tab=S.els.find(function(e){return e.id===el.tableCell.tableId});
    if(tab)renderEl(tab);
  } else {
    renderEl(el);
  }
  refreshLayers();
  refreshProps();
  snapshot();
  drawSel();
}

// ── CLIPBOARD ──
function getSelItems(){
  var ids=S.selIds.length?S.selIds:(S.selId?[S.selId]:[]);
  return ids.map(function(id){return S.els.find(function(e){return e.id===id})||S.frames.find(function(f){return f.id===id});}).filter(Boolean);
}
function copyItems(){
  var items=getSelItems();if(!items.length){toast('Nothing to copy');return;}
  S.pasteOff=0;S.clipboard=[];
  var covered=[];
  items.forEach(function(item){
    if(item.type==='frame'){
      var fd=deep(item);
      fd._childData=item.children.map(function(cid){var c=S.els.find(function(e){return e.id===cid});return c?deep(c):null;}).filter(Boolean);
      S.clipboard.push({kind:'frame',data:fd});
      item.children.forEach(function(cid){covered.push(cid);});
    } else if(covered.indexOf(item.id)<0){
      S.clipboard.push({kind:'el',data:deep(item)});
    }
  });
  toast('Copied '+S.clipboard.length+' item'+(S.clipboard.length>1?'s':''));
}
function cutItems(){copyItems();delSel();}
function bboxOfClipboardEntry(entry){
  var left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
  function expand(l,t,w,h){if(w<0){l+=w;w=-w;}if(h<0){t+=h;h=-h;}left=Math.min(left,l);top=Math.min(top,t);right=Math.max(right,l+w);bottom=Math.max(bottom,t+h);}
  if(entry.kind==='frame'){
    var fd=entry.data;
    expand(fd.x,fd.y,fd.w||0,fd.h||0);
    (fd._childData||[]).forEach(function(cd){if(cd)expand(fd.x+(cd.x||0),fd.y+(cd.y||0),cd.w||0,cd.h||0);});
  } else {
    var d=entry.data;
    if(d.type==='path'&&d.pts&&d.pts.length){var b=pathTightBBox(d.pts,!!(d.d&&d.d.endsWith('Z')));expand(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);}
    else if(d.type==='line'){var lx=d.x||0,ly=d.y||0,lw=d.w||0,lh=d.h||0;expand(Math.min(lx,lx+lw),Math.min(ly,ly+lh),Math.abs(lw),Math.abs(lh));}
    else expand(d.x||0,d.y||0,d.w||0,d.h||0);
  }
  return left===Infinity?null:{left:left,top:top,right:right,bottom:bottom,w:right-left,h:bottom-top};
}
function pasteItems(){
  if(!S.clipboard.length){toast('Clipboard empty');return;}
  S.pasteOff+=16;var nids=[];
  S.clipboard.forEach(function(entry){
    if(entry.kind==='frame'){
      var fd=deep(entry.data);var cdArr=fd._childData||[];delete fd._childData;
      fd.id=uid();fd.x+=S.pasteOff;fd.y+=S.pasteOff;fd.name=fd.name+' copy';fd.children=[];
      S.frames.push(fd);renderFrame(fd);
      cdArr.forEach(function(cd){var nc=deep(cd);nc.id=uid();nc.frameId=fd.id;nc.name=nc.name+' copy';S.els.push(nc);fd.children.push(nc.id);var fc=getFCG(fd.id);if(fc)renderElInto(nc,fc);});
      nids.push(fd.id);
    } else {
      var nd=deep(entry.data);nd.id=uid();nd.name=nd.name+' copy';nd.frameId=null;
      if(nd.type==='path'&&nd.pts&&nd.pts.length){movePath(nd,S.pasteOff,S.pasteOff);}
      else{nd.x=(nd.x||0)+S.pasteOff;nd.y=(nd.y||0)+S.pasteOff;}
      S.els.push(nd);renderElInto(nd,dom.elsLoose);nids.push(nd.id);
    }
  });
  S.selIds=nids;S.selId=nids[nids.length-1];drawSel();refreshLayers();refreshProps();snapshot();
  toast('Pasted '+nids.length+' item'+(nids.length>1?'s':''));
}
function pasteItemsAtCenter(){
  if(!S.clipboard.length){toast('Clipboard empty');return;}
  var r=dom.canvas.getBoundingClientRect();
  var vpCenterX=(r.width/2-S.px)/S.zoom;
  var vpCenterY=(r.height/2-S.py)/S.zoom;
  var bboxLeft=Infinity,bboxTop=Infinity,bboxRight=-Infinity,bboxBottom=-Infinity;
  S.clipboard.forEach(function(entry){
    var b=bboxOfClipboardEntry(entry);
    if(b){bboxLeft=Math.min(bboxLeft,b.left);bboxTop=Math.min(bboxTop,b.top);bboxRight=Math.max(bboxRight,b.right);bboxBottom=Math.max(bboxBottom,b.bottom);}
  });
  var dx=0,dy=0;
  if(bboxLeft!==Infinity){
    var cx=(bboxLeft+bboxRight)/2,cy=(bboxTop+bboxBottom)/2;
    dx=vpCenterX-cx;dy=vpCenterY-cy;
  }
  var nids=[];
  S.clipboard.forEach(function(entry){
    if(entry.kind==='frame'){
      var fd=deep(entry.data);var cdArr=fd._childData||[];delete fd._childData;
      fd.id=uid();fd.x+=dx;fd.y+=dy;fd.name=fd.name+' copy';fd.children=[];
      S.frames.push(fd);renderFrame(fd);
      cdArr.forEach(function(cd){var nc=deep(cd);nc.id=uid();nc.frameId=fd.id;nc.name=nc.name+' copy';S.els.push(nc);fd.children.push(nc.id);var fc=getFCG(fd.id);if(fc)renderElInto(nc,fc);});
      nids.push(fd.id);
    } else {
      var nd=deep(entry.data);nd.id=uid();nd.name=nd.name+' copy';nd.frameId=null;
      if(nd.type==='path'&&nd.pts&&nd.pts.length){movePath(nd,dx,dy);}
      else{nd.x=(nd.x||0)+dx;nd.y=(nd.y||0)+dy;}
      S.els.push(nd);renderElInto(nd,dom.elsLoose);nids.push(nd.id);
    }
  });
  S.selIds=nids;S.selId=nids[nids.length-1];drawSel();refreshLayers();refreshProps();snapshot();
  toast('Pasted '+nids.length+' item'+(nids.length>1?'s':''));
}
var copyBtn=document.getElementById('copy-btn');if(copyBtn)copyBtn.addEventListener('click',copyItems);
var cutBtn=document.getElementById('cut-btn');if(cutBtn)cutBtn.addEventListener('click',cutItems);
var pasteBtn=document.getElementById('paste-btn');if(pasteBtn)pasteBtn.addEventListener('click',pasteItems);

// ── OBJECT CONTEXT MENU (dropdown) ──
var objCtxMenuClose=null;
function closeObjContextMenu(){
  var menu=document.getElementById('obj-context-menu');
  if(menu){menu.classList.remove('show');menu.innerHTML='';}
  if(objCtxMenuClose){objCtxMenuClose();objCtxMenuClose=null;}
}
function showObjContextMenu(clientX,clientY){
  closeObjContextMenu();
  var items=getSelItems();
  if(!items.length)return;
  var single=items.length===1?items[0]:null;
  var canConvert=single&&(single.type==='rect'||single.type==='ellipse');
  var menu=document.getElementById('obj-context-menu');
  if(!menu)return;
  function addItem(label,fn,disabled){
    var btn=document.createElement('button');
    btn.className='obj-ctx-item';
    btn.textContent=label;
    if(disabled)btn.disabled=true;
    else btn.addEventListener('click',function(e){e.stopPropagation();closeObjContextMenu();if(fn)fn();});
    menu.appendChild(btn);
  }
  function addSep(){var s=document.createElement('div');s.className='obj-ctx-sep';menu.appendChild(s);}
  addItem('Copy',copyItems,false);
  addItem('Paste',pasteItems,!S.clipboard.length);
  if(canConvert){addSep();addItem('Convert to path',function(){
    if(single.type==='rect')convertRectToPath(single);else if(single.type==='ellipse')convertEllipseToPath(single);
  },false);}
  menu.classList.add('show');
  var r=menu.getBoundingClientRect();
  var pad=8;
  var x=clientX,y=clientY;
  if(x+r.width+pad>window.innerWidth)x=window.innerWidth-r.width-pad;
  if(y+r.height+pad>window.innerHeight)y=window.innerHeight-r.height-pad;
  if(x<pad)x=pad;if(y<pad)y=pad;
  menu.style.left=x+'px';menu.style.top=y+'px';
  var closeHandler=function(){closeObjContextMenu();};
  objCtxMenuClose=function(){
    document.removeEventListener('click',closeHandler);
    document.removeEventListener('contextmenu',closeHandler);
  };
  setTimeout(function(){document.addEventListener('click',closeHandler);document.addEventListener('contextmenu',closeHandler);},0);
}
function showArtboardContextMenu(clientX,clientY){
  closeObjContextMenu();
  var menu=document.getElementById('obj-context-menu');
  if(!menu)return;
  function addItem(label,fn,disabled){
    var btn=document.createElement('button');
    btn.className='obj-ctx-item';
    btn.textContent=label;
    if(disabled)btn.disabled=true;
    else btn.addEventListener('click',function(e){e.stopPropagation();closeObjContextMenu();if(fn)fn();});
    menu.appendChild(btn);
  }
  addItem('Paste',pasteItems,!S.clipboard.length);
  addItem('Paste at center',pasteItemsAtCenter,!S.clipboard.length);
  menu.classList.add('show');
  var r=menu.getBoundingClientRect();
  var pad=8;
  var x=clientX,y=clientY;
  if(x+r.width+pad>window.innerWidth)x=window.innerWidth-r.width-pad;
  if(y+r.height+pad>window.innerHeight)y=window.innerHeight-r.height-pad;
  if(x<pad)x=pad;if(y<pad)y=pad;
  menu.style.left=x+'px';menu.style.top=y+'px';
  var closeHandler=function(){closeObjContextMenu();};
  objCtxMenuClose=function(){
    document.removeEventListener('click',closeHandler);
    document.removeEventListener('contextmenu',closeHandler);
  };
  setTimeout(function(){document.addEventListener('click',closeHandler);document.addEventListener('contextmenu',closeHandler);},0);
}
if(dom.canvas)dom.canvas.addEventListener('contextmenu',function(e){
  if(e.target===dom.ted)return;
  var items=getSelItems();
  if(items.length){e.preventDefault();showObjContextMenu(e.clientX,e.clientY);}
  else{e.preventDefault();showArtboardContextMenu(e.clientX,e.clientY);}
});

// ── ALIGNMENT ──
function alignItems(mode){
  var ids=S.selIds.length>1?S.selIds:(S.selId?[S.selId]:[]);if(!ids.length)return;
  var items=ids.map(function(id){return S.els.find(function(e){return e.id===id})||S.frames.find(function(f){return f.id===id});}).filter(Boolean);
  if(!items.length)return;
  var pfIds=items.map(function(it){return it.frameId||null});
  var allSame=pfIds.every(function(fid){return fid&&fid===pfIds[0]});
  var cf=allSame&&pfIds[0]?S.frames.find(function(f){return f.id===pfIds[0]}):null;
  var ref;
  if(cf){ref={x:0,y:0,w:cf.w,h:cf.h};}
  else{var x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;items.forEach(function(it){var bb=getBBox(it);x1=Math.min(x1,bb.x);y1=Math.min(y1,bb.y);x2=Math.max(x2,bb.x+bb.w);y2=Math.max(y2,bb.y+bb.h);});ref={x:x1,y:y1,w:x2-x1,h:y2-y1};}
  if(mode==='dist-h'||mode==='dist-v'){
    var sorted=items.slice().sort(function(a,b){var ba=getBBox(a),bb2=getBBox(b);return mode==='dist-h'?ba.x-bb2.x:ba.y-bb2.y;});
    if(sordom.ted.length<3){toast('Need 3+ items');return;}
    var first=getBBox(sorted[0]),last=getBBox(sorted[sordom.ted.length-1]);
    var tot=0;sordom.ted.forEach(function(it){var bb2=getBBox(it);tot+=mode==='dist-h'?bb2.w:bb2.h;});
    var span=mode==='dist-h'?(last.x+last.w-first.x):(last.y+last.h-first.y);
    var gap=(span-tot)/(sordom.ted.length-1);var cur=mode==='dist-h'?first.x:first.y;
    sordom.ted.forEach(function(it){
      var bb2=getBBox(it);var isFr2=!!S.frames.find(function(f){return f.id===it.id});var ab=absPos(it);
      var setP=function(ax,ay){if(isFr2){it.x=ax;it.y=ay;renderFrame(it);}else if(it.frameId){var pf=S.frames.find(function(f){return f.id===it.frameId});if(pf){it.x=ax-pf.x;it.y=ay-pf.y;}renderEl(it);}else{it.x=ax;it.y=ay;renderEl(it);}};
      if(mode==='dist-h'){setP(cur,ab.y);cur+=bb2.w+gap;}else{setP(ab.x,cur);cur+=bb2.h+gap;}
    });
    drawSel();refreshProps();snapshot();toast('Distributed');return;
  }
  items.forEach(function(it){
    var bb=getBBox(it);var isFr2=!!S.frames.find(function(f){return f.id===it.id});
    var rX=cf?cf.x+ref.x:ref.x,rY=cf?cf.y+ref.y:ref.y;
    var ax=bb.x,ay=bb.y;
    if(mode==='left')ax=rX;if(mode==='right')ax=rX+ref.w-it.w;if(mode==='cx')ax=rX+ref.w/2-it.w/2;
    if(mode==='top')ay=rY;if(mode==='bottom')ay=rY+ref.h-it.h;if(mode==='cy')ay=rY+ref.h/2-it.h/2;
    if(isFr2){it.x=ax;it.y=ay;renderFrame(it);}
    else if(it.frameId){var pf=S.frames.find(function(f){return f.id===it.frameId});if(pf){it.x=ax-pf.x;it.y=ay-pf.y;}renderEl(it);}
    else{it.x=ax;it.y=ay;renderEl(it);}
  });
  drawSel();refreshProps();snapshot();toast('Aligned');
}

// ── LAYERS ──
/** Build default root order (groups, frames, els; els exclude tableCell so only table appears, not cells). */
function buildDefaultRootOrder(){
  var rootG=S.groups.filter(function(g){return !g.frameId&&!g.groupId;});
  var rootF=S.frames.filter(function(f){return !f.frameId&&!f.groupId;});
  var rootE=S.els.filter(function(e){return !e.frameId&&!e.groupId&&!e.tableCell;});
  return [].concat(rootG).reverse().map(function(g){return g.id;})
    .concat([].concat(rootF).reverse().map(function(f){return f.id;}))
    .concat([].concat(rootE).reverse().map(function(e){return e.id;}));
}
/** Unified root order: first id = top row in list. Uses S.rootOrder if set (after user reorder), else built from groups, frames, els. New root items (e.g. new table) are appended to S.rootOrder so they appear in the layer tree. */
function getRootListOrder(){
  var currentRoot=buildDefaultRootOrder();
  if(!S.rootOrder||S.rootOrder.length===0)return currentRoot;
  var set={}; S.rootOrder.forEach(function(id){set[id]=true;});
  var missing=currentRoot.filter(function(id){return !set[id];});
  if(missing.length>0)S.rootOrder=S.rootOrder.concat(missing);
  return S.rootOrder.slice();
}
/** Apply new root order (array of ids). Preserves unified order: root items in S.groups/S.frames/S.els follow order in ids. */
function applyRootOrder(ids){
  S.rootOrder=ids.slice();
  var isGroup=function(id){return S.groups.some(function(g){return g.id===id;});};
  var isFrame=function(id){return S.frames.some(function(f){return f.id===id;});};
  var groupIds=ids.filter(isGroup);
  var frameIds=ids.filter(isFrame);
  var elIds=ids.filter(function(id){return !isGroup(id)&&!isFrame(id);});
  var nonRootG=S.groups.filter(function(g){return !!g.frameId||!!g.groupId;});
  var nonRootF=S.frames.filter(function(f){return !!f.frameId||!!f.groupId;});
  var nonRootE=S.els.filter(function(e){return !!e.frameId||!!e.groupId;});
  S.groups=nonRootG.concat(groupIds.map(function(id){return S.groups.find(function(g){return g.id===id;});}).filter(Boolean));
  S.frames=nonRootF.concat(frameIds.map(function(id){return S.frames.find(function(f){return f.id===id;});}).filter(Boolean));
  S.els=nonRootE.concat(elIds.map(function(id){return S.els.find(function(e){return e.id===id;});}).filter(Boolean));
}
function getParentChildrenArray(parentFrameId,parentGroupId,rootType){
  if(parentGroupId){
    var pg=S.groups.find(function(g){return g.id===parentGroupId;});
    return pg?pg.children:null;
  }
  if(parentFrameId){
    var pf=S.frames.find(function(f){return f.id===parentFrameId;});
    return pf?pf.children:null;
  }
  if(rootType==='frame')return S.frames.filter(function(f){return !f.frameId&&!f.groupId;});
  if(rootType==='group')return S.groups.filter(function(g){return !g.frameId&&!g.groupId;});
  if(rootType==='el')return S.els.filter(function(e){return !e.frameId&&!e.groupId;});
  return null;
}
function reorderLayerInTree(dragId,dropTargetId,dragParentFrame,dragParentGroup,dragRootType,dropParentFrame,dropParentGroup,dropRootType){
  console.log('[reorderLayerInTree]', { dragId, dropTargetId, dragParentFrame, dragParentGroup, dragRootType, dropParentFrame, dropParentGroup, dropRootType });
  var bothRoot=!dragParentFrame&&!dragParentGroup&&!dropParentFrame&&!dropParentGroup;
  if(bothRoot){
    var rootOrder=getRootListOrder();
    var fromIdx=rootOrder.indexOf(dragId);
    var toIdx=rootOrder.indexOf(dropTargetId);
    if(fromIdx<0||toIdx<0||fromIdx===toIdx){
      console.log('[reorderLayerInTree] FAIL: root reorder fromIdx/toIdx', fromIdx, toIdx);
      return false;
    }
    var one=rootOrder.splice(fromIdx,1)[0];
    var newIdx=fromIdx<toIdx?toIdx-1:toIdx;
    rootOrder.splice(newIdx,0,one);
    applyRootOrder(rootOrder);
    console.log('[reorderLayerInTree] OK, root unified reorder');
    return {ok:true};
  }
  var sameContainer = dragParentFrame===dropParentFrame&&dragParentGroup===dropParentGroup&&dragRootType===dropRootType;
  if(!sameContainer){
    var crossResult=moveLayerBetweenContainers(dragId,dropTargetId,dragParentFrame,dragParentGroup,dragRootType,dropParentFrame,dropParentGroup,dropRootType);
    return crossResult ? {ok:true,crossContainer:true} : false;
  }
  var arr=getParentChildrenArray(dropParentFrame,dropParentGroup,dropRootType);
  if(!arr){
    console.log('[reorderLayerInTree] FAIL: getParentChildrenArray returned null');
    return false;
  }
  var fromIdx,toIdx;
  if(dragRootType){
    arr=arr.slice();
    fromIdx=arr.findIndex(function(x){return x.id===dragId;});
    toIdx=arr.findIndex(function(x){return x.id===dropTargetId;});
  } else {
    fromIdx=arr.indexOf(dragId);
    toIdx=arr.indexOf(dropTargetId);
  }
  console.log('[reorderLayerInTree] arr.length=', arr.length, 'fromIdx=', fromIdx, 'toIdx=', toIdx);
  if(fromIdx<0||toIdx<0||fromIdx===toIdx){
    console.log('[reorderLayerInTree] FAIL: fromIdx or toIdx invalid or same');
    return false;
  }
  var one=arr.splice(fromIdx,1)[0];
  var newIdx=fromIdx<toIdx?toIdx-1:toIdx;
  arr.splice(newIdx,0,one);
  if(dragRootType==='el'){
    S.els=S.els.filter(function(e){return !!e.frameId||!!e.groupId;}).concat(arr);
  } else if(dragRootType==='frame'){
    S.frames=S.frames.filter(function(f){return !!f.frameId||!!f.groupId;}).concat(arr);
  } else if(dragRootType==='group'){
    S.groups=S.groups.filter(function(g){return !!g.frameId||!!g.groupId;}).concat(arr);
  }
  console.log('[reorderLayerInTree] OK, applied');
  return {ok:true};
}
function moveLayerBetweenContainers(dragId,dropTargetId,dragParentFrame,dragParentGroup,dragRootType,dropParentFrame,dropParentGroup,dropRootType){
  var dragGrp=S.groups.find(function(g){return g.id===dragId;});
  var dragFr=S.frames.find(function(f){return f.id===dragId;});
  var dragEl=S.els.find(function(e){return e.id===dragId;});
  var dragObj=dragGrp||dragFr||dragEl;
  if(!dragObj){
    console.log('[reorderLayerInTree] FAIL: moveLayerBetweenContainers drag not found');
    return false;
  }
  var dragType=dragGrp?'group':dragFr?'frame':'el';
  var dropArr=getParentChildrenArray(dropParentFrame,dropParentGroup,dropRootType);
  if(!dropArr){
    console.log('[reorderLayerInTree] FAIL: moveLayerBetweenContainers drop container null');
    return false;
  }
  var toIdx=dropRootType?dropArr.findIndex(function(x){return x.id===dropTargetId;}):dropArr.indexOf(dropTargetId);
  if(toIdx<0){
    console.log('[reorderLayerInTree] FAIL: moveLayerBetweenContainers dropTargetId not in container');
    return false;
  }
  function removeFromSource(){
    if(!dragParentFrame&&!dragParentGroup){
      var rootOrder=getRootListOrder();
      var idx=rootOrder.indexOf(dragId);
      if(idx>=0){rootOrder.splice(idx,1);applyRootOrder(rootOrder);}
      dragObj.frameId=null;dragObj.groupId=null;
      return;
    }
    if(dragParentGroup){
      var pg=S.groups.find(function(g){return g.id===dragParentGroup;});
      if(pg&&pg.children){pg.children=pg.children.filter(function(cid){return cid!==dragId;});}
    } else if(dragParentFrame){
      var pf=S.frames.find(function(f){return f.id===dragParentFrame;});
      if(pf&&pf.children){pf.children=pf.children.filter(function(cid){return cid!==dragId;});}
    }
  }
  function addToTarget(){
    if(!dropParentFrame&&!dropParentGroup){
      dragObj.frameId=null;dragObj.groupId=null;
      var rootOrder=getRootListOrder();
      var insertIdx=rootOrder.indexOf(dropTargetId);
      if(insertIdx<0)insertIdx=rootOrder.length;
      rootOrder.splice(insertIdx,0,dragId);
      applyRootOrder(rootOrder);
      return;
    }
    if(dropParentGroup){
      var dpg=S.groups.find(function(g){return g.id===dropParentGroup;});
      if(dpg){
        dragObj.frameId=dpg.frameId||null;dragObj.groupId=dropParentGroup;
        dpg.children=dpg.children||[];
        var i=dpg.children.indexOf(dropTargetId);if(i<0)i=dpg.children.length;
        dpg.children.splice(i,0,dragId);
      }
    } else if(dropParentFrame){
      var dpf=S.frames.find(function(f){return f.id===dropParentFrame;});
      if(dpf){
        dragObj.frameId=dropParentFrame;dragObj.groupId=null;
        dpf.children=dpf.children||[];
        var j=dpf.children.indexOf(dropTargetId);if(j<0)j=dpf.children.length;
        dpf.children.splice(j,0,dragId);
      }
    }
  }
  removeFromSource();
  addToTarget();
  console.log('[reorderLayerInTree] OK, moved between containers');
  return true;
}
function applyReorderAndRerender(dragParentFrame,dragParentGroup,dragRootType){
  console.log('[applyReorderAndRerender]', { dragParentFrame, dragParentGroup, dragRootType });
  if(dragRootType==='frame'){
    dom.framesG.innerHTML='';
    S.frames.filter(function(f){return !f.frameId&&!f.groupId;}).forEach(function(f){renderFrame(f);});
    renderLooseWithMasks();
    console.log('[applyReorderAndRerender] branch: frame');
  } else if(dragRootType==='group'||dragRootType==='el'){
    renderLooseWithMasks();
    console.log('[applyReorderAndRerender] branch: group/el');
  } else if(dragParentFrame){
    var fr=S.frames.find(function(f){return f.id===dragParentFrame;});
    if(fr){var fc=getFCG(fr.id);if(fc){fc.innerHTML='';renderChildrenWithMasks(fr.children||[],fc,fr.id,null);}}
    console.log('[applyReorderAndRerender] branch: parentFrame');
  } else if(dragParentGroup){
    var gr=S.groups.find(function(g){return g.id===dragParentGroup;});
    if(gr)renderGroup(gr);
    console.log('[applyReorderAndRerender] branch: parentGroup');
  } else {
    console.log('[applyReorderAndRerender] branch: none (no match)');
  }
}
function refreshLayers(){
  if(!dom.layersDiv)return;
  dom.layersDiv.innerHTML='';
  var lct=document.getElementById('lct');if(lct)lct.textContent=S.frames.length+S.els.length+S.groups.length;
  var items=[];
  function addGroup(grp,depth,parentFrameId,parentGroupId,rootType){
    var it={type:'group',obj:grp,depth:depth,parentFrameId:parentFrameId||'',parentGroupId:parentGroupId||'',rootType:rootType||''};
    items.push(it);
    if(S.collapsedGroups[grp.id])return;
    [].concat(grp.children).reverse().forEach(function(cid){
      var cg2=S.groups.find(function(g){return g.id===cid});
      if(cg2){addGroup(cg2,depth+1,grp.frameId||'',grp.id,'');return;}
      var cf2=S.frames.find(function(f){return f.id===cid});
      if(cf2){addFrame(cf2,depth+1,grp.frameId||'',grp.id,'');return;}
      var ce2=S.els.find(function(e){return e.id===cid});
      if(ce2)items.push({type:'child',obj:ce2,depth:depth+1,parentFrameId:grp.frameId||'',parentGroupId:grp.id,rootType:''});
    });
  }
  function addFrame(fr,depth,parentFrameId,parentGroupId,rootType){
    var it={type:'frame',obj:fr,depth:depth,parentFrameId:parentFrameId||'',parentGroupId:parentGroupId||'',rootType:rootType||''};
    items.push(it);
    if(S.collapsedFrames[fr.id])return;
    [].concat(fr.children).reverse().forEach(function(cid){
      var cg3=S.groups.find(function(g){return g.id===cid});
      if(cg3){addGroup(cg3,depth+1,fr.id,'','');return;}
      var cf3=S.frames.find(function(f){return f.id===cid});
      if(cf3){addFrame(cf3,depth+1,fr.id,'','');return;}
      var ce3=S.els.find(function(e){return e.id===cid});
      if(ce3)items.push({type:'child',obj:ce3,depth:depth+1,parentFrameId:fr.id,parentGroupId:'',rootType:''});
    });
  }
  getRootListOrder().forEach(function(id){
    var grp=S.groups.find(function(g){return g.id===id;});
    if(grp){addGroup(grp,0,'','','group');return;}
    var fr=S.frames.find(function(f){return f.id===id;});
    if(fr){addFrame(fr,0,'','','frame');return;}
    var el=S.els.find(function(e){return e.id===id;});
    if(el){items.push({type:'el',obj:el,depth:0,parentFrameId:'',parentGroupId:'',rootType:'el'});}
  });
  items.forEach(function(item){
    var d=document.createElement('div');
    var isF=item.type==='frame',isGrp=item.type==='group';
    var isComp=!!item.obj.isComponent,isInst=!!item.obj.isInstance,isMask=!!(item.obj.isMask),isMaskGrp=!!(isGrp&&item.obj.isMaskGroup);
    var isSel=item.obj.id===S.selId,isM2=!isSel&&S.selIds.indexOf(item.obj.id)>=0;
    var cls='li draggable'+(isSel?' sel':isM2?' msel':'');
    if(isComp)cls+=' comp-li';else if(isInst)cls+=' inst-li';else if(isF)cls+=' frame-li';else if(isGrp)cls+=' group-li';
    d.className=cls;
    d.dataset.layerId=item.obj.id;
    d.dataset.parentFrame=item.parentFrameId||'';
    d.dataset.parentGroup=item.parentGroupId||'';
    d.dataset.rootType=item.rootType||'';
    d.dataset.indent=String((item.depth||0)*14+14);
    d.draggable=true;
    var indent=(item.depth||0)*14+14;
    d.style.paddingLeft=indent+'px';
    var badge = '';
    if(isComp) badge = '<span class="comp-badge">✦ C</span>';
    else if(isInst) badge = '<span class="inst-badge">⬡ I</span>';
    else if(isMaskGrp) badge = '<span class="mask-badge">⬡ Mask</span>';
    else if(isMask) badge = '<span class="mask-badge">⬡ Mask</span>';
    else if(isGrp) badge = '<span class="group-badge">⊞ G</span>';
    var hasKidsF=isF&&item.obj.children&&item.obj.children.length>0;
    var hasKidsG=isGrp&&item.obj.children&&item.obj.children.length>0;
    var collapsed=isF&&hasKidsF&&!!S.collapsedFrames[item.obj.id]||isGrp&&hasKidsG&&!!S.collapsedGroups[item.obj.id];
    if(isF||isGrp){
      var foldSpan=document.createElement('span');
      foldSpan.className='li-fold-wrap';
      var hasKids=isF?hasKidsF:hasKidsG;
      if(hasKids){
        var fold=document.createElement('span');
        fold.className='li-fold';
        fold.title=collapsed?'Expand':'Collapse';
        fold.textContent=collapsed?'\u25B6':'\u25BC';
        if(isF){fold.dataset.frameId=item.obj.id;}else{fold.dataset.groupId=item.obj.id;}
        fold.addEventListener('click',function(e){e.stopPropagation();var fid=e.currentTarget.dataset.frameId,gid=e.currentTarget.dataset.groupId;if(fid){S.collapsedFrames[fid]=!S.collapsedFrames[fid];}if(gid){S.collapsedGroups[gid]=!S.collapsedGroups[gid];}refreshLayers();});
        foldSpan.appendChild(fold);
      }
      d.appendChild(foldSpan);
    }
    var rest=document.createElement('span');
    rest.className='li-rest';
    rest.innerHTML=('<span class="li-icon">'+(ICONS[item.obj.type]||'◻')+'</span><span>'+item.obj.name+'</span>'+badge);
    d.appendChild(rest);
    d.addEventListener('click',function(e){if(e.target.closest('.li-fold'))return;selectEl(item.obj.id,e.shiftKey||e.ctrlKey||e.metaKey);setTool('select');});
    d.addEventListener('dragstart',function(e){
      e.stopPropagation();
      var payload={id:item.obj.id,parentFrame:item.parentFrameId||'',parentGroup:item.parentGroupId||'',rootType:item.rootType||''};
      e.dataTransfer.setData('application/x-designos-layer',JSON.stringify(payload));
      e.dataTransfer.effectAllowed='move';
      d.classList.add('li-dragging');
      console.log('[Layers dragstart]', { id: payload.id, name: item.obj.name, parentFrame: payload.parentFrame, parentGroup: payload.parentGroup, rootType: payload.rootType });
    });
    d.addEventListener('dragend',function(){
      d.classList.remove('li-dragging');
      var ind=document.getElementById('layer-drop-indicator');if(ind)ind.style.display='none';
    });
    d.addEventListener('dragover',function(e){
      e.preventDefault();
      if(e.dataTransfer.types.indexOf('application/x-designos-layer')<0)return;
      e.dataTransfer.dropEffect='move';
      d.classList.add('li-drop-target');
      var ind=document.getElementById('layer-drop-indicator');
      if(ind){
        var v=ind.querySelector('.li-drop-line-v');if(v)v.style.left=(d.dataset.indent||'14')+'px';
        ind.style.display='block';
        if(ind.parentNode!==dom.layersDiv||ind.nextSibling!==d)dom.layersDiv.insertBefore(ind,d);
      }
    });
    d.addEventListener('dragleave',function(e){
      d.classList.remove('li-drop-target');
      if(!d.contains(e.relatedTarget)){var ind=document.getElementById('layer-drop-indicator');if(ind)ind.style.display='none';}
    });
    d.addEventListener('drop',function(e){
      e.preventDefault();
      d.classList.remove('li-drop-target');
      var ind=document.getElementById('layer-drop-indicator');if(ind)ind.style.display='none';
      var raw=e.dataTransfer.getData('application/x-designos-layer');
      if(!raw){ console.log('[Layers drop] no data'); return; }
      var dragData;try{dragData=JSON.parse(raw);}catch(err){ console.log('[Layers drop] parse err', err); return; }
      var dragId=dragData.id;
      var dropId=d.dataset.layerId;
      var dropPayload={ parentFrame: d.dataset.parentFrame||'', parentGroup: d.dataset.parentGroup||'', rootType: d.dataset.rootType||'' };
      console.log('[Layers drop]', { dragId, dropId, drag: dragData, drop: dropPayload });
      if(dragId===dropId){ console.log('[Layers drop] same id, skip'); return; }
      var result=reorderLayerInTree(dragId,dropId,dragData.parentFrame,dragData.parentGroup,dragData.rootType,d.dataset.parentFrame,d.dataset.parentGroup,d.dataset.rootType);
      var ok=result&&(typeof result==='object'?result.ok:result);
      console.log('[Layers drop] reorderLayerInTree result:', result);
      if(ok){
        if(result&&result.crossContainer)
          rerenderAll();
        else if(!dragData.parentFrame&&!dragData.parentGroup&&!d.dataset.parentFrame&&!d.dataset.parentGroup)
          rerenderAll();
        else
          applyReorderAndRerender(dragData.parentFrame,dragData.parentGroup,dragData.rootType);
        drawSel();
        refreshLayers();
        refreshProps();
        snapshot();
        toast('Order changed');
      }
    });
    dom.layersDiv.appendChild(d);
  });
  var ind=document.getElementById('layer-drop-indicator');
  if(!ind){
    ind=document.createElement('div');
    ind.id='layer-drop-indicator';
    ind.className='li-drop-line';
    var v=document.createElement('span');
    v.className='li-drop-line-v';
    ind.appendChild(v);
    dom.layersDiv.appendChild(ind);
  }
  ind.style.display='none';
}

// ── PROPERTIES ──
var activeGradStop=0;
function alignHTML(){
  function ic(p){return '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor">'+p+'</svg>';}
  var I={
    left:  ic('<rect x="3" y="3" width="7" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="3" y="8.5" width="4.5" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="1.5" y1="1.5" x2="1.5" y2="12.5" stroke-width="1.5" stroke-linecap="round"/>'),
    cx:    ic('<rect x="3" y="3" width="8" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="4.5" y="8.5" width="5" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="7" y1="1.5" x2="7" y2="12.5" stroke-width="1.5" stroke-linecap="round"/>'),
    right: ic('<rect x="4" y="3" width="7" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="5.5" y="8.5" width="5" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="12.5" y1="1.5" x2="12.5" y2="12.5" stroke-width="1.5" stroke-linecap="round"/>'),
    top:   ic('<rect x="3" y="3" width="2.5" height="7" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="8.5" y="3" width="2.5" height="4.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="1.5" y1="1.5" x2="12.5" y2="1.5" stroke-width="1.5" stroke-linecap="round"/>'),
    cy:    ic('<rect x="3" y="3" width="2.5" height="8" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="8.5" y="4.5" width="2.5" height="5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="1.5" y1="7" x2="12.5" y2="7" stroke-width="1.5" stroke-linecap="round"/>'),
    bottom:ic('<rect x="3" y="4" width="2.5" height="7" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><rect x="8.5" y="6.5" width="2.5" height="4.5" rx=".8" fill="currentColor" stroke="none" opacity=".7"/><line x1="1.5" y1="12.5" x2="12.5" y2="12.5" stroke-width="1.5" stroke-linecap="round"/>'),
    dh:    ic('<rect x="1" y="4" width="2.5" height="6" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><rect x="5.5" y="2" width="3" height="10" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><rect x="10.5" y="5" width="2.5" height="4" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><line x1="3.5" y1="7" x2="5.5" y2="7" stroke-width="1" stroke-dasharray="2,1.5"/><line x1="8.5" y1="7" x2="10.5" y2="7" stroke-width="1" stroke-dasharray="2,1.5"/>'),
    dv:    ic('<rect x="4" y="1" width="6" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><rect x="2" y="5.5" width="10" height="3" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><rect x="5" y="10.5" width="4" height="2.5" rx=".8" fill="currentColor" stroke="none" opacity=".6"/><line x1="7" y1="3.5" x2="7" y2="5.5" stroke-width="1" stroke-dasharray="2,1.5"/><line x1="7" y1="8.5" x2="7" y2="10.5" stroke-width="1" stroke-dasharray="2,1.5"/>')
  };
  var h='<div class="ps"><div class="ps-t">Align</div><div class="align-grid">';
  [['left','Align left'],['cx','Center H'],['right','Align right'],['top','Align top'],['cy','Center V'],['bottom','Align bottom']].forEach(function(a){
    h+='<button class="al-btn" data-align="'+a[0]+'" title="'+a[1]+'">'+I[a[0]]+'</button>';
  });
  h+='</div><div class="align-grid2" style="margin-top:4px">';
  h+='<button class="al-btn" data-align="dist-h" style="font-size:10px;gap:4px;padding:5px 2px">'+I.dh+' H</button>';
  h+='<button class="al-btn" data-align="dist-v" style="font-size:10px;gap:4px;padding:5px 2px">'+I.dv+' V</button>';
  h+='</div></div>';return h;
}
function bindAlignBtns(){document.querySelectorAll('.al-btn').forEach(function(b){b.addEventListener('click',function(){alignItems(b.dataset.align);});});}

function refreshProps(){
  if(!dom.propsDiv)return;
  var mc=S.selIds.length;
  if(mc>1){
    var h='<div class="ps"><div class="ps-t">'+mc+' items selected</div><div style="font-size:11px;color:var(--text3);margin-bottom:8px">Shift+click to add/remove</div></div>';
    h+=alignHTML();h+='<div class="ps"><button class="del-btn" id="ppdel">Delete '+mc+' items</button></div>';
    dom.propsDiv.innerHTML=h;bindAlignBtns();
    var d=document.getElementById('ppdel');if(d)d.addEventListener('click',delSel);return;
  }
  var selGrp=S.groups.find(function(g){return g.id===S.selId});
  if(selGrp){
    var grpTitle = selGrp.isMaskGroup ? '⬡ Mask' : (selGrp.isMask ? '⬡ Mask Group' : '⊞ Group');
    var h2='<div class="ps"><div class="ps-t">'+grpTitle+'</div>';
    h2+='<div style="font-size:11px;color:var(--text3);margin-bottom:8px">'+selGrp.children.length+' objects</div>';
    if(selGrp.isMaskGroup){
      h2+='<button class="del-btn" id="release-mask-grp-btn" style="margin-bottom:6px;background:rgba(123,97,255,.1);border-color:var(--accent);color:var(--accent)">Release Mask</button>';
    }
    h2+='<button class="del-btn" id="ungroup-pp-btn" style="margin-bottom:6px;background:rgba(123,97,255,.1);border-color:var(--accent);color:var(--accent)">⊟ Ungroup</button>';
    h2+='</div><div class="ps"><button class="del-btn" id="ppdel">Delete Group</button></div>';
    dom.propsDiv.innerHTML=h2;
    var ub=document.getElementById('ungroup-pp-btn');if(ub)ub.addEventListener('click',function(){S.selIds=[selGrp.id];S.selId=selGrp.id;ungroupSel();});
    var rmbGrp=document.getElementById('release-mask-grp-btn');if(rmbGrp)rmbGrp.addEventListener('click',function(){releaseMaskGroup(selGrp.id);});
    var db=document.getElementById('ppdel');if(db)db.addEventListener('click',delSel);
    return;
  }
  if(!S.selId){dom.propsDiv.innerHTML='<div class="no-sel">Select an element<br>to see properties<br><span style="font-size:10px;opacity:.5">Shift+click or drag to multi-select</span></div>';return;}
  var el=S.els.find(function(e){return e.id===S.selId});
  var fr=S.frames.find(function(f){return f.id===S.selId});
  var T=el||fr;if(!T){dom.propsDiv.innerHTML='<div class="no-sel">...</div>';return;}
  var isF=!!fr,isTxt=T.type==='text',isLine=T.type==='line',isImg=T.type==='image',isRect=T.type==='rect',isEllipse=T.type==='ellipse',isTable=T.type==='table';
  var isMaskLayer = !!T.isMask;
  var h='';
  if(isMaskLayer){
    h += '<div class="ps">';
    h += '<div class="ps-t">⬡ Mask Layer</div>';
    h += '<div style="font-size:11px;color:var(--text3);margin-bottom:8px">Clips the layers below it. Mask = last selected of the two.</div>';
    h += '<button class="del-btn" id="release-mask-btn" style="margin-bottom:6px;background:rgba(123,97,255,0.1);border-color:var(--accent);color:var(--accent)">Release Mask</button>';
    h += '</div>';
  }
  if(isF){
    h+='<div class="ps"><div class="ps-t">Frame Presets</div><div class="preset-grid">';
    PRESETS.forEach(function(p){h+='<button class="preset-btn" data-pw="'+p.w+'" data-ph="'+p.h+'">'+p.name+'<br><span style="opacity:.5;font-size:9px">'+p.w+'×'+p.h+'</span></button>';});
    h+='</div></div>';
    // Auto Layout panel
    var al=fr.autoLayout||{};
    var alOn=!!al.enabled;
    h+='<div class="ps"><div class="al-section">';
    h+='<div class="al-toggle-row"><span class="al-toggle-lbl">⊞ Auto Layout</span>';
    h+='<label class="al-switch"><input type="checkbox" id="al-toggle"'+(alOn?' checked':'')+'><span class="al-switch-track"></span></label></div>';
    if(alOn){
      var dir=al.dir||'h',gap=al.gap!=null?al.gap:8;
      var padT=al.padT!=null?al.padT:12,padR=al.padR!=null?al.padR:12,padB=al.padB!=null?al.padB:12,padL=al.padL!=null?al.padL:12;
      var alignCross=al.alignCross||'start';
      var wrap=!!al.wrap,hugW=al.hugW!==false,hugH=al.hugH!==false;
      h+='<div class="al-body">';
      // Direction
      h+='<div class="al-row"><span class="al-lbl">Direction</span><div class="al-seg">';
      h+='<button class="al-seg-btn'+(dir==='h'?' on':'')+'" data-aldir="h">⇄ H</button>';
      h+='<button class="al-seg-btn'+(dir==='v'?' on':'')+'" data-aldir="v">⇅ V</button>';
      h+='</div></div>';
      // Gap
      h+='<div class="al-row"><span class="al-lbl">Gap</span><input class="al-num" id="al-gap" type="number" min="0" value="'+gap+'"/></div>';
      // Padding
      h+='<div class="al-row"><span class="al-lbl">Padding</span><div class="al-pad-grid">';
      h+='<div><div class="al-pad-lbl">Top</div><input class="al-num" style="width:100%" id="al-pt" type="number" min="0" value="'+padT+'"/></div>';
      h+='<div><div class="al-pad-lbl">Right</div><input class="al-num" style="width:100%" id="al-pr" type="number" min="0" value="'+padR+'"/></div>';
      h+='<div><div class="al-pad-lbl">Bottom</div><input class="al-num" style="width:100%" id="al-pb" type="number" min="0" value="'+padB+'"/></div>';
      h+='<div><div class="al-pad-lbl">Left</div><input class="al-num" style="width:100%" id="al-pl" type="number" min="0" value="'+padL+'"/></div>';
      h+='</div></div>';
      // Cross-axis alignment
      h+='<div class="al-row"><span class="al-lbl">Align</span><div class="al-seg">';
      ['start','center','end'].forEach(function(a){
        var lbl=a==='start'?'⬛▭▭':a==='center'?'▭⬛▭':'▭▭⬛';
        h+='<button class="al-seg-btn'+(alignCross===a?' on':'')+'" data-alcross="'+a+'">'+lbl+'</button>';
      });
      h+='</div></div>';
      // Wrap
      h+='<div class="al-row"><span class="al-lbl">Wrap</span><div class="al-seg">';
      h+='<button class="al-seg-btn'+(!wrap?' on':'')+'" data-alwrap="0">No Wrap</button>';
      h+='<button class="al-seg-btn'+(wrap?' on':'')+'" data-alwrap="1">Wrap</button>';
      h+='</div></div>';
      // Hug toggles
      h+='<div class="al-row"><span class="al-lbl">Frame size</span><div class="al-seg">';
      h+='<button class="al-seg-btn'+(hugW?' on':'')+'" data-alhugw="1" title="Hug width">Hug W</button>';
      h+='<button class="al-seg-btn'+(!hugW?' on':'')+'" data-alhugw="0" title="Fixed width">Fix W</button>';
      h+='</div></div>';
      h+='<div class="al-row" style="margin-top:-4px"><span class="al-lbl"></span><div class="al-seg">';
      h+='<button class="al-seg-btn'+(hugH?' on':'')+'" data-alhugh="1" title="Hug height">Hug H</button>';
      h+='<button class="al-seg-btn'+(!hugH?' on':'')+'" data-alhugh="0" title="Fixed height">Fix H</button>';
      h+='</div></div>';
      h+='</div>'; // al-body
    }
    h+='</div></div>'; // al-section + ps
  }
  h+='<div class="ps"><div class="ps-t">Order</div><div class="zorder-row">';
  h+='<button class="zo-btn" id="zo-top">⬆ Front</button><button class="zo-btn" id="zo-fwd">↑ Fwd</button>';
  h+='<button class="zo-btn" id="zo-bwd">↓ Bwd</button><button class="zo-btn" id="zo-bot">⬇ Back</button></div></div>';
  h+=alignHTML();
  var ab=isF?{x:fr.x,y:fr.y}:absPos(T);
  if(!isLine){
    h+='<div class="ps"><div class="ps-t">Position & Size</div><div class="g2">';
    h+='<div><div class="g2-lbl">X</div><input class="pi" id="ppx" type="number" value="'+Math.round(ab.x)+'"/></div>';
    h+='<div><div class="g2-lbl">Y</div><input class="pi" id="ppy" type="number" value="'+Math.round(ab.y)+'"/></div>';
    h+='<div><div class="g2-lbl">W</div><input class="pi" id="ppw" type="number" value="'+Math.round(T.w)+'"/></div>';
    h+='<div><div class="g2-lbl">H</div><input class="pi" id="pph" type="number" value="'+Math.round(T.h)+'"/></div>';
    h+='</div>';
    if(isRect||isF){
      h+='<div class="pr" style="margin-top:8px">';
      h+='<span class="pl" style="min-width:54px;font-size:10px">⌐ Radius</span>';
      h+='<input class="pi" id="pprx" type="number" min="0" value="'+(T.rx||0)+'"/></div>';
    }
    // Child sizing inside AL frame
    if(!isF&&T.frameId){
      var parentFr=S.frames.find(function(f){return f.id===T.frameId});
      if(parentFr&&getAL(parentFr)){
        var alDir=parentFr.autoLayout.dir;
        h+='<div class="child-sizing-row">';
        h+='<span class="al-lbl" style="min-width:52px;font-size:10px">W sizing</span><div class="al-seg" style="flex:1">';
        h+='<button class="al-seg-btn'+(!T.alFillW?' on':'')+'" data-csw="fixed">Fixed</button>';
        h+='<button class="al-seg-btn'+(T.alFillW?' on':'')+'" data-csw="fill">Fill</button>';
        h+='</div></div>';
        h+='<div class="child-sizing-row">';
        h+='<span class="al-lbl" style="min-width:52px;font-size:10px">H sizing</span><div class="al-seg" style="flex:1">';
        h+='<button class="al-seg-btn'+(!T.alFillH?' on':'')+'" data-csh="fixed">Fixed</button>';
        h+='<button class="al-seg-btn'+(T.alFillH?' on':'')+'" data-csh="fill">Fill</button>';
        h+='</div></div>';
      }
    }
    h+='</div>';
  }
  var opPct=Math.round((T.opacity!=null?T.opacity:1)*100);
  var rotDeg=Math.round(T.rotation||0);
  h+='<div class="ps"><div class="ps-t">Opacity & Rotation</div><div class="op-row">';
  h+='<input type="range" class="op-slider" id="pp-op-s" min="0" max="100" value="'+opPct+'"/>';
  h+='<input type="number" class="op-num" id="pp-op-n" min="0" max="100" value="'+opPct+'"/><span class="pl">%</span></div>';
  h+='<div class="op-row" style="margin-top:6px">';
  h+='<span class="pl" style="min-width:14px;font-size:11px">↻</span>';
  h+='<input type="range" class="op-slider" id="pp-rot-s" min="0" max="360" value="'+rotDeg+'"/>';
  h+='<input type="number" class="op-num" id="pp-rot-n" min="0" max="360" value="'+rotDeg+'"/><span class="pl">°</span></div>';
  h+='</div>';
  if(!isImg){
    var fm=T.fillMode||'solid';
    h+='<div class="ps"><div class="ps-t">'+(isF?'Background':isTable?'Background':'Fill')+'</div>';
    if(!isF&&!isLine&&!isTable){
      h+='<div class="fill-mode-row">';
      h+='<button class="fill-mode-btn'+(fm==='solid'?' on':'')+'" data-mode="solid">Solid</button>';
      h+='<button class="fill-mode-btn'+(fm==='linear'?' on':'')+'" data-mode="linear">Linear</button>';
      h+='<button class="fill-mode-btn'+(fm==='radial'?' on':'')+'" data-mode="radial">Radial</button></div>';
    }
    if(fm==='solid'||isF||isLine||isTable){
      var hasFill=T.fill&&T.fill!=='none';
      var fillVis=T.fillVisible!==false;
      var fbg=T.fill==='none'?'transparent':T.fill;
      if(!hasFill){
        h+='<div class="pr"><button type="button" class="preset-btn" id="pp-fill-add" style="width:100%">+ Add fill</button></div>';
      } else {
        h+='<div class="pr">';
        h+='<div class="csw" style="background:'+fbg+'"><input type="color" id="ppfill" value="'+(T.fill==='none'?'#7b61ff':T.fill)+'"/></div>';
        h+='<input class="pi" id="ppfillhex" value="'+T.fill+'"/>';
        h+='<button type="button" class="tbtn pp-fill-vis" title="'+(fillVis?'Hide fill':'Show fill')+'" style="flex-shrink:0;opacity:'+(fillVis?'1':'0.4')+'">\u{1F441}</button>';
        h+='<button type="button" class="tbtn pp-fill-remove" title="Remove fill" style="flex-shrink:0">\u2212</button></div>';
      }
    } else {
      var grad=T.gradient||(T.gradient=defGrad(fm));grad.type=fm;
      h+='<div class="grad-bar" id="grad-bar" style="background:'+gradCSS(grad)+'">';
      (grad.stops||[]).forEach(function(st,i){h+='<div class="grad-stop'+(i===activeGradStop?' active-stop':'')+'" data-si="'+i+'" style="left:'+(st.pos*100)+'%;background:'+st.color+'"></div>';});
      h+='</div>';
      if(fm==='linear')h+='<div class="pr" style="margin-bottom:8px"><span class="pl">°</span><input class="pi" id="grad-angle" type="number" value="'+(grad.angle||0)+'" min="0" max="360"/></div>';
      var ast=grad.stops[activeGradStop]||grad.stops[0];
      if(ast){
        h+='<div class="pr"><span class="pl" style="font-size:10px">Stop '+(activeGradStop+1)+'</span>';
        h+='<div class="csw" style="background:'+ast.color+'"><input type="color" id="stop-color" value="'+ast.color+'"/></div>';
        h+='<input class="pi" id="stop-pos" type="number" min="0" max="100" value="'+Math.round(ast.pos*100)+'"/><span class="pl">%</span></div>';
        var stopOpPct=Math.round((ast.opacity!=null?ast.opacity:1)*100);
        h+='<div class="stop-op-row"><span class="pl" style="font-size:10px;min-width:22px">α</span>';
        h+='<input type="range" class="stop-op-slider" id="stop-op-s" min="0" max="100" value="'+stopOpPct+'"/>';
        h+='<input type="number" class="stop-op-num" id="stop-op-n" min="0" max="100" value="'+stopOpPct+'"/><span class="pl">%</span></div>';
        h+='<button id="add-stop" style="width:100%;padding:5px;background:var(--surface2);border:1px solid var(--border);border-radius:5px;color:var(--text2);font-size:11px;cursor:pointer;margin-top:4px">+ Add stop</button>';
      }
    }
    h+='</div>';
  }
  if(isImg){h+='<div class="ps"><div class="ps-t">Image</div><div class="img-drop" id="img-rd">Click or drop to replace<input type="file" id="img-ri" accept="image/*"/></div></div>';}
  if((!isF&&!isTxt&&!isImg)||isTable){
    var hasStroke=T.stroke&&T.stroke!=='none'&&(T.strokeWidth||0)>0;
    var sbg=T.stroke==='none'?'transparent':T.stroke;
    var salign=T.strokeAlign||'center';
    var strokeVis=T.strokeVisible!==false;
    h+='<div class="ps"><div class="ps-t">Stroke</div>';
    if(!hasStroke){
      h+='<div class="pr"><button type="button" class="preset-btn" id="pp-stroke-add" style="width:100%">+ Add stroke</button></div>';
    } else {
      h+='<div class="pr">';
      h+='<div class="csw" style="background:'+sbg+'"><input type="color" id="ppstroke" value="'+(T.stroke==='none'?'#ffffff':T.stroke)+'"/></div>';
      h+='<input class="pi" id="ppstrokehex" value="'+T.stroke+'"/>';
      h+='<button type="button" class="tbtn pp-stroke-vis" title="'+(strokeVis?'Hide stroke':'Show stroke')+'" style="flex-shrink:0;opacity:'+(strokeVis?'1':'0.4')+'">\u{1F441}</button>';
      h+='<button type="button" class="tbtn pp-stroke-remove" title="Remove stroke" style="flex-shrink:0">\u2212</button></div>';
      h+='<div class="pr" style="margin-top:6px"><span class="pl">W</span><input class="pi" id="ppsw" type="number" value="'+T.strokeWidth+'" min="0"/></div>';
      h+='<div class="pr" style="margin-top:6px"><span class="pl">Pos</span><div class="g2" style="flex:1"><button type="button" class="preset-btn pp-stroke-align" data-align="inside" '+(salign==='inside'?' style="border-color:var(--accent);color:var(--accent)"':'')+'>Inside</button><button type="button" class="preset-btn pp-stroke-align" data-align="center" '+(salign==='center'?' style="border-color:var(--accent);color:var(--accent)"':'')+'>Center</button><button type="button" class="preset-btn pp-stroke-align" data-align="outside" '+(salign==='outside'?' style="border-color:var(--accent);color:var(--accent)"':'')+'>Outside</button></div></div>';
    }
    h+='</div>';
  }
  if(isTxt){
    h+='<div class="ps"><div class="ps-t">Typography</div>';
    var fontOpts=[{v:'system-ui,sans-serif',l:'System UI'},{v:'Arial',l:'Arial'},{v:'Helvetica',l:'Helvetica'},{v:'Georgia',l:'Georgia'},{v:'"Times New Roman",serif',l:'Times New Roman'},{v:'Verdana',l:'Verdana'},{v:'Tahoma',l:'Tahoma'},{v:'"Trebuchet MS",sans-serif',l:'Trebuchet MS'},{v:'"Courier New",monospace',l:'Courier New'},{v:'monospace',l:'Monospace'}];
    var curFont=T.fontFamily||'system-ui,sans-serif';
    var curFontLab=(fontOpts.find(function(o){return o.v===curFont})||{l:curFont}).l;
    h+='<div class="pr" style="margin-top:6px"><span class="pl">Font</span><div class="pp-drop-wrap" style="position:relative;flex:1;min-width:0;overflow:visible"><button type="button" class="pi pp-font-trigger" id="ppfont-trigger" style="width:100%;text-align:left;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px"><span class="pp-drop-label">'+curFontLab+'</span><span class="pp-drop-chevron" style="opacity:.7;font-size:10px;margin-left:auto">&#9662;</span></button><div class="pp-font-dropdown" id="ppfont-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:2px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.4);max-height:200px;overflow-y:auto">';
    fontOpts.forEach(function(o){var fontStyle=o.v.replace(/"/g,'\'');h+='<div class="pp-font-opt" data-font="'+o.v.replace(/"/g,'&quot;')+'" style="padding:6px 10px;cursor:pointer;font-size:12px;font-family:'+fontStyle+'" role="option">'+o.l+'</div>';});
    h+='</div></div></div>';
    var wtOpts=[{v:'300',l:'Light'},{v:'400',l:'Regular'},{v:'500',l:'Medium'},{v:'600',l:'Bold'}];
    var curWt=T.fw||'400';
    var curWtLab=(wtOpts.find(function(o){return o.v===curWt})||wtOpts[1]).l;
    h+='<div class="pr" style="margin-top:6px"><span class="pl">Wt</span><div class="pp-drop-wrap" style="position:relative;flex:1;min-width:0;overflow:visible"><button type="button" class="pi pp-wt-trigger" id="ppfw-trigger" style="width:100%;text-align:left;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px"><span class="pp-drop-label">'+curWtLab+'</span><span class="pp-drop-chevron" style="opacity:.7;font-size:10px;margin-left:auto">&#9662;</span></button><div class="pp-wt-dropdown" id="ppfw-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:2px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.4)">';
    wtOpts.forEach(function(o){h+='<div class="pp-wt-opt" data-weight="'+o.v+'" style="padding:6px 10px;cursor:pointer;font-weight:'+o.v+';font-size:13px" role="option">'+o.l+'</div>';});
    h+='</div></div></div>';
    var fsVal=T.fs||18;
    var fsPresets=[10,12,14,16,18,20,24,28,32,36,48,64,72];
    h+='<div class="pr" style="margin-top:6px"><span class="pl">Sz</span><div style="display:flex;gap:4px;align-items:center;flex:1;min-width:0"><input class="pi" id="ppfs" type="number" value="'+fsVal+'" min="6" max="999" step="1" style="width:52px;flex-shrink:0" title="Font size (px)"/><div class="pp-drop-wrap" style="position:relative;flex:1;min-width:0;overflow:visible"><button type="button" class="pi pp-fs-trigger" id="ppfs-trigger" style="width:100%;text-align:left;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px"><span class="pp-drop-label">'+fsVal+' px</span><span class="pp-drop-chevron" style="opacity:.7;font-size:10px;margin-left:auto">&#9662;</span></button><div class="pp-fs-dropdown" id="ppfs-dropdown" style="display:none;position:absolute;left:0;right:0;top:100%;margin-top:2px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.4);max-height:200px;overflow-y:auto">';
    fsPresets.forEach(function(px){h+='<div class="pp-fs-opt" data-px="'+px+'" style="padding:6px 10px;cursor:pointer;font-size:12px" role="option">'+px+' px</div>';});
    h+='</div></div></div></div>';
    h+='<div class="pr" style="margin-top:6px"><span class="pl">Align</span><div class="g2" style="flex:1;display:flex;gap:4px;align-items:center"><button type="button" class="preset-btn pp-text-align" data-align="left" title="Align left" '+( (T.textAlign||'left')==='left'?' style="border-color:var(--accent);color:var(--accent)"':'')+'><svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" stroke="none"><rect x="1" y="2.5" width="12" height="2" rx=".6"/><rect x="1" y="6" width="7" height="2" rx=".6"/><rect x="1" y="9.5" width="9" height="2" rx=".6"/></svg></button><button type="button" class="preset-btn pp-text-align" data-align="center" title="Align center" '+((T.textAlign||'left')==='center'?' style="border-color:var(--accent);color:var(--accent)"':'')+'><svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" stroke="none"><rect x="2" y="2.5" width="12" height="2" rx=".6"/><rect x="4.5" y="6" width="7" height="2" rx=".6"/><rect x="3.5" y="9.5" width="9" height="2" rx=".6"/></svg></button><button type="button" class="preset-btn pp-text-align" data-align="right" title="Align right" '+((T.textAlign||'left')==='right'?' style="border-color:var(--accent);color:var(--accent)"':'')+'><svg width="16" height="14" viewBox="0 0 16 14" fill="currentColor" stroke="none"><rect x="3" y="2.5" width="12" height="2" rx=".6"/><rect x="8" y="6" width="7" height="2" rx=".6"/><rect x="6" y="9.5" width="9" height="2" rx=".6"/></svg></button></div></div>';
    h+='<div class="pr" style="margin-top:6px"><span class="pl">LineH</span><div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0"><input class="pi" id="pplineh" type="number" value="'+(T.lineHeight!=null&&T.lineHeight!==''?+T.lineHeight:1.2)+'" min="0.5" step="0.1" style="flex:1;min-width:0" title="Line height multiplier"/><span class="pp-drag-handle pp-drag-vertical" id="pplineh-drag" title="Drag to adjust">⇕</span></div></div>';
    h+='<div class="pr" style="margin-top:6px"><span class="pl">Spacing</span><div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0"><input class="pi" id="ppspacing" type="number" value="'+(T.letterSpacing!=null&&T.letterSpacing!==''?T.letterSpacing:0)+'" step="0.5" style="flex:1;min-width:0" title="Letter spacing (px)"/><span class="pp-drag-handle" id="ppspacing-drag" title="Drag to adjust">⇔</span></div></div>';
    h+='<div class="pr" style="margin-top:6px"><span class="pl">Italic</span><input type="checkbox" class="pi" id="ppitalic" '+( (T.fontStyle||'normal')==='italic'?'checked':'')+'/></div></div>';
  }
  h+='<div class="ps"><div class="ps-t">Name</div><div class="pr"><input class="pi" id="ppname" value="'+T.name+'"/></div></div>';
  // Component / Instance controls
  if(T.isComponent){
    h+='<div class="ps"><div class="ps-t" style="color:#f7c948">✦ Component Master</div>';
    h+='<button class="make-comp-btn" id="sync-comp-btn">↻ Sync All Instances</button>';
    h+='</div>';
  } else if(T.isInstance){
    h+='<div class="ps"><div class="ps-t" style="color:#c4a0f7">⬡ Component Instance</div>';
    h+='<button class="detach-btn" id="detach-inst-btn" style="width:100%;margin-bottom:4px">Detach Instance</button>';
    h+='</div>';
  } else {
    h+='<div class="ps"><button class="make-comp-btn" id="make-comp-btn">✦ Make Component</button></div>';
  }
  if(isRect||isEllipse){
    h+='<div class="ps"><button class="detach-btn" id="shape-to-path-btn" style="width:100%;margin-bottom:4px;background:rgba(123,97,255,.1);border-color:var(--accent);color:var(--accent)">◇ Convert to Path</button></div>';
  }
  h+='<div class="ps"><button class="del-btn" id="ppdel">Delete '+(isF?'frame':'element')+'</button></div>';
  dom.propsDiv.innerHTML=h;
  bindAlignBtns();
  function bind(id,fn){var n=document.getElementById(id);if(n)n.addEventListener('input',fn);}
  function bc(id,fn){var n=document.getElementById(id);if(n)n.addEventListener('click',fn);}
  function rr(){isF?renderFrame(T):renderEl(T);drawSel();}
  bind('ppx',function(e){var v=+e.target.value;if(isF)T.x=v;else if(T.frameId){var pf=S.frames.find(function(f){return f.id===T.frameId});if(pf)T.x=v-pf.x;}else T.x=v;rr();snapshot();});
  bind('ppy',function(e){var v=+e.target.value;if(isF)T.y=v;else if(T.frameId){var pf=S.frames.find(function(f){return f.id===T.frameId});if(pf)T.y=v-pf.y;}else T.y=v;rr();snapshot();});
  bind('ppw',function(e){T.w=Math.max(1,+e.target.value);rr();var pf=T.frameId?S.frames.find(function(f){return f.id===T.frameId}):null;if(pf&&getAL(pf)){applyAutoLayout(pf);renderFrame(pf);}snapshot();});
  bind('pph',function(e){T.h=Math.max(1,+e.target.value);rr();var pf=T.frameId?S.frames.find(function(f){return f.id===T.frameId}):null;if(pf&&getAL(pf)){applyAutoLayout(pf);renderFrame(pf);}snapshot();});
  bind('pprx',function(e){T.rx=Math.max(0,+e.target.value);rr();snapshot();});
  function setOp(v){v=clamp(v,0,100);T.opacity=v/100;var s=document.getElementById('pp-op-s'),n=document.getElementById('pp-op-n');if(s)s.value=v;if(n)n.value=v;rr();}
  bind('pp-op-s',function(e){setOp(+e.target.value);snapshot();});
  bind('pp-op-n',function(e){setOp(+e.target.value);snapshot();});
  function setRot(v){v=((+v%360)+360)%360;T.rotation=v;var s=document.getElementById('pp-rot-s'),n=document.getElementById('pp-rot-n');if(s)s.value=v;if(n)n.value=Math.round(v);rr();drawSel();}
  bind('pp-rot-s',function(e){setRot(+e.target.value);snapshot();});
  bind('pp-rot-n',function(e){setRot(+e.target.value);snapshot();});
  bind('ppfill',function(e){T.fill=e.target.value;if(tedId&&T.type==='text'&&tedId===T.id)dom.ted.style.color=T.fill==='none'?'#000':T.fill;rr();var h=document.getElementById('ppfillhex');if(h)h.value=e.target.value;e.target.parentElement.style.background=e.target.value;snapshot();});
  bind('ppfillhex',function(e){T.fill=e.target.value;if(tedId&&T.type==='text'&&tedId===T.id)dom.ted.style.color=T.fill==='none'?'#000':T.fill;rr();snapshot();});
  var addFillBtn=document.getElementById('pp-fill-add');
  if(addFillBtn)addFillBtn.addEventListener('click',function(){T.fill=S.defFill||'#7b61ff';T.fillVisible=true;rr();refreshProps();snapshot();});
  document.querySelectorAll('.pp-fill-vis').forEach(function(btn){
    btn.addEventListener('click',function(){T.fillVisible=!T.fillVisible;rr();refreshProps();snapshot();});
  });
  document.querySelectorAll('.pp-fill-remove').forEach(function(btn){
    btn.addEventListener('click',function(){T.fill='none';rr();refreshProps();snapshot();});
  });
  bind('ppstroke',function(e){T.stroke=e.target.value;renderEl(T);var h=document.getElementById('ppstrokehex');if(h)h.value=e.target.value;e.target.parentElement.style.background=e.target.value;snapshot();});
  bind('ppstrokehex',function(e){T.stroke=e.target.value;renderEl(T);snapshot();});
  bind('ppsw',function(e){T.strokeWidth=Math.max(0,+e.target.value);renderEl(T);snapshot();});
  var addStrokeBtn=document.getElementById('pp-stroke-add');
  if(addStrokeBtn)addStrokeBtn.addEventListener('click',function(){T.stroke=S.defFill||'#000000';T.strokeWidth=T.type==='line'?2:Math.max(1,(T.strokeWidth||0))||2;T.strokeVisible=true;T.strokeAlign=T.strokeAlign||'center';renderEl(T);refreshProps();snapshot();});
  document.querySelectorAll('.pp-stroke-vis').forEach(function(btn){
    btn.addEventListener('click',function(){T.strokeVisible=!T.strokeVisible;renderEl(T);refreshProps();snapshot();});
  });
  document.querySelectorAll('.pp-stroke-remove').forEach(function(btn){
    btn.addEventListener('click',function(){T.stroke='none';T.strokeWidth=0;renderEl(T);refreshProps();snapshot();});
  });
  document.querySelectorAll('.pp-stroke-align').forEach(function(btn){
    btn.addEventListener('click',function(){
      T.strokeAlign=btn.dataset.align;
      document.querySelectorAll('.pp-stroke-align').forEach(function(b){b.style.borderColor='';b.style.color='';});
      btn.style.borderColor='var(--accent)';btn.style.color='var(--accent)';
      renderEl(T);snapshot();
    });
  });
  bind('ppfs',function(e){var v=Math.max(6,+e.target.value);T.fs=v;var lbl=document.querySelector('#ppfs-trigger .pp-drop-label');if(lbl)lbl.textContent=v+' px';if(T.type==='text')updateTextBounds(T);renderEl(T);drawSel();snapshot();});
  (function(){
    var typoDropdownClose=null;
    var currentWtClose=null;
    var fontTrigger=document.getElementById('ppfont-trigger');
    var fontDrop=document.getElementById('ppfont-dropdown');
    var wtTrigger=document.getElementById('ppfw-trigger');
    var wtDrop=document.getElementById('ppfw-dropdown');
    var fsTrigger=document.getElementById('ppfs-trigger');
    var fsDrop=document.getElementById('ppfs-dropdown');
    if(!fontTrigger||!fontDrop||!wtTrigger||!wtDrop)return;
    var weightOpts=[{v:'300',l:'Light'},{v:'400',l:'Regular'},{v:'500',l:'Medium'},{v:'600',l:'Bold'}];
    function openFont(){
      if(typoDropdownClose){typoDropdownClose();typoDropdownClose=null;}
      var r=fontTrigger.getBoundingClientRect();fontDrop.style.position='fixed';fontDrop.style.top=(r.bottom+2)+'px';fontDrop.style.left=r.left+'px';fontDrop.style.width=r.width+'px';fontDrop.style.minWidth='120px';fontDrop.style.display='block';
      function close(){document.removeEventListener('click',close);fontDrop.style.display='none';typoDropdownClose=null;}
      typoDropdownClose=close;setTimeout(function(){document.addEventListener('click',close);},0);
    }
    function openWeight(){
      if(typoDropdownClose){typoDropdownClose();typoDropdownClose=null;}
      currentWtClose=null;
      var committedFw=T.fw||'400';
      var r=wtTrigger.getBoundingClientRect();wtDrop.style.position='fixed';wtDrop.style.top=(r.bottom+2)+'px';wtDrop.style.left=r.left+'px';wtDrop.style.width=r.width+'px';wtDrop.style.minWidth='80px';wtDrop.style.display='block';
      var closeWrapper;
      function doClose(skipRestore){document.removeEventListener('click',closeWrapper);wtDrop.style.display='none';if(!skipRestore&&(T.fw||'400')!==committedFw){T.fw=committedFw;if(T.type==='text')updateTextBounds(T);renderEl(T);}currentWtClose=null;typoDropdownClose=null;}
      closeWrapper=function(){doClose(false);};
      currentWtClose=doClose;typoDropdownClose=function(){doClose(false);};
      setTimeout(function(){document.addEventListener('click',closeWrapper);},0);
    }
    function openFs(){
      if(typoDropdownClose){typoDropdownClose();typoDropdownClose=null;}
      if(!fsTrigger||!fsDrop)return;
      var r=fsTrigger.getBoundingClientRect();fsDrop.style.position='fixed';fsDrop.style.top=(r.bottom+2)+'px';fsDrop.style.left=r.left+'px';fsDrop.style.width=Math.max(r.width,80)+'px';fsDrop.style.display='block';
      function close(){document.removeEventListener('click',close);fsDrop.style.display='none';typoDropdownClose=null;}
      typoDropdownClose=close;setTimeout(function(){document.addEventListener('click',close);},0);
    }
    fontTrigger.addEventListener('click',function(e){e.stopPropagation();if(fontDrop.style.display==='block'){if(typoDropdownClose)typoDropdownClose();return;}openFont();});
    fontDrop.querySelectorAll('.pp-font-opt').forEach(function(opt){
      opt.addEventListener('click',function(e){e.stopPropagation();T.fontFamily=opt.getAttribute('data-font')||'system-ui,sans-serif';if(T.type==='text')updateTextBounds(T);renderEl(T);var lbl=fontTrigger.querySelector('.pp-drop-label');if(lbl)lbl.textContent=opt.textContent.trim();if(typoDropdownClose)typoDropdownClose();snapshot();});
    });
    wtTrigger.addEventListener('click',function(e){e.stopPropagation();if(wtDrop.style.display==='block'){if(typoDropdownClose)typoDropdownClose();return;}openWeight();});
    weightOpts.forEach(function(o){
      var opt=wtDrop.querySelector('.pp-wt-opt[data-weight="'+o.v+'"]');
      if(!opt)return;
      opt.addEventListener('mouseenter',function(){T.fw=o.v;if(T.type==='text')updateTextBounds(T);renderEl(T);drawSel();});
      opt.addEventListener('click',function(e){e.stopPropagation();T.fw=o.v;if(T.type==='text')updateTextBounds(T);renderEl(T);var lbl=wtTrigger.querySelector('.pp-drop-label');if(lbl)lbl.textContent=o.l;if(currentWtClose){currentWtClose(true);}snapshot();});
    });
    if(fsTrigger&&fsDrop){
      fsTrigger.addEventListener('click',function(e){e.stopPropagation();if(fsDrop.style.display==='block'){if(typoDropdownClose)typoDropdownClose();return;}openFs();});
      fsDrop.querySelectorAll('.pp-fs-opt').forEach(function(opt){
        opt.addEventListener('click',function(e){e.stopPropagation();var px=+(opt.getAttribute('data-px')||18);T.fs=px;var inp=document.getElementById('ppfs');if(inp)inp.value=px;var lbl=fsTrigger.querySelector('.pp-drop-label');if(lbl)lbl.textContent=px+' px';if(typoDropdownClose)typoDropdownClose();if(T.type==='text')updateTextBounds(T);renderEl(T);drawSel();snapshot();});
      });
    }
  })();
  document.querySelectorAll('.pp-text-align').forEach(function(btn){
    btn.addEventListener('click',function(){
      T.textAlign=btn.dataset.align;
      document.querySelectorAll('.pp-text-align').forEach(function(b){b.style.borderColor='';b.style.color='';});
      btn.style.borderColor='var(--accent)';btn.style.color='var(--accent)';
      renderEl(T);snapshot();
    });
  });
  bind('pplineh',function(e){var v=parseFloat(e.target.value);T.lineHeight=(isNaN(v)||v<=0)?1.2:v;if(T.type==='text')updateTextBounds(T);renderEl(T);snapshot();});
  bind('ppspacing',function(e){var v=e.target.value;T.letterSpacing=(v===''||v===null)?0:parseFloat(v);if(T.type==='text')updateTextBounds(T);renderEl(T);snapshot();});
  (function(){
    var linehDrag=document.getElementById('pplineh-drag');
    var spacingDrag=document.getElementById('ppspacing-drag');
    if(linehDrag){
      linehDrag.addEventListener('mousedown',function(e){
        e.preventDefault();
        var startY=e.clientY;
        var startVal=typeof T.lineHeight==='number'?T.lineHeight:(T.lineHeight!=null&&T.lineHeight!==''?parseFloat(T.lineHeight):1.2);
        var inp=document.getElementById('pplineh');
        function onMove(ev){
          var dy=startY-ev.clientY;
          var v=Math.max(0.5,Math.min(5,startVal+dy*0.003));
          v=Math.round(v*100)/100;
          T.lineHeight=v;
          if(inp)inp.value=v;
          if(T.type==='text')updateTextBounds(T);
          renderEl(T);
          drawSel();
        }
        function onUp(){
          document.removeEventListener('mousemove',onMove);
          document.removeEventListener('mouseup',onUp);
          snapshot();
        }
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp);
      });
    }
    if(spacingDrag){
      spacingDrag.addEventListener('mousedown',function(e){
        e.preventDefault();
        var startX=e.clientX;
        var startVal=T.letterSpacing!=null&&T.letterSpacing!==''?parseFloat(T.letterSpacing):0;
        var inp=document.getElementById('ppspacing');
        function onMove(ev){
          var dx=ev.clientX-startX;
          var v=Math.max(-20,Math.min(50,startVal+dx*0.12));
          v=Math.round(v*10)/10;
          T.letterSpacing=v;
          if(inp)inp.value=v;
          if(T.type==='text')updateTextBounds(T);
          renderEl(T);
          drawSel();
        }
        function onUp(){
          document.removeEventListener('mousemove',onMove);
          document.removeEventListener('mouseup',onUp);
          snapshot();
        }
        document.addEventListener('mousemove',onMove);
        document.addEventListener('mouseup',onUp);
      });
    }
  })();
  bind('ppitalic',function(e){T.fontStyle=e.target.checked?'italic':'normal';if(T.type==='text')updateTextBounds(T);renderEl(T);snapshot();});
  bind('ppname',function(e){T.name=e.target.value;if(isF)renderFrame(T);refreshLayers();});
  document.querySelectorAll('.fill-mode-btn').forEach(function(btn){
    btn.addEventListener('click',function(){
      T.fillMode=btn.dataset.mode;
      if(T.fillMode!=='solid'&&!T.gradient)T.gradient=defGrad(T.fillMode,T.fill,'#3ecf8e');
      if(T.fillMode!=='solid'&&T.gradient)T.gradient.type=T.fillMode;
      activeGradStop=0;renderEl(T);refreshProps();snapshot();
    });
  });
  bind('grad-angle',function(e){if(T.gradient){T.gradient.angle=+e.target.value;renderEl(T);var b=document.getElementById('grad-bar');if(b)b.style.background=gradCSS(T.gradient);}});
  var gradBar=document.getElementById('grad-bar');
  if(gradBar){
    gradBar.querySelectorAll('.grad-stop').forEach(function(se){
      se.addEventListener('mousedown',function(e){
        e.stopPropagation();var si=+se.dataset.si;activeGradStop=si;
        var br=gradBar.getBoundingClientRect();
        function onM(ev){var pos=clamp((ev.clientX-br.left)/br.width,0,1);T.gradient.stops[si].pos=pos;se.style.left=(pos*100)+'%';gradBar.style.background=gradCSS(T.gradient);renderEl(T);var pi=document.getElementById('stop-pos');if(pi)pi.value=Math.round(pos*100);}
        function onU(){document.removeEventListener('mousemove',onM);document.removeEventListener('mouseup',onU);refreshProps();snapshot();}
        document.addEventListener('mousemove',onM);document.addEventListener('mouseup',onU);
      });
      se.addEventListener('click',function(e){e.stopPropagation();activeGradStop=+se.dataset.si;refreshProps();});
    });
  }
  bind('stop-color',function(e){if(T.gradient&&T.gradient.stops[activeGradStop]){T.gradient.stops[activeGradStop].color=e.target.value;renderEl(T);var b=document.getElementById('grad-bar');if(b)b.style.background=gradCSS(T.gradient);var sd=document.querySelector('.grad-stop.active-stop');if(sd)sd.style.background=e.target.value;}});
  bind('stop-pos',function(e){if(T.gradient&&T.gradient.stops[activeGradStop]){T.gradient.stops[activeGradStop].pos=clamp(+e.target.value,0,100)/100;renderEl(T);refreshProps();}});
  function setStopOp(v){v=clamp(v,0,100);if(!T.gradient||!T.gradient.stops[activeGradStop])return;T.gradient.stops[activeGradStop].opacity=v/100;renderEl(T);var b=document.getElementById('grad-bar');if(b)b.style.background=gradCSS(T.gradient);var sn=document.getElementById('stop-op-s'),nn=document.getElementById('stop-op-n');if(sn)sn.value=v;if(nn)nn.value=v;}
  bind('stop-op-s',function(e){setStopOp(+e.target.value);snapshot();});
  bind('stop-op-n',function(e){setStopOp(+e.target.value);snapshot();});
  bc('add-stop',function(){if(T.gradient){T.gradient.stops.push({pos:.5,color:'#ffffff',opacity:1});T.gradient.stops.sort(function(a,b){return a.pos-b.pos});activeGradStop=Math.floor(T.gradient.stops.length/2);renderEl(T);refreshProps();}});
  document.querySelectorAll('.preset-btn').forEach(function(btn){btn.addEventListener('click',function(){if(!fr)return;fr.w=+btn.dataset.pw;fr.h=+btn.dataset.ph;if(getAL(fr)){applyAutoLayout(fr);}renderFrame(fr);drawSel();refreshProps();snapshot();});});
  // ── AUTO LAYOUT BINDINGS ──
  var alToggle=document.getElementById('al-toggle');
  if(alToggle)alToggle.addEventListener('change',function(){toggleAutoLayout(fr);});
  function alChange(){if(fr&&getAL(fr)){runALAndRender(fr);snapshot();}}
  document.querySelectorAll('[data-aldir]').forEach(function(b){b.addEventListener('click',function(){if(!fr||!fr.autoLayout)return;fr.autoLayout.dir=b.dataset.aldir;alChange();refreshProps();});});
  document.querySelectorAll('[data-alcross]').forEach(function(b){b.addEventListener('click',function(){if(!fr||!fr.autoLayout)return;fr.autoLayout.alignCross=b.dataset.alcross;alChange();refreshProps();});});
  document.querySelectorAll('[data-alwrap]').forEach(function(b){b.addEventListener('click',function(){if(!fr||!fr.autoLayout)return;fr.autoLayout.wrap=b.dataset.alwrap==='1';alChange();refreshProps();});});
  document.querySelectorAll('[data-alhugw]').forEach(function(b){b.addEventListener('click',function(){if(!fr||!fr.autoLayout)return;fr.autoLayout.hugW=b.dataset.alhugw==='1';alChange();refreshProps();});});
  document.querySelectorAll('[data-alhugh]').forEach(function(b){b.addEventListener('click',function(){if(!fr||!fr.autoLayout)return;fr.autoLayout.hugH=b.dataset.alhugh==='1';alChange();refreshProps();});});
  function alNum(id,key){var n=document.getElementById(id);if(n)n.addEventListener('input',function(){if(!fr||!fr.autoLayout)return;fr.autoLayout[key]=Math.max(0,+n.value);alChange();});}
  alNum('al-gap','gap');alNum('al-pt','padT');alNum('al-pr','padR');alNum('al-pb','padB');alNum('al-pl','padL');
  // Child sizing
  document.querySelectorAll('[data-csw]').forEach(function(b){b.addEventListener('click',function(){T.alFillW=b.dataset.csw==='fill';var pf=S.frames.find(function(f){return f.id===T.frameId});if(pf&&getAL(pf)){runALAndRender(pf);}snapshot();refreshProps();});});
  document.querySelectorAll('[data-csh]').forEach(function(b){b.addEventListener('click',function(){T.alFillH=b.dataset.csh==='fill';var pf=S.frames.find(function(f){return f.id===T.frameId});if(pf&&getAL(pf)){runALAndRender(pf);}snapshot();refreshProps();});});
  bc('zo-top',function(){zOrder('top');});bc('zo-fwd',function(){zOrder('fwd');});bc('zo-bwd',function(){zOrder('bwd');});bc('zo-bot',function(){zOrder('bot');});
  var imgRI=document.getElementById('img-ri'),imgRD=document.getElementById('img-rd');
  if(imgRI){
    imgRD.addEventListener('click',function(){imgRI.click();});
    imgRI.addEventListener('change',function(e){var file=e.target.files[0];if(!file)return;var r2=new FileReader();r2.onload=function(ev){T.imgData=ev.target.result;renderEl(T);snapshot();toast('Image replaced ✓');};r2.readAsDataURL(file);e.target.value='';});
    imgRD.addEventListener('dragover',function(e){e.preventDefault();});
    imgRD.addEventListener('drop',function(e){e.preventDefault();var file=e.dataTransfer.files[0];if(!file||!file.type.startsWith('image/'))return;var r2=new FileReader();r2.onload=function(ev){T.imgData=ev.target.result;renderEl(T);snapshot();toast('Image replaced ✓');};r2.readAsDataURL(file);});
  }
  var del=document.getElementById('ppdel');if(del)del.addEventListener('click',delSel);
  var r2p=document.getElementById('shape-to-path-btn');if(r2p)r2p.addEventListener('click',function(){if(T.type==='rect')convertRectToPath(T);else if(T.type==='ellipse')convertEllipseToPath(T);});
  bc('make-comp-btn',makeComponent);
  var gb=document.getElementById('group-btn');if(gb)gb.addEventListener('click',groupSel);
  var ub2=document.getElementById('ungroup-btn');if(ub2)ub2.addEventListener('click',ungroupSel);
  var mb2=document.getElementById('mask-btn');if(mb2)mb2.addEventListener('click',makeMask);
  var rmb=document.getElementById('release-mask-btn');if(rmb)rmb.addEventListener('click',releaseMask);
  bc('sync-comp-btn',function(){syncInstances(T.id);});
  bc('detach-inst-btn',detachInstance);
}

// ── SAVE / LOAD ──
function saveProject(){
  var data={version:8,nid:S.nid,frames:S.frames,els:S.els,groups:S.groups,components:S.components,rootOrder:S.rootOrder&&S.rootOrder.length?S.rootOrder:getRootListOrder(),view:{zoom:S.zoom,px:S.px,py:S.py}};
  var blob=new Blob([JSON.stringify(data)],{type:'application/json'});
  var fname=(S.projName||'project').replace(/[/\\:*?"<>|]/g,'').replace(/\s+/g,' ').trim()||'project';
  var url=URL.createObjectURL(blob);var a=document.createElement('a');a.download=fname+'.designos';a.href=url;a.click();URL.revokeObjectURL(url);toast('Saved ✓');
  setSaveStatus('saved');
}
function validateAndRepairProject(data){
  var frames=data.frames||[],els=data.els||[],groups=data.groups||[];
  var frameIds={},elIds={},groupIds={};
  frames.forEach(function(f){frameIds[f.id]=true;});
  els.forEach(function(e){elIds[e.id]=true;});
  groups.forEach(function(g){groupIds[g.id]=true;});
  var allIds=function(id){return frameIds[id]||groupIds[id]||elIds[id];};
  var repaired=false;
  frames.forEach(function(fr){
    if(fr.frameId!=null&&!frameIds[fr.frameId]){fr.frameId=null;repaired=true;}
    if(fr.children){
      fr.children=fr.children.filter(function(cid){var ok=allIds(cid);if(!ok)repaired=true;return ok;});
    }
  });
  groups.forEach(function(g){
    if(g.frameId!=null&&!frameIds[g.frameId]){g.frameId=null;repaired=true;}
    if(g.groupId!=null&&!groupIds[g.groupId]){g.groupId=null;repaired=true;}
    if(g.children){
      g.children=g.children.filter(function(cid){var ok=allIds(cid);if(!ok)repaired=true;return ok;});
    }
  });
  els.forEach(function(el){
    if(el.frameId!=null&&!frameIds[el.frameId]){el.frameId=null;repaired=true;}
    if(el.groupId!=null&&!groupIds[el.groupId]){el.groupId=null;repaired=true;}
  });
  return repaired;
}
function loadProject(json,fileName,opts){
  opts=opts||{};
  try{
    var data=JSON.parse(json);
    if(!data||typeof data!=='object'){toast('Invalid project file');return;}
    var repaired=validateAndRepairProject(data);
    dom.framesG.innerHTML='';dom.elsLoose.innerHTML='';dom.selOv.innerHTML='';dom.defsEl.innerHTML='';dom.sgG.innerHTML='';
    S.frames=[];S.els=[];S.groups=[];S.selId=null;S.selIds=[];S.nid=typeof data.nid==='number'?data.nid:1;S.components=Array.isArray(data.components)?data.components:[];activeGradStop=0;
    if(S.rootOrder!==undefined)delete S.rootOrder;
    if(data.projId){S.projId=data.projId;setProjName(data.projName||'Untitled');}
    else{S.projId='p'+Date.now();setProjName((fileName&&fileName.replace(/\.(designos|json)$/i,''))||data.projName||'Imported project');}
    S.groups=Array.isArray(data.groups)?(data.groups||[]).slice():[];
    (Array.isArray(data.frames)?data.frames:[]).forEach(function(fr){S.frames.push(fr);renderFrame(fr);});
    (Array.isArray(data.els)?data.els:[]).forEach(function(el){S.els.push(el);});
    if(Array.isArray(data.rootOrder)&&data.rootOrder.length>0)applyRootOrder(data.rootOrder);
    S.frames.filter(function(fr){return !fr.frameId;}).forEach(function(fr){if(getAL(fr)){applyAutoLayout(fr);}renderFrame(fr);});
    renderLooseWithMasks();
    if(data.view&&typeof data.view.zoom==='number'&&typeof data.view.px==='number'&&typeof data.view.py==='number'){
      S.zoom=Math.max(0.05,Math.min(20,data.view.zoom));
      S.px=data.view.px;
      S.py=data.view.py;
    }
    applyTr();drawSnapGrid();
    refreshLayers();refreshProps();refreshCompPanel();snapshot();
    if(!data.projId){
      var payload=JSON.stringify({version:8,projId:S.projId,projName:S.projName,nid:S.nid,frames:S.frames,els:S.els,groups:S.groups,components:S.components,rootOrder:S.rootOrder&&S.rootOrder.length?S.rootOrder:getRootListOrder(),view:{zoom:S.zoom,px:S.px,py:S.py}});
      var saved=false;
      for(var attempt=0;attempt<4;attempt++){
        try{localStorage.setItem('dos_proj_'+S.projId,payload);saved=true;break;}catch(e){
          if(attempt<3){var list=[];try{list=JSON.parse(localStorage.getItem('dos_projects')||'[]');}catch(e2){}
            if(list.length>1){var old=list.pop();localStorage.removeItem('dos_proj_'+old.id);try{localStorage.setItem('dos_projects',JSON.stringify(list));}catch(e3){}}else break;}
          else{toast('Storage full — use Save to download file');break;}
        }
      }
      if(saved){addCurrentToRecentList();}
      doAutoSave();
    }
    if(!S.openTabs)S.openTabs=[];
    var inTabs=S.openTabs.some(function(t){return t.id===S.projId;});
    if(!inTabs)S.openTabs.unshift({id:S.projId,name:S.projName});
    else S.openTabs.forEach(function(t){if(t.id===S.projId)t.name=S.projName;});
    S.activeTabId=S.projId;
    refreshProjectTabs();
    if(!opts.silent)toast(repaired?'Project loaded (invalid references repaired)':'Project loaded ✓');
    setSaveStatus('saved');
  }catch(err){console.error(err);if(!opts.silent)toast('Failed to load');}
}
var saveBtn=document.getElementById('save-btn');if(saveBtn)saveBtn.addEventListener('click',saveProject);
var loadBtn=document.getElementById('load-btn');if(loadBtn)loadBtn.addEventListener('click',function(){var projIn=document.getElementById('proj-input');if(projIn)projIn.click();});
var projInput=document.getElementById('proj-input');if(projInput)projInput.addEventListener('change',function(e){var file=e.target.files[0];if(!file)return;var reader=new FileReader();reader.onload=function(ev){loadProject(ev.target.result,file.name);};reader.readAsText(file);e.target.value='';});

// ── Table create modal ──
(function(){
  var modal=document.getElementById('table-create-modal');
  if(!modal)return;
  var dialog=modal.querySelector('.table-create-dialog');
  var ov=document.getElementById('table-create-ov');
  var rowsInp=document.getElementById('table-rows-input');
  var colsInp=document.getElementById('table-cols-input');
  var okBtn=document.getElementById('table-create-ok');
  var cancelBtn=document.getElementById('table-create-cancel');
  function hide(){ modal.style.display='none'; S.tableCreatePending=null; }
  function confirm(){
    if(!S.tableCreatePending)return hide();
    var rows=Math.max(1,Math.min(50,parseInt(rowsInp.value,10)||3));
    var cols=Math.max(1,Math.min(20,parseInt(colsInp.value,10)||3));
    var sp=S.tableCreatePending.sp, fr=S.tableCreatePending.fr;
    var frAbs=fr?absPos(fr):null;
    var tx=fr?sp.x-frAbs.x:sp.x, ty=fr?sp.y-frAbs.y:sp.y;
    var api={uid:uid,nid:S.nid};
    var created=tableModule.createTableData(rows,cols,tx,ty,{frameId:fr?fr.id:null,groupId:null,name:'Table '+(S.nid)},api);
    creadom.ted.cellEls.forEach(function(c){S.els.push(c);});
    S.els.push(creadom.ted.tableEl);
    if(fr)fr.children.push(creadom.ted.tableEl.id);
    S.nid++;
    renderEl(creadom.ted.tableEl);
    selectEl(creadom.ted.tableEl.id);
    refreshLayers();
    snapshot();
    toast('Table added');
    hide();
  }
  modal.addEventListener('click',function(e){ if(!dialog.contains(e.target)) hide(); });
  if(ov)ov.addEventListener('click',hide);
  if(cancelBtn)cancelBtn.addEventListener('click',hide);
  if(okBtn)okBtn.addEventListener('click',confirm);
  if(rowsInp&&colsInp)rowsInp.addEventListener('keydown',function(e){if(e.key==='Enter')colsInp.focus();});
  colsInp&&colsInp.addEventListener('keydown',function(e){if(e.key==='Enter')confirm();if(e.key==='Escape')hide();});
  document.addEventListener('keydown',function tableModalEsc(e){if(e.key!=='Escape')return;if(!modal||modal.style.display!=='flex')return;hide();});
})();

// ── AUTO-SAVE & PROJECTS ──
var _autoSaveTimer=null;
function setProjName(name){
  S.projName=name||'Untitled';
  var inp=document.getElementById('proj-name-input');
  if(inp&&document.activeElement!==inp)inp.value=S.projName;
  if(S.openTabs){var t=S.openTabs.find(function(x){return x.id===S.projId;});if(t)t.name=S.projName;refreshProjectTabs();}
}
function renameProject(name){
  setProjName((name||'').trim()||'Untitled');
  scheduleAutoSave();
}
function setSaveStatus(mode){
  var icon=document.getElementById('save-status-icon');
  var text=document.getElementById('save-status-text');
  if(!icon||!text)return;
  if(mode==='saving'){
    icon.classList.add('saving');
    text.textContent='';
  }else{
    icon.classList.remove('saving');
    text.textContent=mode==='saved'?'Saved':'';
  }
}
function scheduleAutoSave(){
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer=setTimeout(doAutoSave,2500);
  setSaveStatus('saving');
}
function doAutoSave(){
  clearTimeout(_autoSaveTimer);_autoSaveTimer=null;
  if(!S.projId) S.projId='p'+Date.now();
  var data={version:8,projId:S.projId,projName:S.projName,nid:S.nid,frames:S.frames,els:S.els,groups:S.groups,components:S.components,rootOrder:S.rootOrder&&S.rootOrder.length?S.rootOrder:getRootListOrder(),view:{zoom:S.zoom,px:S.px,py:S.py}};
  var json=JSON.stringify(data);
  for(var attempt=0;attempt<4;attempt++){
    try{localStorage.setItem('dos_proj_'+S.projId,json);break;}catch(e){
      if(attempt<3){var list=[];try{list=JSON.parse(localStorage.getItem('dos_projects')||'[]');}catch(e2){}
        if(list.length>1){var old=list.pop();localStorage.removeItem('dos_proj_'+old.id);try{localStorage.setItem('dos_projects',JSON.stringify(list));}catch(e3){}}else return;}
      else return;
    }
  }
  var list=[];
  try{list=JSON.parse(localStorage.getItem('dos_projects')||'[]');}catch(e){}
  list=list.filter(function(p){return p.id!==S.projId;});
  list.unshift({id:S.projId,name:S.projName,savedAt:Date.now(),thumb:null});
  if(list.length>20)list.length=20;
  try{
    localStorage.setItem('dos_projects',JSON.stringify(list));
    localStorage.setItem('dos_last',S.projId);
  }catch(e){}
  setSaveStatus('saved');
  genThumbAsync(function(dataUrl){
    if(!dataUrl)return;
    var list2=[];
    try{list2=JSON.parse(localStorage.getItem('dos_projects')||'[]');}catch(e){}
    var i=list2.findIndex(function(p){return p.id===S.projId;});
    if(i>=0){list2[i].thumb=dataUrl;try{localStorage.setItem('dos_projects',JSON.stringify(list2));}catch(e){}}
  });
}
window.addEventListener('beforeunload',function(){
  if(_autoSaveTimer){clearTimeout(_autoSaveTimer);_autoSaveTimer=null;doAutoSave();}
});
function genThumbAsync(cb){
  var svgEl=document.getElementById('svg');
  if(!svgEl||(!S.frames.length&&!S.els.length)){cb(null);return;}
  try{
    var s=new XMLSerializer().serializeToString(svgEl);
    var blob=new Blob([s],{type:'image/svg+xml'});
    var url=URL.createObjectURL(blob);
    var img=new Image();
    img.onload=function(){
      var c=document.createElement('canvas');c.width=160;c.height=100;
      var ctx=c.getContext('2d');
      ctx.fillStyle='#111112';ctx.fillRect(0,0,160,100);
      var scale=Math.min(160/img.naturalWidth,100/img.naturalHeight);
      var dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
      ctx.drawImage(img,(160-dw)/2,(100-dh)/2,dw,dh);
      URL.revokeObjectURL(url);
      cb(c.toDataURL('image/jpeg',0.75));
    };
    img.onerror=function(){URL.revokeObjectURL(url);cb(null);};
    img.src=url;
  }catch(e){cb(null);}
}
function showRecent(){
  var modal=document.getElementById('recent-modal');
  var grid=document.getElementById('recent-grid');
  var curName=document.getElementById('recent-cur-name');
  if(curName)curName.textContent=S.projName?('Current: '+S.projName):'';
  var list=[];
  try{list=JSON.parse(localStorage.getItem('dos_projects')||'[]');}catch(e){}
  grid.innerHTML='';
  if(!list.length){
    grid.innerHTML='<div class="recent-empty">No saved projects yet.<br>Your work saves automatically as you design.</div>';
  } else {
    list.forEach(function(p){
      var card=document.createElement('div');card.className='recent-card';
      card.setAttribute('data-project-id',p.id);
      var isCurrent=p.id===S.projId;
      if(isCurrent)card.style.borderColor='var(--accent)';
      var thumbHtml=p.thumb
        ?'<img src="'+p.thumb+'" alt="">'
        :'<span class="recent-thumb-empty">&#9654;</span>';
      var d=new Date(p.savedAt);
      var dateStr=d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
      card.innerHTML=
        '<div class="recent-thumb">'+thumbHtml+'</div>'+
        '<div class="recent-card-body">'+
          '<div class="recent-card-name">'+
            escHtml(p.name||'Untitled')+
            '<button type="button" class="recent-card-del" title="Delete">&#x2715;</button>'+
          '</div>'+
          '<div class="recent-card-date">'+dateStr+(isCurrent?' · open':'')+'</div>'+
        '</div>';
      grid.appendChild(card);
    });
    grid.onclick=function(e){
      var card=e.target.closest('.recent-card');
      if(!card)return;
      var id=card.getAttribute('data-project-id');
      if(!id)return;
      if(e.target.closest('.recent-card-del')){e.preventDefault();e.stopPropagation();deleteProjFromLS(id,card);return;}
      loadProjFromLS(id);
    };
  }
  modal.style.display='flex';
}
function hideRecent(){document.getElementById('recent-modal').style.display='none';}
function addCurrentToRecentList(){
  if(!S.projId)return;
  var list=[];
  try{list=JSON.parse(localStorage.getItem('dos_projects')||'[]');}catch(e){}
  list=list.filter(function(p){return p.id!==S.projId;});
  list.unshift({id:S.projId,name:S.projName,savedAt:Date.now(),thumb:null});
  if(list.length>20)list.length=20;
  try{localStorage.setItem('dos_projects',JSON.stringify(list));localStorage.setItem('dos_last',S.projId);}catch(e){}
}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function loadProjFromLS(id){
  var json=localStorage.getItem('dos_proj_'+id);
  if(!json){toast('Project not found');return;}
  loadProject(json);
  hideRecent();
}
function deleteProjFromLS(id,card){
  localStorage.removeItem('dos_proj_'+id);
  var list=[];
  try{list=JSON.parse(localStorage.getItem('dos_projects')||'[]');}catch(e){}
  list=list.filter(function(p){return p.id!==id;});
  try{localStorage.setItem('dos_projects',JSON.stringify(list));}catch(e){}
  if(id===localStorage.getItem('dos_last'))localStorage.removeItem('dos_last');
  card.style.opacity='0';card.style.transform='scale(0.9)';card.style.transition='all .2s';
  setTimeout(function(){card.remove();
    var grid=document.getElementById('recent-grid');
    if(grid&&!grid.querySelector('.recent-card'))
      grid.innerHTML='<div class="recent-empty">No saved projects yet.<br>Your work saves automatically as you design.</div>';
  },200);
}
function newProject(){
  dom.framesG.innerHTML='';dom.elsLoose.innerHTML='';dom.selOv.innerHTML='';dom.defsEl.innerHTML='';dom.sgG.innerHTML='';
  S.frames=[];S.els=[];S.selId=null;S.selIds=[];S.nid=1;S.components=[];
  S.projId='p'+Date.now();setProjName('Untitled');
  S.history=[];S.histIdx=-1;
  if(!S.openTabs)S.openTabs=[];
  S.openTabs.unshift({id:S.projId,name:S.projName});
  S.activeTabId=S.projId;
  refreshProjectTabs();
  var r=dom.canvas.getBoundingClientRect();S.px=r.width/2-300;S.py=r.height/2-200;
  applyTr();drawSnapGrid();refreshLayers();refreshProps();refreshCompPanel();refreshUndoUI();
  snapshot();setSaveStatus('saved');hideRecent();toast('New project');
}
function refreshProjectTabs(){
  var cont=document.getElementById('project-tabs');
  if(!cont)return;
  cont.innerHTML='';
  (S.openTabs||[]).forEach(function(t){
    var btn=document.createElement('button');btn.type='button';btn.className='project-tab'+(t.id===S.activeTabId?' active':'');
    btn.innerHTML='<span>'+escHtml(t.name||'Untitled')+'</span><span class="project-tab-close" data-tab-id="'+escHtml(t.id)+'">×</span>';
    btn.title=t.name||'Untitled';
    btn.addEventListener('click',function(e){if(e.target.classList.contains('project-tab-close'))return;switchToTab(t.id);});
    btn.querySelector('.project-tab-close').addEventListener('click',function(e){e.stopPropagation();closeTab(t.id);});
    cont.appendChild(btn);
  });
}
function switchToTab(id){
  if(id===S.projId)return;
  doAutoSave();
  var json=localStorage.getItem('dos_proj_'+id);
  if(!json){toast('Project not found');S.openTabs=S.openTabs.filter(function(t){return t.id!==id;});refreshProjectTabs();return;}
  loadProject(json,null,{silent:true});
  hideRecent();
}
function closeTab(id){
  var idx=S.openTabs.findIndex(function(t){return t.id===id;});
  if(idx<0)return;
  S.openTabs=S.openTabs.filter(function(t){return t.id!==id;});
  if(S.projId===id){
    if(S.openTabs.length){
      var next=S.openTabs[Math.min(idx,S.openTabs.length-1)]||S.openTabs[0];
      switchToTab(next.id);
    }else{
      dom.framesG.innerHTML='';dom.elsLoose.innerHTML='';dom.selOv.innerHTML='';dom.defsEl.innerHTML='';dom.sgG.innerHTML='';
      S.frames=[];S.els=[];S.groups=[];S.selId=null;S.selIds=[];S.projId=null;S.projName='Untitled';S.nid=1;S.components=[];S.history=[];S.histIdx=-1;
      setSaveStatus('');
      refreshLayers();refreshProps();refreshCompPanel();refreshUndoUI();refreshProjectTabs();
      showRecent();
    }
  }else refreshProjectTabs();
}

// ── EXPORT ──
function updateExpBtn(){
  var btn=document.getElementById('exp-btn');if(!btn)return;
  var ids=S.selIds.length?S.selIds:(S.selId?[S.selId]:[]);
  if(ids.length){btn.style.opacity='';btn.style.pointerEvents='';btn.title='Export selected';}
  else{btn.style.opacity='0.35';btn.style.pointerEvents='none';btn.title='Select objects to export';}
}

var expBtn=document.getElementById('exp-btn');if(expBtn)expBtn.addEventListener('click',function(){
  var ids=S.selIds.length?S.selIds:(S.selId?[S.selId]:[]);
  if(!ids.length){toast('Select objects to export');return;}
  var items=ids.map(findAny).filter(Boolean);
  if(!items.length)return;
  var dc=dom.defsEl.innerHTML;

  function exportOne(item,idx){
    var isFr=S.frames.indexOf(item)>=0;
    var isGr=item.type==='group';
    var domId=isFr?'fg'+item.id:isGr?'gg'+item.id:'g'+item.id;
    var domEl=document.getElementById(domId);
    var next=function(){if(idx+1<items.length)setTimeout(function(){exportOne(items[idx+1],idx+1);},250);};
    if(!domEl){next();return;}

    var bb;
    if(isFr){bb={x:item.x,y:item.y,w:item.w,h:item.h};}
    else if(isGr){bb=getGroupBBox(item);}
    else{bb=getBBox(item);}
    if(!bb||bb.w<1||bb.h<1){next();return;}

    var w=Math.ceil(bb.w),h=Math.ceil(bb.h);
    var ss='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"'
      +' width="'+w+'" height="'+h+'" viewBox="'+bb.x+' '+bb.y+' '+bb.w+' '+bb.h+'">'
      +'<defs>'+dc+'</defs>'
      +domEl.outerHTML+'</svg>';

    var name=(item.name||('export-'+(idx+1)))+'.png';
    var img=new Image();
    var blob=new Blob([ss],{type:'image/svg+xml'});
    var url=URL.createObjectURL(blob);
    img.onload=function(){
      var c=document.createElement('canvas');c.width=w*2;c.height=h*2;
      var ctx=c.getContext('2d');ctx.scale(2,2);ctx.drawImage(img,0,0);
      URL.revokeObjectURL(url);
      var a=document.createElement('a');a.download=name;a.href=c.toDataURL();a.click();
      if(idx+1<items.length){setTimeout(function(){exportOne(items[idx+1],idx+1);},250);}
      else{toast('Exported '+items.length+' file'+(items.length>1?'s':'')+' ✓');}
    };
    img.onerror=function(){URL.revokeObjectURL(url);next();};
    img.src=url;
  }
  exportOne(items[0],0);
});

// ── EYEDROPPER ──
function activateEyedropper(){
  S._prevTool=S.tool;
  S.tool='eyedropper';
  document.querySelectorAll('.tbtn').forEach(function(b){b.classList.remove('on','frame-on')});
  var b=document.getElementById('t-eyedropper');if(b)b.classList.add('on');
  if(dom.canvas)dom.canvas.style.cursor='crosshair';
}
function edSampleAt(cx,cy){
  // temporarily hide selOv so we can pierce through it
  var prevPE=dom.selOv.style.pointerEvents;
  dom.selOv.style.pointerEvents='none';
  var els=document.elementsFromPoint(cx,cy);
  dom.selOv.style.pointerEvents=prevPE;
  var SHAPES=['rect','ellipse','circle','path','line','polygon','polyline'];
  for(var i=0;i<els.length;i++){
    var el=els[i];
    var tag=(el.tagName||'').toLowerCase();
    if(SHAPES.indexOf(tag)>=0){
      var fill=el.getAttribute('fill');
      if(fill&&fill!=='none'&&!fill.startsWith('url(')){
        return rgbToHex(fill);
      }
      // also check computed style
      var cs=window.getComputedStyle(el);
      var cf=cs.fill||cs.color;
      if(cf&&cf!=='none'&&!cf.startsWith('url(')){return rgbToHex(cf);}
    }
  }
  return null;
}
function rgbToHex(str){
  if(!str)return null;
  str=str.trim();
  if(/^#[0-9a-f]{3,6}$/i.test(str)){
    if(str.length===4){
      return '#'+str[1]+str[1]+str[2]+str[2]+str[3]+str[3];
    }
    return str.toLowerCase();
  }
  var m=str.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if(m){
    return '#'+[m[1],m[2],m[3]].map(function(v){return ('0'+parseInt(v).toString(16)).slice(-2);}).join('');
  }
  return null;
}
function edBadgeUpdate(e){
  var badge=document.getElementById('ed-badge');
  var color=edSampleAt(e.clientX,e.clientY);
  badge.style.display='flex';
  badge.style.left=(e.clientX+18)+'px';
  badge.style.top=(e.clientY+18)+'px';
  var swatch=document.getElementById('ed-swatch');
  var hexEl=document.getElementById('ed-hex');
  var hintEl=document.getElementById('ed-hint');
  if(color){
    swatch.style.background=color;
    hexEl.textContent=color.toUpperCase();
    var ids=S.selIds.length?S.selIds:(S.selId?[S.selId]:[]);
    hintEl.textContent=ids.length?'Click to apply':'Click to sample';
  } else {
    swatch.style.background='transparent';
    hexEl.textContent='–';
    hintEl.textContent='No color here';
  }
}
function edBadgeHide(){
  var badge=document.getElementById('ed-badge');
  if(badge)badge.style.display='none';
}

// ── INIT ── (run only when dom.canvas is available; e.g. after setHostContext in bootstrap)
function runEditorInit(){
  if(!dom.canvas)return;
  var r=dom.canvas.getBoundingClientRect();S.px=r.width/2-300;S.py=r.height/2-200;
  applyTr();drawSnapGrid();refreshLayers();refreshProps();refreshCompPanel();
  var lastId=localStorage.getItem('dos_last');
  if(lastId){
    var saved=localStorage.getItem('dos_proj_'+lastId);
    if(saved){try{loadProject(saved);}catch(e){snapshot();}}
    else{snapshot();}
  } else {
    S.projId='p'+Date.now();
    snapshot();
  }
  if(S.projId&&(!S.openTabs||!S.openTabs.length)){if(!S.openTabs)S.openTabs=[];S.openTabs.push({id:S.projId,name:S.projName});S.activeTabId=S.projId;}
  refreshProjectTabs();
  updateExpBtn();
  toast('DesignOS v14 — Auto-save enabled');
}
runEditorInit();

// expose for inline HTML handlers
window.showTab = showTab;
window.showRecent = showRecent;
window.hideRecent = hideRecent;
window.newProject = newProject;
window.renameProject = renameProject;
window.activateEyedropper = activateEyedropper;

// Integration: update item position/size from Angular properties panel (minimal API, no big refactor)
function updateItemPosition(id, x, y) {
  var item = findAny(id);
  if (!item) return;
  var dx = (typeof x === 'number' ? x : item.x || 0) - (item.x || 0);
  var dy = (typeof y === 'number' ? y : item.y || 0) - (item.y || 0);
  if (!dx && !dy) return;
  var fr = S.frames.find(function (f) { return f.id === id });
  var grp = S.groups.find(function (g) { return g.id === id });
  var el = S.els.find(function (e) { return e.id === id });
  if (fr) { fr.x = (fr.x || 0) + dx; fr.y = (fr.y || 0) + dy; renderFrame(fr); }
  else if (grp) {
    function nudgeGroup(g2, ddx, ddy) {
      g2.children.forEach(function (cid) {
        var ch = findAny(cid); if (!ch) return;
        if (ch.type === 'group') { ch.x = (ch.x || 0) + ddx; ch.y = (ch.y || 0) + ddy; nudgeGroup(ch, ddx, ddy); }
        else if (ch.type === 'path') { movePath(ch, ddx, ddy); }
        else { ch.x = (ch.x || 0) + ddx; ch.y = (ch.y || 0) + ddy; }
      });
    }
    nudgeGroup(grp, dx, dy);
    renderGroup(grp);
  } else if (el) {
    if (el.type === 'path') movePath(el, dx, dy);
    else { el.x = (el.x || 0) + dx; el.y = (el.y || 0) + dy; }
    renderEl(el);
  }
  drawSel(); refreshProps(); snapshot();
  if (window.__designosAPI && window.__designosAPI.onSelectionChange) window.__designosAPI.onSelectionChange();
}
function updateItemSize(id, w, h) {
  var item = findAny(id);
  if (!item) return;
  if (S.groups.some(function (g) { return g.id === id })) return; // group size derived from children
  if (typeof w === 'number') item.w = Math.max(0, w);
  if (typeof h === 'number') item.h = Math.max(0, h);
  var fr = S.frames.find(function (f) { return f.id === id });
  var el = S.els.find(function (e) { return e.id === id });
  if (fr) renderFrame(fr);
  else if (el) renderEl(el);
  drawSel(); refreshProps(); snapshot();
  if (window.__designosAPI && window.__designosAPI.onSelectionChange) window.__designosAPI.onSelectionChange();
}

// Integration: expose API for EditorEngine (Angular -> facade -> bridge -> engine)
if (typeof window !== 'undefined') {
  window.__designosAPI = {
    mkEl: mkEl,
    delSel: delSel,
    adjZ: adjZ,
    S: S,
    onSelectionChange: null,
    findAny: findAny,
    runEditorInit: runEditorInit,
    updateItemPosition: updateItemPosition,
    updateItemSize: updateItemSize
  };
}
