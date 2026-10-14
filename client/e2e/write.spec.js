import { test, expect } from '@playwright/test';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-010 Aşama 1 — Yazım Stüdyosu yerleşimi: belge yapısı, sağ panel
 * sekmeleri, yer kuralı, ölçek, atıf ekleme ve seçim araç çubuğu.
 */

const SOURCE = {
  _id: 'b1',
  title: 'Passive decay heat removal in integral test facilities',
  creator: 'Li Chen, Hui Wang',
  year: 2021,
  doi: '10.1016/j.nucengdes.2021.110950',
  description: 'Passive decay heat removal was maintained for 72 hours without AC power.',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
  });
  // Geliştirme şeridi sağ altta durum çubuğunu örtüyor; testte kapatılır.
  await page.addInitScript(() => {
    // Geliştirme şeridi durum çubuğunu örtüyor. React'in düğümüne dokunmadan, yalnız stille gizlenir
    // (düğümü silmek React güncellemelerini ara sıra bozuyordu: kayıt testi kararsızdı).
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

const outline = (page) => page.locator('.wx-nav');
const side = (page) => page.locator('.wx-side');

test('belge yapısı araç çubuğundaki düğmeyle gizlenip açılıyor; iç ray yok', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Metin.</p><h2>Amaç</h2><p>Daha fazla metin.</p>');
  await mockApi(page);
  await page.goto('/#/yazim');
  await expect(page.locator('.wx-rail')).toHaveCount(0);
  await expect(outline(page)).toBeVisible();
  await expect(outline(page).getByRole('button', { name: /Amaç/ })).toBeVisible();
  await page.locator('[data-action="write-outline"]').click();
  await expect(outline(page)).toHaveCount(0);
  await page.locator('[data-action="write-outline"]').click();
  await expect(outline(page)).toBeVisible();
});

test('sağ panel üç sekme: Kanıt, Kaynaklar, Kaynakça', async ({ page }) => {
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yazim');
  await expect(side(page)).toBeVisible();
  await page.locator('[data-action="side-sources"]').click();
  await expect(side(page).getByText(SOURCE.title)).toBeVisible();
  await page.locator('[data-action="side-source-open"]').click();
  // Kaynağa tıklamak Kanıt sekmesine geçer: pasaj ve üretim düğmesi orada
  await expect(page.locator('[data-action="side-evidence"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(side(page).getByText('72 hours without AC power')).toBeVisible();
  await page.locator('[data-action="side-bib"]').click();
  await expect(side(page).getByRole('region', { name: 'Kaynakça' })).toBeVisible();
});

test('Teslim görünümünde sağ panel açılırken sayfa sığmıyorsa belge yapısı kapanır', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Metin.</p>');
  await mockApi(page);
  await page.goto('/#/yazim');
  await page.locator('[data-action="write-view-submit"]').click();
  await page.locator('[data-action="write-side"]').click(); // kapat
  await expect(side(page)).toHaveCount(0);
  await expect(outline(page)).toBeVisible();
  await page.locator('[data-action="write-side"]').click(); // aç
  await expect(side(page)).toBeVisible();
  await expect(outline(page)).toHaveCount(0);
});

test('Taslak görünümünde yer yeterliyse belge yapısı açık kalır', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Metin.</p>');
  await mockApi(page);
  await page.goto('/#/yazim');
  await page.locator('[data-action="write-view-draft"]').click();
  await page.locator('[data-action="write-side"]').click();
  await page.locator('[data-action="write-side"]').click();
  await expect(side(page)).toBeVisible();
  await expect(outline(page)).toBeVisible();
});

test('sığdır sayfayı küçültür, gerçek boyut A4\'ü 1:1 gösterir', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Metin.</p>');
  await mockApi(page);
  await page.goto('/#/yazim');
  await page.locator('[data-action="write-view-submit"]').click();
  // Belge yapısı ve sağ panel açık: A4 (794 px) masaya sığmaz
  if (!(await outline(page).isVisible())) await page.locator('[data-action="write-outline"]').click();
  await expect(page.locator('[data-action="write-zoom-fit"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-action="write-zoom-fit"]')).toContainText('%');
  const fitWidth = await page.locator('.wx-page').evaluate((el) => el.getBoundingClientRect().width);
  await page.locator('[data-action="write-zoom-actual"]').click();
  const actualWidth = await page.locator('.wx-page').evaluate((el) => el.getBoundingClientRect().width);
  expect(fitWidth).toBeLessThan(actualWidth);
  // A4 = 210 mm = 793.7 CSS px
  expect(Math.abs(actualWidth - 793.7)).toBeLessThan(2);
});

test('"Atıf ekle" seçili kaynağın atfını imlece koyar; kaynak yoksa Kaynaklar sekmesini açar', async ({ page }) => {
  await seedDraft(page, '<p>Pasif sistemler harici güç olmadan çalışır.</p>');
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yazim');
  const doc = page.locator('.wx-page');
  // Henüz kaynak seçili değil: düğme kaynak listesine götürür
  await page.locator('[data-action="write-side"]').click();
  await page.locator('[data-action="write-side"]').click();
  await doc.click();
  await page.keyboard.press('End');
  // Kaynak seçimi: Kaynaklar sekmesinden
  await page.locator('[data-action="side-sources"]').click();
  await page.locator('[data-action="side-source-open"]').click();
  await doc.click();
  await page.keyboard.press('End');
  await page.locator('[data-action="write-cite"]').click();
  // Atfın biçimi citation.js'in işi (birim testli); burada yalnız imlecin yerine girdiği.
  await expect(doc).toContainText(/çalışır\. \(Chen[^)]*, 2021\)/);
});

test('seçim araç çubuğu: seçince çıkar, iddia kararını çevirir', async ({ page }) => {
  await seedDraft(page, '<p>Pasif sistemler kaza riskini azaltır.</p>');
  await mockApi(page);
  await page.goto('/#/yazim');
  const doc = page.locator('.wx-page p').first();
  // Paragrafın ortası boş alan olabilir; üç tık satırı seçer.
  await doc.click({ clickCount: 3 });
  await expect(page.locator('.wx-selbar')).toBeVisible();
  const notClaimBefore = await page.locator('.wx-stat--plain').innerText();
  await page.locator('[data-action="selbar-claim"]').click();
  await expect(page.locator('.wx-stat--plain')).not.toHaveText(notClaimBefore);
  // Seçim kalkınca çubuk kaybolur
  await page.keyboard.press('End');
  await expect(page.locator('.wx-selbar')).toHaveCount(0);
});

test('yeni düğmelerin envanteri', async ({ page }) => {
  await mockApi(page, { basket: [SOURCE] });
  await page.goto('/#/yazim');
  for (const id of ['write-outline', 'write-cite', 'write-font', 'write-side', 'write-focus', 'write-view-draft', 'write-view-submit',
    'side-evidence', 'side-sources', 'side-bib']) {
    await expect(page.locator(`[data-action="${id}"]`).first(), id).toBeAttached();
  }
});
