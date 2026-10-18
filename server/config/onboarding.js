/**
 * İlk girişte sorulan tanışma sorularının seçenekleri (WO-024).
 *
 * Yalnız sabit seçenekler saklanır, serbest metin yok: amaç ürünü kimin
 * kullandığını bilmek, kişisel veri toplamak değil. Sunucu bu listelerin
 * dışındaki değeri reddeder; istemcideki etiketler i18n sözlüğündedir
 * (`onboarding.<soru>.<değer>`).
 */
export const ONBOARDING_OPTIONS = Object.freeze({
  role: Object.freeze(['lisans', 'yuksek-lisans', 'doktora', 'akademisyen', 'arastirmaci', 'diger']),
  purpose: Object.freeze(['tez', 'makale', 'odev-proje', 'literatur-taramasi', 'proje-basvurusu', 'diger']),
  source: Object.freeze(['hoca-arkadas', 'universite', 'sosyal-medya', 'arama-motoru', 'etkinlik', 'diger']),
});

/** Amaç sorusunda en fazla kaç seçenek işaretlenebilir. */
export const MAX_PURPOSES = 3;
