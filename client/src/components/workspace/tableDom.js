/**
 * Belgedeki tablonun yapı işlemleri (WO-025). Hepsi verilen tablo öğesini
 * yerinde değiştirir; Workspace bunları tablonun KOPYASI üzerinde çalıştırır ve
 * sonucu `execCommand('insertHTML')` ile yerine koyar: böylece her işlem
 * tarayıcının kendi geri al yığınına girer (Ctrl+Z; ölçüldü 19.10.2026).
 *
 * Hücre içeriği taşınır, yeniden yazılmaz: kalın/italik/atıf korunur.
 * Birleştirilmiş hücre (colspan/rowspan) desteklenmez; tablo dikdörtgen sayılır.
 */

const newCell = (doc, tag, align) => {
  const cell = doc.createElement(tag);
  if (tag === 'TH' || tag === 'th') cell.setAttribute('scope', 'col');
  if (align && align !== 'left' && align !== 'start') cell.style.textAlign = align;
  cell.innerHTML = '<br>';
  return cell;
};

/** Hücre etiketini değiştirir (th ↔ td); içerik ve hiza taşınır. */
function retag(cell, tag) {
  if (cell.tagName === tag.toUpperCase()) return cell;
  const next = cell.ownerDocument.createElement(tag);
  while (cell.firstChild) next.appendChild(cell.firstChild);
  if (cell.style.textAlign) next.style.textAlign = cell.style.textAlign;
  if (tag === 'th') next.setAttribute('scope', 'col');
  cell.replaceWith(next);
  return next;
}

const sectionOf = (row) => row.parentElement;
const isHeadRow = (row) => sectionOf(row)?.tagName === 'THEAD';

function ensureBody(table) {
  let body = table.tBodies[0];
  if (!body) {
    body = table.ownerDocument.createElement('tbody');
    table.appendChild(body);
  }
  return body;
}

/** Bir sütunun hizası: o sütundaki ilk hizalı hücreden. */
function columnAlign(table, col) {
  for (const row of table.rows) {
    const a = row.cells[col]?.style.textAlign;
    if (a) return a;
  }
  return '';
}

export const tableShape = (table) => ({
  rows: table.rows.length,
  cols: Math.max(0, ...[...table.rows].map((r) => r.cells.length)),
  header: Boolean(table.tHead && table.tHead.rows.length),
});

/** Yeni satır: `where` 'above' | 'below'. Başlık satırının üstüne/altına eklenen satır gövdeye girer. */
export function insertRow(table, rowIndex, where) {
  const ref = table.rows[rowIndex];
  if (!ref) return rowIndex;
  const { cols } = tableShape(table);
  const doc = table.ownerDocument;
  const row = doc.createElement('tr');
  for (let c = 0; c < cols; c += 1) row.appendChild(newCell(doc, 'td', columnAlign(table, c)));
  if (isHeadRow(ref)) {
    const body = ensureBody(table);
    body.insertBefore(row, body.firstChild);
  } else if (where === 'above') {
    ref.before(row);
  } else {
    ref.after(row);
  }
  return row.rowIndex;
}

/** Yeni sütun: `where` 'left' | 'right'. Başlık satırında th, gövdede td. */
export function insertCol(table, colIndex, where) {
  const doc = table.ownerDocument;
  const at = where === 'left' ? colIndex : colIndex + 1;
  for (const row of table.rows) {
    const cell = newCell(doc, isHeadRow(row) ? 'th' : 'td', '');
    const ref = row.cells[at];
    if (ref) ref.before(cell);
    else row.appendChild(cell);
  }
  return at;
}

/** Satırı siler. Son satırsa false döner: tablo silinmeli. */
export function deleteRow(table, rowIndex) {
  if (table.rows.length <= 1) return false;
  const row = table.rows[rowIndex];
  if (!row) return true;
  const section = sectionOf(row);
  row.remove();
  if (section && section.rows.length === 0 && section.tagName !== 'TABLE') section.remove();
  return true;
}

/** Sütunu siler. Son sütunsa false döner: tablo silinmeli. */
export function deleteCol(table, colIndex) {
  if (tableShape(table).cols <= 1) return false;
  for (const row of table.rows) row.cells[colIndex]?.remove();
  return true;
}

/** Satırı aynı bölüm (başlık/gövde) içinde bir yukarı/aşağı taşır. Yeni satır sırasını döner. */
export function moveRow(table, rowIndex, dir) {
  const row = table.rows[rowIndex];
  if (!row) return rowIndex;
  const sibling = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
  if (!sibling) return rowIndex;
  if (dir < 0) sibling.before(row);
  else sibling.after(row);
  return row.rowIndex;
}

/** Başlık satırını açar/kapar: ilk satır th'li <thead>'e taşınır ya da gövdeye döner. */
export function setHeaderRow(table, on) {
  const doc = table.ownerDocument;
  if (on) {
    if (table.tHead?.rows.length) return;
    const first = table.rows[0];
    if (!first) return;
    const head = table.tHead || table.createTHead();
    head.appendChild(first);
    [...first.cells].forEach((cell) => retag(cell, 'th'));
    const body = table.tBodies[0];
    if (body && !body.rows.length) body.remove();
  } else {
    const head = table.tHead;
    if (!head) return;
    const body = ensureBody(table);
    [...head.rows].reverse().forEach((row) => {
      [...row.cells].forEach((cell) => retag(cell, 'td'));
      body.insertBefore(row, body.firstChild);
    });
    head.remove();
    if (!table.querySelector('tr')) body.appendChild(doc.createElement('tr'));
  }
}

/** Sütun hizası: 'left' | 'center' | 'right' (DOCX çevirici satır içi stilden okur). */
export function setColumnAlign(table, colIndex, align) {
  for (const row of table.rows) {
    const cell = row.cells[colIndex];
    if (!cell) continue;
    cell.style.textAlign = align === 'left' ? '' : align;
    if (!cell.getAttribute('style')) cell.removeAttribute('style');
  }
}

/** İmlecin hücresi: { table, cell, row, col } ya da null. */
export function cellAt(node, root) {
  let current = node?.nodeType === 1 ? node : node?.parentElement;
  while (current && current !== root) {
    if (current.tagName === 'TD' || current.tagName === 'TH') {
      const table = current.closest('table');
      if (!table || table.parentElement !== root) return null;
      return { table, cell: current, row: current.parentElement.rowIndex, col: current.cellIndex };
    }
    current = current.parentElement;
  }
  return null;
}
