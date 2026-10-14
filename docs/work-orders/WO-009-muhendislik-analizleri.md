# WO-009 — Mühendislik analizleri: belirsizlik, yayılım, Monte Carlo, regresyon

| Alan | Değer |
| --- | --- |
| Durum | **Bitti** (14.10.2026, `wo-006-istatistik` dalında) |
| Kapsam | Tek modül kümesi (yalnız istemci, arayüz yok) |
| Dosya değişikliği | İzinli (liste aşağıda) — hepsi **yeni** dosya |
| Ön koşul | WO-006 READY (14.10.2026) — `distributions.js` ve `descriptives.js` kullanılıyor |
| Yol haritası aşaması | P3 |

## Problem

WO-006 sosyal bilim istatistiğini kapsıyor: t-testi, korelasyon, Cronbach
alfa. Hedef kullanıcının bir kısmı mühendislik öğrencisi ve onun tez
bölümünde bambaşka hesaplar var. Doğrulandı (2026-10-14): `client/src/stats/`
altında bunların hiçbiri yok.

Bir mühendislik deney bölümünde tekrar eden dört hesap:

1. **Belirsizlik bütçesi.** Ölçülen her büyüklüğün belirsizliği ayrı ayrı
   listelenir, bileşik belirsizlik hesaplanır, genişletilmiş belirsizlik
   kapsam katsayısıyla verilir. Standart: JCGM 100:2008 (GUM).
2. **Hata yayılımı.** Dolaylı ölçülen büyüklüğün belirsizliği, girdilerin
   belirsizliğinden türetilir. Elle yapıldığında kısmi türev hatası sık.
3. **Monte Carlo yayılımı.** Doğrusal olmayan modelde birinci mertebe
   yaklaşımı yetmez; JCGM 101:2008 bunun için Monte Carlo öneriyor.
4. **Kalibrasyon ve regresyon.** Doğru uydurma, R², katsayı standart hataları,
   kestirim aralığı. Lab raporunun yarısı bu.

Bugün kullanıcı bunlar için Excel'e ya da elle türev almaya gidiyor.

## Neden şimdi

WO-006'nın dağılım altyapısı (`distributions.js`) hazır ve test edilmiş:
t dağılımı kestirim aralığı için, normal dağılım kapsam katsayısı için
zaten var. İkinci kez yazılmaması gereken kısım bitmiş durumda.

Yine **arayüzden önce**, aynı gerekçeyle: yanlış bir belirsizlik bütçesi
güzel bir panelin arkasında fark edilmez.

## Kapsam

### Dahil

| Hesap | Yanında zorunlu dönen |
| --- | --- |
| Bileşik standart belirsizlik (GUM) | u_c, her bileşenin katkı yüzdesi, etkin serbestlik derecesi (Welch-Satterthwaite) |
| Genişletilmiş belirsizlik | U, k kapsam katsayısı, kapsam olasılığı, aralık |
| A tipi belirsizlik | ortalamanın standart hatası, n, serbestlik derecesi |
| Hata yayılımı (birinci mertebe) | sonuç, u_c, her girdinin duyarlılık katsayısı ve katkısı |
| Monte Carlo yayılımı | ortalama, standart sapma, kapsama aralığı, örneklem sayısı, **tohum** |
| Doğrusal regresyon / kalibrasyon | eğim, kesme, standart hataları, R², düzeltilmiş R², s (artık standart sapması), ANOVA F ve p, güven ve kestirim aralıkları |

Ortak altyapı: sayısal kısmi türev (merkezi fark, adım seçimi otomatik),
tohumlanabilir rastgele sayı üreteci, birim etiketlerinin **taşınması**.

### Hariç

- **Arayüz.** Panel, formül girişi, grafik: WO-007 ve WO-008.
- **Birim cebiri / boyut analizi.** Birimler yalnız etiket olarak taşınır,
  çarpılıp bölünmez. Gerçek birim cebiri ayrı iş emri — yarım yapılırsa
  yanlış birim gösterir, yanlış birim sessiz bir hatadır.
- **Doğrusal olmayan regresyon, çoklu regresyon.** v2.
- **Kullanıcıdan formül dizesi alıp değerlendirmek.** `eval` ve benzeri
  yok; model bir JavaScript fonksiyonu olarak verilir. Kullanıcı yazdığı
  formülün çalıştırılması WO-007'nin güvenlik işi.
- **Yeni bağımlılık.** Hesap kendi kodumuzda (WO-006 gerekçesiyle aynı).

