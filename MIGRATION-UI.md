# UI migration: Legacy → Angular

## Result

- **Angular is the primary UI source** when running `frontend/shell` (ng serve). Toolbar, panels, modals, project flow, and file controls are Angular components; the editor runtime (legacy engine) is driven via `__designosAPI` and bridge.
- **Legacy `index.html`** at project root is **not** the main UI controller for the Angular build. It is used only for the legacy standalone entrypoint (e.g. Vite serving root). That entrypoint only bootstraps the editor on `#canvas`; the full legacy DOM in that file is optional.

## What was made optional / disabled as primary

| Area | Change |
|------|--------|
| **Toolbar** | Legacy no longer assumes `#t-*`, `#z-in`, `#z-out`, `#exp-btn`, `#proj-name-input`, `#img-input`, `#proj-input` exist. Angular provides these; legacy listeners are attached only when elements exist (`if(b) b.addEventListener(...)`). Actions are triggered via `__designosAPI` (setTool, exportSelectedAsPng, addImageFromDataUrl, renameProject, getProjName). |
| **Zoom display** | `applyTr()` updates `#zoom-val` only if present. |
| **Layers / Props panels** | `refreshLayers()` and `refreshProps()` use `dom.layersDiv` / `dom.propsDiv`; in Angular host these are `null`, so both no-op. Angular renders layers and properties via its own components and `getLayersItems` / selection. |
| **Left-panel tabs** | `showTab('layers'|'comps')` now guards all DOM refs (`layers-tab`, `comps-tab`, `tab-layers`, `tab-comps`); no throw when missing. |
| **Components panel** | `refreshCompPanel()` already had `if(!cl)return` for `#comp-list`. |
| **Modals** | Recent, Table create, SVG paste: legacy can show/hide DOM modals when present; Angular uses its own modals and wires `openSvgPasteChoice`, table confirm via `createTableAtCenter`, and recent via Angular routing/modal. Legacy modal DOM refs are guarded or optional. |
| **Export** | Triggered from Angular; legacy `exportSelectedAsPng` is called via API. |
| **Image import** | Triggered from Angular file input; legacy `addImageFromDataUrl` is called via API. |
| **Project name** | Angular toolbar binds to `projectName$` and calls `renameProject`; legacy `setProjName`/`renameProject` still update state and optional `#proj-name-input` when present. |
| **Eyedropper badge** | Legacy can update `#ed-badge` when present; when `__designosAPI.eyedropperBadgeUpdate` / `eyedropperBadgeHide` are set, legacy uses them and Angular shows the badge. |
| **Save status / Undo UI** | `setSaveStatus`, `updateExpBtn`, `refreshUndoUI` / `refreshProjectTabs` only update DOM when the corresponding elements exist. |

## What remains legacy-dependent (runtime / internals)

| Item | Reason |
|------|--------|
| **Host DOM from bootstrap** | `dom.canvas`, `dom.defsEl`, `dom.framesG`, `dom.elsLoose`, `dom.selOv`, `dom.sgG`, ghost elements, `dom.bandRect`, `dom.snapCvs`, `dom.ted` are provided by the host (Angular container or legacy `#canvas`). Required for rendering and interaction. |
| **Object context menu** | Legacy still builds and positions `#obj-context-menu` when present; Angular uses its own context menu and calls legacy actions (delete, copy, paste, group, ungroup) via API or `window.groupSel`/`ungroupSel`. Legacy menu DOM is optional. |
| **Copy/Cut/Paste buttons** | Legacy attaches to `#copy-btn`, `#cut-btn`, `#paste-btn` when present; Angular could wire these via API later. Currently optional. |
| **Toast** | Legacy `toast()` uses `dom.toastEl` when set; Angular has its own toast. In Angular host `toastEl` is null; legacy toast then no-ops unless a custom handler is set. |

## How to run

- **Angular (primary UI):** from `frontend/shell` run `ng serve`. Opens the Angular app; editor is bootstrapped on the Angular canvas container. No dependency on root `index.html` markup.
- **Legacy standalone:** serve project root with entry `/src/app/main.ts` and the root `index.html` that contains the full legacy UI. Used for debug or legacy-only flows.

## Backend

- No backend contract changes were required for this migration. Save/load, projects list, and create project use existing APIs.
