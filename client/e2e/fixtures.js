/**
 * Sahte sunucu: e2e testleri gerçek API'ye gitmez. Her test kendi durumunu
 * alır; sepet, geçmiş ve favoriler bellekte tutulur ve istek geldikçe değişir.
 */
export const API = 'http://localhost:3000';

export const PAPERS = [
  {
    title: 'Passive decay heat removal in integral test facilities',
    authors: 'Chen, Li, Wang, Hui',
    year: 2021,
    doi: '10.1016/j.nucengdes.2021.110950',
    url: 'https://doi.org/10.1016/j.nucengdes.2021.110950',
    publicationName: 'Nuclear Engineering and Design',
    description: 'Passive decay heat removal was maintained for 72 hours without AC power in the integral test facility, and the natural circulation loop sustained core cooling.',
    citedBy: 12,
    scores: { total: 0.82 },
  },
  {
    title: 'Natural circulation stability in small modular reactors',
    authors: 'Kaya, Zeynep',
    year: 2020,
    doi: '10.9999/e2e-2',
    url: 'https://doi.org/10.9999/e2e-2',
    publicationName: 'Annals of Nuclear Energy',
    description: 'Flow instabilities were observed at pressures below 1 MPa.',
    citedBy: 4,
    scores: { total: 0.71 },
  },
];

export const SEARCH_RESULT = {
  results: PAPERS,
  totalFound: 2,
  analyzedCount: 2,
  methodology: {},
  features: {},
  relevance: { level: 'ok', dropped: 0 },
};

export async function mockApi(page, overrides = {}) {
  const state = {
    basket: [],
    history: [
      { _id: 'h1', mainTopic: 'pasif soğutma', keywords: [], createdAt: '2026-10-10T10:00:00Z' },
      { _id: 'h2', mainTopic: '', authorId: 'A123', authorName: 'Ayşe Yılmaz', createdAt: '2026-10-09T10:00:00Z' },
    ],
    collections: [{ _id: 'c1', name: 'Favoriler', papers: [{ _id: 'f1', title: 'Favori makale', url: 'https://example.org/f1', year: 2019 }] }],
    analyses: [{ _id: 'a1', topic: 'SMR güvenliği', explanation: 'Kayıtlı arama stratejisi', queries: [] }],
    searches: [],
    deletedHistory: [],
    deletedFavorites: [],
    ...overrides,
  };

  await page.route(`${API}/api/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/basket' && method === 'GET') return json({ papers: state.basket, limit: 30 });
    if (path === '/api/basket' && method === 'POST') {
      const paper = { ...(req.postDataJSON()?.paper || {}), _id: `b${state.basket.length + 1}` };
      state.basket.push(paper);
      return json({ papers: state.basket, limit: 30 });
    }
    if (path.startsWith('/api/basket/papers/') && method === 'DELETE') {
      const id = path.split('/').pop();
      state.basket = state.basket.filter((p) => p._id !== id);
      return json({ papers: state.basket, limit: 30 });
    }
    if (path === '/api/basket' && method === 'DELETE') {
      state.basket = [];
      return json({ papers: [], limit: 30 });
    }
    if (path === '/api/history' && method === 'GET') return json(state.history);
    if (path.startsWith('/api/history/entry/') && method === 'DELETE') {
      const id = path.split('/').pop();
      state.deletedHistory.push(id);
      state.history = state.history.filter((h) => h._id !== id);
      return json({ ok: true });
    }
    if (path === '/api/collections' && method === 'GET') return json(state.collections);
    if (path.startsWith('/api/collections/') && method === 'DELETE') {
      const id = path.split('/').pop();
      state.deletedFavorites.push(id);
      state.collections = state.collections.map((c) => ({ ...c, papers: c.papers.filter((p) => p._id !== id) }));
      return json({ ok: true });
    }
    if (path === '/api/analyses' && method === 'GET') return json(state.analyses);
    if (path === '/api/search') {
      state.searches.push(url.searchParams.get('mainTopic'));
      return json(SEARCH_RESULT);
    }
    if (path === '/api/retractions') {
      state.retractionCalls = (state.retractionCalls || 0) + 1;
      return json({ results: state.retractions || {} });
    }
    if (path === '/api/bibliography') return json({ format: 'APA 7', entries: [] });
    if (path.startsWith('/api/share/')) return json({ results: PAPERS, mainTopic: 'paylaşılan konu' });
    return json({});
  });
  return state;
}

/** Yazım belgesini yerel depolamaya hazır koyar (Workspace.jsx anahtarı). */
export async function seedDraft(page, html, title = 'E2E taslağı') {
  await page.addInitScript(([h, tt]) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    localStorage.setItem('literatur-ai:workspace:v2', JSON.stringify({ html: h, title: tt, savedAt: Date.now() }));
  }, [html, title]);
}
