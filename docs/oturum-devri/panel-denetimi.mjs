// Panel denetim aracı (WO-024 oturumu, 18.10.2026). Sahte API ile 11 ekranı
// açar, her tuşu ayrı ayrı tıklar; ipucu, erişilebilir ad, hedef boyutu, kontrast,
// küçük yazı, kaydırma alanı ve konsol hatalarını report.json'a yazar.
// Çalıştırma (client dev sunucusu 5173'te açıkken, proje kökünden):
//   CLIENT="$PWD/client" OUT="./denetim-cikti" node docs/oturum-devri/panel-denetimi.mjs
//   CLICK=0 → tıklamasız hızlı tur; ONLY=yaz,sepet → yalnız bu ekranlar.
// Not: "NO-EFFECT" sonuçlarının çoğu beklenendir (zaten seçili sekme/dil, inert arka plan).

// Panel denetimi: her ekranda tuşları tek tek tıklar, ipucu/ad/hedef boyutu,
// kaydırma çubukları, kenarlık yoğunluğu, küçük yazı, kontrast ve konsol
// hatalarını toplar. Sahte API (client/e2e/fixtures.js) ile çalışır.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const CLIENT = process.env.CLIENT;
const OUT = process.env.OUT;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const CLICK = process.env.CLICK !== '0';
const require = createRequire(path.join(CLIENT, 'package.json'));
const { chromium } = require('playwright');
const { mockApi, seedDraft, PAPERS } = await import(pathToFileURL(path.join(CLIENT, 'e2e', 'fixtures.js')).href);
const BASE = 'http://localhost:5173';
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const DOC = '<h1>Giriş</h1><p>Küçük modüler reaktörlerde pasif güvenlik sistemleri harici güç olmadan çalışır (Chen &amp; Wang, 2021).</p><p>Doğal dolaşım kararlılığı 1 MPa altında bozulur.</p><h1>Yöntem</h1><p>Deney düzeneği.</p><h1>Kaynakça</h1>';
const BASKET = [{ _id: 'b1', title: PAPERS[0].title, creator: PAPERS[0].authors, year: 2021, doi: PAPERS[0].doi, description: PAPERS[0].description }];

// Ekran = adres + (isteğe bağlı) hazırlık adımları
const SCREENS = {
  'arastirma': { hash: '' },
  'arastirma-sonuc': { hash: '', prep: async (p) => {
    await p.locator('#topic-input').fill('pasif soğutma');
    await p.getByRole('button', { name: 'Ara', exact: true }).click();
    await p.waitForTimeout(1200);
  } },
  'yazar-arama': { hash: '#/kaynaklar/arastirmaci' },
  'calismalarim': { hash: '#/alanim' },
  'favoriler': { hash: '#/kaynaklar/favoriler' },
  'sepet': { hash: '#/kaynaklar/sepet' },
  'yaz': { hash: '#/yaz' },
  'yaz-kontrol': { hash: '#/yaz/kontrol' },
  'yaz-kaynaklar': { hash: '#/yaz', prep: async (p) => { await p.locator('[data-action="side-sources"]').first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400); } },
  'yaz-asistan': { hash: '#/yaz', prep: async (p) => { await p.locator('[data-action="side-assistant"]').first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(400); } },
  'yapay-zeka': { hash: '', prep: async (p) => { await p.locator('[data-action="nav-ai"]').first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(500); } },
};

async function open(browser, screen, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport, locale: 'tr-TR', acceptDownloads: true });
  const page = await ctx.newPage();
  const log = { console: [], pageerror: [], failed: [] };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.console.push(`${m.type()}: ${m.text().slice(0, 240)}`); });
  page.on('pageerror', (e) => log.pageerror.push(e.message.slice(0, 240)));
  page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) log.failed.push(`${r.method()} ${r.url().slice(0, 120)} ${r.failure()?.errorText}`); });
  await page.addInitScript(() => {
    try { localStorage.setItem('uiLang', 'tr'); } catch { /* yok */ }
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.ui-devbanner{display:none!important}'; document.head.appendChild(s); });
  });
  await seedDraft(page, DOC, 'Denetim taslağı');
  await mockApi(page, { basket: BASKET });
  // fixtures.js bu ucu sahte cevaplamıyor; sunucunun gerçek şekli (routes/aiConnections.js:40)
  await page.route('**/api/ai-connections**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ enabled: true, storage: 'memory', providers: ['deepseek', 'gemini', 'groq'], connections: [] }) }));
  await page.goto(`${BASE}/${SCREENS[screen].hash}`);
  await page.waitForTimeout(900);
  if (SCREENS[screen].prep) await SCREENS[screen].prep(page);
  return { ctx, page, log };
}

