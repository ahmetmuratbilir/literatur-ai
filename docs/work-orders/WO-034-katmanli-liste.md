# WO-034 — Şekil taslağında katmanlı liste (1 → 1.1 → 1.1.1)

| Alan | Değer |
| --- | --- |
| Durum | Bitti, elle deneme bekliyor (21.10.2026) — kullanıcı: "katman mantığı; 1. öğenin altına 1.1; sayı adedi belli olmasın, 1.10'a kadar uzatsın; minik ekle tuşu; 1.1'in altına 1.1.1; görseller ona göre" |
| Kapsam | İstemci (taslak alanı, çizim) |
| Yol haritası aşaması | P3 |
| Dal | `wo-031-tablo-tasarimi` |

## Ne yapıldı
- Öğe listesinde katman: her satırın bir katmanı var (0–3); numaralar 1, 1.1, 1.1.1, 1.1.1.1.
  - Kök şablonlarında (ağaç, zihin haritası, balık kılçığı) ilk satırın etiketi Kök / Merkez / Sonuç; numara daldan başlar.
  - Minik ↳ "alt öğe ekle" düğmesi satırın üzerine gelince ya da odakta görünür. Kökte yeni dal ekler.
  - İçeri / dışarı: Tab / Shift+Tab. Katman bir öncekinin bir fazlasını geçemez.
  - Katmanlar her şablonda saklanır (`data.levels`); yalnız yapısı olan şablonlarda (ağaç, zihin haritası, balık kılçığı, çok sütun, Venn, matris) gösterilir ve çizilir.
- Sayı sınırı: öğe üst sınırı 10'dan 60'a çıktı. Çizicilerin sessiz kesme sınırları yükseldi: ağaç dal başına 10 yaprak, çok sütun 10 madde, zihin haritası 5, balık kılçığı 5, Venn 5. Aşan alt öğe "N öğe bu şablonda görünmüyor" notunda sayılır; önceden sessizce düşüyordu (2.8).
- Görseller iç içe katmanı çizer:
  - Ağaçta 1.1.1 kartı bir basamak içeride ve açık zeminli.
  - Çok sütunda içi boş halkalı ve içeride.
  - Zihin haritası, balık kılçığı ve Venn'de "– " işaretli ve içeride.
- Eski "Başlık: a, b" yazımı katmansız kayıtlarda aynen çalışır. Dalları köke girintileyen doğal anahat da okunur.

## Testler (21.10.2026)
- Birim: numaralar, katman sınırı, kök kaydırma, iç içe grup, 12 yapraktan 10'u çizilir ve 2'si sayılır, eski yazım.
- e2e: ↳ ile 1.1 ve 1.1.1, Tab/Shift+Tab, kök etiketi, ağaçta ve zihin haritasında iç içe öğe, katmanların kayda yazılması.
- Tam kontrol: lint temiz; birim 363/363; e2e 115 geçti, 3 atlandı.

## Bilinen eksikler
- Akış, döngü, piramit gibi düz şablonlarda katman gösterilmez; alt öğeler orada düz liste olarak çizilir.
- Matriste alt öğeler virgülle tek açıklamada birleşir.
- Satır sürükleyerek yer değiştirme yok.

**Durum:** NEEDS ATTENTION — testler geçti; elle deneme bekliyor.
