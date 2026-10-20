# WO-030 — Sadeleştirme turu 1: nesne denetimi, sabit çubuk, panel düğmeleri, kenar listeleri, şekil görünümü

| Alan | Değer |
| --- | --- |
| Durum | Bitti, elle deneme bekliyor (20.10.2026) — kullanıcı: "yap knk pipeline çıkar planla sonra yap ve kontrol et" |
| Kapsam | İstemci (çalışma alanı, kenar çubuğu, şekil çizici, Word dışa aktarımı) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2 oturum |
| Ön koşul | WO-025, WO-026, WO-028 |
| Yol haritası aşaması | P1 |
| Dal | `wo-030-sadelestirme` |
| Kaynak | `docs/design/sadelestirme-turu-notlar.md` bulgu 1, 2, 4, 5, 6, 7 (Ahmet'in gezintisi, 20.10.2026) |

## Problem
Ahmet'in gezintisinden çıkan bulgular (notlar dosyası, satır satır):
1. Tablo, şekil ve grafikte tek tık düzenleyiciyi açıyor
   (`Workspace.jsx:2033`). Silmek için görünür bir yol yok. (Bulgu 1)
2. Bu öğeler metin gibi Backspace/Delete ile ya da seçimle siliniyor. (Bulgu 4)
3. Belge yapısı kapanınca biçim çubuğu kayıyor. (Bulgu 5)
4. Sağ panel düğmesi Dışa aktar'ın yanında duruyor, belge yapısının
   düğmesiyle aynı mantıkta değil. (Bulgu 6)
5. "Son aramalar" ve "AI analizleri" açık başlıklar. Boşken altlarında
   açıklama kutuları var. (Bulgu 7)
6. Şekil ve grafikte görünüm seçeneği yok. (Bulgu 2)

## Kapsam
### Dahil (fazlar; her faz ayrı commit)
- **Faz 1 (bulgu 7):** Son aramalar ve AI analizleri katlanır satır olur,
  varsayılan kapalı, boşken kutu yok.
- **Faz 2 (bulgu 5, 6):** Biçim çubuğu panellerden bağımsız, sabit konumda
  durur. Sağ panelin aç/kapa düğmesi biçim çubuğundan çıkar. Belge yapısının
  ayna görüntüsü olur: açıkken panel başlığında, kapalıyken sağ kenarda sekme.
- **Faz 3 (bulgu 1, 4):** Tablo, şekil ve grafikte üzerine gelince ve odakta
  Düzenle/Sil simgeleri çıkar. Şekilde tek tık seçer, düzenleyici Düzenle
  düğmesiyle ya da çift tıkla açılır. Backspace/Delete ve öğeyi içine alan
  seçim öğeyi silmez. Sil geri alınabilir (Ctrl+Z ve "Geri al" bildirimi).
  Tablo hücresinde yazma bugünkü gibi kalır.
- **Faz 4 (bulgu 2):** Şekil/grafik taslak alanında Görünüm bölümü: palet,
  desen, köşe ve yazı boyutu. Seçim şekille saklanır, Düzenle'de geri gelir,
  Word'e geçer. Varsayılan bugünkü görünümdür.

### Hariç
- Bulgu 3, yani yeni şablonlar. Ahmet'in galeri seçimini bekliyor.
- Kılavuzdaki diğer ekranlar. Tur sürüyor, sonraki bulgular WO-031'e kalır.

## Dokunulabilecek dosyalar
`client/src/components/HistorySidebar.jsx`,
`client/src/components/workspace/` (Workspace.jsx, FigureDraft.jsx,
TableToolbar.jsx, tableDom.js, exportDocument.js, visuals/draw.js ve yeni
yardımcı dosyalar), `client/src/visuals/`, `client/src/styles/`
(sidebar.css, workspace.css), i18n tr/en, `client/tests/` ve `client/e2e/`
altındaki ilgili testler, notlar dosyası, README, bu dosya.

## Kabul kriterleri
- [x] Faz 1: iki başlık tıklanınca açılır (`aria-expanded`), varsayılan
      kapalı, boşken açıklama kutusu yok.
- [x] Faz 2: belge yapısı açılıp kapanınca biçim çubuğundaki "Atıf ekle"
      düğmesinin x konumu değişmez (e2e ölçer). Sağ panel düğmesi biçim
      çubuğunda değil; panel kapalıyken sağ kenar sekmesi açar.
- [x] Faz 3: şekle tek tık düzenleyiciyi açmaz. Düzenle düğmesi açar.
      Öğenin yanında Backspace/Delete öğeyi silmez. Sil siler. Ctrl+Z ve
      Geri al geri getirir. Word çıktısında simge yok.
- [x] Faz 4: palet seçimi SVG'ye ve Word'e geçer. Düzenle'de geri gelir.
      Varsayılan çıktı değişmez (birim test).
- [x] Lint, birim, e2e geçer. Kırılan eski e2e yeni davranışa göre
      güncellenir ve rapora yazılır.

## Geri alma
Her faz ayrı commit; tek tek revert edilebilir.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| contenteditable'da silme koruması bazı tarayıcı yollarını kaçırır (sürükle, kes) | Orta | Öğe kaybı | `beforeinput` üzerinden tek noktada; geri al her durumda var |
| Çubuğu taşımak eski e2e konum varsayımlarını bozar | Orta | Test | Testler güncellenir |

## Onay gereken noktalar
Yok. Push yok; elle deneme Ahmet'te.

## Bitiş raporu
- Commit'ler: 08571c8 (Faz 1), 7849844 (Faz 2), ea4f7bf (bulgu 8, arama kapsülü — gezinti sırasında eklendi), b63c6ca (Faz 3+4 tek commit: i18n, CSS ve şekil testi iki fazda ortak, temiz bölünmedi).
- Değişen dosyalar: HistorySidebar.jsx, sidebar.css, Workspace.jsx, workspace.css, FigureDraft.jsx, visuals/draw.js, App.jsx (arama formu), shell.css, i18n tr/en; testler: ui-sade, mode, word-table, figure-chart, object-controls (yeni), drawAppearance (yeni).
- Ajan kullanımı (Ahmet izni 20.10): arama kapsülü ve Faz 4 Görünüm iki ayrı ajana yazdırıldı; ekran görüntüleri ve testleri ana oturumda yeniden doğrulandı.
- Çalıştırılan testler (20.10.2026): lint temiz; istemci birim 350/350; sunucu 462/462; e2e 110 geçti, 3 atlandı. Yerel build yalnız --minify false ile alındı (antivirüs esbuild'i kilitliyor), başarılı.
- Bilinen eksikler: şekil seçimi klavyeyle yalnız şekil başlığına imleç koyarak (sonra Tab); Word 365'in kendi SVG çizicisinde desen dolgusu denenmedi (PNG yedeğinde var); çizgi ve zaman çizelgesinde desen yok; bulgu 3 (yeni şablonlar) galeri seçimini bekliyor; Faz 3 ve 4 tek commit.
- **Durum:** NEEDS ATTENTION — testler geçti, Ahmet elle denemedi.
