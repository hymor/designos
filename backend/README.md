# DesignOS Backend (NestJS)

Minimal API skeleton for the editor. No DB or frontend wiring yet.

## Structure

- `src/app.module.ts` — root module
- `src/health` — health check (`GET /api/health`)
- `src/projects` — projects API (stub)
- `src/documents` — documents API (stub)

## Run

```bash
cd backend
npm install
npm run start:dev
```

API base: `http://localhost:3000/api`

- `GET /api/health` — readiness check
- `GET /api/projects` — list projects (stub)
- `POST /api/projects` — create project (body: `CreateProjectDto`: `{ name: string }`)
- `GET /api/documents` — list documents (stub)
- `POST /api/documents` — save document (body: `SaveDocumentDto`: `{ document: EditorDocumentDto }`)
- `GET /api/documents/:id` — get document (returns `EditorDocumentDto`)

Document shape (`EditorDocumentDto`) is compatible with `src/engine/model/types.ts`: `id`, `name`, `pages[]` (each: `id`, `name`, `width`, `height`, `objects[]`), `activePageId`. Objects use `BaseObjectDto`: `id`, `type`, `x`, `y`, `width`, `height`, optional `rotation`, `parentId`. No DB or auth yet.

## Later

- Add DB in `projects` and `documents`
- Add validation (e.g. class-validator) on DTOs
- Connect frontend via HTTP client
