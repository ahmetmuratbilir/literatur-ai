// Görsel paneli — tablo çekirdeği (WO-019 Faz 1). Saf: DOM'a dokunmaz.
//
// Izgara: { header, cells: string[][], align: ('left'|'center'|'right')[] }.
// Bütün satırlar aynı uzunlukta tutulur; her işlem yeni nesne döner.
// Belgedeki <table> bu ızgaradan üretilir ve panel açılırken yine ondan okunur:
// ayrı bir görsel deposu yok, tablonun HTML'i durumun kendisidir.

export const MAX_ROWS = 200;
export const MAX_COLS = 30;
const ALIGNS = new Set(['left', 'center', 'right']);

const str = (v) => (v == null ? '' : String(v));

/** Satırları en uzun satıra göre boş hücreyle doldurur; en az 1×1. */
export function normalizeCells(cells) {
  const rows = (Array.isArray(cells) ? cells : []).map((r) => (Array.isArray(r) ? r.map(str) : []));
  const width = Math.max(1, ...rows.map((r) => r.length));
  const out = rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
  return out.length ? out : [Array(width).fill('')];
}

function withCells(grid, cells) {
  const width = cells[0].length;
  const align = Array.from({ length: width }, (_, i) => (ALIGNS.has(grid.align?.[i]) ? grid.align[i] : 'left'));
  return { header: Boolean(grid.header), cells, align };
}

export function createGrid(rows = 3, cols = 3, header = true) {
  const cells = Array.from({ length: Math.max(1, rows) }, () => Array(Math.max(1, cols)).fill(''));
  return withCells({ header }, cells);
}

export function fromCells(cells, { header = true, align = [] } = {}) {
  return withCells({ header, align }, normalizeCells(cells));
}

export function setCell(grid, r, c, value) {
  if (!grid.cells[r] || c < 0 || c >= grid.cells[r].length) return grid;
  const cells = grid.cells.map((row, i) => (i === r ? row.map((v, j) => (j === c ? str(value) : v)) : row));
  return { ...grid, cells };
}

export function insertRow(grid, at) {
  if (grid.cells.length >= MAX_ROWS) return grid;
  const i = Math.max(0, Math.min(at, grid.cells.length));
  const cells = [...grid.cells.slice(0, i), Array(grid.cells[0].length).fill(''), ...grid.cells.slice(i)];
  return { ...grid, cells };
}

export function removeRow(grid, at) {
  if (grid.cells.length <= 1 || !grid.cells[at]) return grid;
  return { ...grid, cells: grid.cells.filter((_, i) => i !== at) };
}

export function insertCol(grid, at) {
  const width = grid.cells[0].length;
  if (width >= MAX_COLS) return grid;
  const i = Math.max(0, Math.min(at, width));
  const cells = grid.cells.map((row) => [...row.slice(0, i), '', ...row.slice(i)]);
  const align = [...grid.align.slice(0, i), 'left', ...grid.align.slice(i)];
  return { ...grid, cells, align };
}

export function removeCol(grid, at) {
  const width = grid.cells[0].length;
  if (width <= 1 || at < 0 || at >= width) return grid;
  return {
    ...grid,
    cells: grid.cells.map((row) => row.filter((_, j) => j !== at)),
    align: grid.align.filter((_, j) => j !== at),
  };
}

const move = (list, from, to) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export function moveRow(grid, from, to) {
  const cells = move(grid.cells, from, to);
  return cells === grid.cells ? grid : { ...grid, cells };
}

export function moveCol(grid, from, to) {
  const order = move(grid.cells[0].map((_, j) => j), from, to);
  if (order.every((j, i) => j === i)) return grid;
  return {
    ...grid,
    cells: grid.cells.map((row) => order.map((j) => row[j])),
    align: order.map((j) => grid.align[j]),
  };
}

export function setAlign(grid, c, value) {
  if (!ALIGNS.has(value) || c < 0 || c >= grid.align.length) return grid;
  return { ...grid, align: grid.align.map((a, j) => (j === c ? value : a)) };
}

export const isEmptyGrid = (grid) => grid.cells.every((row) => row.every((v) => !v.trim()));

/**
 * Excel / Sheets / Numbers panosundaki metin: sekmeyle ayrılmış, satır sonuyla
 * bölünmüş. İçinde sekme, satır sonu ya da tırnak geçen hücre çift tırnakla
 * sarılır ve içindeki tırnak ikilenir (Excel'in yazdığı biçim).
 */
export function parseTsv(text) {
  const s = str(text).replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  let atStart = true;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"' && atStart) { quoted = true; atStart = false; continue; }
    if (ch === '\t') { row.push(cell); cell = ''; atStart = true; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; atStart = true; continue; }
    cell += ch;
    atStart = false;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** Panodan gelen blok tek hücre mi (düz metin olarak hücreye yazılır)? */
export const isSingleCell = (block) => block.length <= 1 && (block[0]?.length || 0) <= 1;

/**
 * Bloğu (r, c) hücresinden başlayarak ızgaraya yazar; gerekirse satır/sütun
 * ekler. Sınırı aşan kısım alınmaz ve kaç satır/sütunun dışarıda kaldığı
 * döner: arayüz bunu söyler (CLAUDE.md 2.8 — eksik veri sessizce düşmez).
 */
export function pasteBlock(grid, r, c, block) {
  const rowsWanted = r + block.length;
  const colsWanted = c + Math.max(0, ...block.map((b) => b.length));
  const height = Math.min(MAX_ROWS, Math.max(grid.cells.length, rowsWanted));
  const width = Math.min(MAX_COLS, Math.max(grid.cells[0].length, colsWanted));
  const cells = Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => grid.cells[i]?.[j] ?? ''));
  block.forEach((line, i) => line.forEach((value, j) => {
    if (r + i < height && c + j < width) cells[r + i][c + j] = str(value).trim();
  }));
  return {
    grid: withCells(grid, cells),
    droppedRows: Math.max(0, rowsWanted - height),
    droppedCols: Math.max(0, colsWanted - width),
  };
}

