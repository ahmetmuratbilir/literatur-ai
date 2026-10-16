# WO-006 — İstatistik çekirdeği ve çapraz doğrulama

| Alan | Değer |
| --- | --- |
| Durum | **Bitti** (14.10.2026, `wo-006-istatistik`) — kullanıcı onayı aynı gün |
| Kapsam | Tek modül (yalnız istemci, arayüz yok) |
| Dosya değişikliği | İzinli (liste aşağıda) — hepsi **yeni** dosya |
| Tahmini süre | 2–3 oturum |
| Ön koşul | Yok. WO-001 denetimiyle çakışmaz: dokunulan dosya yok |
| Yol haritası aşaması | P3 |

## Problem

Analiz paneli tasarım belgesinde "sonra" diye bırakılmış
(`docs/design/tasarim-yonu.md:790`) ve kodda hiçbir karşılığı yok. Doğrulandı
(2026-10-14):

- `client/src/` altında hiçbir istatistik modülü yok.
- `AiAnalysisPanel.jsx` arama stratejisi paneli; istatistikle ilgisi yok
  (dosya başlığındaki açıklama: "AI ile geliştir sonucu: hedef cümlesi ve
  satır satır arama yaklaşımları").
- `recharts@^3.6.0` `client/package.json:28`'de kurulu ama `client/src`
  içinde tek bir `import` yok — ölü bağımlılık.

Hedef kullanıcı (tez yazan yüksek lisans öğrencisi) betimsel istatistik,
t-testi ve Cronbach alfa için SPSS'e gidip geri dönüyor.

## Neden şimdi

Bu iş emri **arayüz yazmadan** hesabın doğruluğunu kilitliyor. Yanlış bir
t-testi, güzel bir panelin arkasında aylarca fark edilmez; çıplak bir modülde
ilk gün fixture'a takılır.

Ayrıca WO-001 denetimiyle paralel yürüyebilir: tek bir mevcut dosyaya
dokunmuyor, hepsi yeni dosya.

## Kapsam

### Dahil

Altı test, her biri APA çıktısı üretecek şekilde:

| Test | Yanında zorunlu dönen |
| --- | --- |
| Betimsel istatistik | n, ortalama, ss, medyan, min, maks, çarpıklık, basıklık |
| Shapiro-Wilk normallik | W, p, karar |
| Bağımsız örneklem t-testi | t, sd, p, Levene F ve p, Cohen's d |
| Eşleştirilmiş t-testi | t, sd, p, Cohen's d |
| Pearson / Spearman korelasyon | r (veya rho), n, p, %95 GA |
| Cronbach alfa | α, madde sayısı, madde-toplam korelasyonları |

Ortak altyapı: normal, t ve F dağılımlarının CDF'leri; eksik veri ayıklama;
APA biçimlendirme.

### Hariç

- **Arayüz.** Panel, sekme, veri girişi, grafik: WO-007 ve WO-008.
- **ANOVA ve ki-kare.** v2. Altı testi doğru yapmak, on ikisini yarım
  yapmaktan iyi.
- **Sunucu.** Hiçbir uç eklenmez; kullanıcının ham verisi sunucuya gitmez.
- **Yeni bağımlılık.** Hesap kendi kodumuzda yazılır (gerekçe: Yaklaşım).
- `recharts`'ın ölü bağımlılık olması: WO-008'de kullanılacak, şimdi
  dokunulmaz.

Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar

Hepsi yeni. **Mevcut hiçbir dosya değişmez** — `client/package.json` dahil
(test betiği `tests/*.test.js` globu zaten yeni dosyayı alır).

- `client/src/stats/distributions.js` (yeni) — normal, t, F CDF; eksik beta
  ve gama fonksiyonları
- `client/src/stats/descriptives.js` (yeni)
- `client/src/stats/normality.js` (yeni) — Shapiro-Wilk
- `client/src/stats/ttest.js` (yeni) — bağımsız, eşleştirilmiş, Levene
- `client/src/stats/correlation.js` (yeni) — Pearson, Spearman
- `client/src/stats/reliability.js` (yeni) — Cronbach alfa
- `client/src/stats/apa.js` (yeni) — APA biçimlendirme ve dürüstlük kuralları
- `client/tests/stats.test.js` (yeni)
- `client/tests/fixtures/stats-reference.json` (yeni) — referans çıktılar

Liste yetersizse iş durur ve sorulur.

## Yaklaşım

### Neden kendi kodumuz

Üç yol vardı:

| Yol | Karar | Gerekçe |
| --- | --- | --- |
| Tarayıcıda kendi JS kodumuz | **Seçildi** | Lisans temiz, yığın değişmiyor, kullanıcı verisi tarayıcıdan çıkmıyor |
| pyodide + scipy/pingouin | Reddedildi | `pingouin` GPL-3.0; pyodide ile tarayıcıya göndermek **dağıtımdır** ve copyleft devreye girer |
| Sunucuda Python servisi | Reddedildi | Yeni çalışma zamanı, yeni dağıtım, yeni maliyet; veri de sunucuya çıkar |

Bu, AHP'de zaten uygulanmış kalıbın tekrarı: kendimiz yazarız, yayımlanmış
bir kütüphanenin **sayılarıyla** çapraz doğrularız, **kodunu almayız**,
tarihi kaydederiz. Şablon: `server/tests/ahpCrossValidation.test.js`.

### Çapraz doğrulama yöntemi

Referanslar bir kez üretilir, `stats-reference.json` içine tarih ve sürümle
yazılır, commit edilir. Üretim komutları dosyanın başında yorum olarak durur.

| Test | Referans | Tolerans |
| --- | --- | --- |
| Betimsel | R 4.x `psych::describe` | 1e-9 |
| Shapiro-Wilk | R 4.x `shapiro.test` | W: 1e-6, p: 1e-4 |
| t-testi (bağımsız/eşleştirilmiş) | R 4.x `t.test` | 1e-9 |
| Levene | R `car::leveneTest` | 1e-7 |
| Pearson / Spearman | R 4.x `cor.test` | 1e-9 |
| Cronbach alfa | R `psych::alpha` | 1e-7 |

Shapiro-Wilk'in toleransı bilerek gevşek: Royston'un AS R94 algoritması
yaklaşıktır ve p değeri log dönüşümünden geçer. Tolerans gevşekliği
gizlenmez, test dosyasında gerekçesiyle yazılır.

Veri kümeleri: her test için en az üç küme — tipik (n≈30), küçük örneklem
(n=8), ve kenar durum (bağlı değerler / sıfır varyans / eksik veri).

### Dürüstlük kuralları (tüzük 2.8'in istatistik hali)

`apa.js` bunları **kodla** uygular, yorum olarak değil:

- Varsayım kontrolü yapılmadan parametrik sonuç döndürülmez. Shapiro-Wilk
  reddedilirse çıktı `assumptionFailed: true` taşır ve parametrik olmayan
  alternatifi adıyla önerir.
- Etki büyüklüğü olmadan "anlamlı fark" ifadesi üretilmez.
- `p = .000` basılmaz; `p < .001` basılır.
- n < 30 uyarı alanı doldurur.
- Nedensellik ifadesi üretilmez; korelasyon çıktısı "ilişki" der, "etki"
  demez.
- Bilinmeyen veya hesaplanamayan alan `null` kalır, tahminle doldurulmaz
  (tüzük 3.6).

### Mimari sapma — kayda geçiriliyor

Analiz çıktısı bir **kaynak pasajına** değil, kullanıcının **kendi verisine**
bağlıdır. Tüzük 2.1'den sapma budur ve bilinçlidir:

- Beş kanıt sınıfı (2.4) bu çıktıya uygulanmaz.
- `origin` alanının (3.6) üçüncü değeri gerekir: `computed`.
- Denetim izi kalkmaz, güçlenir: hangi veri, hangi test, hangi parametre,
  hangi çıktı, ne zaman eklendi.
- Eklenen metne **atıf konmaz**; köken kaydı konur.

Bu sapmanın arayüz tarafı WO-007'nin işi. Bu iş emri yalnız veri yapısında
`origin: 'computed'` alanını üretir.

## Kabul kriterleri

- [ ] Altı testin her biri `stats-reference.json`'daki referans çıktıyla
      tablodaki tolerans içinde eşleşiyor
- [ ] Her test için en az üç veri kümesi var: tipik, küçük örneklem, kenar
      durum
- [ ] Eksik veri (`null`, `NaN`, boş dize) ayıklanıyor ve ayıklanan sayı
      çıktıda raporlanıyor — sessizce düşürülmüyor
- [ ] Sıfır varyans, n<3 ve tüm değerlerin eşit olduğu girdilerde çökme yok;
      çıktı `null` + gerekçe döndürüyor
- [ ] `p = .000` hiçbir çıktıda görünmüyor (teste bağlanmış)
- [ ] Etki büyüklüğü olmadan "anlamlı" dizesi üretilmiyor (teste bağlanmış)
- [ ] `client/src/stats/` içinde hiçbir dosya ağ isteği, `localStorage` veya
      DOM API'si kullanmıyor — saf fonksiyon (grep ile doğrulanır)
- [ ] `npm test` geçiyor; mevcut 17 test düşmedi
- [ ] `npm run lint` temiz, `npm run build` geçiyor
- [ ] `git diff --stat` yalnız yeni dosya gösteriyor, mevcut dosya değişmemiş
- [ ] Bölüm 3 ihlali yok

Bölüm 4 regresyon seti (E1–E4) **çalıştırılmaz**: o kümeler kanıt hattını
ölçüyor, bu modül hesabı yapıyor. Bu iş emrinin ölçümü kendi çapraz
doğrulamasıdır.

## Test planı

| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| İstatistik çekirdeği | `cd client && npm test` | Yeni testler + mevcut 17 geçiyor |
| Lint | `cd client && npm run lint` | Temiz |
| Build | `cd client && npm run build` | Başarılı; paket boyutu %5'ten fazla artmadı |
| Saflık | `grep -rnE "fetch\|axios\|localStorage\|document\." client/src/stats/` | Çıktı boş |
| Dosya kapsamı | `git status --porcelain` | Yalnız yeni dosyalar |

Elle kontrol gerekmiyor: arayüz yok.

## Ölçüm

| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |
| Referansla eşleşen test sayısı | 0 (modül yok) | 6/6, tablodaki toleransla |
| İstemci paket boyutu (`index-*.js`) | 500,00 kB | ≤ 525 kB |

Paket boyutu izlenir çünkü modül sonunda tarayıcıya gidiyor. Aşılırsa
`stats/` ayrı parçaya alınır (Workspace'te zaten yapıldı).

## Geri alma

`client/src/stats/` ve iki test dosyası silinir. Mevcut hiçbir dosya
değişmediği için başka dönüş adımı yok. Dal: `wo-006-istatistik`.

Özellik bayrağı gerekmiyor: modül hiçbir yerden çağrılmıyor, kullanıcı
yüzeyi yok. Bayrak WO-007'de gelir.

## Riskler

| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Shapiro-Wilk'i JS'te doğru yazmak zor (Royston AS R94) | **Yüksek** | Orta | Tolerans ayrı belirlendi; tutturulamazsa test listeden çıkar ve rapora yazılır — yanlış sonuç döndürmektense özellik olmaz |
| Kayan nokta farkları R ile tam eşleşmez | Orta | Düşük | Test başına tolerans; eşleşmeyen testin gerekçesi yazılır |
| Yanlış istatistik sessizce doğru görünür | Düşük | **Yüksek** | Her test bağımsız bir kütüphaneye karşı doğrulanır; doğrulanmamış test yayımlanmaz |
| Kapsam kayması: "ANOVA'yı da ekleyelim" | **Yüksek** | Orta | Liste bu iş emrinde sabit; ekleme yeni iş emri ister |

## Onay gereken noktalar

- Taslak → Hazır geçişi (kullanıcı)
- Shapiro-Wilk tolerans içinde tutturulamazsa: testi listeden çıkarmak mı,
  toleransı gevşetmek mi? **Varsayılan: çıkarmak.** Gevşetmek kullanıcıya
  yanlış bir kesinlik satar
- Referans çıktıları kim üretecek: R kurulu bir makine gerekiyor. Yoksa
  SciPy'ye düşülür ve bu rapora yazılır

## Bitiş raporu

**Değişen dosyalar** — hepsi yeni, mevcut hiçbir dosya değişmedi
(`git status --porcelain` çıktısı: `?? client/src/stats/`,
`?? client/tests/fixtures/`, `?? client/tests/stats.test.js`):

- `client/src/stats/distributions.js` — logΓ, eksik beta ve gama (alt ve üst
  kuyruk ayrı), Φ, Φ⁻¹, t ve F dağılımları
- `client/src/stats/descriptives.js` — temizlik + betimseller
- `client/src/stats/normality.js` — Shapiro-Wilk (Royston AS R94)
- `client/src/stats/ttest.js` — bağımsız (Student + Welch), eşleştirilmiş, Levene
- `client/src/stats/correlation.js` — Pearson, Spearman, Fisher z güven aralığı
- `client/src/stats/reliability.js` — Cronbach alfa, madde-toplam, madde atılırsa alfa
- `client/src/stats/apa.js` — APA biçimi + dürüstlük kuralları
- `client/tests/stats.test.js` — 35 test
- `client/tests/fixtures/stats-reference.json` — referans çıktılar

**Teknik kararlar**

1. **Referans SciPy 1.17.1 / NumPy 2.2.6, R değil.** İş emri R'yi tercih
   ediyordu; bu makinede R kurulu değil (`Rscript` yok) ve iş emrinin yedek
   yolu SciPy'ydi. Üretim betiği fixture'ın `_note` alanında kayıtlı. Sayı
   alındı, kod alınmadı.
2. **Üst kuyruklar doğrudan hesaplanıyor.** İlk sürüm `1 - P(...)` yapıyordu
   ve Φ(-8)'de SciPy'ye göre bağıl hata **1,8e-2** ölçüldü — çıkarma anlamlı
   basamakları yiyordu. `incompleteGammaUpper` ve F'de beta simetrisi
   eklendikten sonra hata 7e-14'e indi. Aynı sebeple `Φ⁻¹(p)`, p > 0,5 için
   simetriden gidiyor (Sterbenz: 1-p tam hesaplanır).
3. **Levene ortalama merkezli.** `car::leveneTest` varsayılanı medyan
   merkezlidir (Brown-Forsythe) ve farklı sayı verir. Hedef kullanıcı SPSS'ten
   geliyor; SPSS'in "Levene's Test" sütunu ortalama merkezli. Seçim çıktıda
   `center: 'mean'` olarak görünüyor, gizlenmiyor.
4. **Çarpıklık ve basıklık G1/G2.** SPSS ve Excel'in bildirdiği yanlılık
   düzeltmeli değerler (`scipy.stats.skew(bias=False)` ile aynı). `psych::describe`
   varsayılanı başka bir tip; SPSS uyumu tercih edildi.
5. **Cronbach alfanın çapraz doğrulaması diğerlerinden zayıf.** SciPy'de alfa
   yok. Referans kovaryans ortalaması yolundan (`k·ortalama_kov /
   (ortalama_var + (k-1)·ortalama_kov)`), bizdeki uygulama varyans toplamı
   yolundan hesaplıyor. İki yol cebirsel olarak farklı, sonuç 1,2e-15 içinde
   eşleşti — bu kodlama hatasına karşı gerçek bir kontrol, ama **yanlış formül
   seçimine karşı değil**. Madde-toplam korelasyonları `scipy.stats.pearsonr`
   ile bağımsız doğrulandı. Eksik: `psych::alpha` ile karşılaştırma.
6. **Dürüstlük kuralları koda bağlandı, yoruma değil.** `significanceSentence`
   tek kapı: etki büyüklüğü yoksa anlamlılık iddiası üretmiyor.
   `assumptionFailed` üç değerli — `null` "kontrol edilmedi", `false`
   "kontrol edildi ve geçti". İkisi karıştırılmıyor.

**Çalıştırılan testler ve gerçek çıktıları**

| Komut | Çıktı |
| --- | --- |
| `cd client && npm test` | `tests 67 · pass 67 · fail 0` (35 yeni + mevcut 32) |
| `cd client && npm run lint` | Temiz, uyarı yok |
| `cd client && npm run build` | Başarılı, `index-*.js` 520,97 kB |
| Saflık taraması (`fetch\|axios\|localStorage\|document.\|window.`) | `src/stats/*.js` içinde eşleşme yok |
| `git status --porcelain` | Yalnız üç yeni yol |

Ölçülen çapraz doğrulama sapmaları (toleranslar iş emrinden):

| Test | Tolerans | **Ölçülen** |
| --- | --- | --- |
| Betimsel | 1e-9 | 3,9e-14 |
| Shapiro-Wilk W | 1e-6 | **4,7e-10** |
| Shapiro-Wilk p | 1e-4 | **9,0e-9** |
| t-testleri (bağımsız/eşleştirilmiş) | 1e-9 | 1,3e-14 |
| Levene | 1e-7 | 6,1e-15 |
| Pearson / Spearman | 1e-9 | 1,7e-15 |
| Cronbach alfa | 1e-7 | 1,2e-15 |

Shapiro-Wilk'in gevşek toleransı **kullanılmadı**: ölçülen sapma iznin dört
basamak altında. Tolerans emniyet payı olarak duruyor ve testte bu da
ayrıca bağlandı (`worstW < 1e-8`).

**Ölçülen etki**

| Metrik | Öncesi | Sonrası |
| --- | --- | --- |
| Referansla eşleşen test sayısı | 0 (modül yok) | 6/6 |
| İstemci paket boyutu (`index-*.js`) | 520,93 kB | 520,97 kB |

Paket boyutu neredeyse değişmedi çünkü modül **hiçbir yerden çağrılmıyor**;
derleyici tamamen ağaç budamasına alıyor. Gerçek boyut etkisi WO-007'de
panel modülü import ettiğinde ölçülecek.

**Bilinen eksikler ve riskler**

- Cronbach alfanın referansı tam bağımsız değil (madde 5). `psych::alpha`
  erişilebilir olduğunda yeniden doğrulanmalı.
- ANOVA ve ki-kare kapsam dışı (iş emri kararı), `levene` çok gruplu çalışıyor
  ama ANOVA'nın kendisi yok.
- Spearman p değeri t yaklaşımı; küçük n'de kesin dağılım değil. Çıktıda
  `method: 't_approximation'` yazıyor.
- Shapiro-Wilk 5000'den büyük n'de `error: 'too_many'` döndürüyor — algoritmanın
  geçerli aralığı. Büyük veri için farklı test gerekir (kapsam dışı).
- Arayüz yok: kullanıcı bu hesapları henüz göremiyor (WO-007).
- Dal `wo-006-istatistik`, WO-000'ın commit edilmemiş işinin üzerine açıldı
  (kullanıcı commit'i erteledi). Bu iş emrinin kendi dosyaları ayırt edilebilir;
  ama dal temiz bir tabandan açılmadı.

**Sonraki adım:** WO-007 (analiz sekmesi) artık Hazır'a geçebilir — bu iş
emri READY. Mühendislik analizleri (belirsizlik bütçesi, hata yayılımı,
Monte Carlo, regresyon) ayrı bir iş emridir: WO-009.

- **Durum:** READY
