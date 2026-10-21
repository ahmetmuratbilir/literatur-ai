# WO-036 — Şekilde kutuları sürükleyerek taşıma (Napkin gibi)

| Alan | Değer |
| --- | --- |
| Durum | Bitti, elle deneme bekliyor (21.10.2026) — kullanıcı: "kutuların konumlarını değiştiremiyor muyuz … başla" |
| Kapsam | İstemci (çiziciler, taslak alanı) |
| Yol haritası aşaması | P3 |
| Dal | `wo-031-tablo-tasarimi` |

## Ne yapıldı
- Büyük düzenleme ekranında kutu tutulup sürüklenir.
  - Oklar ve bağlantı çizgileri kutuyla gider, çünkü çizim yeni konumdan yeniden hesaplanır.
  - Taşınmış kutular arasındaki ok, kutu kenarından kutu kenarına düz çizgiye döner.
  - Alan dışına taşınan kutu için görünüm alanı genişler.
- Dokuz şablon:
  - Akış, döngü, merkez + uydu, geri besleme, etki zinciri: her kutu.
  - Kavram haritası: her kavram.
  - Argüman haritası: iddia, her gerekçe, her itiraz.
  - Ağaç: kök ve dal (dal yapraklarıyla birlikte).
  - Zihin haritası: merkez ve dal (dal alt öğeleriyle birlikte).
- Konumlar şablon başına saklanır (`data.layout[tür]`): şablon değişince bir şablonun kaydırması ötekine geçmez. "Konumları sıfırla" temizler.
- Sürükleme işaretleri (`data-el`) yalnız düzenleme ekranındaki çizimde. Belgeye ve Word'e giden SVG temiz.
- Taşıma yoksa çıktı bayt bayt eskisiyle aynı. İstisna argüman haritası: iddia artık kartların üstünde çiziliyor; görünüş aynı, sıra değişti.

## Testler (21.10.2026)
- Birim:
  - Sıfır ya da boş kaydırmada çıktı aynı.
  - Kutu 80 birim aşağı kayar, iki ok düz çizgi olur.
  - Alan dışına taşınca görünüm büyür.
  - Dokuz şablonda düzenleme çiziminde işaret var, kayıtlı çizimde yok.
  - Başka şablonun kaydırması etkilemez.
- e2e: gerçek fareyle sürükleme → iki ok → Sıfırla → yeniden sürükle → Tamam → kayıtta `layout.steps.i1` → belgede işaret yok → düzenlemeye açınca konum geri gelir.
- Tam kontrol: lint temiz; birim 366/366; e2e 118 geçti, 3 atlandı.

## Bilinen eksikler
- Klavyeyle kutu taşıma yok (yalnız fare/dokunmatik).
- Basamak, yol haritası, liste, piramit, huni, sütun, matris, Venn, balık kılçığı, zaman çizelgeleri ve grafiklerde taşıma yok (düzen kendisi anlam taşıyor).
- Öğe değişirse (satır silinir, eklenir) konumlar sıra numarasına bağlı olduğu için başka kutuya kayabilir; Sıfırla ile düzelir.
- Kutu boyutlandırma yok; yalnız taşıma.

**Durum:** NEEDS ATTENTION — testler geçti; elle deneme bekliyor.
