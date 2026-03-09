# Module extraction guide

## Folder structure

```
src/
  core/         state.js, constants.js
  utils/        utils.js
  geometry/     geometry.js
  render/       gradients.js
  layout/       alignment.js, frameTree.js
  interaction/  zoomPan.js, snapGrid.js, smartGuides.js
  history/      undo.js
  legacy/       legacy.js
  app/          main.ts
  docs/         MODULES.md
```

## What works (safe to extract)

- **Pure logic, no runtime deps**: Functions that use only their arguments and return values. No `S`, no `dom`, no other legacy functions.
- **Simple factories at top-level**: `createUndo(S, dom, { applyHistSnap, toast })` etc., called once near the top of `legacy.js` where all deps already exist. No dependency on things defined *later* in the file (e.g. `refreshProps`, `renderFrame`, `drawSel`).

## What caused pain (avoid for now)

- **DOM listeners** (wheel, zoom buttons): Timing or context when attaching in a separate module led to zoom not working → reverted.
- **Late-bound / UI-heavy deps**: Alignment needed `refreshProps` and was wired *after* `refreshProps`; align buttons didn't work → reverted.

## Safe extraction candidates

| Candidate | Why safe |
|-----------|----------|
| **geometry.js** | `pathTightBBox(pts, closed)` is pure (no S, no dom). Just export it; legacy imports and uses it. |
| **constants.js** | `PRESETS`, `TOOLS` are plain data. Import in legacy and remove the inline arrays. |

## Current modules (working)

- `core/state.js` – S, dom
- `utils/utils.js` – ns, clamp, deep, uid, toast, etc.
- `core/constants.js` – PRESETS, TOOLS
- `geometry/geometry.js` – pathTightBBox(pts, closed) (pure)
- `render/gradients.js` – createGradients → buildGradDef, defGrad, hexToRgba, gradCSS
- `layout/alignment.js` – createAlignment → alignItems, alignHTML, bindAlignBtns
- `layout/frameTree.js` – createFrameTree → findFrame, findEl, removeSubtreeOfFrame, etc.
- `interaction/zoomPan.js` – createZoomPan → adjZ
- `interaction/snapGrid.js` – createSnapGrid → drawSnapGrid
- `interaction/smartGuides.js` – createSmartGuides → applySmartGuides, clearGuides
- `history/undo.js` – createUndo → snapshot, undo, redo, refreshUndoUI
- `legacy/legacy.js` – app bootstrap and UI wiring

## Reverted (stay in legacy)

- zoom/pan (wheel + buttons) – module exists but wiring stays in legacy
- alignment (alignItems, alignHTML, bindAlignBtns) – module exists but binding stays in legacy
