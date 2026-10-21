# İş Emirleri

Her geliştirme oturumu tek bir iş emriyle çalışır. Oturum başlarken ajana
verilecek mesaj şudur:

```
docs/work-orders/WO-00X-<ad>.md dosyasını oku ve uygula.
Kapsam dışına çıkma.
```

Başka hiçbir şey yazmaya gerek yok — `CLAUDE.md` zaten her oturumda yüklü ve
ajanı doğru dosyalara yönlendiriyor.

## Neden tek iş emri

Üç sebep:

1. **Kapsam kontrolü.** Ajan "bunu da düzelteyim" diyemez; iş emrinin dosya
   listesi dışına çıkamaz.
2. **Çıkar çatışması yok.** Bir özelliği geliştiren oturum, o özelliğin değer
   yaratıp yaratmadığını değerlendirmez. Önceliklendirme ayrı bir konuşmadır,
   çünkü kendi yazdığı şeyi savunmayan bir değerlendirme ancak böyle çıkar.
3. **Geri alınabilirlik.** Bir iş emri = bir dal = bir commit grubu. Ters
   giderse tek hamlede geri alınır.

## Adlandırma

`WO-<sıra>-<kısa-ad>.md` — örnek: `WO-004-arxiv-fix.md`

Sıra numarası asla yeniden kullanılmaz, iptal edilen iş emri `Durum: İptal`
notuyla dosyada kalır.

## Yaşam döngüsü

```
Taslak → Hazır → Çalışıyor → Bitti
```

- **Taslak:** kapsam veya kabul kriterleri henüz net değil, ajana verilmez
- **Hazır:** ajana verilebilir
- **Çalışıyor:** bir oturum üzerinde çalışıyor
- **Bitti:** kabul kriterleri karşılandı, bitiş raporu dolduruldu

## Mevcut iş emirleri

