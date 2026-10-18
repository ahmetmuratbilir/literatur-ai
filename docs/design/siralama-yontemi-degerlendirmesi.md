# Sıralama yöntemi: AHP yeterli mi, TOPSIS / ELECTRE eklenmeli mi?

18.10.2026 · WO-024 kapsamında istenen değerlendirme · **Karar önerisi, kod değişikliği yok.**

## Bugün ne yapıyoruz (kodda görülen)

`server/services/ahp.js`, `ahpMatrix.js`, `ahpProfiles.js`:

1. **AHP yalnız ağırlıkları üretiyor.** 7 ölçütün ikili karşılaştırma
   matrisinin asal özvektörü; tutarlılık oranı CR = 0.0006. Profiller
   (`ahpProfiles.js`) bu ağırlıkları önceliğe göre değiştiriyor.
2. **Sıralamanın kendisi ağırlıklı toplam (SAW).** Her ölçüt 0–1 arasına
   mutlak bir ölçekle çevriliyor (ör. güncellik: yılda %4 düşer, 25 yılda 0;
   atıf: FWCI'nin logaritması), ağırlıklarla çarpılıp toplanıyor.
3. **Eksik bilgi 0.** Verisi olmayan ölçüt avantaj sağlamıyor (30.09.2026
   kararı).

Yani literatürdeki adıyla yöntem "AHP ağırlıklı SAW". Ürünün vaadi
("her makalenin neden o sırada olduğunu görürsün") tam olarak bu yapıya
dayanıyor: puan = görünür 7 parçanın toplamı.

## TOPSIS ve ELECTRE ne getirir, ne götürür

| | AHP + SAW (bugün) | TOPSIS | ELECTRE (I–IV) |
| --- | --- | --- | --- |
| Çıktı | Tek puan, toplanabilir parçalar | İdeal/anti-ideale göreli yakınlık (0–1) | Üstünlük ilişkisi; çoğu zaman kısmi sıra, tek puan yok |
| Açıklanabilirlik | "7 parçanın toplamı" | "İdeal makaleye uzaklığın …'ü": soyut | Uyum/uyumsuzluk eşikleri: akademisyene bile zor |
| Havuza bağımlılık | Yok: makalenin puanı yalnız kendi verisine bağlı | **Var**: ideal ve anti-ideal havuzdan hesaplanır | Var |
| Sıra tersine dönmesi (rank reversal) | Yok | **Var**: bir makale eklenip çıkınca diğerlerinin sırası değişebilir | Var |
| Ölçek | 1000 makalede anında | Hızlı | Çiftler arası O(n²); büyük havuzda ağır |
| Ayar yükü | Ağırlıklar | Ağırlıklar + normalizasyon | Ağırlıklar + her ölçüt için eşik ve veto değerleri |

Ürün açısından belirleyici olan iki satır:

- **Havuza bağımlılık ve sıra tersine dönmesi.** Kullanıcı filtre değiştirince,
  sepete ekleyip çıkarınca ya da sonraki sayfa yüklenince sıralama
  "kendiliğinden" değişirse güven kaybolur. Bugünkü yapıda bu olmuyor.
- **Açıklanabilirlik.** "Neden bu sırada?" panelinin cevabı SAW'da birebir
  doğru; TOPSIS'te yaklaşık, ELECTRE'de pratikte yok.

CLAUDE.md 2.12'nin dördüncü sorusu ("olmadığında ürün ne kaybeder?") TOPSIS
ve ELECTRE için "pek bir şey" cevabını veriyor. "Üç farklı çok kriterli
yöntem" bir pazarlama maddesi olabilir, ama kullanıcıya savunabileceği bir
şey üretmiyor.

**Öneri: TOPSIS ve ELECTRE ürüne eklenmesin.** Yalnız değerlendirme
kümesinde (Bölüm 4) karşılaştırma için çevrimdışı denenebilir.

## AHP'yi tek başına bırakmak yerine daha değerli üç adım

1. **Duyarlılık göstergesi (en ucuz, en dürüst).** Ağırlıkları ±%20 rastgele
   oynatıp (ör. 500 kez) ilk 10'un ne kadar sabit kaldığını ölç. Kartta
   "bu sıra ağırlıklara duyarsız" ya da "küçük öncelik değişikliği sırayı
   değiştirir" yazsın. Sıralamanın ne kadar güvenilir olduğunu gösterir, kalite
   iddiası taşımaz (2.6 ve 2.8 ile uyumlu). Sunucuda birkaç milisaniye.
2. **Kullanıcının ağırlık vermesi için AHP yerine BWM (Best-Worst Method)
   ya da sıralama tabanlı ağırlık.** 2.6 "kriterlerin kullanıcıya açılması
   planlanıyor" diyor. 7 ölçüt için AHP 21 ikili karşılaştırma ister;
   kullanıcı bunu yapmaz. BWM (Rezaei, 2015) yalnız 2n−3 = 11 karşılaştırmayla,
   daha tutarlı ağırlık verir. Daha da basiti: kullanıcı ölçütleri sürükleyip
   sıralar, ağırlıklar ROC formülüyle hesaplanır. Arka uçta yine aynı SAW.
3. **Ölçüt bağımsızlığını gözden geçir.** AHP ölçütlerin birbirinden bağımsız
   olduğunu varsayar. "Anahtar kelime uygunluğu" ile "genişletilmiş sorgu
   benzerliği" ikisi de konu uygunluğunu ölçüyor (toplam ~%31); "atıf etkisi"
   ile "yayın kalitesi" de birbiriyle ilişkili. Çift sayım, konu uygunluğunu
   fiilen daha ağır yapıyor olabilir. Değerlendirme kümesinde iki ölçütü
   birleştirip NDCG@10 farkına bakılmalı.

Her üçü de Bölüm 4'ün değerlendirme protokolüyle ölçülmeden canlıya çıkmaz.
CLAUDE.md 2.6'nın ikinci sınırı hâlâ geçerli: mevcut AHP uygulamasının
gerçek aramalarda doğru çalıştığı bu değerlendirmede **doğrulanmadı**;
yalnız kod okundu.
