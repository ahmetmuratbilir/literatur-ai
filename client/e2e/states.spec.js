import { test, expect } from '@playwright/test';
import { API, mockApi, SEARCH_RESULT } from './fixtures.js';

/**
 * WO-021 — arama bekleme, hata, boş ve kısmi sonuç (etkileşim planı §3, §5,
 * §7 son satırları). Sunucu sahte; gecikme ve hata Playwright route ile.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

const submit = (page) => page.getByRole('button', { name: /^(Ara|Aranıyor…)$/ });

async function search(page) {
  await page.locator('#topic-input').fill('pasif soğutma');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
}

/** /api/search'i geciktirir ya da başka yanıt verir (mockApi'den sonra kaydedilir, önce eşleşir). */
async function routeSearch(page, handler) {
  await page.route(`${API}/api/search**`, handler);
}

test('bekleme: anında dönen aramada yanıp sönmez; sonra hareketli kart, gerçek süre ve İptal; sahte aşama metni yok', async ({ page }) => {
  await mockApi(page);
  let release;
  await routeSearch(page, async (route) => { await new Promise((r) => { release = r; }); await route.fulfill({ json: SEARCH_RESULT }); });
  await page.goto('/');
  await search(page);
  await page.waitForTimeout(150);
  await expect(page.getByRole('button', { name: 'Ara', exact: true })).toBeVisible(); // < 300 ms: düğme değişmedi
  await expect(page.getByTestId('search-waiting')).toHaveCount(0); // < 400 ms: kart yok
  await expect(submit(page)).toHaveText('Aranıyor…', { timeout: 1500 });
  // Kart aramadan hemen sonra görünür (kullanıcı isteği 19.10.2026), 2 sn beklemez.
  await expect(page.getByTestId('search-waiting')).toBeVisible({ timeout: 1500 });
  await expect(page.getByTestId('search-waiting')).toContainText(/Kaynaklar taranıyor · \d+ sn/);
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/9 Açık Kaynak|AHP ağırlıklarınla|Dokuz açık akademik kaynak|SJR Q1-Q4/);
  release();
  await expect(page.getByRole('button', { name: 'Makalene ekle' })).toHaveCount(2);
  await expect(page.getByTestId('search-waiting')).toHaveCount(0);
});

test('İptal: istek gerçekten durur, "iptal edildi" der; yeniden arama çalışır', async ({ page }) => {
  await mockApi(page);
  let calls = 0;
  await routeSearch(page, async (route) => {
    calls += 1;
    if (calls === 1) { await new Promise((r) => setTimeout(r, 8000)); return route.fulfill({ json: SEARCH_RESULT }).catch(() => {}); }
    return route.fulfill({ json: SEARCH_RESULT });
  });
  await page.goto('/');
  await search(page);
  await page.locator('[data-action="search-cancel"]').click({ timeout: 4000 });
  await expect(page.getByTestId('search-cancelled')).toBeVisible();
  await expect(page.getByTestId('search-waiting')).toHaveCount(0);
  await page.getByTestId('search-cancelled').getByRole('button').click();
  await expect(page.getByRole('button', { name: 'Makalene ekle' })).toHaveCount(2);
});

for (const [name, status, body, headers, kind, text] of [
  ['401 oturum', 401, { error: 'Lütfen giriş yapın' }, {}, 'auth', 'Oturumun sona erdi'],
  ['429 hız sınırı (Retry-After)', 429, { error: 'çok' }, { 'Retry-After': '5', 'Access-Control-Expose-Headers': 'Retry-After' }, 'rate', 'Kısa sürede çok istek'],
  ['500 sunucu', 500, { error: 'boom' }, {}, 'server', 'sunucuda bir sorun oldu'],
  ['503 uyanıyor', 503, { error: 'x' }, {}, 'unavailable', 'uyanıyor olabilir'],
  ['503 kaynakların hepsi düştü', 503, { error: 'x', code: 'SOURCES_UNAVAILABLE', failedSources: [{ name: 'OpenAlex' }, { name: 'SemanticScholar' }] }, {}, 'sources', 'Semantic Scholar'],
]) {
  test(`hata: ${name} — kendi mesajı, "Bir hata oluştu" tek başına yok`, async ({ page }) => {
    await mockApi(page);
    await routeSearch(page, (route) => route.fulfill({ status, json: body, headers }));
    await page.goto('/');
    await search(page);
    const notice = page.getByTestId('search-error');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('data-kind', kind);
    await expect(notice).toContainText(text);
    expect((await notice.innerText()).trim()).not.toMatch(/^bir hata oluştu\.?$/i);
    if (kind === 'rate') {
      const retry = page.locator('[data-action="search-retry"]');
      await expect(retry).toBeDisabled();
      await expect(retry).toContainText(/Tekrar dene · \d sn/);
    }
  });
}

