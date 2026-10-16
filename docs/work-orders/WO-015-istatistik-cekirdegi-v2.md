# WO-015 — İstatistik çekirdeği v2: ANOVA, ki-kare ve parametrik olmayan testler

| Alan | Değer |
| --- | --- |
| Durum | Taslak (16.10.2026) — Hazır'a geçişi kullanıcı onaylar |
| Kapsam | Tek modül (yalnız istemci, arayüz yok) |
| Dosya değişikliği | İzinli (liste aşağıda) — dördü yeni, biri mevcut (`apa.js`) |
| Tahmini süre | 2 oturum |
| Ön koşul | WO-006 Bitti (14.10.2026). Bu iş emri onun dağılım fonksiyonlarını kullanır |
| Yol haritası aşaması | P3 |
| Numara notu | WO-012–014 WO-011'de ayrıldı (analiz çekmecesi, matris, sürüm geçmişi); bu yüzden 015 |

## Problem

WO-006 altı testi bilerek sınırlı tuttu ve ANOVA ile ki-kareyi "v2" diye
bıraktı (WO-006 › Hariç). Doğrulandı (16.10.2026):

- `client/src/stats/` altında ANOVA, ki-kare, Mann-Whitney, Wilcoxon ve
  Kruskal-Wallis yok (`grep -rni "mann\|wilcoxon\|kruskal\|anova\|chi" client/src/stats/`
  yalnız aşağıdaki öneri metinlerini buluyor).
- **Çekirdek, var olmayan bir teste yönlendiriyor.** `client/src/stats/apa.js:24`
  normallik reddedilince "parametrik olmayan alternatif: Mann-Whitney U
  (bağımsız) veya Wilcoxon işaretli sıralar (eşleştirilmiş)" diyor;
  `normality.js:152` `alternative: 'mann_whitney_or_wilcoxon'` döndürüyor.
  İkisi de hesaplanamıyor.
- Yazım alanı prototipinde (16.10.2026) "ANOVA" araması "Bu adla bir test
  yok" cevabını veriyor. Hedef kitlenin (sosyal bilim ve mühendislik tezi)
  en sık aradığı iki test ANOVA ve ki-kare.

## Neden şimdi

Analiz arayüzü (WO-007) bu testler olmadan açılırsa kullanıcı ilk aramasında
eksiği görür. Daha önemlisi, varsayım tutmadığında yapılacak önerinin bir
karşılığı olmalı. Tasarım kararı (16.10.2026): Shapiro-Wilk reddedince arayüz
"Normallik sağlanmadı; Mann-Whitney önerilir" der ve tek tıkla o teste geçer.
Bu, önerilen testin çekirdekte var olmasını gerektiriyor.

WO-006'nın ilkesi aynen geçerli: önce hesap doğruluğu, arayüzsüz; yanlış bir
test güzel bir panelin arkasında fark edilmez.

## Kapsam

### Dahil

Beş test. İstenen üç teste (ANOVA, ki-kare, Mann-Whitney) iki test eklendi,
çünkü çekirdek zaten onlara yönlendiriyor ya da yönlendirecek:

| Test | Neden | Yanında zorunlu dönen |
| --- | --- | --- |
| Tek yönlü ANOVA | İstendi | F, sd₁, sd₂, p, η², ω², grup betimselleri, Levene (mevcut `levene`) |
| ANOVA ikili karşılaştırma (Bonferroni) | ANOVA "fark var" der, "hangi gruplar" demez | Her çift için ortalama farkı, t, p (düzeltilmiş), %95 GA |
| Ki-kare bağımsızlık (r×c) ve uyum iyiliği | İstendi | χ², sd, p, Cramér's V (2×2'de φ), beklenen frekanslar, 2×2'de Yates düzeltmeli değer ayrıca |
| Mann-Whitney U | İstendi; `apa.js:24` buna yönlendiriyor | U, z, p, yöntem (kesin / asimptotik), etki r = z/√N, sıra ortalamaları |
| Wilcoxon işaretli sıralar | `apa.js:24` buna yönlendiriyor | W (T), z, p, yöntem, etki r, sıfır fark sayısı |
| Kruskal-Wallis H | ANOVA'nın normallik tutmazsa önerilecek karşılığı | H (bağ düzeltmeli), sd, p, ε², sıra ortalamaları |

