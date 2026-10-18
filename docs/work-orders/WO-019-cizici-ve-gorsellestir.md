# WO-019 — Görsel paneli: tablo, şekil, grafik; düzenle, seçili paragrafın altına ekle

| Alan | Değer |
| --- | --- |
| Durum | Taslak (18.10.2026) — kapsam kullanıcı kararıyla genişletildi; Hazır'a geçişi kullanıcı onaylar |
| Kapsam | Çapraz: saf modüller + yazım yüzeyi + sağ panel |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 4–5 oturum (faz başına bir oturum) |
| Ön koşul | WO-016 bitti; WO-017/018 bitti (tek panel, katman yığını); Faz 3 için galeri kararları |
| Yol haritası aşaması | P3 |
| Dal | `wo-019-gorsel-paneli`, `design/marka-panel-denetimi` ucundan |
| Kaynak | Kullanıcı kararı 18.10.2026 (aşağıda). Eski kapsam: planlardaki WO-D (çizici). Grafik kısmı planlardaki WO-B'nin ilk parçası. `docs/design/gorsellestirme-plani.md` §5–§6; galeri `docs/design/mockup-sekil-galerisi.html` |

## Kullanıcı kararı (18.10.2026)
- Tablolar ve grafikler de şekiller gibi küçük bir panelde açılıp
  düzenlenmeli ve istenen yere eklenmeli.
- Yapay zekâ kullanılmıyorsa kullanıcı elle doldurur. Kod (ya da ileride
  model) doldurduysa panelde Napkin gibi düzenlenebilir.
- Seçili metnin olduğu yere eklenir.
- recharts bağımlılığı kalır (grafikler için).
- Ayrı "AI Yazar" düğmesi yok; her şey tek panelde.

Bu iş emri kararı aşağıdaki dört düzeltmeyle uygular. Her birinin
gerekçesi yanında.

| Karar | Uygulama | Gerekçe |
| --- | --- | --- |
| "Küçük bir panel" | Üç ayrı pencere yerine sağ araç panelinde tek **Görsel** paneli, içinde Tablo · Şekil · Grafik sekmeleri | Tek panel kararı (WO-017); tüzük 2.9 "diyagram sağ panelde durur"; belge açık kaldığı için kullanıcı nereye gireceğini görür |
| "Seçili metnin altına" | Seçimin bulunduğu **üst düzey bloğun (paragrafın) altına** | Paragraf ortasına giren tablo paragrafı böler. Akademik metinde tablo ve şekil kendi numaralı başlığı olan ayrı bloktur. Bugünkü `topBlock` + `insertCaption` bu davranışı zaten yapıyor (`Workspace.jsx:139`, `:1675`) |
| "Panelde düzenlensin" | Panel, belgedeki görselin tek düzenleme yeridir; belgede tıklayınca panel o görselle açılır | Düzenleme iki yerde olursa (belge içi + panel) durum ikiye bölünür; kaynak cümle bağı panelde tutulur |
| "Kod ya da model doldurursa" | Bu iş emrinde yalnız **kod** doldurur. Model önerisi kapsam dışı (aşağıda) | Model doldurursa yeni prompt, PR kimliği, şema, enjeksiyon testi (3.4, 3.8) ve ölçüm kümesi gerekir (4.1). Ayrı iş emrine ait |

## Problem
- Belgeye tablo eklemenin yolu yok. "Ekle" menüsü yalnız "Tablo N." /
  "Şekil N:" başlık paragrafı ekliyor (`Workspace.jsx:1675-1696`), tablonun
  kendisini değil. Oysa DOCX çıktısı üst düzey `<table>`'ı gerçek Word
  tablosuna zaten çeviriyor (`exportDocument.js:71-95`).
- WO-016 paragraftan yapı ve şablon ailesi çıkarıyor (`client/src/visuals/`),
  ama arayüze bağlı değil.
- `recharts` `package.json:30`'da var ama hiçbir dosyada kullanılmıyor.
- İstatistik çekirdeği (`client/src/stats/`, WO-006/009) arayüze bağlı değil
  (WO-007 yazılmadı).

