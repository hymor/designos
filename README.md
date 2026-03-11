# DesignOS

## Main frontend (Angular)

The **primary user-facing UI** is the Angular app in `frontend/shell/`.

### Run (frontend)

```bash
npm install
npm run dev
```

This runs `ng serve` from `frontend/shell`.

### Build (frontend)

```bash
npm run build
```

Output goes to `dist/angular-ui/`.

## Backend (Nest)

```bash
npm run backend:dev
```

API base: `http://localhost:3000/api`.

## Legacy / debug runtime (Vite)

The old Vite-based entrypoint is kept for compatibility and debugging:

- `index.html` + `src/app/main.ts`
- `src/app/bootstrap-legacy-editor.ts` (bootstrap used by both legacy and Angular)

Run it explicitly:

```bash
npm run legacy:dev
```

Notes:
- This legacy UI is **not** the main product flow anymore.
- It will be cleaned up in future steps once Angular fully replaces it.

