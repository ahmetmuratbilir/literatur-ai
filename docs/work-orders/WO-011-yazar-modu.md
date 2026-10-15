# WO-011 — Yazar modu yeniden yapılandırma (şartname Faz 1, 3, 2)

| Alan | Değer |
| --- | --- |
| Durum | Faz 1, 3, 2 bitti — kullanıcı kontrolü bekliyor (15.10.2026) |
| Kaynak | Kullanıcının "Yazar Modu Yeniden Yapılandırma" şartnamesi + güvenlik/faz kapıları ekleri |
| Dal | `wo-006-istatistik`; güvence: `b1fab98 WIP: önceki iş`, `yedek/wo-011-oncesi` |
| Faz sırası | **1 → 3 → 2** (kullanıcı kararı). Bir faz bitmeden sonrakine geçilmez |
| Commit | Faz başına, push yok (kullanıcı kararı 5) |
| Yerine geçtiği | WO-010'un kabuk kararı: araştırma modu eski haline döner, yeni tasarım yalnız yazar modunda |

## Kullanıcı kararları (15.10.2026)

1. **Tüzük 2.2 korunur.** "AI ile geliştir" altında yalnız *dil ve anlatımı düzelt*
   ve *kaynak ihtiyacını değerlendir*; "genişlet", "akademik dille yaz",
   "özetle" gibi serbest üretimler görünmez.
2. **İstatistik kendi çekirdeğimizle** (WO-006/009), pingouin/Pyodide yok.
3. **Matris elle doldurulur**, "AI ile doldur" "Yakında".
4. **Sayfa sınırı ve numarası "yaklaşık"** (contentEditable; TipTap WO-004).
5. **Faz başına commit**, push yok.

## Temel test çizgisi (15.10.2026, değişiklik öncesi)

İstemci birim 117/117 · audit 14/14 · sunucu 417/417 · lint temiz · build
geçiyor · e2e 38/38. Temel çizgi testi `client/e2e/baseline.spec.js`:
B1 sepet (gerçek sunucu, çevrimdışı yerel kopya) geçti; B2 (sahte sunucu)
geçti; B3 BibTeX/RIS/DOCX geçti, çıktılar kaydedildi; **B4 kararsız —
otomatik kayıt ara sıra hiç çalışmıyor** (12 koşuda 1, 10 koşuda 3).
Faz 1 bunu düzeltir.

## Faz 1 — Mod geçişi, Çalışmalarım, taslak kaydı, format seçimi

- Araştırma modu eski düzen (`APP_SHELL_ENABLED=false`); kabuk kodu kaldırılır,
  Denetim modülü Faz 3'te Kontrol sekmesine taşınana kadar durur.
- Yazar modu tam ekran; `#/yazar` adresi; geri tuşu araştırmaya döner;
  `← Araştırma` belgeyi kapatmaz (metin, imleç, kaydırma korunur).
- Eski adresler yönlenir: `#/yazim` → yazar, `#/denetim` → yazar (Faz 3'te
  Kontrol), `#/alanim` → Çalışmalarım, `#/kaynaklar/*` → ilgili kenar sekmesi.
- Çalışmalarım: taslaklar (yeni, yeniden adlandır, çoğalt, sil + geri al),
  son aramalar, kayıtlı analizler. Amber "yalnız bu tarayıcıda" uyarısı ve
  DOCX yedeği; sahte "hesaba kaydet" yok.
- Çoklu taslak deposu (`drafts.js`, saf, testli). Eski tek belge kaybolmadan
  taşınır; eski anahtar silinmez.
- Taslak kaydı: zamanlayıcı efekt yerine ref tabanlı erteleme + sayfa
  kapanırken/gizlenirken zorla kayıt + mod değişiminde kayıt; "Kaydedilemedi —
  tekrar dene".
