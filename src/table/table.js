/**
 * Table tool — вариант A: таблица как один объект (type: 'table').
 * Ячейки — обычные текстовые элементы в S.els с tableCell: { tableId, row, col }.
 * Границы задаются в таблице (borders).
 */

const CELL_PAD = 6;
const DEFAULT_CELL_W = 80;
const DEFAULT_CELL_H = 28;
const DEFAULT_BORDERS = { show: true, color: '#999', width: 1 };

/**
 * Создаёт таблицу и текстовые ячейки. Не мутирует S сама — возвращает { tableEl, cellEls }, вызывающий код добавит в S.els и (при необходимости) в frame.children.
 * @param {number} rows
 * @param {number} cols
 * @param {number} x — позиция таблицы (мировые или локальные к фрейму)
 * @param {number} y
 * @param {object} opts — { cellW, cellH, borders, frameId, groupId, name }
 * @param {object} api — { uid, nid }
 */
export function createTableData(rows, cols, x, y, opts, api) {
  opts = opts || {};
  const cellW = opts.cellW ?? DEFAULT_CELL_W;
  const cellH = opts.cellH ?? DEFAULT_CELL_H;
  const borders = opts.borders != null ? { ...DEFAULT_BORDERS, ...opts.borders } : { ...DEFAULT_BORDERS };
  const frameId = opts.frameId ?? null;
  const groupId = opts.groupId ?? null;
  const name = opts.name ?? 'Table ' + (api.nid || 0);

  const w = cols * cellW;
  const h = rows * cellH;
  const tableId = api.uid();
  const tableEl = {
    id: tableId,
    type: 'table',
    x, y, w, h,
    rows, cols, cellW, cellH,
    cells: [],
    borders,
    fill: opts.fill ?? 'none',
    stroke: opts.stroke ?? (borders.color || '#999'),
    strokeWidth: opts.strokeWidth ?? (borders.width != null ? borders.width : 1),
    frameId,
    groupId,
    name,
  };

  const cellEls = [];
  for (let r = 0; r < rows; r++) {
    tableEl.cells[r] = [];
    for (let c = 0; c < cols; c++) {
      const cellId = api.uid();
      const cellEl = {
        id: cellId,
        type: 'text',
        text: '',
        x: c * cellW + CELL_PAD,
        y: r * cellH + CELL_PAD,
        w: cellW - CELL_PAD * 2,
        h: cellH - CELL_PAD * 2,
        fs: 14,
        fill: '#000',
        fontFamily: 'system-ui, sans-serif',
        fw: '400',
        frameId: null,
        groupId: null,
        tableCell: { tableId, row: r, col: c },
        name: 'Cell',
      };
      tableEl.cells[r][c] = cellId;
      cellEls.push(cellEl);
    }
  }
  return { tableEl, cellEls };
}

/**
 * Возвращает bbox таблицы в тех же координатах, что и el (абсолютные или локальные к фрейму).
 */
export function getTableBBox(tableEl) {
  const w = tableEl.w ?? tableEl.cols * (tableEl.cellW || DEFAULT_CELL_W);
  const h = tableEl.h ?? tableEl.rows * (tableEl.cellH || DEFAULT_CELL_H);
  return { x: tableEl.x, y: tableEl.y, w, h };
}

/**
 * Рисует таблицу: группа с transform translate(tableEl.x, tableEl.y), границы, затем ячейки (текст через api.renderElInto).
 * @param {object} tableEl — элемент типа 'table'
 * @param {Element} parentNode — SVG-контейнер (fc, elsLoose, …)
 * @param {object} api — { ns, findAny, renderElInto }
 */
