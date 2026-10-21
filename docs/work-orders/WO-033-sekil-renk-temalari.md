# WO-033 — Şekil ve grafik renk temaları: tablodaki gibi galeri

| Alan | Değer |
| --- | --- |
| Durum | Bitti, elle deneme bekliyor (21.10.2026) — kullanıcı: "şekillere vs de tema istiyorum, renk temaları" |
| Kapsam | İstemci (taslak alanı, belge nesne çubuğu, çizim) |
| Yol haritası aşaması | P3 |
| Dal | `wo-031-tablo-tasarimi` |

## Ne yapıldı
- **Tema galerisi:** Görünüm bölümündeki galeri; 21 tema, üç grup (Renkli / Tek renk / Baskı). Her küçük resim kullanıcının şeklinin o temayla çizilmiş hali, altında temanın dört rol rengi (ayrıntı, veri, vurgu, zemin). ◀ ▶ seçici (Ahmet beğenmişti) yerinde kaldı ve seçili temayı gösterir.
- **"Bütün şekil ve grafiklere uygula":** Seçilen tema "Tamam" ile belgedeki öteki şekillere de uygulanır. Her şekil kendi kayıtlı içeriğinden yeniden çizilir; içerik ve başlık değişmez. Her biri geri alınabilir.
- **Fırça:** Belgedeki şeklin üzerine gelince Düzenle/Sil yanında fırça (Renk teması) çıkar; taslak alanını galeri açık olarak açar.
- Şablon şeridi açılınca seçili şablon görünür yere kayar.
- **Önce gelen düzeltme (`92ef614`):** Dikey zaman çizelgesi taslakta hiç çizilmiyordu (ölü dal). Çizim `visuals/render.js`'e taşındı; taslak ve "bütün şekillere uygula" aynı işlevi kullanır.

## Testler (21.10.2026)
- Birim: 26 türün hepsi taslakta çizilir (`drawMore.test.js`).
- e2e `figure-chart.spec.js`: fırça galeriyi açar, 21 tema, küçük resim SVG, tema seçimi önizlemeye geçer, "bütün şekillere uygula" ikinci şekli aynı temayla ve aynı içerikle yeniden çizer.
- Tam kontrol: lint temiz; istemci birim 362/362; e2e 113 geçti, 3 atlandı.

## Bilinen eksikler
- Belge teması kalıcı bir ayar değil; "uygula" o anki şekilleri boyar, sonra eklenen şekil varsayılanla başlar.
- Tablo temasıyla şekil teması bağlı değil (ayrı galeriler).
- Word'de açılıp bakılmadı (şekiller SVG + PNG olarak gider).

**Durum:** NEEDS ATTENTION — testler geçti; elle deneme bekliyor.
