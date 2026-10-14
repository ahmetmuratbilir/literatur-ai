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
| WO-005 | Kanıt paneli: pasaj arama ve doğrulama | P2 | Yazılmadı |
| [WO-006](WO-006-istatistik-cekirdegi.md) | İstatistik çekirdeği ve çapraz doğrulama | P3 | **Bitti** (14.10.2026, `wo-006-istatistik`) |
| WO-007 | Analiz sekmesi: veri girişi ve belgeye ekleme | P3 | Yazılmadı |
| WO-008 | Grafik: recharts çıktısı ve docx/PDF'e gömme | P3 | Yazılmadı |
| [WO-009](WO-009-muhendislik-analizleri.md) | Mühendislik analizleri: belirsizlik, yayılım, Monte Carlo, regresyon | P3 | **Bitti** (14.10.2026, `wo-006-istatistik`) |
| [WO-010](WO-010-uygulama-kabugu.md) | Uygulama kabuğu ve yeni tasarıma geçiş (Aşama 0–2) | P1 | Kabuk kararı WO-011 ile geri alındı (15.10.2026) |
| [WO-011](WO-011-yazar-modu.md) | Yazar modu yeniden yapılandırma (şartname Faz 1 → 3 → 2) | P1 | Çalışıyor — Faz 1 ve Faz 3 bitti (15.10.2026) |

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
