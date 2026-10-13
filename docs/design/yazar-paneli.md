# Yazar Paneli — Tam Tasarım

**Durum:** tasarım önerisi (2026-10-13). Bağlayıcı değil; uygulama iş emirleriyle
olur. Bağlayıcı kurallar `CLAUDE.md`'de.
**Kaynaklar:** kullanıcının 2026-10-13 isteği · `atif-dogrulamali-yazim-motoru.md`
· `calisma-alani.md` · `mockup-yazar-modu.html`
**Görsel taslak:** `mockup-yazar-paneli.html` (tarayıcıda aç)

---

## 0. Bir cümlede

Yazar paneli, araştırmacının topladığı kaynaklarla **yazdığı**, **analiz
ettiği** ve **anladığı** tek ekran: solda belge ağacı, ortada sayfa, sağda
kanıt–analiz–öğrenme araçları. Hiçbir şey belgeye kendiliğinden girmez.

---

## 1. İstenenler ve karşılıkları

| İstek | Karşılığı | Bölüm |
| --- | --- | --- |
| Basınca yeni panele dönsün, sol kütüphane kapansın | Tam ekran kip; uygulama kabuğu gizlenir | 3 |
| Araştırma sayfasına dönüş yolu | Üst çubukta "← Literatüre dön" + `Esc` | 3.2 |
| 30 makalelik hafıza artsın | Sepet 30 → 100; çalışma kümesi ayrı | 9.1 |
| Ekrandaki yazı alanları geçici tutulsun | Üç katmanlı taslak saklama | 9.2 |
| Cetvel Word'deki gibi olsun | Gerçek cetvel: ara çizgiler, sürüklenen kenar ve girinti tutamakları | 6.1 |
| Makaleler eklenince bir yerde görünsün | Sol ağaçta "Kaynaklar" sekmesi + sağ panelde kart | 5.2, 7.1 |
| Ne yazmak istediğine göre hazır şablon, ana başlıklarla | Şablon galerisi; seçince bölüm ağacı kurulur | 8 |
| Analizler tuşu, SPSS gibi tüm yöntemler | Analiz paneli: 30+ test, varsayım kontrolü, APA çıktısı | 10 |
| Gerekirse ek panel açılsın, hesaplasın, "Ekle" deyince istenen yere koysun | Analiz çekmecesi + imleç konumuna ekleme | 10.4 |
| Metni tarayınca napkin.ai gibi öğrenme şablonları, düzenlenebilir | Anla sekmesi: 10 görsel/öğrenme şablonu, SVG düzenlenebilir | 11 |
| Atıflı cümle veya metin üret | Kanıt sekmesi; pasajdan tek cümle, sonra isteğe bağlı paragraf | 12 |

---

## 2. Ürün sınırı: neyi yapmıyoruz

Bu panel **kaynaksız metin üretmez**. Sınır üç kuralda somut
(`CLAUDE.md` 2.2, 2.9, 3.1):

1. Üretim yalnızca getirilmiş bir **pasajdan** yapılır. Pasaj yoksa cümle yok.
2. Üretilen her cümle, kaynak pasajı ve destekleme sınıfıyla birlikte gösterilir.
3. Belgeye hiçbir şey otomatik girmez; kullanıcı tıklar.

**Panelde olmayacaklar:** "Bölümü benim için yaz", "Paragrafı genişlet",
"Özet çıkar", serbest sohbet kutusu, "%98 doğruluk" rozeti, sağlayıcı adı
("GPT-4o" gibi) etiketi.

**Bunların yerine:** "Atıflı cümle üret" (tek pasaj → tek cümle),
"Bu cümleyi doğrula" (iddia → pasaj → destek sınıfı), "Hakem ne der".

---

## 3. Ekran mimarisi

### 3.1 Tam ekran kip

AI Yazar düğmesine basınca panel **uygulamanın üstünü kaplar**:

- Sol kütüphane (geçmiş kenar çubuğu) kapanır.
- Uygulamanın üst çubuğu ve arama kartı gizlenir.
- Tarayıcı adresi değişmez (uygulamada yönlendirici yok); kip `mode` durumunda.
- Araştırma sayfasının durumu **korunur**: dönünce sonuçlar, filtreler ve
  kaydırma konumu yerindedir (`CLAUDE.md` 2.11).

### 3.2 Dönüş yolları

| Yol | Davranış |
| --- | --- |
| Üst çubukta "← Literatüre dön" | Panel kapanır, araştırma sayfası aynen açılır |
| `Esc` | Aynı. Metin kutusundayken çalışmaz (yazıyı bölmesin) |
| Sol raydaki "Literatür" simgesi | Aynı |
| Sağ panelde "Kaynak ara" | Araştırmaya döner, arama kutusuna odaklanır |

Belge kaydedilmemişse çıkarken uyarı yok: kayıt otomatik (9.2).

### 3.3 Beş bölge

```
┌────┬──────────────┬──────────────────────────────┬─────────────────┐
│ A  │ B            │ C                            │ D               │
│ Ray│ Belge gezgini│ Dosya çubuğu + Şerit         │ Sağ panel       │
│ 56 │ 260 px       │ ─────────────────────────────│ 340 px          │
│ px │ (katlanır)   │ Cetvel                       │ Sekmeli         │
│    │              │ ┌──────────────────────────┐ │                 │
│    │              │ │  Sayfa (A4)              │ │                 │
│    │              │ └──────────────────────────┘ │                 │
│    │              │ E: Durum çubuğu              │                 │
└────┴──────────────┴──────────────────────────────┴─────────────────┘
```