export function renderTable(tableEl, parentNode, api) {
  const ns = api.ns;
  const findAny = api.findAny;
  const renderElInto = api.renderElInto;

  const g = ns('g');
  g.id = 'g' + tableEl.id;
  g.setAttribute('transform', 'translate(' + tableEl.x + ',' + tableEl.y + ')');

  const cellW = tableEl.cellW || DEFAULT_CELL_W;
  const cellH = tableEl.cellH || DEFAULT_CELL_H;
  const w = tableEl.w ?? tableEl.cols * cellW;
  const h = tableEl.h ?? tableEl.rows * cellH;
  const borders = tableEl.borders || DEFAULT_BORDERS;
  const tableFill = tableEl.fill != null ? tableEl.fill : 'none';
  const tableStroke = tableEl.stroke != null ? tableEl.stroke : (borders.color || '#999');
  const tableStrokeWidth = Math.max(0, tableEl.strokeWidth != null ? tableEl.strokeWidth : (borders.width != null ? borders.width : 1));

  // Background (заливка)
  if (tableFill && tableFill !== 'none') {
    const bg = ns('rect');
    bg.setAttribute('x', 0);
    bg.setAttribute('y', 0);
    bg.setAttribute('width', w);
    bg.setAttribute('height', h);
    bg.setAttribute('fill', tableFill);
    bg.setAttribute('stroke', 'none');
    bg.style.pointerEvents = 'none';
    g.appendChild(bg);
  }

  // Hit rect with pointer-events: none so clicks pass through to cells (dblclick to edit).
  // Table drag is started from group mousedown when target is not a cell (see below).
  if (api.onTableHit) {
    const hit = ns('rect');
    hit.setAttribute('x', 0);
    hit.setAttribute('y', 0);
    hit.setAttribute('width', w);
    hit.setAttribute('height', h);
    hit.setAttribute('fill', 'transparent');
    hit.setAttribute('stroke', 'none');
    hit.style.pointerEvents = 'none';
    g.appendChild(hit);
  }

  // Outer stroke (обводка)
  if (tableStroke && tableStroke !== 'none' && tableStrokeWidth > 0) {
    const outer = ns('rect');
    outer.setAttribute('x', 0);
    outer.setAttribute('y', 0);
    outer.setAttribute('width', w);
    outer.setAttribute('height', h);
    outer.setAttribute('fill', 'none');
    outer.setAttribute('stroke', tableStroke);
    outer.setAttribute('stroke-width', tableStrokeWidth);
    outer.style.pointerEvents = 'none';
    g.appendChild(outer);
  }

  if (borders.show && borders.color && borders.width != null) {
    const gridStroke = borders.color;
    const sw = borders.width;
    for (let i = 1; i < tableEl.cols; i++) {
      const line = ns('line');
      line.setAttribute('x1', i * cellW);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', i * cellW);
      line.setAttribute('y2', h);
      line.setAttribute('stroke', gridStroke);
      line.setAttribute('stroke-width', sw);
      line.style.pointerEvents = 'none';
      g.appendChild(line);
    }
    for (let j = 1; j < tableEl.rows; j++) {
      const line = ns('line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', j * cellH);
      line.setAttribute('x2', w);
      line.setAttribute('y2', j * cellH);
      line.setAttribute('stroke', gridStroke);
      line.setAttribute('stroke-width', sw);
      line.style.pointerEvents = 'none';
      g.appendChild(line);
    }
  }

  if (tableEl.cells) {
    for (let r = 0; r < tableEl.cells.length; r++) {
      for (let c = 0; c < (tableEl.cells[r] || []).length; c++) {
        const cellId = tableEl.cells[r][c];
        const cellEl = findAny(cellId);
        if (cellEl) renderElInto(cellEl, g, false);
      }
    }
  }

  // Cell hit layer on top so clicks on cell area hit this; outer/lines have pointer-events:none so they don't steal clicks.
  for (let r = 0; r < tableEl.rows; r++) {
    for (let c = 0; c < tableEl.cols; c++) {
      const cellId = tableEl.cells[r][c];
      const cellEl = findAny(cellId);
      if (!cellEl) continue;
      const cellHit = ns('rect');
      cellHit.setAttribute('x', c * cellW);
      cellHit.setAttribute('y', r * cellH);
      cellHit.setAttribute('width', cellW);
      cellHit.setAttribute('height', cellH);
      cellHit.setAttribute('fill', 'transparent');
      cellHit.setAttribute('stroke', 'none');
      cellHit.setAttribute('data-cell-id', cellId);
      cellHit.setAttribute('id', 'cell-hit-' + cellId);
      cellHit.addEventListener('mousedown', function (e) {
        e.stopPropagation();
        if (api.onTableHit) api.onTableHit(e, tableEl);
      });
      cellHit.addEventListener('dblclick', function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (api.selectEl) api.selectEl(cellEl.id, false);
        if (api.openTed && cellEl.type === 'text') api.openTed(cellEl);
      });
      g.appendChild(cellHit);
    }
  }

  // Start table drag when mousedown on table area (border/empty), not on a cell (cells stopPropagation).
  if (api.onTableHit) {
    g.addEventListener('mousedown', function (e) {
      api.onTableHit(e, tableEl);
    });
  }

  if (api.openTed) {
    g.addEventListener('dblclick', function (e) {
      const cellIdFromRect = e.target.getAttribute && e.target.getAttribute('data-cell-id');
      const id = cellIdFromRect || (function () {
        const gEl = e.target.closest && e.target.closest('[id^="g"]');
        if (!gEl || !gEl.id || gEl.id === 'g' + tableEl.id) return null;
        return gEl.id.slice(1);
      })();
      if (!id) return;
      const cellEl = findAny(id);
      if (cellEl && cellEl.tableCell && cellEl.type === 'text') {
        if (api.selectEl) api.selectEl(cellEl.id, false);
        e.stopPropagation();
        e.preventDefault();
        api.openTed(cellEl);
      }
    });
  }

  parentNode.appendChild(g);
}
