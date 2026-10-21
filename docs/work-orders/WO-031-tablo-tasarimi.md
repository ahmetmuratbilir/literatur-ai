# WO-031 — Tablo tasarımı: Word'ün Tablo Tasarımı gibi tema galerisi ve seçenekler

| Alan | Değer |
| --- | --- |
| Durum | Bitti, elle deneme bekliyor (21.10.2026) — kullanıcı: "tablo tasarımlarını … ekle"; temaların hepsi onaylı (20.10.2026) |
| Kapsam | İstemci (tablo araç çubuğu, belge CSS'i, Word dışa aktarımı) |
| Yol haritası aşaması | P3 |
| Dal | `wo-031-tablo-tasarimi` |
| Kaynak | `docs/design/tema-ve-tablo-tasarimi.md` §4, `docs/design/mockup-paletler.html` |

## Ne yapıldı
- `tableThemes.js`: 20 tema (APA, Kitap çizgisi, Akademik ızgara, Baskı grisi, 16 renkli tema). Tek kaynak: ekran CSS'i (`themeCss`) ve Word görünümü (`cellLook`, `tableBorders`) aynı veriden.
- Tablo araç çubuğunda "Tasarım": küçük önizlemeli tema galerisi + Başlık satırı / Toplam satırı / Bantlı satırlar / İlk sütun. Renkli temalar "APA dışı" etiketli; galeri notu APA'yı söyler.
- Tema ve seçenekler tabloya veri olarak yazılır (`data-theme`, `data-total`, `data-band`, `data-firstcol`); her değişiklik tablonun kopyasıyla yerine yazılır, Ctrl+Z geri alır.
- Word: hücre gölgesi, başlık yazı rengi, kenarlıklar ve `tblLook` (Word'ün Tablo Tasarımı kutuları). Tema seçilmemiş tablonun çıktısı bayt bayt eskisiyle aynı (eski yol korunur).

## Testler (21.10.2026)
- `client/tests/tableThemes.test.js` 4/4.
- `client/e2e/table-design.spec.js`: tema, seçenekler, ekran renkleri, Ctrl+Z, Word XML'i (gölge, beyaz yazı, tblLook).
- word-table ve object-controls e2e geçti.

## Bilinen eksikler
- Ctrl+Z sonrası galeri kapanabiliyor (tablo yeniden yerine konuyor); yeniden açılır.
- Gerçek bir Word / LibreOffice'te açılıp bakılmadı; XML doğrulandı.
- Tema galerisi ekranda gezinen bir önizleme (üzerine gelince geçici uygulama) yok; tık ile uygulanır.

**Durum:** NEEDS ATTENTION — testler geçti; elle deneme ve Word'de açma bekliyor.
