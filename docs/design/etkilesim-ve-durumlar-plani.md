# Etkileşim ve durumlar planı: katmanlar, anlamlar, bekleme, kartlar, hatalar

**Durum:** plan (16.10.2026). Bağlayıcı değil; uygulama iş emirleriyle olur
(öneri: "Etkileşim altyapısı" ve "Bekleme, hata ve kart durumları" iş emirleri; numara yazılınca verilir — bkz. §8).
Önce HTML prototipte denenir (kullanıcı kararı 16.10.2026: "HTML'de değiştir,
koda sonra geçeriz").

Dayanak: tasarım gözden geçirmesi (16.10.2026) ve aşağıdaki envanter.

---

## 0. Envanter — bugünkü kod (16.10.2026, okunarak doğrulandı)

### 0.1 Katmanlar (z-index)

`client/src` içinde **26 farklı z-index değeri** var (0'dan 9999'a); ortak bir ölçek yok.

| Değer | Yer | Not |
| --- | --- | --- |
| 50 | `styles/states.css:13` | |
| 100 | `App.jsx:1189` (tam ekran örtü) | |
| 110, 115 | `styles/workspace.css:40, 54` | Yazar modu tam ekran |
| 120, 200 | `styles/ui.css:497, 238` | |
| 1000 | `MethodologyModal.jsx:38` | |
| 8999, 9000, 9010 | `styles/writer.css:75, 113, 982` | Eski AI Yazar paneli |
| 9998 | `PaperReaderDrawer.jsx:59` | Makale okuyucu |
| 9999 | `ShareModal.jsx:38` | |

Sonuç: hangi katmanın hangisinin üstünde açılacağı tasarlanmamış, sayı
yarışıyla belirlenmiş. Örnek risk: makale okuyucu (9998) açıkken yazar modu
(110) altında kalır; paylaşım penceresi (9999) her şeyin üstünde, bildirimler
dahil.

### 0.2 Pencereler ve Esc

- `role="dialog"` olan 6 yer: `App.jsx`, `MethodologyModal`, `ShareModal`,
  `FormatPicker`, `SubmitPrep`, `Workspace`.
- Esc'i **9 ayrı** `keydown` dinleyicisi işliyor (App:280, AuthorPicker:123,
  ExportMenu:17, MethodologyModal:26, ShareModal:23, FormatPicker:36,
  OutlineNav:86, SubmitPrep:34, Workspace:200). AuthorPicker ve OutlineNav
  giriş alanına bağlı görünüyor; diğerlerinin `window`'a mı bağlı olduğu
  satır satır okunmadı. `window`'a bağlı olanlar arasında iki katman açıkken
  bir Esc ikisini birden kapatabilir. Doğrulanmadı — §7 testi.
- Odak hapsi hiçbir pencerede yok. `FormatPicker:35` açılışta odağı pencereye
  veriyor; kapanınca açan düğmeye dönmüyor.

### 0.3 Tarayıcının kendi kutuları

| Yer | Ne |
| --- | --- |
| `App.jsx:650` | `window.prompt` — taslak yeniden adlandırma |
| `App.jsx:667` | `window.confirm` — taslak silme (yanında geri al bildirimi de var: `App.jsx:674`) |
| `Workspace.jsx:890` | `window.confirm` — biçim değişiminde boş bölüm kaldırma (geri alınamaz) |
| `Workspace.jsx:918` | `window.confirm` — şablon metnin üstüne |
| `Workspace.jsx:1168` | `window.confirm` — kaynakçanın üstüne yazma |
| `hooks/useShare.js:48` | `alert` — paylaşım hatası |

Bildirim bileşeni var: `components/Toasts.jsx`.

### 0.4 Arama bekleme ekranı — tüzük 2.8 sorunu

`App.jsx:941-1009`:

- Aşama metni (`loading.steps`, 6 cümle) **2 sn'lik zamanlayıcıyla** değişiyor
  (`App.jsx:397-404`), gerçek ilerlemeyle bağı yok. Liste bitince **başa
  dönüyor** (`loadingStep % length`): 14. saniyede yeniden "Dokuz açık
  akademik kaynak sorgulanıyor…" yazıyor.
