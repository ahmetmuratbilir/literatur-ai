# WO-XXX — <Kısa başlık>

| Alan | Değer |
| --- | --- |
| Durum | Taslak / Hazır / Çalışıyor / Bitti |
| Kapsam | Salt okunur / Tek dosya / Tek modül / Çapraz |
| Dosya değişikliği | Yasak / İzinli (liste aşağıda) |
| Tahmini süre | |
| Ön koşul | Hangi iş emri bitmeden başlamaz |
| Yol haritası aşaması | P0 / P1 / P2 / P3 / P4 |

## Problem
Ne bozuk veya ne eksik. Denetim raporundan geliyorsa kanıtı (dosya:satır)
buraya kopyala.

## Neden şimdi
Bu iş emri neden bu sırada? Hangi şeyi mümkün kılıyor veya hangi riski
kapatıyor.

## Kapsam
### Dahil
- …
### Hariç
- …
Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar
Bu listede olmayan dosya değiştirilmez. Liste yetersizse iş durur ve sorulur.
- `path/to/file.ts`

## Yaklaşım
Nasıl yapılacağı. Birden fazla yol varsa seçileni ve nedenini yaz; ajanın
kendi başına mimari seçmesi beklenmiyor.

## Kabul kriterleri
Her madde ya geçer ya geçmez — "iyileştirildi" gibi ölçülemez ifade yok.
- [ ] …
- [ ] İlgili testler yazıldı ve geçti
- [ ] Bölüm 4 regresyon seti çalıştırıldı, metrik düşmedi
- [ ] Bölüm 3 ihlali yok

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
Elle kontrol gerekiyorsa adım adım yaz.

## Ölçüm
Etkisi neyle ölçülecek? Ölçülemiyorsa "ölçülmeyecek" yaz ve gerekçesini
belirt — boş bırakma.
| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |

## Geri alma
Bir şey ters giderse nasıl dönülür. Tek commit mi, feature flag mi,
migration geri alınabilir mi.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |

## Onay gereken noktalar
Ajanın durup sorması gereken anlar. Boşsa "yok" yaz.

## Bitiş raporu
Ajan tarafından doldurulur.
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:** READY / NEEDS ATTENTION / BLOCKED
