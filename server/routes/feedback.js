import { Router } from 'express';

/** Geri bildirim türleri; istemcideki etiketler `help.kind.<tür>` anahtarında. */
export const FEEDBACK_KINDS = Object.freeze(['oneri', 'hata', 'soru', 'diger']);
export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 2000;

const line = (value, max) => (typeof value === 'string' ? value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max) : '');

/**
 * Yardım ve destek penceresindeki geri bildirim formu (WO-024).
 *
 * Fuar formuyla (/api/leads) aynı ilke: önce kaydet, sonra e-posta dene;
 * ikisinden biri başarılıysa geri bildirim alınmıştır. İkisi de olmazsa 503
 * ve kullanıcıya doğrudan yazabileceği adres söylenir.
 *
 * E-posta adresi istek gövdesinden alınmaz, kimlik sağlayıcısından gelir;
 * kullanıcı "bana dönüş yapabilirsiniz" demediyse e-postaya hiç konmaz.
 *
 * @param {{
 *   getUserId: (req, res) => string|null,
 *   lookupUser: (userId) => Promise<{ email?: string, name?: string }>,
 *   save: (doc) => Promise<object|null>,           // null = veritabanı yok
 *   sendEmail: (payload) => Promise<{ simulated?: boolean }|object>,
 *   markEmailed?: (savedDoc) => Promise<void>,
 *   limiter?: Function,
 * }} deps
 */
export function createFeedbackRouter({ getUserId, lookupUser, save, sendEmail, markEmailed, limiter = (req, res, next) => next() }) {
  const router = Router();

  router.post('/', limiter, async (req, res) => {
    const userId = getUserId(req, res);
    if (!userId) return;
    const body = req.body || {};
    const kind = FEEDBACK_KINDS.includes(body.kind) ? body.kind : null;
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const page = line(body.page, 80);
    const contactOk = body.contactOk === true;

    if (!kind) return res.status(400).json({ error: 'Geri bildirim türünü seçin.', field: 'kind' });
    if (message.length < FEEDBACK_MIN) return res.status(400).json({ error: `En az ${FEEDBACK_MIN} karakter yazın.`, field: 'message' });
    if (message.length > FEEDBACK_MAX) return res.status(400).json({ error: `En fazla ${FEEDBACK_MAX} karakter yazın.`, field: 'message' });

    let who = {};
    try { who = (await lookupUser(userId)) || {}; } catch { /* kimlik bilgisi olmadan da iletilir */ }
    const email = contactOk && typeof who.email === 'string' && who.email.includes('@') ? who.email : '';
    const doc = { userId, kind, message, page, contactOk, email, name: line(who.name, 100), userAgent: line(req.get('user-agent'), 200) };

    let saved = null;
    try { saved = await save(doc); } catch (error) { console.error('Feedback save error:', error?.message || error); }

    let emailed = false;
    try {
      const result = await sendEmail(doc);
      emailed = Boolean(result) && !result.simulated;
    } catch (error) { console.error('Feedback email error:', error?.message || error); }
    if (saved && emailed && markEmailed) await markEmailed(saved).catch(() => {});

    if (!saved && !emailed) {
      return res.status(503).json({ error: 'Geri bildirim şu an iletilemedi. info@literatur-ai.com adresine doğrudan yazabilirsiniz.' });
    }
    return res.json({ ok: true, saved: Boolean(saved), emailed });
  });

  return router;
}