Ortak altyapı: ki-kare dağılımının üst kuyruğu
(`incompleteGammaUpper(sd/2, x/2)`, WO-006'da var), bağ düzeltmeli sıralama
(`correlation.js` › `ranks`, WO-006'da var).

`apa.js` güncellemesi:

- Beş testin APA biçimleyicileri.
- Öneri haritası tek kaynaktan: bağımsız t → Mann-Whitney, eşleştirilmiş t →
  Wilcoxon, ANOVA → Kruskal-Wallis. `normality.js`'teki `alternative` değeri
  bu haritadan okunur. Metin önerisi yalnız var olan teste işaret eder.

### Hariç

- **Arayüz** (WO-007). Prototipteki soru kısayolları ("Üç veya daha fazla
  grubu karşılaştırmak", "Kategoriler arasında ilişki") arayüz iş emrinde.
- **Tukey HSD ve Games-Howell.** Studentized range dağılımının CDF'i gerekir
  (sayısal integral); doğru yazmak ayrı bir iş. Bonferroni SPSS'te de var ve
  mevcut t dağılımıyla yapılabiliyor. Gerekçe çıktıda yazılır: "Bonferroni
  tutucudur; Tukey yakında."
- **Fisher'ın kesin testi.** Ki-kare beklenen frekans kuralı bozulduğunda
  uyarı verilir ("beklenen frekansı 5'ten küçük hücre oranı %20'yi aşıyor;
  sonuç güvenilmez"), Fisher hesaplanmaz. Uyarı Fisher'ı "yakında" diye
  anar, sessizce ki-kare sonucunu vermez.
- **Welch ANOVA.** İş başında SciPy 1.17.1'de karşılığı olup olmadığına
  bakılır. Referans yoksa yazılmaz (doğrulanmamış test yayımlanmaz) ve
  rapora yazılır.
- **İki yönlü / tekrarlı ölçümler ANOVA, ANCOVA.** Ayrı iş.
- Sunucu, yeni bağımlılık: WO-006 ile aynı gerekçe.

Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar

- `client/src/stats/anova.js` (yeni) — tek yönlü ANOVA, Bonferroni ikili karşılaştırma
- `client/src/stats/chisquare.js` (yeni) — bağımsızlık ve uyum iyiliği, ki-kare dağılımı
- `client/src/stats/nonparametric.js` (yeni) — Mann-Whitney, Wilcoxon, Kruskal-Wallis
- `client/src/stats/apa.js` (mevcut) — yalnız ekleme: biçimleyiciler ve öneri haritası. Mevcut fonksiyonların çıktısı değişmez
- `client/src/stats/normality.js` (mevcut) — yalnız `alternative` değerinin öneri haritasından okunması
- `client/tests/stats-v2.test.js` (yeni)
- `client/tests/fixtures/stats-reference-v2.json` (yeni) — referans çıktılar ve üretim betiği

Liste yetersizse iş durur ve sorulur. `stats-reference.json` (v1)
değişmez; v1 testleri aynı kalır.

## Yaklaşım

WO-006'nın yöntemi aynen: kendi kodumuz, SciPy'nin **sayılarına** karşı
çapraz doğrulama, kod alınmaz. Referans SciPy 1.17.1 / NumPy 2.2.6 (bu
makinede kurulu, 16.10.2026'da doğrulandı); R yok.

### SPSS uyumu — hangi varyantı seçiyoruz

Hedef kullanıcı SPSS'ten geliyor ve sonucunu SPSS çıktısıyla karşılaştıracak.
Birden çok doğru varyant olan yerlerde seçim SPSS'e göre yapılır ve çıktıda
alan olarak görünür (WO-006'daki `center: 'mean'` gibi):

| Konu | Seçim | Çıktıdaki alan |
| --- | --- | --- |
| Mann-Whitney p | Bağ yoksa ve her grup ≤ 8 ise kesin; değilse bağ düzeltmeli asimptotik, süreklilik düzeltmesiyle | `method: 'exact' \| 'asymptotic'` |
| Wilcoxon sıfır farklar | Atılır (Wilcoxon yöntemi); atılan sayı raporlanır | `zero_method: 'wilcox'`, `zerosDropped` |
| Ki-kare 2×2 | Pearson (düzeltmesiz) ana sonuç, Yates ayrıca | `yates: {…}` |
| Bonferroni | ANOVA'nın birleşik varyansı (MS_within, sd_within) ile ikili t; p × çift sayısı, 1'de kesilir | `adjustment: 'bonferroni'`, `pooled: true` |
| Kruskal-Wallis | Bağ düzeltmeli H | `tieCorrected: true` |

### Çapraz doğrulama

| Test | SciPy referansı | Tolerans |
| --- | --- | --- |
| ANOVA F, p | `stats.f_oneway` | 1e-9 |
| η², ω² | NumPy ile kareler toplamından | 1e-9 |
| Bonferroni ikili | `stats.t` + NumPy (MS_within) | 1e-9 |
| Ki-kare bağımsızlık | `stats.chi2_contingency(correction=False)` ve `(correction=True)` | 1e-9 |
| Ki-kare uyum iyiliği | `stats.chisquare` | 1e-9 |
| Cramér's V | `stats.contingency.association(method='cramer')` | 1e-9 |
| Mann-Whitney | `stats.mannwhitneyu(method='exact' / 'asymptotic', use_continuity=True)` | 1e-9 |
| Wilcoxon | `stats.wilcoxon(zero_method='wilcox', correction=True, method=...)` | 1e-9 |
| Kruskal-Wallis | `stats.kruskal` | 1e-9 |
| Etki büyüklükleri (r, ε²) | SciPy istatistiğinden NumPy formülüyle | 1e-12 |

Etki büyüklüklerinin doğrulaması WO-006'daki Cronbach alfa gibi zayıftır:
formül hatasını değil, kodlama hatasını yakalar. Bu, test dosyasında ve
raporda yazılır.

**SciPy ile SPSS ayrışırsa:** SciPy'nin varsayılanı SPSS'ten farklı olabilir
(ör. Mann-Whitney'de kesin/asimptotik geçişi). Referans, yukarıdaki seçime
uyan SciPy çağrısıyla üretilir. Uymayan bir seçim bulunursa iş durur ve
sorulur.

Veri kümeleri: her test için en az dört küme — tipik, küçük örneklem, bağlı
değerler, kenar durum (tek grup, sıfır varyans, boş hücre, tüm farkların
sıfır olması).

### Dürüstlük kuralları (WO-006'dan devralınır, genişletilir)

- `p = .000` basılmaz; `p < .001`.
- Etki büyüklüğü olmadan "anlamlı fark" dizesi üretilmez (`significanceSentence` tek kapı).
- ANOVA anlamlıysa ve ikili karşılaştırma istenmediyse cümle "en az bir grup
  farklı" der, hangi grup olduğunu söylemez.
- Ki-kare beklenen frekans kuralı bozulursa sonuç `reliable: false` taşır ve
  APA cümlesi üretilmez, yalnız uyarı.
- Normallik reddi → öneri **yalnız var olan** teste işaret eder (öneri haritası).
- Ki-kare "ilişki var" der, "etki" demez.
- Hesaplanamayan alan `null` + gerekçe.
- Çıktılar `origin: 'computed'` taşır (WO-006 mimari sapması, aynen).

## Kabul kriterleri

- [ ] Beş testin ve Bonferroni ikili karşılaştırmanın her çıktısı
      `stats-reference-v2.json` ile tablodaki tolerans içinde eşleşiyor
- [ ] Her test için en az dört veri kümesi (tipik, küçük, bağlı, kenar)
- [ ] Mann-Whitney ve Wilcoxon'da kesin ve asimptotik yol ayrı ayrı test
      edildi; seçilen yol `method` alanında
- [ ] `apa.js`'teki öneri metni ve `normality.js`'teki `alternative`
      değeri aynı haritadan geliyor; haritadaki her test adı çekirdekte
      çağrılabilir bir fonksiyona karşılık geliyor (teste bağlanmış)
- [ ] Ki-kare'de beklenen frekans kuralı bozulduğunda APA cümlesi
      üretilmiyor (teste bağlanmış)
- [ ] Eksik veri ayıklanıyor ve sayısı raporlanıyor; boş grup, tek grup,
      sıfır varyans, tüm farkları sıfır girdilerde çökme yok, `null` + gerekçe
- [ ] v1 testleri (`tests/stats.test.js`) ve `stats-reference.json`
      değişmedi ve geçiyor; mevcut `apa.js` fonksiyonlarının çıktısı aynı
- [ ] `client/src/stats/` saf kalıyor (ağ, depolama, DOM yok — grep)
- [ ] `npm test` (tüm istemci birim testleri), `npm run lint`,
      `npm run build` geçiyor; e2e etkilenmez (modül çağrılmıyor) ama koşulur
- [ ] Bölüm 3 ihlali yok

Bölüm 4 regresyon seti çalıştırılmaz (WO-006 ile aynı gerekçe: kanıt hattını
ölçüyor, bu modül hesap yapıyor).

## Test planı

| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Başlangıç çizgisi | İşe başlamadan `cd client && npm test`, sayı kaydedilir | Kayıtlı sayı |
| İstatistik v2 | `cd client && npm test` | Yeni testler + başlangıç çizgisinin tamamı geçiyor |
| Referans üretimi | Fixture'ın `_note` alanındaki Python betiği | Aynı JSON yeniden üretilebiliyor |
| Lint / build | `npm run lint`, `npm run build` | Temiz; `index-*.js` %5'ten fazla büyümedi |
| e2e | `npm run test:e2e` | Başlangıçtaki sonuçla aynı |
| Saflık | `grep -rnE "fetch\|axios\|localStorage\|document\.\|window\." client/src/stats/` | Boş |
| Dosya kapsamı | `git status --porcelain` | Yalnız listedeki yollar |

Elle kontrol gerekmiyor: arayüz yok.

## Ölçüm

| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |
| Referansla eşleşen test sayısı (v2) | 0 | 5/5 + Bonferroni |
| Var olmayan teste yönlendiren öneri | 2 (Mann-Whitney, Wilcoxon) | 0 |
| İstemci paket boyutu | Başlangıçta ölçülür | Değişmez (modül çağrılmıyor; ağaç budaması) |

## Geri alma

Yeni dosyalar silinir; `apa.js` ve `normality.js`'teki değişiklik tek
commit'te, `git revert <commit>` ile döner. Kullanıcı yüzeyi yok, bayrak
gerekmiyor. Dal: `wo-015-istatistik-v2`, güncel çalışma dalından açılır.

## Riskler

| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Mann-Whitney / Wilcoxon kesin dağılımı küçük n'de yanlış sayılır | Orta | Yüksek | Kesin yol ayrı veri kümeleriyle SciPy `method='exact'`a karşı test edilir |
| SciPy varsayılanı SPSS seçimimizden farklı | Orta | Orta | Referans seçime uyan çağrıyla üretilir; uymayan durumda iş durur |
| `apa.js` değişikliği v1 çıktısını bozar | Düşük | Yüksek | Yalnız ekleme; v1 testleri değişmeden geçmek zorunda |
| Kapsam kayması: "Tukey'i de ekleyelim" | Yüksek | Orta | Hariç listesinde gerekçesiyle; yeni iş emri |
| Etki büyüklüğü formül hatası doğrulamadan geçer | Düşük | Orta | Formül kaynağı (kitap/makale) test dosyasında yazılır; rapor zayıflığı söyler |

## Onay gereken noktalar

- **Taslak → Hazır** (kullanıcı).
- **Kapsam beş test mi, üç test mi?** İstenen ANOVA, ki-kare ve Mann-Whitney.
  Wilcoxon ve Kruskal-Wallis, çekirdeğin önerilerinin boşa düşmemesi için
  eklendi. Varsayılan: **beş**. Üçe inerse `apa.js:24`'teki Wilcoxon önerisi
  kaldırılmalı, ki o da v1 çıktısını değiştirir.
- **Bonferroni yeterli mi?** Tukey HSD hariç (gerekçe yukarıda). Varsayılan: Bonferroni.
- **Welch ANOVA SciPy'de yoksa:** yazılmaz. Varsayılan: yazılmaz, raporlanır.

## Bitiş raporu

Ajan tarafından doldurulur.
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:** READY / NEEDS ATTENTION / BLOCKED
