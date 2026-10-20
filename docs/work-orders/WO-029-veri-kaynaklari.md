# WO-029 — Veri kaynakları: durum matrisi ve atıf sayfası

| Alan | Değer |
| --- | --- |
| Durum | Bitti, elle deneme bekliyor (20.10.2026) — kullanıcı: "devam et" (MVP listesi: kaynak lisans tablosu) |
| Kapsam | Belge + istemci (tek pencere) + bir yorum düzeltmesi |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 1 oturum |
| Ön koşul | Yok |
| Yol haritası aşaması | P1 (canlıya çıkış koşulu, tüzük 2.7 "Atıf yükümlülükleri") |
| Dal | `wo-029-veri-kaynaklari` |
| Kaynak | Ajan raporları 19.10.2026: ücretsiz kaynaklar ve lisanslar (her satırda resmi sayfa + okuma tarihi), kaynak hata teşhisi (canlı 88 çağrı + 6 arama) |

## Problem
- `docs/sources.md` yalnız ORCID'i içeriyor; aranan 11 kaynağın hiçbiri tabloda yok (2.7: dördü olmadan canlıya çıkılmaz).
- Tüzük 2.7 "Atıf yükümlülükleri hepsi tek bir Veri kaynakları sayfasında toplanır ve yayına çıkmadan önce yerine konur" diyor; böyle bir sayfa yok.
- `server/services/search.js:115` yorumu "Ticari aşamada SCOPUS_ENABLED=true yapılır" diyor; tüzük 2.7 Kademe 3 ile çelişiyor.

## Kapsam
### Dahil
- `docs/sources.md`: bugün kodda aranan her kaynak için satır (VERIFIED tarih + resmi sayfa, IMPLEMENTED dosya, TESTED ölçüm sonucu, APPROVED durumu: Evet / Koşullu / Yazılı izin gerekli). Yazılı izin gereken kaynakların listesi; tüzükle kod arasındaki iki çelişki (CORE canlı, arXiv canlı) not olarak — karar Ahmet'te.
- `DataSources.jsx`: "Veri kaynakları" penceresi — her kaynak, ne için kullanıldığı, lisansı ve istediği atıf/bağlantı. Hesap menüsünden ve yardım penceresinden açılır; Esc kapatır (WO-018 katmanı).
- `search.js:115` yorum düzeltmesi (davranış değişmez).

### Hariç
- CORE'u canlıdan çıkarmak, arXiv kademesini değiştirmek (kullanıcı kararı bekliyor).
- Semantic Scholar logosu (resmi görsel dosyası ve marka kuralları ayrıca okunacak; şimdilik metin + bağlantı).
- Hukuki görüş: notlar doğrulama gerektiren notlardır.

## Dokunulabilecek dosyalar
`docs/sources.md`, `client/src/components/DataSources.jsx` (yeni), `client/src/components/AccountMenu.jsx`, `client/src/components/HistorySidebar.jsx` (prop), `client/src/components/HelpDialog.jsx` (bağlantı), `client/src/App.jsx`, i18n tr/en, `client/src/styles/ui.css`, `client/e2e/data-sources.spec.js` (yeni), `server/services/search.js` (yalnız yorum), README, bu dosya.

## Kabul kriterleri
- [x] sources.md'de aranan her kaynağın satırı ve kanıt bağlantısı var; hiçbiri kanıtsız "Evet" değil.
- [x] Pencere hesap menüsünden açılır, Esc kapatır; arXiv teşekkür ibaresi, Semantic Scholar bağlantısı (`utm_source=api`), OpenAIRE CC-BY atfı, DOAJ bağlantısı, OpenAlex atfı, NLM ibaresi görünür.
- [x] Pencerede uydurma sayı yok (kaynak sayısı kod listesinden).
- [x] Lint, birim, e2e geçer.

## Geri alma
Tek commit; revert. Pencere bağımsız.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Atıf metni sağlayıcının istediği metinle birebir değil | Orta | Lisans | Her satırda resmi sayfa bağlantısı; yayından önce Ahmet ya da hukukçu son kontrol |

## Onay gereken noktalar
Yok. CORE/arXiv kararları ayrı.

## Bitiş raporu
- Değişen dosyalar: `docs/sources.md`, `client/src/components/DataSources.jsx` (yeni), `AccountMenu.jsx`, `HistorySidebar.jsx`, `App.jsx`, `i18n/tr.js`, `i18n/en.js`, `styles/shell.css` (ui.css yerine: yardım penceresinin stilleri orada), `client/e2e/data-sources.spec.js` (yeni), `server/services/search.js` (yalnız yorum), README, bu dosya.
- Planından sapma: yardım penceresine bağlantı eklenmedi (giriş: hesap ⋯ menüsü; oturumsuz açık kenar çubuğunda ayrı satır). Rayda simge yok — ray kalabalığı geri bildirimi.
- Çalıştırılan testler (20.10.2026): istemci lint temiz; birim 345/345; sunucu 462/462; e2e 104 geçti, 3 atlandı (yeni `data-sources.spec.js` dahil). `npm run build` bu makinede antivirüs kilidi yüzünden denenmedi.
- Bilinen eksikler: atıf ibareleri sağlayıcı sayfalarından alındı ama yayından önce son okuma Ahmet'te; Semantic Scholar logosu yok (metin + `utm_source=api` bağlantısı); CORE ve arXiv kademe çelişkisi kullanıcı kararı bekliyor; Retraction Watch ve Semantic Scholar için yazılı onay istenmedi.
- **Durum:** NEEDS ATTENTION — testler geçti; atıf metinlerinin son kontrolü ve izin yazışmaları açık.
