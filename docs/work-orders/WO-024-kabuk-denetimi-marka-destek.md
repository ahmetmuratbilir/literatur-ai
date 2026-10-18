# WO-024 — Kabuk denetimi, marka ve destek

| Alan | Değer |
| --- | --- |
| Durum | **Bitti** (18.10.2026, `design/marka-panel-denetimi`; kullanıcı onayı sohbette: "full erişim izni veriyorum, bana soru sorma") |
| Kapsam | Çapraz (istemci kabuğu, marka varlıkları, iki yeni sunucu ucu) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 1 oturum |
| Ön koşul | WO-017 (tek panel kabuk), WO-018 (etkileşim altyapısı) |
| Yol haritası aşaması | P1 |
| Dal | `design/marka-panel-denetimi`, `chore/dalga-0-hijyen` ucundan; push yok |

## Problem
Kullanıcı isteği (18.10.2026): logo (şimşek kalsın, daha iyi olsun); arama
sonucunda hâlâ görünen Scopus; panelin tuş tuş denetimi (çalışıyor mu, bilgi
kartı var mı), tasarımcı gözüyle düzen, boşluk, gereksiz çizgi, kaydırma
çubuğu, okunabilirlik; yazılımcı gözüyle kod ve performans; yardım ve destek
düğmesi (info@ adresine geri bildirim); ilk girişte tanışma soruları; AHP'ye
TOPSIS/ELECTRE eklenmeli mi yorumu; akademisyen ve öğrenci için eksikler.

Denetim (sahte API, 11 ekran, her tuş ayrı ayrı tıklandı) ve kod okuması
şunları buldu:
1. `AiConnections.jsx:39` yanıtı şekline bakmadan duruma yayıyordu;
   `connections` gelmeyince `.find` patlıyor, hata sınırı olmadığı için
   **bütün uygulama beyaz sayfaya** dönüyordu.
2. `ResultCard.jsx:227` BibTeX: pano izni yoksa sessizce hiçbir şey olmuyordu.
3. `Workspace.jsx:1793` "Atıf ekle": imleç belgede değilse sessiz `return`.
4. Yazım yüzeyi `document.body`'ye çiziliyor; arkadaki araştırma görünümü
   görünmüyor ama Tab ile içine gidiliyordu.
5. Simge düğmelerinde ipucu yok; ~84 yerde tarayıcının yavaş `title` kutusu.
6. 24 px altı tıklama hedefleri (taslak işlemleri 20 px, kenar işareti 6 px).
7. Kontrast 3.07–4.47:1 sekiz yerde; kenar çubuğunda 10.5–11 px yazı.
8. Sonuç ekranında ilk sonuç ekranın altında (y ≈ 1000).
9. Kenar çubuğu: bölüm ve sekme aynı görünüyordu (iki "seçili"); ayar
   sekmelerin arasında; daralt düğmesi içeriğin üstünde; koyu zemine açık gri
   kaydırma çubuğu çizen genel `aside div` seçicisi; kopyalanmış CSS,
   `transition: all !important`; bütün stil satır içi, hover JS ile.
10. `useExport.js` docx + html2pdf'i (jsPDF + html2canvas) statik içe
    aktarıyordu; ayrıca `manualChunks` nesne biçimi Vite'ın önyükleme
    yardımcısını PDF parçasına koyuyordu: açılışta 2.9 MB PDF parçası çekiliyordu.
11. CSV dışa aktarımı boş alanlara "undefined" yazıyordu; `= + - @` ile
    başlayan dış kaynak metni Excel'de formül olarak çalışabiliyordu.
12. Yalnız `year` taşıyan kayıtlarda kart "Yıl bilinmiyor" diyordu (`yearDisplay.js`).
13. Kenar çubuğu "AI analizleri" model ürettiği %70–99 "uygunluk" puanını yüzde gibi gösteriyordu (2.8).
14. Kayıt ve demo e-postaları "Scopus", "300 milyondan fazla", "7 global veri
    tabanı", "1 Aylık Pro Deneme Tanımlandı" diyordu; demo ucu hiçbir deneme tanımlamıyor.
15. Sekme simgesi 7 Ekim'e kadar `/scopus_logo.svg` idi; `favicon.ico` 404,
    iOS simgesi SVG, paylaşım görseli yok, `sitemap.xml` yok, logo metninde "ü" yok.

