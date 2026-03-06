// DesignOS – shared state and DOM refs (single source of truth)

export const S = {
  tool: 'select',
  els: [],
  frames: [],
  selId: null,
  selIds: [],
  nid: 1,
  zoom: 1,
  px: 0,
  py: 0,
  drawing: false,
  ds: null,
  frameDraw: false,
  panning: false,
  panS: null,
  dragging: false,
  dragEl: null,
  dragS: null,
  resizing: false,
  resDir: null,
  resEl: null,
  resS: null,
  bandSel: false,
  bandStart: null,
  clipboard: [],
  pasteOff: 0,
  history: [],
  histIdx: -1,
  snap: true,
  snapSz: 8,
  defFill: '#7b61ff',
  bandAdd: false,
  dragMulti: null,
  rotating: false,
  rotEl: null,
  rotS: null,
  groups: [],
  swapSrc: null,
  penPts: [],
  penActive: false,
  penElId: null,
  penEditId: null,
  penEditSelNode: -1,
  penEditSelNodes: [],  // multi-selection of path nodes (indices)
  penEditDragNodeIdx: -1,
  penEditDragStart: null,
  penEditDragHandleNode: -1,
  penEditDragHandleSide: '',
  penEditDragMoved: false,
  penEditPathCenter: null,
  penEditMarquee: null,  // { x1, y1, x2, y2, addToSel } when dragging selection box
  components: [],
  smartGuides: true,
  projId: null,
  projName: 'Untitled',
  collapsedFrames: {},  // frameId -> true when frame is collapsed in layers tree
  collapsedGroups: {},  // groupId -> true when group is collapsed in layers tree
  openTabs: [],         // [{id, name}] open project tabs
  activeTabId: null     // id of currently active tab
};

function getDom() {
  return {
    canvas: document.getElementById('canvas'),
    defsEl: document.getElementById('defs'),
    framesG: document.getElementById('frames-g'),
    elsLoose: document.getElementById('els-loose'),
    selOv: document.getElementById('sel-ov'),
    sgG: document.getElementById('smart-guides-g'),
    ghost: document.getElementById('ghost'),
    fghost: document.getElementById('fghost'),
    ted: document.getElementById('ted'),
    layersDiv: document.getElementById('layers'),
    propsDiv: document.getElementById('props'),
    bandRect: document.getElementById('band-rect'),
    snapCvs: document.getElementById('snap-grid'),
    toastEl: document.getElementById('toast')
  };
}

export const dom = getDom();
