import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATS, TEMPLATES, planFormatChange, templateHtml } from '../src/components/workspace/templates.js';
import { DEFAULT_SETUP } from '../src/components/workspace/pageSetup.js';
import { isReferencesHeading } from '../src/components/workspace/references.js';
import tr from '../src/i18n/tr.js';
import en from '../src/i18n/en.js';

const lookup = (dict) => (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
const t = lookup(tr);
const byId = (id) => TEMPLATES.find((x) => x.id === id);

test('bes bicim secenegi var ve her biri gercek bir sablona bagli', () => {
  assert.deepEqual(FORMATS.map((f) => f.id), ['article', 'thesis', 'review', 'project', 'blank']);
  for (const f of FORMATS) {
    assert.ok(byId(f.template), f.id);
    if (f.systematic) assert.ok(byId(f.systematic), `${f.id} sistematik`);
  }
});

test('her sablon A4 ve yalniz desteklenen atif stilini kuruyor', () => {
  const supported = ['APA 7', 'IEEE', 'MLA', 'Chicago'];
  assert.equal(DEFAULT_SETUP.size, 'a4', 'varsayılan A4');
  for (const template of TEMPLATES) {
    assert.equal(template.setup.size, 'a4', template.id);
    assert.equal(template.setup.landscape, false, template.id);
    assert.ok(supported.includes(template.bibFormat), template.id);
  }
});

test('genel tez sablonu sartnamedeki bolumleri sirayla kuruyor', () => {
  const names = byId('thesis').sections.map((s) => t(`workspace.section.${s.key}`));
  assert.deepEqual(names, [
    'Kapak', 'İç kapak', 'Onay sayfası', 'Etik beyan', 'Özet', 'Abstract', 'İçindekiler',
    'Tablolar listesi', 'Şekiller listesi', 'Kısaltmalar', 'Giriş', 'Kuramsal Çerçeve ve İlgili Araştırmalar',
    'Yöntem', 'Bulgular', 'Tartışma', 'Sonuç ve Öneriler', 'Kaynakça', 'Ekler', 'Özgeçmiş',
  ]);
});

test('her bicimin bolumlerinin iki dilde adi ve rehber satiri var', () => {
  for (const dict of [tr, en]) {
    const tt = lookup(dict);
    for (const template of TEMPLATES) {
      for (const s of template.sections) {
        assert.equal(typeof tt(`workspace.section.${s.key}`), 'string', `${template.id}.${s.key}`);
        assert.equal(typeof tt(`workspace.hint.${s.key}`), 'string', `${template.id}.${s.key} hint`);
      }
    }
    for (const f of FORMATS) assert.equal(typeof tt(`workspace.format.option.${f.id}.name`), 'string', f.id);
  }
});

/** Şablon HTML'inden belge başlık tanımları (Workspace'teki DOM taramasının eşi). */
function headingsOf(html, filled = {}) {
  return [...html.matchAll(/<h(\d)(?: data-template-section="([^"]+)")?[^>]*>([^<]+)<\/h\d>/g)].map((m, i, all) => {
    const next = all[i + 1];
    return {
      text: m[3],
      level: Number(m[1]),
      key: m[2] || null,
      ownEmpty: !filled[m[3]],
      hasChildren: Boolean(next && Number(next[1]) > Number(m[1])),
    };
  });
}

test('bicim degisimi: eksik bolumler eklenir, metni olan bolum asla kaldirilabilir sayilmaz', () => {
  const headings = headingsOf(templateHtml(byId('imrad'), t), { 'Öz': true, 'Yöntem': true });
  const plan = planFormatChange(headings, byId('project'), t, isReferencesHeading);
  assert.deepEqual(plan.add.map((s) => s.key), ['scope', 'workplan', 'outputs']);
  // Bulgular ve Tartışma boş ve projede yok: kaldırılabilir. Yöntem dolu: asla. Kaynakça: asla.
  assert.deepEqual(plan.removable.map((h) => h.text), ['Bulgular', 'Tartışma']);
});

test('kullanicinin kendi basligi (kimliksiz, sablon adi degil) kaldirilabilir sayilmaz', () => {
  const headings = [
    { text: 'Benim notlarım', level: 2, key: null, ownEmpty: true, hasChildren: false },
    { text: 'Giriş', level: 2, key: 'intro', ownEmpty: true, hasChildren: false },
  ];
  const plan = planFormatChange(headings, byId('project'), t, isReferencesHeading);
  assert.deepEqual(plan.removable, []);
});

test('alt bolumu olan ya da kendi metni olan sablon bolumu kaldirilmaz', () => {
  const headings = [
    { text: 'Bulgular', level: 2, key: 'results', ownEmpty: true, hasChildren: true },
    { text: 'Alt', level: 3, key: null, ownEmpty: false, hasChildren: false },
    { text: 'Tartışma', level: 2, key: 'discussion', ownEmpty: false, hasChildren: false },
  ];
  assert.deepEqual(planFormatChange(headings, byId('project'), t, isReferencesHeading).removable, []);
});

test('makaleden teze eklenen bolumler belgedeki seviyeye (h2) uyar', () => {
  const plan = planFormatChange(headingsOf(templateHtml(byId('imrad'), t)), byId('thesis'), t, isReferencesHeading);
  assert.ok(plan.add.length > 0);
  assert.ok(plan.add.every((s) => s.level === 2), JSON.stringify(plan.add.map((s) => [s.key, s.level])));
});

test('makale -> tez -> makale gidis-donusunde plan baslangica doner', () => {
  // Tezden sonra belgede: makale bölümleri (h2) + eklenen tez bölümleri (h2, kimlikli).
  const thesisAdd = planFormatChange(headingsOf(templateHtml(byId('imrad'), t)), byId('thesis'), t, isReferencesHeading).add;
  const after = [
    ...headingsOf(templateHtml(byId('imrad'), t), { 'Giriş': true }),
    ...thesisAdd.map((s) => ({ text: t(`workspace.section.${s.key}`), level: s.level, key: s.key, ownEmpty: true, hasChildren: false })),
  ];
  const back = planFormatChange(after, byId('imrad'), t, isReferencesHeading);
  assert.deepEqual(back.add, []);
  assert.deepEqual(back.removable.map((h) => h.key).sort(), thesisAdd.map((s) => s.key).sort());
});

test('ayni kimlik iki kez varsa yalniz ilki sayilir', () => {
  const headings = [
    { text: 'Bulgular', level: 2, key: 'results', ownEmpty: false, hasChildren: false },
    { text: 'Bulgular devam', level: 2, key: 'results', ownEmpty: true, hasChildren: false },
  ];
  assert.deepEqual(planFormatChange(headings, byId('project'), t, isReferencesHeading).removable, []);
});

test('ayni bicime gecis hicbir sey eklemez ya da kaldirmaz', () => {
  const plan = planFormatChange(headingsOf(templateHtml(byId('imrad'), t)), byId('imrad'), t, isReferencesHeading);
  assert.deepEqual(plan, { add: [], removable: [] });
});
