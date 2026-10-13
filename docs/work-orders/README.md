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
| [WO-001](WO-001-denetim.md) | Salt okunur teknik ve ürün denetimi | P0 | Hazır |
| [WO-002](WO-002-arastirmaci-paneli.md) | Araştırmacı paneli: arama kartından ayrı panel | P1 | Çalışıyor — istisna |
| [WO-003](WO-003-calisma-alani-iskeleti.md) | Çalışma alanı iskeleti: belge editörü ve sayfa ayarları | P1 | Taslak — istisna |

Denetim bittikten sonra WO-002 ve sonrası, denetim raporundaki kritik sorun
listesinden türetilir. Önceden yazılmaz — neyin bozuk olduğunu bilmeden iş
emri yazmak, tahmine kapsam vermektir.

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
