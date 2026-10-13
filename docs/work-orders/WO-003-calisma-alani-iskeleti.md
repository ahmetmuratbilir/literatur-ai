# WO-003 — Çalışma alanı iskeleti: belge editörü ve sayfa ayarları

| Alan | Değer |
| --- | --- |
| Durum | Taslak |
| Kapsam | Tek modül (yalnızca istemci) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 1–2 oturum |
| Ön koşul | WO-002 commit edilmiş olmalı (ikisi de `App.jsx` sekmelerine dokunuyor). **İstisna:** README'ye göre WO-001'den türetilirdi; kullanıcı kararıyla (2026-10-13) önce açıldı |
| Yol haritası aşaması | P1 |

## Problem

Araştırma ve yazım ayrı yerlerde, kullanıcının kendi belgesi için biçim yok:

- Yazım, sağdan açılan 420 px'lik bir panelde
  (`client/src/components/WriterPanel.jsx:156`) arama ekranının üstüne
  açılıyor; belge ancak üretimden sonra tam ekran görünüyor.
- Kullanıcının kendi metnini yazıp biçimlendirebileceği bir editör yok: yazı
  tipi, kalınlık, başlık, sayfa ayarı (kağıt boyutu, yön, kenar boşluğu) yok.
- Tasarım (`docs/design/atif-dogrulamali-yazim-motoru.md`, Arayüz yerleşimi)
  tek çalışma alanı istiyor: solda belge, sağda kanıt paneli. Bugün yok.

## Neden şimdi

Kanıt paneli, kendi cümlenle anlat, kavram haritası gibi sonraki her araç bu
alanın sağ paneline oturacak (`docs/design/calisma-alani.md`). İskelet AI
içermediği için 2.2 ve 3.1'e dokunmadan, düşük riskle kurulabilir.

## Kapsam

### Dahil

- Üst sekmelere "Çalışma alanı" (mevcut `mode` kalıbı, `client/src/App.jsx`)
- İki bölmeli düzen: solda belge, sağda sekmeli panel. Bu iş emrinde sağ
  panelde yalnız **Kaynaklar** sekmesi var (mevcut sepet). Çalışmayan sekme
  gösterilmez.
- Zengin metin editörü: yazı tipi, boyut, kalın, italik, altı çizili, başlık
  1–3, hizalama, satır aralığı, madde ve numaralı liste, geri al / yinele
- Sayfa ayarları penceresi: kağıt boyutu (A4, Letter), yön, kenar boşlukları;
  ekranda sayfa görünümü (sayfa genişliği ve boşluklar)
- Dışa aktarma: .docx (biçim + sayfa ayarlarıyla, projede olan `docx`) ve
  PDF (yazdırma, CSS `@page`)
- Otomatik kayıt: tarayıcıda (`localStorage`), tek belge
- Dar ekranda sağ panel alta iner
- Bayrak: `WORKSPACE_ENABLED` (`client/src/App.jsx`)
- İki anlamlı arayüz adlarının düzeltilmesi: "Yazar modunu aç", "Yazar
  modunda onlarla yazabilir…" (`CLAUDE.md` 2.13)

### Hariç

- Her türlü AI: üretim, doğrulama, kanıt arama, anlama araçları
- Bugünkü yazım paneli (`WriterPanel`, `WriterDock`): yerinde kalır
- Sunucu, veritabanı şeması, belgeyi sunucuda saklama
- Sayfa sayfa bölme (ekranda 1., 2. sayfa), üst / alt bilgi, sayfa numarası
- Şablonlar (APA 7, tez kılavuzu)
Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar

- `client/src/App.jsx` (yalnızca sekme ve bayrak)
- `client/src/components/workspace/` (yeni: `Workspace.jsx`,
  `DocumentEditor.jsx`, `FormatToolbar.jsx`, `PageSetupDialog.jsx`,
  `exportDocument.js`)
- `client/src/i18n/tr.js`, `client/src/i18n/en.js`
- `client/src/styles/ui.css`
- `client/package.json`, `client/package-lock.json` (yalnızca onaylanan
  editör paketleri)
- `docs/work-orders/WO-003-calisma-alani-iskeleti.md` (durum ve bitiş raporu)

## Yaklaşım

1. **Editör:** TipTap çekirdeği ve yalnızca açık lisanslı resmî eklentileri
   (`docs/tools.md`: ileride cümleye `claim_id` çapası bu editöre eklenecek).
   Lisanslar bağımlılık eklenmeden önce okunur ve rapora yazılır.
2. **Tembel yükleme:** çalışma alanı `import()` ile yüklenir; editör ana
   paketi büyütmez.
3. **Sayfa görünümü CSS ile:** seçilen kağıt boyutu ve kenar boşlukları belge
   kabının genişliğini ve iç boşluğunu belirler; yazdırma ve PDF aynı
   ayarları `@page` ile kullanır.