Dar ekran (<1100 px): B ve D çekmeceye döner, düğmeyle açılır.
Telefon (<768 px): yalnız C; B ve D alttan tam ekran çekmece.

---

## 4. A — Sol ray (56 px)

Dikey, koyu zemin. Her simge bir çalışma alanı; aktif olan renkli.

| Simge | Ad | İşlev |
| --- | --- | --- |
| ⚡ | Logo | Panele genel bakış; tıklayınca gösterge paneli (son belgeler, devam et) |
| ✎ | **Yazar** | Bu panel (aktif) |
| 📖 | Literatür | Araştırma sayfasına döner |
| 🗂 | Koleksiyonlar | Kayıtlı kaynak kümeleri |
| 📝 | Notlar | Belgeden bağımsız serbest notlar, kaynağa bağlanabilir |
| 📊 | Analizler | Analiz panelini tam ekran açar (10) |
| ⚙ | Ayarlar | Atıf stili, dil, varsayılan şablon, otomatik kayıt |
| ? | Yardım | Kısayol listesi, kısa tanıtım turu |
| 👤 | Profil | Hesap, abonelik, kullanım |

**Kural:** Ray her zaman görünür. Panel içinde kaybolmamak için tek sabit nokta.

---

## 5. B — Belge gezgini (260 px, katlanabilir)

Dört sekme: **Bölümler · Kaynaklar · Şekiller · Notlar**

### 5.1 Bölümler sekmesi