test('ağ hatası: bağlantı koptuysa "Bağlantı yok", sorgu duruyor', async ({ page }) => {
  await mockApi(page);
  await routeSearch(page, (route) => route.abort('internetdisconnected'));
  await page.goto('/');
  await page.context().setOffline(true);
  await search(page);
  await expect(page.getByTestId('search-error')).toHaveAttribute('data-kind', 'offline');
  await expect(page.locator('#topic-input')).toHaveValue('pasif soğutma');
  await page.context().setOffline(false);
});

test('boş sonuç: taranan kaynakları söyler, "çalışma yok" demez, örnek veri göstermez', async ({ page }) => {
  await mockApi(page);
  await routeSearch(page, (route) => route.fulfill({ json: { results: [], totalFound: 0, analyzedCount: 0, empty: true, sourcesQueried: ['OpenAlex', 'Crossref', 'EuropePMC'], failedSources: [], relevance: { level: 'none', dropped: 0 } } }));
  await page.goto('/');
  await search(page);
  const empty = page.getByTestId('search-empty');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('taranan 3 kaynakta kayıt bulunamadı');
  await expect(empty).toContainText('OpenAlex, Crossref, Europe PMC');
  await expect(empty).toContainText('çalışma olmadığı anlamına gelmez');
  await expect(page.getByText('Örnek veri gösteriliyor')).toHaveCount(0);
});

test('kısmi sonuç: yanıt vermeyen kaynak adıyla; sonuçlar görünür', async ({ page }) => {
  await mockApi(page);
  await routeSearch(page, (route) => route.fulfill({ json: { ...SEARCH_RESULT, sourcesQueried: ['OpenAlex', 'Crossref', 'SemanticScholar'], failedSources: [{ name: 'SemanticScholar', type: 'timeout' }] } }));
  await page.goto('/');
  await search(page);
  const partial = page.getByTestId('search-partial');
  await expect(partial).toBeVisible();
  await expect(partial).toContainText('1 kaynak yanıt vermedi: Semantic Scholar');
  // Sayı yalnız yanıt verenler: 3 sorgulandı, 1 düştü → 2 (eskiden 3 yazıyordu).
  await expect(partial).toContainText('Sonuçlar yanıt veren 2 kaynaktan.');
  await expect(page.getByRole('button', { name: 'Makalene ekle' })).toHaveCount(2);
});

test('boş sonuç + düşen kaynak: düşen kaynak "taranan" sayılmaz, adıyla söylenir (2.8)', async ({ page }) => {
  await mockApi(page);
  await routeSearch(page, (route) => route.fulfill({ json: {
    results: [], totalFound: 0, analyzedCount: 0, empty: true,
    sourcesQueried: ['OpenAlex', 'CORE', 'SemanticScholar', 'DOAJ'],
    failedSources: [{ name: 'CORE', type: 'TIMEOUT' }, { name: 'SemanticScholar', type: 'QUOTA' }],
    relevance: { level: 'none', dropped: 0 },
  } }));
  await page.goto('/');
  await search(page);
  const partial = page.getByTestId('search-partial');
  await expect(partial).toContainText('2 kaynak yanıt vermedi: CORE, Semantic Scholar');
  await expect(partial).not.toContainText('Sonuçlar yanıt veren');
  const empty = page.getByTestId('search-empty');
  await expect(empty).toContainText('taranan 2 kaynakta kayıt bulunamadı');
  await expect(empty).toContainText('Taranan kaynaklar: OpenAlex, DOAJ.');
  await expect(empty).not.toContainText('CORE');
});
