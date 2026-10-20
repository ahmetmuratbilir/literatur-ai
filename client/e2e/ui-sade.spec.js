import { test, expect } from '@playwright/test';
import { API, mockApi, seedDraft } from './fixtures.js';

/**
 * WO-026 Faz 4 — arama ana sayfası (A2) ve "AI ile geliştir" geçişi (T3+T1).
 * Kutucuklar yalnız kullanıcının kendi verisinden; veri yoksa "örnek" konular.
 * AI beklerken iskelet, yanıt gelince satırlar.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

test('yeni kullanıcı: "örnek" etiketli konular; tıklayınca konu kutusuna yazılır, uydurma sayı yok', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  const examples = page.getByTestId('home-examples');
  await expect(examples).toBeVisible();
  await expect(examples).toContainText('örnek');
  await expect(page.getByTestId('home-resume')).toHaveCount(0);
  await examples.locator('[data-action="home-example"]').first().click();
  await expect(page.locator('#topic-input')).toHaveValue('küçük modüler reaktörlerde pasif soğutma');
  await expect(page.locator('#topic-input')).toBeFocused();
});

test('taslağı olan kullanıcı: "Son taslağın" kutucuğu kendi taslağını açar', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Kısa bir metin.</p>', 'Tez taslağı');
  await mockApi(page);
  await page.goto('/');
  const tile = page.locator('[data-action="home-last-draft"]');
  await expect(tile).toContainText('Son taslağın');
  await expect(tile).toContainText('Tez taslağı');
  await expect(page.getByTestId('home-examples')).toHaveCount(0);
  await tile.click();
  await expect(page.locator('.wx-page')).toContainText('Kısa bir metin.');
});

test('AI ile geliştir: beklerken iskelet, yanıt gelince öneri satırları', async ({ page }) => {
  await mockApi(page);
  let release;
  await page.route(`${API}/api/analyze-query`, async (route) => {
    await new Promise((r) => { release = r; });
    await route.fulfill({ json: {
      intent: 'Pasif soğutma literatürü', keywords: [{ label: 'pasif soğutma', term: 'passive cooling', weight: 3 }],
      queries: [
        { label: 'Genel', text: '"passive cooling" AND SMR', keywords: ['pasif soğutma', 'SMR'] },
        { label: 'Yöntem', text: '"passive cooling" AND simulation', keywords: ['pasif soğutma', 'simülasyon'] },
      ],
      explanation: '', lang: 'tr',
    } });
  });
  await page.goto('/');
  await page.locator('#topic-input').fill('pasif soğutma');
  await page.getByRole('button', { name: /AI ile geliştir/ }).click();
  await expect(page.getByTestId('ai-skeleton')).toBeVisible();
  release();
  await expect(page.getByTestId('ai-skeleton')).toHaveCount(0);
  await expect(page.locator('.ai-row')).toHaveCount(2);
  await expect(page.locator('.ai-row').nth(1)).toHaveCSS('opacity', '1');
});

test('WO-030 bulgu 7: Son aramalar ve AI analizleri katlanır, varsayılan kapalı; boşken açıklama kutusu yok', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await page.locator('[data-action="sidebar-toggle"]').click();
  await page.getByRole('button', { name: 'Çalışmalarım' }).click();
  const works = page.getByTestId('sidebar-works');
  const recent = works.locator('[data-action="list-recent"]');
  const analyses = works.locator('[data-action="list-analyses"]');
  await expect(recent).toHaveAttribute('aria-expanded', 'false');
  await expect(analyses).toHaveAttribute('aria-expanded', 'false');
  await expect(works.getByText('pasif soğutma')).toHaveCount(0);
  await recent.click();
  await expect(recent).toHaveAttribute('aria-expanded', 'true');
  await expect(works.getByText('pasif soğutma')).toBeVisible();
  await analyses.click();
  await expect(works.getByText('SMR güvenliği')).toBeVisible();
  await analyses.click();
  await expect(works.getByText('SMR güvenliği')).toHaveCount(0);
});

test('WO-030 bulgu 7: liste boşken açılınca da açıklama kutusu çıkmaz', async ({ page }) => {
  await mockApi(page, { history: [], analyses: [] });
  await page.goto('/');
  await page.locator('[data-action="sidebar-toggle"]').click();
  await page.getByRole('button', { name: 'Çalışmalarım' }).click();
  const works = page.getByTestId('sidebar-works');
  await works.locator('[data-action="list-recent"]').click();
  await works.locator('[data-action="list-analyses"]').click();
  await expect(works.getByText('Henüz arama yapılmadı', { exact: false })).toHaveCount(0);
  await expect(works.getByText('analizleri burada birikir', { exact: false })).toHaveCount(0);
});
