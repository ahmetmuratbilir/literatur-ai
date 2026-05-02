import translate from 'google-translate-api-x';
import { withTimeout } from './http.js';

const TRANSLATE_TIMEOUT_MS = 5000;

/**
 * Metni İngilizce'den Türkçe'ye çevirir.
 * @param {string} text - Çevrilecek metin
 * @returns {Promise<string>} Türkçe çeviri veya orijinal metin (hata durumunda)
 */
export async function translateToTurkish(text) {
  if (!text || typeof text !== 'string' || text.length < 5) return text;
  
  try {
    const result = await withTimeout(
      translate(text, { from: 'en', to: 'tr' }),
      TRANSLATE_TIMEOUT_MS,
      `Translate timeout after ${TRANSLATE_TIMEOUT_MS}ms`
    );
    return result?.text || text;
  } catch (error) {
    console.warn('Translation to Turkish failed:', error.message);
    return text;
  }
}

/**
 * Birden fazla makalenin teaser'ını paralel olarak Türkçe'ye çevirir.
 * @param {Array} items - Makale listesi
 * @returns {Promise<Array>} Çevrilmiş makale listesi
 */
export async function batchTranslateTeasers(items) {
  if (!items || !items.length) return items;

  // Sadece ilk 25 kaydı ve sadece teaser'ı olanları çevir (Performans için)
  const itemsToTranslate = items.slice(0, 25);
  
  const translationPromises = itemsToTranslate.map(async (item) => {
    if (item.teaser || item.description) {
      const textToTranslate = item.teaser || (item.description ? item.description.slice(0, 200) + '...' : '');
      if (textToTranslate) {
        item.teaserTR = await translateToTurkish(textToTranslate);
      }
    }
    return item;
  });

  await Promise.all(translationPromises);
  return items;
}
