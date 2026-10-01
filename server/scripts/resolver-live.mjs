#!/usr/bin/env node
/**
 * Makale çözümleyici — canlı kabul testleri (gerçek API'ler).
 *   node scripts/resolver-live.mjs          # hepsi
 *   node scripts/resolver-live.mjs 3 5      # yalnız 3 ve 5
 * Önbellek yalnızca bellekte (veritabanına yazmaz). Kapsam dışı: #8'in
 * GitHub/HF beklentisi (ilk sürümde o katman yok; yalnız makale bulunur).
 */
import dotenv from 'dotenv';
import { createResolver } from '../services/resolver/pipeline.js';
import { createCache } from '../services/resolver/cache.js';

dotenv.config({ quiet: true });

const CASES = [
  { n: 1, input: 'Luozzo, S. D. (2023). On the relationship between human factor and overall equipment effectiveness (OEE): An analysis through the adoption of analytic hierarchy process and ISO 22400. International Journal of Engineering Business Management.',
    expect: { status: 'found', doi: '10.1177/18479790231188548', discrepancies: ['surname_spelling', 'missing_coauthors'] } },
  { n: 2, input: 'Koç, B. (2025). Achieving sustainable Overall Equipment Effectiveness (OEE) in apparel industry with lean and digital integration. Engineering Reports.',
    expect: { status: 'found', doi: '10.1002/eng2.70162', discrepancies: ['missing_coauthors', 'volume', 'issue'] } },
  { n: 3, input: 'Thiede 2023 advanced energy data analytics predict OEE', expect: { status: 'found', doi: '10.1016/j.procir.2023.02.074' } },
  { n: 4, input: 'https://www.sciencedirect.com/science/article/pii/S2212827123000641', expect: { status: 'found', doi: '10.1016/j.procir.2023.02.074' } },
  { n: 5, input: 'https://onlinelibrary.wiley.com/doi/full/10.1002/eng2.70162', expect: { status: 'found', doi: '10.1002/eng2.70162', noSearch: true } },
  { n: 6, input: '10.38124/ijisrt/ijisrt24jun909', expect: { status: 'found', doi: '10.38124/ijisrt/ijisrt24jun909' } },
  { n: 7, input: 'Ramitsa Indrawati 2025 mesin centrifugal OEE Six Big Losses TPM', expect: { status: 'found', doi: '10.33508/wt.v24i2.7406' } },
  { n: 8, input: 'https://arxiv.org/abs/1706.03762', expect: { status: 'found', title: /attention is all you need/i } },
  { n: 9, input: 'OEE insan faktörü AHP makalesi', expect: { status: 'candidates' } },
  { n: 10, input: 'Kuantum tavuk yetiştiriciliğinde blokzincir tabanlı OEE optimizasyonu 2024', expect: { status: 'not_found' } },
  { n: 11, input: null, repeatOf: 1, expect: { cached: true } },
];

const only = process.argv.slice(2).map(Number).filter(Boolean);
const resolver = createResolver({ cache: createCache({ dbReady: () => false }) });
const SEARCH_SOURCES = new Set(['crossref-search', 's2', 'europepmc', 'openalex-search']);

let pass = 0;
let fail = 0;
for (const c of CASES) {
  if (only.length && !only.includes(c.n)) continue;
  const input = c.input ?? CASES.find((x) => x.n === c.repeatOf).input;
  const t0 = Date.now();
  const r = await resolver.resolve(input);
  const ms = Date.now() - t0;
  const doi = r.match?.doi || r.candidates?.[0]?.doi || null;
  const notes = (r.discrepancies || []).map((d) => (['volume', 'issue', 'pages'].includes(d.field) ? d.field : d.note));
  const problems = [];
  const e = c.expect;
  if (e.status && r.status !== e.status) problems.push(`status ${r.status} != ${e.status}`);
  if (e.doi && doi !== e.doi) problems.push(`doi ${doi} != ${e.doi}`);
  if (e.title && !e.title.test(r.match?.title || '')) problems.push(`title ${r.match?.title}`);
  for (const d of e.discrepancies || []) if (!notes.includes(d)) problems.push(`eksik fark: ${d}`);
  if (e.noSearch && r.trace.some((t) => t.layer === 1)) problems.push('arama yapildi');
  if (e.cached && !r.cached) problems.push('onbellekten gelmedi');
  if (e.cached && r.trace.length) problems.push(`dis cagri: ${r.trace.length}`);
  if (r.status === 'not_found' && (r.match || r.candidates.length)) problems.push('not_found ama kayit var');
  problems.length ? fail++ : pass++;

  console.log(`\n#${c.n} ${problems.length ? 'KALDI' : 'GECTI'}  ${r.status}  conf=${r.confidence}  ${ms} ms  $${r.cost_usd}${r.cached ? '  (onbellek)' : ''}`);
  console.log(`   girdi: ${input.slice(0, 90)}`);
  if (r.match) console.log(`   eslesme: ${r.match.doi} | ${r.match.title.slice(0, 70)} | ${r.match.authors.map((a) => a.family).join(', ')} | ${r.match.year} | ${r.match.venue || '-'} ${r.match.volume || ''}${r.match.issue ? `(${r.match.issue})` : ''} ${r.match.pages || ''}`);
  if (r.match) console.log(`   oa: ${r.match.oa_pdf_url || '-'} | doaj: ${r.match.in_doaj} | geri cekilme: ${r.match.retraction_status}`);
  if (r.match?.apa7) console.log(`   APA: ${r.match.apa7}`);
  for (const cand of r.candidates || []) console.log(`   aday ${cand.score}: ${cand.doi} | ${String(cand.title).slice(0, 70)}`);
  for (const d of r.discrepancies || []) console.log(`   fark [${d.field}/${d.note}]: "${d.input}" -> "${d.canonical}"${d.missing ? ` (eksik: ${d.missing.join(', ')})` : ''}`);
  console.log(`   iz: ${r.trace.map((t) => `L${t.layer}:${t.source}:${t.status}${t.http ? `(${t.http})` : ''}:${t.ms}ms${t.cost_usd ? `:$${t.cost_usd}` : ''}`).join('  ')}`);
  if (problems.length) console.log(`   SORUN: ${problems.join(' | ')}`);
}
console.log(`\nSonuc: ${pass} gecti, ${fail} kaldi`);
process.exitCode = fail ? 1 : 0;
