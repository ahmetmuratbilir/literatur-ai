# WO-011 — Yazar modu yeniden yapılandırma (şartname Faz 1, 3, 2)

| Alan | Değer |
| --- | --- |
| Durum | Çalışıyor — "start" 15.10.2026 |
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

## Faz 2 — Görsel cila

Numaralı iç içe belge yapısı, sürükle-bırak; tek satır araç çubuğu + "Daha
fazla"; tek bilgi şeridi; seçim menüsü (karar 1 sınırıyla); sağ panel
Kaynaklar · Asistan · Kontrol; durum çubuğu tek satır.

## Kapsam dışı (şartnamenin Faz 4–6'sı)

Analiz çekmecesi (WO-012), matris ve şekiller (WO-013), sürüm geçmişi (WO-014).

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
