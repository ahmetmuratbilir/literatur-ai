import { test, expect } from '@playwright/test';
import { mockApi } from './fixtures.js';

/**
 * WO-029 — veri kaynakları penceresi (tüzük 2.7 "Atıf yükümlülükleri"):
 * kenar çubuğundan açılır, sağlayıcıların istediği ibareler görünür, Esc kapatır.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

test('veri kaynakları: açılır, atıf ibareleri ve bağlantılar yerinde, Esc kapatır', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  // Kaynaklar rayda değil (simge kalabalığı); açık kenar çubuğunda hesap ⋯ menüsünde.
  await page.locator('[data-action="sidebar-toggle"]').click();
  await page.locator('[data-action="account-menu"]').click();
  await page.locator('[data-action="nav-sources"]').click();
  const dialog = page.getByTestId('data-sources');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Veri kaynakları' })).toBeVisible();

  // Sağlayıcıların istediği ibareler (2.7).
  await expect(dialog.getByText(/Priem, J\., Piwowar, H\./)).toBeVisible();
  await expect(dialog.getByText('Courtesy of the U.S. National Library of Medicine.')).toBeVisible();
  await expect(dialog.getByText(/arXiv’e açık erişim birlikte çalışabilirliği/)).toBeVisible();
  await expect(dialog.getByText(/OpenAIRE Graph verisi içerir \(CC BY 4\.0\)/)).toBeVisible();
  // Semantic Scholar bağlantısı utm_source=api taşır.
  await expect(dialog.getByRole('link', { name: 'Semantic Scholar' })).toHaveAttribute('href', /utm_source=api/);
  // Çevrilmemiş anahtar sızmaz.
  await expect(dialog).not.toContainText('dataSources.');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
