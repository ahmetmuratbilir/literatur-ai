import {
  AlignmentType, Document, Footer, Header, HeadingLevel, Packer, PageNumber, Paragraph, Table, TableCell, TableRow,
  TextRun, WidthType, convertMillimetersToTwip,
} from 'docx';
import { saveAs } from 'file-saver';
import { pageGeometry } from './pageSetup.js';

// Belgedeki biçim .docx'e taşınır: başlık düzeyi, kalın/italik/altı çizili,
// hizalama, listeler ve sayfa ayarları. Metin modelden geçmez, olduğu gibi
// aktarılır.

const HEADINGS = { H1: HeadingLevel.HEADING_1, H2: HeadingLevel.HEADING_2, H3: HeadingLevel.HEADING_3 };
const ALIGN = { center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED };

/** Satır içi biçimi koruyarak metin parçalarına böler. */
/** "#ffee00" ya da "rgb(255, 238, 0)" → "FFEE00"; saydam/boş → null. */
function toHex(value) {
  const v = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.slice(1).toUpperCase();
  const m = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
  return [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function runsOf(node, inherited = {}) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    return text ? [new TextRun({ text, ...inherited })] : [];
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return [];

  const style = node.style || {};
  const tag = node.tagName;
  if (tag === 'BR') return [new TextRun({ break: 1 })];

  const decoration = String(style.textDecoration || '');
  const bold = Boolean(inherited.bold) || tag === 'B' || tag === 'STRONG'
    || style.fontWeight === 'bold' || Number(style.fontWeight) >= 600;
  const italics = Boolean(inherited.italics) || tag === 'I' || tag === 'EM' || style.fontStyle === 'italic';
  const underlined = Boolean(inherited.underline) || tag === 'U' || decoration.includes('underline');
  const strike = Boolean(inherited.strike) || tag === 'S' || tag === 'STRIKE' || tag === 'DEL'
    || decoration.includes('line-through');
  const superScript = tag === 'SUP' || inherited.superScript;
  const subScript = tag === 'SUB' || inherited.subScript;

  // docx'te altı çizili bir nesneyle verilir; false yerine alanı hiç koymuyoruz.
  const next = { ...inherited, bold, italics, strike };
  if (underlined) next.underline = {};
  if (superScript) next.superScript = true;
  if (subScript) next.subScript = true;
  // execCommand renkleri satır içi stille yazar; docx altı haneli hex ister.
  const color = style.color && /^#[0-9a-f]{6}$/i.test(style.color) ? style.color.slice(1) : inherited.color;
  if (color) next.color = color;
  // Vurgu (Daha fazla › Vurgula): arka plan rengi gölgelendirme olarak geçer.
  const bg = toHex(style.backgroundColor);
  if (bg) next.shading = { fill: bg };
  // Seçime uygulanan punto (WO-024): docx yarım punto ister. Eskiden satır içi
  // boyut dışa aktarımda kayboluyordu.
  const sizePt = /pt$/.test(String(style.fontSize || '')) ? parseFloat(style.fontSize) : NaN;
  if (sizePt > 0) next.size = Math.round(sizePt * 2);
  return [...node.childNodes].flatMap((child) => runsOf(child, next));
}

function paragraphOf(el, extra = {}) {
  const alignment = ALIGN[el.style?.textAlign];
  const children = runsOf(el);
  return new Paragraph({ children, alignment, ...extra });
}

/** Izgara tabloyu docx tablosuna çevirir; başlık satırı kalın kalır. */
function tableOf(el) {
  const rows = [...el.querySelectorAll('tr')].map((tr) => new TableRow({
    children: [...tr.children].map((cell) => new TableCell({
      children: [paragraphOf(cell)],
      shading: cell.tagName === 'TH' ? { fill: 'F1F5F9' } : undefined,
    })),
  }));
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

/** Belge gövdesindeki öğeleri docx paragraflarına çevirir. */
export function blocksToParagraphs(root) {
  const out = [];
  for (const el of root.children) {
    const tag = el.tagName;
    if (HEADINGS[tag]) {
      out.push(paragraphOf(el, { heading: HEADINGS[tag] }));
    } else if (tag === 'UL' || tag === 'OL') {
      for (const li of el.querySelectorAll(':scope > li')) {
        out.push(paragraphOf(li, tag === 'UL'
          ? { bullet: { level: 0 } }
          : { numbering: { reference: 'ws-numbering', level: 0 } }));
      }
    } else if (tag === 'TABLE') {
      out.push(tableOf(el));
      out.push(new Paragraph({ children: [] }));
    } else if (tag === 'BLOCKQUOTE') {
      out.push(paragraphOf(el, { indent: { left: convertMillimetersToTwip(10) } }));
    } else {
      out.push(paragraphOf(el));
    }
  }
  return out.length > 0 ? out : [new Paragraph({ children: [] })];
}

/**
 * @param pageLabel  sayfa numarası öneki ("Sayfa"); `setup.pageNumbers` kapalıysa numara yok
 */
export async function exportDocx({ root, setup, title, pageLabel = 'Sayfa' }) {
  const g = pageGeometry(setup);
  // Sayfa numarası ve üst bilgi (WO-011 Faz 2): ekrandaki Teslim önizlemesiyle aynı ayar.
  const footers = setup.pageNumbers === false ? undefined : {
    default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [`${pageLabel} `, PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES] })] })] }),
  };
  const headers = setup.header && title ? {
    default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, size: Math.max(16, (setup.fontSize - 2) * 2) })] })] }),
  } : undefined;
  const margin = convertMillimetersToTwip(g.margin);
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: setup.font, size: setup.fontSize * 2 } },
      },
    },
    numbering: {
      config: [{
        reference: 'ws-numbering',
        levels: [{ level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(g.width),
            height: convertMillimetersToTwip(g.height),
            orientation: setup.landscape ? 'landscape' : 'portrait',
          },
          margin: { top: margin, bottom: margin, left: margin, right: margin },
        },
      },
      headers,
      footers,
      children: blocksToParagraphs(root),
    }],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${(title || 'belge').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.docx`);
}