// Görünür etkileşimli öğelerin envanteri + görsel ölçümler (tarayıcıda)
const INSPECT = () => {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) return false;
    return r.bottom > 0 && r.right > 0 && r.top < innerHeight * 3 && r.left < innerWidth;
  };
  const nameOf = (el) => (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 70);
  const items = [];
  const seen = new Map();
  document.querySelectorAll('button, [role="button"], a[href], [role="tab"], [role="menuitem"], summary, select, input[type="checkbox"], input[type="radio"]').forEach((el) => {
    if (!vis(el)) return;
    const text = (el.innerText || '').trim();
    const name = nameOf(el);
    const key0 = `${el.tagName}|${el.dataset.action || ''}|${name}`;
    const n = (seen.get(key0) || 0) + 1; seen.set(key0, n);
    const r = el.getBoundingClientRect();
    const tip = el.getAttribute('title') || el.dataset.tip || (el.getAttribute('aria-describedby') && document.getElementById(el.getAttribute('aria-describedby'))?.innerText) || '';
    items.push({
      key: `${key0}|${n}`, tag: el.tagName.toLowerCase(), action: el.dataset.action || '', name,
      iconOnly: text.replace(/[^\p{L}\p{N}]/gu, '').length === 0,
      hasName: Boolean(el.getAttribute('aria-label') || text || el.getAttribute('title') || el.getAttribute('aria-labelledby')),
      tip: tip.slice(0, 90), nativeTitle: el.hasAttribute('title'),
      w: Math.round(r.width), h: Math.round(r.height), disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
      href: el.tagName === 'A' ? el.getAttribute('href') : null, target: el.getAttribute('target') || '',
    });
  });
  // kaydırma alanları
  const scrollers = [];
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (!/(auto|scroll)/.test(cs.overflowY + cs.overflowX)) return;
    if (!vis(el)) return;
    const y = el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(cs.overflowY);
    const x = el.scrollWidth > el.clientWidth + 1 && /(auto|scroll)/.test(cs.overflowX);
    if (y || x) scrollers.push({ sel: (el.className && String(el.className).split(' ')[0]) || el.tagName.toLowerCase(), y, x, h: el.clientHeight, gutter: el.offsetWidth - el.clientWidth });
  });
  // kenarlık yoğunluğu, küçük yazı, kontrast
  let bordered = 0, small = 0;
  const smallSamples = [], lowContrast = [];
  const lum = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const rgba = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c[3] === undefined || c[3] > 0.85)) return c.slice(0, 3); } return [255, 255, 255]; };
  document.querySelectorAll('body *').forEach((el) => {
    if (!vis(el)) return;
    const cs = getComputedStyle(el);
    const bw = ['Top', 'Right', 'Bottom', 'Left'].filter((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none' && rgba(cs[`border${s}Color`])[3] !== 0).length;
    if (bw) bordered++;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!ownText) return;
    const fs = parseFloat(cs.fontSize);
    if (fs < 12) { small++; if (smallSamples.length < 12) smallSamples.push(`${fs}px "${el.innerText.trim().slice(0, 40)}"`); }
    const fg = rgba(cs.color); if (fg.length < 3) return;
    const a = fg[3] ?? 1;
    const bg = bgOf(el);
    const mixed = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
    const L1 = lum(mixed), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const large = fs >= 18.66 || (fs >= 14 && parseInt(cs.fontWeight, 10) >= 700);
    if (ratio < (large ? 3 : 4.5) && lowContrast.length < 15) lowContrast.push(`${ratio.toFixed(2)} ${fs}px "${el.innerText.trim().slice(0, 40)}"`);
  });
  return {
    items, scrollers, bordered, small, smallSamples, lowContrast,
    hScroll: document.documentElement.scrollWidth > innerWidth,
    title: document.title,
  };
};

