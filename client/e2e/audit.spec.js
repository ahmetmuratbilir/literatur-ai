import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-011 Faz 3 — Kontrol sekmesi ve "Teslime hazırla". Eski Denetim
 * sayfasının (WO-010 Aşama 2) testleri yeni yerlerinde yeniden yazıldı;
 * yeni davranışlar (gruplama, kenar işareti, aşamaya göre önem, tez paketi,
 * tablo/şekil numarası) eklendi.
 *
 * Sahte cevap: sunucu fixtures.js ile sahte (geri çekme sorgusu dahil);
 * denetim kuralları ve belge gerçek.
 */

const KAYA = {
  _id: 'b1',
  title: 'Doğal dolaşım deneyleri',
  creator: 'Zeynep Kaya',
  year: 2020,
  doi: '10.1/kaya',
  description: 'Natural circulation was stable.',
};

const CLAIM = 'Pasif sistemler kaza riskini yüzde doksan dört azaltır.';
const DOC = [
  '<h1>Giriş</h1>',
  `<p>Doğal dolaşım kararlıdır (Kaya, 2020). ${CLAIM}</p>`,
  '<p>Bu bulgu tekrarlanmıştır (Yılmaz, 2023).</p>',
  '<p>“Natural circulation was stable under all tested conditions” (Kaya, 2020).</p>',
  '<h1>Yöntem</h1>',
  '<h1>Kaynakça</h1>',
].join('');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    // Geliştirme şeridi durum çubuğunu örtüyor. React'in düğümüne dokunmadan, yalnız stille gizlenir.
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

const side = (page) => page.locator('.wx-side');
const item = (page, rule) => side(page).locator(`[data-rule="${rule}"]`);
const prep = (page) => page.getByTestId('submit-prep');

/** Kontrol sekmesi açık yazar modu (`#/yazar/kontrol`). */
async function openCheck(page, { basket = [KAYA], retractions, html = DOC, title = 'Denetim taslağı', extra } = {}) {
  await seedDraft(page, html, title, extra);
  const api = await mockApi(page, { basket, retractions });
  await page.goto('/#/yazar/kontrol');
  await expect(page.locator('[data-action="side-check"]')).toHaveAttribute('aria-pressed', 'true');
  return api;
}

test('Kontrol: sorunlar önem sırasıyla, süzgeçte sayılar; geri çekme canlı sorulur', async ({ page }) => {
  const api = await openCheck(page, { retractions: { '10.1/kaya': { status: 'retracted' } } });
  await expect(item(page, 'retracted')).toBeVisible();
  for (const rule of ['orphan', 'notInReferences', 'uncitedClaim', 'quoteNoPage', 'emptySection']) {
    await expect(item(page, rule).first(), rule).toBeVisible();
  }
  await expect(item(page, 'orphan')).toContainText('Yılmaz, 2023');
  await expect(item(page, 'emptySection')).toContainText('Yöntem');
  await expect(side(page).locator('.wx-ctl__list > li').first()).toHaveAttribute('data-severity', 'critical');
  await expect(page.locator('[data-action="check-filter-critical"]')).toContainText('Hata');
  await expect(page.locator('[data-action="check-filter-critical"]')).toContainText('3');
  expect(api.retractionCalls).toBeGreaterThan(0);
});

test('süzgeç yalnız seçilen önem derecesini gösterir', async ({ page }) => {
  await openCheck(page);
  await expect(item(page, 'uncitedClaim')).toBeVisible();
  await page.locator('[data-action="check-filter-critical"]').click();
  await expect(side(page).locator('[data-severity="warning"]')).toHaveCount(0);
  await expect(side(page).locator('[data-severity="critical"]').first()).toBeVisible();
  await page.locator('[data-action="check-filter-all"]').click();
  await expect(side(page).locator('[data-severity="warning"]').first()).toBeVisible();
});

test('"Metinde göster" cümleyi seçer; satır konumu monospace yazar', async ({ page }) => {
  await openCheck(page);
  await expect(item(page, 'uncitedClaim').locator('.wx-ctl__where')).toHaveText('Bölüm 1 · Paragraf 1');
  await item(page, 'uncitedClaim').getByRole('button', { name: 'Metinde göster' }).click();
  await expect.poll(() => page.evaluate(() => window.getSelection().toString())).toBe(CLAIM);
  // Satırın başlığına tıklamak da aynı yere götürür.
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await item(page, 'orphan').locator('[data-action="check-open"]').click();
  await expect.poll(() => page.evaluate(() => window.getSelection().toString())).toContain('Yılmaz, 2023');
});