Belgenin başlık ağacı (H1–H3'ten otomatik üretilir).

| Öğe | İşlev |
| --- | --- |
| Başlık satırı | Tıkla → o bölüme kaydır |
| Sürükle-bırak | Bölüm sırasını değiştirir, metin de taşınır |
| Sağ tık menüsü | Yeniden adlandır, düzey değiştir, sil, alt bölüm ekle |
| Yanındaki nokta | Bölümün kanıt durumu: yeşil (hepsi kaynaklı), sarı (kısmi), gri (boş), kırmızı (çelişen kaynak var) |
| Sayaç | Bölümdeki kelime / hedef (şablondan gelir) |
| "+ Bölüm ekle" | Sona yeni H2 ekler |

**Alt istatistik kutusu:** hedef sayfa ilerlemesi (%), tahmini okuma süresi,
toplam atıf sayısı, kaynaksız cümle sayısı.

### 5.2 Kaynaklar sekmesi

Sepetteki makaleler. **"Makaleler eklenince bir yerde görünsün" isteğinin yeri.**

| Öğe | İşlev |
| --- | --- |
| Kaynak satırı | Yazar, yıl, kısa başlık; tıkla → sağ panelde kart açılır |
| Rozet | Kullanıldı / kullanılmadı (belgede atıfı var mı) |
| Sağlık işareti | Geri çekilmiş (kırmızı), DOAJ'da (yeşil), ön baskı (gri) |
| Arama kutusu | Başlık, yazar, yıl içinde süzer |
| Sıralama | Eklenme, yıl, atıf sayısı, kullanım durumu |
| "+ Kaynak ara" | Araştırma sayfasına döner |
| Toplu seçim | Seçilenleri çalışma kümesine al, kaynakçaya ekle, dışa aktar |

**Kullanılmayan kaynak uyarısı:** belgede hiç atıfı olmayan kaynaklar ayrı
grupta toplanır ("6 kaynak hiç kullanılmadı").

### 5.3 Şekiller sekmesi

Belgeye eklenmiş tablo, diyagram ve grafiklerin listesi. Numaralandırma
otomatik (Tablo 1, Şekil 1…); sıra değişince numaralar güncellenir.
Tıkla → o şekle git. Her birinin yanında kaynağı (hangi analiz, hangi makale).

### 5.4 Notlar sekmesi

Belgeye girmemiş serbest notlar. Her not bir kaynağa veya bölüme
bağlanabilir. "Metne ekle" ile belgeye taşınır.

---

## 6. C — Merkez: dosya çubuğu, şerit, cetvel, sayfa

### 6.0 Dosya çubuğu (üst satır)

| Öğe | İşlev |
| --- | --- |
| ← Literatüre dön | Paneli kapatır |
| 📄 Belge adı | Tıkla → yerinde yeniden adlandır |
| Kayıt durumu | "Kaydedildi 14:32" / "Kaydediliyor…" / "Çevrimdışı — tarayıcıda tutuluyor" |
| ↶ ↷ | Geri al / yinele |
| 🕘 Sürüm geçmişi | Son 20 anlık görüntü; önizle, geri yükle, karşılaştır |
| Dosya / Düzenle / Ekle / Biçim / Araçlar | Açılır menüler (şeritte olmayan seyrek komutlar) |
| 🔍 Bul ve değiştir | `Ctrl+F` / `Ctrl+H` |
| 👥 Paylaş | Salt okunur bağlantı (mevcut paylaşım altyapısı) |
| ⬇ Dışa aktar ▾ | Word, PDF, LaTeX, Markdown, BibTeX/RIS, **Denetim izi PDF'i** |
| ⛶ Odak kipi | B ve D gizlenir, yalnız sayfa kalır |

### 6.1 Cetvel

İstek: "Word'deki gibi olsun." Gerekenler:

- **Sayı çizgileri** her 1 cm'de, rakamla; her 0,5 cm'de kısa çizgi.
- **Kenar boşluğu bölgeleri** gri; sınırları **sürüklenebilir** — sürükleyince
  sayfa ayarı da güncellenir.
- **Girinti tutamakları**: ilk satır girintisi (üst üçgen), asılı girinti
  (alt üçgen), sağ girinti. Seçili paragrafa uygulanır.
- **Sekme durakları**: cetvele tıklayınca sekme eklenir, sürüklenir, aşağı
  çekilince silinir.
- **Dikey cetvel** (isteğe bağlı, Görünüm menüsünden): üst/alt kenar boşluğu.
- Yakınlaştırmayla ölçek birlikte değişir; birim cm veya inç (Ayarlar'dan).

### 6.2 Şerit — her düğme ve işlevi

Beş sekme; varsayılan **Giriş**. Sekme değişince satır değişir, ekran kaymaz.

#### Giriş

| Grup | Düğme | İşlev | Kısayol |
| --- | --- | --- | --- |
| Pano | Yapıştır (biçimli / düz) | Dış metin yapıştırma; düz yapıştırma varsayılan | `Ctrl+Shift+V` |
| | Biçim fırçası | Biçimi kopyalar | |
| Yazı tipi | Yazı tipi, punto | Belge geneli ya da seçim | |
| | A⁺ A⁻ | Punto büyüt / küçült | `Ctrl+Shift+>` |
| | **B** *I* <u>U</u> ~~S~~ | Kalın, italik, altı çizili, üstü çizili | `Ctrl+B/I/U` |
| | x² x₂ | Üst / alt simge | `Ctrl+.` / `Ctrl+,` |
| | Renk, Vurgu | Metin rengi, vurgulayıcı | |
| | Biçimi temizle | Seçimdeki biçimi siler | |
| Paragraf | Stil seçici | Gövde, Başlık 1–3, Alıntı, Şekil altyazısı, Tablo başlığı, Kaynakça | |
| | Hizalama ×4 | Sol, orta, sağ, iki yana | `Ctrl+L/E/R/J` |
| | Liste ×3 | Madde, numaralı, çok düzeyli | |
| | Girinti artır / azalt | | `Tab` / `Shift+Tab` |
| | Satır aralığı | 1 · 1,15 · 1,5 · 2 · özel | |
| | Paragraf aralığı | Önce / sonra boşluk (pt) | |
| Stiller | Hızlı stil galerisi | Şablonun stilleri; tıkla uygula | |

#### Ekle

| Düğme | İşlev |
| --- | --- |
| Tablo | Izgara seçici (n×m); eklendikten sonra satır/sütun ekle-sil, başlık satırı, hücre birleştir |
| **Literatür matrisi** | Seçili kaynaklardan otomatik tablo: Yazar & Yıl, Örneklem, Yöntem, Bulgu, Sınırlılık. Her hücre pasaja bağlı |
| Görsel | Dosyadan resim; altyazı ve numara otomatik |
| **Diyagram** | Anla sekmesindeki şablonlardan seçim (11) |
| **Grafik** | Analiz panelindeki sonuçtan (10) |
| Denklem | LaTeX girişi, canlı önizleme |
| Sembol | Yunan harfleri, matematik, birim |
| **Atıf** | Kaynak seç → metin içi atıf ekler; kaynakçayı günceller |
| **Dipnot / son not** | Otomatik numaralı |
| Çapraz başvuru | "Tablo 1", "Şekil 2", "Bölüm 3.2" — numara değişince güncellenir |
| Sayfa sonu / bölüm sonu | |
| Üst bilgi / alt bilgi / sayfa numarası | |
| İçindekiler | Başlıklardan üretir, güncellenir |

#### Düzen

| Düğme | İşlev |
| --- | --- |
| Kağıt boyutu | A4, Letter, A5, özel |
| Yön | Dikey / yatay |
| Kenar boşlukları | Dar, normal, geniş, özel (mm) |
| Sütunlar | 1 / 2 (konferans bildirisi için) |
| Satır numaraları | Hakem sürümü için |
| Filigran | "TASLAK", "HAKEM SÜRÜMÜ" |
| Sayfa rengi, kenarlık | |

#### Başvurular

| Düğme | İşlev |
| --- | --- |
| Atıf stili | APA 7, IEEE, Vancouver, Chicago, MLA + dergi stilleri (CSL) |
| Kaynakça ekle / güncelle | Belgedeki atıflardan üretir |
| **Kaynakça denetimi** | Eksik alan, geri çekilmiş kaynak, metinde olmayan kaynakça kaydı, kaynakçada olmayan atıf |
| Alıntı ekle | Blok alıntı + sayfa numarası |
| Terimler sözlüğü | |

#### Gözden geçir

| Düğme | İşlev |
| --- | --- |
| Yazım ve dil bilgisi | Türkçe/İngilizce |
| **Kaynaksız cümle taraması** | Atıf işareti olmayan cümleleri işaretler, sayar |
| **Hakem gözüyle** | Seçili cümleye en güçlü itirazı üretir (PR5), somut düzeltme önerisiyle |
| Okunabilirlik | Cümle uzunluğu, pasif çatı oranı, terim yoğunluğu |
| Değişiklikleri izle, Yorumlar | Danışman geri bildirimi |
| Karşılaştır | İki sürüm arasındaki fark |
| Kelime sayacı | Bölüm bazında |

### 6.3 Sayfa (belge alanı)

- Gerçek sayfa görünümü: kağıt boyutu, kenar boşlukları, sayfa sonları görünür.
- **Her cümlenin solunda durum noktası:**
  🟢 doğrulandı · 🟡 kısmi destek · ⚪ kaynaksız · 🔴 çelişiyor / geri çekilmiş kaynak
  Noktaya tıkla → sağ panelde o cümlenin kanıtı açılır.
- **Seçim yapınca yüzen araç çubuğu:** Biçim · **Doğrula** · **Hakem ne der** ·
  **Görselleştir** · Not ekle · Yorum.
  (Mockup'taki "AI ile Yeniden Yaz" burada yok — 2. bölüm.)
- Sağ kenarda **mini harita**: belge boyunca kanıt durumunun renk şeridi.

### 6.4 E — Durum çubuğu

Sayfa n/m · Kelime · Karakter · Cümle · **Kaynaksız: 3/14** · Atıf: 28 ·
Okuma ~18 dk · Kayıt durumu · Dil · Yakınlaştırma (−/+ ve %)

---

## 7. D — Sağ panel (340 px)

Beş sekme: **Kaynaklar · Kanıt · Anla · Analiz · Şablon**

### 7.1 Kaynaklar

Seçili kaynağın kartı: başlık, yazarlar, dergi, yıl, DOI, atıf sayısı, açık
erişim bağlantısı, ORCID bağlantısı, dergi sağlığı (DOAJ, geri çekme), özet.

| Düğme | İşlev |
| --- | --- |
| **Atıflı cümle üret** | Pasajdan tek cümle; cümle + pasaj + "Metne ekle" (12) |
| Metin içi atıf ekle | İmlece `(Yılmaz vd., 2023)` koyar |
| Kaynakçaya ekle | |
| Özeti göster | Pasajın tamamı |
| PDF aç | Açık erişim varsa |
| Not ekle | Bu kaynağa bağlı not |
| Benzer kaynak bul | Araştırmaya döner, benzer arama yapar |

### 7.2 Kanıt

İmlecin bulunduğu cümleye ait kanıt kartları.

| Öğe | İşlev |
| --- | --- |
| Destek sınıfı | `destekliyor` · `kısmi` · `ilgisiz` · `çelişiyor` · `kanıt yok` |
| Pasaj | Birebir alıntı; kararı veren kısım vurgulu |
| Kapsam farkı | "İddia genel, pasaj tek merkezli kohort" |
| Kaynak künyesi | Kod katmanından |
| **Bu cümleyi doğrula** | Cümleyi kanıta karşı kontrol eder |
| Hakem ne der | PR5 itirazı |
| Başka kanıt ara | Yeni pasaj arar |

**Kanıt yoksa:** sebebi ve ne yapılacağı yazılır (iddia çok genel, terim farklı,
konu çok yeni, literatürde gerçekten desteklenmiyor) — uydurma yapılmaz.

### 7.3 Anla

Öğrenme ve görselleştirme şablonları (11).

### 7.4 Analiz

Analiz paneli özeti ve son sonuçlar; "Tam panel" ile çekmece açılır (10).

### 7.5 Şablon

Aktif şablonun bölüm rehberi: bu bölümde ne anlatılır, hangi kaynak türü
uygun, hedef kelime sayısı, örnek cümle kalıpları (kaynaksız, yalnız yapı).

---

## 8. Şablonlar — "ne yazmak istiyorsun?"

Panel ilk açıldığında ya da "Yeni belge" denince şablon galerisi çıkar.
Seçince **bölüm ağacı kurulur**, her bölüme rehber notu düşülür.

| Şablon | Ana başlıklar |
| --- | --- |
| **Araştırma makalesi (IMRaD)** | Öz · Giriş · Yöntem · Bulgular · Tartışma · Sonuç · Kaynakça |
| **Yüksek lisans / doktora tezi (YÖK)** | Kapak · Onay · Öz · Abstract · İçindekiler · Tablo ve Şekil listesi · Kısaltmalar · Giriş · Kuramsal Çerçeve · İlgili Araştırmalar · Yöntem · Bulgular · Tartışma · Sonuç ve Öneriler · Kaynakça · Ekler · Özgeçmiş |
| **Derleme makalesi** | Giriş · Kapsam ve yöntem · Tematik bölümler · Tartışma · Sonuç |
| **Sistematik derleme (PRISMA)** | Giriş · Yöntem (arama, dahil/hariç ölçütleri, veri çıkarımı) · PRISMA akış şeması · Bulgular · Kalite değerlendirmesi · Tartışma · Sonuç |
| **Olgu sunumu (CARE)** | Giriş · Olgu · Tartışma · Sonuç |
| **Proje önerisi (TÜBİTAK 1001/2209)** | Özet · Özgün Değer · Amaç ve Hedefler · Yöntem · Proje Yönetimi ve İş-Zaman Çizelgesi · Yaygın Etki · Bütçe |
| **Konferans bildirisi** | Öz · Giriş · Yöntem · Bulgular · Sonuç (2 sütun) |
| **Seminer / dönem ödevi** | Giriş · Gelişme bölümleri · Sonuç · Kaynakça |
| **Bildiri özeti** | Amaç · Yöntem · Bulgular · Sonuç (kelime sınırlı) |
| **Boş belge** | Başlık yok |

**Şablonun taşıdıkları:** bölüm ağacı, her bölüm için rehber metni ve hedef
kelime sayısı, sayfa ayarları (kenar boşluğu, satır aralığı, yazı tipi), atıf
stili, başlık numaralandırma biçimi.

**Kurum şablonu:** üniversitenin tez yazım kılavuzu yüklenebilir (daha sonra);
ilk sürümde YÖK genel biçimi.

---

## 9. Kaynak hafızası ve taslak saklama

### 9.1 Sepet sınırı: 30 → 100

Bugün `BASKET_LIMIT = 30` (`server/models/Basket.js:7`). Öneri:

| Katman | Sınır | Ne için |
| --- | --- | --- |
| Sepet (çalışma kümesi) | **100** | Panelde görünen, atıf yapılabilen kaynaklar |
| Koleksiyon | Sınırsız | Konuya göre kayıtlı kümeler; sepete topluca alınır |
| Belgede kullanılan | Sınırsız | Atıfı olanlar; sepetten çıkarılsa da kaynakçada kalır |

**Neden sınırsız değil:** sepet tek bir veritabanı kaydı; büyüdükçe her
açılışta taşınan veri artar. 100 kaynak ≈ 400 kB, kabul edilebilir.
Üretim istekleri zaten sepetin tamamını değil, **seçilen kaynakları**
gönderir — token maliyeti sınırı buradan gelir, sepet boyutundan değil.

**Göç:** sınır artışı yalnız doğrulama kuralı değişikliği; veri göçü gerekmez.

### 9.2 Taslak saklama — üç katman

| Katman | Ne tutar | Ne zaman | Nerede |
| --- | --- | --- | --- |
| Anlık | Son yazılan, geri al yığını | Her tuş | Bellek |
| Yerel | Belge, ayarlar, panel durumu | 800 ms duraklamada | `localStorage` |
| Sunucu | Belge sürümleri | 30 sn'de bir ve bölüm değişiminde | MongoDB (yeni `Document` modeli) |

**Geçici alanlar da saklanır:** üretilen ama eklenmemiş cümleler, analiz
sonuçları, diyagram taslakları, notlar. Kullanıcı sekmeyi kapatıp dönünce
hepsi yerinde olur. "Geçici" olduğu arayüzde bellidir (kesik çerçeve).

**Sürüm geçmişi:** son 20 anlık görüntü; adlandırılabilir ("danışmana
gönderilen sürüm"). Geri yükleme yeni sürüm yaratır, eskisini silmez.

---

## 10. Analiz paneli — "SPSS gibi"

### 10.1 Konum ve açılış

Sol raydaki 📊 ya da sağ panel → Analiz → "Tam panel".
Ekranın altından **çekmece** olarak açılır (yarım ekran), tam ekrana
büyütülebilir. Belge arkada kalır: sonucu görürken metni görmek gerekir.

### 10.2 Veri girişi

| Yol | Not |
| --- | --- |
| Excel'den yapıştır | Pano verisi ızgaraya düşer |
| CSV / XLSX yükle | Tarayıcıda okunur |
| Elle ızgara | Satır/sütun ekle, değişken adlandır |
| Belgedeki tablodan al | Seçili tabloyu veri olarak kullanır |

**Değişken tanımı:** her sütun için ad, tür (sürekli, sıralı, kategorik),
ölçek, eksik değer işareti, etiketler. SPSS'teki "Variable View" karşılığı.

**Gizlilik:** veri tarayıcıdan çıkmaz. Hesap yerelde yapılır; sunucuya
gönderilmez. Bu bir satış argümanı ve arayüzde yazar.

### 10.3 Yöntemler

| Aile | Testler |
| --- | --- |
| Betimleyici | Ortalama, ortanca, mod, SS, varyans, çeyrekler, çarpıklık, basıklık, %95 GA, frekans tablosu |
| Normallik ve varsayım | Shapiro–Wilk, Kolmogorov–Smirnov, Levene, Box–M, Durbin–Watson, VIF, Q-Q grafiği |
| İki grup | Bağımsız örneklem t, eşleştirilmiş t, Welch t, Mann–Whitney U, Wilcoxon işaretli sıra |
| Çok grup | Tek yönlü ANOVA, Welch ANOVA, tekrarlı ölçüm ANOVA, iki yönlü ANOVA, ANCOVA, Kruskal–Wallis, Friedman |
| Post-hoc | Tukey HSD, Bonferroni, Games–Howell, Dunn |
| İlişki | Pearson, Spearman, Kendall tau, kısmi korelasyon |
| Kategorik | Ki-kare bağımsızlık, uyum iyiliği, Fisher kesin, McNemar, Cochran Q |
| Regresyon | Basit ve çoklu doğrusal, hiyerarşik, lojistik, ordinal |
| Güvenilirlik | Cronbach alfa, McDonald omega, madde-toplam korelasyonu, ICC |
| Faktör | Açımlayıcı faktör analizi, KMO, Bartlett küresellik |
| Etki büyüklüğü | Cohen's d, Hedges' g, eta kare, kısmi eta kare, Cramér V, odds oranı |
| Güç analizi | Örneklem büyüklüğü hesabı, gözlenen güç |
| Meta-analiz | Sabit/rastgele etki, orman grafiği, huni grafiği, I² |

### 10.4 Akış

1. **Veri** sekmesinde veri girilir, değişkenler tanımlanır.
2. **Yöntem** sekmesinde test seçilir. İki yol:
   - **Doğrudan seçim** (test adını biliyorsan)
   - **"Hangi testi kullanmalıyım?"** — karar ağacı: kaç grup, bağımlı mı,
     ölçek türü nedir. **Sonunda öneri değil, aday listesi ve gerekçesi
     verilir.** Kararı kullanıcı verir (`CLAUDE.md` 2.8: yanlış test önerisi
     yanlış atıftan daha zararlı).
3. **Varsayım kontrolü** otomatik çalışır ve sonuç ekranında ayrı kutuda
   gösterilir: "Shapiro–Wilk p = 0,032 → normallik sağlanmıyor; parametrik
   olmayan karşılığı Mann–Whitney U."
4. **Sonuç** üç biçimde:
   - **APA 7 cümlesi:** "İki grup arasında anlamlı fark bulunmuştur,
     *t*(48) = 2,41, *p* = ,020, *d* = 0,68."
   - **APA tablosu:** dergiye hazır
   - **Grafik:** kutu grafiği, saçılım, hata çubuğu, orman grafiği
5. **Ekle** düğmesi üç seçenek sunar: *cümleyi ekle*, *tabloyu ekle*,
   *grafiği ekle*. Hepsi **imlecin bulunduğu yere** girer. İmleç belgede
   değilse hedef bölüm sorulur.
6. **Yöntem bölümü metni:** "Bu analizi yöntem bölümünde nasıl anlatırım?"
   — kullanılan test, yazılım ve sürüm bilgisiyle kalıp metin üretir
   (uydurma sayı yok, yalnız yapılan işlemin tarifi).

### 10.5 Denetim izi

Her analiz kaydedilir: veri özeti (ham veri değil), test, parametreler,
sonuç, tarih. Belgedeki her tablo ve grafik bu kayda bağlıdır. Denetim izi
PDF'ine girer.

### 10.6 Teknik seçim

| Seçenek | Artı | Eksi | Karar |
| --- | --- | --- | --- |
| JS istatistik çekirdeği (`simple-statistics`, `jstat` + kendi kodumuz) | ~80 kB, anında, bağımlılık az | Karmaşık modeller (karma ANOVA, ordinal lojistik) elle yazılır | **Önerilen başlangıç** |
| Pyodide + `scipy`/`pingouin`/`statsmodels` | Tüm yöntemler hazır, Python ekosistemi | İlk yüklemede 10+ MB; mobilde ağır | Faz 2, isteğe bağlı yükleme |
| Sunucuda Python servisi | Hafif istemci | Kullanıcı verisi sunucuya gider — gizlilik argümanı kaybolur | **Hayır** |

**Önerilen:** JS çekirdeğiyle başla (betimleyici → t → ANOVA → korelasyon →
ki-kare → regresyon → güvenilirlik). Faktör analizi ve meta-analiz gibi ağır
yöntemler için Pyodide'i **yalnız istendiğinde** indir.

---

## 11. Anla sekmesi — napkin.ai benzeri öğrenme ve görselleştirme

Kullanıcı metni seçer (ya da bir bölümü tarar), panel **düzenlenebilir
şablonlar** önerir. Her şablonun her parçası bir kaynak cümlesine bağlıdır;
bağlanamayan parça gösterilmez.

| # | Şablon | Ne yapar | Düzenlenebilir |
| --- | --- | --- | --- |
| 1 | **Kendi cümlenle anlat** | Kullanıcı anladığını yazar, sistem pasajlara karşı doğrular | Metin |
| 2 | **Kavram haritası** | Kavramlar ve ilişkiler (neden, parçası, karşıt) | Düğüm ekle/sil, taşı, renk |
| 3 | **Akış şeması** | Süreç adımları (yöntem anlatımı için) | Adım metni, sıra, ok tipi |
| 4 | **Zaman çizelgesi** | Alandaki gelişmeler yıl yıl | Olay ekle, tarih |
| 5 | **Karşılaştırma matrisi** | Makaleler × boyutlar | Sütun ekle, hücre |
| 6 | **Hiyerarşi / taksonomi** | Üst-alt kavram ağacı | Düğüm |
| 7 | **Neden–sonuç (balık kılçığı)** | Etken grupları | Dal ve etken |
| 8 | **PRISMA akışı** | Tarama → eleme → dahil sayıları | Sayılar |
| 9 | **Tartışma haritası** | Kim kimi destekliyor, kim çelişiyor | Bağ tipi |
| 10 | **Hatırlama kartları** | Pasajdan soru–cevap; aralıklı tekrar planı | Soru metni |

**Ortak davranış:**
- Üç alternatif önerilir, kullanıcı seçer.
- Seçilen şablon **SVG** olarak çizilir; düğüm metni yerinde düzenlenir.
- "Belgeye ekle" ile şekil olarak girer, altyazısı ve numarası otomatik.
- "SVG indir" ve "PNG indir".
- Her düğümün üstüne gelince kaynağı görünür.

---

## 12. Atıflı cümle ve metin üretimi

### 12.1 Tek cümle (bugün çalışıyor)

Kaynaklar sekmesinde "Atıflı cümle üret" → modele yalnız pasaj gider → cümle
+ pasaj + atıf kartı → "Metne ekle".

### 12.2 Paragraf (sonraki adım)

**Kural:** paragraf, tek tek doğrulanmış cümlelerden kurulur. Model bir
paragrafı tek seferde yazmaz.

Akış: 2–5 kaynak seç → her biri için cümle üret → cümleler sırayla listelenir
→ kullanıcı sırayı değiştirir, istemediğini atar → "Paragraf olarak ekle".
Bağlaçlar (ancak, buna karşılık, benzer şekilde) kullanıcı tarafından seçilir
ya da kalıp listesinden eklenir; model bağlaç için ayrı çağrılmaz.

### 12.3 İddiadan kanıta (ana yön)

Kullanıcı kendi cümlesini yazar → "Doğrula" → sistem pasaj arar → destek
sınıfı ve pasaj gösterilir. **Ürünün asıl değeri burada**; üretim yan özellik.

---

## 13. Klavye kısayolları

| Kısayol | İşlev |
| --- | --- |
| `Ctrl+S` | Anlık görüntü al (adlandır) |
| `Ctrl+B/I/U` | Kalın, italik, altı çizili |
| `Ctrl+1/2/3` | Başlık 1/2/3 |
| `Ctrl+0` | Gövde metni |
| `Ctrl+K` | Metin içi atıf ekle |
| `Ctrl+Shift+D` | Seçili cümleyi doğrula |
| `Ctrl+Shift+A` | Analiz çekmecesi |
| `Ctrl+Shift+V` | Düz metin yapıştır |
| `Ctrl+F` / `Ctrl+H` | Bul / değiştir |
| `F11` | Odak kipi |
| `Esc` | Çekmeceyi kapat, sonra panelden çık |

---

## 14. Erişilebilirlik ve çok dillilik

- Her düğmenin `aria-label`'ı ve araç ipucu var; yalnız ikon olan düğme yok.
- Şerit klavyeyle gezilir (`Tab` gruplar arası, ok tuşları grup içinde).
- Renk tek başına anlam taşımaz: kanıt durumu renk **ve** simge ile gösterilir.
- Kontrast en az 4,5:1.
- Arayüz TR/EN; belge dili ayrı seçilir (arayüz Türkçe, metin İngilizce olabilir).
- Koyu tema: belge sayfası beyaz kalır, çevre koyulaşır.

---

## 15. Teknik kararlar

| Konu | Karar | Gerekçe |
| --- | --- | --- |
| Editör | **TipTap (ProseMirror)** | Cümleye `claim_id` çapası gömmek için özel düğüm gerekiyor; `contentEditable` bunu taşıyamaz. Yalnız açık lisanslı paketler |
| Diyagram | React Flow (düzenleme) + SVG (çıktı) | `docs/tools.md` |
| Atıf stilleri | CSL + `citeproc-js` | 10.000 stil hazır; elle yazılmaz |
| Dışa aktarma | `docx` (var), `pandoc` tarzı dönüşüm istemcide | Word ve PDF bugün çalışıyor |
| İstatistik | JS çekirdek, sonra isteğe bağlı Pyodide | 10.6 |
| Denklem | KaTeX | Hafif, LaTeX söz dizimi |
| Saklama | `localStorage` + yeni `Document` koleksiyonu | 9.2 |
| Tasarım dili | Mevcut CSS değişkenleri; Tailwind **eklenmez** | İki stil sistemi olmaz; mockup'ın paleti ve yoğunluğu alınır |

**Yeni bağımlılıklar (onay gerekir — `CLAUDE.md` kural 6):** TipTap paketleri,
React Flow, `citeproc-js`, KaTeX, istatistik kitaplığı. Her biri lisansıyla
birlikte iş emrinde sunulur.

---

## 16. Görsel kurgu önerileri

1. **Kenarlar dolu, orta temiz.** Araçlar kenarlarda; sayfa çevresinde hiçbir
   süs yok. Kullanıcı metne bakarken gözü dağılmamalı.
2. **Tek vurgu rengi.** Mockup'taki indigo (#4648d4) iyi seçim. Kanıt
   durumları dışında renk kullanılmaz; o dört renk (yeşil/sarı/gri/kırmızı)
   yalnız kanıt için ayrılır — başka yerde kullanılırsa anlamı aşınır.
3. **Yoğunluk.** Satır yüksekliği 30–32 px, ikon 16 px, şerit 2 satırı
   geçmez. SaaS'ta ferahlık değil, çok işi az yerde göstermek değerli.
4. **Kart yok, bölge var.** Ortada yüzen kart kullanılmaz; bölgeler kenarlarla
   ayrılır (bugün düzeltildi).
5. **Durum her zaman görünür.** Kayıt durumu, kaynaksız cümle sayısı ve atıf
   sayısı durum çubuğunda sabit durur; kullanıcı "ne durumdayım" sorusunu
   sormak zorunda kalmaz.
6. **Boş ekran öğretir.** Belge boşken sayfanın ortasında üç seçenek: şablon
   seç, kaynak ekle, metin yapıştır. Boş kutu bırakılmaz.
7. **Yükleniyor durumu dürüst.** Sahte aşama animasyonu yok; gerçekte ne
   yapıldığı yazılır ("3 kaynakta pasaj aranıyor").
8. **Geri alınabilirlik.** Her ekleme tek `Ctrl+Z` ile geri alınır; "emin
   misiniz" penceresi yerine geri alma.
9. **Mobil.** Telefonda yazım hedef değil; okuma ve kanıt kontrolü hedef.
   Şerit tek satıra iner, sayfa tam genişlik olur.

---

## 17. Aşamalı yol — önerilen iş emirleri

| No | İş | Bağımlılık | Değer |
| --- | --- | --- | --- |
| WO-003 | Çalışma alanı iskeleti (**kısmen yapıldı**) | — | Editör, sayfa ayarı, dışa aktarma |
| WO-004 | Tam ekran kip + dosya çubuğu + dönüş yolu | — | İstenen "yeni panel" hissi |
| WO-005 | Sol belge gezgini: bölüm ağacı + kaynaklar sekmesi | WO-004 | Uzun belgede gezinme |
| WO-006 | Şablon galerisi ve bölüm rehberi | WO-005 | "Ne yazmak istiyorsun" |
| WO-007 | Sepet 30 → 100, sunucu taslak saklama | — | Hafıza isteği |
| WO-008 | Gerçek cetvel (tutamaklar, sekme durakları) | WO-004 | Word hissi |
| WO-009 | TipTap'e geçiş + cümle çapaları | WO-005 | Kanıt bağının önkoşulu |
| WO-010 | Kanıt sekmesi: iddia → pasaj → destek sınıfı | WO-009 | **Ürünün çekirdeği** |
| WO-011 | Analiz paneli faz 1 (betimleyici, t, ANOVA, korelasyon, ki-kare) | WO-004 | SPSS isteği |
| WO-012 | Anla sekmesi faz 1 (kavram haritası, karşılaştırma matrisi) | WO-009 | napkin isteği |
| WO-013 | Atıf stilleri (CSL) + kaynakça denetimi | WO-009 | Benimsenme şartı |
| WO-014 | Denetim izi PDF'i | WO-010 | Kurumsal satış |

**Sıra gerekçesi:** WO-010 (kanıt) ürünün asıl farkı, ama WO-009 (çapalar)
olmadan yapılamaz. Analiz paneli (WO-011) bunlardan bağımsız ilerleyebilir,
yani iki kişi paralel çalışabilir.

---

## 18. Bugün ne var, ne yok

### Çalışanlar (2026-10-13, yerel dal `wo-002-yazar-paneli`)

| Özellik | Durum |
| --- | --- |
| AI Yazar düğmesi çalışma alanını açıyor | ✓ |
| Eski bölüm üreten panel kapalı (`AI_WRITER_PANEL_ENABLED=false`) | ✓ |
| Şerit: yazı tipi, punto, B/I/U/S, x²/x₂, renk, vurgu | ✓ |
| Stil (Gövde, Başlık 1–3, Alıntı), hizalama ×4, listeler, satır aralığı | ✓ |
| Tablo ekleme (3×3, başlık satırı) | ✓ |
| Sayfa ayarları: A4/Letter, dikey/yatay, kenar boşluğu | ✓ |
| Basit cetvel (cm çizgileri, kenar boşluğu gölgesi) | ✓ |
| Yakınlaştırma %50–150, durum çubuğu | ✓ |
| Word dışa aktarma (biçim, tablo, sayfa ayarları) | ✓ |
| Yazdır / PDF (seçilen kağıt boyutuyla) | ✓ |
| `localStorage` otomatik kayıt | ✓ |
| Sağ panel: Kaynaklar, Anla, Sayılar | ✓ |
| **Atıflı cümle üret** (pasaj → cümle → "Metne ekle") | ✓ |
| Kaynaksız cümle sayacı | ✓ |

### Henüz yok

Tam ekran kip · dosya çubuğu · sol belge gezgini · şablonlar · gerçek cetvel
tutamakları · cümle çapaları · kanıt sekmesi · analiz paneli · diyagramlar ·
CSL atıf stilleri · sunucu taslak saklama · sürüm geçmişi · denetim izi.

---

## 19. Açık sorular

1. **Sepet sınırı 100 yeterli mi?** Tez yazan biri 200+ kaynak kullanabilir.
   Koleksiyon katmanı bunu çözer mi, yoksa sınır daha mı yüksek olmalı?
2. **Analiz paneli ilk sürümde hangi testler?** Hepsi bir anda yazılmaz.
   Hedef kitlenin (nükleer mühendislik? sosyal bilimler?) en çok kullandığı
   beş test hangisi?
3. **Tez şablonu hangi üniversitenin kılavuzuna göre?**
4. **Belge sunucuda saklansın mı?** Saklanırsa gizlilik ve KVKK metni gerekir;
   saklanmazsa kullanıcı cihaz değiştirince belgesini kaybeder.
5. **Mockup'taki koyu sol ray mı, bugünkü açık tema mı?** İkisi karışmaz;
   biri seçilmeli.
6. **Çok yazarlı düzenleme** (danışman + öğrenci aynı anda) hedefte mi?
   Varsa editör seçimi buna göre değişir.
