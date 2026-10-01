/**
 * Kaynak başına devre kesici.
 *
 * NEDEN: Semantic Scholar'ın ortak kotası doluyken her arama 2 kez yeniden
 * deniyor (1 + 2 sn) ve yine başarısız oluyordu; ölçülen arama süresi bu
 * yüzden ~3 sn uzuyordu. CORE anahtarı geçersizken her aramada 401 alıyordu.
 * Kesici açıkken kaynak çağrılmaz; süre dolunca TEK bir deneme isteğine izin
 * verilir (yarı açık), başarısızsa yeniden açılır.
 *
 *   QUOTA (429)             → 10 dk
 *   CREDENTIAL_ACCESS (401) → 60 dk (anahtar düzeltilene kadar boşuna istek)
 *   TIMEOUT                 → art arda 3 kez olursa 2 dk
 *   ERROR                   → atlama yok (geçici ağ hatası olabilir)
 */
export const COOLDOWN_MS = {
  QUOTA: 10 * 60 * 1000,
  CREDENTIAL_ACCESS: 60 * 60 * 1000,
  TIMEOUT: 2 * 60 * 1000,
};
export const TIMEOUTS_TO_OPEN = 3;

export function createBreaker({ now = () => Date.now() } = {}) {
  const state = new Map();
  const get = (source) => {
    if (!state.has(source)) state.set(source, { openUntil: 0, reason: null, timeouts: 0, probing: false });
    return state.get(source);
  };

  return {
    /** Kaynak şimdi atlanmalı mı? Süre dolduysa tek deneme isteğine izin verir. */
    check(source) {
      const s = get(source);
      if (!s.openUntil) return { skip: false };
      if (now() < s.openUntil) return { skip: true, reason: s.reason, retryAt: s.openUntil };
      if (s.probing) return { skip: true, reason: s.reason, retryAt: s.openUntil };
      s.probing = true; // yarı açık: bu istek deneme
      return { skip: false, probe: true };
    },
    /** Sonucu kaydeder. `type`: classifySourceError çıktısı; başarıda null. */
    record(source, type) {
      const s = get(source);
      s.probing = false;
      if (!type) { state.set(source, { openUntil: 0, reason: null, timeouts: 0, probing: false }); return; }
      if (type === 'TIMEOUT') {
        s.timeouts += 1;
        if (s.timeouts < TIMEOUTS_TO_OPEN) return;
      }
      const cooldown = COOLDOWN_MS[type];
      if (!cooldown) return;
      s.openUntil = now() + cooldown;
      s.reason = type;
      s.timeouts = 0;
    },
    snapshot() {
      return Object.fromEntries([...state.entries()]
        .filter(([, s]) => s.openUntil)
        .map(([k, s]) => [k, { reason: s.reason, until: new Date(s.openUntil).toISOString(), open: now() < s.openUntil }]));
    },
  };
}

/** Uygulama genelinde tek kesici (arama hattı ve yönetici paneli). */
export const sourceBreaker = createBreaker();