test('"Bölüme git" boş bölümün başlığına götürür; yazarken boş bölüm Bilgi', async ({ page }) => {
  await openCheck(page);
  await expect(item(page, 'emptySection')).toHaveAttribute('data-severity', 'info');
  await item(page, 'emptySection').getByRole('button', { name: 'Bölüme git' }).click();
  await expect.poll(() => page.evaluate(() => {
    const node = window.getSelection().anchorNode;
    return (node?.nodeType === 3 ? node.parentElement : node)?.closest('h1')?.textContent || '';
  })).toBe('Yöntem');
});

test('"Kaynakçayı aç" Kaynakça sekmesini, "Kaynak ekle" Kaynaklar sekmesini açar', async ({ page }) => {
  await openCheck(page);
  await item(page, 'notInReferences').getByRole('button', { name: 'Kaynakçayı aç' }).click();
  await expect(page.locator('[data-action="side-bib"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action="side-check"]').click();
  await item(page, 'uncitedClaim').getByRole('button', { name: 'Kaynak ekle' }).click();
  await expect(page.locator('[data-action="side-sources"]')).toHaveAttribute('aria-pressed', 'true');
});

test('"İddia değil olarak işaretle" maddeyi kaldırır', async ({ page }) => {
  await openCheck(page);
  await expect(item(page, 'uncitedClaim')).toHaveCount(1);
  await item(page, 'uncitedClaim').getByRole('button', { name: 'İddia değil olarak işaretle' }).click();
  await expect(item(page, 'uncitedClaim')).toHaveCount(0);
});

test('aynı türden sorunlar tek satırda toplanır, açılınca liste', async ({ page }) => {
  await openCheck(page, { html: '<h1>Giriş</h1><h1>Yöntem</h1><h1>Bulgular</h1><h1>Kaynakça</h1>', basket: [] });
  const group = side(page).locator('[data-group-rule="emptySection"]');
  await expect(group).toContainText('3 bölüm boş');
  await expect(group.locator('[data-rule="emptySection"]')).toHaveCount(0);
  await group.locator('[data-action="check-group-toggle"]').click();
  await expect(group.locator('[data-rule="emptySection"]')).toHaveCount(3);
  await group.locator('[data-rule="emptySection"]').nth(1).getByRole('button', { name: 'Bölüme git' }).click();
  await expect.poll(() => page.evaluate(() => {
    const node = window.getSelection().anchorNode;
    return (node?.nodeType === 3 ? node.parentElement : node)?.closest('h1')?.textContent || '';
  })).toBe('Yöntem');
});

test('kenar işareti Kontrol\'de ilgili satırı açar', async ({ page }) => {
  await seedDraft(page, DOC, 'İşaret');
  await mockApi(page, { basket: [KAYA] });
  await page.goto('/#/yazar');
  await page.locator('[data-action="side-sources"]').click();
  const marker = page.locator('[data-action="check-marker"][data-rule="uncitedClaim"]');
  await expect(marker).toBeVisible();
  await expect(page.locator('[data-action="check-marker"]')).toHaveCount(3);
  await marker.click();
  await expect(page.locator('[data-action="side-check"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(item(page, 'uncitedClaim')).toHaveClass(/is-focused/);
});

test('tablo ve şekil numaralandırması denetlenir', async ({ page }) => {
  const html = '<h1>Bulgular</h1><p>Tablo 1. Koşullar</p><p>Tablo 3. Sonuçlar</p><p>Sonuçlar Şekil 2\'de görülüyor.</p><h1>Kaynakça</h1>';
  await openCheck(page, { html, basket: [] });
  await expect(item(page, 'captionOrder')).toContainText('Tablo numarası sıra dışı: 3 (beklenen 2)');
  await expect(item(page, 'captionMissing')).toContainText('Şekil 2 metinde anılıyor, başlığı yok');
});

test('geri çekme sorgusu cevap vermezse kaynaklar "temiz" sayılmaz', async ({ page }) => {
  await seedDraft(page, DOC, 'Denetim taslağı');
  const api = await mockApi(page, { basket: [KAYA] });
  await page.route('http://localhost:3000/api/retractions', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/#/yazar/kontrol');
  await expect(item(page, 'retractionUnknown')).toBeVisible();
  expect(api.retractionCalls || 0).toBe(0);
});

// --- Teslime hazırla -------------------------------------------------------

test('Teslime hazırla: teslim aşamasında boş zorunlu bölüm Uyarı; hata varken "Yine de devam et"', async ({ page }) => {
  await openCheck(page);
  await page.locator('[data-action="write-submit"]').click();
  await expect(prep(page)).toBeVisible();
  await expect(prep(page).locator('[data-rule="emptySection"]')).toHaveAttribute('data-severity', 'warning');
  await expect(prep(page).getByRole('status').first()).toContainText('2 hata var'); // sahipsiz atıf + kaynakçada görünmeyen kaynak
  await expect(prep(page).locator('[data-action="prep-next"]')).toHaveText('Yine de devam et');
  // Tez değil: paket listesi yok.
  await expect(page.getByTestId('thesis-package')).toHaveCount(0);
});

test('Teslime hazırla › Önizleme belgeyi Teslim görünümüne alır, sayfa düzeni ve kurum notu görünür', async ({ page }) => {
  await openCheck(page);
  await page.locator('[data-action="write-submit"]').click();
  await prep(page).locator('[data-action="prep-next"]').click();
  await expect(page.locator('[data-action="write-view-submit"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(prep(page)).toContainText('A4');
  await expect(prep(page)).toContainText('kurum şablonuna göre denetlenmedi');
});

test('Teslime hazırla › Dışa aktar: yalnız çalışan dört biçim; Word ve BibTeX iner', async ({ page }) => {
  await openCheck(page);
  await page.locator('[data-action="write-submit"]').click();
  await prep(page).locator('[data-action="prep-step-export"]').click();
  await expect(prep(page).locator('input[name="prep-format"]')).toHaveCount(4);
  await expect(prep(page)).not.toContainText(/PDF\/A olarak|LaTeX olarak|Turnitin/);
  await expect(prep(page)).toContainText('PDF/A ve LaTeX dışa aktarımı yok');
  const [word] = await Promise.all([page.waitForEvent('download'), prep(page).locator('[data-action="prep-run"]').click()]);
  expect(word.suggestedFilename()).toMatch(/\.docx$/);
  await prep(page).locator('[data-action="prep-format-bibtex"]').check();
  const [bib] = await Promise.all([page.waitForEvent('download'), prep(page).locator('[data-action="prep-run"]').click()]);
  expect(bib.suggestedFilename()).toMatch(/\.bib$/);
  expect(fs.readFileSync(await bib.path(), 'utf8')).toContain('Doğal dolaşım deneyleri');
});

test('Teslime hazırla: sepet boşsa BibTeX ve RIS seçilemez', async ({ page }) => {
  await openCheck(page, { basket: [] });
  await page.locator('[data-action="write-submit"]').click();
  await prep(page).locator('[data-action="prep-step-export"]').click();
  await expect(prep(page).locator('[data-action="prep-format-bibtex"]')).toBeDisabled();
  await expect(prep(page).locator('[data-action="prep-format-ris"]')).toBeDisabled();
  await expect(prep(page)).toContainText('Sepet boş');
});

test('tez: teslim paketi bileşenleri belgedeki gerçek bölümlerden', async ({ page }) => {
  const html = [
    '<h1 data-template-section="cover">Kapak</h1><p>Üniversite adı</p>',
    '<h1 data-template-section="ozet">Özet</h1>',
    '<h1 data-template-section="abstract">Abstract</h1><p>Text.</p>',
    '<h1 data-template-section="references">Kaynakça</h1>',
  ].join('');
  await openCheck(page, { html, basket: [], extra: { format: 'thesis' } });
  await page.locator('[data-action="write-submit"]').click();
  const pkg = page.getByTestId('thesis-package');
  await expect(pkg).toBeVisible();
  await expect(pkg.locator('[data-key="cover"]')).toHaveAttribute('data-status', 'present');
  await expect(pkg.locator('[data-key="ozet"]')).toHaveAttribute('data-status', 'empty');
  await expect(pkg.locator('[data-key="abstract"]')).toHaveAttribute('data-status', 'present');
  await expect(pkg.locator('[data-key="approval"]')).toHaveAttribute('data-status', 'missing');
  await expect(pkg.locator('[data-key="ozet"]')).toContainText('Başlık var, içi boş');
});

test('dürüstlük taraması: Kontrol ve Teslime hazırla ekranlarında yasak kalıp yok', async ({ page }) => {
  await openCheck(page);
  const forbidden = [/senkronize/i, /güven skoru/i, /doğruluk\s*%/i, /%\s*\d+\s*hazır/i, /hakem onaylı/i, /AHP:\s*\d/, /hazırlık skoru/i, /turnitin/i, /YÖK.*uygun/i];
  const scan = async (label, locator) => {
    const text = await locator.innerText();
    for (const pattern of forbidden) expect(text, `${label} ${pattern}`).not.toMatch(pattern);
  };
  await scan('kontrol', side(page));
  await page.locator('[data-action="write-submit"]').click();
  for (const step of ['check', 'preview', 'export']) {
    await prep(page).locator(`[data-action="prep-step-${step}"]`).click();
    await scan(`teslim ${step}`, prep(page));
  }
});
