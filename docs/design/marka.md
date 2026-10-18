# Marka işareti ve arama sonucu görünümü

18.10.2026 · WO-024

## İşaret: rafine şimşek

Eski işaret lucide'in `Zap` simgesinin birebir kopyasıydı: ince, sert köşeli,
jenerik. Yenisi aynı fikri (şimşek: hız) korur; daha kalın ve eğik gövde,
yuvarlatılmış birleşimler, karede optik merkez ve üstte hafif ışık. 16 px
sekme simgesinde eskisinden daha net okunur.

Değerlendirilip reddedilen iki varyant (`scratch` üretimleri, depoya girmedi):
- Şimşek + sağ üstte nokta ("atıf kıvılcımı"): küçük boyda bildirim rozeti gibi görünüyor.
- Kıvrık köşeli sayfa + şimşek: Android uygulama simgesi daireye kırpınca köşe kayboluyor.

| Öğe | Değer |
| --- | --- |
| Kare | 140×140, köşe yarıçapı 34 |
| Zemin | doğrusal degrade `#6d5dfc` → `#5b4cf0` (%55) → `#7c3aed` |
| Işık | üstten beyaz %22 → %0 (ilk 80 birim) |
| Şimşek | `M83 20 L41 77 H67 L57 120 L100 61 H74 Z`, 7 birim yuvarlak birleşim, beyaz → `#e8e5ff` |

Uygulama içinde `client/src/components/ui/BrandMark.jsx` kullanılır (degrade
kimlikleri her örnekte tekil). Lucide `Zap` artık yalnız marka dışı eylemler
için (ör. "Kendi aramanı başlat").

## Dosyalar (`client/public`)

| Dosya | Kullanım |
| --- | --- |
| `favicon.svg` | Tarayıcı sekmesi, PWA (her boyut) |
| `favicon.ico` | 16/32/48 px. Google ve eski tarayıcılar önce buna bakar |
| `apple-touch-icon.png` | 180 px, kenarsız (iOS köşeyi kendisi yuvarlar) |
| `icon-192.png`, `icon-512.png` | Android / PWA |
| `icon-maskable-512.png` | Android uyarlanır simge; şimşek güvenli alanda (%78) |
| `og-image.png` | 1200×630 paylaşım kartı (WhatsApp, LinkedIn, X) |
| `logo.svg` | Yatay logo, "Literatür AI" (eskisinde ü yoktu) |
| `logo-mark-96.png` | E-posta gibi SVG göstermeyen yerler için |

Üretim betiği WO-024 oturumunda (Playwright ile SVG → PNG, Pillow ile ICO);
işaret değişirse bütün dosyalar aynı kaynaktan yeniden üretilmeli.

## Arama sonucunda "Scopus" görünmesi

Neden: 7 Ekim 2026'ya kadar `index.html`'de sekme simgesi `/scopus_logo.svg`
ve açıklamada "Scopus, ArXiv, CORE … 810M+" vardı (`c876727` ile kaldırıldı).
Google simgeyi ve özeti kendi önbelleğinde tutar; yeniden taranana kadar eskisini
gösterir.

Kodda yapılanlar: `favicon.ico` (artık 404 değil), 48 px katı simge,
`<link rel="icon">`, kanonik adres, `sitemap.xml`, `robots.txt`, schema.org
`WebSite` (site adı) ve `Organization` (logo) işaretlemesi, paylaşım kartı.

**Yayından sonra elle yapılması gereken (kod yapamaz):**
1. Google Search Console → URL denetimi → `https://www.literatur-ai.com/` →
   "Dizine eklenmesini iste".
2. Search Console → Site haritaları → `sitemap.xml` gönder.
3. Simgenin güncellenmesi genellikle birkaç gün ile birkaç hafta sürer.
4. Cloudflare yönetilen `robots.txt` açıksa depodaki `robots.txt`'nin
   önüne kendi içerik sinyali bloğunu ekler; `Sitemap:` satırının canlıda
   göründüğü kontrol edilmeli.
