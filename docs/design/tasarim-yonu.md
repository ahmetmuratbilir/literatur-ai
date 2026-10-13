# Literatür AI — Tasarım Yönü

Bu dosya arayüzün neden böyle olduğunu anlatır. Bir ekran tasarlanırken veya
bir bileşen yazılırken buraya bakılır. Kurala dönüşmüş maddeler `CLAUDE.md`
Bölüm 2 ve 3'te de yer alır; burada gerekçeleri var.

---

## 0. Bu dosya nasıl okunur

Belgedeki maddeler aynı ağırlıkta değil. Her birinin durumu şu etiketlerle
ayrılır:

| Etiket | Anlamı |
| --- | --- |
| **[KARAR]** | Verildi. Değiştirmek için gerekçe gerekir |
| **[VARSAYIM]** | Doğrulanmamış; doğru kabul edilip ilerleniyor |
| **[HİPOTEZ]** | Test edilecek. Bölüm 17'de ölçütü var |
| **[AÇIK]** | Karar verilmedi. Bölüm 18'de listeli |

Etiketsiz metin gerekçe ve bağlamdır, karar değil.

---

## 1. Kullanıcı kim

Üç kişi, üç farklı ihtiyaç. Üçünün ortak duygusu **kaygı**, verimlilik değil.

**[VARSAYIM]** Aşağıdaki üç kişi gerçek kullanıcı araştırmasından değil,
alan bilgisinden türetildi. Saat, alışkanlık ve davranış ayrıntıları tasarımı
somutlaştırmak içindir, bulgu değildir. İlk görüşmelerden sonra güncellenir.

### Elif — yüksek lisans, 27

İlk kez 80 sayfalık bir şey yazıyor. Zotero'yu yarım kurmuş, masasında 40 PDF
açık ve hangisini okuduğunu karıştırıyor. Gece 23:00–03:00 arası yazıyor.

En büyük korkusu hız değil: **danışmanın "bunu nereden aldın?" demesi.**
Savunmada bir iddiayı savunamamak.

### Murat — doktora / genç akademisyen, 34

Makaleyi dergiye gönderecek. Alanını zaten biliyor, kaynak bulmaya ihtiyacı
az. İhtiyacı, yazdığının hakem karşısında ayakta kalması. Zihninde sürekli
"reviewer 2 buna ne der" var.

### Prof. Ayşe — danışman, 50

Haftada altı tez okuyor. Her iddiayı kontrol edecek vakti yok, ama kontrol
etmediği bir şey savunmada patlarsa sorumlu o.

### Bunun tasarıma yansıması

Rakipler "daha hızlı yaz" diyor. Biz "savunabileceğin şeyi yaz" diyoruz. Bu
sadece farklı bir slogan değil, farklı bir arayüz demek.

Somut örnek — aynı veri, iki farklı çerçeve:

| Nötr istatistik | Kullanıcının zihnindeki cümle |
| --- | --- |
| 47 cümle · 7 kanıt bekliyor | **Savunmada sorulabilecek 7 cümle** · 31'inde destekleyici pasaj |

İkincisi tıklanmak ister. Birincisi bir sayaç.

---

## 2. Tasarım ilkeleri

Bir karar çıkmaza girdiğinde bu altı maddeye bakılır.

1. **Renk kanıt içindir, arayüz için değil.** Arayüz nötr gri, tek vurgu
   rengi. Doygun renk yalnızca kanıt durumunu taşır.
2. **Mod yoktur.** Araştırma ve yazma ayrı etkinlik değil. İnsan yazdığı için
   arar.
3. **En değerli an revizyondur.** Üç ay sonra "bu kaynak doğru mu?"
   sorulduğunda ürün karşılığını verir. Tasarım o anı hedefler.
4. **Boş durum en çok görülen durumdur.** Kullanıcı zamanının çoğunda boş bir
   bölüme bakar. Orası en çok tasarım isteyen yer.
5. **Belgeye hiçbir şey kendiliğinden girmez.** Metin ekleme, silme ve
   değiştirme yalnızca kullanıcı tıklamasıyla olur (`CLAUDE.md` 2.9).
   Sınıflandırma, kayıt ve panel güncellemesi otomatiktir — ilke otomasyona
   değil, **kullanıcının metni üzerindeki kontrolüne** dairdir.
6. **Word'le biçimlendirmede yarışılmaz.** Word 40 yıldır bu işi yapıyor.
   Ayrışma kanıtta, biçimlendirmede değil.

---

## 3. Yerleşim

```
┌────┬──────────────┬─────────────────────────┬──────────────────┐
│    │              │                         │                  │
│ 56 │   Gezgin     │       Belge             │   Bağlam paneli  │
│ px │   260 px     │       esnek             │      360 px      │
│    │              │                         │                  │
│ray │  bölüm ağacı │   ┌─────────────────┐   │  imlecin         │
│    │  kaynaklar   │   │                 │   │  bulunduğu       │
│    │  notlar      │   │   68ch metin    │   │  cümlenin        │
│    │  şekiller    │   │                 │   │  kanıtı          │
│    │              │   └─────────────────┘   │                  │
│    │              │                         │                  │
└────┴──────────────┴─────────────────────────┴──────────────────┘
```

### Mod düğmesi yok

"Yazar moduna basınca" cümlesi sorunun kendisi. Ayrım kodun yapısından
geliyor, kullanıcının zihninden değil.

Belge hep orada. **Sağ panel içerik değiştirir, ekran değişmez:**

| Durum | Sağ panelde ne var |
| --- | --- |
| İmleç kanıta bağlı cümlede | O cümlenin kanıt kartı |
| İmleç kanıt bekleyen cümlede | "Bu cümle için kanıt ara" + iddia türü tahmini |
| İmleç boşlukta | Bulunulan bölümün kanıt özeti |
| Kullanıcı arama yazdı | Arama sonuçları |
| Kanıt aranıyor | Yükleniyor, iptal edilebilir |
| Kanıt bulunamadı | Sebep + alternatif sorgu önerisi (P8) |

