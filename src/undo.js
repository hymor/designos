// DesignOS – undo/redo (depends on state, utils; applyHistSnap injected from legacy)

const MAX_HIST = 60;

export function createUndo(S, dom, deps) {
  const { applyHistSnap, toast } = deps;

  function refreshUndoUI() {
    const u = document.getElementById('undo-btn');
    const r = document.getElementById('redo-btn');
    if (u) u.classList.toggle('dim', S.histIdx <= 0);
    if (r) r.classList.toggle('dim', S.histIdx >= S.history.length - 1);
  }

  function snapshot() {
    S.history = S.history.slice(0, S.histIdx + 1);
    S.history.push(
      JSON.stringify({
        frames: S.frames,
        els: S.els,
        nid: S.nid,
        components: S.components
      })
    );
    if (S.history.length > MAX_HIST) S.history.shift();
    S.histIdx = S.history.length - 1;
    refreshUndoUI();
  }

  function undo() {
    if (S.histIdx <= 0) return;
    S.histIdx--;
    applyHistSnap(S.histIdx);
    refreshUndoUI();
    toast('Undo');
  }

  function redo() {
    if (S.histIdx >= S.history.length - 1) return;
    S.histIdx++;
    applyHistSnap(S.histIdx);
    refreshUndoUI();
    toast('Redo');
  }

  const u = document.getElementById('undo-btn');
  const r = document.getElementById('redo-btn');
  if (u) u.addEventListener('click', undo);
  if (r) r.addEventListener('click', redo);

  return { snapshot, refreshUndoUI, undo, redo };
}
