/**
 * Kaynak başına hız sınırı: istekler arası en az aralık + eşzamanlılık.
 * Belgelenmiş sınırlar (1 Eki 2026'da görev tanımından; kaynak değişirse
 * buradan güncellenir):
 *   Crossref polite: tekil 10/sn, liste 3/sn, eşzamanlı 3
 *   Semantic Scholar (anahtarla): 1/sn
 *   arXiv: 3 sn'de 1, tek bağlantı
 *   OpenAlex: 100/sn (günlük bütçe ayrıca izlenir)
 *   Europe PMC: ~10/sn
 */
export const LIMITS = {
  crossref: { minIntervalMs: 110, concurrency: 3 },
  'crossref-list': { minIntervalMs: 340, concurrency: 3 },
  openalex: { minIntervalMs: 20, concurrency: 5 },
  s2: { minIntervalMs: 1050, concurrency: 1 },
  arxiv: { minIntervalMs: 3100, concurrency: 1 },
  europepmc: { minIntervalMs: 110, concurrency: 3 },
  doiorg: { minIntervalMs: 110, concurrency: 3 },
  web: { minIntervalMs: 200, concurrency: 3 },
  wayback: { minIntervalMs: 500, concurrency: 1 },
  unpaywall: { minIntervalMs: 110, concurrency: 3 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createLimiter(limits = LIMITS, { now = () => Date.now(), wait = sleep } = {}) {
  const state = new Map();
  const get = (key) => {
    if (!state.has(key)) state.set(key, { active: 0, nextStart: 0, queue: [] });
    return state.get(key);
  };

  const pump = (key) => {
    const s = get(key);
    const cfg = limits[key] || { minIntervalMs: 0, concurrency: 4 };
    while (s.active < cfg.concurrency && s.queue.length) {
      const job = s.queue.shift();
      s.active++;
      const start = Math.max(now(), s.nextStart);
      s.nextStart = start + cfg.minIntervalMs;
      (async () => {
        const delay = start - now();
        if (delay > 0) await wait(delay);
        try { job.resolve(await job.fn()); } catch (e) { job.reject(e); } finally { s.active--; pump(key); }
      })();
    }
  };

  /** fn'i kaynağın sınırları içinde çalıştırır. */
  return function schedule(key, fn) {
    return new Promise((resolve, reject) => {
      get(key).queue.push({ fn, resolve, reject });
      pump(key);
    });
  };
}

/** 429/503'te Retry-After (sn) ya da üstel geri çekilme; en fazla `retries` yeniden deneme. */
export async function withRetry(fn, { retries = 3, baseMs = 800, wait = sleep } = {}) {
  let attempt = 0;
  for (;;) {
    const res = await fn();
    const status = res?.status;
    if ((status !== 429 && status !== 503) || attempt >= retries) return res;
    const header = Number.parseFloat(res.headers?.get?.('retry-after'));
    const delay = Number.isFinite(header) ? Math.min(header * 1000, 20000) : baseMs * 2 ** attempt;
    attempt++;
    await wait(delay);
  }
}
