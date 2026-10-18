import { Router } from 'express';
import { ONBOARDING_OPTIONS, MAX_PURPOSES } from '../config/onboarding.js';

/**
 * İlk giriş tanışma soruları (WO-024).
 *
 *   GET  /  → { needed }      Sorulmalı mı? Veritabanı yoksa hayır: cevap
 *                              saklanamaz, her girişte yeniden sorulurdu.
 *   POST /  { role, purpose[], source? }  ya da  { skip: true }
 *
 * Bağımlılıklar dışarıdan gelir; testler veritabanı olmadan koşar.
 *
 * @param {{
 *   getUserId: (req, res) => string|null,   // 401'i kendisi yazar
 *   load: (userId) => Promise<object|null|undefined>,  // undefined = veritabanı yok
 *   store: (userId, onboarding) => Promise<boolean>,   // false = saklanamadı
 * }} deps
 */
export function createOnboardingRouter({ getUserId, load, store }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId) return;
    try {
      const profile = await load(userId);
      if (profile === undefined) return res.json({ needed: false });
      const o = profile?.onboarding;
      return res.json({ needed: !(o?.answeredAt || o?.skippedAt) });
    } catch {
      // Soru sormamak, yanlışlıkla iki kez sormaktan iyidir.
      return res.json({ needed: false });
    }
  });

  router.post('/', async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId) return;
    const body = req.body || {};
    let onboarding;
    if (body.skip === true) {
      onboarding = { skippedAt: new Date() };
    } else {
      const { role: roles, purpose: purposes, source: sources } = ONBOARDING_OPTIONS;
      const role = roles.includes(body.role) ? body.role : null;
      const purpose = Array.isArray(body.purpose)
        ? [...new Set(body.purpose.filter((p) => purposes.includes(p)))]
        : [];
      const source = sources.includes(body.source) ? body.source : undefined;
      if (!role) return res.status(400).json({ error: 'Mesleğinizi seçin.', field: 'role' });
      if (purpose.length === 0) return res.status(400).json({ error: 'En az bir kullanım amacı seçin.', field: 'purpose' });
      if (purpose.length > MAX_PURPOSES) return res.status(400).json({ error: `En fazla ${MAX_PURPOSES} amaç seçin.`, field: 'purpose' });
      onboarding = { role, purpose, ...(source ? { source } : {}), answeredAt: new Date() };
    }
    try {
      if (!(await store(userId, onboarding))) return res.status(503).json({ error: 'Cevaplar şu an kaydedilemedi.' });
      return res.json({ ok: true });
    } catch {
      return res.status(503).json({ error: 'Cevaplar şu an kaydedilemedi.' });
    }
  });

  return router;
}