### Dokunulabilecek dosyalar

Hepsi yeni. Mevcut dosyalar **değişmez**; WO-006 modülleri yalnız
`import` edilir.

- `client/src/stats/uncertainty.js` (yeni) — GUM: A/B tipi, bileşik,
  genişletilmiş, bütçe tablosu
- `client/src/stats/propagation.js` (yeni) — sayısal kısmi türev ve
  birinci mertebe yayılım
- `client/src/stats/montecarlo.js` (yeni) — tohumlanabilir üreteç ve
  JCGM 101 yayılımı
- `client/src/stats/regression.js` (yeni) — doğrusal regresyon, kalibrasyon
- `client/tests/engineering.test.js` (yeni)
- `client/tests/fixtures/engineering-reference.json` (yeni)

## Yaklaşım

### Sayısal türev neden analitik türev yerine

Kullanıcı modelini bir fonksiyon olarak veriyor; sembolik türev için ifade
ayrıştırıcısı gerekir ve o ayrıştırıcı kullanıcı girdisini çalıştırma
kapısı açar. Merkezi fark, adım `h = ε^(1/3)·max(|x|, 1)` ile seçildiğinde
yuvarlama ve kesme hatasını dengeler; bu seçim testte sembolik türevi
bilinen fonksiyonlara karşı doğrulanıyor.

### Monte Carlo'nun tohumu çıktıda durur

Denetim izi (tüzük 2.3) rastgele bir hesapta ancak tohum kayıtlıysa işler.
Aynı tohum aynı sayıyı vermiyorsa kullanıcı sonucunu savunamaz. Üreteç
bu yüzden `Math.random` değil, kendi yazdığımız sayaç tabanlı üreteç
(splitmix64 türevi) ve tohum çıktının içinde döner.

### Çapraz doğrulama yöntemi

| Hesap | Referans | Tolerans |
| --- | --- | --- |
| Kısmi türev | Elle alınmış analitik türev | 1e-7 (merkezi fark sınırı) |
| Bileşik belirsizlik | GUM yayımlanmış örneği + elle hesap | 1e-12 |
| Etkin serbestlik derecesi | Welch-Satterthwaite elle hesap | 1e-12 |
| Monte Carlo | Analitik sonuçla yakınsama (n büyütülerek) | 3 standart hata |
| Doğrusal regresyon | `scipy.stats.linregress` ve NumPy | 1e-9 |
| Regresyon ANOVA F ve p | `scipy.stats` | 1e-9 |
| Kestirim aralığı | Elle hesap (t dağılımı) | 1e-9 |

Monte Carlo doğası gereği tam eşleşmez; testi "analitik sonucun üç standart
hatası içinde" diye kurmak doğru olan. Sabit tohumla sonuç yineleniyor, bu
ayrıca test ediliyor.

### Dürüstlük kuralları

`apa.js`'in mühendislik hali — bunlar da kodla uygulanır:

- Belirsizlik bildirilmeden sonuç döndürülmez. Belirsizliği olmayan girdi
  `u = 0` sayılmaz; alan `null` kalır ve bütçede "belirsizliği girilmemiş"
  diye görünür.
- Genişletilmiş belirsizlik, kapsam katsayısı ve kapsam olasılığı **birlikte**
  bildirilir. "± 0,4" tek başına anlamsızdır.
- Monte Carlo sonucu birinci mertebe sonuçtan belirgin farklıysa (> %10)
  çıktı bunu işaretler: doğrusal yaklaşım kırılmış demektir.
- R² tek başına uyum iyiliği sayılmaz; artık standart sapması ve F testi
  yanında döner.
- Kestirim aralığı ile güven aralığı karıştırılmaz, ikisi ayrı alanda.
- Veri aralığı dışında kestirim yapıldığında çıktı `extrapolation: true`
  taşır.

## Kabul kriterleri

- [ ] Altı hesabın her biri tablodaki referans ve toleransla eşleşiyor
- [ ] Sayısal türev, analitik türevi bilinen en az üç fonksiyonda doğrulandı
- [ ] Aynı tohum aynı Monte Carlo sonucunu veriyor (teste bağlanmış)
- [ ] Monte Carlo, doğrusal bir modelde analitik sonuca yakınsıyor
- [ ] Doğrusal olmayan modelde birinci mertebe ile Monte Carlo farkı
      işaretleniyor (teste bağlanmış)