- 4 aşamalı gösterge de zamana göre yanıyor (`isActive = loadingStep >= i`).
- Göstergedeki metinler i18n dışında, koda gömülü (`App.jsx:976-981`) ve
  doğrulanması gereken iddialar taşıyor:
  - "9 Açık Kaynak": `server/services/search.js:1-11` 11 kaynak modülü
    içe aktarıyor (Elsevier `SCOPUS_ENABLED=false` ile kapalı → 10 açık).
    Hangilerinin gerçekten sorgulandığı ortam bayraklarına bağlı; sayı
    sabit yazılmamalı.
  - "SJR Q1-Q4 & Atıf Skoru": AHP'yi kalite puanı gibi sunuyor (tüzük 2.6).
  - "AI & MeSH Çeviri": MeSH çevirisi her aramada yapılıyor mu, doğrulanmadı.
- Hata: tek tip genel kutu (`App.jsx:1151-1158`), `search.failed` metni.
  Kısmi başarısızlık (bazı kaynakların düşmesi) arayüzde gösteriliyor mu,
  bulunamadı — §0.5.

### 0.5 Doğrulanmadı, Aşama 0'da bakılacak

- `/api/search` yanıtında kaynak bazlı durum alanı var mı
  (`stageResult.js` var; istemcide kullanan yer grep'te çıkmadı).
- Aramanın gerçek süresi (p50 / p95). Ölçülmedi.
- Sonuç kartında (`ResultCard.jsx`) hangi eksik/hata durumlarının görüntüsü var.
- Tüzük 2.7 notu (kapsam dışı, rapor): Kademe 2 kaynaklar (arXiv, CORE,
  OpenAIRE) "canlı sorgu gitmez" deniyor, ama `search.js` bunları içe
  aktarıyor. Canlı aramada çağrılıp çağrılmadığına bakılmalı.

---

## 1. Katman hiyerarşisi

### 1.1 Tek ölçek

Sayılar CSS değişkeni olur; bileşen sayı yazmaz, katman adı yazar.

| Katman | Değişken | Değer | Ne |
| --- | --- | --- | --- |
| Sayfa | `--z-base` | 0 | Belge, liste |
| Yapışkan | `--z-sticky` | 10 | Üst çubuk, şerit, durum çubuğu |
| Kenar paneli | `--z-panel` | 20 | Sol yapı, sağ kanıt paneli |
| Açılır menü | `--z-popover` | 30 | Seçim menüsü, açılır listeler, Görselleştir şeridi |
| Çekmece | `--z-drawer` | 40 | Makale okuyucu, Teslime hazırla |
| Pencere | `--z-modal` | 50 | Yeni belge, paylaşım, onay |
| Komut kutusu | `--z-palette` | 60 | Ctrl+K |
| Bildirim | `--z-toast` | 70 | Geri al, hata — her şeyin üstünde, çünkü pencere açıkken de görünmeli |
| İpucu | `--z-tooltip` | 80 | |

Kural: aynı anda en fazla bir pencere. Pencere üstünde pencere gerekiyorsa
tasarım hatasıdır (istisna: yıkıcı eylem onayı).

### 1.2 Katman yığını ve Esc

Açılan her katman (açılır menü, çekmece, pencere, komut kutusu) bir yığına
girer. **Tek** bir `keydown` dinleyicisi vardır:

- Esc → yalnız yığının en üstündeki kapanır.
- Yığın boşken Esc: seçim varsa seçimi kaldırır; editörde başka şey yapmaz.
- Kenar panelleri yığına girmez (kalıcı yerleşim parçası); Ctrl+. / Ctrl+\
  ile kapanır.
- Yazı yazılan alanda (input, editör) Esc metni değiştirmez.

### 1.3 Ortak pencere bileşeni

- Odak hapsi: Tab ve Shift+Tab pencere içinde döner.
- Arka plan `inert` + `aria-hidden`; ekran okuyucu arkayı okumaz.
- Açılışta ilk anlamlı alana odak (yeni belge: ad alanı, metin seçili).
- Kapanışta odak açan düğmeye döner.
- `aria-labelledby` başlığa, `aria-describedby` açıklamaya bağlı.
- Dışarı tıklayınca kapanır — **değişiklik yoksa**. Değişiklik varsa
  kapanmaz; Esc ve Vazgeç çalışır.

---

## 2. Anlam sözlüğü — bir işaret, bir anlam

Amaç: aynı renk, simge veya kelime iki farklı şey anlatmasın.

### 2.1 Renk

| Renk | Tek anlamı | Kullanılmaz |
| --- | --- | --- |
| Mor (birincil) | Eylem ve seçili durum; metindeki atıf | Durum veya kalite göstermek |
| Yeşil | Destekliyor; işlem başarılı; "Var" | "Hazır" rozeti (→ nötr) tartışılmalı |
| Amber | Kısmen; uyarı; dikkat isteyen | Bilgi |
| Kırmızı | Çelişiyor; hata; geri çekilmiş | Silme düğmesinin kendisi (→ metin + onay) |
| Gri | Kanıt yok; bilinmiyor; Yakında | Devre dışı ile "Yakında"nın ayrımı metinle |

Açık konu: yeşil hem "destekliyor" hem "başarılı" anlamında. Kanıt kartının
yanında başarı bildirimi yeşil olursa karışabilir. Öneri: başarı bildirimi
nötr (koyu), yeşil yalnız kanıt ve kontrol listesinde.

### 2.2 Simge

Envanter çıkarılır (lucide-react). Her simgenin tek anlamı; aynı anlam tek
simge. Bilinen çakışma adayları: ✦ hem "AI ile geliştir" hem "Görselleştir";
"kitap" hem Kaynaklar hem Kaynakça.

### 2.3 Kelime

Tüzük 2.13 terimleri esas: Araştırmacı paneli, Çalışma alanı, Sepet,
İddia/Kanıt/Pasaj. Ek kurallar:

- "Kaynaklar" (sepet içeriği) ile "Kaynakça" (belgedeki liste) ayrı.
- "Yakında" = yapılacak, tıklanamaz. "Devre dışı" = şu an şartı yok, nedeni
  ipucunda yazar. İkisi aynı görünmez.
- "Sil" yalnız geri alınamayan eylemde; geri alınabilene "Kaldır".
- Sayılar dürüst: "9 kaynak" gibi sabit sayı yok; sayı çalışma anında gelir.

---

## 3. Bekleme durumları

### 3.1 Genel kurallar

| Süre | Gösterim |
| --- | --- |
| < 300 ms | Hiçbir şey (titremesin) |
| 300 ms – 2 sn | Düğme içinde dönen simge; düğme metni "Aranıyor…" |
| > 2 sn | İskelet (sonucun şeklinde gri kutular) + gerçek durum satırı + İptal |
| > 20 sn | "Beklenenden uzun sürüyor" + İptal + "kaynakların bir kısmı yavaş" (gerçekse) |

İptal isteği gerçekten durdurur (`AbortController`). Sunucuya ulaşmış çağrı
çağrı bütçesinden düşer (tüzük 3.3); arayüz "iptal edildi" der, "hiç
yapılmadı" demez.

### 3.2 Arama ekranı — karar gerekiyor

Bugünkü zamanlayıcılı aşama gösterimi kaldırılır. İki yol:

| | A — Dürüst genel | B — Gerçek ilerleme |
| --- | --- | --- |
| Ne | "Kaynaklar taranıyor" + geçen süre + sonuç şeklinde iskelet | Sunucu kaynak bitişlerini akışla (SSE) gönderir; liste dolar: "OpenAlex ✓ 120 · Europe PMC ✓ 48 · Crossref yavaş…" |
| Sunucu değişikliği | Yok | `/api/search` akış ucu; projede SSE zaten var (`server/index.js:2028`) |
| Değer | Yalan yok, ama bilgi de az | Kullanıcı neyin tarandığını görür; düşen kaynak sessiz kalmaz (2.11 madde 3) |
| Risk | Düşük | Orta: hız sınırı, Render soğuk başlangıç, akış kopması |

**Öneri:** önce A (hemen, küçük iş), sonra B ayrı iş emriyle. A'da bile
"kaç kaynak, hangileri" bilgisi sonuçla birlikte gelir ve sonuç başlığında
gösterilir ("10 kaynak tarandı, 1'i yanıt vermedi").

### 3.3 Diğer bekleme noktaları

Envanterde süre ölçülür, kurala göre gösterim seçilir: AI ile geliştir,
araştırmacı arama, kaynakça oluşturma, atıflı cümle, kanıt bul (gelecek),
DOCX dışa aktarma, içe aktarma.

---

## 4. Kart durumları matrisi

Her kart türü için aşağıdaki durumların her biri tasarlanır ve prototipte
gösterilir. Boş hücre = tasarlanmadı demektir, "gerek yok" değil; gerek
yoksa "—" ve gerekçe yazılır.

| Durum | Sonuç kartı | Kanıt kartı | Kaynak satırı | Taslak kartı | Analiz sonucu |
| --- | --- | --- | --- | --- | --- |
| Normal | | | | | |
| Yükleniyor (iskelet) | | | | | |
| Eksik bilgi ("yıl bilinmiyor") | | | | — | — |
| Özet yok | | | | — | — |
| Geri çekilmiş / endişe beyanı | | | | — | — |
| Açık erişim yok / PDF yok | | — | | — | — |
| Kaynak yanıt vermedi (zenginleştirme düştü) | | | | — | — |
| Kanıt yok / çelişiyor | — | | — | — | — |
| Varsayım sağlanmadı | — | — | — | — | |
| Hata (tekrar dene) | | | | | |
| Salt okunur (başka sekmede açık) | — | — | — | | — |
| Yakında / devre dışı | | | | | |

Kurallar:

- Eksik alan "bilinmiyor" yazar, gizlenmez, tahminle doldurulmaz (2.8, 3.6).
- Zenginleştirme düşerse kart kalır, yalnız rozet görünmez (2.11) — bu hata
  değildir, kırmızı gösterilmez.
- Geri çekilmiş kaynak kartta en görünür bilgidir; "Sepete ekle" uyarı ister.
- Her kartta en fazla 3 eylem; fazlası "⋯" menüsüne.

---

## 5. Hata durumları

### 5.1 Sınıflandırma ve karşılık

| Durum | Nasıl anlaşılır | Kullanıcı ne görür | Eylem |
| --- | --- | --- | --- |
| İnternet yok | `navigator.onLine`, ağ hatası | "Bağlantı yok. Yazdıkların bu tarayıcıda duruyor." | Bağlantı gelince otomatik tekrar |
| Sunucu uyanıyor (Render soğuk başlangıç) | İlk istekte uzun süre / 502-503 | "Sunucu hazırlanıyor, bu ilk istekte 30 sn sürebilir." | Bekle, sonra tekrar |
| Oturum düştü (401) | 401 | "Oturumun sona erdi." | Giriş yap; metin kaybolmaz |
| Hız sınırı (429) | 429 + `Retry-After` | "Çok sık istek. N sn sonra tekrar dene." | Geri sayım |
| Sunucu hatası (5xx) | 5xx | "Bir sorun oldu. Tekrar dene." + hata kimliği | Tekrar dene |
| Zaman aşımı | İstemci süresi | "Yanıt gelmedi." | Tekrar dene / iptal |
| Kısmi sonuç | Bazı kaynaklar düştü | Sonuç başlığında: "1 kaynak yanıt vermedi: Crossref" | Yalnız o kaynağı tekrar dene (B yolunda) |
| Boş sonuç | 0 kayıt | "Bu sorguyla taranan kaynaklarda (liste, yıl aralığı) kayıt bulunamadı." — **"çalışma yok" denmez** (2.8) | Sorguyu genişlet, AI ile geliştir |
| Depolama dolu / kapalı | `localStorage` hatası | Kalıcı amber uyarı + DOCX indir (WO-011'de var) | — |
| Geçersiz girdi | İstemci denetimi | Alanın altında, alan adıyla | Alana odak |

### 5.2 Kurallar

- Hata metni ne olduğunu, kullanıcının kaybedip kaybetmediğini ve ne
  yapacağını söyler. "Bir hata oluştu" tek başına yasak.
- Teknik ayrıntı (hata kimliği) katlanır alanda, destek için.
- `alert` / `confirm` / `prompt` kullanılmaz (§6).
- Hata bildirimi ekran okuyucuya `role="alert"`, bilgi `role="status"`.

---

## 6. Yıkıcı eylemler

| Eylem (bugün) | Geri alınabilir mi | Yeni davranış |
| --- | --- | --- |
| Taslak sil (`App.jsx:667` confirm + 674 geri al) | Evet (anlık görüntü) | Onay kalkar; "Taslak kaldırıldı — Geri al" + Masam'da "Son silinenler" (7 gün) |
| Taslak yeniden adlandır (`App.jsx:650` prompt) | — | Satır içinde düzenleme |
| Boş bölüm kaldırma, biçim değişimi (`Workspace.jsx:890`) | **Hayır** (WO-014 gelene kadar) | Ürünün kendi onay penceresi; listesi gösterilir |
| Şablonu metnin üstüne uygulama (`:918`) | Hayır | Onay penceresi; varsayılan düğme "Vazgeç" |
| Kaynakçanın üstüne yazma (`:1168`) | Anlık görüntüyle evet olabilir | Geri al bildirimi (anlık görüntü eklenirse) |
| Paylaşım hatası (`useShare.js:48` alert) | — | Hata bildirimi |
| Sepeti temizle (iki adımlı, WO-011) | Anlık görüntüyle evet olabilir | Geri al bildirimi |

Geri al bildirimi: 8 sn, üzerine gelince durur, klavyeyle odaklanabilir.
Aynı anda en fazla 3 bildirim.

---

## 7. Doğrulama

| Ne | Nasıl |
| --- | --- |
| Katman sırası | Playwright: her katman çifti açılır, üstteki tıklanabilir mi |
| Esc | Playwright: iki katman açıkken bir Esc yalnız üsttekini kapatır |
| Odak hapsi | Playwright: pencerede 20 kez Tab, odak dışarı çıkmaz; kapanınca açan düğmede |
| Kontrast | Mevcut tarama betiği (prototipte 6 ekranda AA geçti) koda uyarlanır |
| Bekleme | Ağ yavaşlatma (Playwright route gecikmesi): 0,2 / 1 / 5 / 25 sn |
| Hatalar | Playwright route ile 401, 429, 500, 503, zaman aşımı, kısmi yanıt, boş yanıt taklidi |
| Kart durumları | Her durum için sabit veri; ekran görüntüsü |
| Otomatik erişilebilirlik taraması | `@axe-core/playwright` önerilir — **yeni bağımlılık, onay gerekir** (lisans MPL-2.0, doğrulanacak) |

---

## 8. Sıra ve iş emirleri

| Adım | Ne | Nerede | Çıkış koşulu |
| --- | --- | --- | --- |
| 0 | Envanter tamamlanır (§0.5): arama süresi ölçümü, kaynak durumu alanı, ResultCard durumları, Kademe 2 çağrıları | Salt okunur | Eksik satırlar dolduruldu |
| 1 | Prototip: katman ölçeği, yığın+Esc, ortak pencere, geri al bildirimi, arama bekleme (A), hata ekranları, kart durumları | HTML prototip | Kullanıcı elle denedi |
| 2 | **WO-E1 — Etkileşim altyapısı:** z-index değişkenleri, katman yığını, ortak pencere, bildirim kuyruğu, 6 tarayıcı kutusunun kaldırılması | Kod | §7'nin ilk 4 satırı geçiyor |
| 3 | **WO-E2 — Bekleme, hata ve kart durumları:** arama bekleme (A), hata sınıfları, kart durum matrisi | Kod | §7'nin son 4 satırı geçiyor |
| 4 | WO-E3 — Gerçek arama ilerlemesi (B, SSE) | Kod + sunucu | Ayrı karar |

WO-E1 önce: diğer her şey ortak pencere ve bildirim bileşenini kullanıyor.

## 9. Araştırmadan yazıma köprü

Kullanıcı kararları (16.10.2026), prototipte uygulandı ve Playwright ile
sınandı (`yazim-alani-prototip.html`, sağ panel › Kanıt).

### 9.1 Kararlar

| # | Karar | Gerekçe |
| --- | --- | --- |
| 1 | Kartlar "Son aramandan ilgili olabilir" başlığıyla, **nötr** görünür; kanıt sınıfı rozeti yok | Konu benzerliği destek değildir (2.4). Kanıt kartıyla karışmaması için ayrı görünüm |
| 2 | Havuz: önce sepet, sonra son 3 arama; iki ayrı başlık; aynı makale bir kez | Sepet kullanıcının kendi seçimi |
| 3 | Eşleştirme **tarayıcıda**, model çağrısı yok | Maliyet sıfır, veri dışarı çıkmaz; gömmeli sürüm ölçüm (Bölüm 4) olmadan savunulamaz |
| 4 | Yalnız iddia seçilip "Kaynak ihtiyacını değerlendir" denince ya da panel açılınca çalışır | Her tuşta değil |
| 5 | Eylemler: "Atıf olarak ekle", "Özeti oku". Eklenen atıf **"doğrulanmadı"** işaretli (kesik amber alt çizgi + "?") ve Kontrol'de "Doğrulanmamış atıf" uyarısı | Akış kesilmez, güvence Teslime hazırla'da. "Kanıt bul" gelince sırayla doğrulanır |
| 6 | Atıf **imlece değil iddia cümlesinin kimliğine** bağlanır; cümle silindiyse eklenmez: "Bu cümle artık belgede yok" | Panel okunurken imleç kayabilir |
| 7 | Dil farkı: **A yolu** — Türkçe iddia İngilizce özetle değil, makaleyi getiren **arama sorgusuyla** karşılaştırılır | İddia ve sorgu aynı dilde (kullanıcının kendi kelimeleri). Zayıf kalırsa B (PR1 ile genişletme), sonra C (gömme) |

### 9.2 Prototipte eklenen kurallar (denerken çıktı)

- **İddia her zaman tam cümle.** Yarım seçim cümle sınırına genişletilir;
  önce "…korunum denk" gibi yarım parça iddia oluyordu.
- **Aynı iddiaya ikinci atıf ilkinin arkasına girer.** Önce öne giriyordu.
- **Geri çekilmiş kaynak listede kalır ama atıf düğmesi kapalı** ("Atıf
  önerilmez"); gizlenmez (2.8).
- **Her kart neden orada olduğunu söyler:** hangi arama, ne zaman, ortak
  kelimeler. Kullanıcı eşleşmenin ne kadar zayıf olduğunu kendisi görür.
- **Eşleşme yoksa** boş ekran değil: "Son 3 aramanda bu cümleyle eşleşen bir
  sorgu yok" + iddianın kelimeleriyle "Araştırmada ara" (sorgu kutusu dolu
  gelir).
- "Özeti oku" altında: "Yalnız özet; tam metin okunmadı" (2.8).
- Sağ paneldeki eski "Destekliyor / Kısmen / Çelişiyor" kartları
  "Doğrulanmış kanıt — Yakında, örnek görünüm" başlığına alındı. "Kanıt bul"
  yokken çalışıyor gibi görünmeleri bu kararlarla çelişiyordu.

### 9.3 Eşleştirme yöntemi ve sınırı

- Türkçe kaba gövde: kelimenin ilk 5 harfi, 4 harften kısa kelimeler ve bir
  durak listesi atılır. Eşik: sorguyla en az **2** ortak gövde.
- Bu **ölçülmüş bir yöntem değil.** İsabet oranı bilinmiyor; kalite iddiası
  yapılmaz (4.1). E1 kümesi kurulunca A/B/C karşılaştırılır.
- Bilinen zayıflık: iddia ile sorgu farklı kelimelerle aynı şeyi söylüyorsa
  ("ısı uzaklaştırma" / "soğutma") eşleşme kaçar.

### 9.4 Koda geçerken gerekenler

| Gereksinim | Bugünkü kodda |
| --- | --- |
| Arama geçmişinde her sonucun hangi sorgudan geldiği (köken) | `/api/history` var; sonuç–sorgu bağı tutuluyor mu bakılmadı |
| Sepetteki makalenin hangi aramadan eklendiği | `useBasket` / `/api/basket`; köken alanı bakılmadı |
| Cümle kimliği | contentEditable'da kalıcı değil; TipTap (WO-004) cümle çapalarıyla gelir. Ara çözüm: iddia `span` + kimlik |
| "Doğrulanmadı" atıf işareti | Atıf modelinde alan yok; `origin` benzeri bir alan gerekir (3.6) |

## 10. Dış kaynak incelemesi: düşünme modelleri (16.10.2026)

İncelenen: `ponomr/thinking-toolkit` (MIT, `e7ae771`, 31 kart + `/logic`) ve
`cyperx84/claude-skills-mental-models` (MIT, `4f7d092`, 21 model). İkisi de
ajan talimatı (Markdown), çizim kodu değil. **Kod alınmadı; fikir ve yapı
uyarlandı.** Kaynak notu: mental-models kartları kendi frontmatter'ında
"generated by claude-opus-5" diyor ve kaynakları çoğunlukla Wikipedia —
kullanıcıya gösterilecek açıklamalar kendi metnimizle, doğrulanmış birincil
kaynakla yazılır (tüzük 3.1).

### 10.1 Alınanlar

| Ne | Nereden | Bizdeki karşılığı |
| --- | --- | --- |
| Balık kılçığı, kavram haritası, geri besleme, piramit/argüman | thinking-toolkit kartları | Görselleştir şablonları (prototipte; 9 şablon) |
| "Neden bu model, neden o değil" karşıtlık kuralları | catalog.md › Selection Rules | Şablon önerisi + "Neden uygun" + uymayanın gerekçesi |
| "Kanıt uydurma, bilinmeyeni işaretle" | iki deponun ortak sözleşmesi | Zaten tüzük 2.8; görselde "etiket cümleden birebir" kuralı |
| Kavram haritasında etiketsiz çizgi yasağı | concept-map › Pitfalls | Her ok bir cümle parçasıyla etiketli |
| Balık kılçığı "kanıt değildir" uyarısı | ishikawa › Avoid When | Şekil altında "nedenler metinden; nedensellik kanıtı değil" notu (yapılacak) |

### 10.1a Görsellerin düzenlenmesi (prototipte, 16–17.10.2026)

- Her kutu ve ok etiketi düzenlenebilir; satır kaynak cümleyi gösterir
  ("Kutu · cümle 2"). Elle değişen etiket "elle" işaretlenir, ↺ ile cümledeki
  haline döner. **Kaynak cümle bağı düzenlemede kopmaz.**
- Belgeye eklenen şekil üzerine gelince "Düzenle · Kaldır". Düzenle şekli tüm
  durumuyla (şablon, renk, yön, etiketler, başlık) açar; "Güncelle" aynı
  şekli değiştirir, liste başlığı da güncellenir. Kaldır geri alınabilir.
- Etikete "(Ad, yıl)" ya da "[14]" yazılırsa uyarı: şekil etiketindeki atıf
  kaynakçaya girmez (3.1). Engellenmez, uyarılır.
- Görsel henüz belgede değilken etiket yazmak belgeyi "değişti" saymaz.
- Üründe: elle düzenlenen etiket `origin: user_written` taşır (3.6).

### 10.1b Şema içeriği nereden gelir

**Prototipte:** üç örnek paragrafın yapısı elle yazıldı (`MODELS`); AI yok,
rastgelelik yok. Yerleşim ve çizim kodda.

**Üründe üç katman:**

1. **Çıkarma — model.** Kavramlar ve ilişkiler; her biri için cümle numarası
   ve cümleden birebir parça.
2. **Doğrulama — kod.** Parça cümlede birebir geçmiyorsa atılır.
3. **Şablon uygunluğu ve çizim — kod.** Uygunluk ilişki grafının şeklinden
   hesaplanır (kapanan döngü → döngü; tek zincir → akış; çok kaynak tek hedef
   → balık kılçığı; ağaç → hiyerarşi). Model şablon seçmez.

**Düzeltme:** tasarım belgesindeki P6 (`atif-dogrulamali-yazim-motoru.md`)
bu iş için yetmiyor: cümle numarası ve birebir parça istemiyor, ilişki
etiketi üretmiyor, 4 ilişki türüyle sınırlı. **PR6.v2** gerekir. Kalite,
etiketli paragraf kümesiyle ölçülmeden iddia edilmez (4.1). Yedek: Türkçe
bağlaç kurallarıyla modelsiz çıkarım (yalnız kalıplı paragraflarda).

### 10.1c Çizim motoru adayları (17.10.2026, kaynak kodu okunarak)

| | AntV Infographic (`2ea1894`, v0.2.20) | OpenNapkinAI (`0d0f289`) |
| --- | --- | --- |
| Lisans | MIT | MIT |
| Ne | Bildirimsel infografik motoru + düzenleyici | Örnek uygulama: metin → model → 6 şablon |
| Şablon | ~200 hazır; 40 yapı türü (süreç, döngü, hiyerarşi, zihin haritası, karşılaştırma, dörtlü matris, zaman çizelgesi, piramit, ilişki akışı, çubuk/çizgi/pasta) | 6 (process, cycle, hierarchy, pyramid, matrix, comparison), ~860 satır |
| Ok etiketi | Var (`relations[].label`) | Yok |
| Kendi alanımızı taşıma (cümle no) | Var (`[key: string]: any`) | Şemada yok |
| Düzenleyici | Var: çift tıkla yazı düzenleme, sürükleme, boyutlandırma, geri al | Yok |
| Dışa aktarma | SVG, PNG (yazı tipi gömme) | İndirme (`download.ts`) |
| Test | 117 dosya | Yok |
| **Gizlilik** | **Sorun:** simge/görsel yüklenemezse kutunun yazısı (`label`/`desc`) yedek sorgu olarak `weavefox.cn` simge servisine gider (`resource/loader.ts:104-114`, `constants/service.ts:1`). Yazı tipi `assets.antv.antgroup.com`'dan | Sunucu gelen metnin tamamını loglar (`routes/ai.ts`: `console.log("Received context:", context)`); varsayılan model bulut (`gemma4:cloud`) |
| Tüzük uyumu | Yalnız çizer; içerik kararı bizde kalır → uyumlu olabilir | **Uyumsuz:** model başlık ve içeriği kendi cümlesiyle yazar (özetleme, 2.2); `/structured` "tam 4 madde" zorlar; şablonu model seçer; cümle bağı yok |
| Diğer | Düzenleyici arayüzü Çince ("默认"); varsayılan yazı tipi Alibaba PuHuiTi (Türkçe glif kapsamı doğrulanmadı); `d3`, `linkedom`, `postcss` bağımlılığı; boyut sınırı 500 KB gzip (gerçek boyut ölçülmedi); 1.0 öncesi | — |

**Karar önerisi:**

- **OpenNapkinAI kodu alınmaz.** İki fikri alınır: modelin "şekli zorlama,
  3–9 düğüm" kuralı ve çıktıyı çizmeden önce onaran `normalizeSmartArtStructure`
  adımı (bizdeki doğrulama katmanıyla aynı fikir).
- **Infographic, çizim katmanı (katman 3) adayıdır**, bizim katmanlarımızın
  yerine değil. Model → birebir doğrulama → graf şekli → *Infographic yalnız
  çizer*. Benimsemeden önce şartlar (hepsi doğrulanmadan bağımlılık eklenmez,
  kural 6):
  1. Dış istek sıfır: simge/görsel kullanan şablonlar kapalı; yedek arama
     yolu yamayla ya da CSP `connect-src` ile kesilir; ağ kaydıyla test.
  2. Yazı tipi bizim (Plus Jakarta Sans / Source Serif); Türkçe karakterler
     (ğ ş ı İ) çizimde ve PNG/SVG dışa aktarmada sınanır.
  3. Düzenleyici arayüzü Türkçeleştirilir.
  4. Paket boyutu ölçülür; yalnız Görselleştir açılınca tembel yüklenir.
  5. Sürüm sabitlenir (1.0 öncesi API değişebilir); alt bağımlılık lisansları okunur.

### 10.2 Yeni alan adayları (karar bekliyor)

| Aday | Kaynak | Nasıl çalışır | Model gerekir mi | 2.12 notu |
| --- | --- | --- | --- | --- |
| **Kaynaksız otorite ifadesi** ("çalışmalar göstermektedir", "literatürde belirtildiği gibi" + atıf yok) | `/logic` › Cited-authority theater | Kontrol kuralı, kelime kalıbı | Hayır | Tüzük 3.3'ün "boşaltıcı ifade" yasağıyla aynı; ucuz, savunulabilir |
| **Aşırı genelleme** ("her zaman", "tüm", "kesinlikle" içeren iddia) | `/logic` › Hasty generalization | Kontrol kuralı (Bilgi düzeyi) | Hayır | Yanlış pozitif yüksek; yalnız iddia cümlelerinde |
| **İlişkiden nedensellik dili** (korelasyon analizine dayanan cümlede "neden olur", "etkiler") | induction.md › Mill guardrails; WO-006 `apa.js` kuralı | Analiz sonucuna bağlı cümlede kalıp | Hayır | Analiz–metin bağı kurulunca |
| **Sınırlılıklar rehberi** (örneklem nasıl seçildi, kim eksik, hayatta kalan yanlılığı, ortalamaya dönüş) | mental-models › sampling, confirmation-bias, regression-to-the-mean | Sınırlılıklar bölümünde soru listesi; **kullanıcı yazar** | Hayır | Metin üretmez; tez jürisinin sorduğu sorular |
| **Argüman denetimi** (review kipi: tez, öncüller, gizli öncül, safsata adı) | `/logic` review | Paragraf → bulgu listesi, cümleye bağlı | **Evet** | Yalnız *review*; *fix* kipi metni yeniden yazar → 2.2 ihlali, alınmaz. Bölüm 4 kümesi olmadan kalite iddiası yok |
| **Araştırma sorusu ağacı** | issue-trees, abstraction-laddering | Giriş bölümünde boş ağaç; kullanıcı doldurur | Hayır | Değeri belirsiz; kullanıcı gözlemiyle sınanmalı |

### 10.3 Alınmayanlar

İş/ekip yönetimi odaklı, akademik yazıma karşılığı zayıf: Eisenhower,
Etki–Efor, OODA, SBI, Altı Şapka, Cynefin, Hard Choice, Speed–Quality,
Backcasting, Zwicky, Productive Thinking, Red Teaming (ekip ister); mental
models'tan asimetrik savaş, kıtlık, sosyal kanıt, yaratıcı yıkım, aktivasyon
enerjisi, atalet, kaldıraç, darboğaz.

## 11. Açık kararlar

1. Arama bekleme: A ile başlayıp B'ye geçmek mi, doğrudan B mi? (öneri: A → B)
2. Yeşilin iki anlamı: başarı bildirimi nötr mü olsun? (öneri: evet)
3. "Son silinenler" süresi 7 gün mü? Taslaklar yalnız tarayıcıda olduğu için
   depolama kotasına sayılır.
4. `@axe-core/playwright` eklensin mi? (yeni geliştirme bağımlılığı)
5. Bekleme göstergesindeki "SJR Q1-Q4 & Atıf Skoru" ifadesi: kaldırılsın mı,
   "senin seçtiğin önceliklerle sıralanıyor" mu olsun? (tüzük 2.6)
