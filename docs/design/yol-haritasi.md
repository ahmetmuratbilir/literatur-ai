# Yol haritası: tasarımdan uygulamaya, her adımda görünür sonuç

**Durum:** plan (17.10.2026). Bağlayıcı değil; her adım kendi iş emriyle
uygulanır, iş emri Hazır'a kullanıcı onayıyla geçer.

**Neden bu belge:** kullanıcı uygulamayı açtığında son günlerin işinin
neredeyse hiçbirini göremedi (17.10.2026). Sebep:

| Yapılan | Nerede | Uygulamada görünür mü |
| --- | --- | --- |
| WO-011 yazar modu, Kontrol, Teslime hazırla | Kod (`wo-011-yazar-modu`) | **Evet** |
| WO-016 görsel yapı çekirdeği | Kod, arayüze bağlı değil (bilinçli) | Hayır |
| Tek panel, araştırma ilk sırada, köprü kartları, Görselleştir, düzenlenebilir şekiller, kenar şeridi, ilk açılış | Yalnız prototip (`docs/design/mockup-yazim-alani-v2.html`) | Hayır |
| WO-008 (Word/PDF'e şekil) | Taslak | Hayır |

Prototipteki 9 şablonun asıl kusuru: **sabit sayıda düğüm için elle
yerleştirildiler** (döngü tam 4, hiyerarşi tam 4 çocuk, akış tam 4). Gerçek
paragrafta 3 ya da 7 öğe olunca dağılırlar. Görünümleri de kutu–ok
düzeyinde: simge yok, vurgu yok, tek tip.

Bu plan iki şeyi düzeltir: **(1)** her adımın sonunda kullanıcı uygulamada
yeni bir şey görür; **(2)** şekiller koda geçmeden önce kalite onayı alır.

---

## 1. İlke: önce görüntü onayı, sonra kod

Şekil şablonları için sıra:

1. **Galeri prototipi** — her şablonun 3, 5 ve 8 öğeli hali, Türkçe uzun
   etiketlerle, iki temada; tek HTML sayfa. Kullanıcı "bu iyi / bu kötü"
   der.
2. Onaylanan şablon **veri güdümlü çiziciye** (WO-D) geçer: öğe sayısı ne
   olursa olsun yerleşim hesaplanır.
3. Çizici yazım alanına bağlanır, kullanıcı kendi paragrafında görür.

Kod, onaylanmamış bir görüntüye yazılmaz.

---

## 2. Adımlar

Her satırın "Görürsün" sütunu, adım bitince uygulamada (ya da galeri
sayfasında) neyin değiştiğini söyler.

| # | Adım | İş emri | Görürsün | Ön koşul | Boyut |
| --- | --- | --- | --- | --- | --- |
| 0 | **WO-011 kontrolü** (kullanıcı) | WO-011 | — (kontrol listesi) | — | Kullanıcı |
| 1 | **Şekil galerisi v3** (prototip) | yok, tasarım | ~18 şablonun her biri 3/5/8 öğeyle, simgeli, iki temada; kalite onayı | — | 1 oturum |
| 2 | **Tek panel kabuk** | yeni (WO-017) | Sol rayda ilk sırada Araştırma; yazım bölümleri aynı kabukta; ayrı "yazar modu dünyası" yok; kenar şeridi; ilk açılış hali | 0 (WO-011 onayı) | 2 oturum |
| 3 | **Etkileşim altyapısı** | yeni (WO-E1) | Tek tip pencere (odak içinde kalır, Esc), "Geri al" bildirimi, tarayıcının onay kutuları gider | 2 | 1–2 oturum |
| 4 | **Çizici + Görselleştir** | WO-D | Paragrafın yanında ✦; kural kademesinden (WO-016) gelen yapılarla galerideki şablonlar; etiket düzenleme; belgeye ekle / düzenle / kaldır; "kaynak değişti" yalnız bakınca | 1 onayı, 2, WO-016 | 2–3 oturum |
| 5 | **Word/PDF'e şekil** | WO-008 | Belgedeki şekiller Word ve PDF'te; elle doğrulama: Ahmet | 4 (şekil olmadan dışa aktarılacak şey yok) | 2 oturum |
| 6 | **Araştırmadan yazıma köprü** | yeni | Yaz'da iddia seçince "son aramandan ilgili olabilir" kartları; "doğrulanmadı" atıf, Kontrol'de | 2 | 1–2 oturum |
| 7 | **Bekleme, hata, kart durumları** | WO-E2 | Arama sırasında sahte aşama metni yerine dürüst bekleme; hata türlerine göre mesaj | 3 | 2 oturum |
| 8 | **Model kademesi** | WO-C (PR6.v2) + E5 | Serbest düzyazıdan da şema (kural kademesinin yakalamadığı paragraflar) | 4, E5 etiketlendi | 2 oturum + etiketleme |
| 9 | **Veriden görseller** | WO-B | Sepetin yayın yılı çizelgesi, PRISMA akışı | 4, 5 | 1–2 oturum |
| 10 | **Analiz arayüzü** + çekirdek v2 | WO-007 + WO-015 | Analiz istasyonu: veri yapıştır, test seç, APA tablosu belgeye; ANOVA, ki-kare, Mann-Whitney | 4, 5 | 3 oturum |

**Durum (17.10.2026):** adım 1 yapıldı —
`docs/design/mockup-sekil-galerisi.html`, 24 şablon, her biri 3/5/8 öğeyle
(Venn 2–3, çok sütunlu tablo 2–4). Sayfa her şekli kendisi denetler (yazı
taşması, yazı çakışması, kutudan taşma, çizimin şekil dışına çıkması);
iki tema × simge açık/kapalı: 0 sorun, dış istek 0. Kullanıcı kararları
(Kalsın / Düzelt / At) bekleniyor. Adım 2 ve sonrası adım 0'ı (WO-011
kontrolü) bekliyor.