| No | Başlık | Aşama | Durum |
| --- | --- | --- | --- |
| WO-000 | Kurtarma ve doğrulama: yerel işi dala alıp push et | P0 öncesi | **Bitti** (13.10.2026, `wo-design-recovery`) |
| [WO-001](WO-001-denetim.md) | Salt okunur teknik ve ürün denetimi | P0 | Hazır |
| [WO-002](WO-002-arastirmaci-paneli.md) | Araştırmacı paneli: arama kartından ayrı panel | P1 | Çalışıyor — istisna |
| [WO-003](WO-003-calisma-alani-iskeleti.md) | Çalışma alanı iskeleti: belge editörü ve sayfa ayarları | P1 | Taslak — istisna |
| WO-004 | Belge yüzeyi: ProseMirror/TipTap ve cümle çapaları | P1 | Yazılmadı |
| [WO-005](WO-005-kanit-dogrulama.md) | Kanıt doğrulama: yazarın cümlesini sepetteki kaynağın pasajına bağla (PR3) | P2 | Taslak (20.10.2026) — onay bekliyor |
| [WO-006](WO-006-istatistik-cekirdegi.md) | İstatistik çekirdeği ve çapraz doğrulama | P3 | **Bitti** (14.10.2026, `wo-006-istatistik`) |
| WO-007 | Analiz sekmesi: veri girişi ve belgeye ekleme | P3 | Yazılmadı |
| [WO-008](WO-008-sekillerin-word-pdf-gomulmesi.md) | Şekillerin Word ve PDF'e gömülmesi (SVG + PNG yedeği, gömülü Noto Sans, satır kırma, dış istek 0, elle doğrulama: Ahmet) | P3 | Taslak, kararlar işlendi (17.10.2026) — uygulama kullanıcı WO-011 kontrolünden dönünce |
| [WO-009](WO-009-muhendislik-analizleri.md) | Mühendislik analizleri: belirsizlik, yayılım, Monte Carlo, regresyon | P3 | **Bitti** (14.10.2026, `wo-006-istatistik`) |
| [WO-010](WO-010-uygulama-kabugu.md) | Uygulama kabuğu ve yeni tasarıma geçiş (Aşama 0–2) | P1 | Kabuk kararı WO-011 ile geri alındı (15.10.2026) |
| [WO-011](WO-011-yazar-modu.md) | Yazar modu yeniden yapılandırma (şartname Faz 1 → 3 → 2) | P1 | Faz 1, 3, 2 bitti — kullanıcı kontrolü bekliyor (15.10.2026) |
| [WO-015](WO-015-istatistik-cekirdegi-v2.md) | İstatistik çekirdeği v2: ANOVA, ki-kare, Mann-Whitney, Wilcoxon, Kruskal-Wallis | P3 | Taslak (16.10.2026) |
| [WO-016](WO-016-gorsel-yapi-cekirdegi.md) | Görsel yapı çekirdeği: sinyal, kural kademesi, Türkçe toleranslı eşleştirme, şablon uygunluğu, kaynak değişimi denetimi | P3 | **Bitti** (17.10.2026, `wo-016-gorsel-yapi`, push yok) — kullanıcı kontrolü bekliyor |
| [WO-017](WO-017-tek-panel-kabuk.md) | Tek panel kabuk: sol rayda Araştırma ilk sırada, yazım aynı kabukta | P1 | **Hazır** (17.10.2026) — WO-011 elle kontrolü gelince başlar |
| [WO-018](WO-018-etkilesim-altyapisi.md) | Etkileşim altyapısı: katmanlar, Esc yığını, ortak pencere, geri al (planlardaki WO-E1) | P1 | Taslak (17.10.2026) — ön koşul WO-017 |
| [WO-019](WO-019-cizici-ve-gorsellestir.md) | Görsel paneli: tablo, şekil, grafik — panelde düzenle, seçili paragrafın altına ekle (WO-D + WO-B'nin ilk parçası) | P3 | Çalışıyor (19.10.2026) — Faz 1 (elle tablo) bitti, elle deneme bekliyor; sırada Faz 2 |
| [WO-020](WO-020-arastirmadan-yazima-kopru.md) | Araştırmadan yazıma köprü: Yaz'da "son aramandan ilgili olabilir", doğrulanmamış atıf | P1 | Taslak (17.10.2026) — ön koşul WO-017; onay: `Basket.query` alanı |
| [WO-021](WO-021-bekleme-hata-kart-durumlari.md) | Bekleme, hata ve kart durumları (planlardaki WO-E2) | P1 | Taslak (17.10.2026) — ön koşul WO-018 |
| [WO-022](WO-022-model-kademesi-pr6.md) | Görsel yapı model kademesi PR6.v2 ve E5 (planlardaki WO-C) | P3 | Taslak (17.10.2026) — ön koşul WO-019, E5 etiketlemesi |
| [WO-023](WO-023-yapay-zeka-baglantilari.md) | Yapay zekâ bağlantıları: kullanıcının kendi API anahtarı (varsayılan Literatür AI) | P1 | Taslak (17.10.2026) — ön koşul WO-017; onay: AiConnection koleksiyonu, KEY_ENCRYPTION_KEY |
| [WO-024](WO-024-kabuk-denetimi-marka-destek.md) | Kabuk denetimi, marka ve destek: tuş tuş denetim, ipucu, hata sınırı, kenar çubuğu, yardım ve geri bildirim, tanışma soruları, simge seti | P1 | Bitti (18.10.2026, `design/marka-panel-denetimi`) — elle deneme bekliyor |
| [WO-025](WO-025-word-gibi-tablo.md) | Word gibi tablo: ızgaradan ekle, belgede düzenle, Word'e gerçek başlıkla (WO-019 Faz 1 arayüzünün yerine) | P3 | Çalışıyor (19.10.2026) |
| [WO-026](WO-026-arayuz-sadelestirme.md) | Arayüz sadeleştirme: taslak satırları, kenar çubuğu K1, yazım çubuğu Y1 + bilgi kartları, arama A2 + AI geçişi | P1 | Çalışıyor (19.10.2026) |
| [WO-027](WO-027-yapay-zeka-gecidi.md) | Yapay zekâ geçidi: tek kapı, kullanıcının anahtarı her çağrıda, Claude/Kimi/OpenAI; consensus açığı | P1 | Bitti, gerçek sağlayıcı denemesi bekliyor (19.10.2026, `wo-027-ai-gecit`) |
| [WO-028](WO-028-sekil-grafik-taslak-alan.md) | Şekil ve grafik: Napkin gibi belgede taslak alan, Tamam ile ekle | P3 | Bitti, elle deneme bekliyor (19.10.2026, `wo-028-sekil-grafik`) |
| [WO-029](WO-029-veri-kaynaklari.md) | Veri kaynakları: durum matrisi (`docs/sources.md`) ve atıf penceresi (tüzük 2.7) | P1 | Bitti, elle deneme bekliyor (20.10.2026, `wo-029-veri-kaynaklari`) |
| [WO-030](WO-030-sadelestirme-turu-1.md) | Sadeleştirme turu 1: nesne denetimi (Düzenle/Sil), sabit biçim çubuğu, panel düğmeleri, kenar listeleri, şekil görünümü | P1 | Bitti, elle deneme bekliyor (20.10.2026, `wo-030-sadelestirme`) |
| [WO-031](WO-031-tablo-tasarimi.md) | Tablo tasarımı: Word gibi tema galerisi (20 tema) + Başlık/Toplam/Bantlı/İlk sütun; Word’e gölge ve tblLook | P3 | Bitti, elle deneme bekliyor (21.10.2026, `wo-031-tablo-tasarimi`) |
| [WO-032](WO-032-sekil-sablonlari.md) | Şekil ve grafik şablonları: galerinin tamamı (20 yeni), şablon şeridi, içerik korunarak şablon değiştirme | P3 | Bitti, elle deneme bekliyor (21.10.2026, `wo-031-tablo-tasarimi`) |
| [WO-033](WO-033-sekil-renk-temalari.md) | Şekil ve grafik renk temaları: küçük resimli galeri (21 tema), bütün şekillere uygula, belgede fırça | P3 | Bitti, elle deneme bekliyor (21.10.2026, `wo-031-tablo-tasarimi`) |
| [WO-034](WO-034-katmanli-liste.md) | Şekil taslağında katmanlı liste: minik ↳ ile 1.1, 1.1.1; sayı sınırı yok; görseller iç içe çizer | P3 | Bitti, elle deneme bekliyor (21.10.2026, `wo-031-tablo-tasarimi`) |

**Yol haritası (17.10.2026):** `docs/design/yol-haritasi.md`. Görünür sonuç
sırası: WO-011 kontrolü → galeri kararları → WO-017 → WO-018 → WO-019 →
WO-008 → WO-020 (köprü) → WO-021 (WO-E2) → WO-022 (WO-C) → WO-B → WO-007/015. WO-019 (çizici)
WO-008'den önce: dışa aktarılacak şekil olmadan WO-008 görünür sonuç vermez.

**Görselleştirme sırası (kullanıcı kararı 17.10.2026):** WO-016 ve S1
(Infographic denemesi, iş emri değil, ayrı onayla) paralel → WO-008 → WO-B
(veriden görseller) → WO-C (PR6.v2 + E5) → WO-D (çizim motoru). Plan:
`docs/design/gorsellestirme-plani.md`. WO-B/C/D numarası yazılınca verilir.

**WO-008 kapsam notu (17.10.2026):** recharts'a özgü değil; her SVG şekil
ve grafik Word/PDF'e girer.
- Word'e **SVG + PNG yedeği** birlikte gömülür. Projedeki `docx` 9.6.1 bunu
  destekliyor ve yedeği zorunlu tutuyor (`docx/dist/index.d.ts:2832-2839`,
  `type: "svg"` + `fallback`). Yeni Word vektörü, eski Word / LibreOffice /
  Google Docs PNG'yi kullanır. PNG ≥ 300 dpi.
- PNG'ye çevirmeden önce yazı tipleri yüklenmiş olmalı **ve SVG'ye
  gömülmeli**: SVG resim olarak çizilirken sayfanın yazı tiplerini görmez.
- **Yazı tipi lisansı:** şekle gömülen yazı tipi açık lisanslı olur
  (Liberation Serif — Times New Roman ile aynı ölçüler — ya da Noto
  Serif/Sans). Times New Roman gömülmez, sunucudan sunulmaz. Lisanslar iş
  emrinde okunup yazılır.
- Test iki katmanlı: (a) SVG'de `@font-face` var ve yazı tipi ğ ş ı İ ç ö ü
  karakterlerini içeriyor (kırılmaz test); (b) PNG referans görüntüyle küçük
  toleransla karşılaştırılır.

**S1'den gelen çizici ölçütleri (kullanıcı kararı 17.10.2026; WO-008 ve
yazılınca WO-D kabulüne girer).** S1 kaldı; kendi SVG çizicimizle devam.
1. **`foreignObject` yasak.** Metin yalnız `<text>` / `<tspan>`; satır kırma
   bizim kodumuzda. (S1: Infographic kart yazılarını `foreignObject` içinde
   HTML olarak koyuyordu.)