## Kapsam
### Dahil
Yukarıdaki 15 bulgunun düzeltilmesi; yeni marka işareti ve simge seti;
yardım ve destek penceresi + `/api/feedback`; tanışma soruları +
`/api/me/onboarding`; ipucu katmanı; hata sınırı; testler; üç değerlendirme
belgesi (`docs/design/marka.md`, `siralama-yontemi-degerlendirmesi.md`,
`eksikler-akademisyen-ogrenci.md`).
### Hariç (rapora yazıldı, dokunulmadı)
- Sunucu prompt'ları: `llm.js` konsensüs puanı (60–98) ve sorgu analizi uygunluğu (70–99) modelden isteniyor.
- `/api/demo/welcome` ucunun kapatılması (girişsiz e-posta gönderiyor).
- `recharts` bağımlılığının kaldırılması (hiç içe aktarılmıyor; kural 6).
- `Workspace.jsx` (3000+ satır) ve `App.jsx` parçalanması.
- CSS dosyalarındaki bozuk kodlanmış Türkçe yorumlar.

## Dokunulabilecek dosyalar
İstemci: `index.html`, `vite.config.js`, `public/*` (simge seti, manifest,
robots, sitemap; `vite.svg` silindi), `src/main.jsx`, `src/index.css`,
`src/App.jsx`, `src/components/{HistorySidebar,ResultCard,ExportMenu,HelpDialog,OnboardingDialog}.jsx`,
`src/components/InfiniteTicker.jsx` (silindi), `src/components/landing/LandingPage.jsx`,
`src/components/settings/AiConnections.jsx`, `src/components/workspace/Workspace.jsx`,
`src/components/ui/{BrandMark,CrashFallback,ErrorBoundary,TooltipLayer}.jsx`,
`src/components/ui/{useModal.js,DialogProvider.jsx}`, `src/hooks/useExport.js`,
`src/utils/{clipboard,yearDisplay}.js`, `src/i18n/{tr,en}.js`,
`src/styles/{shell,sidebar,workspace,components,states}.css`,
`e2e/support.spec.js`, `tests/{exportCsv,yearDisplayFallback}.test.js`.
Sunucu: `index.js`, `config/onboarding.js`, `routes/{feedback,onboarding}.js`,
`models/{Feedback,UserProfile}.js`, `services/emailService.js`,
`tests/{feedback,onboarding}.test.js`.
Belgeler: bu dosya, `README.md`, `docs/design/{marka,siralama-yontemi-degerlendirmesi,eksikler-akademisyen-ogrenci}.md`,
`docs/design/mockup-ana-sayfa-v9.html` (işaret).

## Yaklaşım
- **Araştırma:** tasarım için `VoltAgent/awesome-design-md` (122k ★; Linear
  ve Notion tasarım sistemleri) ve `vercel-labs/web-interface-guidelines`;
  yazılım için `goldbergyoni/nodebestpractices` (106k ★) ve
  `alan2207/bulletproof-react` (36k ★). Eleştirel süzgeç: Linear'ın "yalnız
  koyu tema / ikinci vurgu yok" kuralı uygulanmadı (kanıt sınıfları renkle
  anlam taşıyor); Vercel'in "ipucu son çare" ilkesi, kullanıcının "her
  tuşun bilgi kartı" isteğiyle şöyle uzlaştırıldı: simge düğmelere ipucu +
  erişilebilir ad, etiketi açık düğmelere gereksiz ipucu yok.
- **İpucu:** tek genel katman (`TooltipLayer`); `title` yalnız gösterim
  sırasında geçici kaldırılır ve geri konur (erişilebilir ad ve
  `shell.spec.js:65` özgün değeri görür). İlk ipucunda 420 ms gecikme,
  komşuya geçince gecikme yok, klavye odağında açılır, Esc kapatır.
- **Pencere davranışı:** `DialogProvider` içindeki odak tuzağı/inert/Esc
  mantığı `useModal` kancasına çıkarıldı; yardım ve tanışma pencereleri aynı
  kancayı kullanır (kopya mantık yok).
- **Geri bildirim:** `/api/leads` kalıbı (önce kaydet, sonra e-posta; biri
  başarılıysa alınmış); kullanıcı başına 10 dakikada 5; e-posta adresi
  gövdeden değil Clerk'ten, yalnız dönüş izni varsa.
- **Tanışma:** yalnız sabit seçenekler, atlanabilir, veritabanı yoksa hiç
  sorulmaz (cevap saklanamaz, her girişte sorulurdu); `UserProfile.onboarding`
  ek alan (göç gerekmez).
- **Sunucu uçları** `aiConnections` kalıbında bağımlılık alan router
  fabrikaları: veritabanı ve e-posta olmadan birim testi yazılabiliyor;
  `index.js`'e yalnız bağlantı satırları eklendi.

