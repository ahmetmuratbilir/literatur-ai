import { test, expect } from '@playwright/test';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-017 — tek panel kabuk: ray (Araştırma, Yaz, Çalışmalarım …) her bölümde
 * görünür; yazım yüzeyi rayın sağında açılır, ayrı bir "yazar modu" dünyası
 * yok. Bölüm değişince araştırma sonuçları ve belge kaybolmaz.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

const rail = (page) => page.getByRole('complementary', { name: /./ }).first();
const research = (page) => page.locator('[data-action="nav-research"]');
const write = (page) => page.locator('[data-action="writer-dock"]');
const doc = (page) => page.locator('.wx-page');

test('ray Yaz bölümünde de görünür; yüzey rayın sağından başlar', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Kabuk metni.</p>', 'Kabuk taslağı');
  await mockApi(page);
  await page.goto('/');
  await expect(research(page)).toHaveAttribute('aria-current', 'page');
  await write(page).click();
  await expect(doc(page)).toBeVisible();
  await expect(research(page)).toBeVisible();
  await expect(write(page)).toHaveAttribute('aria-current', 'page');
  const railBox = await rail(page).boundingBox();
  const wxBox = await page.locator('.wx').boundingBox();
  expect(railBox.width).toBeGreaterThan(40);
  expect(wxBox.x).toBeGreaterThanOrEqual(railBox.x + railBox.width - 1);
});

test('Araştırma ↔ Yaz: sonuçlar ve belge kaybolmaz', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Kalıcı metin.</p>', 'Geçiş taslağı');
  await mockApi(page);
  await page.goto('/');
  await page.locator('#topic-input').fill('pasif soğutma');
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Makalene ekle' })).toHaveCount(2);
  await write(page).click();
  await expect(doc(page)).toContainText('Kalıcı metin.');
  await research(page).click();
  await expect(page.locator('#topic-input')).toHaveValue('pasif soğutma');
  await expect(page.getByRole('button', { name: 'Makalene ekle' })).toHaveCount(2);
  await expect(page).not.toHaveURL(/#\/yaz/);
  await write(page).click();
  await expect(doc(page)).toContainText('Kalıcı metin.');
});

test('Yaz düğmesi açık taslağın adını taşır (ekran okuyucu ve ipucu)', async ({ page }) => {
  await seedDraft(page, '<p>x</p>', 'Adlı taslak');
  await mockApi(page);
  await page.goto('/');
  await expect(write(page)).toHaveAttribute('aria-label', /Yaz · Adlı taslak/);
});

test('arayüzde "yazar modu" adı kalmadı (tüzük 2.13)', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Ad taraması.</p>', 'Ad');
  await mockApi(page);
  await page.goto('/');
  const read = async () => `${await page.locator('body').innerText()} ${(await page.locator('[aria-label],[title]').evaluateAll((els) => els.map((e) => `${e.getAttribute('aria-label') || ''} ${e.getAttribute('title') || ''}`).join(' ')))}`;
  expect(await read()).not.toMatch(/yazar modu/i);
  await write(page).click();
  await expect(doc(page)).toBeVisible();
  expect(await read()).not.toMatch(/yazar modu/i);
});

test('390 px: yatay kaydırma yok; ray gizli, yüzey tam genişlik', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await seedDraft(page, '<h1>Giriş</h1><p>Dar ekran.</p>', 'Dar');
  await mockApi(page);
  await page.goto('/#/yaz');
  await expect(doc(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const wxBox = await page.locator('.wx').boundingBox();
  expect(wxBox.x).toBe(0);
});
