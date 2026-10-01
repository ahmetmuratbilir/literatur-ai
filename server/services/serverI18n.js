/**
 * Sunucunun kullanıcıya dönük metinleri (TR / EN).
 *
 * İstemci arayüz dilini `Accept-Language` başlığıyla gönderiyor
 * (client/src/i18n/context.js → applyLang). Profil adları, sıralama
 * uyarıları ve ikili karşılaştırma açıklamaları bu dile göre üretilir;
 * aksi halde İngilizce arayüzde Türkçe metinler görünürdü.
 *
 * Varsayılan İngilizce (ürün kararı). Yalnızca "tr" ile başlayan başlık Türkçe.
 */
export const DEFAULT_LANG = 'en';

export function getLang(req) {
  const header = String(req?.headers?.['accept-language'] || '').trim().toLowerCase();
  return header.startsWith('tr') ? 'tr' : DEFAULT_LANG;
}

const fill = (template, vars = {}) => template.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));

export const MESSAGES = {
  en: {
    profiles: {
      dengeli: { label: 'Balanced', description: 'Citations, topic match and publication quality weighted equally' },
      guncel: { label: 'Recent research', description: 'Recently published work comes first' },
      atif: { label: 'Most cited', description: 'The field’s foundational, widely used papers' },
      acik_erisim: { label: 'Open access first', description: 'Papers whose full text you can read for free' },
      turkce: {
        label: 'Include Turkish sources',
        description: 'DergiPark articles come first',
        unavailableReason: 'DergiPark is not connected yet; this profile cannot return Turkish articles for now.',
      },
      tesvik: {
        label: 'Promotion / incentive',
        description: 'Papers in indexed journals come first',
        unavailableReason: 'Journal index data (SCI/SSCI/AHCI, Scopus, ESCI, TR Dizin) is not available yet; this profile could mislead.',
      },
    },
    warnings: {
      unknownCriteria: 'Ignored unknown criteria: {list}',
      capped: 'A single criterion can weigh at most {max}%; {list} was capped and the excess spread over the others.',
      allZero: 'All weights were zero; the default was used.',
      noSuchProfile: 'There is no profile called "{id}"; the default was used.',
      profileUnavailable: '"{label}" is not available right now: {reason}',
      badWeightsParam: 'The weights parameter could not be read (invalid JSON); the default was used.',
    },
    criteria: {
      citation: 'citation impact', keyword: 'topic match', quality: 'publication quality',
      similarity: 'title similarity', recency: 'recency', reliability: 'reliability', oa: 'open access',
    },
    degree: { equal: 'equally', slight: 'slightly more', clear: 'clearly more', strong: 'much more', extreme: 'absolutely more' },
    judgment: {
      equal: '{a} and {b} are equally important',
      more: '{a} is {degree} important than {b}',
    },
    pairwise: {
      conflict: 'You said "{judgment}"; your other answers suggest "{implied}".',
      conflictNoImplied: 'You said "{judgment}"; this is the answer that conflicts most with your others.',
      fix: 'Change this answer to "{judgment}".',
      fixPartial: 'One change is not enough. The most helpful one: "{judgment}". Then review your other answers.',
      needOne: 'Answer at least one comparison.',
      disconnected: 'Some criteria are not connected to the others, so their relative importance is unknown.',
      badMode: 'mode must be "ratings" or "pairwise".',
    },
    ratingsNote: 'In slider mode the weights come from a single importance ranking, which is consistent by construction, so the consistency ratio measures nothing.',
    oa: {
      notConfigured: 'Free PDF lookup is not configured.',
      quota: 'Daily limit reached; try again tomorrow.',
      invalidDoi: 'Not a valid DOI.',
      failed: 'Unpaywall did not respond.',
    },
  },
  tr: {
    profiles: {
      dengeli: { label: 'Dengeli', description: 'Atıf, konu uyumu ve yayın kalitesi eşit ağırlıkta' },
      guncel: { label: 'Güncel araştırmalar', description: 'Son yıllarda yayımlanan çalışmalar öne çıkar' },
      atif: { label: 'En çok atıf alanlar', description: 'Alanın temel ve çok kullanılan çalışmaları' },
      acik_erisim: { label: 'Açık erişim öncelikli', description: 'Tam metnine ücretsiz ulaşabileceğin makaleler' },
      turkce: {
        label: 'Türkçe kaynaklar dahil',
        description: 'DergiPark makaleleri öne çıkar',
        unavailableReason: 'DergiPark kaynağı henüz eklenmedi; bu profil şu an Türkçe makale getiremez.',
      },
      tesvik: {
        label: 'Teşvik / terfi',
        description: 'İndeksli dergilerdeki yayınlar öne çıkar',
        unavailableReason: 'Dergi indeks bilgisi (SCI/SSCI/AHCI, Scopus, ESCI, TR Dizin) henüz yok; bu profil yanlış yönlendirebilir.',
      },
    },
    warnings: {
      unknownCriteria: 'Bilinmeyen kriter yok sayıldı: {list}',
      capped: 'Tek bir kriter en fazla %{max} olabilir; {list} sınırlandı ve fazlası diğerlerine dağıtıldı.',
      allZero: 'Tüm ağırlıklar sıfır; varsayılan kullanıldı.',
      noSuchProfile: '"{id}" diye bir profil yok; varsayılan kullanıldı.',
      profileUnavailable: '"{label}" profili şu an kullanılamıyor: {reason}',
      badWeightsParam: 'weights parametresi okunamadı (geçerli JSON değil); varsayılan kullanıldı.',
    },
    criteria: {
      citation: 'atıf yoğunluğu', keyword: 'konu uyumu', quality: 'yayın kalitesi',
      similarity: 'başlık benzerliği', recency: 'güncellik', reliability: 'güvenilirlik', oa: 'açık erişim',
    },
    degree: { equal: 'eşit derecede', slight: 'biraz daha', clear: 'belirgin şekilde daha', strong: 'çok daha', extreme: 'kesinlikle daha' },
    judgment: {
      equal: '{a} ile {b} eşit önemde',
      more: '{a}, {b} kriterinden {degree} önemli',
    },
    pairwise: {
      conflict: '"{judgment}" dedin; diğer cevapların ise "{implied}" olduğunu gösteriyor.',
      conflictNoImplied: '"{judgment}" dedin; bu yanıt diğer cevaplarınla en çok çelişen yanıt.',
      fix: 'Bu yanıtı "{judgment}" olarak değiştir.',
      fixPartial: 'Tek bir değişiklik yetmiyor. En çok yardımcı olan: "{judgment}". Sonra kalan yanıtları gözden geçir.',
      needOne: 'En az bir karşılaştırma yanıtlanmalı.',
      disconnected: 'Bazı kriterler diğerlerine bağlanmadı; aralarındaki önem ilişkisi belirlenemiyor.',
      badMode: 'mode "ratings" veya "pairwise" olmalı.',
    },
    ratingsNote: 'Kaydırıcı modunda ağırlıklar tek bir önem sıralamasından üretilir; bu yapı tanım gereği tutarlıdır, tutarlılık oranı bir şey ölçmez.',
    oa: {
      notConfigured: 'Ücretsiz PDF araması yapılandırılmadı.',
      quota: 'Günlük sınır doldu, yarın tekrar deneyin.',
      invalidDoi: 'Geçerli bir DOI değil.',
      failed: 'Unpaywall yanıt vermedi.',
    },
  },
};

/** `msg('tr', 'warnings.capped', {max: 50})` */
export function msg(lang, key, vars) {
  const dict = MESSAGES[lang] || MESSAGES[DEFAULT_LANG];
  const value = key.split('.').reduce((node, part) => node?.[part], dict)
    ?? key.split('.').reduce((node, part) => node?.[part], MESSAGES[DEFAULT_LANG]);
  return typeof value === 'string' ? fill(value, vars) : value;
}
