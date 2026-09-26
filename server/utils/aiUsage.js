/**
 * Sağlayıcı token kullanımı ve ön-ek önbelleği (prefix cache) telemetrisi.
 *
 * Prompt'ları önbelleğe uygun sıraya dizmek tek başına bir şey kanıtlamaz:
 * isabet oranı ölçülmeden bir sonraki düzenlemenin onu bozup bozmadığı
 * görülmez. Sağlayıcılar bu bilgiyi zaten yanıtta veriyor, okunmuyordu.
 *
 * Alan adları sağlayıcıya göre değişiyor:
 *  - DeepSeek : usage.prompt_cache_hit_tokens / prompt_cache_miss_tokens
 *  - OpenAI uyumlu diğerleri : usage.prompt_tokens_details.cached_tokens
 *  - Gemini : usageMetadata.cachedContentTokenCount
 *
 * Fiyat çarpanı bilerek kodlanmadı; sağlayıcılar fiyat değiştirdiğinde sessizce
 * yanlış sayı basan bir log, hiç log olmamasından kötü. Token ve oran basılıyor,
 * fiyatlandırma sağlayıcının kendi faturasından okunur.
 */

const num = (value) => (Number.isFinite(value) ? value : 0);

/**
 * Sağlayıcı yanıtındaki usage nesnesini tek bir biçime indirger.
 *
 * @returns {{promptTokens, completionTokens, cacheHitTokens, cacheMissTokens,
 *            hitRate: number|null}} hitRate: önbellek bilgisi yoksa null
 */
export function summarizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;

  const promptTokens = num(usage.prompt_tokens ?? usage.promptTokenCount);
  const completionTokens = num(usage.completion_tokens ?? usage.candidatesTokenCount);

  // DeepSeek iki alanı da verir. Diğerleri yalnızca isabet edeni verdiği için
  // ıska, toplam girdiden çıkarılarak bulunuyor.
  const reportedHit = usage.prompt_cache_hit_tokens
    ?? usage.prompt_tokens_details?.cached_tokens
    ?? usage.cachedContentTokenCount;

  if (reportedHit === undefined || reportedHit === null) {
    return { promptTokens, completionTokens, cacheHitTokens: 0, cacheMissTokens: promptTokens, hitRate: null };
  }

  const cacheHitTokens = num(reportedHit);
  const cacheMissTokens = usage.prompt_cache_miss_tokens !== undefined
    ? num(usage.prompt_cache_miss_tokens)
    : Math.max(promptTokens - cacheHitTokens, 0);

  const billableInput = cacheHitTokens + cacheMissTokens;
  const hitRate = billableInput > 0 ? cacheHitTokens / billableInput : null;

  return { promptTokens, completionTokens, cacheHitTokens, cacheMissTokens, hitRate };
}

/**
 * Tek satırlık kullanım logu.
 *
 * @param {string} label çağrı yeri, örn. 'writer/deepseek'
 */
export function logAiUsage(label, usage) {
  const summary = summarizeUsage(usage);
  if (!summary) return null;

  const { promptTokens, completionTokens, cacheHitTokens, cacheMissTokens, hitRate } = summary;

  const cachePart = hitRate === null
    ? 'cache=bilgi yok'
    : `cache: isabet ${cacheHitTokens} / iska ${cacheMissTokens} (%${(hitRate * 100).toFixed(1)})`;

  console.log(`[AI-USAGE] ${label} girdi=${promptTokens} cikti=${completionTokens} ${cachePart}`);
  return summary;
}
