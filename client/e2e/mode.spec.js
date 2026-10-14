import { test, expect } from '@playwright/test';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * WO-011 Faz 1 — araştırma ↔ yazar modu, çoklu taslak, eski adresler ve
 * biçim seçimi. Sunucu fixtures.js'teki sahte cevaplarla çalışır; taslaklar
 * gerçek localStorage'da tutulur (taslak katmanında sahte yok).
 */

const INDEX_KEY = 'literatur-ai:drafts:v1';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok say */ }
    // Geliştirme şeridi durum çubuğunu örtüyor. React'in düğümüne dokunmadan, yalnız stille gizlenir.
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
});

const doc = (page) => page.locator('.wx-page');
const researchVisible = (page) => expect(page.locator('#topic-input')).toBeVisible();
const writerHidden = (page) => expect(page.locator('.wx-page')).toBeHidden();

const draftsIndex = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), INDEX_KEY);

/** Kenar çubuğunda Çalışmalarım sekmesini açar. */
async function openWorks(page) {
  if (!(await page.getByTestId('sidebar-works').isVisible())) {
    await page.getByRole('button', { name: 'Çalışmalarım', exact: true }).click();
  }
  await expect(page.getByTestId('sidebar-works')).toBeVisible();
}

/** Biçim seçicide biçimi seçer, adını verir ve taslağı açar. */
async function createDraft(page, formatId, name) {
  await page.locator(`[data-action="format-${formatId}"]`).click();
  await page.locator('[data-action="format-name"]').fill(name);
  await page.locator('[data-action="format-confirm"]').click();
  await expect(doc(page)).toBeVisible();
}

/** Belgenin ilk paragrafının sonuna yazar. */
async function typeInFirstParagraph(page, text) {
  await doc(page).locator('p').first().click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}

const LONG_DOC = `<h1>Giriş</h1><p>Başlangıç cümlesi.</p>${'<p>Dolgu paragrafı; sayfayı uzatmak için tekrar ediyor.</p>'.repeat(60)}<h1>Kaynakça</h1>`;

test('araştırma ↔ yazar: metin, imleç ve kaydırma korunuyor', async ({ page }) => {
  await seedDraft(page, LONG_DOC, 'Mod geçiş taslağı');
  await mockApi(page);
  await page.goto('/#/yazar');
  await typeInFirstParagraph(page, ' EKLENDİ');

  const desk = page.locator('.wx-desk');
  await desk.evaluate((el) => { el.scrollTop = 600; el.dispatchEvent(new Event('scroll')); });
  // Kaydırma imleci taşımaz: seçim ilk paragrafta kalır.
  await page.locator('.wx-exit').click();
  await researchVisible(page);
  await writerHidden(page);
  await expect(page).not.toHaveURL(/#\/yazar/);

  await page.locator('[data-action="writer-dock"]').click();
  await expect(page).toHaveURL(/#\/yazar$/);
  await expect(doc(page)).toBeVisible();
  expect(await desk.evaluate((el) => el.scrollTop)).toBeGreaterThan(500);
  // İmleç geri geldi: tıklamadan yazınca aynı yere eklenir.
  await page.keyboard.type(' DEVAM');
  await expect(doc(page).locator('p').first()).toHaveText('Başlangıç cümlesi. EKLENDİ DEVAM');
});

test('tarayıcının geri düğmesi yazar modundan araştırmaya döner, ileri yeniden açar', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Geri düğmesi metni.</p>', 'Geri taslağı');
  await mockApi(page);
  await page.goto('/');
  await researchVisible(page);
  await expect(page.locator('[data-action="writer-dock"]')).toContainText('Geri taslağı');
  await page.locator('[data-action="writer-dock"]').click();
  await expect(doc(page)).toContainText('Geri düğmesi metni.');

  await page.goBack();
  await researchVisible(page);
  await writerHidden(page);
  await page.goForward();
  await expect(doc(page)).toContainText('Geri düğmesi metni.');
});

test('iki taslak: ayrı içerik, aralarında geçiş, yeniden yüklemede açık taslak', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/yazar');
  await createDraft(page, 'article', 'Makale A');
  await typeInFirstParagraph(page, 'AAA metni');
  await page.locator('.wx-exit').click();

  await openWorks(page);
  await page.locator('[data-action="draft-new"]').click();
  await createDraft(page, 'thesis', 'Tez B');
  await typeInFirstParagraph(page, 'BBB metni');
  await page.locator('.wx-exit').click();

  await openWorks(page);
  const rows = page.locator('[data-draft-id]');
  await expect(rows).toHaveCount(2);
  await rows.filter({ hasText: 'Makale A' }).locator('[data-action="draft-open"]').click();
  await expect(doc(page)).toContainText('AAA metni');
  await expect(doc(page)).not.toContainText('BBB metni');
  await expect(page.locator('.wx-top__title')).toHaveValue('Makale A');

  await page.reload();
  await expect(doc(page)).toContainText('AAA metni');
  const index = await draftsIndex(page);
  expect(index.items.map((d) => d.title).sort()).toEqual(['Makale A', 'Tez B']);
});

