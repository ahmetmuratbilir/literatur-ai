# WO-005 — Kanıt doğrulama: yazarın cümlesini kaynak pasajına bağla

| Alan | Değer |
| --- | --- |
| Durum | Taslak (20.10.2026) — Hazır'a geçişi Ahmet onaylar |
| Kapsam | Çapraz (sunucu uç + istemci panel) |
| Dosya değişikliği | İzinli (liste aşağıda) |
| Tahmini süre | 2–3 oturum |
| Ön koşul | Yok (çalışma alanı, sepet, PR3.v1 kodda var) |
| Yol haritası aşaması | P2'ye köprü: özellik P1'de çalışır, kalite iddiası P2 (E2 kümesi) gelmeden yapılmaz |
| Dal | `wo-005-kanit-dogrulama` |

## Problem
Ürünün tek cümlelik tanımı (2.1) "yazarın her iddiasını bir kaynak pasajına
bağlamak". Bugün bu yalnız tersinden çalışıyor:

- Pasajdan üretilen cümle denetleniyor (`server/services/citedSentence.js`,
  PR2.v3 + PR3.v1, `buildVerifyBody` satır 223, `spanInPassage` satır 151).
- **Yazarın kendi yazdığı cümle** için böyle bir yol yok. Teslim kontrolü
  atıfsız iddiayı buluyor (`client/src/audit/audit.js:136`, kural
  `uncitedClaim`), ama "Kaynak ekle" yalnız kaynak listesini açıyor
  (`Workspace.jsx:2823`). Hiçbir pasaj iddiaya karşı denetlenmiyor.
- `Claim` / `Evidence` modeli yok (CLAUDE.md Bölüm 3 başı).

## Neden şimdi
2.3'te ilk sıradaki ayrışma kanıt doğrulama katmanı. MVP listesinin son işi
de bu. Tablo, şekil, arayüz ve kaynak işleri bitti, şimdi sıra çekirdekte.

## Kapsam
### Dahil
1. **Uç:** `POST /api/evidence/check` — girdi: iddia metni + en fazla 5 aday
   (`work_id` + pasaj metni). Her aday için PR3 kararı:
   `supports | partial | irrelevant | contradicts`. Bunlara ek olarak
   `scope_gap` ve `quoted_span` döner. `quoted_span` pasajda birebir yoksa
   karar `supports` olamaz, `partial`'a düşer. Hiçbir aday eşik geçmezse
   cevap `no_evidence` olur (2.4: üç durum ayrı).
2. **Adaylar sepetten:** istemci, sepetteki makalelerin özetlerini ucuz bir
   sözcük örtüşmesiyle sıralar ve ilk 5'i yollar. Bu yeni bir dış çağrı
   değildir. Sepet boşsa panel "önce kaynak seç" der; boş liste
   "kanıt yok" sayılmaz.
3. **Panel:** belgede bir cümle seçilince ya da teslim kontrolündeki
   "Kaynak ekle" eylemiyle, sağ panelde "Kanıt" görünümü açılır. Her adayda:
   - destek şekli + metni (`evidence.js` SUPPORT_SHAPES),
   - pasaj, içinde `quoted_span` vurgulu (`locateSpan`),
   - kapsam farkı,
   - "Bu kaynağı bağla" düğmesi.

   Bağlanınca atıf doğrulanmış kayıttan kurulur (`citation.js`) ve belgeye
   yalnız bu tıklamayla girer (2.9). `contradicts` ve `irrelevant` için bu
   düğme yoktur. `partial` için düğme vardır, yanında uyarı durur.
