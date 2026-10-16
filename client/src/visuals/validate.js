// Doğrulama (WO-016): ara yapının tutarlılığını sınar, onarır, attığını
// sayar (2.8: eksik sessizce gizlenmez). Kural kademesinin ve ileride model
// kademesinin (WO-C) çıktısı buradan geçmeden çizilmez.
//
// Model öğeyi yalnız metinle verirse (konumsuz), yeri matchSpan ile bulunur
// ve etiket cümledeki ASIL biçime çevrilir. Bulunamayan öğe atılır.

import { occurrenceAt } from './schema.js';
import { matchSpan } from './match.js';
import { sentenceSignals } from './signals.js';

function locate(structure, item, kind, dropped) {
  const s = structure.sentences[item.sentence];
  if (!s) { dropped.push({ kind, reason: 'not_in_sentence', detail: item.id }); return null; }
  if (item.start == null && item.text) {
    const m = matchSpan(s.text, item.text, structure.lang);
    if (!m) { dropped.push({ kind, reason: 'not_in_sentence', detail: item.text }); return null; }
    const text = s.text.slice(m.start, m.end);
    return { ...item, start: m.start, end: m.end, text, occurrence: occurrenceAt(s.text, text, m.start), matchMode: m.mode };
  }
  if (item.start == null) return { ...item };
  const ok = item.start >= 0 && item.end <= s.text.length && item.start < item.end
    && s.text.slice(item.start, item.end) === item.text;
  if (!ok) { dropped.push({ kind, reason: 'not_in_sentence', detail: item.text ?? item.id }); return null; }
  return { ...item };
}

/** @returns yeni bir yapı (girdi değişmez); `dropped` atılanları gerekçesiyle taşır. */
export function validate(structure) {
  const dropped = [...(structure.dropped || [])];
  const nodes = [];
  const seen = new Map(); // konum anahtarı → ilk düğüm kimliği
  const alias = new Map(); // yinelenen kimlik → asıl kimlik
  for (const n of structure.nodes) {
    const v = locate(structure, n, 'node', dropped);
    if (!v) continue;
    const key = `${v.sentence}:${v.start}:${v.end}`;
    if (seen.has(key)) { alias.set(v.id, seen.get(key)); dropped.push({ kind: 'node', reason: 'duplicate', detail: v.text }); continue; }
    seen.set(key, v.id);
    nodes.push(v);
  }
  const ids = new Set(nodes.map((n) => n.id));

  const edges = [];
  for (const e of structure.edges) {
    const from = alias.get(e.from) || e.from;
    const to = alias.get(e.to) || e.to;
    if (!ids.has(from) || !ids.has(to) || from === to) {
      dropped.push({ kind: 'edge', reason: 'dangling', detail: e.id });
      continue;
    }
    const v = locate(structure, { ...e, from, to }, 'edge', dropped);
    if (!v) continue;
    // Kutup işareti yalnız kenarın cümlesinde yön fiili varsa kalır: +/− uydurulmaz.
    if (v.polarity) {
      const s = structure.sentences[v.sentence];
      if (!s || sentenceSignals(s.text, structure.lang).direction === 0) {
        dropped.push({ kind: 'polarity', reason: 'unsupported_polarity', detail: v.id });
        v.polarity = null;
      }
    }
    edges.push(v);
  }
  return { ...structure, nodes, edges, dropped };
}