test('taslak silme onay ister ve "Geri al" taslağı geri getirir', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Silinecek metin.</p>', 'Silinecek taslak');
  await mockApi(page);
  await page.goto('/');
  await openWorks(page);
  await expect(page.locator('[data-draft-id]')).toHaveCount(1);
  await expect(page.getByTestId('drafts-local-warn')).toBeVisible();

  // İlk denemede vazgeçilir: hiçbir şey silinmez.
  page.once('dialog', (d) => d.dismiss());
  await page.locator('[data-action="draft-delete"]').click();
  await expect(page.locator('[data-draft-id]')).toHaveCount(1);

  page.once('dialog', (d) => d.accept());
  await page.locator('[data-action="draft-delete"]').click();
  await expect(page.locator('[data-draft-id]')).toHaveCount(0);
  await page.locator('[data-action="toast-action"]').click();
  await expect(page.locator('[data-draft-id]')).toHaveCount(1);
  await page.locator('[data-action="draft-open"]').click();
  await expect(doc(page)).toContainText('Silinecek metin.');
});

test('eski adresler yeni yerlerine yönleniyor', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Yönlendirme.</p>', 'Yönlendirme taslağı');
  await mockApi(page);

  await page.goto('/#/yazim');
  await expect(page).toHaveURL(/#\/yazar$/);
  await expect(doc(page)).toContainText('Yönlendirme.');

  await page.goto('/#/denetim');
  await expect(page).toHaveURL(/#\/yazar\/kontrol$/);
  await expect(doc(page)).toBeVisible();

  await page.goto('/#/alanim');
  await expect(page).not.toHaveURL(/#/);
  await expect(page.getByTestId('sidebar-works')).toBeVisible();

  await page.goto('/#/kaynaklar/sepet');
  await expect(page).not.toHaveURL(/#/);
  await expect(page.getByRole('button', { name: 'Makalen için', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('biçim seçici: tez 19 bölüm ve A4 kuruyor, yalnız desteklenen atıf stilleri', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/yazar');
  await expect(page.locator('[data-action="format-style"] option')).toHaveText(['APA 7', 'IEEE', 'MLA', 'Chicago']);
  await page.locator('[data-action="format-thesis"]').click();
  await expect(page.getByTestId('format-sections').locator('li')).toHaveCount(19);
  await expect(page.getByTestId('format-page')).toContainText('A4');
  await page.locator('[data-action="format-style"]').selectOption('IEEE');
  await page.locator('[data-action="format-confirm"]').click();

  await expect(doc(page).locator('h1')).toHaveCount(19);
  await expect(page.locator('[data-action="write-format"]')).toContainText('IEEE');
  await expect(page.locator('[data-action="write-format"]')).toContainText('A4');
  // Kaydetme otomatik; sahte "Kaydet" düğmesi yok, hata yokken "Tekrar dene" de yok.
  await expect(page.locator('.wx-top').getByRole('button', { name: /^Kaydet$/ })).toHaveCount(0);
  await expect(page.locator('[data-action="write-save-retry"]')).toHaveCount(0);
});

test('biçim değiştirme: eksik bölümler eklenir, yazılmış metin silinmez', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/yazar');
  await createDraft(page, 'article', 'Biçim değişimi');
  await typeInFirstParagraph(page, 'Korunacak metin');
  await page.locator('[data-action="write-format"]').click();
  await page.locator('.wx-fmt [data-action="format-thesis"]').click();
  await expect(page.getByTestId('format-plan')).toBeVisible();
  // Boş makale bölümlerini kaldırma sorusu: hayır de, hiçbir başlık silinmesin.
  page.once('dialog', (d) => d.dismiss());
  await page.locator('.wx-fmt [data-action="format-confirm"]').click();
  await expect(doc(page)).toContainText('Korunacak metin');
  await expect(doc(page).getByRole('heading', { name: 'Özgeçmiş' })).toBeVisible();
  await expect(doc(page).getByRole('heading', { name: 'Kaynakça' })).toHaveCount(1);
});

test('otomatik kayıt odak kaybı beklemeden yazıyor', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/yazar');
  await createDraft(page, 'blank', 'Otomatik kayıt');
  await doc(page).click();
  await page.keyboard.type('Odak kaybı olmadan kaydedilmeli.');
  // Odak belgede kalıyor; kayıt gecikmeli zamanlayıcıdan gelmeli.
  await expect.poll(() => page.evaluate((key) => {
    const index = JSON.parse(localStorage.getItem(key) || 'null');
    const raw = index && localStorage.getItem(`literatur-ai:draft:${index.activeId}`);
    return raw ? JSON.parse(raw).html : '';
  }, INDEX_KEY), { timeout: 5000 }).toContain('Odak kaybı olmadan kaydedilmeli.');
  await expect(doc(page)).toBeFocused();
});

// --- Faz 1 ek: iki sekme, biçim gidiş-dönüşü, depolama yok ------------------

const BANNER = () => {
  document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
};
const storedHtml = (page) => page.evaluate((key) => {
  const index = JSON.parse(localStorage.getItem(key) || 'null');
  const id = sessionStorage.getItem('literatur-ai:open-draft') || index?.activeId;
  return id ? JSON.parse(localStorage.getItem(`literatur-ai:draft:${id}`) || '{}').html || '' : '';
}, INDEX_KEY);

test('iki sekme: ikincisi salt okunur, değişiklik sessizce gelir, "Burada düzenle" düzenlemeyi devralır', async ({ page, context }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Ortak.</p>', 'İki sekme');
  await mockApi(page);
  await page.goto('/#/yazar');
  await typeInFirstParagraph(page, ' AAA');
  await expect.poll(() => storedHtml(page)).toContain('AAA');

  const b = await context.newPage();
  await b.addInitScript(BANNER);
  await mockApi(b);
  await b.goto('/#/yazar');
  await expect(b.getByTestId('draft-locked')).toBeVisible();
  await expect(doc(b)).toHaveAttribute('contenteditable', 'false');
  await expect(doc(b)).toContainText('Ortak. AAA');
  await expect(page.getByTestId('draft-locked')).toHaveCount(0);

  // A yazmaya devam ediyor: B'ye sessizce gelir.
  await page.keyboard.type(' A2');
  await expect(doc(b)).toContainText('Ortak. AAA A2');

  // B devralır: A salt okunur olur, B yazar, A'ya gelir; hiçbir metin kaybolmaz.
  await b.locator('[data-action="draft-take-over"]').click();
  await expect(page.getByTestId('draft-locked')).toBeVisible();
  await expect(doc(page)).toHaveAttribute('contenteditable', 'false');
  await expect(doc(b)).toHaveAttribute('contenteditable', 'true');
  await doc(b).locator('p').first().click();
  await b.keyboard.press('End');
  await b.keyboard.type(' BBB');
  await expect(doc(page)).toContainText('Ortak. AAA A2 BBB');
  await expect.poll(() => storedHtml(page)).toContain('Ortak. AAA A2 BBB');
  // Çakışma olmadı: tek taslak.
  expect((await draftsIndex(page)).items).toHaveLength(1);
});

test('iki tarafta da kaydedilmemiş değişiklik varsa hiçbiri ezilmez: çakışma kopyası', async ({ page, context }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Ortak.</p>', 'Çakışma');
  await mockApi(page);
  // A'nın zamanlayıcıları durdurulur: yazdığı kaydedilmemiş (kirli) kalır.
  await page.clock.install();
  await page.goto('/#/yazar');
  await expect(doc(page)).toContainText('Ortak.');
  // Öbür sekme önce açılır: yeni sekme açılınca A gizlenir ve gizlenen sekme
  // bekleyen kaydını yazar (tasarım gereği). A'ya dönüp yazınca A kirli kalır.
  const b = await context.newPage();
  await mockApi(b);
  await b.goto('/');
  await page.bringToFront();
  await typeInFirstParagraph(page, ' BENİM');

  // Başka bir sekme (kilidi görmemiş, ör. süresi dolmuş kilit) daha yeni sürüm yazar.
  await b.evaluate((key) => {
    const index = JSON.parse(localStorage.getItem(key));
    const k = `literatur-ai:draft:${index.activeId}`;
    const stored = JSON.parse(localStorage.getItem(k));
    localStorage.setItem(k, JSON.stringify({ ...stored, html: '<h1>Giriş</h1><p>Ortak. ONLARIN</p>', rev: (stored.rev || 0) + 1 }));
  }, INDEX_KEY);

  // A öbür sürüme geçer; kendi metni ayrı taslakta durur.
  await expect(doc(page)).toContainText('Ortak. ONLARIN');
  const index = await draftsIndex(page);
  expect(index.items).toHaveLength(2);
  const copy = index.items.find((d) => d.title.includes('çakışma kopyası'));
  expect(copy).toBeTruthy();
  const copyHtml = await page.evaluate((id) => JSON.parse(localStorage.getItem(`literatur-ai:draft:${id}`)).html, copy.id);
  expect(copyHtml).toContain('Ortak. BENİM');
  await expect(page.locator('.ui-toast')).toContainText('Taslak başka bir sekmede de değişti');
});

test('bir sekmede başka taslak açmak öbür sekmenin belgesini değiştirmez', async ({ page, context }) => {
  await mockApi(page);
  await page.goto('/#/yazar');
  await createDraft(page, 'blank', 'Birinci');
  await doc(page).click();
  await page.keyboard.type('Birinci metni.');
  await expect.poll(() => storedHtml(page)).toContain('Birinci metni.');

  const b = await context.newPage();
  await b.addInitScript(BANNER);
  await mockApi(b);
  await b.goto('/');
  await openWorks(b);
  await b.locator('[data-action="draft-new"]').click();
  await createDraft(b, 'blank', 'İkinci');

  await page.bringToFront();
  await page.waitForTimeout(500);
  await expect(page.locator('.wx-top__title')).toHaveValue('Birinci');
  await expect(doc(page)).toContainText('Birinci metni.');
});

test('biçim gidiş-dönüşü: Makale → Tez → Makale belge yapısını başlangıca döndürür, metin kalır', async ({ page }) => {
  await mockApi(page);
  await page.goto('/#/yazar');
  await createDraft(page, 'article', 'Gidiş dönüş');
  const intro = doc(page).locator('h2[data-template-section="intro"] + p');
  await intro.click();
  await page.keyboard.type('Giriş metni duruyor.');
  const structure = () => doc(page).locator('h1, h2, h3').evaluateAll((els) => els.map((e) => `${e.tagName}|${e.dataset.templateSection || ''}|${e.textContent.trim()}`));
  const before = await structure();

  page.on('dialog', (d) => d.accept());
  for (const f of ['thesis', 'article']) {
    await page.locator('[data-action="write-format"]').click();
    await page.locator(`.wx-fmt [data-action="format-${f}"]`).click();
    await page.locator('.wx-fmt [data-action="format-confirm"]').click();
    await expect(page.locator('.wx-fmt')).toHaveCount(0);
    if (f === 'thesis') {
      // Tez bölümleri makalenin seviyesine (h2) uyar; makale bölümlerini alt bölüm yapmaz.
      await expect(doc(page).locator('h1')).toHaveCount(0);
      await expect(doc(page).getByRole('heading', { name: 'Özgeçmiş' })).toBeVisible();
    }
  }
  expect(await structure()).toEqual(before);
  await expect(doc(page)).toContainText('Giriş metni duruyor.');
});

test('depolama yazılamıyorsa yazmak serbest: kalıcı uyarı, DOCX ve çıkış uyarısı', async ({ page }) => {
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(k, v) {
      if (this === window.localStorage && String(k).startsWith('literatur-ai:')) throw new DOMException('dolu', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  });
  await mockApi(page);
  await page.goto('/#/yazar');
  await createDraft(page, 'blank', 'Kayıtsız');
  await expect(page.getByTestId('storage-warn')).toBeVisible();
  await doc(page).click();
  await page.keyboard.type('Kaydedilemese de yazılabiliyor.');
  await expect(doc(page)).toContainText('Kaydedilemese de yazılabiliyor.');
  await page.waitForTimeout(1200);
  await expect(page.getByTestId('storage-warn')).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="storage-docx"]').click()]);
  expect(download.suggestedFilename()).toMatch(/\.docx$/);

  const dialog = new Promise((resolve) => page.once('dialog', (d) => { resolve(d.type()); d.dismiss(); }));
  await page.close({ runBeforeUnload: true });
  expect(await dialog).toBe('beforeunload');
});

// WO-010 kabuk testlerinden yeni yerlerine taşınanlar (Alanım ve Sepetim kalktı).

test('Çalışmalarım: son arama aramayı yeniden çalıştırır, kayıt silinir', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/');
  await openWorks(page);
  const works = page.getByTestId('sidebar-works');
  await works.getByRole('button', { name: 'pasif soğutma' }).click();
  await expect(page.locator('#topic-input')).toHaveValue('pasif soğutma');
  await expect.poll(() => api.searches.length).toBe(1);

  await openWorks(page);
  await works.getByRole('button', { name: 'Geçmişten sil' }).first().click();
  await expect.poll(() => api.deletedHistory).toEqual(['h1']);
});

test('Favoriler listelenir ve kaldırılır', async ({ page }) => {
  const api = await mockApi(page);
  await page.goto('/#/kaynaklar/favoriler');
  await expect(page.getByText('Favori makale')).toBeVisible();
  await page.getByRole('button', { name: 'Favorilerden çıkar' }).click();
  await expect.poll(() => api.deletedFavorites).toEqual(['f1']);
  await expect(page.getByText('Favori makale')).toHaveCount(0);
});

test('kenar çubuğunda sepet temizleme iki adımlı; tek tıklama silmiyor', async ({ page }) => {
  const api = await mockApi(page, { basket: [{ _id: 'b1', title: 'Sepetteki makale', doi: '10.1/x' }] });
  await page.goto('/#/kaynaklar/sepet');
  const clear = page.locator('[data-action="basket-clear"]');
  await clear.click();
  await expect(clear).toContainText('Emin misin');
  expect(api.basket).toHaveLength(1);
  await clear.click();
  await expect.poll(() => api.basket.length).toBe(0);
  await expect(page.getByText('Henüz makale tutmadın.', { exact: false })).toBeVisible();
});

test('boş sepetle yazar modunda "Literatürde kaynak bul" araştırmaya döner', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Kaynak arıyorum.</p>', 'Kaynak bul');
  await mockApi(page);
  await page.goto('/#/yazar');
  await page.locator('[data-action="side-sources"]').click();
  await page.locator('[data-action="write-find-sources"]').click();
  await researchVisible(page);
  await expect(page).not.toHaveURL(/#\/yazar/);
});

test('dürüstlük taraması: yeni ekranlarda yasak kalıp yok', async ({ page }) => {
  await seedDraft(page, '<h1>Giriş</h1><p>Tarama metni.</p>', 'Tarama');
  await mockApi(page);
  const forbidden = [/senkronize/i, /güven skoru/i, /doğruluk\s*%/i, /%\s*\d+\s*hazır/i, /hakem onaylı/i, /AHP:\s*\d/, /hazırlık skoru/i, /bulut(a)? kaydedildi/i];
  await page.goto('/');
  await openWorks(page);
  const screens = [['araştırma + Çalışmalarım', () => page.locator('body').innerText()]];
  for (const [name, read] of screens) {
    const text = await read();
    for (const pattern of forbidden) expect(text, `${name} ${pattern}`).not.toMatch(pattern);
  }
  await page.goto('/#/yazar');
  await expect(doc(page)).toBeVisible();
  let text = await page.locator('body').innerText();
  for (const pattern of forbidden) expect(text, `yazar ${pattern}`).not.toMatch(pattern);
  await page.locator('[data-action="write-format"]').click();
  text = await page.locator('.wx-fmt').innerText();
  for (const pattern of forbidden) expect(text, `biçim ${pattern}`).not.toMatch(pattern);
});