## Neden şimdi
Tez ve makale yazan kullanıcı için tablo ve şekil bir bölümün olmazsa
olmazıdır. Ürün bugün kullanıcıyı bunun için Word'e geri gönderiyor. WO-008
(şekilleri Word/PDF'e gömme) dışa aktaracak şekil olmadan anlamsız; bu iş
emri ondan önce gelir (yol haritası kararı 17.10.2026).

## Kapsam

Faz başına bir commit; her faz kendi başına kullanılabilir bir sonuç bırakır.
Sıra: en çok kullanılacak ve en az riskli olan önce.

### Faz 1 — Panel ve elle tablo
- **Görsel paneli** (`VisualPanel.jsx`): sağ araç panelinde açılır. Tablo
  sekmesi bu fazda çalışır; Şekil ve Grafik sekmeleri faz gelene kadar
  görünmez (yarım özellik gösterilmez).
- **Açılış**: Ekle menüsünde "Tablo…" ve paragraf kenarındaki ✦ düğmesi.
  Açılırken hedef blok kaydedilir (seçimin `topBlock`'u; seçim yoksa son imleç
  yeri; o da yoksa belge sonu). Panelde "Eklenecek yer: 3. paragrafın altı"
  satırı görünür, belgede o paragraf hafifçe vurgulanır.
- **Tablo düzenleyici** (Napkin hissi, hepsi klavyeyle de yapılır):
  hücreye tıkla-yaz; Tab / Shift+Tab / Enter ile gezinme; satır ve sütun
  ekle/sil/taşı; ilk satır başlık aç/kapat; hücre hizası; Excel/Sheets/Word'den
  yapıştırma (TSV ve HTML tablo) — yapıştırılan veri ızgaraya dağılır.
  Boyut sınırı: 30 sütun × 200 satır (aşılırsa ne kadarının alınmadığı söylenir, 2.8).
- **Başlık**: "Tablo N." numarası otomatik, sıra belgedeki konuma göre
  (`captionOf`). Kullanıcı başlık metnini panelde yazar. Tablo başlığı
  tablonun üstünde (APA 7 ve yaygın tez kılavuzları; format seçimine göre
  yer değiştirme bu iş emrinde yok).
- **Belgeye ekle** (2.9): yalnız düğmeyle. Belgeye üst düzey `<p>` başlık +
  `<table data-visual-id data-visual-kind="table">` olarak girer. Bu biçim
  bilinçli: mevcut DOCX çevirici hiç değişmeden gerçek Word tablosu üretir,
  taslak kaydı (`serialize`, `Workspace.jsx:128`) `data-*` alanlarını olduğu
  gibi saklar — yeni depolama yok.
- **Yeniden düzenle**: belgedeki tabloya tıklayınca panel o tabloyla açılır;
  "Güncelle" belgede yerinde değiştirir. Belgede doğrudan hücre yazımı da
  açık kalır (contentEditable zaten izin veriyor); panel açılırken belgedeki
  güncel hâli okur, böylece iki yol çakışmaz.
- **Kaldır**: geri alınabilir (WO-018 geri al bildirimi). Başlık paragrafı da
  birlikte gider.

### Faz 2 — Sepetten karşılaştırma tablosu
Akademisyen için en değerli tablo: seçili makalelerin yan yana karşılaştırması.
- Tablo sekmesinde "Sepetten başlat": kullanıcı sütunları seçer.
- **Koddan dolan sütunlar** (yalnız doğrulanmış kayıttan, kural 3.1): Kaynak
  (metin içi atıf, `citation.js` ile), Yıl, Dergi, Atıf sayısı, Açık erişim.
  Değeri olmayan hücre "—" ve gri; tahminle doldurulmaz (2.8, 3.6).
- **Kullanıcının dolduracağı sütunlar**: Yöntem, Örneklem, Bulgu, Sınırlılık.
  Boş gelir. Hücreye odaklanınca panelde o makalenin özeti açılır ve "Özet
  — tam metin değil" etiketi görünür (2.8), kullanıcı oradan okuyup yazar.
- Bu hücrelere model yazmaz (aşağıda Hariç). Koddan gelen hücre kullanıcı
  düzenleyince "elle değiştirildi" işareti alır; atıf sütunu düzenlenemez,
  çünkü belgede kaynakçaya bağlıdır.

### Faz 3 — Şekiller (eski WO-019 kapsamı)
- **Çizici** (`client/src/visuals/render/`): galeride "Kalsın" alan şablonlar.
  Saf: `render(structure, template, options) → { svg, width, height }`. Girdi
  WO-016 yapısı (`visual-structure/1`).
- Şekil sekmesi: aile önerisi (`fitTemplates`) ve her önerinin altında tek
  satır gerekçe; uymayanlar katlanır listede nedeniyle (`unfit.*`).
- **Elle kur**: kural kademesi yapı çıkaramazsa paragrafta metin seçerek öğe
  eklenir (seçim = düğüm, etiket cümleye bağlı); ok etiketi seçimle ya da
  yazarak. Profilde sinyal varsa (`cycle`, `cause` …) o aile üstte önerilir ve
  "kural kademesi bu paragraftan yapı çıkaramadı" denir (2.8). Model yok.
- **Düzenleme**: etiket, öğe ekle/çıkar, sıra, tema (renkli/sade), simge.
- **Etiketten cümleye**: şekildeki etikete tıklayınca kaynak cümle vurgulanır.
- **Kaynak değişti**: `checkSource` sonucu yalnız şekle odaklanınca görünür;
  `changed` / `missing` için "Yeniden oluştur / Olduğu gibi bırak".
- Belgede `<figure data-visual-id data-visual-kind="figure" data-visual-state>`
  + SVG; başlık "Şekil N:".
- **İndir**: SVG ve PNG (2×).

### Faz 4 — Grafikler (recharts)
- Türler: çubuk, gruplu çubuk, çizgi, dağılım, hata çubuklu ortalama.
  Pasta yok: kategori karşılaştırmasında okunurluğu düşük, akademik
  kılavuzlar genelde önermez.
- **Veri nereden gelir — model asla üretmez**:
  1. Görsel panelindeki bir tablodan ("Bu tablodan grafik"): sayısal sütunlar
     otomatik bulunur, kullanıcı X ve Y'yi seçer. Tablo ve grafik aynı veriye
     bağlı kalır (`data-visual-source`).
  2. Paragraftaki sayılardan: WO-016 R6 kuralı sayı ve birimi zaten çıkarıyor
     (`visuals/rules.js:251-274`). Kullanıcıya önce tablo olarak gösterilir,
     onaylarsa grafik olur. Her değerin altında "n. cümle" notu durur.
  3. Elle: grafik sekmesinde mini tablo.
- Eksen başlığı ve birim zorunlu alan; boşsa "Belgeye ekle" pasif ve nedeni
  yazar.
- Belgeye SVG olarak girer (`<figure data-visual-kind="chart">`), veri ve
  ayar `data-visual-state`'te saklanır, "Şekil N:" numarası şekillerle ortak.
- recharts yalnız Grafik sekmesi açılınca yüklenir (dinamik `import`); ilk
  açılış paketine girmez.

### Hariç
- **Hücreye ya da grafiğe model önerisi.** Ayrı iş emri: yeni prompt (PR
  kimliği, 3.4), katı şema, enjeksiyon testi (3.8), "model önerisi · özetten"
  işareti ve kullanıcı onayı, ölçüm kümesi. O gelene kadar model yolu yok.
- Word/PDF'e şekil ve grafik gömme (WO-008). DOCX'te şekil/grafik yerinde
  "[Şekil N — dışa aktarma WO-008 ile gelecek]" yer tutucusu çıkar; sessizce
  kaybolmaz (2.8). **Tablolar bu iş emrinde gerçek Word tablosu olarak çıkar.**
- İstatistik çıktısından grafik/tablo (WO-007 bağlantısı yazılınca).
- Model kademesi PR6.v2 (WO-022).
- Hücre birleştirme, iç içe tablo, formül.

Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar
- `client/src/visuals/table.js` (yeni; saf: ızgara işlemleri, TSV/HTML yapıştırma ayrıştırma, `<table>` üretimi, sayısal sütun tespiti)
- `client/src/visuals/basketTable.js` (yeni; saf: sepet kayıtlarından satırlar, yalnız doğrulanmış alanlar)
- `client/src/visuals/chart.js` (yeni; saf: tablo/R6 çıktısından grafik verisi, doğrulama)
- `client/src/visuals/render/*` (yeni; Faz 3 çizici: `text.js`, `theme.js`, `icons.js`, şablon başına dosya, `index.js`)
- `client/src/visuals/icons.json`, `client/scripts/extract-icons.mjs` (yeni; Faz 3)
- `client/src/components/workspace/VisualPanel.jsx`, `TableEditor.jsx`, `FigureEditor.jsx`, `ChartEditor.jsx` (yeni)
- `client/src/components/workspace/Workspace.jsx` (Ekle menüsü, ✦, hedef blok, belgedeki görsele tıklama, panel bağlantısı)
- `client/src/components/workspace/exportDocument.js` (tablo başlığı sırası; şekil/grafik yer tutucusu)
- `client/src/styles/workspace.css`
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`
- `client/tests/table.test.js`, `basketTable.test.js`, `chart.test.js`, `render.test.js` (yeni); `client/tests/visuals.test.js` (yalnız ekleme)
- `client/e2e/visual-panel.spec.js` (yeni)
- `client/scripts/kontrol.mjs` (yalnız yeni e2e dosyasını listeye ekleme)
- `CLAUDE.md` (yalnız 3.12 bayrak tablosuna `VISUALS_ENABLED` satırı), `docs/work-orders/README.md`, `docs/design/yol-haritasi.md`, bu dosya

`package.json` değişmez: recharts zaten var, yeni bağımlılık yok.

## Yaklaşım
- **Saf çekirdek, ince arayüz.** Izgara, yapıştırma ayrıştırma, sepet
  satırları, grafik verisi ve çizici DOM'suz modüller; birim testle sınanır.
  Bileşenler yalnız bunları çağırır.
- **Belgedeki görsel tek kaynak.** Durum belgedeki düğümün `data-visual-state`
  alanında; panel açılınca oradan okur, "Güncelle" ile oraya yazar. Ayrı bir
  görsel deposu yok, taslak kaydı değişmez.
- **Tek kimlik.** `data-visual-id` (rastgele, belge içinde benzersiz); başlık
  numarası her değişiklikte belgedeki sıraya göre yeniden hesaplanır.
- **S1 ölçütleri şekil ve grafikte baştan:** `foreignObject` yok, metin
  `<text>`/`<tspan>`, dış istek yok. recharts'ın `Legend` ve `Tooltip`
  bileşenleri HTML üretir; belgeye giren SVG'de kullanılmaz, gösterge SVG
  olarak çizilir. Böylece WO-008 yalnız gömme işi kalır.
- **Erişilebilirlik:** tablo `<th scope>` ile; şekil ve grafik SVG'sinde
  `role="img"` ve başlıktan `aria-label`.

## Kabul kriterleri
Faz 1
- [ ] Ekle › Tablo… ve ✦ paneli açar; panel hedef paragrafı adıyla gösterir ve belgede vurgular.
- [ ] Excel'den kopyalanan 4×3 aralık ve Word'den kopyalanan tablo ızgaraya doğru dağılıyor (birim + e2e).
- [ ] Tablo yalnız "Belgeye ekle" ile, seçili paragrafın altına, üstünde "Tablo N." başlığıyla giriyor (e2e).
- [ ] Sayfa yenilenince tablo ve başlık yerinde; tabloya tıklayınca panel aynı içerikle açılıyor (e2e).
- [ ] Araya ikinci tablo eklenince numaralar belgedeki sıraya göre güncelleniyor (e2e).
- [ ] DOCX'te gerçek Word tablosu, başlık üstte (e2e: dosyayı aç, `w:tbl` var).
- [ ] Kaldır geri alınabiliyor.

Faz 2
- [ ] Kaynak, Yıl, Dergi hücreleri yalnız sepet kaydından; eksik alan "—", tahmin yok (birim test: alanı boş kayıt).
- [ ] Yöntem/Bulgu hücreleri boş geliyor; hücrede özet "tam metin değil" etiketiyle görünüyor.
- [ ] Atıf sütunu düzenlenemiyor; düzenlenen kod hücresi işaret alıyor.

Faz 3
- [ ] Galeride "Kalsın" alan her şablon 3/5/8 öğeyle iki temada çiziliyor; öz-denetim 0 sorun (e2e).
- [ ] "İlişkilendirilmesi" gibi uzun Türkçe kelime bölünmüyor (birim test).
- [ ] Paragraf değişince uyarı yazarken görünmüyor; şekle odaklanınca `changed` için iki seçenek çıkıyor (e2e).

Faz 4
- [ ] Tablodan grafik: sayısal olmayan sütun Y'ye seçilemiyor; tablo değişince bağlı grafik "veri değişti — güncelle" diyor.
- [ ] R6'dan grafik: her değer kaynak cümlesine bağlı; kullanıcı onayı olmadan grafik oluşmuyor.
- [ ] Eksen başlığı boşken ekleme pasif ve nedeni yazıyor.
- [ ] Belgedeki grafik SVG'sinde `foreignObject` yok; ağ kaydında dış istek 0 (e2e).
- [ ] recharts ilk açılış paketinde yok (build çıktısında ayrı parça).

Hepsi
- [ ] İstemci birim, lint, build, önceki e2e geçiyor (`npm run kontrol`); paket boyutu farkı raporlandı.
- [ ] Bölüm 3 ihlali yok; hiçbir görselde modelden gelen metin ya da sayı yok.
- [ ] Ahmet her fazı yerelde kendi metniyle elle denedi.

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Saf modüller | `npm test` (`table`, `basketTable`, `chart`, `render`) | Izgara işlemleri, yapıştırma, eksik alan "—", satır kırma |
| Akış | `npx playwright test visual-panel.spec.js` | Aç → doldur → ekle → yenile → düzenle → kaldır → geri al |
| DOCX | aynı dosya; indirilen dosya açılır | Tablo `w:tbl`, başlık üstte; şekil yerinde yer tutucu |
| Şablon öz-denetimi | aynı dosya | Her şablon × 3/5/8 × 2 tema: 0 sorun |
| Elle (Faz 1) | Excel'den bir aralık yapıştır, başlık yaz, 2. paragrafı seçip ekle, Word'e aktar | Tablo 2. paragrafın altında; Word'de düzenlenebilir tablo |
| Elle (Faz 2) | Sepette 4 makaleyle karşılaştırma tablosu | Yazar/yıl doğru, boşlar "—" |
| Elle (Faz 4) | Faz 1 tablosundan çubuk grafik | Değerler tabloyla aynı |

## Ölçüm
| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |
| İlk açılış paket boyutu | build'de ölçülür | Faz 4 sonrası en çok +5 KB (recharts ayrı parçada) |
| Şablon öz-denetim sorunu | — | 0 |
| Görsel yapının doğruluğu (E5) | ölçülmedi | ölçülmedi — E5 etiketlenmedi (4.1) |

## Geri alma
Faz başına commit; `git revert <commit>` ile faz faz dönülür. Panel ve ✦,
`VISUALS_ENABLED` istemci bayrağının arkasında (CLAUDE.md 3.12'ye eklenir;
öneri: dalda `true`, main'e alınırken kullanıcı kararı). Bayrak kapalıyken
belgedeki tablolar normal tablo olarak kalır, şekil ve grafikler salt okunur
SVG olarak görünür; hiçbiri silinmez.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Tarayıcı deposu dolar (taslaklar `localStorage`'da, SVG büyük) | Orta | Kayıt başarısız | Kayıt hatası bugün zaten "failed" durumu gösteriyor; SVG yerine durumdan yeniden çizim seçeneği Faz 3'te değerlendirilir, boyut raporlanır |
| Belgede elle hücre yazımı ile panel durumu ayrışır | Orta | Eski veri | Panel açılırken belgedeki tablodan okur; durum alanı tabloda tutulmaz, tablo HTML'inin kendisi durumdur |
| recharts SVG'si WO-008 ölçütlerine uymaz | Orta | Dışa aktarmada bozulma | HTML üreten bileşenler kullanılmaz; e2e `foreignObject` denetimi |
| Kural kademesi az paragraf yakalar, ✦ çoğu yerde boş öneri verir | **Ölçüldü: yüksek** (aşağıda) | Hayal kırıklığı | ✦ boşta da Tablo ve Elle kur sunar; şekil önerisi yalnız bir seçenek |
| WO-008'de gömülü yazı tipiyle genişlik değişir | Orta | Taşma | Ölçücü enjekte; WO-008 aynı öz-denetimi gömülü yazı tipiyle koşar |

**Bulgu (17.10.2026, `structureFromRules` çalıştırılarak):** v2 prototipinin
üç paragrafından yalnız biri kural kademesinde yapı verdi (KMR güvenliği →
R5, `arguman`). Pasif soğutma (`cycle: 1`) ve akış kararsızlığı (`cause: 1`)
→ kural yok. Gerçek paragrafların çoğunda şekil yapısı elle ya da modelle
(WO-022) kurulacak.

## Onay gereken noktalar
- Bu iş emrinin Hazır'a geçişi.
- Faz 3 öncesi galeri kararları (hangi şablonlar girer).
- `VISUALS_ENABLED` varsayılanı.
- Hücreye model önerisi iş emri — yazılıp yazılmayacağı.

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
