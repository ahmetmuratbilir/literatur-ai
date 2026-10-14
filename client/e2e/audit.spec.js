import { test, expect } from '@playwright/test';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-010 Aşama 2 — Denetim ve Teslim: maddeler, "Metinde göster" köprüsü,
 * teslim dosyaları ve dürüstlük taraması.
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
    // Geliştirme şeridi durum çubuğunu örtüyor. React'in düğümüne dokunmadan, yalnız stille gizlenir
    // (düğümü silmek React güncellemelerini ara sıra bozuyordu: kayıt testi kararsızdı).
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
  await seedDraft(page, DOC, 'Denetim taslağı');
});

// WO-011 Faz 1 Denetim sayfasını kaldırdı; işlevi Faz 3'te yazar modunun sağ
// panelindeki Kontrol sekmesine ve "Teslime hazırla" akışına taşınıyor. Bu
// testler o fazda yeni yere göre yeniden yazılır. Kuralların kendisi
// (src/audit/audit.js) birim testleriyle sınanmaya devam ediyor; dürüstlük
// taraması e2e/mode.spec.js'e taşındı.
test.fixme(true, 'WO-011 Faz 3: Denetim → Kontrol sekmesi');

const item = (page, rule) => page.locator(`.au-item[data-rule="${rule}"]`);

test('belgedeki sorunlar önem sırasıyla listelenir, sayılar üstte', async ({ page }) => {
  const api = await mockApi(page, { basket: [KAYA], retractions: { '10.1/kaya': { status: 'retracted' } } });
  await page.goto('/#/denetim');
  await expect(item(page, 'retracted')).toBeVisible();
  for (const rule of ['orphan', 'notInReferences', 'uncitedClaim', 'quoteNoPage', 'emptySection']) {
    await expect(item(page, rule).first(), rule).toBeVisible();
  }
  await expect(item(page, 'orphan')).toContainText('Yılmaz, 2023');
  await expect(item(page, 'emptySection')).toContainText('Yöntem');
  // İlk madde kritik
  await expect(page.locator('.au-item').first()).toHaveClass(/au-item--critical/);
  await expect(page.locator('.au-count--critical')).toContainText('kritik');
  expect(api.retractionCalls).toBeGreaterThan(0);
});

test('süzgeç yalnız seçilen önem derecesini gösterir', async ({ page }) => {
  await mockApi(page, { basket: [KAYA] });
  await page.goto('/#/denetim');
  await expect(item(page, 'uncitedClaim')).toBeVisible();
  await page.locator('[data-action="audit-filter-critical"]').click();
  await expect(page.locator('.au-item--warning')).toHaveCount(0);
  await expect(page.locator('.au-item--critical').first()).toBeVisible();
  await page.locator('[data-action="audit-filter-all"]').click();
  await expect(page.locator('.au-item--warning').first()).toBeVisible();
});

test('"Metinde göster" Yazım\'a geçer ve cümleyi seçer', async ({ page }) => {
  await mockApi(page, { basket: [KAYA] });
  await page.goto('/#/denetim');
  await item(page, 'uncitedClaim').getByRole('button', { name: 'Metinde göster' }).click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect.poll(() => page.evaluate(() => window.getSelection().toString())).toBe(CLAIM);
});

test('"Bölüme git" boş bölümün başlığına götürür', async ({ page }) => {
  await mockApi(page, { basket: [KAYA] });
  await page.goto('/#/denetim');
  await item(page, 'emptySection').getByRole('button', { name: 'Bölüme git' }).click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect.poll(() => page.evaluate(() => {
    const node = window.getSelection().anchorNode;
    return (node?.nodeType === 3 ? node.parentElement : node)?.closest('h1')?.textContent || '';
  })).toBe('Yöntem');
});

test('"Kaynakçayı aç" Yazım\'da Kaynakça sekmesini açar', async ({ page }) => {
  await mockApi(page, { basket: [KAYA] });
  await page.goto('/#/denetim');
  await item(page, 'notInReferences').getByRole('button', { name: 'Kaynakçayı aç' }).click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect(page.locator('[data-action="side-bib"]')).toHaveAttribute('aria-pressed', 'true');
});

test('teslim önizlemesi Yazım\'ı Teslim görünümünde açar', async ({ page }) => {
  await mockApi(page, { basket: [KAYA] });
  await page.goto('/#/denetim');
  await page.locator('[data-action="audit-preview"]').click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect(page.locator('[data-action="write-view-submit"]')).toHaveAttribute('aria-pressed', 'true');
});

test('Word ve BibTeX dosyaları iner', async ({ page }) => {
  await mockApi(page, { basket: [KAYA] });
  await page.goto('/#/denetim');
  await expect(item(page, 'uncitedClaim')).toBeVisible();
  const [word] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="audit-export-word"]').click()]);
  expect(word.suggestedFilename()).toMatch(/\.docx$/);
  const [bib] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="audit-bibtex"]').click()]);
  expect(bib.suggestedFilename()).toMatch(/\.bib$/);
});

test('geri çekme sorgusu cevap vermezse kaynaklar "temiz" sayılmaz', async ({ page }) => {
  const api = await mockApi(page, { basket: [KAYA] });
  await page.route('http://localhost:3000/api/retractions', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/#/denetim');
  await expect(item(page, 'retractionUnknown')).toBeVisible();
  expect(api.retractionCalls || 0).toBe(0);
});

test('dürüstlük taraması: yeni ekranlarda yasak kalıp yok', async ({ page }) => {
  await mockApi(page, { basket: [KAYA] });
  const forbidden = [/senkronize/i, /güven skoru/i, /doğruluk\s*%/i, /%\s*\d+\s*hazır/i, /hakem onaylı/i, /AHP:\s*\d/, /hazırlık skoru/i];
  for (const hash of ['#/alanim', '#/kaynaklar/ara', '#/kaynaklar/sepet', '#/yazim', '#/denetim']) {
    await page.goto(`/${hash}`);
    await page.waitForTimeout(400);
    const text = await page.locator('.la-shell').innerText();
    for (const pattern of forbidden) expect(text, `${hash} ${pattern}`).not.toMatch(pattern);
  }
});
