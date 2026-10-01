/**
 * Kaynak esik testi (canary).
 *
 * NEDEN VAR: keyHealthService onceki surumde her kaynak icin ELLE YAZILMIS bir
 * URL'yi yokluyordu. OpenCitations'ta o URL
 *   /index/coci/api/v1/citation-count/10.1038/...   (oneksiz -> HTTP 200)
 * iken uretim kodu
 *   /index/coci/api/v1/citation-count/doi:10.1038/... (onekli -> HTTP 400)
 * cagiriyordu. Panel yesil, uretim kirik ve kimse gormedi.
 *
 * Bu modul elle URL yazmaz: URETIM fonksiyonlarini cagirir. Panel ile uretim
 * ayni kodu paylasmazsa panelin hicbir sey kanitlamaz.
 *
 * IKINCI SORUN: eski classify() `if (result.ok) return 'ok'` diyordu, yani
 * HTTP 200 + `total: 0` saglikli sayiliyordu. DOAJ'in sessiz sifiri tam olarak
 * buradan kacti. Bu yuzden her kaynak icin bir ASGARI BEKLENEN SONUC SAYISI
 * tanimlanir ve altina dusuldugunde durum `ok` degil `zero_results` olur.
 * "Cevap geldi" ile "dogru cevap geldi" ayri sorular.
 */
import { buildSourceQueries } from './sourceQuery.js';
import { searchOpenAlex } from './openalex.js';
import { searchCrossref } from './crossref.js';
import { searchDOAJ } from './doaj.js';
import { searchArXiv } from './arxiv.js';
import { searchSemanticScholar } from './semanticscholar.js';
import { searchCore } from './core.js';
import { searchEuropePMC } from './europepmc.js';
import { enrichWithCitations, resetOpenCitationsCache } from './opencitations.js';
import { searchOpenAIRE } from './openaire.js';
import { searchDataCite } from './datacite.js';
import { findOpenAccessCopy, isUnpaywallConfigured } from './unpaywall.js';

/**
 * Sonucu bilinen sorgu. Ingilizce ve genis bir konu secildi: hicbir kaynakta
 * sifir donmemesi gerekir. Cevirisi yok, boylece test ceviri servisine bagli
 * olmaz ve `sourceQuery` cevirici katmanini da gercekten egzersiz eder.
 */
const CANARY_TOPIC = 'nuclear reactor safety';

const CANARY_PLAN = {
  phrases: [{ original: CANARY_TOPIC, translated: null }],
  terms: CANARY_TOPIC.split(' '),
  authorName: null,
};

/**
 * AI analizinin urettigi turden bir BOOLEAN sorgu. Ayri yoklanir cunku bu yol
 * M0'dan sonra sessizce bozuldu (sorgu tek tirnakli diziye donusuyordu; DOAJ
 * 791 -> 0, OpenAlex -> 0) ve duz konu yoklamasi bunu gormedi.
 */
const CANARY_AI_PLAN = {
  phrases: [{ original: '("nuclear reactor" OR "fission reactor") AND safety', boolean: true }],
};

/** Atif sayisi yuksek, kalici bir kayit. OpenCitations dogrulamasi icin. */
const CANARY_DOI = '10.1038/nature12373';

/**
 * Asgari beklenen sonuc sayilari. 30 Eyl 2026 olcumlerinin cok altinda
 * tutuldu; amac "kaynak calisiyor mu" sorusuna cevap vermek, sonuc sayisini
 * sabitlemek degil. Kaynak gercekten bozulmadan alarm uretmemeli.
 *
 * Olculen degerler (havuz): OpenAlex 144.686 · Crossref ~2.1M · DOAJ 68
 * · arXiv 9 · OpenCitations 1806 atif
 */
export const MIN_EXPECTED = {
  OpenAlex: 5,
  Crossref: 5,
  DOAJ: 3,
  arXiv: 2,
  'Semantic Scholar': 1,
  CORE: 1,
  OpenCitations: 1,
  'Europe PMC': 3,
  OpenAIRE: 3,
  DataCite: 1,
  Unpaywall: 1,
  'OpenAlex (AI sorgusu)': 5,
  'DOAJ (AI sorgusu)': 3,
};

const COUNT = 10;

/**
 * Bir HTTP/aktarim hatasini duruma indirger.
 * @returns {{state: string, detail: string}}
 */
function classifyError(error) {
  const status = error?.response?.status ?? null;
  const message = String(error?.message || error || '');

  if (status === 401 || status === 403 || /\b401\b|\b403\b|unauthorized|not valid|apikey/i.test(message)) {
    return { state: 'invalid_key', detail: `anahtar reddedildi${status ? ` (HTTP ${status})` : ''}` };
  }
  if (status === 429 || status === 406 || /\b429\b|\b406\b|kota|quota|rate limit/i.test(message)) {
    return { state: 'quota', detail: `kota/hiz siniri${status ? ` (HTTP ${status})` : ''} — anahtar gecerli olabilir` };
  }
  if (/timeout|ABORT|ECONNRESET|ENOTFOUND|EAI_AGAIN|zaman asimi/i.test(message) || error?.name === 'AbortError') {
    return { state: 'unreachable', detail: message.slice(0, 90) };
  }
  return { state: 'error', detail: message.slice(0, 90) };
}