- [ ] Belirsizliği girilmemiş bileşen sıfır sayılmıyor (teste bağlanmış)
- [ ] Genişletilmiş belirsizlik k ve kapsam olasılığı olmadan döndürülmüyor
- [ ] Veri aralığı dışı kestirim `extrapolation: true` taşıyor
- [ ] Kenar durumlar: n<3 regresyon, sıfır varyanslı x, tek nokta, tüm
      ağırlıklar sıfır — çökme yok, `null` + gerekçe
- [ ] `client/src/stats/` saf kalıyor (grep ile doğrulanır)
- [ ] `npm test` geçiyor, WO-006'nın 67 testi düşmedi
- [ ] `npm run lint` temiz, `npm run build` geçiyor
- [ ] `git status --porcelain` yalnız yeni dosya gösteriyor

## Test planı

| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Mühendislik çekirdeği | `cd client && npm test` | Yeni testler + mevcut 67 geçiyor |
| Lint | `cd client && npm run lint` | Temiz |
| Build | `cd client && npm run build` | Başarılı |
| Saflık | `src/stats/*.js` içinde ağ/DOM/depolama taraması | Boş |

## Geri alma

Dört modül ve iki test dosyası silinir. Mevcut dosya değişmediği için başka
adım yok. Özellik bayrağı gerekmiyor: modül hiçbir yerden çağrılmıyor.

## Riskler

| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Sayısal türev kötü ölçekli girdide hatalı | Orta | **Yüksek** | Adım seçimi ölçeğe bağlı; analitik türevle karşılaştırmalı test |
| Monte Carlo testi kararsız (flaky) | **Yüksek** | Orta | Sabit tohum; eşik üç standart hata, sihirli sayı değil |
| Birim etiketleri çarpılmadığı için yanıltıcı görünür | Orta | Orta | Birim cebiri kapsam dışı ve bu çıktıda yazılı; etiket "girdi birimi" diye taşınır |
| Kapsam kayması: "çoklu regresyon da olsun" | **Yüksek** | Orta | Liste sabit; ekleme yeni iş emri |

## Bitiş raporu

**Değişen dosyalar** — hepsi yeni; mevcut dosyalar değişmedi, WO-006
modülleri yalnız `import` edildi:

- `client/src/stats/propagation.js` — sayısal kısmi türev (tutarlılık
  kontrollü), birinci mertebe yayılım, Welch-Satterthwaite
- `client/src/stats/uncertainty.js` — A/B tipi, bütçe, genişletilmiş
  belirsizlik, `tQuantile`
- `client/src/stats/montecarlo.js` — tohumlanabilir üreteç, JCGM 101 yayılımı
- `client/src/stats/regression.js` — doğrusal regresyon, kestirim, ters
  kalibrasyon
- `client/tests/engineering.test.js` — 27 test
- `client/tests/fixtures/engineering-reference.json` — referans çıktılar

**Teknik kararlar**

1. **Sayısal türev tutarlılık kontrolü eklendi — testin bulduğu gerçek açık.**
   İlk sürüm merkezi farkı tek adımla alıyordu. `1/x`'in x = 0'daki türevi
   tanımsız, ama iki yanda da sonlu değer bulunduğu için fonksiyon sessizce
   **2,7e10** döndürdü. Böyle bir duyarlılık katsayısı belirsizlik bütçesini
   bozar ve bozukluğu görünmez. Çözüm: tahmin h ve h/2 ile iki kez alınıyor,
   bağıl fark %0,1'i geçerse `null` dönüyor. Düzgün fonksiyonda ölçülen fark
   1e-9 düzeyinde, yani yanlış alarm yok; süreklilik kırılmasında ~4 kat
   oynuyor ve yakalanıyor. Bedeli: değişken başına iki ek model çağrısı.
2. **`Math.random` kullanılmadı.** Tohumlanamadığı için denetim izi
   kurulamıyordu. Üreteç mulberry32 (sayaç tabanlı), tohum çıktının içinde
   dönüyor. Aynı tohumun aynı sonucu verdiği teste bağlı.
3. **Monte Carlo testi eşikle değil, standart hatayla kuruldu.** "Analitik
   sonucun üç standart hatası içinde" — sihirli sabit yok, eşik örneklem
   sayısından türüyor. Üç kez üst üste koşuldu, kararsızlık yok.
4. **Kapsam aralığı simetrik yüzdelik.** JCGM 101 en kısa aralığı da kabul
   ediyor; çarpık çıktıda ikisi farklı sonuç verir. Seçim `method:
   'symmetric_percentile'` olarak çıktıda yazılı.