2. **Metin genişliği gömülü yazı tipiyle, yazı tipi yüklendikten sonra
   ölçülür.** Kelime ortasında kırma yok; "İlişki" gibi Türkçe kelimelerle
   test. (S1: sabit ölçü tablosu yüzünden "İlişk / i" bölündü —
   `docs/design/s1/`.)
3. **Noto Sans (OFL-1.1) gömülü ve küçültülmüş; sıfır dış istek testi.**
   Ölçülen: latin 13,1 KB, latin-ext 55,6 KB (woff2). Küçültme kararı
   (17.10.2026): fonttools + `brotli` yalnız derleme aracı; woff2 bir kez
   üretilip commit edilir, betik (`client/scripts/subset-font.py`) repoda
   kalır; uygulamaya bağımlılık eklenmez. Karakter kümesine Yunan harfleri,
   matematik simgeleri ve üst simge rakamlar dahil (α β χ η μ σ ≤ ≥ ± × √ ⁰–⁹;
   istatistik çıktıları için).
4. **Elle doğrulama: Ahmet** — dışa aktarılan DOCX'in Word ve LibreOffice'te
   açılıp şekillerin yazılarıyla doğru göründüğü elle kontrol edilir; WO-008
   bu kontrol yapılmadan Bitti'ye geçmez. `opentype.js` (metni çizgiye
   çevirme) şimdilik yok; ancak bu kontrol gerektirirse açılır.