Altı durum. Mockup bunlardan yalnızca birini tasarlamıştı, o da yanlış olanı.

### Bağlam kaybolmaz

Panel imlece göre değişiyorsa kullanıcı neye baktığını kaybedebilir. "Mod yok"
demek, panel durumunun görünmez olması demek değil.

İki kural:

1. **Her panel içeriğinin üstünde bağlam etiketi var:**
   `2.3 · "Isıl dolaşım dinamikleri…" için kanıt`
   Tıklanınca belgede o cümleye gider ve vurgular.

2. **Süren arama sabitlenir.** Bir cümle için arama başlattıktan sonra imleç
   başka yere giderse arama iptal olmaz; panel üstünde sabit kalır:

   > 📌 2.3'teki cümle için aranıyor…  [bırak]

   Sonuç geldiğinde bildirim düşer, kullanıcı dilediğinde döner. İmleç
   hareketi bir isteği öldürmez.

   **Yeni arama başlatılırsa:** sabitlenen arama panelin üstünde küçük bir
   şeride iner, en fazla üç tane birikir, dördüncüsü en eskiyi düşürür.
   Panelde yığılma olmaz, ama kullanıcı aramasını da kaybetmez.

Mod düğmesi kalkınca "araştırmaya dönüş" için ayrı düğme, Esc kısayolu ve
durum saklama mekanizması da gereksizleşir. Üç mekanizma siliniyor.

### Panel genişlikleri

- **Sol ray 56 px** — ikon + dokunma alanı; daralmaz
- **Gezgin 260 px** — Türkçe bölüm başlıkları uzun, 240 dar kalıyor; katlanabilir
- **Belge esnek** — ama metin bloğu 68ch'te sabit, sayfada ortalı
- **Bağlam paneli 360 px** — pasaj okunacak, 340 dar; katlanabilir, genişlik sürüklenebilir

1280 px altında bağlam paneli üstü örten katman olur. 1024 px altında gezgin
de katlanır.

---

## 4. Kanıt paneli

Ürünün kendisi bu. Diğer her şey bunun etrafında.

### Önce dil: "kanıt" ne iddia ediyor

Üç ayrı şey var ve ürün bunları karıştırmaz:

| Kavram | Ürün ne diyebilir |
| --- | --- |
| **Pasaj ilişkisi** | "Bu pasaj iddiayı destekliyor / kısmen destekliyor / çelişiyor" — ürünün söyleyebileceği tek şey |
| **Kaynak kaydı** | Yayın yılı, tür, geri çekilme kaydı — doğrulanabilir metadata |
| **Bilimsel geçerlilik** | **Ürün bunu söyleyemez.** Çalışmanın yöntemi sağlam mı, bulgu tekrarlanabilir mi, alan genelinde doğru mu |

Yeşil bir rozet gören kullanıcı kolayca "bu iddia doğrulandı" diye okur.
Oysa söylenebilecek olan yalnızca "bulduğum pasaj bu iddiayı belirli bir
kapsamda destekliyor".

**Dil kuralı:** rozet "KANITLI" değil **"PASAJ DESTEKLİYOR"** der. Özet
satırında da "18 kanıtlı" değil "18 cümlede destekleyici pasaj var". Fark tek
kelime ama iddia tamamen farklı — ve rozetlere uyguladığımız ihtiyatın kararın
kendisine de uygulanması gerekiyor.

```
┌────────────────────────────────────────┐
│ ◐  PASAJ KISMEN DESTEKLİYOR            │ ← 3px durum şeridi + rozet
├────────────────────────────────────────┤
│                                        │
│  "Natural circulation efficiency       │
│   decreased by 12% under low-pressure  │
│   transients, consistent with density  │ ← karar veren kısım
│   wave oscillation predictions."       │   arka plan vurgulu
│                                        │
│  Results bölümü · s. 847               │
│                                        │
├────────────────────────────────────────┤
│  KAPSAM FARKI                          │
│  Pasaj tek merkezli bir simülasyonu    │
│  kapsıyor; iddian genel.               │
├────────────────────────────────────────┤
│  Chen, L. & Wang, H. (2021)            │
│  Nuclear Engineering and Design        │
│  araştırma makalesi · 2021             │
│  geri çekilme kaydı bulunamadı         │
│  DOAJ'da listeli                       │
├────────────────────────────────────────┤
│  ⚠  Hakem ne der?                   ▾  │
├────────────────────────────────────────┤
│  [ Atıf ekle ]  [ Alıntıla ]  [ Başka ]│
└────────────────────────────────────────┘
```

### "Metne ekle" diye bir düğme yok

Tek bir "Metne ekle" düğmesi tehlikeli çünkü ne yaptığı belirsiz: pasajı
olduğu gibi mi yapıştırıyor, atıf mı ekliyor, cümle mi üretiyor?

Pasajı belgeye düz metin olarak yapıştırmak, kaynağın cümlesini öğrencinin
kendi yazısıymış gibi gösterir. Akademik bütünlük üzerine kurulu bir üründe
bu kabul edilemez bir hata olur.

Üç ayrı eylem, üçü de ne yaptığını adıyla söyler:

| Eylem | Ne yapar |
| --- | --- |
| **Atıf ekle** | Mevcut cümlenin sonuna atıf işareti koyar, `Claim` kaydını kaynağa bağlar. Metin değişmez |
| **Alıntıla** | Pasajı tırnak içinde, sayfa numarasıyla, blok alıntı biçiminde ekler. Kaynağın sözü olduğu görsel olarak belli |
| **Başka kanıt** | Aynı iddia için yeni arama |

Pasaj hiçbir koşulda tırnaksız ve atıfsız belgeye girmez.

### Neden bu sıra