- Format seçimi: Makale · Tez (genel tez şablonu) · Literatür taraması ·
  Proje raporu · Boş; önizleme; atıf stili yalnız desteklenenler (APA 7, IEEE,
  MLA, Chicago); A4 varsayılan; sonradan değiştirme (metin silinmez, boş bölüm
  kaldırma onaylı).

## Faz 3 — Kontrol sekmesi ve Teslime hazırla

Denetim kuralları sağ panel › Kontrol'e; gruplama; taslakta boş bölüm = Bilgi;
editör kenar işaretleri; "Teslime hazırla" adımlı akış (Kontrol → Önizleme →
Dışa aktar); tez paket bileşenleri belgedeki gerçek bölümlerden.

**Faz 3'e özel kabul kriterleri (kullanıcı, 15.10.2026):**

- Faz 1'de `fixme` ile park edilen 9 Denetim e2e testi (`e2e/audit.spec.js`)
  Kontrol sekmesi için yeniden yazılmış ve geçiyor; `test.fixme` satırı
  kaldırılmış. Atlanan e2e sayısı Faz 1 öncesindeki gibi yalnız 1
  (`screens.spec`, elle inceleme).
- Aynı taslak iki sekmede açıkken veri kaybı yok (Faz 1 ek testleri
  `mode.spec` içinde, Faz 3 sonunda da geçiyor).

## Faz 2 — Görsel cila

Numaralı iç içe belge yapısı, sürükle-bırak; tek satır araç çubuğu + "Daha
fazla"; tek bilgi şeridi; seçim menüsü (karar 1 sınırıyla); sağ panel
Kaynaklar · Asistan · Kontrol; durum çubuğu tek satır.

## Kapsam dışı (şartnamenin Faz 4–6'sı)

Analiz çekmecesi (WO-012), matris ve şekiller (WO-013), sürüm geçmişi (WO-014).

**WO-014 için not (kullanıcı, 15.10.2026):** biçim değişikliğinden önce
otomatik sürüm alınsın. Bugün onaylanıp kaldırılan boş bölüm editörün geri al
geçmişine girmiyor; sürüm geçmişi gelince bu, biçim değişikliğini tek adımda
geri almanın yolu olur.

## Kabul — her faz sonunda

Şartnamenin "Bitti sayılması için" maddeleri + temel çizginin yeniden koşumu
(sepet, dışa aktarma çıktıları karşılaştırması, audit testleri, taslak
kalıcılığı, build). Çalıştırılamayan test geçmiş sayılmaz.

## Geri alma

`git revert` faz commit'leri; tamamı için `yedek/wo-011-oncesi`.

## Bitiş raporu

Faz faz aşağıya eklenir.

### Faz 1 — 15.10.2026

**Çalıştırılan testler:** istemci birim 127/127 (117 → shell testi çıktı,
taslak/biçim/adres testleri girdi) · audit 14/14 · sunucu 417/417 · lint temiz
· i18n yalnız eski `criteria.` · build geçiyor (index 553,2 kB; önce 553,8) ·
e2e 25 geçti, 10 atlandı.

- Atlananlar: `audit.spec` 9 test `fixme` — Denetim sayfası kalktı, Faz 3'te
  Kontrol sekmesine göre yeniden yazılacak; `screens.spec` yalnız elle.
- `shell.spec` (17) silindi; hâlâ geçerli davranışlar `mode.spec`'e taşındı
  (son arama, geçmiş silme, favoriler, sepet temizleme, "kaynak bul",
  dürüstlük taraması).