**Dallar (17.10.2026, kullanıcı kararı).** Birleştirme sırası:
`wo-design-recovery` → `wip-bolunmus` → `wo-011-yazar-modu` →
`wo-016-gorsel-yapi-yeni` → `wo-008-sekil-gomme`. Eski tek parça WIP
(`b1fab98`) dört commit'e bölündü; bölme ve yeniden kurmadan sonra
`git diff 7456d7e 3393081` (eski ve yeni WO-016 ucu) boş çıktı. Bölme öncesi
hâl `yedek/wip-bolme-oncesi` (= `7456d7e`) olarak uzak depoda; eski
`wo-006-istatistik` ve `wo-016-gorsel-yapi` dalları da yedek olarak duruyor,
yeni iş onların üzerine yapılmaz. Ana dala hiçbir şey birleştirilmedi.

Denetim bittikten sonra açılacak iş emirleri, denetim raporundaki kritik
sorun listesinden türetilir. Önceden yazılmaz — neyin bozuk olduğunu bilmeden
iş emri yazmak, tahmine kapsam vermektir. WO-006 bu kuralın dışında:
kullanıcı kararıyla (2026-10-14) denetimden bağımsız açıldı ve hiçbir mevcut
dosyaya dokunmadığı için denetimle çakışmıyor.

**Numara çakışması — çözüldü (2026-10-14).** 13.10.2026 tarihli mimari fark
analizi "belge yüzeyi" ve "kanıt paneli" işlerini WO-002 ve WO-003 diye
numaralıyordu; o numaralar burada başka işlere verilmiş. Numara yeniden
kullanılmadığı için o iki iş **WO-004 ve WO-005** oldu. Analiz belgesindeki
eski numaralar bu tabloyla okunur.

**WO-006 → 007 → 008 sırası bağlayıcıdır.** İstatistik çekirdeği arayüzden
önce gelir: yanlış bir hesap, güzel bir panelin arkasında aylarca fark
edilmez. WO-007 ve WO-008, WO-006 READY olmadan Hazır'a geçmez. WO-006
14.10.2026'da READY oldu; WO-009 (mühendislik analizleri) aynı kuralla onun
ardından yazıldı ve aynı gün READY oldu. İkisi de **arayüzsüz**: kullanıcı
hesapları henüz göremiyor, o WO-007'nin işi.

**İstisnalar.** WO-002 (2026-10-10) ve WO-003 (2026-10-13) kullanıcı kararıyla
denetimden önce açıldı. İstisna her zaman iş emrinin "Ön koşul" satırına
yazılır; yeni istisna yalnızca kullanıcı kararıyla açılır.

**Sıra notu.** WO-001'in ön koşulu temiz çalışma ağacıdır. WO-002'nin commit
edilmemiş değişiklikleri dururken WO-001 başlatılamaz: önce WO-002 commit
edilir ya da bir kenara alınır.

## Yeni iş emri yazarken

`_TEMPLATE.md` kopyalanır. Üç bölüm boş bırakılamaz:

- **Dokunulabilecek dosyalar** — boşsa ajan her yere dokunur
- **Kabul kriterleri** — ölçülemez madde yazılmaz ("iyileştirildi" değil,
  "şu test geçiyor")
- **Geri alma** — nasıl dönüleceği bilinmeyen iş başlatılmaz

## Ekip notu (karar bekliyor)

`main`'e doğrudan push, iş emri disiplinini tek taraflı bırakıyor ve WO-001'in
"temiz ağaç" koşulunu her seferinde bozuyor. İki yol var: iki geliştirici de
iş emriyle, dal + PR ile çalışır (GitHub'da `main` için dal koruması), ya da
`main` korumasız kalır ve bu risk bilerek kabul edilir.
