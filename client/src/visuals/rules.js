// Kural kademesi (WO-016): yapısı metinde açık olan altı kalıp. Model yok.
// Serbest düzyazıdan düğüm çıkarmaz; kalıp tutmazsa bunu açıkça söyler
// (`rule: null`), boş şema üretmez.
//
// Her düğüm cümleden kesilen bir parçadır (schema.addNode): kelime ekleme,
// özetleme yok. Belirsiz kalıplar (ayraçsız "X a ve b'ye bağlıdır" gibi)
// bilerek alınmaz; sonucun nerede bitip nedenlerin nerede başladığını
// noktalama olmadan güvenle bulmak mümkün değil — model kademesine kalır.

import { CITATION, classifySentence, MARK, fold } from '../components/workspace/claimDetection.js';
import { addEdge, addNode, createStructure } from './schema.js';
import { profileOf, sentenceSignals } from './signals.js';

export const RULES = ['R1', 'R2', 'R3', 'R6', 'R4', 'R5']; // deneme sırası

const norm = (s, lang) => (lang === 'tr' ? fold(s) : s.toLowerCase());

/** Paragraf konumunu (mutlak) cümle + cümle içi konuma çevirir; iki cümleye taşarsa null. */
function toSentence(structure, a, b) {
  for (const s of structure.sentences) {
    if (a >= s.start && b <= s.end) return { sentence: s.i, start: a - s.start, end: b - s.start };
  }
  return null;
}

/** Baş ve sondaki boşluk, noktalama ve bağlacı atarak [a, b) aralığını daraltır. */
function trimRange(text, a, b, lang) {
  const tail = lang === 'tr' ? /(?:[\s,;:.]+|\s+(?:ve|ile|veya))$/i : /(?:[\s,;:.]+|\s+(?:and|or))$/i;
  const head = lang === 'tr' ? /^(?:[\s,;:]+|(?:ve|ile|veya)\s+)/i : /^(?:[\s,;:]+|(?:and|or)\s+)/i;
  let s = text.slice(a, b);
  for (;;) {
    const lead = s.match(head);
    if (lead) { a += lead[0].length; s = s.slice(lead[0].length); continue; }
    const t = s.match(tail);
    if (t && t[0].length < s.length) { b -= t[0].length; s = s.slice(0, -t[0].length); continue; }
    break;
  }
  return [a, b];
}

/** Cümlenin sonundaki noktalamayı ve atıf işaretini dışarıda bırakan aralık. */
function sentenceBody(text) {
  let end = text.length;
  const cite = text.match(CITATION);
  if (cite) end = Math.min(end, cite.index);
  const trimmed = text.slice(0, end).replace(/[\s.!?…,;:]+$/u, '');
  const start = text.length - text.trimStart().length;
  return [start, Math.max(start, trimmed.length)];
}

// ---------- R1: numaralı ya da madde işaretli liste ----------