const report = {};
const browser = await chromium.launch();
for (const screen of Object.keys(SCREENS)) {
  if (ONLY && !ONLY.includes(screen)) continue;
  const t0 = Date.now();
  const { ctx, page, log } = await open(browser, screen);
  const info = await page.evaluate(INSPECT);
  await page.screenshot({ path: path.join(OUT, 'shots', `${screen}-1440.png`), fullPage: false });
  await ctx.close();
  // mobil görünüm
  {
    const m = await open(browser, screen, { width: 390, height: 844 });
    info.mobileHScroll = await m.page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await m.page.screenshot({ path: path.join(OUT, 'shots', `${screen}-390.png`) });
    await m.ctx.close();
  }
  // tuşları tek tek tıkla
  info.clicks = [];
  if (CLICK) {
    for (const it of info.items) {
      if (it.disabled) { info.clicks.push({ key: it.key, result: 'disabled' }); continue; }
      if (it.tag === 'a' && (it.target === '_blank' || /^https?:/.test(it.href || ''))) { info.clicks.push({ key: it.key, result: 'external-link', href: it.href }); continue; }
      const { ctx: c2, page: p2, log: l2 } = await open(browser, screen);
      const found = await p2.evaluate((key) => {
        const [tag, action, name, nth] = key.split('|');
        let i = 0;
        for (const el of document.querySelectorAll(tag)) {
          const nm = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 70);
          if ((el.dataset.action || '') === action && nm === name) { i++; if (String(i) === nth) { el.setAttribute('data-audit', '1'); return true; } }
        }
        return false;
      }, it.key);
      if (!found) { info.clicks.push({ key: it.key, result: 'not-refound' }); await c2.close(); continue; }
      const before = { url: p2.url(), errors: l2.pageerror.length };
      await p2.evaluate(() => { window.__mut = 0; new MutationObserver((m) => { window.__mut += m.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); });
      let reqs = 0, downloads = 0, popups = 0, dialogs = 0;
      p2.on('request', () => reqs++);
      p2.on('download', () => downloads++);
      p2.on('popup', () => popups++);
      p2.on('dialog', async (d) => { dialogs++; await d.dismiss().catch(() => {}); });
      let result;
      try {
        await p2.locator('[data-audit="1"]').click({ timeout: 2500 });
        await p2.waitForTimeout(650);
        const mut = await p2.evaluate(() => window.__mut).catch(() => -1);
        const urlChanged = p2.url() !== before.url;
        const responded = mut > 2 || reqs > 0 || downloads || popups || dialogs || urlChanged;
        result = responded ? 'ok' : 'NO-EFFECT';
        if (l2.pageerror.length > before.errors) result = 'JS-ERROR: ' + l2.pageerror.slice(before.errors).join(' | ');
        info.clicks.push({ key: it.key, result, mut, reqs, downloads, popups, dialogs, urlChanged });
      } catch (e) {
        info.clicks.push({ key: it.key, result: 'CLICK-FAILED: ' + e.message.split('\n')[0].slice(0, 120) });
      }
      await c2.close();
    }
  }
  info.log = log;
  report[screen] = info;
  const dead = info.clicks.filter((c) => /NO-EFFECT|JS-ERROR|CLICK-FAILED/.test(c.result)).length;
  console.log(`${screen}: ${info.items.length} öğe, ${dead} sorunlu tıklama, ${info.scrollers.length} kaydırma alanı, ${info.lowContrast.length} düşük kontrast, ${info.small} küçük yazı, konsol ${log.console.length}/${log.pageerror.length} (${Math.round((Date.now() - t0) / 1000)} sn)`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
}
await browser.close();
