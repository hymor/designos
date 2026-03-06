// DesignOS – frame/element lookup and subtree removal (no render)

export function createFrameTree(S) {
  function findFrame(id) {
    return S.frames.find((f) => f.id === id);
  }
  function findEl(id) {
    return S.els.find((e) => e.id === id);
  }
  function isFrameId(id) {
    return !!findFrame(id);
  }
  function isElId(id) {
    return !!findEl(id);
  }

  function removeDomForItem(id) {
    const fg = document.getElementById('fg' + id);
    if (fg) fg.remove();
    const g = document.getElementById('g' + id);
    if (g) g.remove();
    const cp = document.getElementById('clip' + id);
    if (cp) cp.remove();
  }

  function removeSubtreeOfFrame(frame) {
    (frame.children || []).forEach((cid) => {
      if (isFrameId(cid)) {
        const cf = findFrame(cid);
        if (cf) removeSubtreeOfFrame(cf);
        S.frames = S.frames.filter((f) => f.id !== cid);
        removeDomForItem(cid);
      } else if (isElId(cid)) {
        S.els = S.els.filter((e) => e.id !== cid);
        removeDomForItem(cid);
      }
    });
    frame.children = [];
  }

  return {
    findFrame,
    findEl,
    isFrameId,
    isElId,
    removeDomForItem,
    removeSubtreeOfFrame
  };
}