4. **.docx:** projede olan `docx` ile editör içeriği (paragraf, başlık, liste,
   kalın / italik / altı çizili, yazı tipi, boyut) + sayfa boyutu, yön, kenar
   boşlukları.
5. **Kayıt:** editör değişince kısa gecikmeyle `localStorage`'a; okuma ve
   yazma `try/catch` içinde, depolama kapalıysa boş belge açılır.

Alternatifler: Lexical (daha hafif ama ekosistemi küçük; araç dizini TipTap'i
öneriyor), çıplak `contenteditable` (biçim ve geri alma elle yazılır),
TipTap'in ücretli sayfa / dışa aktarma eklentileri (lisans) — seçilmedi.

## Kabul kriterleri

- [ ] `WORKSPACE_ENABLED=true`: üst sekmelerde "Çalışma alanı" var; açınca
      solda belge, sağda Kaynaklar sekmesi
- [ ] Biçim çubuğundaki her düğme seçili metne uygulanıyor ve geri alınabiliyor
- [ ] Sayfa ayarı değişince ekrandaki sayfa genişliği ve kenar boşlukları değişiyor
- [ ] .docx Word'de açılıyor; başlık, kalın / italik / altı çizili, liste,
      yazı tipi, kağıt boyutu, yön ve kenar boşlukları korunuyor
- [ ] PDF / yazdırma seçilen kağıt boyutu ve kenar boşluklarıyla çıkıyor
- [ ] Sayfa yenilenince belge geri geliyor; depolama kapalıyken hata vermeden boş açılıyor
- [ ] Sepetteki makaleler sağ panelde; belgeye kendiliğinden hiçbir şey girmiyor (2.9)
- [ ] Ana paket (`dist/assets/index-*.js`) bugünkü 503,58 kB'tan en fazla %5 büyük
- [ ] `WORKSPACE_ENABLED=false`: davranış WO-002 sonrası ile aynı
- [ ] Sunucu testleri değişmeden geçiyor; `eslint` temiz, `npm run build` geçiyor
- [ ] Bölüm 3 ihlali yok; hiçbir şey push edilmedi

## Test planı

| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Lint / build | `cd client && npm run lint && npm run build` | Temiz / başarılı; paket boyutu rapora |
| Sunucu regresyonu | `cd server && npm test` | Önceki sayıyla aynı |
| Biçim | Bir paragraf yaz, her düğmeyi dene, geri al | Uygulanıyor, geri alınıyor |
| Sayfa ayarı | A4 → Letter, dikey → yatay, kenar 2,5 → 4 cm | Ekrandaki sayfa değişiyor |
| .docx | Dışa aktar, Word'de aç | Biçim ve sayfa ayarları aynı |
| PDF | Yazdır → PDF | Kağıt boyutu ve boşluklar doğru |
| Kayıt | Yaz, sayfayı yenile | Belge yerinde |
| Dar ekran | 375 px | Yatay kaydırma yok, sağ panel altta |

İstemcide otomatik test altyapısı yok; adımlar elle yapılır ve rapora yazılır.

## Ölçüm

| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |
| Ana paket boyutu | 503,58 kB (gzip 157,13 kB) | En fazla %5 artış |

Kalite iddiası yok (AI yok); başka ölçüm yapılmayacak.

## Geri alma

Bayrak `WORKSPACE_ENABLED=false`. Dal main'e girmezse geri almaya gerek yok;
girerse commit grubu `git revert` ile döner. Yeni bağımlılıklar
`package.json`'dan çıkarılır.

## Riskler

| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Kullanıcı "Word gibi sayfa sayfa" bekler; tarayıcıda zor | Yüksek | Orta | Bu iş emrinde sayfa görünümü + doğru .docx / PDF; sayfa bölme ayrı iş emri |
| Editör ana paketi büyütür | Orta | Orta | Tembel yükleme; ölçüm kriteri |
| Gereken TipTap eklentisi ücretli çıkar | Orta | Orta | Yalnız açık lisanslı parçalar; lisans bağımlılıktan önce okunur |
| Belge yalnız tarayıcıda: depolama temizlenirse kaybolur | Orta | Yüksek | Arayüzde açık not; sunucu kaydı ayrı iş emri (şema göçü, kural 6) |
| `App.jsx` çakışması (WO-002) | Orta | Orta | Ön koşul: WO-002 commit edilmiş |

## Onay gereken noktalar

- Taslak → Hazır (kullanıcı)
- Yeni bağımlılık: TipTap paketleri (kural 6) — liste ve lisansları başlamadan sunulur
- Sekme adı: "Çalışma alanı" mı, başka bir ad mı
- Belge saklama: ilk adımda yalnız tarayıcı kabul mü

## Bitiş raporu

Ajan tarafından doldurulur.

- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:** READY / NEEDS ATTENTION / BLOCKED
