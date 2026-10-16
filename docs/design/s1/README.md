# S1 kanıtları — AntV Infographic denemesi (17.10.2026)

Karar ve ölçüt tablosu: `../gorsellestirme-plani.md` §5 "S1 sonucu".
Ortam: `@antv/infographic@0.2.20`, Chromium (Playwright), geçici kurulum —
repoya girmedi. Yerel olmayan her istek **kaydedildi ve engellendi**; test
sırasında dışarı veri gitmedi.

## Görüntüler

| Dosya | Ne gösteriyor |
| --- | --- |
| `baslik-bolunmesi-ilisk-i.png` | "İlişki" başlığı "İlişk / i" diye bölündü. Neden (kod okunarak): metin genişliği sabit ölçü tablosuyla (`measury`; Alibaba PuHuiTi, Arial…) hesaplanıyor, çizimdeki yazı tipiyle değil |
| `daire-dugum-etiket-cakismasi.png` | Basit daire düğümlü ilişki şablonu: düğüm adları yok, iki ok etiketi üst üste ("zayıflatır" / "dalgalandırır") |
| `png-turkce-dogru.png` | Yerel Noto Sans gömülü PNG dışa aktarımı: ğüşıöç İĞÜŞÖÇ doğru |

## Ağ kaydı özeti

| Senaryo | Ayar | Dış istek |
| --- | --- | --- |
| A | Hiçbir ayar yok, simgesiz şablon | 6 — `assets.antv.antgroup.com/{AlibabaPuHuiTi-Regular, AlibabaPuHuiTi-Bold, SourceHanSansCN-Regular, SourceHanSerifCN-Regular, LXGWWenKai-Regular, 851tegakizatsu-Regular}/result.css` |
| B | Yerel Noto Sans + yerleşik yazı tipleri dosyasız yeniden kayıtlı | **0** |
| C | B + simgeli şablon, simge yükleyicisi yok | 2 — `www.weavefox.cn/api/v1/infographic/icon?text=flash+fast&topK=1`, `…?text=shield+check&topK=1` |
| D | C + her simgeye yerel yer tutucu döndüren yükleyici | **0** |
| E | C + yükleyici `null` döndürüyor | 2 — weavefox (C ile aynı): yükleyici boş dönerse yedek arama devreye giriyor |
| F | Simgeli şablon, veride simge yok, yerel yükleyici | **0** |
| G | İlişki akışı (ok etiketli), yerel yazı tipi + yükleyici | **0** |
| H | Düzenleyici açık, yerel yazı tipi + yükleyici | **0** |

Yazı tipi gömme: yalnız CSS `Ad/result.css` düzeninde ve `unicode-range`
tarayıcının biçiminde (`U+100-2BA`, baştaki sıfırsız) yazılınca çalıştı;
standart `@fontsource` CSS'iyle sessizce boş kaldı.

Kart yazıları dışa aktarılan SVG'de `foreignObject` içinde HTML (ana örnekte
7 adet). Word/LibreOffice davranışı burada denenmedi.

Boyut (gzip): hazır paket 283,7 KB; esbuild ile ayıklanmış 293,6 KB; doğrudan
sınıf içe aktarma 294,6 KB. Sınır 200 KB.
