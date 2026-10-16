# WO-008 — Şekillerin Word ve PDF'e gömülmesi

| Alan | Değer |
| --- | --- |
| Durum | Taslak (17.10.2026), kullanıcı kararları işlendi — Hazır'a geçiş ve uygulama kullanıcı WO-011 kontrolünden dönünce |
| Dal | `wo-008-sekil-gomme`, `wo-016-gorsel-yapi-yeni` ucundan (kullanıcı kararı) |
| Kapsam | İstemci: dışa aktarma hattı + yazı tipi varlığı + SVG metin yardımcıları |
| Dosya değişikliği | İzinli (liste aşağıda) — biri mevcut (`exportDocument.js`) |
| Tahmini süre | 2–3 oturum |
| Ön koşul | WO-016 Bitti (17.10.2026). S1 sonucu: kendi SVG çizicimiz (`docs/design/gorsellestirme-plani.md` §5) |
| Yol haritası aşaması | P3 |
| Sıra | WO-016 → **WO-008** → WO-B → WO-C → WO-D (kullanıcı kararı 17.10.2026) |

## Problem

Şekiller bugün Word'e hiç çıkmıyor. Doğrulandı (17.10.2026):

- `client/src/components/workspace/exportDocument.js` › `blocksToParagraphs`
  yalnız başlık, liste, tablo ve alıntıyı tanıyor; geri kalan her öğe
  `paragraphOf` ile düz metne çevriliyor. Bir `<figure>` içindeki SVG düşer,
  geriye en fazla başlık yazısı kalır.
- Editör bugün gerçek şekil üretmiyor; yalnız "Şekil N:" başlık satırı ekliyor
  (`Workspace.jsx:1569`, `insertCaption`). Şekli üretecek çizici WO-D'de.
- S1'de görülen üç tuzak (`docs/design/s1/`): metnin `foreignObject` içinde
  HTML olarak durması (Word/LibreOffice çizmeyebilir), metin genişliğinin
  çizimdeki yazı tipiyle değil sabit tablolarla ölçülmesi ("İlişk / i"),
  yazı tipinin dış sunucudan gelmesi.

WO-008, çizici gelmeden önce **dışa aktarılabilir SVG'nin sözleşmesini** ve
dışa aktarma hattını kurar. Çizici (WO-D) bu sözleşmeye uyan SVG üretir; bu iş
emrindeki metin ölçme ve satır kırma yardımcılarını kullanır.

## Neden şimdi

- WO-B'nin grafikleri (yayın yılları, PRISMA, analiz) Word'e çıkamazsa
  kullanıcıya ulaşmaz (kullanıcı kararı: WO-008 öne alındı).
