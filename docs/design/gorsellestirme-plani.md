# Görselleştirme planı: hangi metin, hangi görsel, kim üretir

**Durum:** plan (17.10.2026). Bağlayıcı değil; iş emirleriyle uygulanır (§8).
Dayanak: kullanıcı isteği ("hepsini istiyorum; hangi metinde nasıl, AI mı kod
mu, en sağlam nasıl"), prototip (`yazim-alani-prototip.html`, 9 şablon,
düzenlenebilir), dış kaynak incelemesi (`etkilesim-ve-durumlar-plani.md`
§10.1c: AntV Infographic, OpenNapkinAI, thinking-toolkit).

---

## 0. Kısa cevap

- **Önce kod, sonra yapay zekâ.** Yapısı metinde zaten belli olan her şey
  (numaralı adımlar, yıllar, atıflar, sayılar, PRISMA sayıları, analiz
  sonuçları, kaynak metadata'sı) **kodla** çıkarılır: bedava, belirlenimci,
  test edilebilir. Yapay zekâ yalnız serbest düzyazıdaki kavram–ilişki
  çıkarımı için kullanılır.
- **Yapay zekâ üç şeyi asla yapmaz:** sayı üretmez, şablon seçmez, cümlede
  olmayan kelime yazmaz. Her çıktısı kodla doğrulanır.
- **Çizim ayrı katmandır.** Kendi SVG'miz ya da (şartlar sağlanırsa) AntV
  Infographic. Çizim motoru içerik kararı vermez.
- Bu, kodda zaten kurulmuş yaklaşımın devamıdır:
  `client/src/components/workspace/claimDetection.js` üç kademe tanımlıyor
  (yerel kural → küçük sınıflandırıcı → LLM) ve bugün yalnız 1. kademeyi
  çalıştırıyor. Görselleştirme aynı kademeleri ve aynı yardımcıları (`fold`,
  `CITATION`) kullanır.

---

## 1. Hat: altı adım

```
Girdi ─► 1 Sinyal (kod) ─► 2 Yapı çıkarma ─► 3 Doğrulama (kod) ─► 4 Şablon uygunluğu (kod) ─► 5 Çizim ─► 6 Düzenle / Belgeye ekle
                              │
                              ├─ 2a Kural (kod): liste, yıl, sayı, atıf, metadata, analiz
                              └─ 2b Model (PR6.v2): yalnız serbest düzyazı, 2a yetmezse
```

| Adım | Kim | Ne | Çıktı |
| --- | --- | --- | --- |
| 1 Sinyal | Kod | Türkçe işaret sözlüğü (§3), atıf, sayı, yıl, madde işareti, iddia sınıfı (`claimDetection`) | Paragraf profili: `{sıra: 3, neden: 4, karşıtlık: 1, yıl: 0, atıf: 1, …}` |
| 2a Kural | Kod | Profil güçlüyse yapıyı doğrudan kurar (numaralı adım → akış; "X'in nedenleri: a, b, c" → balık kılçığı; yıllar → zaman çizelgesi) | Graf: düğüm + kenar, her biri cümle no + birebir parça |
| 2b Model | PR6.v2 | Yalnız 2a kuramadıysa ve kullanıcı ✦'ya bastıysa | Aynı graf biçimi |
| 3 Doğrulama | Kod | Birebir parça cümlede var mı; cümle no geçerli mi; yinelenen düğüm; yalnız kalan düğüm; döngü/ağaç tutarlılığı (OpenNapkinAI `normalizeSmartArtStructure` fikri) | Temiz graf + atılan öğe sayısı (gizlenmez) |
| 4 Uygunluk | Kod | Grafın şekli + profil → her şablon için uygun / uymuyor + gerekçe + önerilen | Şablon listesi |
| 5 Çizim | Kod | Kendi SVG'miz ya da Infographic bağdaştırıcısı | SVG |
| 6 Düzenleme | Kullanıcı | Etiket, şablon, renk, yön; elle değişen `origin: user_written` | Belgede şekil + durum |

### Yapay zekâ ne zaman çağrılır

Yalnız şu üçü birlikte doğruysa: kullanıcı ✦'ya bastı; 2a yapı kuramadı;
paragrafta en az 2 cümle var. Her tıklama bir çağrı; otomatik çağrı yok.
Çağrı bütçesi tüzük 3.3'e sayılır. Model yanıt vermezse ya da doğrulamadan
hiçbir şey geçmezse: "Bu paragraftan yapı çıkarılamadı" — boş şema
çizilmez.

---

## 2. Metin türü → görsel eşlemesi

"Kaynak" sütunu girdinin nereden geldiğini, "Kim" sütunu yapıyı kimin
çıkardığını söyler. Infographic yapı türleri parantez içinde.

### 2.1 Belgedeki paragraftan

| Metin türü (nerede sık) | Tanıma sinyali (kod) | Görsel | Kim |
| --- | --- | --- | --- |
| **Süreç / yöntem adımları** (Yöntem) | "önce, ardından, sonra, ilk olarak, son olarak, aşama, adım"; numaralı liste | Akış (`sequence-steps`, `list-row`), Basamak (`sequence-stairs-front`), Yol haritası (`sequence-roadmap-vertical`) | Numaralı liste → **kod**; düzyazı → model |
| **Döngü** (kuram, süreç) | "yeniden, tekrar, geri döner, döngü, çevrim" + graf kapanıyor | Döngü (`sequence-circular`, `relation-circle`) | Kapanma **kodla** sınanır; düğümler model |
| **Neden–sonuç / etkenler** (Giriş, Tartışma) | "bağlıdır, etkiler, neden olur, yol açar, -den dolayı, etkenler" | Balık kılçığı (bizim), İlişki akışı (`relation-dagre-flow`, ok etiketli) | Model; "X'in nedenleri: a, b, c" kalıbı → kod |
| **Geri besleme** (sistem, ekonomi, ekoloji) | Yönlü etkiler ("artırır/azaltır") **ve** kapanan döngü | Geri besleme (+/− işaretli) | Kutup işareti **yalnız metinde "artırır/azaltır" varsa**; yoksa şablon "uymuyor" |
| **Sınıflandırma / tipoloji** (Kuramsal çerçeve) | "türleri, çeşitleri, ikiye/üçe ayrılır, alt boyut, sınıflandırılır" | Hiyerarşi (`hierarchy-tree`, `hierarchy-structure`), Zihin haritası (`hierarchy-mindmap`) | Madde listesi → kod; düzyazı → model |
| **İki boyutlu tipoloji** | İki eksen adı + dört hücre ("yüksek/düşük … yüksek/düşük") | Dörtlü matris (`compare-quadrant`) | Model; eksen adları birebir |
| **Karşılaştırma** (iki yaklaşım/yöntem/görüş) | "A ise … B ise", "buna karşın", "-e göre daha", "farklı olarak" | İkili karşılaştırma (`compare-binary-horizontal`, `compare-hierarchy-left-right`) | Model |
| **Kavram ilişkileri** (Kuramsal çerçeve) | Fiille bağlanmış çok kavram | Kavram haritası (bizim; `relation-network`) | Model; her ok etiketli (etiketsiz çizgi yasak — concept-map tuzakları) |
| **Argüman** (Giriş, Tartışma, Sonuç) | İddia cümlesi (`claimDetection`) + atıf + "ancak, buna rağmen" | Argüman haritası (bizim) | **Tamamen kod:** rol, atıf durumu belgeden okunur |
| **Hiyerarşik önem / temel–üst** | "temelinde, en üstte, önce karşılanmalı" sıralaması | Piramit (`list-pyramid`, `sequence-pyramid`) | Model; sıra metinde açık değilse "uymuyor" |
| **Tarihsel gelişim** (Literatür, Giriş) | Yıllar, dönemler, "yüzyıl" | Zaman çizelgesi (`sequence-timeline`) | **Kod** (yıl + cümle) |
| **Sayılar** (Bulgular) | %, sayı + birim | Çubuk / pasta (`chart-bar`, `chart-pie`) | **Kod**; sayı metinden birebir. Toplam %100 değilse pasta "uymuyor" |

### 2.2 Paragraf dışından (metin değil, yapılandırılmış veri)

Bunlarda yapay zekâ hiç yok; veri zaten yapılandırılmış.

| Girdi | Görsel | Kaynak | Not |
| --- | --- | --- | --- |
| Sepet / kütüphane yılları | Yayın zaman çizelgesi, yıl dağılımı çubuğu | Doğrulanmış metadata (3.1) | Bilinmeyen yıl ayrı çubukta "yıl bilinmiyor", tahmin yok (2.8) |
| PRISMA sayıları (Literatür taraması şablonu) | PRISMA akışı (`sequence-funnel` ya da kendi akışımız) | Kullanıcının girdiği sayılar | Akademide standart; sayılar tutarsızsa (elenen > taranan) uyarı |
| Analiz istasyonu sonucu | Kutu grafiği, çubuk, saçılım, regresyon çizgisi (`chart-*`) | WO-006/009 çekirdeği, `origin: computed` | WO-007/008 ile |
| Literatür matrisi (gelecek) | Makale × boyut tablosu | Kullanıcı / P7 | Tablo, infografik değil |
| Yöntem dağılımı (gelecek) | Çubuk | P7 + yalnız analiz edilen kayıtlar (2.8) | "14 makaleden 6'sı" — kaç kayıt analiz edilemedi ayrıca |

### 2.3 Alınmayanlar (akademik metne uygun değil)

Süsleme ağırlıklı yapılar akademik şekil olarak önerilmez; ileride
**Dönüştür → Poster/Sunum** (`poster-donustur-ileride`) için açılabilir:
`sequence-cylinders-3d`, `sequence-zigzag-pucks-3d`, `sequence-mountain`,
`sequence-color-snake-steps`, `list-sector`, el çizimi (roughjs) temaları,
şerit/şeker kart öğeleri. **Kelime bulutu** (`chart-wordcloud`) alınmaz:
akademik değeri tartışmalı, sıklık ≠ önem. Simge ve illüstrasyon kullanan
öğeler kapalı (gizlilik, §5).

> **Yol haritası notu (kullanıcı kararı 17.10.2026):** kelime bulutu ürünün
> akademik kısmından **tamamen dışarıda**. Akademik metinde yanıltıcı ve
> nadiren kullanılıyor. Poster/Sunum (Dönüştür) modu açılınca yeniden
> değerlendirilir.

---

## 3. Sinyal sözlüğü (kod, 1. kademe)

`claimDetection.js`'teki `fold` ile sadeleştirilmiş kalıplar. Sözlük tek
dosyada, testli; her kalıp bir örnek cümleyle birlikte yazılır.

| Sinyal | Kalıp örnekleri (sadeleştirilmiş) |
| --- | --- |
| sıra | `once`, `ardindan`, `daha sonra`, `ilk olarak`, `son olarak`, `asama`, `adim`, `^\d+[.)]` |
| döngü | `yeniden`, `tekrar`, `geri don`, `dongu`, `cevrim` |
| neden | `bagli(dir)?`, `etkile`, `neden ol`, `yol ac`, `dolayi`, `etken`, `sonucunda` |
| yön | `artir`, `azalt`, `yukselt`, `dusur`, `zayiflat`, `guclendir` |
| karşıtlık | `ancak`, `buna karsin`, `oysa`, `bununla birlikte`, ` ise ` |
| sınıflama | `turleri`, `cesitleri`, `(iki|uc|dort)\w* ayril`, `alt boyut`, `siniflandir` |
| zaman | `\b(1[5-9]|20)\d{2}\b`, `yuzyil`, `donem` |
| sayı | `%\s?\d`, `\d+([.,]\d+)?\s?(kg|m|s|°C|MW|…)` |
| atıf | `CITATION` (claimDetection'dan) |

Profil tek başına şablon seçmez; adım 4'te grafın şekliyle birlikte kullanılır.

---

## 4. Yapay zekâ kısmı: PR6.v2

Tasarım belgesindeki P6 (`atif-dogrulamali-yazim-motoru.md`) bu işe yetmiyor:
cümle numarası ve birebir parça istemiyor, ilişki etiketi üretmiyor, 4 ilişki
türüyle sınırlı ve "metnin hangi bölüm olduğunu tahmin et" gibi gereksiz alan
taşıyor. PR6.v2 taslağı:

- **Girdi:** numaralı cümleler (`[1] … [2] …`). Atıf, yazar, yıl prompta
  girmez (3.1); atıf işaretleri cümleden çıkarılır.
- **Çıktı (katı JSON şeması):**
  `nodes: [{id, span, sentence}]`, `edges: [{from, to, span, sentence, polarity: "+"|"-"|null}]`,
  `unsure: [ ... ]` (modelin emin olmadığı ilişki — gösterilmez, sayılır).
- **Kurallar:** `span` cümleden birebir; kelime ekleme yok; kutup işareti
  yalnız cümlede yön fiili varsa; ilişki yoksa boş dizi (zorla doldurma yok —
  OpenNapkinAI'nin "tam 4 madde" hatası); şablon adı yok.
- **Güvenlik:** tüzük 3.8'in beş katmanı; pasaj ayracı, şema doğrulama,
  araçsız çağrı.
- **Model sınıfı:** orta (3.7: yapı çıkarma doğrulama değil). Sürüm `PR6.v2`
  önbellek anahtarında.
- **Doğrulama (kod, adım 3):** her `span` `fold` sonrası cümlede alt dizgi
  olmalı; değilse öğe atılır ve "N öğe metinde bulunamadığı için atıldı"
  yazılır.

---

## 5. Çizim katmanı: kendi SVG'miz mi, AntV Infographic mi

**Bugün:** prototipteki kendi SVG çizicimiz (9 şablon). Bağımlılık yok,
tamamen bizim kontrolümüzde.

**Infographic'in getirdiği:** ~40 yapı türü, ok etiketi, yerleşik düzenleyici
(çift tıkla yazı, sürükle, boyutlandır, geri al), SVG/PNG dışa aktarma, 117
test dosyası, MIT.

**Şartlar sağlanmadan eklenmez** (kural 6, ayrıntı: `etkilesim-ve-durumlar-plani.md` §10.1c):

1. **Dış istek sıfır.** Simge/illüstrasyon yüklenemezse kutunun yazısı
   `weavefox.cn`'e yedek sorgu olarak gidiyor (`resource/loader.ts:104-114`).
   Simge/illüstrasyon öğeleri kapalı + yedek yol kesik (yama ya da CSP
   `connect-src 'self'`) + ağ kaydıyla test.
2. **Yazı tipi bizim** (Plus Jakarta Sans / Source Serif); varsayılan Alibaba
   PuHuiTi CDN'den gelmez. ğ ş ı İ ü ö ç çizimde ve PNG/SVG'de sınanır.
3. **Düzenleyici Türkçe** (bugün "默认" gibi Çince etiketler var).
4. **Boyut:** yalnız ✦ açılınca tembel yüklenir; ölçülür.
5. **Sürüm sabit** (1.0 öncesi); alt bağımlılık lisansları (`d3`, `linkedom`,
   `postcss`, `roughjs`, …) okunur.

**Bağdaştırıcı:** `toInfographic(graph, templateId)` — bizim grafımızı onların
veri biçimine çevirir; cümle numarası `[key: string]: any` alanında taşınır
(üzerine gelince cümle vurgusu için). Düzenleyicide değişen yazı geri bizim
duruma yazılır, `origin: user_written` olur. Infographic yalnız çizer: şablon
uygunluğu, doğrulama, öneri bizde kalır.

**Karar yolu:** önce yarım günlük bir deneme (§8 S1). Şartlardan biri
tutmazsa kendi SVG'mizle devam; şablonları onların yapılarından esinlenerek
genişletiriz (MIT, kod değil fikir).

### S1 geçme ölçütleri (kullanıcı kararı 17.10.2026)

Geçici kurulumla, repoya girmez; ayrı onayla başlar.

| # | Ölçüt | Geçer | Kalır |
| --- | --- | --- | --- |
| 1 | Dış istek | Bütün özellikler kullanılırken, **simgenin yüklenemediği durum dahil**, ağ kaydında sıfır dış istek; çevrimdışı da çalışıyor | weavefox çağrısı ne ayarla ne de **tek noktadan yamayla** kesilebiliyor |
| 2 | Yazı tipi | Yazı tipleri yerelden sunuluyor; gömülen yazı tipi açık lisanslı. `embedFonts`'un neyi gömdüğü ve lisansı raporda | Yazı tipi CDN'siz çalışmıyor |
| 3 | Türkçe | ğ ş ı İ ç ö ü ekranda, SVG'de ve PNG'de doğru (iki katmanlı test, WO-008 notu) | Herhangi birinde yanlış glif |
| 4 | Boyut | Tembel yüklenen parça ≤ **200 KB gzip**; yalnız şekil eklenirken yükleniyor | Sınırı aşıyor |
| 5 | Düzenleyici | Çevrilebiliyor **ya da** yalnız çizim motoru alınıp düzenleme bizim arayüzümüzle yapılabiliyor | İkisi de mümkün değil |

### S1 sonucu (17.10.2026) — **KALDI** (ölçüt 4)

`@antv/infographic@0.2.20`, geçici kurulum (repoya girmedi), Chromium +
Playwright; yerel olmayan her istek kaydedildi **ve engellendi** (test
sırasında dışarı veri gitmedi).

| # | Ölçüt | Sonuç | Kanıt |
| --- | --- | --- | --- |
| 1 | Dış istek | **Geçti (ayarla, yamasız)** | Ayarsız: AntV CDN'ine 6 yazı tipi isteği; simgeli şablonda `weavefox.cn/…?text=flash+fast` ve `shield+check`. Ayarla 0: yerleşik 6 yazı tipi aynı adla dosyasız yeniden kaydedildi (`registerFont` üzerine yazıyor) + her simgeye yerel yer tutucu döndüren `registerResourceLoader`. **Yükleyici `null` dönerse weavefox isteği geri geliyor** → yükleyici asla boş dönmemeli |
| 2 | Yazı tipi | **Geçti, kırılgan** | Yerel Noto Sans (OFL-1.1) sunuldu ve `embedFonts` SVG'ye base64 gömdü. Ama yalnız CSS `Ad/result.css` düzeninde ve `unicode-range` tarayıcının biçiminde (`U+100-2BA`, baştaki sıfırsız) yazılınca; standart @fontsource CSS'iyle gömme sessizce boş kaldı |
| 3 | Türkçe | **Ekranda, SVG'de, PNG'de geçti** | PNG'de ğüşıöç İĞÜŞÖÇ doğru (göz kontrolü); SVG'de metin + gömülü yazı tipi. İki risk: (a) kart yazıları SVG'de `foreignObject` içinde HTML — Word/LibreOffice bunu çizmeyebilir (**burada denenmedi, Word yok**); (b) metin ölçümü sabit ölçü tablolarıyla (`measury`: Alibaba, Arial…), Noto değil → satır kırma hatası gözlendi ("İlişki" başlığı "İlişk / i" bölündü) |
| 4 | Boyut | **Kaldı** | Gzip: hazır paket 283,7 KB; esbuild ile ayıklanmış 293,6 KB; doğrudan sınıf içe aktarma 294,6 KB (giriş tüm şablon ve düzenleyiciyi çekiyor). Brotli 225–235 KB. Sınır 200 KB |
| 5 | Düzenleyici | **Geçti** | Düzenleyicide yorum dışı yalnız 2 Çince dizgi ("请选择", "默认"); `editable: false` ile yalnız çizim de çalışıyor |

Ek gözlemler: basit daire düğümlü ilişki şablonu düğüm adını göstermiyor ve
ok etiketleri çakıştı; kart düğümlü (`relation-dagre-flow-tb-badge-card`)
temiz. Bağımlılık lisansları izin verici (MIT 41, ISC 36, BSD 10, Apache-2.0,
0BSD, Unlicense).

**Karar (kullanıcı, 17.10.2026):** sınır gevşemiyor; kendi SVG çizicimizle
devam. Infographic'in yapılarından fikir alınır (MIT, kod değil).
Kanıtlar: `docs/design/s1/` (ekran görüntüleri, ağ kaydı özeti).

### WO-D (arayüz) için notlar

- **"Kaynak değişti" uyarısı sürekli gösterilmez** (kullanıcı kararı
  17.10.2026). Yalnız kullanıcı şekle baktığında (şeklin üzerine geldiğinde ya
  da şekle odaklandığında) veya şekli düzenlemeye açtığında görünür. Yazarken
  arka planda `checkSource` çalışabilir, ama sonuç ekrana ancak bu anlarda
  çıkar. `relocated` hiç uyarı göstermez; `changed` ve `missing` bu anlarda
  "Yeniden oluştur / Olduğu gibi bırak" seçenekleriyle görünür.

### Kendi çizicimizin kabul ölçütleri (WO-D ve WO-008)

S1 bulgularından: `foreignObject` yok (metin yalnız `<text>`/`<tspan>`, satır
kırma bizde); genişlik gömülü yazı tipiyle ve yazı tipi yüklendikten sonra
ölçülür, kelime ortasında kırma yok ("İlişki" testi); Noto Sans gömülü ve
küçültülmüş, sıfır dış istek; Word/LibreOffice açılışı elle doğrulanır
(Ahmet). Ayrıntı: `docs/work-orders/README.md` › WO-008 notu.

---

## 6. Belgeye ve dışa aktarmaya giriş

- Belgeye yalnız "Belgeye ekle" ile girer (2.9); şekil numarası ve başlık
  otomatik, "Tablolar ve şekiller" listesine girer.
- Şekil durumu (şablon, renk, etiketler, cümle bağları) şekille saklanır;
  "Düzenle" ile yeniden açılır (prototipte var).
- **Word'e çıkış bugün yok:** `exportDocument.js` görsel gömmüyor (doğrulandı,
  17.10.2026). WO-008 kapsamı (ayrıntı `docs/work-orders/README.md`):
  - **SVG + PNG yedeği** birlikte; `docx` 9.6.1 destekliyor ve yedeği
    zorunlu tutuyor. PNG ≥ 300 dpi. Şekil başlığı Word altyazısı.
  - Yazı tipi PNG'ye çevirmeden önce yüklenir **ve SVG'ye gömülür**.
  - Gömülen yazı tipi açık lisanslı (Liberation Serif / Noto); Times New
    Roman gömülmez.
  - Test: (a) SVG'de `@font-face` + Türkçe glifler (kırılmaz); (b) PNG
    referans görüntüyle toleranslı karşılaştırma.
- PDF/yazdırma: SVG doğrudan basılır.

---

## 7. Ölçüm (tüzük Bölüm 4)

Yeni küme **E5 — Görsel yapı çıkarma**, pilot 30 paragraf, elle etiketli
(düğümler, kenarlar, uygun şablonlar). Kararlar (17.10.2026): iki insan
etiketleyici, ikisi de yapay zekâ değil (kullanıcı + mümkünse başka alandan
bir akademisyen); farklı disiplinler; Türkçe ve İngilizce karışık; önce
kılavuz (`docs/eval/E5-etiketleme-kilavuzu.md`); uyum kategorik kararlarda
Cohen kappa, düğüm sınırlarında F1; uyuşmazlık konuşularak çözülür.

| Metrik | Hedef | Not |
| --- | --- | --- |
| Birebir olmayan etiket oranı (doğrulamadan sonra) | **0** | Mimari garanti (E4 gibi) |
| Düğüm bulma (recall / precision) | ölçülür, eşik pilotla konur | |
| Kenar doğruluğu (yön + uçlar) | ölçülür | Asıl risk |
| Şablon önerisi isabeti (kullanıcının seçtiği = önerilen) | izlenir | Kullanıcı tarafı (4.8) |
| Elle düzenlenen etiket oranı | izlenir | Yüksekse çıkarım zayıf |
| Kural kademesinin karşıladığı paragraf oranı | izlenir | Yüksek = ucuz ve sağlam |

Kalite iddiası E5 olmadan yapılmaz (4.1). "Üretilen şema sayısı" başarı
metriği değildir.

---

## 8. Sıra ve iş emirleri

| Adım | Ne | AI? | Ön koşul | Çıkış koşulu |
| --- | --- | --- | --- | --- |
| **S1 Deneme** | Infographic'i ayrı sayfada dene: ağ kaydı, Türkçe, boyut, düzenleme olayları, SVG/PNG | Hayır | Onay (geçici kurulum, repoya girmez) | §5'teki 5 şart ölçüldü, rapor |
| **WO-A Sinyal ve uygunluk** | Sinyal sözlüğü, kural kademesi (2a), doğrulama, graf şekli → şablon uygunluğu; kendi SVG çizicisi | **Hayır** | Yok | Sözlük testleri; prototipteki 3 paragraf koddan aynı sonucu veriyor |
| **WO-B Veriden görseller** | Yayın zaman çizelgesi, PRISMA akışı, analiz grafikleri | **Hayır** | WO-007 (analiz arayüzü) analiz grafikleri için | Bilinmeyen yıl ayrı, PRISMA tutarlılık uyarısı testli |
| **WO-C PR6.v2** | Prompt, şema, doğrulama, E5 kümesi | **Evet** | WO-A; E5 etiketlendi | E5 ölçüldü; birebir olmayan etiket = 0 |
| **WO-D Çizim motoru** | Infographic bağdaştırıcısı + Türkçe düzenleyici (S1 geçtiyse) ya da kendi SVG'mizin genişletilmesi | Hayır | S1 raporu | Dış istek sıfır (testli); Türkçe glif; boyut ölçüldü |
| **WO-008 (mevcut)** | Şekillerin Word/PDF'e gömülmesi | Hayır | WO-006 | Şekil Word'de başlığıyla |

Sıra gerekçesi: kod kademesi (WO-A, WO-B) bedava ve testli değeri hemen
verir; yapay zekâ (WO-C) ölçüm kümesi olmadan başlamaz; çizim motoru kararı
denemeyle verilir, varsayımla değil.

**Kesinleşen sıra (kullanıcı kararı 17.10.2026):** WO-A (= **WO-016**,
taslak yazıldı) ve S1 paralel → **WO-008** (öne alındı: şekiller Word'e
çıkmazsa WO-B'nin grafikleri de kullanıcıya ulaşmaz) → WO-B → WO-C → WO-D.
WO-A'nın çıktısı sürümlü ara yapı (`visual-structure/1`), çizim motorundan
bağımsız.

---

## 9. Riskler

| Risk | Önlem |
| --- | --- |
| Model doğru kelimeler arasında yanlış ilişki kurar | Üzerine gelince cümle vurgusu, "Neden uygun" satırı, düzenleme; E5'te kenar doğruluğu ölçülür |
| Türkçe ek yapısı birebir kontrolü bozar ("ısıtarak" / "ısıtır") | Kontrol `fold` + alt dizgi; çekim farkı → öğe atılır, model cümledeki biçimi kullanmak zorunda |
| Kural kademesi yanlış pozitif ("ise" her zaman karşıtlık değil) | Profil tek başına karar vermez; graf şekliyle birlikte; sözlük testleri karşı örnekli |
| Infographic dış istekleri | §5 şart 1; test ağ kaydıyla |
| Süs şablonların akademik metne sızması | §2.3 listesi kapalı; yalnız Dönüştür'de |
| Word'e çıkmayan şekil kullanıcıyı şaşırtır | WO-008 gelene kadar şeklin altında "Word dışa aktarımında henüz yok" notu |

## 10. Kararlar (17.10.2026)

1. S1: evet, ölçütlerle (§5), ayrı onayla başlar.
2. Kelime bulutu: tamamen dışarıda; Poster/Sunum'da yeniden bakılır (§2.3).
3. E5: iki insan etiketleyici, kılavuz önce, kappa + F1 (§7).
4. WO-A: WO-016 olarak yazıldı (taslak). İngilizce sözlük Türkçeyle aynı
   kategorilerde, döngü ve yön dahil. Türkçe ek toleransı yalnız model
   çıktısı doğrulamasında yedek; gösterilen etiket her zaman cümledeki biçim.
