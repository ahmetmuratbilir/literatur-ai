/**
 * Kullaniciya acik AHP siralama profilleri ve ozel agirliklarin dogrulanmasi.
 *
 * Profil agirliklari plan dokumanindaki tablodan (Veri Katmani Onay Dosyasi,
 * Gorev 3) birebir alindi; her satirin toplami 1.000. "Dengeli" profil elle
 * yazilmadi: ikili karsilastirma matrisinden turetilen varsayilan agirliklardir.
 *
 * Iki profil bilerek KAPALI ve sebebi arayuzde yazili gosterilir:
 *  - turkce:  DergiPark hasadi yok; agirlik degistirmek Turkce kaynak getirmez.
 *  - tesvik:  kalite kriterine %42 veriyor ama tesvik olcutleri icin gereken
 *             indeks verisi (SCI/SSCI/AHCI, Scopus, ESCI, TR Dizin) yok.
 *             OpenAlex `listed_in` alani incelendi: bu indeksleri icermiyor.
 * Calismayan bir profili aktif gostermek akademisyene yanlis bilgiyle karar
 * verdirir.
 */
import { CRITERIA } from './ahpMatrix.js';
import { DEFAULT_WEIGHTS } from './ahp.js';
import { msg, DEFAULT_LANG } from './serverI18n.js';

/**
 * Tek bir kriterin alabilecegi en yuksek pay. Kullanici tek kriteri %90'a
 * cektiginde liste o kriterin siralamasina donusur ve anlamsizlasir.
 */
export const MAX_CRITERION_WEIGHT = 0.5;

export const PROFILES = {
  dengeli: {
    weights: { ...DEFAULT_WEIGHTS },
    available: true,
  },
  guncel: {
    weights: { citation: 0.10, keyword: 0.20, quality: 0.15, similarity: 0.12, recency: 0.33, reliability: 0.07, oa: 0.03 },
    available: true,
  },
  atif: {
    weights: { citation: 0.40, keyword: 0.18, quality: 0.17, similarity: 0.08, recency: 0.04, reliability: 0.10, oa: 0.03 },
    available: true,
  },
  acik_erisim: {
    weights: { citation: 0.15, keyword: 0.18, quality: 0.14, similarity: 0.10, recency: 0.08, reliability: 0.10, oa: 0.25 },
    available: true,
  },
  turkce: {
    weights: { citation: 0.12, keyword: 0.26, quality: 0.16, similarity: 0.16, recency: 0.12, reliability: 0.13, oa: 0.05 },
    available: false,
  },
  tesvik: {
    weights: { citation: 0.18, keyword: 0.15, quality: 0.42, similarity: 0.08, recency: 0.05, reliability: 0.10, oa: 0.02 },
    available: false,
  },
};

export const DEFAULT_PROFILE_ID = 'dengeli';

/** Arayuze gonderilecek profil listesi (agirliklar dahil, seffaflik icin). */
export function listProfiles(lang = DEFAULT_LANG) {
  return Object.entries(PROFILES).map(([id, p]) => ({
    id,
    label: msg(lang, `profiles.${id}.label`),
    description: msg(lang, `profiles.${id}.description`),
    weights: p.weights,
    available: p.available,
    unavailableReason: p.available ? null : msg(lang, `profiles.${id}.unavailableReason`),
  }));
}

/**
 * Ust siniri asan kriterlerin fazlasini digerlerine ORANTILI dagitir.
 * Tek geciste yeni bir kriter siniri asabilecegi icin tekrarlanir.
 */
function capWeights(weights, cap) {
  const w = { ...weights };
  for (let pass = 0; pass < CRITERIA.length; pass++) {
    const over = CRITERIA.filter((c) => w[c] > cap + 1e-12);
    if (over.length === 0) break;

    let excess = 0;
    for (const c of over) {
      excess += w[c] - cap;
      w[c] = cap;
    }
    const receivers = CRITERIA.filter((c) => w[c] < cap - 1e-12);
    const base = receivers.reduce((sum, c) => sum + w[c], 0);
    for (const c of receivers) {
      // Hepsi 0 ise esit dagit; aksi halde mevcut paylarla orantili.
      w[c] += base > 0 ? excess * (w[c] / base) : excess / receivers.length;
    }
  }
  return w;
}

/**
 * Istekteki profil/agirlik girdisini kullanilacak agirliklara cevirir.
 *
 * Gecersiz girdide hata FIRLATMAZ, varsayilana doner ve nedenini `warnings`
 * icinde soyler: yanlis bir parametre aramayi dusurmemeli ama sessizce de
 * yutulmamali.
 *
 * @param {{profileId?: string, weights?: object|null}} input
 * @returns {{weights: object, profileId: string|null, source: 'profile'|'custom'|'default', warnings: string[]}}
 */
export function resolveRankingWeights({ profileId, weights, lang = DEFAULT_LANG } = {}) {
  const warnings = [];

  if (weights && typeof weights === 'object') {
    const unknown = Object.keys(weights).filter((k) => !CRITERIA.includes(k));
    if (unknown.length) warnings.push(msg(lang, 'warnings.unknownCriteria', { list: unknown.join(', ') }));

    const raw = {};
    let sum = 0;
    for (const c of CRITERIA) {
      const value = Number(weights[c]);
      // Gonderilmeyen kriter 0 degil, varsayilan payini alir: kaydiricilarin
      // bir kismini gonderen eski bir istemci listeyi bozmamali.
      raw[c] = Number.isFinite(value) && value >= 0 ? value : DEFAULT_WEIGHTS[c];
      sum += raw[c];
    }

    if (sum > 0) {
      const normalized = Object.fromEntries(CRITERIA.map((c) => [c, raw[c] / sum]));
      const capped = capWeights(normalized, MAX_CRITERION_WEIGHT);
      const hitCap = CRITERIA.filter((c) => normalized[c] > MAX_CRITERION_WEIGHT + 1e-9);
      if (hitCap.length) {
        warnings.push(msg(lang, 'warnings.capped', { max: MAX_CRITERION_WEIGHT * 100, list: hitCap.join(', ') }));
      }
      return { weights: capped, profileId: null, source: 'custom', warnings };
    }
    warnings.push(msg(lang, 'warnings.allZero'));
  }

  if (profileId) {
    const profile = PROFILES[profileId];
    if (!profile) {
      warnings.push(msg(lang, 'warnings.noSuchProfile', { id: profileId }));
    } else if (!profile.available) {
      warnings.push(msg(lang, 'warnings.profileUnavailable', { label: msg(lang, `profiles.${profileId}.label`), reason: msg(lang, `profiles.${profileId}.unavailableReason`) }));
    } else {
      return { weights: { ...profile.weights }, profileId, source: 'profile', warnings };
    }
  }

  return { weights: { ...DEFAULT_WEIGHTS }, profileId: DEFAULT_PROFILE_ID, source: 'default', warnings };
}

/**
 * Sorgu dizesindeki `weights` parametresini (JSON) guvenle ayristirir.
 * Bozuk girdi null doner; resolveRankingWeights varsayilana duser.
 */
export function parseWeightsParam(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