## Kabul kriterleri
- [x] 15 bulgunun her biri düzeltildi ya da "Hariç"te gerekçesiyle yazıldı
- [x] Hiçbir ekranda JS hatası, beyaz sayfa, yatay taşma yok (denetim)
- [x] Simge düğmelerinin hepsinde ipucu + erişilebilir ad
- [x] Kenar çubuğunda kontrast ≥ 4.5:1, yazı ≥ 12 px
- [x] Açılışta PDF/Word kütüphaneleri yüklenmiyor
- [x] İlgili testler yazıldı ve geçti (e2e 8, sunucu 11, istemci birim 5)
- [x] Mevcut testler bozulmadı (e2e 83 → 91 geçti)
- [ ] Bölüm 4 regresyon seti — **çalıştırılmadı**: prompt ve model değişikliği yok
- [x] Bölüm 3 ihlali yok

## Test planı
| Test | Nasıl | Beklenen |
| --- | --- | --- |
| İstemci birim | `npm test` (client) | 328/328 |
| Lint, i18n | `npm run lint`, `npm run check-i18n` | temiz |
| E2E | `npx playwright test` | 91 geçti, 1 atlandı |
| Sunucu | `npm test` (server) | 453/453 |
| Derleme | `npx vite build` | Linux CI'da tam; bu Windows makinede esbuild geçici dosyası antivirüse takılıyor (WO-024 öncesi de böyle, `f166a52`'de doğrulandı); `--minify false --target esnext` ile derleniyor |
| Elle | Kenar çubuğu, yardım, tanışma (sunucu `needed:true` dönmeli), BibTeX, sonuç ekranı | — |

## Ölçüm
| Metrik | Öncesi | Sonrası |
| --- | --- | --- |
| Açılışta yüklenen JS (küçültmesiz, gzip) | 933 KB, 5 dosya | 386 KB, 2 dosya |
| Denetim: sorunlu tıklama (gerçek hata) | 4 (BibTeX ×2, Atıf ekle, beyaz sayfa) | 0 (kalan "etkisiz" tıklamalar zaten seçili sekme/dil ve bilerek `inert` yapılan arka plan) |
| Denetim: düşük kontrast (11 ekran toplamı) | 20 | 0 |
| Denetim: 12 px altı yazı (toplam) | 52 | 32 (yazım yüzeyinin kendi yoğun panelleri; kenar çubuğu 0) |
| Denetim: ipucusuz simge düğmesi (ekran toplamı; 4 farklı düğme) | 7 | 0 (denetimde 1 çıktı: "Kapat"; ardından düzeltildi) |
| Denetim: 24 px altı tıklama hedefi (toplam) | 13 | 0 gerçek: 5 ölçüldü; 4'ü kenar işareti (görsel 6 px, `::before` ile 24 px; araç sözde öğeyi ölçmüyor), 1'i ardından düzeltildi |
| Sonuç ekranında ilk sonucun konumu (1440×900) | ≈ 1000 px (ekran dışı) | ≈ 740 px |
| Yardım/tanışma kullanımı | yok | ölçülmedi (yayın sonrası `Feedback` ve `UserProfile.onboarding`) |

## Geri alma
Dal tek commit grubu; `git revert` ile dönülür. Veritabanında yalnız ekleme
var: `feedbacks` koleksiyonu ve `UserProfile.onboarding` alanı; geri
alındığında okunmaz, silmek gerekmez.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Tanışma penceresi ilk girişte rahatsız eder | Orta | Düşük | Atlanabilir, tek sefer, oturumda bir daha sorulmaz |
| Geri bildirim spam | Düşük | Düşük | Girişli kullanıcı, 10 dk'da 5, 2000 karakter |
| Google simgesinin güncellenmesi gecikir | Yüksek | Düşük | `docs/design/marka.md`: Search Console adımları |
| Kenar çubuğu yeniden yazımında görsel gerileme | Düşük | Orta | e2e 91 geçti; elle deneme gerekli (CLAUDE.md: elle denenmeyen arayüz main'e alınmaz) |

## Onay gereken noktalar
Yayın (push), `recharts` kaldırma, `/api/demo/welcome` kapatma, sunucu
prompt değişiklikleri: kullanıcıya bırakıldı.

## Bitiş raporu
- Değişen dosyalar: yukarıdaki liste (28 değişen, 31 yeni, 2 silinen).
- Teknik kararlar: "Yaklaşım" bölümü.
- Çalıştırılan testler: "Test planı" (hepsi bu oturumda koşuldu).
- Ölçülen etki: "Ölçüm".
- Bilinen eksikler: "Hariç" bölümü; yerel Windows derlemesi (antivirüs).
- Sonraki adım: elle deneme → `docs/design/eksikler-akademisyen-ogrenci.md` madde 1 (taslakları sunucuda saklama).
- **Durum:** NEEDS ATTENTION — testler geçti, ama arayüz değişikliği elle denenmeden main'e alınmamalı ve "Hariç"teki iki dürüstlük sorunu (prompt puanları) açık.