1. **Karar önce.** Kullanıcı ilk bunu arıyor.
2. **Pasaj ikinci.** Kararın gerekçesi. Birebir, hiçbir model çağrısından
   geçmemiş (`CLAUDE.md` 3.2).
3. **Kapsam farkı üçüncü.** `partial` kararının somut sebebi. Bu alan
   olmadan `partial` anlamsız bir rozet olur.

   **Serbest metin yetmez, tür de gerekir.** "Kısmen destekliyor" dendiğinde
   kullanıcı farkın ne olduğunu hızlıca görmeli. P3 çıktısı bir alt tür
   döndürür:

   | Alt tür | Örnek |
   | --- | --- |
   | Popülasyon | Pasaj tek bir hasta grubunu, iddia genel popülasyonu kapsıyor |
   | Genellenebilirlik | Tek merkezli çalışma, iddia alan geneli |
   | Nedensellik | Pasaj ilişki kuruyor, iddia neden-sonuç |
   | Zaman / koşul | Pasaj belirli bir rejimi, iddia her koşulu kapsıyor |
   | Ölçüm | Farklı ölçek veya tanım kullanılmış |
   | Yöntem sınırlılığı | Örneklem küçük, simülasyon doğrulanmamış |
   | İddia pasajdan güçlü | Pasaj "işaret ediyor", iddia "kanıtlamıştır" diyor |

   Rozetin yanında etiket olarak görünür: **◐ Kısmen — popülasyon farkı**.
   Hem taranabilir hem de "başka kanıt ara" sorgusunu daraltmak için
   kullanılabilir.
4. **Kaynak künyesi dördüncü.** Kim söylemiş, güvenilir mi.
5. **Hakem itirazı kapalı.** İsteyen açar; varsayılan açık olursa gürültü.
6. **Eylem en altta.** Okuduktan sonra karar verilir.

### Pasaj içindeki vurgu

`quoted_span` alanı (P3 çıktısı) pasajın içinde arka plan rengiyle
işaretlenir — altı çizili değil, arka plan. **Hedef:** kullanıcının pasajı
doğrulama süresini belirgin biçimde kısaltmak. _Bu bir hipotez; Bölüm 17'deki
görev testiyle ölçülecek._ Bu alan boşsa pasaj düz gösterilir, uydurma vurgu
yapılmaz.

### Kaynak sağlığı rozetleri — kalite puanı değil, kayıt bilgisi

**Rozetler bir makalenin doğruluğunu göstermez.** Yalnızca hangi kayıtta ne
yazdığını gösterir. Bu ayrım korunmazsa rozet, olmadığı bir şeyi iddia eder.

| Alan | Ne söyler | Ne söylemez |
| --- | --- | --- |
| Dergi dizini | "DOAJ'da listeli" veya "DOAJ'da değil" | Makalenin iyi veya kötü olduğunu. DOAJ açık erişim dizinidir; abonelikli birçok güçlü dergi orada yoktur |
| Geri çekilme | "Geri çekilme kaydı bulunamadı" / "**Geri çekilmiş**" + tarih ve sebep | Kaydın bulunamaması geri çekilme olmadığını kanıtlamaz |
| Yayın yılı | Yıl, düz bilgi | Eski kaynağın kötü olduğunu. 1970 tarihli bir temel çalışma hâlâ doğru kaynaktır |
| Kaynak türü | Araştırma makalesi / derleme / bildiri / preprint | — |
| Kontrol tarihi | Bu bilgilerin ne zaman çekildiği | — |

**Dil kuralı:** "✓ geri çekilme yok" yazılmaz, "geri çekilme kaydı bulunamadı"
yazılır. Birincisi yapamayacağımız bir olumlama, ikincisi yaptığımız işin
tarifi. Aynı mantık `CLAUDE.md` 2.8'de zaten var — rozetlere de uygulanır.

Yalnızca **geri çekilme** ve **endişe beyanı** kırmızıdır ve kaynağı
kullanılamaz yapar. Diğerleri nötr bilgidir, yeşil onay işareti taşımaz.

Geri çekilme bilgisi asla önbellekten gelmez (`CLAUDE.md` 3.4).

### Aynı kaynak, farklı pasajlar

Bir makalenin Bulgular bölümü iddiayı desteklerken Tartışma bölümü aynı bulguyu
sınırlandırabilir. Tek kaynak = tek karar varsayımı yanlış.

Kanıt kartı aynı kaynaktan birden fazla pasaj taşıyabilir:

```
Chen & Wang (2021)
├ ● Results, s. 847        destekliyor
└ ◐ Discussion, s. 851     kısmen — "ölçeklendirme sınırlı"
```

İki pasaj farklı sınıf aldıysa **cümlenin durumu daha zayıf olandır.**
Destekleyen pasajı gösterip sınırlandıran pasajı gizlemek, kaynağı yanlış
temsil etmektir.

### Farklı kaynaklar çeliştiğinde

Aynı sorun kaynaklar arasında da var: bir makale destekler, başka biri
çürütür. Tek bir rozet göstermek literatürdeki anlaşmazlığı gizler.

Birden fazla kaynak bağlıysa kart üstünde dağılım görünür:

> **2 kaynak destekliyor · 1 kısmen · 1 çelişiyor**
> _kaynak sayısıdır; ağırlık veya kalite puanı değil_

İkinci satır arayüzde durur, yalnızca bu dokümanda değil. Çıplak sayılar
kullanıcıda çoğunluk oyu hissi yaratır; uyarı sayının yanında olmalı.

**Bu bir oylama değildir ve asla tek karara indirgenmez.** Üç destekleyen
makale bir çürüteni geçersiz kılmaz — çürüten çalışma daha iyi tasarlanmış
olabilir. Ürün sayıları gösterir, tartar gibi yapmaz.

Çelişki varsa kullanıcı yalnızca uyarılmaz; hangi kaynakların neden ayrıştığı
(kapsam farkı alt türleriyle) yan yana konur. Akademik yazımda çelişkiyi
göstermek bir kusur değil, zaten yapılması gereken şeydir.

