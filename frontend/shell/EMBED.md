# Подключение Angular UI к runtime редактора

## Сборка

Из папки `frontend/shell`:

```bash
npm run build
```

Бандл попадает в **`dist/angular-ui/`** (от корня проекта). Файлы лежат в подпапке **`browser/`**:
- `dist/angular-ui/browser/main.js`
- `dist/angular-ui/browser/polyfills.js`
- `dist/angular-ui/browser/styles.css`

Имена без хешей (`outputHashing: "none"`), чтобы их можно было подключать фиксированными путями.

## Подключение в index.html редактора

В существующий `index.html` (после загрузки скрипта, создающего `window.editorBridge`) добавьте:

```html
<link rel="stylesheet" href="dist/angular-ui/browser/styles.css">
<script src="dist/angular-ui/browser/polyfills.js"></script>
<script src="dist/angular-ui/browser/main.js"></script>
```

Корень приложения Angular — элемент `<app-root></app-root>`. Его нужно разместить в нужном месте разметки (например, внутри `#canvas` или рядом с панелями).

Dev-сервер (`ng serve` на localhost:4200) не трогается и по-прежнему доступен для разработки.
