// Görsel ara yapı (WO-016). Çizim motorundan bağımsız; sürümlü (tüzük 3.4):
// şema değişirse eski şekillerin anlamı değişir, sürüm bunu ayırt eder.
//
// Etiket hem konumuyla hem metniyle saklanır. Metin, oluşturma anında
// cümleden kesilen asıl biçimdir: tolerans kullanılsa da "etiket cümleden
// birebir" sözü bozulmaz, paragraf sonradan değişse de şekil kendi metniyle
// çizilir (canlı paragrafa bağlı değil).

import { splitSentences } from '../components/workspace/claimDetection.js';

export const VISUAL_SCHEMA_VERSION = 'visual-structure/1';

export const TEMPLATE_IDS = [
  'akis', 'dongu', 'hiyerarsi', 'balik', 'geri', 'kavram', 'arguman',
  'zaman', 'cubuk', 'pasta', 'karsi', 'dortlu',
];

export const ORIGIN = { rule: 'rule', model: 'model', user: 'user' };

/** Paragrafı cümlelere böler; konumlar paragrafa göredir. */
export function sentencesOf(text) {
  return splitSentences(text).map((s, i) => ({ i, text: s.text, start: s.start, end: s.end }));
}

/** Boş bir yapı. `source.hash` saf ve eşzamanlı olmadığı için `source.js` doldurur. */
export function createStructure({ text, lang = 'tr', paragraphKey = null, createdAt = null }) {
  return {
    schema: VISUAL_SCHEMA_VERSION,
    lang,
    source: { paragraphKey, text: String(text || ''), hash: null, createdAt, detached: false },
    sentences: sentencesOf(text),
    profile: null,
    nodes: [],
    edges: [],
    dropped: [],
    fit: [],
  };
}

/** `needle` cümlede `start`tan önce kaç kez geçiyor: aynı kelimenin kaçıncı geçişi. */
export function occurrenceAt(sentenceText, needle, start) {
  if (!needle) return null;
  let n = 0;
  let i = sentenceText.indexOf(needle);
  while (i !== -1 && i < start) {
    n += 1;
    i = sentenceText.indexOf(needle, i + 1);
  }
  return i === start ? n : null;
}

/** Konumdan parça bilgisi: metin kopyası ve geçiş sırası. */
export function spanOf(structure, sentence, start, end) {
  const s = structure.sentences[sentence];
  if (!s || start == null || end == null || start < 0 || end > s.text.length || start >= end) return null;
  const text = s.text.slice(start, end);
  return { sentence, start, end, text, occurrence: occurrenceAt(s.text, text, start) };
}

export function addNode(structure, { sentence, start, end, origin = ORIGIN.rule, role, value }) {
  const span = spanOf(structure, sentence, start, end);
  if (!span) return null;
  const node = { id: `n${structure.nodes.length + 1}`, ...span, origin };
  if (role) node.role = role;
  if (value) node.value = value;
  structure.nodes.push(node);
  return node;
}

/** Etiketsiz kenar için `start`/`end` null; metin de null kalır. */
export function addEdge(structure, { from, to, sentence, start = null, end = null, polarity = null, origin = ORIGIN.rule }) {
  const span = start == null ? { sentence, start: null, end: null, text: null, occurrence: null } : spanOf(structure, sentence, start, end);
  if (!span) return null;
  const edge = { id: `e${structure.edges.length + 1}`, from, to, ...span, polarity, origin };
  structure.edges.push(edge);
  return edge;
}

/**
 * Çizim ve dışa aktarmanın tek metin kaynağı: elle düzenlenmişse o, değilse
 * oluşturma anındaki kopya. Canlı paragrafı okumaz.
 */
export function labelOf(item) {
  if (!item) return null;
  return item.userText != null ? item.userText : item.text;
}
