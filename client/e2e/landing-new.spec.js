import { test, expect } from '@playwright/test';
import { mockApi } from './fixtures.js';

/**
 * Yeni açılış sayfası (ana sayfa v9). Kullanıcı kararı 20.10.2026: yenisi
 * varsayılan, eskisi ?giris=eski ile açılır. Geliştirmede
 * Clerk kapalı olduğundan açılış sayfası ?landing ile önizlenir.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
  });
  await mockApi(page);
});

test('varsayılan yeni açılış sayfası; eskisi ?giris=eski ile', async ({ page }) => {
  await page.goto('/?landing');
  await expect(page.locator('.ln h1')).toContainText('Yüz makale değil,');
  await expect(page.locator('.lp')).toHaveCount(0);

  await page.goto('/?landing&giris=eski');
  await expect(page.locator('.lp')).toBeVisible();
  await expect(page.locator('.ln')).toHaveCount(0);
});

test('yeni açılış: sınıf sekmesi, menüden bölüme gitme, dil ve tema; kodda olmayan vaat yok', async ({ page }) => {
  await page.goto('/?landing&giris=yeni');
  const ln = page.locator('.ln');

  await ln.locator('.class-btn[data-c="bad"]').click();
  await expect(ln.locator('.class-card h3')).toHaveText('çelişiyor');
  await ln.locator('.class-btn[data-c="bad"]').press('ArrowDown');
  await expect(ln.locator('.class-card h3')).toHaveText('kanıt yok');

  await ln.locator('.nav__links a', { hasText: 'Kaynaklar' }).click();
  await expect(ln.locator('#kaynaklar')).toBeInViewport();
  await expect(ln.locator('.src-chip').first()).toBeVisible();

  // Tüzük 2.8: bugün kodda olmayan Türkçe korpus ve girişsiz deneme vaat edilmez.
  await expect(ln).not.toContainText('DergiPark');
  await expect(ln).not.toContainText('Kayıt olmadan');

  await ln.locator('.lang button', { hasText: 'EN' }).click();
  await expect(ln.locator('h1 .l1')).toHaveText('Not a hundred papers,');
  await ln.locator('.icon-btn').click();
  await expect(ln).toHaveAttribute('data-theme', 'dark');
});
