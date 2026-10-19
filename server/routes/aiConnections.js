import express from 'express';
import {
  AI_PROVIDERS, activeConnection, invalidateConnection, publicView, saveConnection, testKey, validateKeyInput,
} from '../services/aiConnectionService.js';
import { openKey } from '../services/keyVault.js';

/**
 * Yapay zekâ bağlantıları uçları (WO-023). Anahtar hiçbir yanıtta, logda
 * ya da hata mesajında yer almaz; yanıt yalnız `publicView` alanlarıdır.
 *
 *   GET    /                 → { enabled, storage, providers, connections }
 *   POST   /                 { provider, key } → kaydet, dene, iyiyse etkin yap
 *   POST   /:provider/test   → kayıtlı anahtarı yeniden dene
 *   POST   /:provider/activate
 *   POST   /default          → hepsini kapat: Literatür AI anahtarları
 *   DELETE /:provider
 *
 * @param {{ getAuth: Function, getStore: () => object|null, enabled: boolean,
 *   limiter?: Function, fetchImpl?: Function, secret?: string }} deps
 */
export function createAiConnectionsRouter({ getAuth, getStore, enabled, limiter = (req, res, next) => next(), fetchImpl, secret }) {
  const router = express.Router();
  const userOf = (req) => getAuth(req)?.userId || null;

  router.use((req, res, next) => {
    req.aiUser = userOf(req);
    if (!req.aiUser) return res.status(401).json({ error: 'Lütfen giriş yapın' });
    return next();
  });

  const storeOr503 = (res) => {
    const store = enabled ? getStore() : null;
    if (!store) res.status(503).json({ error: 'Kendi anahtarını bağlama bu sunucuda kapalı.' });
    return store;
  };
  const list = async (store, userId) => (await store.list(userId)).map(publicView);

  router.get('/', async (req, res) => {
    const store = enabled ? getStore() : null;
    if (!store) return res.json({ enabled: false, storage: null, providers: AI_PROVIDERS, connections: [] });
    return res.json({ enabled: true, storage: store.kind, providers: AI_PROVIDERS, connections: await list(store, req.aiUser) });
  });

  router.post('/', limiter, async (req, res) => {
    const store = storeOr503(res);
    if (!store) return undefined;
    const { provider, key } = req.body || {};
    const problem = validateKeyInput(provider, key);
    if (problem) return res.status(400).json({ error: problem });
    const status = await testKey(provider, key.trim(), fetchImpl);
    await saveConnection(store, req.aiUser, provider, key, { status, secret });
    return res.json({ status, connections: await list(store, req.aiUser) });
  });

  router.post('/default', async (req, res) => {
    const store = storeOr503(res);
    if (!store) return undefined;
    await store.setActive(req.aiUser, null);
    invalidateConnection(req.aiUser);
    return res.json({ connections: await list(store, req.aiUser) });
  });

  router.post('/:provider/test', limiter, async (req, res) => {
    const store = storeOr503(res);
    if (!store) return undefined;
    const row = await store.get(req.aiUser, req.params.provider);
    if (!row) return res.status(404).json({ error: 'Bu sağlayıcı için kayıtlı anahtar yok.' });
    let status;
    try { status = await testKey(row.provider, openKey(row, secret), fetchImpl); } catch { status = 'error'; }
    await store.upsert(req.aiUser, row.provider, { lastStatus: status, lastCheckedAt: new Date() });
    invalidateConnection(req.aiUser);
    return res.json({ status, connections: await list(store, req.aiUser) });
  });

  router.post('/:provider/activate', async (req, res) => {
    const store = storeOr503(res);
    if (!store) return undefined;
    const row = await store.get(req.aiUser, req.params.provider);
    if (!row) return res.status(404).json({ error: 'Bu sağlayıcı için kayıtlı anahtar yok.' });
    await store.setActive(req.aiUser, row.provider);
    invalidateConnection(req.aiUser);
    return res.json({ connections: await list(store, req.aiUser) });
  });

  router.delete('/:provider', async (req, res) => {
    const store = storeOr503(res);
    if (!store) return undefined;
    await store.remove(req.aiUser, req.params.provider);
    invalidateConnection(req.aiUser);
    return res.json({ connections: await list(store, req.aiUser) });
  });

  return router;
}

/**
 * İstek bağlamı ara katmanı: giriş yapmış kullanıcının etkin bağlantısı
 * varsa istek o bağlamda çalışır (services/aiContext.js).
 */
export function aiContextMiddleware({ getAuth, getStore, enabled, runWithAiContext, secret }) {
  return async (req, res, next) => {
    if (!enabled || !req.path.startsWith('/api/') || req.path.startsWith('/api/ai-connections')) return next();
    const userId = getAuth(req)?.userId;
    const store = userId ? getStore() : null;
    if (!store) return next();
    let connection = null;
    try { connection = await activeConnection(store, userId, { secret }); } catch { connection = null; }
    if (!connection) return next();
    if (connection.unreadable) res.setHeader('X-AI-Key-Status', 'unreadable');
    const onFailure = (provider, kind) => {
      Promise.resolve(store.upsert(userId, provider, { lastStatus: kind, lastCheckedAt: new Date() }))
        .then(() => invalidateConnection(userId))
        .catch(() => {});
    };
    return runWithAiContext({ connection, res, onFailure }, next);
  };
}