**Sıra değişikliği önerisi:** daha önce WO-008, WO-D'den önce gelecekti.
Bu planda **WO-D (4) önce, WO-008 (5) sonra**: uygulamada henüz hiç şekil
yok; WO-008 önce gelirse yalnız test için yerleştirilmiş şekilleri dışa
aktarır ve kullanıcı yine bir şey görmez. WO-008'in kararları (foreignObject
yasağı, gömülü yazı tipiyle ölçüm, satır kırma) **WO-D'nin kabul ölçütüne
taşınır**; böylece çizici baştan dışa aktarılabilir SVG üretir ve WO-008
yalnız gömme işi kalır. **Kullanıcı kararı gerekir.**

**Kabuk değişikliği uyarısı:** adım 2, WO-011'in "yazar modu tam ekran ayrı
dünya" kararını değiştirir (kullanıcı kararı 16.10.2026: tek panel,
araştırma ilk sırada). WO-011'in içeriği (belge, Kontrol, Teslim) korunur;
değişen yalnız kabuk ve gezinme. Bu yüzden WO-011 kontrolü önce bitmeli:
kabuk değişince eski kabukta yapılan kontrol tekrarlanmaz.

---

## 3. Şekil galerisi v3: kalite çıtası

### 3.1 Şablon listesi (≈18)

Galeri, `docs/design/gorsellestirme-plani.md` §2'deki metin türlerine ve
Infographic'in yapı türlerine (S1 incelemesi, fikir olarak) dayanır.

