import { test, expect } from '@playwright/test';
import { mockApi, seedDraft, PAPERS } from './fixtures.js';

/**
 * WO-010 geçiş tablosu ve düğme envanteri. Her test bir satırı ya da bir
 * envanter grubunu doğruluyor; adlar iş emrindeki tabloyla eşleşiyor.
 */

const rail = (page, module) => page.locator(`[data-action="rail-${module}"]`);
const searchFor = async (page, topic) => {
  await page.locator('#topic-input').fill(topic);
  await page.getByRole('button', { name: 'Ara', exact: true }).click();
  await expect(page.getByRole('heading', { name: PAPERS[0].title })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Varsayılan dil İngilizce (i18n/context.js); testler Türkçe arayüzde koşar.
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
  });
});

test('açılışta kabuk: dört modül rayda, varsayılan Kaynaklar › Literatür ara', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await expect(page).toHaveURL(/#\/kaynaklar\/ara$/);
  for (const module of ['home', 'write', 'sources', 'audit']) await expect(rail(page, module)).toBeVisible();
  await expect(rail(page, 'sources')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-action="sources-search"]')).toHaveAttribute('aria-selected', 'true');
  // Eski düzenin parçaları kabukta çizilmez
  await expect(page.getByRole('complementary', { name: 'Gezinme' })).toHaveCount(0);
  await expect(page.locator('.ui-modes')).toHaveCount(0);
  await expect(page.locator('.ui-topbar')).toHaveCount(0);
});

test('ray ile gezinme: adres, konum çubuğu ve geri tuşu', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await rail(page, 'home').click();
  await expect(page).toHaveURL(/#\/alanim$/);
  await expect(page.locator('.la-crumbs')).toContainText('Alanım');
  await rail(page, 'write').click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect(page.locator('.wx--embedded')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/alanim$/);
  await expect(rail(page, 'home')).toHaveAttribute('aria-current', 'page');
});

test('sayfa yenileme aynı modülde bırakıyor', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/kaynaklar/sepet');
  await expect(page.locator('[data-action="sources-basket"]')).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(page).toHaveURL(/#\/kaynaklar\/sepet$/);
  await expect(page.locator('[data-action="sources-basket"]')).toHaveAttribute('aria-selected', 'true');
});

test('arama sonuçları Yazım\'a gidip gelince kaybolmuyor; sekme konuyu taşıyor', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/');
  await searchFor(page, 'pasif soğutma');
  expect(api.searches).toContain('pasif soğutma');
  await expect(page.locator('[data-action="tab-search"]')).toContainText('Arama: pasif soğutma');
  await rail(page, 'write').click();
  await expect(page.locator('.wx--embedded')).toBeVisible();
  await page.locator('[data-action="tab-search"]').click();
  await expect(page.getByRole('heading', { name: PAPERS[0].title })).toBeVisible();
});

test('"Makalene ekle" sepeti ve ray rozetini güncelliyor; Sepetim listeliyor; "Yazmaya geç" Yazım açıyor', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/');
  await searchFor(page, 'pasif soğutma');
  await page.getByRole('button', { name: 'Makalene ekle' }).first().click();
  await expect(page.locator('.la-rail__badge')).toHaveText('1');
  expect(api.basket).toHaveLength(1);
  await page.locator('[data-action="sources-basket"]').click();
  await expect(page).toHaveURL(/#\/kaynaklar\/sepet$/);
  await expect(page.locator('.la-list').getByText(PAPERS[0].title)).toBeVisible();
  await page.locator('[data-action="basket-write"]').click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect(page.locator('.wx--embedded')).toBeVisible();
});

test('sepet temizleme iki adımlı; tek tıklama silmiyor', async ({ page }) => {
  const api = await mockApi(page, { basket: [{ _id: 'b1', title: 'Sepetteki makale', doi: '10.1/x' }] });
  await page.goto('/#/kaynaklar/sepet');
  const clear = page.locator('[data-action="basket-clear"]');
  await clear.click();
  await expect(clear).toContainText('Emin misin');
  expect(api.basket).toHaveLength(1);
  await clear.click();
  await expect(page.locator('.la-empty')).toBeVisible();
  expect(api.basket).toHaveLength(0);
});

test('Alanım: geçmiş araması aramayı yeniden çalıştırır; yazar araması Araştırmacı açar', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/#/alanim');
  await page.locator('[data-action="home-history-open"]').filter({ hasText: 'pasif soğutma' }).click();
  await expect(page).toHaveURL(/#\/kaynaklar\/ara$/);
  await expect(page.locator('#topic-input')).toHaveValue('pasif soğutma');
  await expect.poll(() => api.searches.length).toBe(1);

  await rail(page, 'home').click();
  await page.locator('[data-action="home-history-open"]').filter({ hasText: 'Ayşe Yılmaz' }).click();
  await expect(page).toHaveURL(/#\/kaynaklar\/arastirmaci$/);
});

test('Alanım: geçmiş kaydı silinir, taslak kartı Yazım\'a götürür', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Pasif sistemler incelenmiştir.</p>');
  const api = await mockApi(page);
  await page.goto('/#/alanim');
  await expect(page.locator('.la-draft__text')).toContainText('E2E taslağı');
  await page.locator('[data-action="home-history-delete"]').first().click();
  await expect.poll(() => api.deletedHistory).toEqual(['h1']);
  await page.locator('[data-action="home-open-draft"]').click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect(page.locator('.wx-page')).toContainText('Pasif sistemler incelenmiştir.');
});

