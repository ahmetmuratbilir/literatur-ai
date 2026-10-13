# WO-001 — Salt okunur teknik ve ürün denetimi

| Alan | Değer |
| --- | --- |
| Durum | Hazır, çalıştırılabilir |
| Kapsam | Salt okunur |
| Dosya değişikliği | **Yasak** |
| Tahmini süre | 1–2 oturum |
| Ön koşul | Yok |
| Yol haritası aşaması | P0 |

## Talimat

> `CLAUDE.md`'nin 1., 2. ve 3. bölümlerini oku. Ardından bu iş emrini uygula.
>
> **Bu görevde hiçbir dosyayı oluşturma veya değiştirme.** Kod yazma, refactor
> yapma, bağımlılık ekleme. Yalnızca oku, salt okunur komutlar çalıştır, ölç
> ve raporla.
>
> **Rapor sohbet çıktısı olarak verilir.** Dosya oluşturulmaz —
> `docs/audit/AUDIT-001.md` dahil. Raporu okuduktan sonra onay verirsem
> dosyaya yazarsın.
>
> Rapordan hemen önce `git status --porcelain` çalıştır ve çıktısını raporun
> başına koy. Boş olmalı. Boş değilse neyin değiştiğini açıkla ve nedenini
> raporla.

## Ne incelenecek

### A. Gerçek durum envanteri

Her madde için **dosya yolu ve satır numarası** ver. Kanıtsız iddia kabul
edilmez.

- Frontend ve backend yığını, mimari, dizin düzeni
- Veritabanı şeması ve veri modelleri
- Kimlik doğrulama ve yetkilendirme
- Hangi AI sağlayıcıları ve modeller, nerede çağrılıyor
- Hangi akademik API'ler gerçekten entegre, hangileri yalnızca adı geçiyor
- Arama ve sıralama akışı: hangi sinyaller, hangi sırayla
- Gömme ve vektör araması var mı, varsa nerede
- RAG hattı var mı, hangi adımlardan oluşuyor
- Promptlar nerede duruyor, sürümlü mü, yapılandırılmış çıktı var mı
- Önbellek ve arka plan işleri
- Loglama, hata yönetimi, maliyet takibi
- Test altyapısı: var mı, çalışıyor mu, kapsamı ne
- UI bileşenleri ve tasarım sistemi
- Kullanılmayan, tekrarlanan veya ölü kod

### B. İki listeye ayır

1. **Gerçekten çalışan özellikler** — kodda var, çağrılıyor, denendi
2. **Var görünen ama çalışmayan özellikler** — yazılmış ama bağlanmamış,
   hata veriyor, veya hiç çağrılmıyor

Bu ayrım raporun en değerli kısmı. Fuar sunumunda neyin gösterilebileceğini
bu belirler.

### C. AHP'nin gerçek durumu

Ayrı bir başlık altında:

- AHP kodda uygulanmış mı, yoksa planlanmış mı?
- Uygulanmışsa kriterler neler, ağırlıklar nerede tanımlı?
- Ağırlıklar kullanıcıya açık mı, sabit mi?
- Sıralama gerçekten AHP'den mi geçiyor, yoksa başka bir skor mu kullanılıyor?
- Tutarlılık oranı hesaplanıyor mu?

### D. Kaynak entegrasyonlarının sağlığı

Her entegre API için:

- Gerçekten istek atıyor mu, yoksa kodu yazılmış ama devre dışı mı?
- Hız limiti yönetimi var mı?
- Hata durumunda ne oluyor — sessizce boş mu dönüyor?
- Anahtar nerede saklanıyor?
- Sonuçlar önbelleğe alınıyor mu?

**arXiv'den veri gelip gelmediğini özellikle kontrol et.** Bilinen bir sorun
olabilir.

### E. Doğrulanmamış varsayımlar

Kodda veya dokümantasyonda yer alan, doğrulanmamış her lisans / limit / maliyet
varsayımını listele. Örnek: bir API'nin ücretsiz kabul edilmesi, ticari
kullanıma uygun sayılması, limitinin yeterli varsayılması.

### F. Güvenlik taraması

- Frontend'e sızmış anahtar var mı?
- Prompt enjeksiyonu yüzeyi: dış metinler prompta nasıl giriyor?
- Yetkilendirme kontrolleri endpoint bazında var mı?
- Hassas veri loglanıyor mu?

### G. Tüzük kurallarının kod karşılığı

`CLAUDE.md`'deki bir kuralın yazılı olması, kodun ona uyduğunu kanıtlamaz. Bölüm
2 ve 3'teki şu kuralların her biri için **kodda karşılığı var mı, yok mu**
diye bak ve kanıt göster:

