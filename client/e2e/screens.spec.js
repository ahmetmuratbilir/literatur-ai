/* global process -- Playwright testleri Node'da koşar */
import { test } from '@playwright/test';
import { mockApi, seedDraft } from './fixtures.js';

/**
 * Görsel kontrol için ekran görüntüleri — doğrulama değil, inceleme aracı.
 * Yalnız SCREENS ortam değişkeniyle koşar: `SCREENS=1 npx playwright test screens`.
 */
const OUT = process.env.SCREENS_DIR || 'test-results/screens';

test.skip(!process.env.SCREENS, 'Yalnız elle inceleme için');

test('modül ekranları', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('uiLang', 'tr'));
  await seedDraft(page, '<h1>Giriş</h1><p>Küçük modüler reaktörlerde pasif güvenlik sistemleri harici güç olmadan çalışır (Chen &amp; Wang, 2021).</p><p>Doğal dolaşım kararlılığı 1 MPa altında bozulur.</p><h1>Kaynakça</h1>');
  await mockApi(page, { basket: [{ _id: 'b1', title: 'Passive decay heat removal in integral test facilities', creator: 'Chen, Li, Wang, Hui', year: 2021, doi: '10.1016/j.nucengdes.2021.110950', description: 'Passive decay heat removal was maintained for 72 hours without AC power.' }] });
  // WO-011: araştırma modu, kenar çubuğu sekmeleri (eski adreslerle açılır) ve yazar modu.
  for (const [name, hash] of [['arastirma', ''], ['calismalarim', '#/alanim'], ['sepet', '#/kaynaklar/sepet'], ['yazar', '#/yaz']]) {
    await page.goto(`/${hash}`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
});
