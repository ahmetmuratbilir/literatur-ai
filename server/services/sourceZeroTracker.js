/**
 * Kaynak basina "ust uste sifir sonuc" sayaci.
 *
 * Tek bir aramada bir kaynagin 0 donmesi normal olabilir: konu o kaynakta
 * yoktur (arXiv'de Turkce egitim bilimleri gibi). Ama ayni kaynagin ARDISIK
 * aramalarda hep 0 donmesi bir arizadir. DOAJ tam olarak boyle bir ay boyunca
 * 0 dondurdu ve hicbir sey alarm vermedi, cunku her arama tek basina
 * "normal" gorunuyordu.
 *
 * Sayac surec icinde (bellekte) tutulur: sunucu yeniden baslayinca sifirlanir.
 * Bu bilincli: amac kalici istatistik degil, canli bir arizayi dakikalar
 * icinde fark etmek. Kalici izleme M1 sonrasi MongoDB gelince eklenebilir.
 */

/** Bu kadar ardisik sifirdan sonra alarm uretilir. */
export const STREAK_THRESHOLD = 5;

const streaks = new Map(); // kaynak -> { count, firstAt, lastQuery, alerted }

/**
 * Bir aramanin kaynak sonuclarini kaydeder.
 *
 * @param {Record<string, number>} fetchedBySource  kaynak -> cekilen kayit sayisi
 * @param {{zeroSources: string[], queries?: Record<string, string>, now?: number}} context
 *   zeroSources: bu aramada HATA VERMEDEN 0 donen kaynaklar. Hata veren,
 *   atlanan veya kapali kaynaklar buraya girmemeli; onlar zaten failedSources'ta.
 * @returns {Array<{source, count, since}>} bu aramada esigi YENI asan kaynaklar
 */
export function recordSearch(fetchedBySource, { zeroSources = [], queries = {}, now = Date.now() } = {}) {
  const zero = new Set(zeroSources);
  const newlyAlerted = [];

  for (const [source, fetched] of Object.entries(fetchedBySource || {})) {
    if (fetched > 0) {
      // Kaynak toparlandiysa bunu da soyle: alarm verilmis bir ariza sessizce
      // kapanmamali.
      const prev = streaks.get(source);
      if (prev?.alerted) {
        console.log(JSON.stringify({ event: 'SOURCE_ZERO_RECOVERED', source, afterSearches: prev.count }));
      }
      streaks.delete(source);
      continue;
    }
    if (!zero.has(source)) continue;

    const entry = streaks.get(source) || { count: 0, firstAt: now, lastQuery: '', alerted: false };
    entry.count += 1;
    entry.lastQuery = String(queries[source] ?? '').slice(0, 80);
    streaks.set(source, entry);

    // Esikte bir kez alarm: her aramada tekrar loglamak alarmi gurultuye cevirir.
    if (entry.count >= STREAK_THRESHOLD && !entry.alerted) {
      entry.alerted = true;
      newlyAlerted.push({ source, count: entry.count, since: new Date(entry.firstAt).toISOString() });
      console.error(JSON.stringify({
        event: 'SOURCE_ZERO_STREAK',
        source,
        consecutiveSearches: entry.count,
        since: new Date(entry.firstAt).toISOString(),
        lastQuery: entry.lastQuery,
        hint: 'Kaynak hata vermeden ust uste bos donuyor: sorgu sozdizimi veya endpoint sozlesmesi bozulmus olabilir. npm run verify-keys calistir.',
      }));
    }
  }

  return newlyAlerted;
}

/** Admin paneli ve verify-keys icin anlik durum. */
export function getZeroStreaks() {
  return [...streaks.entries()]
    .map(([source, e]) => ({ source, count: e.count, since: new Date(e.firstAt).toISOString(), alerted: e.alerted }))
    .sort((a, b) => b.count - a.count);
}

/** Testler icin. */
export function resetZeroStreaks() {
  streaks.clear();
}