---

## 5. Belge yüzeyi

### Durum çubuğu — her cümlede değil, her iddiada

Her cümlenin solunda 3 px dikey çubuk — **ama yalnızca doğrulanabilir
iddialarda.**

Her cümle bilimsel bir iddia değil. Başlıklar, geçiş cümleleri ("Bu bölümde
önce X ele alınmaktadır"), yazarın kendi yöntemini anlatan cümleler ve kendi
bulgularını bildiren cümleler kaynak gerektirmez. Hepsini gri işaretlemek
sayfayı yanlış bir kaygıyla doldurur.

Dört durum:

| Durum | İşaret | Anlamı |
| --- | --- | --- |
| Kanıtlı | ● sınıf rengi | İddia, kanıta bağlı |
| Kısmi | ◐ amber | Kanıt var ama kapsam farkı var |
| **Kaynak bekliyor** | ○ gri | **İddia, kanıt yok** — asıl dikkat çekmesi gereken |
| İddia değil | işaret yok | Kaynak gerekmiyor |
| İşleniyor | soluk, hareketsiz | Henüz değerlendirilmedi |

- Normalde `opacity: 0.55`, imleç o cümledeyken `1`
- Üzerine gelince: sınıf adı + kaynak

### Sınıflandırıcı yanılır, kullanıcı düzeltir

"Bu bir iddia mı" kararını bir sınıflandırıcı verecek ve hata yapacak. En
tehlikeli hata, gerçekte iddia olan bir cümleyi "iddia değil" sayması —
kullanıcı o cümlenin kanıtsız olduğunu hiç fark etmez. Bu doğrudan
`CLAUDE.md` 2.8 ihlalidir: eksik sessizce gizlenmez.

İki önlem:

1. **Sağ tık ile geçersiz kılma.** "Bu bir iddia" / "Bu iddia değil". Kullanıcı
   kararı sınıflandırıcıyı ezer ve kalıcıdır.
2. **Özet satırı iddia olmayanları da sayar.** Gizlenen hiçbir şey yok:

> **2. Literatür Taraması** — 30 cümle, 23'ü doğrulanabilir iddia
> 18'inde destekleyici pasaj · 3'ünde kapsam farkı · **2'si kanıt bekliyor** · 7 iddia değil ↗

Son sayı tıklanabilir; tıklanınca o cümleler vurgulanır ve kullanıcı
sınıflandırıcının kararını denetleyebilir. Yanında kısa gerekçe de görünür —
"bölüm geçişi", "kendi yöntemini anlatıyor". Birden fazlası seçilip toplu
olarak "iddia" işaretlenebilir.

### Sayımın nesnesi: cümle

"18 kanıtlı" belirsiz — 18 ne? Tanım net olmalı ve **MVP'de birim cümledir.**

| Yazılan | Anlamı |
| --- | --- |
| 30 cümle | Bölümdeki toplam cümle |
| 23 doğrulanabilir iddia | Kaynak gerektirdiği değerlendirilenler |
| 18'inde destekleyici pasaj | En az bir `supports` pasajı olan cümle sayısı |
| 2 kanıt bekliyor | İddia, hiç pasaj bağlı değil |

**Ürün varsayımı:** bir cümle = bir iddia. Gerçekte bir cümlede iki bağımsız
iddia olabilir ("X artar ve Y azalır"). MVP bunu tek birim sayar; kullanıcı
isterse cümleyi böler. Bu bilinçli bir sadeleştirme, ileride veri modelini
etkiler — `Claim` kaydı bugünden cümleye değil bir metin aralığına bağlanmalı
ki sonradan bölünebilsin.

Belge başında da aynı özet. Danışmana gösterilecek sayı bu.

### Metin ölçüleri

| Özellik | Değer | Gerekçe |
| --- | --- | --- |
| Satır uzunluğu | **68ch** | Mockup'ta ~95 karakter vardı; uzun akademik metinde göz yoruluyor ve satır atlanıyor |
| Gövde puntosu | **17px** | Mockup'ta 15px; saatlerce okunacak metin için küçük |
| Satır yüksekliği | **1.65** | 1.5 akademik metinde sıkışık |
| Paragraf arası | 0 (girinti 1.25em) | Akademik gelenek; boşluk değil girinti |

Sayfa 820 px kalır (A4 oranı için), metin bloğu 68ch'te ortalanır. Artan
boşluk zaten gerçek kenar boşluğudur.

### İki görünüm: taslak ve teslim

Mockup'ın sayfası Plus Jakarta Sans ile render ediliyordu. Ama tez Times New
Roman 12pt teslim edilecek — yani önizleme yalan söylüyordu.

| Görünüm | Font | Punto | Ne için |
| --- | --- | --- | --- |
| **Taslak** (varsayılan) | Ekran için serif | 17px / 1.65 | Yazarken rahat okuma |
| **Teslim önizleme** | Gerçek teslim fontu | Gerçek punto, gerçek sayfa | Göndermeden önce kontrol |

Geçiş tek düğme.

**[KARAR] Vaat sınırlı tutulur.** Tarayıcıdaki önizleme Word çıktısıyla birebir
aynı olmaz — Word sürümü, işletim sistemi, yüklü fontlar ve sayfa ayarları
sonucu değiştirir. Arayüzde "gördüğün şeyi teslim edeceksin" denmez,
**"teslim biçimine yakın önizleme"** denir ve sayfalamanın yaklaşık olduğu
görünür bir yerde yazar.

### Atıf gösterimi

Metin içinde `(Chen & Wang, 2021)` — **renkli değil, ince alt çizgili.**
Renk kanıt durumuna ayrılmış durumda, atıf rengi onunla çarpışır.

Tıklanınca kanıt paneli o kaynağa odaklanır.

---

## 6. Renk sistemi

### Temel karar: tersine çevir

Mockup'ta arayüz renkli, kanıt renksizdi. Bunun tersi olmalı.

`#4648d4` şu anda yedi iş yapıyor: aktif sekme, başlık, atıf, buton, AI
önerisi, seçili satır, ilerleme çubuğu. Kanıt sınıfları gelince çarpışacak ve
kullanıcı hangi rengin ne demek olduğunu çözemeyecek.

**Arayüz:** gri skala + tek indigo vurgu, yalnızca birincil eylemde.
**Kanıt:** dört doygun renk, başka hiçbir yerde kullanılmaz.

### Kanıt sınıfı renkleri

| Sınıf | Şekil | Renk | Not |
| --- | --- | --- | --- |
| `supports` | ● dolu daire | `#0f7b4f` | Yeşil |
| `partial` | ◐ yarım daire | `#b45309` | Amber |
| `irrelevant` | ○ boş daire | `#767586` | Nötr gri |
| `contradicts` | ▲ üçgen | `#ba1a1a` | Kırmızı |
| `no_evidence` | ◌ noktalı | — | Renk yok, kesikli çerçeve |

**Şekil zorunlu.** Kırmızı-yeşil renk körlüğü erkeklerin ~%8'inde var ve
`supports` ile `contradicts` tam o iki renk. Renk tek başına hiçbir yerde
anlam taşımaz — şekil + renk + metin etiketi birlikte çalışır.

`contradicts` için üçgen seçilmesi bilinçli: diğer dördü daire ailesinden,
çelişki şekliyle de ayrışıyor.

### Kontrast

Metin kontrastı mevcut haliyle doğru (`#191c1e` / `#f8f9fb` ≈ 16:1).
**Düşürülmeyecek.** Uzun okuma yapan bir kitlede metni griye çekmek
erişilebilirliği bozar.

---

## 7. Tipografi

### Arayüz — Plus Jakarta Sans

| Rol | Boyut / satır | Ağırlık |
| --- | --- | --- |
| Etiket küçük | 12 / 16 | 600 |
| Etiket | 13 / 18 | 500 |
| Gövde | 14 / 20 | 400 |
| Panel başlığı | 15 / 20 | 600 |

### Belge — serif

Taslak görünümünde ekran için tasarlanmış bir serif. Teslim görünümünde
kullanıcının seçtiği teslim fontu.

Space Grotesk kalkar. Mockup'ta başlık fontu olarak var ama akademik bir
belgede yeri yok — teknoloji ürünü fontu, tez fontu değil.

### Ağırlık uyarısı

Mockup'ta 650, 750, 850 gibi ara ağırlıklar kullanılmış ama Google Fonts'tan
yalnızca tam ağırlıklar isteniyor. Ara değerler sessizce çalışmıyor. Ya
değişken font aralığı (`wght@400..800`) istenir ya ara değerler kaldırılır.

---

## 8. Boş durumlar

Kullanıcı zamanının çoğunda boş bir bölüme bakıyor. Ürünlerin çoğu burada
çöker.

### Boş bölüm

```
2. Literatür Taraması


   Literatür taraması ne yapar
   Alandaki mevcut bilgiyi özetler ve senin çalışmanın
   doldurduğu boşluğu gösterir.

   Genellikle şu sırayla ilerler:
   geniş çerçeve → daralan odak → çelişen bulgular → boşluk

   ─────────────────────────────────────────────

   Koleksiyonunda bu bölüme uygun 14 kaynak var    →
   Hiç kullanmadığın 6 kaynak                      →

   ─────────────────────────────────────────────

   Bir iddia yaz, kanıtını bulayım.
```

Boş sayfa korkusunu kaldıran şey şablon değil, **bir sonraki hamlenin ne
olduğunu söylemek.**

### Kanıt bulunamadı

P8 çıktısı doğrudan panele basılır: sebep (çok genel / çok yeni / normatif /
terminoloji), daraltılmış iddia önerisi, alternatif sorgular.

"Kaynak bulunamadı" tek başına asla gösterilmez. Kullanıcıya yalnızca sonuç
değil, aramanın neden başarısız olabileceği ve sonraki adım gösterilir.

_Rakiplerin bu durumu nasıl ele aldığı incelenmedi; "kimse yapmıyor" iddiası
doğrulanana kadar yazılmaz._

### İlk açılış

Hiç belgesi olmayan kullanıcı şablon seçmeye zorlanmaz. Boş belge + "bölüm
ekle" yeter. Şablon isteyen üstteki bağlantıdan ulaşır.

---

## 9. Danışman görünümü

**Kimsede olmayan özellik ve en güçlü yayılma kanalı.**

Öğrenci bağlantı üretir, hocaya gönderir. Hoca hesap açmadan açar:

- Metin normal okunur, cümle durum çubukları görünür
- Bir cümleye tıklayınca kanıt açılır — pasaj, sınıf, kaynak
- Üstte özet: 31'inde destekleyici pasaj · 9 kısmi · 7 kanıt bekliyor
- Hoca cümleye yorum bırakabilir, öğrenciye düşer
- Düzenleme yok, salt okunur

### Neden bu kadar önemli

Üç işi birden yapıyor:

1. Hocanın kontrol yükünü düşürüyor — her iddiayı tek tek aramak yerine
   tıklıyor
2. Öğrencinin kaygısını düşürüyor — "hazırım" hissi
3. **Her paylaşım ürünü bir akademisyenin önüne koyuyor**

Fuar demosunun son adımı da bu olmalı.

### Paylaşım güvenliği — açık karar değil, gereksinim

Tez taslağı hassas bir belge. "Hocanın hesap açmadan erişmesi" sürtünmeyi
azaltıyor, ama karşılığında bağlantının kimde olduğu üzerindeki kontrol daha
kritik hale geliyor. Varsayılanlar:

- **Süreli.** 30 gün, uzatılabilir
- **İptal edilebilir.** Öğrenci istediği an kapatır, bağlantı ölür
- **Tahmin edilemez anahtar.** Sıralı ID değil
- **İndekslenmez.** `noindex`, arama motorlarına kapalı
- **Kim açtı görünür.** Öğrenci bağlantının kaç kez ve ne zaman açıldığını görür
- **Yorumlar kim ve ne zaman bilgisiyle kaydedilir**
- Bağlantı açıldığında hangi belgenin paylaşıldığı başta net yazar

Bağlantı iptal edilince yorumlar silinmez, öğrencide kalır — hoca yazdığını
geri alamaz, öğrenci de kaybetmez.

### Telefonda birinci sınıf olmalı

Yazma masaüstü işidir, sorun değil. Ama **inceleme telefonda olur.** Hoca
metroda açar. Danışman görünümü mobil öncelikli tasarlanır: tek sütun, cümleye
dokununca kanıt alttan açılır.

---

## 10. Okuma notu katmanı

Eksik olan en büyük parça. Öğrenci haftalarca PDF okuyup not alıyor ve üründe
bunun karşılığı yok.

Her kaynak kartında bir not alanı, ve **not iddiaya terfi edebiliyor:**

```
Chen et al. (2021)                    [PDF aç]
───────────────────────────────────────────────
NOTLARIM

"düşük basınçta %12 düşüş var,
 ama tek simülasyon"                  [→ iddia yap]

"metodoloji zayıf, ölçeklendirme
 tartışmalı"                          [→ iddia yap]

                                      [+ not ekle]
```

"İddia yap" dendiğinde not, kaynağı zaten bağlı bir cümle taslağına dönüşür ve
kanıt doğrulamasına girer.

Okumadan yazmaya köprü bu — ve kimse kurmuyor.

### İki aşamada yapılır

Notun pasaja bağlı olması daha değerli ama PDF üzerinde işaretleme katmanı
gerektiriyor; bu ayrı ve büyük bir iş.

| Aşama | Not nereye bağlı | Maliyet |
| --- | --- | --- |
| v1 | Kaynağa | Düşük — metin alanı + liste |
| v2 | Kaynak içindeki pasaja | Yüksek — PDF görüntüleyici + işaretleme katmanı |

v1 ile başlanır. v2'de not, "iddia yap" dendiğinde kanıtını yanında getirir —
retrieval adımı tamamen atlanır, çünkü kullanıcı pasajı zaten kendi seçmiştir.
Bu hem ucuz hem de en güvenilir kanıt bağı.

### Not kanıt değildir

Kullanıcının notu ("bu makalede %12 düşüş var") kaynaktan alınmış pasaj değil.
Yanlış hatırlanmış, eksik veya yorum katılmış olabilir.

**v1'de "iddia yap" kanıt bağı kurmaz.** Üretilen cümle `kaynak bekliyor`
durumunda başlar, kaynak aday olarak işaretlenir ve normal doğrulama akışına
girer. Kullanıcı notunu yazdı diye sistem "kanıtlı" demez.

Arayüzde iki şey görsel olarak ayrı durur: *senin notun* ve *kaynaktan alınan
pasaj*. Birleştirilmez, aynı kutuya konmaz. v2'de pasaj işaretleme geldiğinde
bu ayrım zaten doğal olarak kurulur.

---

## 11. Oturum hafızası

Üç gün sonra dönen kullanıcıya "hoş geldin" demek değersiz. Şu değerli:

> Son oturumda **2.3 Isıl Dolaşım**'ı yazıyordun.
> 4 cümle kanıt bekliyor · 2 kaynak hiç kullanılmadı
>
> [ Kaldığım yere dön ]

Gece 02:00'de dönen birine lazım olan tam bu.

### Kayıp korkusu — üç ayrı durum, üç ayrı gösterim

"Kaydedildi" tek kelime değil. Yerel kayıt, sunucuya kaydedildiği anlamına
gelmez ve bu ikisinin karıştırılması bu kitlenin en büyük travması.

| Durum | Gösterim | Anlamı |
| --- | --- | --- |
| Kaydedilmedi | ○ "**kaydedilmedi**" | Değişiklik henüz hiçbir yere gitmedi |
| Bu cihazda | ◐ "bu cihaza kaydedildi" | `localStorage`'da; cihaz değişirse kaybolur |
| Sunucuda | ● "buluta kaydedildi · 14:32" | Her yerden erişilebilir |

Çevrimdışıyken ayrıca açık uyarı:

> ⚠ Çevrimdışısın — değişiklikler yalnızca bu cihazda tutuluyor

### Sürüm geçmişi

Otomatik kayıt tek başına yetmez; kullanıcı yanlışlıkla sildiğinde geri
dönebilmeli. Her sunucu kaydı bir sürüm oluşturur, son 30 gün saklanır,
listeden önizlenip geri yüklenebilir.

Bir cümle silindiğinde kanıt bağı da gider. Geri yükleme kanıtı da geri
getirmeli — `Claim` kaydı silinmez, `deleted_at` ile işaretlenir
(`CLAUDE.md` 3.6 ile tutarlı).

### Çakışma: aynı belge iki cihazda

Eşzamanlı ortak düzenleme ilk sürümde yok, ama **aynı kullanıcının iki
cihazı** çakışabilir: evde yazdı, kaydedemedi, ofiste açtı.

**Sessizce üzerine yazmak kabul edilemez.** Çakışma görüldüğünde:

> Bu belge başka bir cihazda da düzenlenmiş.
> Bu cihazdaki sürüm: 14:32 · Sunucudaki: 16:05
> [ İkisini karşılaştır ]   [ Sunucudakini al ]   [ Bunu koru ]

Hiçbir seçenek varsayılan değil, kullanıcı seçer. Seçilmeyen sürüm sürüm
geçmişinde durur, kaybolmaz.

---

## 12. Hareket

Mockup'ta yüzen AI araç çubuğunda `animate-bounce` var. Odaklanma gerektiren
bir yazım aracında bu kabul edilemez.

- Panel geçişleri: 150 ms, `ease-out`
- Kanıt kartı belirmesi: 120 ms fade, konum değişmez
- Hiçbir şey zıplamaz, titremez, dikkat çekmeye çalışmaz
- `prefers-reduced-motion` desteklenir

Yazarken ekranda hareket eden tek şey imleç olmalı.

---

## 13. Yapılmayacaklar

Bunların her biri mockup'ta vardı veya rakiplerde var. Hiçbiri yapılmayacak.

| Yapılmayacak | Neden |
| --- | --- |
| **Güven yüzdesi** ("%98 Doğruluk") | `CLAUDE.md` 2.8 — model güven puanı kalibre olasılık gibi sunulmaz. Mockup'taki sayı hiçbir yerden gelmiyordu |
| **Model adı arayüzde** ("GPT-4o Akademik") | 3.7 — tek sağlayıcıya bağımlılığı görünür kılar, model değişince yalan olur |
| **Kullanılmayan marka adı** ("Napkin AI Çizim Motoru") | Landing page'deki Scopus hatasının tekrarı |
| **Kredi / token sayacı** | Kullanıcıyı doğrulamayı kısmaya iter. Teşvik edilmesi gereken davranışın tam tersi |
| **Serbest parafraz düğmesi** | 2.2 — üretim yalnızca getirilmiş pasajdan yapılır |
| **"Paragrafı genişlet"** | 2.2 — serbest paragraf üretimi kapsam dışı |
| **Kesin kalite puanı** (dergi skoru, "güvenilir kaynak" damgası) | Rozet kayıt bilgisidir, yargı değil. Bölüm 4'teki dil kuralı |
| **60 düğmeli Word şeridi** | Word'le biçimlendirmede yarışılmaz. 12–16 düğme + sağ tık menüsü + açılır menüler yeter; gerisi erişilebilir ama ekranı kaplamaz |
| **Kaynaktan kopuk süs görseli** | Diyagram araştırma içeriğine bağlı ve düzenlenebilir olmalı. Şablon sayısı değer değil |
| **Sürüklenebilir cetvel** | Kenar boşluğu bir kez ayarlanır. Günlerce iş, marjinal değer |
| **"Okuma süresi ~18 dk"** | Blog metriği, akademik yazımda anlamsız |
| **"Hedef sayfa 12/16"** | Tez sayfa sayısıyla ilerlemiyor. Bölüm bazında kelime + kanıt oranı doğru ölçü |
| **Eşzamanlı düzenleme** | CRDT gerektirir, ayrı bir proje. Yorum katmanı yeterli |

---

## 14. Dışa aktarma

Dört format mockup'ta doğru seçilmiş, beşincisi eklenmeli:

| Format | Not |
| --- | --- |
| `.docx` | Türk akademisinin fiilî standardı, en önemlisi |
| `.pdf` | Teslim ve paylaşım |
| `.tex` | Mühendislik, fizik |
| `.xlsx` | Literatür sentez matrisi |
| **Denetim izi PDF'i** | **Kimsede yok.** Hangi cümle hangi kaynaktan, hangi pasajla, ne zaman. Kurumsal satışın kilidi |

Atıf stili APA, IEEE, Vancouver, Chicago olarak seçilebilir. Atıf verisi kod
katmanından geldiği için bu saf biçimlendirme işi (`CLAUDE.md` 3.1).

---

## 15. Fuar demosu — 40 saniye

Standa gelen akademisyen için sıralama:

1. Boş sayfaya Türkçe bir iddia yaz
2. Kanıt paneli açılsın — **İngilizce pasaj, Türkçe iddia** (ayrışma burada
   görünür)
3. Pasajın karar veren kısmı vurgulu gelsin
4. **"Kısmen destekliyor"** rozetini göster: "pasaj tek merkezli bir kohortu
   kapsıyor, iddian genel"
5. Telefonu çıkar, danışman görünümünü aç

**Dördüncü adım en önemlisi.** Herkes "kaynak buldum" diyebiliyor. "Bu kaynak
iddianı tam desteklemiyor" diyen tek ürün sensin — ve bunu bir akademisyene
gösterdiğinde ne yaptığını anında anlıyor.

Bu akış için şerit, cetvel ve 60 düğmenin hiçbiri gerekmiyor.

---

## 16. Uygulama sırası

| # | İş | Neden bu sırada |
| --- | --- | --- |
| 0 | **WO-001 denetimi** | Her şeyin önünde. Hangi özelliğin gerçekten çalıştığını bilmeden plan yapılamaz |
| 1 | **Çalışan belge temeli** | Yazma, temel biçimlendirme, başlıklar, otomatik kayıt, belgeyi tekrar açma, `.docx` dışa aktarma. Kanıt sistemi bunun üstüne biner |
| 2 | TipTap geçişi + cümle çapaları | `claim_id` olmadan hiçbiri olmaz |
| 3 | **Durum çubuğu + özet satırı** | En küçük iş, en büyük görünür fark |
| 4 | Kanıt paneli + kaynak yönetimi | Ürünün kendisi |
| 5 | Danışman görünümü | Yayılma kanalı; kanıt varsa ucuz — salt okunur render |
| 6 | Denetim izi dışa aktarımı | Kurumsal satış |
| 7 | Okuma notu katmanı (v1) | Okumadan yazmaya köprü |
| 8 | Literatür matrisi + temel diyagramlar | Kaynağa bağlı, düzenlenebilir olanlar |
| 9 | Şablonlar, analiz paneli, PDF not katmanı (v2) | Sonra |

### Ama önce: ince dikey dilim

Yukarıdaki sıra katman katman ilerliyor — önce editör tamamlanıyor, sonra
çapalar, sonra panel. Bunun riski şu: editör paketi tek başına büyük (yazma,
başlıklar, biçimlendirme, otomatik kayıt, tekrar açma, `.docx`) ve bitene
kadar ürünün çalışıp çalışmadığını kimse bilmiyor.

Önce **uçtan uca en ince dilimi** çalıştır:

1. Belge oluştur
2. Bir paragraf yaz
3. Bir cümle iddia olarak işaretlensin
4. Koleksiyondan kaynak seç
5. Bir pasaj o cümleye bağlansın
6. Durum ve gerekçe görünsün
7. Belgeyi kapat, aç — bağ korunmuş olsun
8. Basit `.docx` dışa aktarımı çalışsın

Sekiz adım, hepsi kaba. Biçimlendirme yok, panel tasarımı yok, şık değil. Ama
ürünün temel vaadini baştan sona sınıyor — ve yedinci adım (kapat-aç) çoğu
mimari hatayı erken yakalar.

**Prototip kapsamı ≠ ilk sürüm kapsamı.** Bu ayrım korunmazsa dilim büyür ve
anlamını kaybeder:

| | Prototip (doğrulama) | İlk sürüm (teslim) |
| --- | --- | --- |
| Dışa aktarma | Düz `.docx`, biçim kaba | Başlık hiyerarşisi, atıf stili, tablo |
| Kanıt paneli | Tek pasaj, süssüz | Tam kart, çoklu kaynak, hakem itirazı |
| Kaynak seçimi | Elle girilen 3 kaynak | Koleksiyon + arama |
| Kayıt | `localStorage` yeter | Üç durumlu, sürümlü, çakışma yönetimi |

Prototipte amaç çalışmak değil, **öğrenmek.** Bu dilim çalıştıktan sonra
yukarıdaki sıra her katmanı üretim kalitesine çıkarır.

### İki değişiklik kayda değer:

**Belge temeli öne alındı (1).** Kanıt sistemi çalışan bir editörün üstüne
biner. Otomatik kaydetmeyen, tekrar açılmayan bir belgede kanıt bağının bir
anlamı yok.

**Danışman görünümü beşte kaldı, dörtten sonra ama tablolardan önce.** Kanıt
sistemi çalıştığı anda bu özellik salt okunur bir render'dan ibaret — ucuz.
Tablolar ve diyagramlar daha pahalı ve daha az ayrıştırıcı. Yayılma kanalını
geciktirmenin bedeli, bir tablo editörünü geciktirmenin bedelinden yüksek.

---

## 17. Tasarım başarı ölçütleri

`CLAUDE.md` Bölüm 4 sistemin doğruluğunu ölçer (E1–E4). Burada ölçülen farklı
şey: **tasarım işe yarıyor mu.**

### Yanlış metrik uyarısı

"Kanıtlı cümle oranı" tek başına metrik değil. Yükseltmenin en kolay yolu
kullanıcıyı her cümleye kaynak eklemeye itmek — bu da akademik olarak kötü
yazım üretir. Kredi sayacıyla aynı aile hata: ölçtüğün şey teşvik ettiğin şey
olur.

### Ölçülecekler

| Soru | Nasıl |
| --- | --- |
| Kullanıcı bir iddianın kaynağını ne kadar hızlı buluyor? | Süre, görev testi |
| Danışman bir bölümdeki riskli iddiaları ne kadar sürede buluyor? | Süre, görev testi |
| Kullanıcı "kısmen destekliyor" gerekçesini doğru anlıyor mu? | Kullanıcıya sor: fark neydi |
| "Kaynak bekliyor" ile "iddia değil" ayrımı anlaşılıyor mu? | Görev testi |
| Kullanıcı yerel kayıt ile bulut kaydını ayırt ediyor mu? | Görev testi |
| Kullanıcı sistemin izinsiz metin eklemediğine güveniyor mu? | Görüşme |
| Kullanıcı model kararını ne sıklıkla düzeltiyor? | Telemetri — yüksekse doğrulama zayıf |

Son satır en değerlisi: kullanıcı düzeltmesi, sistemin hatasının ücretsiz
ölçüsü. Düzeltme oranı sınıf bazında izlenirse hangi kararın güvenilmez olduğu
kendiliğinden çıkar.

### İlk prototipte test edilecek üç akış

Yeni özellik eklemeden önce bu üçü düşük çözünürlükte sınanmalı:

1. İddia yaz → kanıt bağla
2. "Kısmen destekliyor"u incele, farkı anla
3. Danışman telefonda değerlendirir

Üçü çalışıyorsa ürünün temel vaadi gerçekten çalışıyor demektir.

---

## 18. Açık kararlar

**Ürün davranışı**

- **Bir cümlede birden fazla bağımsız iddia varsa?** MVP tek sayıyor (Bölüm 5),
  ama kullanıcı cümleyi bölebilmeli mi, sistem mi bölmeli?
- **Pasaj bulunamazsa kullanıcı kendi pasajını yapıştırabilir mi?** Yapabilirse
  doğrulama yine çalışır mı, yoksa "kullanıcı beyanı" olarak mı işaretlenir?
- **Kullanıcının düzeltmesi sonraki değerlendirmeleri etkileyecek mi?** Yalnızca
  o belgede mi kalır, yoksa sınıflandırıcıya geri besleme mi olur?
- **`.docx` dışa aktarımında kanıt çubukları ve yorumlar çıkacak mı?** Yoksa
  yalnızca teslim metni mi? (Denetim izi zaten ayrı PDF)

**Arayüz**

- **Teslim fontu listesi.** Times New Roman, Cambria, Calibri Türkiye'de en
  yaygın üçlü — başka?
- **Not alanı kaynak başına mı, pasaj başına mı?** v1/v2 ayrımı Bölüm 10'da,
  ama v1'de birden fazla not sıralanacak mı, tek alan mı?
- **Teslim önizlemede sayfalama yaklaşıksa bu nasıl bildirilecek?** "Yaklaşık
  12 sayfa" ibaresi yeterli mi?