| Kural | Nerede yazıyor | Kodda ne aranacak |
| --- | --- | --- |
| Atıf verisi modelden gelmiyor | 3.1 | Prompt'a giren alanlar — DOI, yazar, yıl prompt gövdesine giriyor mu? Kaynakça hangi kayıttan üretiliyor? |
| Pasaj birebir saklanıyor | 3.2 | `passage` alanı bir model çağrısından geçiyor mu? |
| Döngülerin tavanı var | 3.3 | Yeniden deneme döngülerinde sayaç var mı, yoksa `while` mi? |
| Önbellek anahtarı sürümlü | 3.4 | Anahtarda prompt ve şema sürümü var mı? |
| Geçersizleştirme çalışıyor | 3.4 | Sürüm değişince eski kayıt gerçekten düşüyor mu? Geri çekme ve pasaj değişikliği kararı geçersizleştiriyor mu? |
| **Model yetki yalıtımı** | 3.8 | Pasajı işleyen çağrının araç, yazma veya ağ erişimi gerçekten kapalı mı — yoksa yalnızca promptta mı yazıyor? |
| Çıktı şemayla doğrulanıyor | 3.8 | Şema doğrulaması var mı, yoksa serbest metin mi kabul ediliyor? |
| İddia–kanıt bağı kuruluyor | 2.5 | Her üretilen cümlenin bir pasaj kaydıyla ilişkisi var mı? |
| Beş kanıt sınıfı ayrı | 2.4 | `partial`, `contradicts` ve `no_evidence` gerçekten ayrı mı, yoksa ikili mi (destekliyor / desteklemiyor)? |
| Belgeye otomatik girmiyor | 2.9 | Üretilen metin kullanıcı onayı olmadan belgeye yazılabiliyor mu? |

Bu tabloyu raporda olduğu gibi doldur: her satıra **var / yok / kısmen** ve
dosya:satır kanıtı. En değerli çıktı bu tablo olacak — bundan sonraki iş
emirleri buradan türeyecek.

**Yetki yalıtımı maddesini özellikle sert kontrol et.** Beş katmanlı
savunmanın en kritik katmanı budur ve kolayca "yazıldı ama uygulanmadı"
durumunda olabilir.

### H. Fuar demosu riskleri

Ayrı bir liste: fuar sunumunda bozulabilecek, yanlış sonuç üretebilecek veya
doğrulanmamış bir API'ye bağımlı olan özellikler. Her biri için: gösterilirse
ne olur, gösterilmezse ne kaybedilir.

## Çıktı formatı

Rapor şu sırayla:

1. **Yönetici özeti** — en fazla 10 cümle. Sistem ne durumda, en büyük risk ne.
2. **Gerçek durum envanteri** — A bölümü, dosya kanıtlarıyla
3. **Çalışan / çalışmayan özellik listesi** — B bölümü, tablo halinde
4. **En kritik 10 sorun** — etki × aciliyet sırasıyla. Her biri için: sorun,
   kanıt (dosya:satır), etki, önerilen çözüm, tahmini efor, risk
5. **AHP durumu** — C bölümü
6. **Kaynak entegrasyonları tablosu** — D bölümü
7. **Doğrulanmamış varsayımlar** — E bölümü
8. **Güvenlik bulguları** — F bölümü
9. **Mevcut mimari ile hedef mimari farkı** — Bölüm 2 ve 3 ile karşılaştır, en
   büyük üç sapmayı adlandır
10. **Tüzük–kod uyum tablosu** — G bölümü, olduğu gibi doldurulmuş
11. **Fuar demosu riskleri** — H bölümü
12. **Önerilen tek sonraki iş emri** — rapordaki en kritik sorunu çözecek olan.
    Üç öneri değil, bir tane: kapsamı, kabul kriteri ve test planıyla

Raporu verdikten sonra **dur ve onay bekle.** Kendi önerdiğin iş emrini
uygulamaya geçme.

## Kabul kriterleri

- [ ] Hiçbir dosya oluşturulmadı veya değiştirilmedi; `git status --porcelain`
      çıktısı boş ve raporun başında yer alıyor
- [ ] Envanterdeki her iddia dosya yolu ile desteklendi
- [ ] Çalışan / çalışmayan ayrımı yapıldı
- [ ] Mevcut testler çalıştırıldı ve gerçek çıktıları raporlandı; çalışmıyorsa
      sebebi yazıldı
- [ ] AHP'nin gerçek durumu netleştirildi
- [ ] arXiv entegrasyonunun durumu kesin olarak belirlendi
- [ ] Her kritik sorun için somut kanıt verildi
- [ ] Tüzük–kod uyum tablosu (G) her satırı dolu, kanıtlı
- [ ] Model yetki yalıtımının gerçekten uygulanıp uygulanmadığı kesinleşti
- [ ] Fuar demosu riskleri ayrı listelendi
- [ ] Doğrulanmamış varsayımlar açıkça işaretlendi
- [ ] Tek bir sonraki iş emri önerildi ve uygulanmadı
- [ ] Rapor sonunda durum etiketi var

## Bu görevde yasak olanlar

- Dosya oluşturma, değiştirme, silme — rapor dosyası dahil
- Bağımlılık ekleme veya yükseltme
- Veritabanı şemasına dokunma
- Refactor önerisini uygulamaya geçirme
- "Şunu da düzelttim" demek

Kapsam dışında bir sorun görürsen raporla, dokunma.
