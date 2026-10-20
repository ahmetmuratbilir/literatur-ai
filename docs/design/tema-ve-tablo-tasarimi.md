# Tema ve tablo tasarımı: araştırma ve öneri

**Durum:** öneri (20.10.2026). Henüz kod yazılmadı; kararlar Ahmet'te
(§6). Kaynak: iki araştırma ajanının raporu ve repodaki eski çalışmalar
(`gorsellestirme-plani.md`, `etkilesim-ve-durumlar-plani.md` §10.1c,
`mockup-sekil-galerisi.html`). Her dış iddianın kaynağı bağlantılı. Lisans
notları hukuki görüş değil.

## 1. İstek

- Tablo belgeye girdikten sonra Word'deki "Tablo Tasarımı" gibi özelleştirme
  olsun ve Word'e bozulmadan geçsin.
- Tek renk tema olmasın. Şekil ve tablolar için gerçek temalar olsun.
- Napkin AI gibi çalışsın: önce şablonu seçip sonra içeriği yazmak da, önce
  içeriği yazıp sonra şablonu ya da temayı değiştirmek de mümkün olsun.

## 2. Daha önce ne araştırdık (repoda)

| Ne | Sonuç | Belge |
| --- | --- | --- |
| AntV Infographic (MIT, ~200 şablon, düzenleyici) | Denemeyi yalnız boyut ölçütünden geçemedi (284 KB > 200 KB gzip). Karar: kod alınmaz, fikir alınır. | `gorsellestirme-plani.md` §5, `s1/` |
| OpenNapkinAI (MIT) | Kod alınmadı: metni modelin kendi cümleleriyle yeniden yazıyor, her şeyi "tam 4 madde"ye zorluyor. Alınan fikirler: "şekli zorlama, 3–9 öğe" ve çizmeden önce yapıyı onarma adımı. | `etkilesim-ve-durumlar-plani.md` §10.1c |
| Şekil galerisi | 24 şablon, iki tema ("Renkli" / "Akademik sade"). Ahmet'in Kalsın / Düzelt / At kararını bekliyor. | `mockup-sekil-galerisi.html` |
| Bugünkü kod | 6 şablon. Görünüm bölümünde 4 palet var ama her palet yalnız 2 vurgu rengi taşıyor; şekillerin tek renk görünmesinin sebebi bu. Tablolar yalnız APA biçiminde. | `visuals/draw.js` |

## 3. Napkin ve benzerlerinden öğrenilenler