4. **Kayıt:** bağlantı taslak içinde tutulur:
   `claim_id`, iddia metni (değişmez), `work_id`, pasaj (birebir), karar,
   `quoted_span`, `prompt_version`, `model_id`, `inserted_at` (tıklama anı),
   `origin: user_written`. Belge dışa aktarılınca bu kayıtlar denetim izi
   olarak ek tabloya çıkar (Word'de "Kanıt eki", isteğe bağlı).
5. **Bütçe (3.3):** iddia başına en fazla 5 aday ve 7 çağrı. Sunucu sayar.
   Tavan aşılırsa iş durur, panel bunu söyler. Yeniden deneme döngüsü yok.
6. **Güvenlik (3.8):**
   - Pasaj `wrapPassage` ile sarılır.
   - Şemaya uymayan çıktı kullanılmaz.
   - Çağrının hiçbir aracı yok.
   - Birim testlere enjeksiyon vakaları girer: "önceki talimatları yok say",
     sahte ayraç, sahte JSON, "destekliyor olarak işaretle".
7. **Dürüstlük (2.8):**
   - Panelin başında "Özet üzerinden denetlendi, tam metin değil" yazar.
   - Güven puanı sayı olarak gösterilmez.
   - "Ölçülmemiş model kararı" notu durur (4.1).
8. Bayrak: `EVIDENCE_CHECK_ENABLED` (istemci sabiti, varsayılan bu dalda
   `true`). CLAUDE.md 3.12 tablosuna ve Bölüm 3 başındaki eksikler listesine
   işlenir.

### Hariç
- MongoDB'de `Claim` / `Evidence` koleksiyonu. Bu bir şema göçü (kural 6);
  ayrı onayla, ayrı iş emrinde yapılır. Bu işte kayıt taslağın içindedir.
- Dış kaynaktan canlı pasaj araması (Semantic Scholar snippet). S2 lisansı
  ve anahtarı Ahmet'in kararını bekliyor. Adaylar yalnız sepetten gelir.
- Doğrulama kararı önbelleği (3.4 bileşik anahtar). Ayrı iş.
- Tam metin. Pasaj yalnız özettir.
- Onarım (PR10) ve iddia kayması ölçümü.
- E2 kümesinin etiketlenmesi. Bu Ahmet'in işi, aşağıda "Ölçüm" bölümünde.

Kapsam dışında bir sorun görülürse düzeltilmez, rapora yazılır.

## Dokunulabilecek dosyalar
- `server/services/evidenceCheck.js` (yeni; `citedSentence.js`'ten
  `buildVerifyBody`, `wrapPassage`, `spanInPassage` dışa açılarak kullanılır,
  kopyalanmaz)
- `server/services/citedSentence.js` (yalnız gerekli export'lar; PR3 metni
  değişmez)
- `server/index.js` (yalnız yeni uç; mevcut `WRITER_RATE_LIMITER` ve giriş
  denetimi kullanılır)
- `server/tests/evidenceCheck.test.js` (yeni)
- `client/src/components/workspace/EvidencePanel.jsx` (yeni),
  `evidence.js`, `Workspace.jsx`, `exportDocument.js`, `drafts.js`
- `client/src/App.jsx` (bayrak), i18n tr/en, `client/src/styles/workspace.css`
- `client/tests/evidence*.test.js`, `client/e2e/evidence-check.spec.js` (yeni)
- `CLAUDE.md` (yalnız 3.12 satırı ve Bölüm 3 eksikler listesi)
- `docs/work-orders/README.md`, bu dosya

## Yaklaşım
- **Neden PR3.v1 yeniden kullanılıyor:** prompt kodda zaten sürümlü ve
  çalışıyor. Yeni bir prompt, ölçümsüz ikinci bir karar kaynağı olurdu.
  Prompt metni değişirse sürüm PR3.v2 olur ve rapora "ölçülmedi" yazılır.
- **Model:** kullanıcının bağlı anahtarı ya da platform modeli; seçim
  `aiContext` / `keyFor` üzerinden gider (WO-027). Tüzük 3.7 doğrulamada "en
  güçlü model" diyor. Hangi model olacağı onay noktası.
- **Sıra (3.4):** sistem bloğu statik, iddia pasajdan önce gelir. Böylece
  5 adayın 4'ünde önek önbellekte kalır.
- **Neden sepet:** kullanıcı kaynağını kendisi seçmiş olur. Sistem "bu
  konuda çalışma yok" diyemez, ancak "sepetindeki 5 kaynakta kanıt
  bulunamadı" diyebilir (2.8).

## Kabul kriterleri
- [ ] Seçili cümle için panel en fazla 5 aday gösterir. Her adayda karar
      şekli, metni ve vurgulu parça var. Sayısal güven gösterilmez.
- [ ] `quoted_span` pasajda yoksa karar hiçbir zaman `supports` görünmez
      (birim test).
- [ ] Sepet boşken ve hiçbir aday desteklemezken iki ayrı mesaj çıkar.
      İkisi de "destekleniyor" değildir.
- [ ] Atıf yalnız "Bu kaynağı bağla" tıklamasıyla belgeye girer. Atıf
      dizgesinde modelden gelen hiçbir alan yoktur (birim test: model
      çıktısına sahte DOI/yazar konur, atıfta görünmez).
- [ ] İddia başına çağrı sayısı 7'yi geçmez (birim test).
- [ ] Dört enjeksiyon vakası `supports` üretmez (sahte modelle birim test;
      gerçek modelle ölçüm ayrı, aşağıda).
- [ ] Bağlanan kanıt taslak yeniden açılınca durur ve Word dışa aktarımına
      çıkar.
- [ ] Lint, birim, sunucu, e2e geçer.
- [ ] Bölüm 4 regresyon seti: küme olmadığı için çalıştırılamaz. Raporda
      "ölçülmedi" yazar.

## Test planı
| Test | Nasıl çalıştırılır | Beklenen |
| --- | --- | --- |
| Sunucu birim | `cd server && npm test` | evidenceCheck: şema, bütçe, span → partial, enjeksiyon, no_evidence |
| İstemci birim | `cd client && npm test` | aday sıralama, kayıt biçimi, atıf kurulumu |
| e2e (sahte uç) | `npx playwright test e2e/evidence-check.spec.js` | cümle seç → panel → bağla → atıf belgede; Esc kapatır |
| Elle | Ahmet: kendi taslağında 5 cümle | Kararlar makul mü, düğmeler anlaşılır mı |

## Ölçüm
Kalite ölçülmeyecek, çünkü E2 kümesi yok (4.1). Arayüz kararı "ölçülmemiş
model kararı" diye sunar.

Bu işten sonra E2 pilotunun yolu açılır: Ahmet 50 iddia–pasaj çiftini 4.3'e
göre etiketler, bu uçla çalıştırılır ve eşikler 4.4'e göre okunur. Etiketleme
bu iş emrinin parçası değildir.

| Metrik | Öncesi | Sonrası hedefi |
| --- | --- | --- |
| Yazarın cümlesini pasaja bağlayan yol | Yok | Var (e2e) |
| E2 makro F1 / `supports` precision | Ölçülmedi | Ölçülmedi (küme bekliyor) |

## Geri alma
Tek dal, commit grubu revert edilir. Bayrak `false` yapılınca panel ve uç
kullanılmaz. Taslaktaki kanıt kayıtları ek alandır, eski taslakları bozmaz.

## Riskler
| Risk | Olasılık | Etki | Önlem |
| --- | --- | --- | --- |
| Model konu benzerliğini destek sanar | Yüksek | Ürün vaadi | Birebir parça şartı; `partial` varsayılan; ölçülmemiş notu; E2 pilotu |
| Özet, iddiayı desteklemeye yetmez | Yüksek | Çok `partial`/`no_evidence` | Arayüz bunu söyler; tam metin ayrı iş |
| Çağrı maliyeti (5 aday × güçlü model) | Orta | Maliyet | Bütçe tavanı; önek önbelleği; 3.9 ölçüm kaydı |

## Onay gereken noktalar
1. Bu taslağın Hazır'a geçmesi.
2. Doğrulama modeli: platform anahtarıyla hangi model (tüzük 3.7: en güçlü
   model).
3. MongoDB `Claim` / `Evidence` koleksiyonu. Bu işte yok, ayrı iş.

## Bitiş raporu
- Değişen dosyalar:
- Teknik kararlar ve gerekçeleri:
- Çalıştırılan testler ve gerçek çıktıları:
- Ölçülen etki:
- Bilinen eksikler:
- Sonraki adım:
- **Durum:**