- Otomatik kayıt: `mode.spec` otomatik kayıt testi ve temel çizgi B4 20'şer
  tekrar, 40/40 geçti (önce B4 12'de 1, 10'da 3, 6'da 4 kez düşüyordu).
- Temel çizgi: B1–B4 geçti. BibTeX ve RIS bayt bayt aynı; DOCX'te yalnız
  `docProps/core.xml` zaman damgası farklı, belge içeriği aynı.

**Bulunan ve düzeltilen:** biçim etiketi kayıt durumunun sağındayken odak
kaybı kaydı tetikleyip yazıyı genişletiyor, düğme kayıyor ve tıklama boşa
gidiyordu; etiket kayıt durumunun soluna alındı. Kenar çubuğunda sepeti
temizlemek tek tıklamaydı; iki adımlı oldu.

**Bilinen eksikler:** `#/yazar/kontrol` şimdilik yalnız yazar modunu açar
(Kontrol sekmesi Faz 3). Biçim değişiminde onaylanıp kaldırılan boş bölüm
editörün geri al geçmişine girmez (onay penceresi var). Taslaklar yalnız bu
tarayıcıda; arayüz bunu söylüyor.

Faz 1 tamam; tarayıcıda deneme sonrası Faz 3'e geçilecek.

### Faz 1 ek — 15.10.2026 (kenar durumu denemesinden)

Kenar durumu denemesi (Playwright, geçici) iki hata buldu, ikisi de düzeltildi:

1. **Aynı taslak iki sekmede → sessiz ezme.** Önce B sekmesinin kaydı A'nın
   yazdığını siliyordu, A'da uyarı yoktu. Şimdi:
   - Her kayıt sürüm (`rev`) taşır. Sekme, yüklediğinden yeni bir sürüm
     depoya yazılmışsa üzerine yazmaz (`saveDraft`).
   - Düzenleyen sekme kilidi tutar (4 sn'de bir tazeler, 12 sn'de düşer).
     İkinci sekme salt okunur açılır: "Bu taslak başka bir sekmede açık" +
     "Burada düzenle". Devralınca öbür sekme bekleyen kaydını yazıp salt
     okunur olur.
   - Öbür sekmede daha yeni sürüm varsa ve burada kaydedilmemiş değişiklik
     yoksa yeni içerik sessizce yüklenir. İki tarafta da kaydedilmemiş
     değişiklik varsa bu sekmenin metni "(çakışma kopyası)" taslağı olur,
     bildirim çıkar.
   - Bu sekmede açık taslak artık sekmeye özel (oturum deposu). Önce bir
     sekmede başka taslak açmak öbür sekmenin belgesini de değiştiriyordu.
   - Yeniden adlandırma sürümü artırır; açık belge yeni adı alır, eski adla
     üzerine yazmaz.
2. **Biçim değişiminde başlık seviyesi.**
   - Şablon başlıkları `data-template-section` kimliği taşır.
   - Eklenen bölümler belgedeki seviyeye uyar (makalede tez bölümleri h2).
   - Kaldırma yalnız kimlikli, yeni şablonda olmayan, kendi içeriği boş ve
     alt bölümü olmayan bölümlerde önerilir; kullanıcının kendi başlıkları
     hiç önerilmez.

Ek olarak: **depolama yazılamıyorsa** taslak bellekte açılır, yazmak serbest.
Kalıcı amber uyarı, "DOCX olarak indir" ve sayfadan çıkarken `beforeunload`
uyarısı gösterilir. Önce bu durumda hiç yazılamıyordu.

**Testler:**
- İstemci birim 138/138 (+11: sürüm, kilit, çakışma kopyası, yeniden
  adlandırma, biçim planı) · audit 14/14 · sunucu 417/417 · lint temiz · i18n
  yalnız eski `criteria.` · build geçiyor (index 556,7 kB).
- e2e 30 geçti, 10 atlandı (yeni: iki sekme, çakışma kopyası, sekmeye özel
  taslak, biçim gidiş-dönüşü, depolama yok).
- Yeni dört test 10'ar tekrar 40/40; otomatik kayıt ve B4 20'şer tekrar
  40/40.
- Temel çizgi: BibTeX ve RIS bayt bayt aynı; DOCX yalnız zaman damgası.

**Bilinen sınırlar:**
- Kilit tarayıcı içi; iki farklı tarayıcı ya da cihaz arasında koruma yok
  (taslaklar zaten yalnız bu tarayıcıda).
- Sekme çökerse kilit 12 sn sonra düşer; o arada öbür sekme salt okunur
  kalır ("Burada düzenle" her zaman çalışır).
- Çakışma kopyası testi, kilidi görmemiş bir sekmeyi depoya doğrudan yazarak
  taklit ediyor.

### Faz 3 — 15.10.2026

Denetim sayfası kalktı. Kuralları yazar modunun sağ panelinde **Kontrol**
sekmesinde yazarken canlı çalışıyor, ayrıca **Teslime hazırla** çekmecesi var.
`#/yazar/kontrol` ve eski `#/denetim` Kontrol'ü açar. `modules/Audit.jsx`
silindi; kurallar `src/audit/audit.js`'te.

**Şartname maddeleri:**

| Madde | Durum |
| --- | --- |
| Eski Denetim'in tüm kuralları Kontrol'de | Çalışıyor: geri çekilmiş/endişeli kaynak, sahipsiz atıf, kaynakça yok/eksik, atıfsız iddia, sayfasız alıntı, boş bölüm, uzunluk hedefi, atıf yapılmayan kaynak, geri çekme durumu bilinmeyen |
| Eksik bibliyografik bilgi (yeni) | Çalışıyor: yazar, yıl, başlık. Atıf yapılan kaynakta Uyarı, yalnız sepettekinde Bilgi |
| Tablo/şekil numaralandırması (yeni) | Kısmen: yalnız "Tablo 2." / "Şekil 3:" ile başlayan başlık satırları ve metindeki "Tablo N" göndermeleri. Editörde gerçek tablo/şekil nesnesi yok |
| Süzgeç Tümü · Hata · Uyarı · Bilgi, sayılarla | Çalışıyor ("Kritik" adı "Hata" oldu) |
| Satır: önem · başlık · monospace konum · cümle · açıklama · eylemler | Çalışıyor: Metinde göster, Bölüme git, Kaynakçayı aç, Kaynak ekle, Kaynakları aç, İddia değil olarak işaretle |
| Gruplama ("3 bölüm boş" → liste) | Çalışıyor |
| Taslakta boş bölüm Bilgi, teslimde zorunlu bölüm Uyarı | Kısmen: "zorunlu" tanımı sabit liste. İsteğe bağlı sayılanlar: kısaltmalar, tablo/şekil listeleri, ekler, özgeçmiş. Kurum yönergesi bilinmiyor; arayüz söylüyor |
| "Pasajla doğrulama yapılmadı" | Madde açıklamasında ve sınırlar notunda |
| Kenar işareti → Kontrol'de satır | Çalışıyor: hata ve uyarı taşıyan, cümleye bağlı maddeler |
| Satıra tıklayınca editörde doğru konum | Cümle ve bölüm maddelerinde çalışıyor. Kaynakça ve sepet maddelerinin belgede konumu yok; ilgili paneli açar |
| Teslime hazırla: Kontrol → Önizleme → Dışa aktar | Çalışıyor. Hata varken "Yine de devam et". Önizleme belgeyi Teslim görünümüne alır; sayfa düzeni ve kurum notu görünür |
| Dışa aktar: Word, yazdır/PDF, BibTeX, RIS | Word, BibTeX ve RIS indiriliyor (e2e). Yazdır/PDF tarayıcının yazdırma penceresini açar; e2e bu pencereyi doğrulamıyor |
| Desteklenmeyen biçimler listede yok | Çalışıyor: dört seçenek; PDF/A ve LaTeX yok notu korunuyor |
| Tez: teslim paketi bileşenleri | Çalışıyor: kapak, onay, etik, Özet, Abstract, içindekiler, tablo/şekil listeleri, ekler. Belgedeki başlıklardan Var / Başlık var, içi boş / Yok |

**Testler:**

| Test | Sonuç |
| --- | --- |
| İstemci birim | 143/143 |
| audit | 19/19 (14 eski + 5 yeni) |
| Sunucu | 417/417 |
| Lint | temiz |
| i18n | yalnız eski `criteria.` |
| Build | geçiyor |
| e2e | 46 geçti, **1 atlandı** (`screens.spec`, elle inceleme). Faz 1'de park edilen 9 Denetim testi Kontrol ve Teslime hazırla için yeniden yazıldı, `fixme` kalktı; toplam 16 test oldu |
| audit.spec tekrar | 5 tekrar 80/80 |
| Otomatik kayıt, B4, iki sekme tekrar | 10'ar tekrar 30/30 |
| Temel çizgi | BibTeX ve RIS bayt bayt aynı; DOCX yalnız zaman damgası |

**Bilinen sınırlar:**
- Kontrol her tuş vuruşunda kuralları yeniden çalıştırır; çok uzun belgede
  ölçülmedi.
- Kenar işaretleri blok başına bir tane; aynı blokta birden çok madde
  "(+n)" ile sayılır.
- Teslime hazırla açıkken geniş ekranda belgeye yer ayrılır ve sağ panel
  gizlenir. Kaynakça/kaynak eylemleri çekmeceyi kapatıp paneli açar.

Faz 3 tamam; tarayıcıda deneme sonrası Faz 2'ye geçilecek.

### Faz 3 ek — 15.10.2026 (kullanıcı onayı sonrası)

1. **Susturulanlar:** "İddia değil" işaretleri Kontrol'de "Susturulanlar (N)"
   altında görünüyor; tek tek "Geri aç" ile kaldırılabiliyor.
2. **Kenar işareti:** yalnız Hata ve Uyarı. Kural saf fonksiyonda
   (`marginItems`) ve birim testli.
3. **Kapsam notları:**
   - Tablo/şekil maddelerinde: "Yalnızca 'Tablo N.' / 'Şekil N:' ile başlayan
     başlıklar denetlendi."
   - Teslim paketinde: "Liste genel tez şablonuna göre; kurum kılavuzunla
     karşılaştır."
4. **Yazdır/PDF doğrulaması (`e2e/print.spec.js`):** Chromium'un yazdırma
   motoruyla PDF üretilip ölçülüyor.
   - Bulunan hata: uzun belge yazdırmada 2. sayfada kesiliyordu (belge sabit
     konumlu, taşması gizli kutulardaydı; ~140 satırlık metinden 104 satır
     kağıda çıkıyordu).
   - Düzeltildi: yazdırmada kapsayıcılar akışa dönüyor, arayüz yer kaplamıyor.
   - Şimdi 150 satırlık belge 5 sayfa A4 (595×842 pt) olarak çıkıyor; her
     satır kağıtta.
   - Yazdırma ortamında üst çubuk, araç çubuğu, paneller, durum çubuğu, kenar
     işaretleri ve Teslime hazırla gizli; yalnız belge görünür.
   - Yan düzeltme: yazdırma kuralları artık yalnız yazar modu açıkken geçerli.
     Önce yazar modu bir kez açıldıktan sonra araştırma sayfası boş
     yazdırılıyordu.

**Testler:**
- İstemci birim 144/144 (audit 20/20) · sunucu 417/417 · lint temiz · build
  geçiyor.
- e2e 48 geçti, 1 atlandı.
- Temel çizgi: BibTeX ve RIS bayt bayt aynı; DOCX yalnız zaman damgası.

### Faz 2 — ara durum (15.10.2026)

Kullanıcı kararları geçerli: AI menüsünde yalnız "Dil ve anlatımı düzelt" ve
"Kaynak ihtiyacını değerlendir"; sayfa numarası "yaklaşık"; 1440×900'de sağ
panel açıkken A4 küçülmez, gerekirse sol panel kapanır; yüzde/skor yok. Her
ana değişiklik sonrası ekran görüntüsü.

**Adım 1 — bitti:**
- Teslim görünümü %100 açılır. Sayfa sığmazsa sol panel kendiliğinden
  kapanır; kullanıcı açarsa dokunulmaz.
- "Sığdır" yazısında yüzde yok.
- Durum çubuğu tek satır: Sayfa x / y (yaklaşık) · kelime · kayıt durumu ·
  görünüm · ölçek. Kayıt durumu üst çubuktan buraya taşındı.
- Cümle/atıf sayaçları Kontrol sekmesinin başında.
- Belge üstünde en fazla bir bilgi şeridi. Öncelik: kilit, depolama, kaldığın
  yer, teslim notu.
- Bulunan hata (Faz 3'ten): sağ panel başlığı dört sekmeyle 360 px'e
  sığmıyor, kabuğu 98 px yana kaydırıyordu (1440×900 Teslim görünümünde düzen
  sola kayık). Kabuk `overflow: clip`, panel başlığı alt satıra kırılır.
- Testler: birim 144/144 · lint temiz · build geçiyor · e2e 48 geçti, 1
  atlandı. write.spec'teki eski "sığdır varsayılanı" ve "sayaçlar durum
  çubuğunda" testleri yeni kurallara göre yeniden yazıldı.

**Kalan adımlar (sırayla):**

2. Belge yapısı:
   - Numaralı (2, 2.1), iç içe, açılır-kapanır.
   - Kaydırınca aktif bölüm vurgulanır.
   - Yeniden adlandırma, bölüm ekleme, sürükle-bırak ile sıralama (klavyeyle
     yukarı/aşağı da).
   - "Tablolar ve şekiller" bölümü ("Tablo N." başlıklarından; boşken
     şartnamedeki metin).
3. Araç çubuğu:
   - Tek satır: stil · yazı tipi · punto · B/I/U · hizalama · satır aralığı ·
     liste · geri al/yinele · Atıf ekle · Sayfa ayarları.
   - "Daha fazla": üst/alt simge, vurgu, girinti.
   - Dar ekranda gruplar "Daha fazla"ya taşınır; araç çubuğu kırılmaz.
4. A4 sayfa:
   - Teslim görünümünde sayfa no ("Sayfa 4 / 14", yaklaşık) ve isteğe bağlı
     üst bilgi (belge adı); DOCX ve yazdırmada da aynı.
   - Metin içi atıflar açık mor (CSS Highlight API, DOM'a dokunmadan);
     tıklayınca kaynak sağ panelde açılır.
   - Üst çubukta "Ekle ▾": tablo/şekil başlığı, atıf, kaynak dosyası.
5. Seçim menüsü ve sağ panel:
   - Koyu, kompakt yüzen menü: AI ile geliştir ▾ · Atıf ekle · Atıf doğrula
     (Yakında) · Yorum (Yakında).
   - Sağ panel üç sekme: Kaynaklar (liste + kaynak ayrıntısı + Kaynakça) ·
     Asistan · Kontrol.
   - "Kaynak ihtiyacını değerlendir": yerel iddia sınıflandırıcısıyla, modelsiz.
   - "Dil ve anlatımı düzelt": yeni sunucu ucu ve sürümlü prompt. Model yalnız
     seçili metni görür; çıktı katı JSON şemasıyla doğrulanır; atıflar
     birebir korunmazsa öneri reddedilir.
   - Asistan'da orijinal/öneri karşılaştırması, Uygula/Reddet, geri alınabilir.
   - Gerçek model çağrısı yerelde Gemini/Groq anahtarlarıyla ayrıca
     denenecek; prompt kalitesi Bölüm 4 kümesi olmadığı için "ölçülmedi".

### Faz 2 — bitti (15.10.2026)

Adımlar ve commit'ler:

| Adım | İş | Commit |
| --- | --- | --- |
| 1 | A4 %100, tek satır durum çubuğu, tek bilgi şeridi | `f2b904e` |
| 2 | Numaralı belge yapısı | `587500b` |
| 3 | Tek satır araç çubuğu + "Daha fazla" | `24eec0c` |
| 4 | Sayfa no/üst bilgi, mor atıflar, Ekle menüsü | `2dfd103` |
| 5 | Seçim menüsü, Kaynaklar · Asistan · Kontrol, iki AI eylemi | bu commit |

Ekran görüntüleri her adımdan sonra alındı ve kullanıcıya rapor edildi.

**Bitti sayılması için:**

| Madde | Durum |
| --- | --- |
| 1440×900'de sağ panel açıkken A4 %100; sığmazsa sol panel kapanır | Çalışıyor (e2e: genişlik 793,7 px, sayfa panelin solunda) |
| Belge yapısı gerçek başlıklardan, tıklayınca doğru yere | Çalışıyor (e2e) |
| AI önerisi uygulanıp geri alınabiliyor; seçilmeyen metin değişmiyor | Çalışıyor (e2e, sahte sunucu cevabıyla) + gerçek uç bir canlı çağrıyla denendi |
| Ekranda yüzde/skor/doğruluk yok | Çalışıyor (e2e taraması: iki görünüm, üç sekme) |
| Durum çubuğu tek satır, belge üstünde en fazla bir şerit | Çalışıyor (e2e) |

**AI eylemleri (kullanıcı kararı 1):**
- **Kaynak ihtiyacını değerlendir:** yerel iddia sınıflandırıcısıyla, modelsiz.
- **Dil ve anlatımı düzelt:** yeni uç `POST /api/language-edit`, prompt
  `PR11.v1` (`server/services/languageEdit.js`).
  - Atıflar modele gitmeden yer tutucuya çevrilir; dönüşte sıra ve sayı
    tutmazsa ret.
  - Yeni sayı, DOI veya bağlantı eklenirse ve aşırı kısalma/uzama olursa ret.
  - Şema dışı çıktı kullanılmaz; ayraç + sonda talimat.
  - Sunucu birim testi 6.
  - Canlı çağrı (yerel, DeepSeek): yazım düzeltildi, atıf ve sayı korundu.
  - Kalite Bölüm 4 kümesiyle **ölçülmedi**.
  - PR11, tasarım belgesindeki PR1–PR10 listesine eklenmeli (belge
    güncellenmedi).

**Kısmen / uygulanmadı:**
- **Girinti** uygulanmadı: execCommand bloğu alıntıya çeviriyor; Kontrol
  kuralları bozulurdu.
- **"Atıf doğrula" ve "Yorum"** devre dışı, "Yakında" yazıyor.
- **Asistan hızlı eylemleri:** şartnamedeki "Akademik dille yaz · Argüman
  akışı · Özetle · Genişlet" kullanıcı kararı 1 gereği yok; yalnız iki eylem
  var.
- **Sayfa sınırları** yaklaşık. Yazdırmada sayfa numarası Chromium @page
  kenar kutularıyla çalışır; başka tarayıcıda görünmeyebilir.
- **"Dil ve anlatımı düzelt"** seçimdeki biçimi (kalın vb.) düz metne çevirir.
- **Şablon ve Dışa aktar** düğmeleri üst çubukta duruyor; şartnamenin üst
  çubuk listesinde yoklar.

**Bulunan hatalar (düzeltildi):**
- Sağ panel başlığı taşıp kabuğu kaydırıyordu (Faz 3'ten).
- Üst/alt simge DOCX'e geçmiyordu.
- Araç çubuğu açılır panelleri kırpılıyordu.
- Kısa belgede sayfa sayısı 2 çıkıyordu.
- Seçim menüsünde düğmeler üst üste biniyordu.

**Testler (son koşum):**
- İstemci birim 145/145 · audit 20/20 · sunucu 423/423 · lint temiz ·
  build geçiyor.
- e2e 58 geçti, 1 atlandı.
- Temel çizgi: BibTeX/RIS bayt bayt aynı. DOCX'te belge metni aynı, tek
  fark yeni sayfa numarası alt bilgisi (Faz 2 özelliği).
