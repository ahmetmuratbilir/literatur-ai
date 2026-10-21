# WO-032 — Şekil ve grafik şablonları: galerinin tamamı + şablon şeridi

| Alan | Değer |
| --- | --- |
| Durum | Bitti, elle deneme bekliyor (21.10.2026) — kullanıcı: "şekilleri ve grafikleri ekle", galeriden "Hepsi (18 yeni)". Galerideki 24 şablonun 4'ü zaten vardı; gerçek sayı 20 |
| Kapsam | İstemci (çizici, taslak alanı) |
| Yol haritası aşaması | P3 |
| Dal | `wo-031-tablo-tasarimi` (WO-031'in ardından aynı dal) |
| Kaynak | `docs/design/mockup-sekil-galerisi.html` (24 şablon), `docs/design/tema-ve-tablo-tasarimi.md` §5 |

## Ne yapıldı
- `client/src/visuals/drawMore.js`: galerinin bizde olmayan 20 şablonu.
  - Sıra: Basamak, Yol haritası, Numaralı liste.
  - Döngü: Merkez + uydu, Geri besleme (R/B döngü türüyle).
  - Neden: Etki zinciri (+/−), Balık kılçığı.
  - Yapı: Ağaç, Zihin haritası, Piramit, Huni (PRISMA; ardışık fark).
  - Karşılaştırma: Çok sütun, Dörtlü matris, Venn (2–3).
  - İlişki: Kavram haritası (en çok bağlı kavram vurgulu), Argüman haritası (+ gerekçe / − itiraz).
  - Zaman: Dikey zaman.
  - Grafik: Yatay çubuk, Yüzde halkası, Sayı kartları.
- Bütün şablonlar rol tabanlı paletleri kullanır: ayrıntı, veri, vurgu, zemin. Hepsine 21 palet, köşe ve yazı boyutu uygulanır. Desen yalnız dolgulu çubuk ve kutu şablonlarında: Akış, Döngü, İki sütun, Çubuk, Basamak, Merkez + uydu, Piramit, Huni, Yatay çubuk, Yüzde halkası (`PATTERN_TYPES`). Numaralı liste, çok sütun, matris ve sayı kartlarında desen yok; seçici orada pasif.
- Taslak alanı:
  - Şablon şeridi ailelere ayrıldı ve yatay kayar.
  - Liste tabanlı bütün şablonlar aynı `items` verisini kullanır; şablon değişince içerik korunur (SmartArt "Düzeni değiştir").
  - Şablona sığmayan öğe silinmez, "N öğe bu şablonda görünmüyor" diye söylenir (2.8).
  - Sözdizimli şablonlarda ipucu ve örnek yer tutucu gösterilir.
  - Öğe sınırı 8'den 10'a çıktı.
- Sayılar yalnız kullanıcıdan gelir:
  - Hesaplanan tek şey huni farkı ve halka payları.
  - Sayı kartı, yazılan sayıyı olduğu gibi gösterir (2019 → "2.019" olmaz).
  - Yüzde işareti Türkçedeki gibi başa gelir ("%42").

## Testler (21.10.2026)
- `client/tests/drawMore.test.js` 6/6: her şablon iyi biçimli SVG, kaçışlama, sığmayan sayımı, sözdizimi, döngü türü, sayılar.
- `figure-chart.spec.js` yeni test: şablon değişince içerik korunur, sığmayan notu, ipucu, belgeye ekleme, yeni grafikler.
- Tam kontrol: lint temiz; istemci birim 361/361; e2e 112 geçti, 3 atlandı.

## Bilinen eksikler
- Şablon önizlemeleri (şeritte içerikle çizilmiş küçük resimler) yok; şerit metin düğmeleri.
- Kavram haritası düğümleri çember üzerinde; çok bağlantıda çizgiler kesişebilir (yerleşim algoritması yok).
- Şablonlarda simge yok (galerideki simge seçeneği alınmadı).
- Word'de açılıp bakılmadı; şekiller WO-028 yoluyla SVG + PNG olarak gider.

**Durum:** NEEDS ATTENTION — testler geçti; elle deneme bekliyor.