test('Favoriler listelenir ve kaldırılır', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/#/kaynaklar/favoriler');
  await expect(page.getByText('Favori makale')).toBeVisible();
  await page.locator('[data-action="favorite-remove"]').click();
  await expect.poll(() => api.deletedFavorites).toEqual(['f1']);
  await expect(page.getByText('Favori makale')).toHaveCount(0);
});

test('arama sekmesini kapatmak sonuçları temizler ve komşu sekmeye geçer', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');
  await rail(page, 'write').click();
  await page.locator('[data-action="tab-search"]').click();
  await searchFor(page, 'pasif soğutma');
  await page.locator('[data-action="tab-close-search"]').click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect(page.locator('[data-action="tab-search"]')).toHaveCount(0);
  await rail(page, 'sources').click();
  await expect(page.locator('#topic-input')).toHaveValue('');
  await expect(page.getByRole('heading', { name: PAPERS[0].title })).toHaveCount(0);
});

test('taslak sekmesini kapatmak belgeyi silmez', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/yazim');
  const doc = page.locator('.wx-page');
  await doc.click();
  await page.keyboard.type('Kalıcı cümle.');
  await page.locator('[data-action="tab-close-draft"]').click();
  await rail(page, 'write').click();
  await expect(doc).toContainText('Kalıcı cümle.');
});

test('odak modu rayı ve sekmeleri gizler, Esc geri getirir', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/yazim');
  await page.locator('[data-action="write-focus"]').click();
  await expect(page.locator('.la-rail')).toBeHidden();
  await expect(page.locator('.la-tabs')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('.la-rail')).toBeVisible();
  // Başka modüle geçince odak kalkar
  await page.locator('[data-action="write-focus"]').click();
  await page.locator('[data-action="focus-exit"]').click();
  await expect(page.locator('.la-rail')).toBeVisible();
});

test('Ctrl+K başka modüldeyken aramaya götürür ve kutuya odaklanır', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/alanim');
  await page.keyboard.press('Control+k');
  await expect(page).toHaveURL(/#\/kaynaklar\/ara$/);
  await expect(page.locator('#topic-input')).toBeFocused();
  await rail(page, 'home').click();
  await page.locator('[data-action="top-search"]').click();
  await expect(page.locator('#topic-input')).toBeFocused();
});

test('boş sepetle Yazım\'da "Literatürde kaynak bul" aramaya götürür', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/yazim');
  await page.locator('[data-action="side-sources"]').click();
  await page.locator('[data-action="write-find-sources"]').click();
  await expect(page).toHaveURL(/#\/kaynaklar\/ara$/);
});

test('"Dosyadan aktar" Sepetim\'den Yazım\'daki aktarma penceresini açar', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/kaynaklar/sepet');
  await page.locator('[data-action="basket-import"]').click();
  await expect(page).toHaveURL(/#\/yazim$/);
  await expect(page.getByRole('dialog', { name: 'Kaynak dosyasından aktar' })).toBeVisible();
});

test('paylaşılan bağlantı eski düzende açılır (WO-010 K6)', async ({ page }) => {
  await mockApi(page);
  await page.goto('/?s=abc');
  await expect(page.locator('.la-shell')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: PAPERS[0].title })).toBeVisible();
});

test('düğme envanteri: taşınan her eylemin yeni yerinde kimliği var', async ({ page }) => {
  await mockApi(page, { basket: [{ _id: 'b1', title: 'Sepetteki makale', doi: '10.1/x' }] });
  const expectAction = async (id) => expect(page.locator(`[data-action="${id}"]`).first(), id).toBeAttached();

  await page.goto('/#/alanim');
  for (const id of ['home-new-search', 'home-open-draft', 'home-history-open', 'home-history-delete', 'home-open-basket', 'top-search']) await expectAction(id);
  for (const m of ['home', 'write', 'sources', 'audit']) await expectAction(`rail-${m}`);

  await page.goto('/#/kaynaklar/sepet');
  for (const id of ['sources-search', 'sources-author', 'sources-basket', 'sources-favorites',
    'basket-write', 'basket-import', 'basket-bibtex', 'basket-ris', 'basket-clear', 'basket-remove']) await expectAction(id);

  await page.goto('/#/kaynaklar/favoriler');
  await expectAction('favorite-remove');

  await page.goto('/#/kaynaklar/ara');
  // Arama kartının eski düğmeleri aynen: ad üzerinden
  await expect(page.getByRole('button', { name: 'AI ile geliştir' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ara', exact: true })).toBeVisible();
  await searchFor(page, 'envanter');
  for (const name of ['Makalene ekle', 'Detay', 'Benzerini bul']) {
    await expect(page.getByRole('button', { name }).first(), name).toBeVisible();
  }
  await expect(page.getByRole('button', { name: 'Paylaş' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kaynaklarla yaz' })).toBeVisible();

  await page.goto('/#/yazim');
  await expectAction('write-focus');
});
