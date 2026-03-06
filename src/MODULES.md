# Module extraction guide

## What works (safe to extract)

- **Pure logic, no runtime deps**: Functions that use only their arguments and return values. No `S`, no `dom`, no other legacy functions.
- **Simple factories at top-level**: `createUndo(S, dom, { applyHistSnap, toast })` etc., called once near the top of `legacy.js` where all deps already exist. No dependency on things defined *later* in the file (e.g. `refreshProps`, `renderFrame`, `drawSel`).

## What caused pain (avoid for now)

- **DOM listeners** (wheel, zoom buttons): Timing or context when attaching in a separate module led to zoom not working → reverted.
- **Late-bound / UI-heavy deps**: Alignment needed `refreshProps` and was wired *after* `refreshProps`; align buttons didn’t work → reverted.

## Safe extraction candidates

| Candidate | Why safe |
|-----------|----------|
| **geometry.js** | `pathTightBBox(pts, closed)` is pure (no S, no dom). Just export it; legacy imports and uses it. |
| **constants.js** | `PRESETS`, `TOOLS` are plain data. Import in legacy and remove the inline arrays. |

## Current modules (working)

- `state.js` – S, dom
- `utils.js` – ns, clamp, deep, uid, toast, etc.
- `undo.js` – createUndo → snapshot, undo, redo, refreshUndoUI
- `smartGuides.js` – createSmartGuides → applySmartGuides, clearGuides
- `frameTree.js` – createFrameTree → findFrame, findEl, removeSubtreeOfFrame, etc.
- `snapGrid.js` – createSnapGrid → drawSnapGrid
- `gradients.js` – createGradients → buildGradDef, defGrad, hexToRgba, gradCSS
- `geometry.js` – pathTightBBox(pts, closed) (pure)
- `constants.js` – PRESETS, TOOLS

## Reverted (stay in legacy)

- zoom/pan (wheel + buttons)
- alignment (alignItems, alignHTML, bindAlignBtns)