- **Napkin:**
  - Akış: Metin yazılır. Paragrafın yanındaki "Generate Visual" düğmesine basılır, birkaç öneri gelir. Kullanıcı birini seçer, sonra stilini seçer ([yardım](https://help.napkin.ai/en/articles/9992180-visuals-generation)). "Custom Generation" ile tür yazılabiliyor ([blog](https://www.napkin.ai/blog/napkin-launches-custom-generation/)).
  - Stil: Marka renkleri, arka plan, başlık ve gövde yazı tipleri, şekil ve renk kombinasyonlarından oluşan bir paket. "Apply to All" ile bütün görsellere, ya da yalnız seçili olana uygulanır ([yardım](https://help.napkin.ai/en/articles/10696628-custom-styles)).
  - Ekledikten sonra yazı, renk, simge ve boyut öğe öğe düzenlenebiliyor ([yardım](https://help.napkin.ai/en/articles/9992106-visuals-customization)).
  - Şartları tersine mühendisliği ve kazımayı yasaklıyor, simge ve şablonlar onların malı ([şartlar](https://www.napkin.ai/terms-conditions)). Biz yalnız arayüz fikrini alıyoruz.
- **Microsoft SmartArt** (istenen "ters sıra"nın en iyi örneği):
  - Düzen değişince metin korunur. Yeni düzene sığmayan metin silinmez, işaretlenip saklanır ([Microsoft](https://support.microsoft.com/en-us/office/graphics-visuals/learn-more-about-smartart-graphics)).
  - Renkler belge temasından gelir; elle verilen renk temadan ayrılır ([Microsoft](https://support.microsoft.com/article/fac94c93-500b-4a0a-97af-124040594842)).
- **Canva, Gamma, Beautiful.ai:** Tema ya da palet bütün tasarıma tek düğmeyle uygulanır. Düzenler arasında içerik korunarak geçilir ([Canva](https://www.canva.com/help/color-and-font-combinations/), [Beautiful.ai](https://www.beautiful.ai/home)).
- **Çıkarım:** Düzen (şablon) ile tema iki ayrı eksen. Tema = palet + yazı tipi + şekil dili (köşe, kenar, dolgu, desen).

## 4. Tablo: Word'deki gibi tasarım

**Word nasıl yapıyor:**
- Tablo Tasarımı sekmesinde bir stil galerisi var: Düz, Izgara ve Liste grupları.
- Altında onay kutuları var: Başlık Satırı, Toplam Satırı, Bantlı Satırlar, İlk Sütun, Son Sütun, Bantlı Sütunlar ([Microsoft](https://support.microsoft.com/en-gb/office/video-apply-a-table-style-f1b798e7-fa25-496c-a434-0c2a15bed09f)).
- Bu kutular stilin değil, tablonun ayarı. Dosyada `tblLook` olarak duruyor ([MS-OI29500](https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oi29500/90f075ce-b16d-422a-b1b0-39c9777a594e)).

**Word'e bozulmadan geçiş** (docx 9.6.1, kurulu paketin kodu okundu):
- Hücre gölgesi (`shading`), kenarlık ve `tableLook` destekleniyor.
- Gerçek bir Word tablo stili tanımlayan bir API yok. Bunun tek yolu `externalStyles` ile styles.xml'i elle vermek. O yol bugün kullandığımız paragraf stillerini devre dışı bırakıyor, yani riskli.
- **Öneri:** Tema ve onay kutuları dışa aktarımda hücre hücre gölge ve kenarlığa çevrilsin, `tableLook` da yazılsın. Word, LibreOffice ve Google Docs'ta aynı görünür.
- Eksi tarafı: Word'de başka bir stil seçilirse bizim biçimimiz o stilin üstünde kalır. Gerçek Word stili istenirse ayrı bir iş olur.

**APA uyarısı:** APA 7 dikey çizgi kullanmıyor, gölgelendirmeden kaçınmayı istiyor. Gölge kullanılırsa amacı tablonun notunda açıklanmalı ([APA](https://apastyle.apa.org/style-grammar-guidelines/tables-figures/tables)). Bu yüzden:
- Varsayılan APA kalır.
- Renkli temalar "APA dışı" diye etiketlenir.
- Teslim kontrolü, APA biçimli bir belgede renkli tablo görürse uyarı verir.

**Tablo temaları** (yazı kontrastı WCAG formülüyle hesaplandı; bant tonları gri baskıda beyazdan ayrılacak açıklıkta):

| Tema | Başlık zemini / yazı | Bant | Çizgiler |
| --- | --- | --- | --- |
| APA (varsayılan) | yok / kalın | yok | üst, başlık altı, alt |
| Kitap çizgisi (booktabs) | yok | yok | üst ve alt kalın, orta ince |
| Akademik ızgara | `F2F2F2` / `111827` | yok | tüm hücreler ince gri |
| Baskı grisi | `D9D9D9` / `111827` | `F2F2F2` | yatay gri |
| Lacivert | `1E3A5F` / beyaz | `EEF2F7` | başlık altı |
| Deniz yeşili | `134E4A` / beyaz | `E6F2F1` | yatay ince |
| Kiremit | `7C2D12` / beyaz | `FDF2E9` | yatay ince |
| Çivit | `312E81` / beyaz | `EEF0FB` | yatay ince |
| Mürdüm | `3B0764` / beyaz | `F5F0FA` | yatay ince |
| Koyu kömür | `404040` / beyaz | `F2F2F2` | yok |
| Word mavisi | `4472C4` / beyaz (kalın) | `D9E2F3` | ince `8EAADB` |

**Arayüz:**
- Tablo araç çubuğunda küçük bir "Tasarım" düğmesi olur. Açılınca temaların küçük önizlemeleri görünür (Word galerisi gibi).
- Altında onay kutuları durur: Başlık satırı, Toplam satırı, Bantlı satırlar, İlk sütun.
- Fikir TinyMCE'nin "tema = sınıf" modelinden alındı: tabloya `data-theme` ve bayraklar yazılır, ekranda CSS çizer, dışa aktarımda hücre gölgesine çevrilir.
- Bağımlılık eklenmez. CKEditor GPL lisanslı olduğu için ondan kod alınamaz.

## 5. Şekil: temalar ve iki yönlü akış

**Şekil temaları** (çok renkli; paletler kaynaklarındaki sırayla):

| Tema | Palet | Renk körlüğü | Gri baskı |
| --- | --- | --- | --- |
| Klasik akademik (Paul Tol yüksek kontrast) | `#004488 #DDAA33 #BB5566` | uygun | uygun (kaynak) |
| Okabe–Ito | `#0072B2 #E69F00 #009E73 #D55E00 #CC79A7 #56B4E9` | uygun | desenle |
| Parlak (Tol bright) | `#4477AA #EE6677 #228833 #CCBB44 #66CCEE #AA3377` | uygun | zayıf |
| Yumuşak (Tol muted) | 8 renk | uygun | test edilecek |
| Canlı (Tol vibrant) | 6 renk | uygun | test edilecek |
| Pastel (Tol light) | 7 renk | — | test edilecek |
| Sıralı (viridis, CC0) | 5 ton | uygun | uygun (kaynak) |
| Siyah-beyaz baskı (bugünkü) | gri + desen | uygun | uygun |

Lisans notları:
- Okabe–Ito'yu yazarları serbest bırakıyor, atıf istiyor ([jfly](https://jfly.uni-koeln.de/color/)).
- Paul Tol'un sayfasında açık bir lisans yazmıyor ([Tol](https://sronpersonalpages.nl/~pault/)). Kullanmadan önce sorulmalı ya da yalnız renk kodları kullanılmalı (renk kodu tek başına telif konusu sayılmayabilir, doğrulanmadı).
- Tableau 10'un lisansı belirsiz, alınmaz.
- ColorBrewer kullanılırsa teşekkür ibaresi zorunlu ve adı izinsiz kullanılamaz.
- Hepsi "Veri kaynakları" penceresi gibi bir "Renk kaynakları" notunda anılır.

**İki yönlü akış** (SmartArt'taki "Düzeni değiştir" gibi):
1. İçerik ile şablon ayrı. Taslak alanında şablon şeridi hep görünür. Şablona tıklamak içeriği koruyarak yeniden çizer. Böylece "önce şablon" ve "önce içerik" aynı ekranda olur.
2. Yeni şablona sığmayan öğe silinmez. "Bu şablonda görünmeyen 2 öğe" notuyla saklanır (tüzük 2.8).
3. Şablon şeridindeki küçük önizlemeler kullanıcının kendi içeriğiyle çizilir. Metne uyan şablonlar başa alınır. Galeri büyürse önce 3–4 öneri, yanında "Tümü" gösterilir.
4. Tema seçici Görünüm bölümünün başında renk çipleri olarak durur. Desen, köşe ve yazı boyutu temanın varsayılanından gelir, ayrıca değiştirilebilir.
5. Ekledikten sonra Düzenle ya da çift tık aynı alanı şablon, tema ve içerikle birlikte açar. Bu bugün çalışıyor.

**Belge teması:**
- Belgenin tek bir teması olur. Şekiller ve tablolar varsayılan olarak bu temayı izler; tema değişince hepsi yeniden çizilir (Napkin'in "Apply to All"u).
- Bir şekle ya da tabloya elle tema verilirse o öğe belge temasından ayrılır. Yanında "temadan ayrıldı · sıfırla" yazar.

## 6. Ahmet'in kararları

1. Tablo temaları listesi (§4): hepsi mi, hangileri?
2. Şekil temaları (§5): Paul Tol paletleri lisans sorulana kadar beklesin mi, yoksa yalnız renk kodlarıyla mı kullanılsın?
3. Belge teması olsun mu (bütün şekil ve tabloları birlikte değiştiren)?
4. Galeriden hangi şablonlar eklensin (`mockup-sekil-galerisi.html`: Kalsın / Düzelt / At)?
5. Sıra önerisi:
   - WO-031 tablo tasarımı (bağımsız, Word'e geçişi en net olan).
   - WO-032 şekil temaları + şablon şeridi + belge teması.
   - Galeri kararından sonra yeni şablonlar.

## 7. Doğrulanmayanlar

- Üretilen bir .docx Word'de ve LibreOffice'te açılıp bakılmadı.
- Paletlerin gri baskıdaki ayrışması ölçülmedi (L* testi yapılacak).
- Napkin'in kaç öneri gösterdiği belgelenmemiş.
- Word'ün "Accent 1" renginin kesin değeri kaynaklarda çelişiyor.
- viridis ve Nord renk kodları kendi dosyalarından okunmadı.
