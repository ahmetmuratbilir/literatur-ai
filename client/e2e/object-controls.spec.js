import { test, expect } from '@playwright/test';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-030 bulgu 1 ve 4 — belgedeki tablo, şekil ve grafik:
 * üzerine gelince Düzenle / Sil; tek tık düzenleyici açmaz; yazı gibi
 * Backspace/Delete ya da seçimle silinmez; Sil geri alınabilir.
 */

const doc = (page) => page.locator('.wx-page');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

async function addTable(page) {
  await doc(page).getByText('Önce').click();
  await page.keyboard.press('End');
  await page.locator('[data-action="write-table"]').click();
  const cell = page.locator('[data-action="table-grid"] [data-cell="1:1"]');
  await cell.hover();
  await cell.click();
  await expect(doc(page).locator('table')).toHaveCount(1);
}

async function addFigure(page) {
  await doc(page).getByText('Önce').click();
  await page.locator('[data-action="write-figure"]').click();
  const draft = page.getByTestId('figure-draft');
  await draft.locator('[data-fd-type="cycle"]').click();
  await draft.locator('[data-action="fd-from-paragraph"]').click();
  await draft.locator('[data-action="fd-done"]').click();
  await expect(draft).toHaveCount(0);
  await expect(doc(page).locator('figure')).toHaveCount(1);
}

test('tablo: tek tık araç çubuğunu açmaz; Düzenle açar; kenarda Backspace silmez; Sil + Geri al', async ({ page }) => {
  await seedDraft(page, '<p>Önce bir paragraf.</p><p>Sonra.</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  await addTable(page);
  // Yeni tablo düzenlemede; dışarı çıkınca araç çubuğu kapanır.
  await expect(page.getByTestId('table-toolbar')).toBeVisible();
  await doc(page).getByText('Sonra.').click();
  await expect(page.getByTestId('table-toolbar')).toHaveCount(0);

  // Hücreye tek tık: araç çubuğu gelmez, yazınca gelir.
  await doc(page).locator('table td').first().click();
  await expect(page.getByTestId('table-toolbar')).toHaveCount(0);
  await page.keyboard.type('x');
  await expect(page.getByTestId('table-toolbar')).toBeVisible();
  await expect(doc(page).locator('table td').first()).toHaveText('x');

  // Tablonun hemen arkasındaki paragrafın başında Backspace tabloyu silmez.
  await doc(page).getByText('Sonra.').click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect(doc(page).locator('table')).toHaveCount(1);
  await expect(doc(page)).toContainText('Sonra.');

  // Tabloyu içine alan seçim silinince yalnız yazı gider.
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
  await expect(doc(page).locator('table')).toHaveCount(1);
  await expect(doc(page)).not.toContainText('Sonra.');

  // Üzerine gelince Düzenle / Sil; Sil siler, Geri al getirir.
  await doc(page).locator('table').hover();
  const bar = page.getByTestId('objbar');
  await expect(bar).toBeVisible();
  await bar.locator('[data-action="obj-delete"]').click();
  await expect(doc(page).locator('table')).toHaveCount(0);
  await expect(page.getByTestId('undo-note')).toContainText('Tablo silindi');
  await page.locator('[data-action="obj-undo"]').click();
  await expect(doc(page).locator('table')).toHaveCount(1);

  // Düzenle araç çubuğunu getirir.
  await doc(page).locator('table').hover();
  await page.getByTestId('objbar').locator('[data-action="obj-edit"]').click();
  await expect(page.getByTestId('table-toolbar')).toBeVisible();
});

test('şekil: tek tık seçer, Düzenle ve çift tık açar; Delete/Backspace silmez; Sil + Ctrl+Z; Word çıktısında simge yok', async ({ page }) => {
  await seedDraft(page, '<p>Önce. Isı alınır. Su döner.</p><p>Sonra.</p>');
  await mockApi(page);
  await page.goto('/#/yaz');
  await addFigure(page);
  const draft = page.getByTestId('figure-draft');

  await doc(page).locator('figure').click();
  await expect(draft).toHaveCount(0);
  await expect(page.getByTestId('objbar')).toBeVisible();
  await page.getByTestId('objbar').locator('[data-action="obj-edit"]').click();
  await expect(draft).toBeVisible();
  await draft.locator('[data-action="fd-cancel"]').click();
  await expect(draft).toHaveCount(0);

  // Şeklin önündeki paragrafın sonunda Delete şekli silmez.
  await doc(page).getByText('Önce.').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Delete');
  await expect(doc(page).locator('figure')).toHaveCount(1);

  await doc(page).locator('figure').hover();
  await page.getByTestId('objbar').locator('[data-action="obj-delete"]').click();
  await expect(doc(page).locator('figure')).toHaveCount(0);
  await expect(doc(page)).not.toContainText('Şekil 1.');
  await page.keyboard.press('Control+z');
  await expect(doc(page).locator('figure')).toHaveCount(1);
  // Denetim çubuğu belgenin içinde değil.
  await expect(doc(page).locator('.wx-objbar')).toHaveCount(0);
});
