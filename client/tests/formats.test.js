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

test('bicim degisimi: eksik bolumler eklenir, metni olan bolum asla kaldirilabilir sayilmaz', () => {
  const headings = [
    { index: 0, text: 'Öz', level: 2, total: 120 },
    { index: 1, text: 'Giriş', level: 2, total: 0 },
    { index: 2, text: 'Yöntem', level: 2, total: 400 },
    { index: 3, text: 'Bulgular', level: 2, total: 0 },
    { index: 4, text: 'Kaynakça', level: 2, total: 0 },
  ];
  const plan = planFormatChange(headings, byId('project'), t, isReferencesHeading);
  assert.deepEqual(plan.add.map((s) => s.key), ['scope', 'workplan', 'outputs', 'conclusion']);
  // Bulgular boş ve proje şablonunda yok: kaldırılabilir. Yöntem dolu: asla. Kaynakça: asla.
  assert.deepEqual(plan.removable.map((h) => h.text), ['Bulgular']);
});

test('ayni bicime gecis hicbir sey eklemez ya da kaldirmaz', () => {
  const html = templateHtml(byId('imrad'), t);
  const names = [...html.matchAll(/<h\d[^>]*>([^<]+)<\/h\d>/g)].map((m) => m[1]);
  const headings = names.map((text, index) => ({ index, text, level: 2, total: 0 }));
  const plan = planFormatChange(headings, byId('imrad'), t, isReferencesHeading);
  assert.deepEqual(plan, { add: [], removable: [] });
});