/**
 * Tek bir kaynagi yoklar.
 * @param {string} service
 * @param {() => Promise<{results: Array, totalFound?: number}>} run
 */
async function probeSource(service, run) {
  const startedAt = Date.now();
  try {
    const value = await run();
    const ms = Date.now() - startedAt;

    if (value?.skipped) {
      return { service, state: 'skipped', detail: 'ozellik bayragi kapali', ms, count: 0 };
    }

    const count = Array.isArray(value?.results) ? value.results.length : 0;
    const pool = value?.totalFound ?? null;
    const floor = MIN_EXPECTED[service] ?? 1;

    if (count < floor) {
      // ISTEK BASARILI, SONUC YOK. Eski kod bunu 'ok' sayiyordu.
      return {
        service,
        state: 'zero_results',
        detail: `istek basarili ama ${count} sonuc dondu (en az ${floor} beklenir, havuz: ${pool ?? '?'})`,
        ms,
        count,
      };
    }

    return {
      service,
      state: 'ok',
      detail: `${count} sonuc${pool != null ? ` / havuz ${Number(pool).toLocaleString('tr-TR')}` : ''}`,
      ms,
      count,
    };
  } catch (error) {
    const { state, detail } = classifyError(error);
    return { service, state, detail, ms: Date.now() - startedAt, count: 0 };
  }
}

/**
 * Sekiz akademik kaynagi uretim fonksiyonlariyla yoklar.
 *
 * Kaynaklar SIRAYLA cagrilir, paralel degil: arXiv 3 saniyede 1 istek ve
 * Semantic Scholar'in anahtarsiz ortak havuzu es zamanli isteklerde daha sik
 * 429 veriyor. Yoklama hizli olmak zorunda degil, dogru olmak zorunda.
 *
 * @returns {Promise<Array<{service, state, detail, ms, count}>>}
 */
export async function probeAcademicSources() {
  const sq = buildSourceQueries(CANARY_PLAN);
  const params = { mainTopic: CANARY_TOPIC, authorName: null, keywords: [], count: COUNT };
  const rows = [];

  rows.push(await probeSource('OpenAlex', () => searchOpenAlex(CANARY_TOPIC, params, sq.openAlex)));
  rows.push(await probeSource('Crossref', () => searchCrossref(sq.crossref, COUNT)));
  rows.push(await probeSource('DOAJ', () => searchDOAJ(sq.doaj, COUNT)));
  rows.push(await probeSource('arXiv', () => searchArXiv(sq.arxiv, COUNT, { fielded: true })));
  rows.push(await probeSource('Semantic Scholar', () => searchSemanticScholar(sq.semanticScholar, COUNT)));
  rows.push(await probeSource('CORE', () => searchCore(CANARY_TOPIC, params, sq.openAlex)));
  rows.push(await probeSource('Europe PMC', () => searchEuropePMC(sq.openAlex, COUNT)));
  rows.push(await probeSource('OpenAIRE', () => searchOpenAIRE(sq.crossref, COUNT)));
  rows.push(await probeSource('DataCite', () => searchDataCite(sq.crossref, COUNT)));

  const aiSq = buildSourceQueries(CANARY_AI_PLAN);
  rows.push(await probeSource('OpenAlex (AI sorgusu)', () => searchOpenAlex('', params, aiSq.openAlex)));
  rows.push(await probeSource('DOAJ (AI sorgusu)', () => searchDOAJ(aiSq.doaj, COUNT)));

  // OpenCitations bir arama kaynagi degil, zenginlestirme katmani. Uretimdeki
  // cagri sekli budur; `citedBy: 0` sarti modulun kendi filtresinden geliyor.
  rows.push(
    await probeSource('OpenCitations', async () => {
      // Onbellek yoklamayi agdan gecmeden 'saglikli' gosterirdi.
      resetOpenCitationsCache();
      const sample = [{ doi: CANARY_DOI, citedBy: 0, title: 'canary' }];
      const enriched = await enrichWithCitations(sample);
      const verified = enriched.filter((r) => r.openCitationVerified);
      return { results: verified, totalFound: verified[0]?.citationCount ?? 0 };
    })
  );

  // Unpaywall: arama kaynagi degil; bir DOI'nin acik erisim kopyasi soruluyor.
  // 1 Eki 2026'da API baglantiyi kabul edip 20 sn yanit vermedi; yoklama bunu gormeli.
  if (isUnpaywallConfigured()) {
    rows.push(
      await probeSource('Unpaywall', async () => {
        const r = await findOpenAccessCopy(CANARY_DOI);
        if (r.status === 'error' || r.status === 'quota') throw new Error(r.message || r.status);
        return { results: r.status === 'ok' ? [r.result] : [], totalFound: r.status === 'ok' ? 1 : 0 };
      })
    );
  }

  return rows;
}
