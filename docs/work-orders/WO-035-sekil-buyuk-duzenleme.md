# WO-035 — Şekil için büyük düzenleme (Napkin gibi): bütün şekil

| Alan | Değer |
| --- | --- |
| Durum | Bitti, elle deneme bekliyor (21.10.2026) — kullanıcı: "Napkin gibi şekille oynayabilsek, boyutuyla; minik sağ üstüne düzenle tuşu, o panel boyutuna gelir, Tamam deyince panele döner"; kapsam: "önce bütün şekil" |
| Kapsam | İstemci (taslak alanı, belge, Word dışa aktarımı) |
| Yol haritası aşaması | P3 |
| Dal | `wo-031-tablo-tasarimi` |

## Ne yapıldı
- Önizlemenin sağ üstünde minik "Düzenle". Tıklayınca önizleme taslak alanının tamamına büyür.
- Büyük düzenleme ekranında:
  - Beyaz sayfa sütunu içinde şekil.
  - Sağ kenarında sürükleme tutamacı; ok tuşlarıyla da çalışır.
  - Belgedeki genişlik kaydırıcısı (%30–100, 5'in katları).
  - Yazı boyutu (yeni "Çok büyük" dahil), köşe ve desen.
  - "Tam genişlik" ve "Tamam". Esc taslağı kapatmaz, panele döndürür.
- Genişlik şekille saklanır (`data.appearance.width`):
  - Belgede şekil o yüzde genişlikte ve ortalıdır.
  - Word'de aynı oran kullanılır (580 px sütunun yüzdesi).
  - %100'de öznitelik yazılmaz; eski kayıtlar aynı kalır.

## Testler (21.10.2026)
- Birim: genişlik sınırı ve yuvarlama, bilinmeyen değer, varsayılan; genişlik çizimi değiştirmez.
- e2e: Düzenle → tutamaç klavyeyle %60 → Esc panele döner (seçim kalır) → Tamam → belgede `data-width="60"` ve `width:60%` → Word'de görüntü 348 px.
- Tam kontrol: lint temiz; birim 364/364; e2e 116 geçti, 3 atlandı.

## Bilinen eksikler
- Öğe öğe düzenleme (tek kutuyu sürükleme ve boyutlandırma) yok; kapsam kararı "önce bütün şekil".
- Yükseklik ayrı ayarlanmaz; şekil oranını korur.

**Durum:** NEEDS ATTENTION — testler geçti; elle deneme bekliyor.