const escapeHtml = (s) => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cellHtml = (value) => escapeHtml(value).replace(/\n/g, '<br>');

/**
 * Belgeye girecek <table>. Başlık satırı <thead>/<th scope="col">; hizalama
 * hücrenin satır içi stilinde, çünkü DOCX çevirici hizayı oradan okuyor
 * (`exportDocument.js` paragraphOf).
 */
export function tableHtml(grid, id) {
  const style = (j) => (grid.align[j] && grid.align[j] !== 'left' ? ` style="text-align: ${grid.align[j]};"` : '');
  const row = (cells, tag) => `<tr>${cells.map((v, j) => `<${tag}${tag === 'th' ? ' scope="col"' : ''}${style(j)}>${cellHtml(v) || '<br>'}</${tag}>`).join('')}</tr>`;
  const head = grid.header ? `<thead>${row(grid.cells[0], 'th')}</thead>` : '';
  const body = (grid.header ? grid.cells.slice(1) : grid.cells).map((cells) => row(cells, 'td')).join('');
  return `<table class="wx-vtable" data-visual-id="${escapeHtml(id)}" data-visual-kind="table">${head}<tbody>${body}</tbody></table>`;
}

/**
 * Belgedeki tablonun okunmuş satırlarından ızgara: [{ text, header, align }][].
 * İlk satırın bütün hücreleri başlıksa başlık satırı açık sayılır.
 */
export function gridFromRows(rows) {
  const list = (rows || []).filter((r) => r.length);
  if (!list.length) return createGrid();
  const header = list[0].every((cell) => cell.header);
  // Satır sonu dışındaki her boşluk (bölünmez boşluk dahil) tek boşluk olur; <br> satırı kalır.
  const cells = normalizeCells(list.map((r) => r.map((cell) => str(cell.text).replace(/[^\S\n]+/g, ' ').trim())));
  const align = cells[0].map((_, j) => list.find((r) => r[j]?.align && r[j].align !== 'left')?.[j]?.align || 'left');
  return withCells({ header, align }, cells);
}

/** Başlık satırı: "Tablo 2. Örneklem özellikleri". */
export function captionLine(word, n, title) {
  const rest = str(title).replace(/\s+/g, ' ').trim();
  return `${word} ${n}.${rest ? ` ${rest}` : ' '}`;
}

/** Başlık paragrafından kullanıcının yazdığı kısım: "Tablo 2. X" → "X". */
export function captionTitle(text) {
  return str(text).replace(/^\s*(tablo|table)\s*\d+\s*[.:–—-]\s*/iu, '').trim();
}

/** Yeni görsel kimliği: belge içinde benzersiz yeter. */
export function newVisualId(now = Date.now(), random = Math.random) {
  return `v${now.toString(36)}${Math.floor(random() * 1e6).toString(36)}`;
}

// ---------- Word gibi tablo (WO-025) ----------
// Belgede düzenlenen tablo: ızgaradan boş tablo, üstünde Word'ün "Resim Yazısı"
// gibi başlık. Numara ayrı düğümde: yeniden numaralanırken kullanıcının başlık
// biçimine (italik vb.) dokunulmaz; Word'e SEQ alanı olarak çıkar.

export const PICKER_COLS = 10;
export const PICKER_ROWS = 8;

/** Boş tablo: ilk satır başlık (th), hücreler boş satırla (imleç girebilsin). */
export function emptyTableHtml(rows, cols, id, { header = true } = {}) {
  const r = Math.max(1, Math.min(MAX_ROWS, rows));
  const c = Math.max(1, Math.min(MAX_COLS, cols));
  const row = (tag) => `<tr>${Array.from({ length: c }, () => `<${tag}${tag === 'th' ? ' scope="col"' : ''}><br></${tag}>`).join('')}</tr>`;
  const head = header ? `<thead>${row('th')}</thead>` : '';
  const bodyRows = header ? r - 1 : r;
  const body = Array.from({ length: Math.max(bodyRows, header ? 0 : 1) }, () => row('td')).join('');
  return `<table class="wx-vtable" data-visual-id="${escapeHtml(id)}" data-visual-kind="table">${head}${body ? `<tbody>${body}</tbody>` : ''}</table>`;
}

/** Başlık paragrafı: "Tablo <numara>. <başlık>"; numara düzenlenemez düğüm. */
export function captionHtml({ id, word, n, title = '', kind = 'table' }) {
  const rest = str(title).replace(/\s+/g, ' ').trim();
  return `<p class="wx-caption" data-caption-for="${escapeHtml(id)}">${escapeHtml(word)} <span data-seq="${escapeHtml(kind)}" data-seq-label="${escapeHtml(word)}" contenteditable="false">${Number(n) || 1}</span>.${rest ? ` ${escapeHtml(rest)}` : ' '}</p>`;
}

/** Izgara seçici etiketi için boyut: üzerine gelinen hücre (0 tabanlı) → sütun × satır. */
export function pickerSize(row, col) {
  return {
    rows: Math.max(1, Math.min(PICKER_ROWS, row + 1)),
    cols: Math.max(1, Math.min(PICKER_COLS, col + 1)),
  };
}
