/* global process -- Playwright testleri Node'da koşar */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { mockApi, PAPERS, SEARCH_RESULT } from './fixtures.js';

/**
 * WO-011 temel test çizgisi. Her fazdan önce ve sonra aynı testler koşar;
 * dışa aktarılan dosyalar BASELINE_DIR'e yazılır ve fazlar arasında
 * karşılaştırılır.
 *
 * Sahte cevap kullanımı (açıkça):
 * - "gerçek sunucu" testleri yalnız /api/search'ü sahte cevaplar (dış
 *   kaynaklara gitmesin diye); sepet, kimlik ve geri kalan her şey
 *   localhost:3000'deki gerçek sunucuya gider.
 * - "sahte sunucu" testi çevrimiçi sepet yolunu dener: yerelde MongoDB
 *   bağlı olmadığı için gerçek sunucu sepete 503 dönüyor.
 */
const OUT = process.env.BASELINE_DIR || 'test-results/baseline';
const BASKET_KEY = 'basket:test-user-id';
const DRAFT_KEY = 'literatur-ai:workspace:v2';

test.beforeEach(async ({ page }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    // Geliştirme şeridi durum çubuğunu örtüyor. React'in düğümüne dokunmadan, yalnız stille gizlenir
    // (düğümü silmek React güncellemelerini ara sıra bozuyordu: kayıt testi kararsızdı).
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

const onlySearchMocked = (page) => page.route('http://localhost:3000/api/search**', (route) => route.fulfill({
  status: 200, contentType: 'application/json', body: JSON.stringify(SEARCH_RESULT),
}));

const localBasket = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '[]'), BASKET_KEY);

test('B1 gerçek sunucu: sepete ekle/çıkar, çevrimdışı yerel kopya, yeniden yüklemede kalıcı', async ({ page }) => {
  await onlySearchMocked(page);
  await page.goto('/');
  await page.locator('#topic-input').fill('pasif soğutma');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  await expect(page.getByRole('heading', { name: PAPERS[0].title })).toBeVisible();

  await page.getByRole('button', { name: 'Makalene ekle' }).first().click();
  await expect.poll(async () => (await localBasket(page)).length).toBe(1);
  expect((await localBasket(page))[0].title).toBe(PAPERS[0].title);

  await page.reload();
  await expect.poll(async () => (await localBasket(page)).length).toBe(1);

  // Çıkar: aynı karttaki düğme seçiliyken sepetten çıkarır
  await page.locator('#topic-input').fill('pasif soğutma');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  await page.getByRole('button', { name: 'Makalen için tutuldu' }).first().click();
  await expect.poll(async () => (await localBasket(page)).length).toBe(0);
});

test('B2 sahte sunucu: çevrimiçi sepet ekle/çıkar', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/');
  await page.locator('#topic-input').fill('pasif soğutma');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  await page.getByRole('button', { name: 'Makalene ekle' }).first().click();
  await expect.poll(() => api.basket.length).toBe(1);
  await page.getByRole('button', { name: 'Makalen için tutuldu' }).first().click();
  await expect.poll(() => api.basket.length).toBe(0);
});

test('B3 dışa aktarma: BibTeX, RIS ve DOCX dosyaları üretilip kaydediliyor', async ({ page }) => {
  // Gerçek sunucu sepete 503 döndüğü için uygulama yerel kopyayı okur.
  await page.addInitScript(([key, draftKey, papers]) => {
    if (sessionStorage.getItem('b3')) return;
    sessionStorage.setItem('b3', '1');
    localStorage.setItem(key, JSON.stringify(papers));
    localStorage.setItem(draftKey, JSON.stringify({
      title: 'Temel çizgi taslağı',
      html: '<h1>Giriş</h1><p>Doğal dolaşım kararlıdır (Chen &amp; Wang, 2021).</p><h1>Kaynakça</h1><p>Chen, L. (2021). Passive decay heat removal.</p>',
      savedAt: Date.now(),
    }));
  }, [BASKET_KEY, DRAFT_KEY, PAPERS.map((p) => ({ ...p, creator: p.authors }))]);
  await onlySearchMocked(page);

  // Eski adres (WO-010) kenar çubuğunun Sepet sekmesine yönlenir (WO-011).
  await page.goto('/#/kaynaklar/sepet');
  await expect(page).toHaveURL(/\/$/);
  const save = async (trigger, name) => {
    const [download] = await Promise.all([page.waitForEvent('download'), trigger()]);
    const target = path.join(OUT, name);
    await download.saveAs(target);
    return fs.statSync(target).size;
  };
  expect(await save(() => page.locator('[data-action="basket-bibtex"]').click(), 'sepet.bib')).toBeGreaterThan(100);
  expect(await save(() => page.locator('[data-action="basket-ris"]').click(), 'sepet.ris')).toBeGreaterThan(100);

  await page.goto('/#/yaz');
  await expect(page.locator('.wx-page')).toContainText('Doğal dolaşım kararlıdır');
  await page.getByRole('button', { name: /Dışa aktar/ }).first().click();
  expect(await save(() => page.getByRole('button', { name: /Word/ }).first().click(), 'taslak.docx')).toBeGreaterThan(1000);
});

test('B4 taslak: yaz, kaydet, yeniden yükle, geri aç', async ({ page }) => {
  await onlySearchMocked(page);
  await page.goto('/#/yaz');
  // WO-011: taslak yokken önce biçim sorulur; varsayılan biçimle başlanır.
  await page.locator('[data-action="format-confirm"]').click();
  const doc = page.locator('.wx-page');
  await page.locator('.wx-top__title').fill('Kalıcılık denemesi');
  await doc.click();
  await page.keyboard.type('Yeniden yüklemeden sonra bu cümle durmalı.');
  await expect(page.locator('.wx-save')).toContainText('bu cihaza kaydedildi', { timeout: 5000 });
  await page.reload();
  await expect(doc).toContainText('Yeniden yüklemeden sonra bu cümle durmalı.');
  await expect(page.locator('.wx-top__title')).toHaveValue('Kalıcılık denemesi');
});
