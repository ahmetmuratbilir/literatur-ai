import { test, expect } from '@playwright/test';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-018 — katmanlar, Esc yığını, ortak pencere, geri al (etkileşim planı §7,
 * ilk dört satır): iki katman açıkken bir Esc yalnız üsttekini kapatır;
 * pencerede odak dışarı çıkmaz ve kapanınca açan düğmeye döner; bildirim
 * üzerine gelince kapanmaz; hiçbir akışta tarayıcı kutusu çıkmaz.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

async function openWorks(page) {
  if (!(await page.getByTestId('sidebar-works').isVisible())) {
    await page.getByRole('button', { name: 'Çalışmalarım', exact: true }).click();
  }
  await expect(page.getByTestId('sidebar-works')).toBeVisible();
}

test('iki katman açıkken bir Esc yalnız üsttekini kapatır', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Katman metni.</p>', 'Katman');
  await mockApi(page);
  await page.goto('/#/yaz');
  await page.locator('[data-action="write-submit"]').click();
  const prep = page.getByTestId('submit-prep');
  await expect(prep).toBeVisible();
  await page.locator('.wx-page p').first().click();
  await page.locator('[data-action="write-insert"]').click();
  const pop = page.locator('.wx-pop');
  await expect(pop).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
  await expect(prep).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(prep).toHaveCount(0);
});

test('pencere: 20 Tab odağı dışarı bırakmaz; Esc kapatır, odak açan düğmeye döner', async ({ page }) => {
  await seedDraft(page, '<p>x</p>', 'Odak taslağı');
  await mockApi(page);
  await page.goto('/');
  await openWorks(page);
  const opener = page.locator('[data-action="draft-rename"]').first();
  await page.locator('[data-draft-id]').first().hover(); // düğmeler üzerine gelince görünür (WO-026)
  await opener.click();
  const dialog = page.getByTestId('dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('[data-action="dialog-input"]')).toBeFocused();
  await expect(page.locator('[data-action="dialog-input"]')).toHaveValue('Odak taslağı');
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-testid="dialog"]')))).toBe(true);
  }
  // Arka plan etkisiz: ekran okuyucu ve fare için
  expect(await page.locator('#root').evaluate((el) => el.inert)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await page.locator('#root').evaluate((el) => el.inert)).toBe(false);
});

test('pencerede değişiklik varken dışarı tıklamak kapatmaz; Vazgeç kapatır, ad değişmez', async ({ page }) => {
  await seedDraft(page, '<p>x</p>', 'Değişmeyecek ad');
  await mockApi(page);
  await page.goto('/');
  await openWorks(page);
  await page.locator('[data-draft-id]').first().hover(); // düğmeler üzerine gelince görünür (WO-026)
  await page.locator('[data-action="draft-rename"]').first().click();
  await page.locator('[data-action="dialog-input"]').fill('Yarım kalan ad');
  await page.mouse.click(5, 5);
  await expect(page.getByTestId('dialog')).toBeVisible();
  await page.locator('[data-action="dialog-cancel"]').click();
  await expect(page.getByTestId('dialog')).toHaveCount(0);
  await expect(page.getByTestId('sidebar-works')).toContainText('Değişmeyecek ad');
});

test('"Geri al" bildirimi üzerine gelince süresi dolsa da kapanmaz', async ({ page }) => {
  test.setTimeout(40_000);
  await seedDraft(page, '<p>x</p>', 'Silinip dönecek');
  await mockApi(page);
  await page.goto('/');
  await openWorks(page);
  await page.locator('[data-draft-id]').first().hover(); // düğmeler üzerine gelince görünür (WO-026)
  await page.locator('[data-action="draft-delete"]').click();
  const undo = page.locator('[data-action="toast-action"]');
  await expect(undo).toBeVisible();
  await undo.hover();
  await page.waitForTimeout(9000); // süre 8 sn
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(page.locator('[data-draft-id]')).toHaveCount(1);
});

test('hiçbir akışta tarayıcı kutusu (alert / confirm / prompt) çıkmaz', async ({ page }) => {
  const native = [];
  page.on('dialog', (d) => { native.push(d.type()); d.dismiss(); });
  await seedDraft(page, '<h1>Giriş</h1><p>Metin var.</p>', 'Kutu yok');
  await mockApi(page);
  await page.goto('/');
  await openWorks(page);
  await page.locator('[data-draft-id]').first().hover(); // düğmeler üzerine gelince görünür (WO-026)
  await page.locator('[data-action="draft-duplicate"]').first().click();
  await page.locator('[data-draft-id]').first().hover(); // düğmeler üzerine gelince görünür (WO-026)
  await page.locator('[data-action="draft-rename"]').first().click();
  await page.locator('[data-action="dialog-cancel"]').click();
  await page.locator('[data-draft-id]').first().hover(); // düğmeler üzerine gelince görünür (WO-026)
  await page.locator('[data-action="draft-delete"]').first().click();
  await page.locator('[data-action="toast-action"]').click();
  await page.locator('[data-action="draft-open"]').first().click();
  await expect(page.locator('.wx-page')).toBeVisible();
  // Biçim değişimi (tez → makale) boş bölümleri sorar: ürünün penceresiyle
  await page.locator('[data-action="write-format"]').click();
  await page.locator('.wx-fmt [data-action="format-thesis"]').click();
  await page.locator('.wx-fmt [data-action="format-confirm"]').click();
  await page.getByTestId('dialog').waitFor({ state: 'visible', timeout: 1500 }).then(() => page.locator('[data-action="dialog-cancel"]').click(), () => {});
  expect(native).toEqual([]);
});