- Satır kırma ve yazı tipi kararları çiziciden önce verilmezse WO-D yanlış
  temele kurulur (S1'deki "İlişk / i" hatası tam olarak budur).

## Kapsam

### Dahil

1. **Yazı tipi varlığı:** Noto Sans (OFL-1.1) Regular ve Bold'un
   **küçültülmüş** alt kümesi, lisans metniyle ve karakter listesiyle
   (manifest) birlikte repoda. Küçültme geliştirme sırasında bir kez yapılır;
   uygulamaya çalışma zamanı bağımlılığı eklenmez.
2. **Dışa aktarılabilir SVG sözleşmesi** ve onu denetleyen fonksiyon.
3. **Metin ölçme ve satır kırma:** gömülü yazı tipiyle, yazı tipi
   yüklendikten sonra; kelime ortasında kırma yok.
4. **SVG → PNG**, 300 dpi, yazı tipi SVG'ye gömülü olarak.
5. **DOCX:** her şekil SVG + PNG yedeğiyle (`docx` 9.6.1), başlığı ve
   alternatif metniyle.
6. **PDF:** yazdırma/PDF çıktısında şekillerin göründüğünün otomatik kontrolü.
7. **Sıfır dış istek testi** (DOCX ve PDF akışlarında).
8. **Elle doğrulama: Ahmet** (Word + LibreOffice).

### Hariç

- Şekil çizici, şablonlar, düzenleme arayüzü (WO-D).
- Analiz grafikleri (WO-B / WO-007): onlar da bu sözleşmeye uyan SVG
  ürettiğinde bu hattan geçer.
- Google Docs içe aktarma davranışı (bilgi olarak bakılır, kabul ölçütü değil).
- Belgenin gövde yazı tipinin (Times New Roman vb.) gömülmesi: gövde metni
  Word'de yazı tipi **adıyla** gider, dosya gömülmez (lisans, aşağıda).

Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar

- `client/scripts/subset-font.py` (yeni) — geliştirici aracı, fonttools ile alt küme + manifest
- `client/src/assets/fonts/NotoSans-figure-Regular.woff2`, `…-Bold.woff2` (yeni, üretilmiş)
- `client/src/assets/fonts/NotoSans-figure.manifest.json` (yeni) — kapsanan karakterler, kaynak sürüm, dosya hash'i
- `client/src/assets/fonts/OFL.txt` (yeni) — Noto Sans lisans metni
- `client/src/visuals/export/svgContract.js` (yeni) — `assertExportableSvg(svg)`
- `client/src/visuals/export/svgText.js` (yeni) — `measureText`, `wrapText`, `textBlock` (`<text>/<tspan>`)
- `client/src/visuals/export/svgExport.js` (yeni) — `embedFont`, `svgToPng`
- `client/src/components/workspace/exportDocument.js` (mevcut) — `<figure data-visual>` dalı
- `client/src/styles/workspace.css` (mevcut) — yalnız yazdırmada şeklin bölünmemesi (`break-inside: avoid`)
- `client/tests/visualsExport.test.js` (yeni) — birim
- `client/e2e/figures.spec.js` (yeni) ve `client/e2e/figures.spec.js-snapshots/` (yeni, referans görüntüler)
- `client/e2e/fixtures.js` (mevcut) — yalnız şekilli belge tohumlayan yardımcı eklenir

Liste yetersizse iş durur ve sorulur.

## Yaklaşım

### 1. Dışa aktarılabilir SVG sözleşmesi

Çizici ne üretirse üretsin, dışa aktarmaya girecek SVG şunlara uyar;
`assertExportableSvg` aykırılığı listeler, dışa aktarma aykırı şekli
**reddeder** ve kullanıcıya hangi şeklin neden çıkmadığını söyler:

| Kural | Neden |
| --- | --- |
| `foreignObject` **yok** | S1: Word/LibreOffice HTML içeriği çizmeyebilir |
| Metin yalnız `<text>` / `<tspan>` | Satır kırma bizim kodumuzda |
| Dış kaynak yok: `href`/`xlink:href` yalnız `#…` ya da `data:`; `@import` yok; `url(http…)` yok | Sıfır dış istek |
| `<script>`, olay öznitelikleri (`onload` …) yok | Güvenlik; Word'e de gitmemeli |
| `width`, `height` ve `viewBox` var | Boyut ve DPI hesabı |
| Kullanılan yazı tipi ailesi yalnız gömülü figür yazı tipi | Ölçüm ile çizim aynı yazı tipiyle |

### 2. Yazı tipi: gömülü ve küçültülmüş Noto Sans

- **Lisans:** Noto Sans OFL-1.1 — gömme ve dağıtım serbest, lisans metni
  dosyayla birlikte. Times New Roman (Microsoft) **gömülmez, sunulmaz**.
- **Karakter kümesi (kullanıcı kararı 17.10.2026):** Latin temel
  (U+0020–007E), Türkçe (Ç ç Ğ ğ İ ı Ö ö Ş ş Ü ü), Latin-1'in bilimsel metinde
  sık geçenleri (° ± × ÷ µ · é è à ä å ñ ø), tipografik noktalama
  (– — ‘ ’ “ ” … • ‰), matematik (− ≤ ≥ ≈ ≠ → ← ↔ ∑ √ ∞), Yunan harfleri
  (Α–Ω, α–ω) ve **üst simge rakamlar** (⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹, ⁺ ⁻). İstatistik
  çıktıları için şart: χ², η², R², α, β, μ, σ, ≤, ≥, ±, ×, √. Kabul testinde
  bu liste tek tek manifestte aranır.
  Kapsam dışı karakter içeren etiket: şekil yine dışa aktarılır ama
  kullanıcıya "Şu karakter(ler) şekil yazı tipinde yok: …" uyarısı gösterilir
  (sessiz geçiş yok, 2.8).
- **Üretim (kullanıcı kararı 17.10.2026):** `client/scripts/subset-font.py`
  repoda kalır (fonttools 4.61.1 bu makinede kurulu). Küçültülmüş woff2
  dosyaları **bir kez üretilip commit edilir**; uygulama derlemesi ve
  çalışması betiği çağırmaz. `brotli` Python modülü **yalnız bu derleme
  aracı için** kurulur (woff2 yazmak için gerekiyor); uygulamanın
  bağımlılığı değildir, `package.json`'a girmez. Betiğin başında gereken
  araç sürümleri ve çalıştırma komutu yazılır. Çıktı: woff2 + manifest
  (karakter listesi, kaynak dosya ve sürümü, araç sürümleri, çıktının
  SHA-256'sı). Ölçüm (S1): tam latin alt kümesi 13,1 KB, latin-ext 55,6 KB —
  hedef: Regular ≤ 30 KB (Yunan ve matematik eklendiği için ölçülüp
  raporlanır).
- Yazı tipi aynı kökenden (bundle'a dahil varlık) yüklenir; dış istek yok.

### 3. Metin ölçme ve satır kırma (`svgText.js`)

- Ölçüm tarayıcıda: `document.fonts.load('… "Noto Sans Figure"')` beklenir,
  sonra `canvas.measureText` — **gömülü yazı tipiyle**. Yazı tipi yüklenmeden
  ölçüm yapılmaz (fonksiyon önce yüklemeyi bekler).
- `wrapText(text, maxWidth, measure, { minFontSize })`: kırma **yalnız boşlukta**
  (ve tirede); kelime ortasında kırma yok. Tek kelime genişliğe sığmıyorsa:
  önce yazı boyutu küçültülür (en az `minFontSize`), yine sığmıyorsa kutu
  genişler; kelime asla bölünmez. Dönen: satırlar + kullanılan boyut.
- `measure` parametre olarak verilir: birim testleri sabit ölçü fonksiyonuyla
  belirlenimci çalışır; tarayıcıda canvas ölçümü kullanılır.
- `textBlock(lines, …)` yalnız `<text>` + `<tspan>` üretir.

### 4. SVG → PNG (`svgExport.js`)

- `embedFont(svg)`: SVG'ye `<style>@font-face{font-family:"Noto Sans Figure";
  src:url(data:font/woff2;base64,…)}</style>` ekler. SVG resim olarak
  çizilirken sayfanın yazı tiplerini **görmez** (S1 ve önceki karar); gömmeden
  PNG'ye çevirmek Türkçe karakterleri yanlış yazı tipiyle çıkarır.
- `svgToPng(svg, { widthMm, dpi = 300 })`: genişlik piksel =
  `widthMm / 25.4 × dpi` (170 mm → 2008 px); `Image` çözülmesi (`decode()`)
  beklenir, sonra `canvas.toBlob('image/png')`.

### 5. DOCX

`<figure data-visual>` için `ImageRun`:

```js
new ImageRun({
  type: 'svg',
  data: svgWithEmbeddedFont,          // Word 2016+ / 365 vektörü kullanır
  fallback: { type: 'png', data: png300dpi }, // eski Word, LibreOffice, Google Docs
  transformation: { width: px96, height: px96 }, // sayfadaki boyut (96 dpi px)
  altText: { name: figId, title: caption, description: labels.join('; ') },
})
```

- `docx` 9.6.1 bunu destekliyor ve yedeği zorunlu tutuyor
  (`docx/dist/index.d.ts:2832-2839`).
- Şeklin altına başlık paragrafı ("Şekil N: …"), bugünkü başlık biçimiyle.
- Alternatif metin şekildeki etiketleri taşır (ekran okuyucu, arama).
- **Doğrulanmamış risk:** Word'ün SVG içine gömülü `@font-face`'i kullanıp
  kullanmadığı bilinmiyor. Kullanmazsa metin başka yazı tipiyle çizilir ve
  satır kırma kayar. Bu, Ahmet'in elle doğrulamasında görülür.
  **`opentype.js` şimdilik eklenmez** (kullanıcı kararı 17.10.2026). Faz 3
  (yalnız DOCX'e giden kopyada metni çizgiye çevirmek; uygulamadaki SVG
  `<text>` kalır, erişilebilirlik alternatif metinle korunur) **ancak
  Ahmet'in Word kontrolü gerektirirse** açılır; o zaman bağımlılık için ayrıca
  onay alınır.

### 6. PDF

PDF bugün tarayıcının yazdırma motoruyla üretiliyor (WO-011 Faz 3 ek,
`e2e/print.spec.js`). Şekiller satır içi SVG olduğu için vektör olarak
basılır. Eklenecek kontrol (aynı yöntem: `page.pdf` + içerik ölçümü):

- Şekildeki etiket metinleri PDF'te metin olarak var (Türkçe karakterli
  örnek etiketle).
- Şekil başlığı var.
- Şekil iki sayfaya bölünmüyor (`break-inside: avoid`).
- Yazdırma ortamında dış istek yok.

### 7. Testler — iki katman (kullanıcı kararı)

**(a) Kırılmaz kontroller (birim, Node):**

- Manifest Türkçe karakterleri (ğ Ğ ş Ş ı İ ç Ç ö Ö ü Ü) ve istatistik
  karakterlerini (α β χ η μ σ ≤ ≥ ± × √ ⁰–⁹) içeriyor; manifestteki hash yazı
  tipi dosyasının hash'iyle aynı (manifest dosyaya ait; elle düzenlenmiş eski
  manifest yakalanır).
- `embedFont` çıktısında `@font-face` ve `data:font/woff2` var.
- `assertExportableSvg`: `foreignObject`, dış `href`, `@import`, `script`,
  `onload` içeren örnekler reddediliyor; temiz örnek geçiyor.
- `wrapText` (sabit ölçü fonksiyonuyla): hiçbir satır bir kelimeyi bölmüyor;
  "İlişki", "Kararsızlığı", "değiştiricideki" gibi uzun Türkçe kelimeler dar
  kutuda bütün kalıyor (boyut küçülüyor ya da kutu genişliyor).
- DPI hesabı: 170 mm @ 300 dpi = 2008 px.

**(b) Görüntü karşılaştırma (e2e, Playwright):**

- Örnek şekil (Türkçe etiketli) PNG'ye çevrilir, sayfada gösterilir,
  referans görüntüyle `toHaveScreenshot` + küçük tolerans
  (`maxDiffPixelRatio`) ile karşılaştırılır. Referanslar işletim sistemine
  göre ayrı tutulur (Playwright'ın varsayılanı); yeni referans yalnız elle
  bakıldıktan sonra kabul edilir.
- Tarayıcıda ölçülen satır kırma: "İlişki" başlığı dar kutuda bölünmüyor
  (S1'deki hatanın tersi).
- Dışa aktarılan DOCX açılıp (zip) `word/media/` altında bir SVG ve bir PNG
  var; `document.xml`'de `asvg:svgBlip` ve alternatif metin var.

### 8. Sıfır dış istek testi

S1'deki yöntem: Playwright'ta yerel olmayan her istek kaydedilir ve
engellenir. Şekilli belge açılır → DOCX dışa aktarılır → PDF üretilir.
Beklenen: kayıtta **0** dış istek.

### 9. Elle doğrulama: Ahmet

Otomatik testlerin göremediği tek yer: gerçek Word ve LibreOffice. Ahmet,
iş emrinin ürettiği örnek DOCX'i (Türkçe etiketli 3 şekil: akış, balık
kılçığı, çubuk grafik) açar ve tabloyu doldurur. **WO-008 bu tablo
dolmadan Bitti'ye geçmez.**

| Kontrol | Word 2016+/365 | LibreOffice | Not |
| --- | --- | --- | --- |
| Şekiller görünüyor | | | |
| Etiketler doğru, Türkçe karakterler doğru | | | |
| Yazı tipi şekildeki gibi (satırlar taşmıyor) | | | Taşıyorsa → Faz 3 (metni çizgiye çevir) |
| Yakınlaştırınca bulanıklaşmıyor (vektör) | | | LibreOffice PNG kullanabilir; bulanıklık 300 dpi'da kabul edilebilir mi |
| Şekil başlığı ve alternatif metin | | | |
| PDF (uygulamadan): şekiller ve etiketler | | | |

## Fazlar ve commit'ler

| Faz | İçerik | Çıkış koşulu |
| --- | --- | --- |
| 1 | Yazı tipi alt kümesi + manifest + lisans; `svgContract`, `svgText` (birim testli) | (a) testleri geçiyor |
| 2 | `svgExport`, DOCX dalı, PDF kontrolü, dış istek testi, görüntü karşılaştırma | (b) + §8 geçiyor; örnek DOCX üretildi |
| — | **Elle doğrulama: Ahmet** | §9 tablosu doldu |
| 3 (koşullu) | Word yazı tipini kullanmıyorsa DOCX kopyasında metni çizgiye çevirme | §9 yeniden geçiyor |

Faz başına commit; push yok (kullanıcı kararı).

## Kabul kriterleri

- [ ] Figür yazı tipi küçültülmüş, OFL lisans metniyle repoda; manifest Türkçe karakterleri kapsıyor ve hash dosyaya eşit
- [ ] `assertExportableSvg` `foreignObject`, dış kaynak, `@import`, `script`, olay özniteliği içeren SVG'yi reddediyor; dışa aktarma reddedilen şekli sessizce atlamıyor, kullanıcıya söylüyor
- [ ] `wrapText` hiçbir koşulda kelime bölmüyor; uzun Türkçe kelime testleri geçiyor; tarayıcı testinde "İlişki" bölünmüyor
- [ ] Ölçüm yazı tipi yüklendikten sonra yapılıyor (yüklenmeden çağrı bekliyor; test)
- [ ] PNG 300 dpi (boyut hesabı testli); yazı tipi SVG'ye gömülü olarak çevriliyor
- [ ] DOCX'te her şekil SVG + PNG yedeği + başlık + alternatif metin (zip içeriğiyle doğrulanmış)
- [ ] PDF'te şekil etiketleri ve başlığı var; şekil sayfa arasında bölünmüyor
- [ ] Dış istek testi: DOCX ve PDF akışlarında **0**
- [ ] Görüntü karşılaştırma testi referansla tolerans içinde
- [ ] **Elle doğrulama: Ahmet** tablosu doldu (Word + LibreOffice)
- [ ] Mevcut DOCX çıktısı şekilsiz belgelerde değişmedi (temel çizgi: BibTeX/RIS bayt bayt, DOCX yalnız zaman damgası — WO-011'deki yöntem)
- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e` geçiyor; paket büyümesi ölçülüp raporlandı (yazı tipi tembel yüklenir mi, raporda)
- [ ] Bölüm 3 ihlali yok

Bölüm 4 regresyon seti çalıştırılmaz: model kullanılmıyor.

## Test planı

| Test | Nasıl | Beklenen |
| --- | --- | --- |
| Başlangıç çizgisi | `npm test`, `npm run test:e2e`, temel çizgi DOCX/BibTeX/RIS | Sayılar ve çıktılar kaydedilir |
| Birim | `cd client && npm test` | Yeni testler + başlangıç geçiyor |
| e2e | `npm run test:e2e` | `figures.spec` + mevcutlar geçiyor |
| Dış istek | `figures.spec` içinde | 0 |
| Lint / build | `npm run lint`, `npm run build` | Temiz; boyut farkı raporda |
| Elle | §9 | Ahmet'in tablosu |

## Ölçüm

| Metrik | Öncesi | Hedef |
| --- | --- | --- |
| Word'e çıkan şekil | 0 (yok) | Belgedeki her şekil |
| Figür yazı tipi (Regular, woff2) | — | ≤ 30 KB |
| Şekil başına DOCX artışı | — | Ölçülür, raporlanır |
| Şekil başına dışa aktarma süresi | — | Ölçülür (300 dpi PNG dahil) |
| Dış istek | — | 0 |

## Geri alma

Faz commit'leri `git revert` ile döner. `exportDocument.js`'teki şekil dalı
tek yerde; geri alınınca dışa aktarma bugünkü haline (şekilsiz) döner. Yeni
yazı tipi ve yardımcı dosyalar başka yerden kullanılmıyor. Dal:
`wo-008-sekil-gomme` (`wo-016-gorsel-yapi-yeni` ucundan).

## Riskler

| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Word SVG'deki gömülü yazı tipini kullanmıyor | Orta (doğrulanmadı) | Orta: satır kayması | Elle doğrulama; Faz 3 (metni çizgiye çevirme) hazır |
| LibreOffice SVG yerine PNG kullanıyor | Yüksek | Düşük | 300 dpi PNG; tabloda ayrıca kaydedilir |
| Görüntü testleri işletim sistemine göre farklı | Yüksek | Düşük | Playwright'ın OS'a göre referans klasörü; (a) katmanı ayrıca kırılmaz |
| Safari'de SVG→PNG'de yazı tipi | Orta | Orta | Bu iş emrinde Chromium; Safari raporda "denenmedi" |
| Kapsam dışı karakter (ör. Kiril) | Düşük | Düşük | Uyarı + karakter listesi; sessiz geçiş yok |
| Şekilsiz belgelerin DOCX'i bozulur | Düşük | Yüksek | Temel çizgi karşılaştırması kabul ölçütünde |

## Onay gereken noktalar

- **Taslak → Hazır** (kullanıcı). Uygulama, kullanıcı WO-011 kontrolünden
  dönene kadar başlamaz.
- **Faz 3** yalnız Ahmet'in Word kontrolü gerektirirse; `opentype.js` için
  ayrıca onay.

Karara bağlananlar (17.10.2026): `brotli` yalnız derleme aracı, woff2 bir kez
üretilip commit edilir, betik repoda kalır; Yunan harfleri, matematik
simgeleri ve üst simge rakamlar dahil; `opentype.js` şimdilik yok; dal
`wo-016-gorsel-yapi-yeni` ucundan.

## Bitiş raporu

Ajan tarafından doldurulur.
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:** READY / NEEDS ATTENTION / BLOCKED