function r1(st, lang) {
  const text = st.source.text;
  const markers = [...text.matchAll(/(?:^|[\s:;])\(?(\d{1,2})\)\s+/g)].map((m) => ({
    n: Number(m[1]), at: m.index + m[0].length, from: m.index + m[0].search(/\(?\d/),
  }));
  let items = [];
  if (markers.length >= 2 && markers.every((m, i) => m.n === i + 1)) {
    items = markers.map((m, i) => [m.at, i + 1 < markers.length ? markers[i + 1].from : text.length]);
  } else {
    const bullets = [...text.matchAll(/^[ \t]*[-•*][ \t]+(.+)$/gm)];
    if (bullets.length >= 2) items = bullets.map((m) => [m.index + m[0].indexOf(m[1]), m.index + m[0].length]);
  }
  if (items.length < 2) return false;

  const firstFrom = markers.length >= 2 ? markers[0].from : text.search(/^[ \t]*[-•*][ \t]/m);
  const intro = text.slice(0, firstFrom);
  const classify = sentenceSignals(intro, lang).classify === 1;

  let root = null;
  if (classify && intro.trim()) {
    const [a, b] = trimRange(text, 0, firstFrom, lang);
    const pos = toSentence(st, a, b);
    if (pos) root = addNode(st, pos);
  }
  const nodes = [];
  for (const [a0, b0] of items) {
    const [a, b] = trimRange(text, a0, b0, lang);
    const pos = toSentence(st, a, b);
    if (!pos) { st.dropped.push({ kind: 'node', reason: 'crosses_sentence', detail: text.slice(a, b) }); continue; }
    nodes.push(addNode(st, pos));
  }
  if (nodes.length < 2) return false;
  if (root) nodes.forEach((n) => addEdge(st, { from: root.id, to: n.id, sentence: n.sentence }));
  else nodes.slice(1).forEach((n, i) => addEdge(st, { from: nodes[i].id, to: n.id, sentence: n.sentence }));
  st.layoutHint = root ? 'tree' : 'chain';
  return true;
}

// ---------- R2: sıra işaretli cümle zinciri ----------

const ORDER_START = {
  tr: /^(ilk olarak|ilk once|once|ardindan|daha sonra|sonra|son olarak|nihayet)\b[\s,]*/,
  en: /^(first(?:ly)?|then|next|subsequently|finally|lastly|second(?:ly)?)\b[\s,]*/,
};

function r2(st, lang) {
  let run = [];
  let best = [];
  for (const s of st.sentences) {
    const lead = s.text.length - s.text.trimStart().length;
    const m = norm(s.text.trimStart(), lang).match(ORDER_START[lang]);
    if (m) run.push({ s, from: lead + m[0].length });
    else { if (run.length > best.length) best = run; run = []; }
  }
  if (run.length > best.length) best = run;
  if (best.length < 3) return false;
  const nodes = best.map(({ s, from }) => {
    const [, end] = sentenceBody(s.text);
    return addNode(st, { sentence: s.i, start: from, end });
  }).filter(Boolean);
  nodes.slice(1).forEach((n, i) => addEdge(st, { from: nodes[i].id, to: n.id, sentence: n.sentence }));
  st.layoutHint = 'chain';
  return nodes.length >= 3;
}

// ---------- R3: neden / etken listesi (yalnız ayraçlı biçimler) ----------

/** "a, b ve c" listesini parçalara böler; konumlar `base`e göre. */
function splitList(text, base, end, lang) {
  const sep = lang === 'tr' ? /,\s*|\s+ve\s+|\s+ile\s+|\s+veya\s+/g : /,\s*(?:and\s+)?|\s+and\s+|\s+or\s+/g;
  const part = text.slice(base, end);
  const out = [];
  let last = 0;
  for (const m of part.matchAll(sep)) { out.push([base + last, base + m.index]); last = m.index + m[0].length; }
  out.push([base + last, end]);
  return out.filter(([a, b]) => b > a);
}

// Türkçe yönelme eki listenin son öğesinden ayrılır ("geometriye" → "geometri",
// "eksikliğine" → "eksikliği"): parça yine cümleden birebir kesilir, yalnız ek
// dışarıda kalır. Kaynaştırma harfi y (ünlüden sonra) ya da n (iyelikten sonra).
function stripDative(text, a, b) {
  const m = text.slice(a, b).match(/['’]?(?:[yn][ae]|[ae])$/);
  return m && b - m[0].length - a >= 3 ? b - m[0].length : b;
}

function r3(st, lang) {
  for (const s of st.sentences) {
    const t = s.text;
    const f = norm(t, lang);
    let effect = null;
    let list = null;
    if (lang === 'tr') {
      // "X'in nedenleri/etkenleri (şunlardır): a, b ve c"
      let m = f.match(/^(\s*)(.+?)(?:['’]?n?[iu]n)?\s+(?:nedenleri|etkenleri|sebepleri)(?:\s+sunlardir)?\s*:\s*/);
      if (m) { effect = [m[1].length, m[1].length + m[2].length]; list = [m[0].length, sentenceBody(t)[1]]; }
      // "X; a, b ve c'ye bağlıdır" ya da "X: a, b ve c'ye bağlıdır"
      if (!m) {
        m = f.match(/^(\s*)([^;:]+?)\s*[;:]\s*(.+?)\s+bagli(?:dir)?\b/);
        if (m) {
          effect = [m[1].length, m[1].length + m[2].length];
          const listStart = f.indexOf(m[3], m[1].length + m[2].length);
          list = [listStart, listStart + m[3].length];
        }
      }
    } else {
      let m = f.match(/^(\s*)(?:the\s+)?(?:main\s+)?(?:causes|factors)\s+of\s+(.+?)\s+(?:are|include)\s*:?\s*/);
      if (m) {
        const es = f.indexOf(m[2], m[1].length);
        effect = [es, es + m[2].length];
        list = [m[0].length, sentenceBody(t)[1]];
      } else {
        m = f.match(/^(\s*)(.+?)\s+depends?\s+on\s+/);
        if (m) { effect = [m[1].length, m[1].length + m[2].length]; list = [m[0].length, sentenceBody(t)[1]]; }
      }
    }
    if (!effect || !list) continue;
    const parts = splitList(t, list[0], list[1], lang);
    if (parts.length < 2) continue;
    const target = addNode(st, { sentence: s.i, start: effect[0], end: effect[1] });
    if (!target) continue;
    parts.forEach(([a0, b0], k) => {
      let [a, b] = trimRange(t, a0, b0, lang);
      if (lang === 'tr' && k === parts.length - 1) b = stripDative(t, a, b);
      const n = addNode(st, { sentence: s.i, start: a, end: b });
      if (n) addEdge(st, { from: n.id, to: target.id, sentence: s.i });
    });
    st.layoutHint = 'fan-in';
    return st.edges.length >= 2;
  }
  return false;
}

// ---------- R4: yıllar ----------

const YEAR = /\b(1[5-9]|20)\d{2}\b/;

function r4(st) {
  const hits = [];
  for (const s of st.sentences) {
    const noCite = s.text.replace(new RegExp(CITATION.source, 'g'), (x) => ' '.repeat(x.length));
    const m = noCite.match(YEAR);
    if (m) hits.push({ s, year: Number(m[0]) });
  }
  if (hits.length < 2) return false;
  for (const { s, year } of hits) {
    const [a, b] = sentenceBody(s.text);
    addNode(st, { sentence: s.i, start: a, end: b, value: { year } });
  }
  st.layoutHint = 'timeline';
  return true;
}

// ---------- R5: argüman ----------

const CONTRAST_START = {
  tr: /^(ancak|buna karsin|bununla birlikte|oysa|halbuki|fakat|ne var ki)\b/,
  en: /^(however|nevertheless|in contrast|yet|but)\b/,
};

function r5(st, lang, marks) {
  const roles = [];
  for (const s of st.sentences) {
    const lead = norm(s.text.trimStart(), lang);
    const mark = (marks && marks[s.i]) || classifySentence(s.text).mark;
    const contrast = lead.match(CONTRAST_START[lang]);
    let role = null;
    if (contrast) role = 'limitation';
    else if (mark === MARK.cited) role = 'premise';
    else if (mark === MARK.uncited) role = 'claim';
    roles.push({ s, role, contrast });
  }
  if (!roles.some((r) => r.role === 'claim')) return false;
  if (!roles.some((r) => r.role === 'premise' || r.role === 'limitation')) return false;

  const nodes = [];
  for (const { s, role } of roles) {
    if (!role) continue;
    const [a, b] = sentenceBody(s.text);
    const n = addNode(st, { sentence: s.i, start: a, end: b, role });
    if (n) {
      n.citations = (s.text.match(new RegExp(CITATION.source, 'g')) || []);
      nodes.push(n);
    }
  }
  // Metinde açık bağ yalnız karşıtlık: sınırlılık cümlesi kendinden önceki iddiaya bağlanır.
  for (const r of roles) {
    if (r.role !== 'limitation') continue;
    const lim = nodes.find((n) => n.sentence === r.s.i);
    const claim = [...nodes].reverse().find((n) => n.role === 'claim' && n.sentence < r.s.i);
    if (!lim || !claim) continue;
    const lead = r.s.text.length - r.s.text.trimStart().length;
    addEdge(st, { from: lim.id, to: claim.id, sentence: r.s.i, start: lead, end: lead + r.contrast[0].length });
  }
  st.layoutHint = 'argument';
  return true;
}

// ---------- R6: sayılar ----------

// "%" harf değildir: ardından \b aranırsa "42%," eşleşmez. Bu yüzden % ayrı dalda.
const NUM = /(%\s?)(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s?(%|(?:kg|g|m|cm|mm|km|s|sn|dk|saat|°C|K|MW|kW|W|Pa|kPa|MPa|bar)\b)/gu;

function r6(st, lang) {
  const found = [];
  for (const s of st.sentences) {
    const clauses = [...s.text.matchAll(lang === 'tr' ? /[^,;]+?(?=,|;| ve |$)/g : /[^,;]+?(?=,|;| and |$)/g)];
    for (const c of clauses) {
      const nums = [...c[0].matchAll(NUM)];
      if (nums.length !== 1) continue;
      const n = nums[0];
      const value = Number((n[2] || n[3]).replace(',', '.'));
      const unit = n[1] ? '%' : n[4];
      const [a, b] = trimRange(s.text, c.index, c.index + c[0].length, lang);
      found.push({ s, a, b, value, unit });
    }
  }
  const byUnit = {};
  for (const f of found) (byUnit[f.unit] = byUnit[f.unit] || []).push(f);
  const best = Object.values(byUnit).sort((x, y) => y.length - x.length)[0];
  if (!best || best.length < 2) return false;
  for (const f of best) addNode(st, { sentence: f.s.i, start: f.a, end: f.b, value: { number: f.value, unit: f.unit } });
  st.layoutHint = 'values';
  return true;
}

const RUN = { R1: r1, R2: r2, R3: r3, R4: r4, R5: r5, R6: r6 };

/**
 * @param {{text:string, lang?:'tr'|'en', paragraphKey?:string, marks?:Record<number,string>}} input
 *   marks: kullanıcının cümle işaretleri (iddia / iddia değil); yoksa claimDetection.
 * @returns {{structure, rule: string|null, reason: string|null}}
 */
export function structureFromRules({ text, lang = 'tr', paragraphKey = null, marks = null }) {
  for (const id of RULES) {
    const st = createStructure({ text, lang, paragraphKey });
    st.profile = profileOf(st.sentences, lang);
    if (RUN[id](st, lang, marks) && st.nodes.length >= 2) {
      st.rule = id;
      return { structure: st, rule: id, reason: null };
    }
  }
  const st = createStructure({ text, lang, paragraphKey });
  st.profile = profileOf(st.sentences, lang);
  st.rule = null;
  return { structure: st, rule: null, reason: 'rules.none' };
}