5. **Eksik belirsizlik sıfır sayılmıyor, ama açıkça girilen sıfır geçerli.**
   `uncertainty: null` → bileşik belirsizlik hesaplanmaz; `uncertainty: 0` →
   geçerli bileşen. İkisi ayrı, teste bağlı.
6. **Ters kalibrasyonda eğim eşiği.** `|eğim| ≤ 3·SE(eğim)` ise sonuç
   verilmiyor (`slope_not_significant`): küçük bir eğime bölmek belirsizliği
   patlatır ve sayı makul görünmeye devam eder.
7. **Tam uyumda standart hatalar `null`, sıfır değil.** Noktalar doğru
   üzerindeyse artık yok; standart hata "sıfır" değil "tanımsız"dır.

**Çalıştırılan testler ve gerçek çıktıları**

| Komut | Çıktı |
| --- | --- |
| `cd client && npm test` | `tests 94 · pass 94 · fail 0` (27 yeni + WO-006'nın 35'i + mevcut 32) |
| Üç kez üst üste `npm test` | 94/94, 94/94, 94/94 — Monte Carlo testi kararlı |
| `cd client && npm run lint` | Temiz |
| `cd client && npm run build` | Başarılı, `index-*.js` 520,97 kB (değişmedi) |
| `cd client && npm run check-i18n` | Yalnız eskiden beri duran `criteria.` uyarısı |
| Saflık taraması (ağ/DOM/depolama/`Math.random`) | Yalnız yorum satırında eşleşme |
| `git status --porcelain` | WO-009'un altı dosyası da yeni |

Ölçülen çapraz doğrulama sapmaları:

| Hesap | Tolerans | Ölçülen |
| --- | --- | --- |
| Kısmi türev (3 fonksiyon) | 1e-7 | tolerans içinde |
| Silindir hacmi bütçesi (GUM) | 1e-7 | tolerans içinde |
| Etkin serbestlik derecesi | 1e-7 | tolerans içinde |
| A tipi belirsizlik | 1e-12 | tolerans içinde |
| t dağılımı ters fonksiyonu | 1e-10 | tolerans içinde |
| Doğrusal regresyon (2 küme, 9 alan) | 1e-9 | tolerans içinde |
| Regresyon ANOVA F ve p | 1e-9 | tolerans içinde |
| Güven ve kestirim aralığı | 1e-9 | tolerans içinde |
| Monte Carlo (doğrusal model) | 3 standart hata | geçti, 200.000 çekiliş |

**Ölçülen etki**

| Metrik | Öncesi | Sonrası |
| --- | --- | --- |
| Mühendislik hesabı modülü | 0 | 4 |
| Referansla doğrulanmış hesap | 0 | 6/6 |
| İstemci paket boyutu | 520,97 kB | 520,97 kB |

Paket boyutu değişmedi: modüller hiçbir yerden çağrılmıyor, derleyici ağaç
budamasına alıyor. Gerçek etki WO-007'de ölçülecek.

**Bilinen eksikler ve riskler**

- Birim cebiri yok (kapsam dışı). Birimler etiket olarak taşınıyor,
  çarpılmıyor: `propagate` çıktısında `unit` girdinin birimidir, sonucun
  değil. Arayüzde bu ayrım yazılmalı yoksa yanıltır.
- Çoklu ve doğrusal olmayan regresyon yok (kapsam dışı).
- Ağırlıklı regresyon yok: kalibrasyon noktalarının belirsizliği farklıysa
  (heteroskedastisite) bu hesap onu görmez.
- Monte Carlo'nun girdileri **bağımsız** varsayılıyor. Korelasyonlu girdiler
  için kovaryans matrisi gerekir; yok ve bu çıktıda yazılı değil — WO-007'de
  arayüz bunu söylemeli.
- Birinci mertebe yayılım da aynı bağımsızlık varsayımını taşıyor (GUM'un
  kovaryans terimi uygulanmadı).
- Arayüz yok: kullanıcı bu hesapları henüz göremiyor.

**Sonraki adım:** WO-007 (analiz sekmesi) iki modül kümesini birden
kullanacak. Panel tasarımında üç şey yazılmalı: birimin taşındığı ama
çarpılmadığı, girdilerin bağımsız varsayıldığı, ve Monte Carlo tohumunun
sonucun parçası olduğu.

- **Durum:** READY