| Aile | Şablonlar | Öğe sayısı |
| --- | --- | --- |
| Sıra | Yatay adımlar · Basamak (yükselen) · Dikey yol haritası · Numaralı liste kartları | 2–8 |
| Döngü | Dairesel döngü · Merkez + uydu (hub) | 3–8 |
| Neden | Balık kılçığı · Etki zinciri (ok etiketli akış) · Geri besleme (+/−) | 2–8 neden |
| Yapı | Ağaç (yukarıdan aşağı) · Zihin haritası (merkezden) · Piramit · Huni (PRISMA) | 3–9 |
| Karşılaştırma | İki sütun (A / B) · Çok sütunlu karşılaştırma · Dörtlü matris · Venn (2–3) | 2–4 taraf |
| İlişki | Kavram haritası (etiketli oklar) · Argüman haritası (iddia / önerme / sınırlılık, atıf durumu) | 3–10 |
| Zaman | Yatay zaman çizelgesi · Dikey zaman çizelgesi | 2–10 |
| Sayı | Sayı kartları · Çubuk · Yüzde halkası | 2–8 |

Süs şablonları (3B, dağ, yılan, kelime bulutu) yok — kararlar
`gorsellestirme-plani.md` §2.3.

### 3.2 Görünüm kuralları

- **Veri güdümlü yerleşim:** her şablon öğe sayısından ve etiket
  uzunluklarından hesaplanır; sabit koordinat yok. Galeride her şablon 3, 5
  ve 8 öğeyle gösterilir — biri bozuksa şablon onaylanmaz.
- **Simge:** `lucide-react` (ISC, 3.824 simge, projede kurulu) — SVG yolu
  olarak gömülür, dış istek yok. Simgeyi kod önerir (kavram → simge
  sözlüğü, ör. "sıcaklık" → termometre); kullanıcı değiştirir ya da kaldırır.
  Simge anlam taşımaz, süstür; seçimi şeklin doğruluğunu etkilemez.
- **Tipografi:** Noto Sans (WO-008 kararı); başlık 16–18, etiket 12–14,
  açıklama 11; uzun Türkçe kelime bölünmez (S1 "İlişk / i" dersi).
- **Renk:** iki tema — "akademik sade" (tek renk + gri, baskıya uygun) ve
  "renkli" (4–6 renkli palet, renk körlüğüne uygun). Kontrast WCAG AA.
- **Vurgu:** öğe numaraları, ana düğüm (sonuç, iddia, merkez) belirgin;
  okların etiketi okun üstünde, kutusuz ve çakışmasız.
- **Boşluk:** sabit ızgara (8 px), öğeler arası eşit; şekil A4 sütununa
  (≈170 mm) sığar, gerekirse dikey varyanta geçer.
- **Siyah-beyaz baskı testi:** her şablon gri tonlamada da okunur.

### 3.3 Galeri onay ölçütü

Kullanıcı her şablon için "kalsın / düzelt / at" der. Çiziciye yalnız
"kalsın" olanlar girer. Galeri, yazım alanı prototipinden ayrı bir sayfadır
(`docs/design/mockup-sekil-galerisi.html`).

---

## 4. Her adımın ortak kuralları

- Bir adım = bir iş emri = bir dal; faz başına commit; uzak depoya yalnız
  aynı dal, `main`'e değil.
- Her adım sonunda kullanıcıya **"şunu aç, şunu dene"** listesi verilir
  (bu belgedeki "Görürsün" sütunu).
- Arayüz değişikliği kullanıcı elle denemeden ana dala alınmaz (CLAUDE.md).
- Tüzük sınırları değişmez: yazarın yerine yazmaz, belgeye kendiliğinden bir
  şey girmez, şekildeki her etiket cümleden ya da kullanıcıdan gelir.

## 5. Açık kararlar

1. **Sıra:** WO-D (çizici) WO-008'den önce mi? (öneri: evet)
2. **Galeri önce mi?** Kabuk (adım 2) ile paralel yürüyebilir; galeri koda
   bağlı değil. (öneri: galeri hemen, WO-011 kontrolü beklenirken)
3. **Simge kullanımı:** şekillerde simge olsun mu, isteğe bağlı mı?
   (öneri: varsayılan açık, tek tıkla kapanır; "akademik sade" temada kapalı)
4. **Tek panel kabuk** WO-011 kontrolünden sonra mı başlasın? (öneri: evet)
