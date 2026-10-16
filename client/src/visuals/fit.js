// Şablon uygunluğu (WO-016): karar grafın ŞEKLİNDEN verilir, model vermez.
// Her şablon için uygun/uymuyor + gerekçe anahtarı döner; gerekçe metinleri
// i18n'de. Uymayan şablon gizlenmez — arayüz nedenini gösterir.

import { TEMPLATE_IDS } from './schema.js';

function shape(st) {
  const ids = st.nodes.map((n) => n.id);
  const inn = Object.fromEntries(ids.map((id) => [id, 0]));
  const out = Object.fromEntries(ids.map((id) => [id, 0]));
  const adj = Object.fromEntries(ids.map((id) => [id, []]));
  for (const e of st.edges) {
    if (!(e.from in inn) || !(e.to in inn)) continue;
    out[e.from] += 1; inn[e.to] += 1;
    adj[e.from].push(e.to); adj[e.to].push(e.from);
  }
  const N = ids.length;
  const E = st.edges.length;
  const seen = new Set();
  const stack = ids.length ? [ids[0]] : [];
  while (stack.length) { const v = stack.pop(); if (seen.has(v)) continue; seen.add(v); stack.push(...adj[v]); }
  const connected = N > 0 && seen.size === N;
  return { ids, inn, out, N, E, connected };
}

const isPath = ({ ids, inn, out, N, E, connected }) =>
  N >= 3 && connected && E === N - 1 && ids.every((id) => inn[id] <= 1 && out[id] <= 1);

const isSimpleCycle = ({ ids, inn, out, N, E, connected }) =>
  N >= 3 && connected && E === N && ids.every((id) => inn[id] === 1 && out[id] === 1);

/** Yönsüz ağaç + en az bir düğümden aynı yönde ≥ 2 dal: düz zincir hiyerarşi sayılmaz. */
const isBranchingTree = ({ ids, inn, out, N, E, connected }) =>
  N >= 3 && connected && E === N - 1
  && ids.some((id) => (out[id] >= 2 && inn[id] === 0) || (inn[id] >= 2 && out[id] === 0));

/** Bütün oklar tek bir hedefe gidiyor ve en az iki kaynak var. */
const isFanIn = ({ ids, inn, E }) => ids.some((id) => inn[id] >= 2 && inn[id] === E);

function numbersOf(st) {
  return st.nodes.filter((n) => n.value && typeof n.value.number === 'number');
}

const CHECK = {
  akis: (st, sh) => (isPath(sh) ? 'fit.chain' : isSimpleCycle(sh) ? 'fit.cycleAsFlow' : null),
  dongu: (st, sh) => (isSimpleCycle(sh) && (st.profile?.cycle ?? 0) > 0 ? 'fit.cycleClosed' : null),
  hiyerarsi: (st, sh) => (isBranchingTree(sh) ? 'fit.tree' : null),
  balik: (st, sh) => (isFanIn(sh) ? 'fit.manyToOne' : null),
  geri: (st, sh) => (isSimpleCycle(sh) && st.edges.every((e) => e.polarity) ? 'fit.feedback' : null),
  kavram: (st, sh) => (sh.N >= 3 && sh.E >= 2 && st.edges.every((e) => e.text) ? 'fit.labeledRelations' : null),
  arguman: (st) => (st.nodes.some((n) => n.role === 'claim') ? 'fit.argument' : null),
  zaman: (st) => (st.nodes.filter((n) => n.value && n.value.year).length >= 2 ? 'fit.years' : null),
  cubuk: (st) => {
    const ns = numbersOf(st);
    return ns.length >= 2 && ns.every((n) => n.value.unit === ns[0].value.unit) ? 'fit.sameUnit' : null;
  },
  pasta: (st) => {
    const ns = numbersOf(st);
    if (ns.length < 2 || !ns.every((n) => n.value.unit === '%')) return null;
    const sum = ns.reduce((a, n) => a + n.value.number, 0);
    return Math.abs(sum - 100) <= 1 ? 'fit.percentWhole' : null;
  },
  // İki tarafı ya da iki ekseni kural kademesi çıkaramaz; model kademesinde (WO-C).
  karsi: () => null,
  dortlu: () => null,
};

const UNFIT_REASON = {
  akis: 'unfit.notChain', dongu: 'unfit.notClosed', hiyerarsi: 'unfit.noBranching',
  balik: 'unfit.notManyToOne', geri: 'unfit.noPolarityOrCycle', kavram: 'unfit.unlabeled',
  arguman: 'unfit.noClaim', zaman: 'unfit.noYears', cubuk: 'unfit.noNumbers',
  pasta: 'unfit.notWhole', karsi: 'unfit.needsModel', dortlu: 'unfit.needsModel',
};

// Uygunlar arasında önerilen: daha özgül yapı önce (geri besleme döngüden,
// döngü akıştan, balık kılçığı hiyerarşiden daha çok şey söyler).
const PRIORITY = ['geri', 'dongu', 'balik', 'arguman', 'zaman', 'pasta', 'cubuk', 'hiyerarsi', 'akis', 'kavram'];

/** @returns {{template:string, ok:boolean, reason:string, recommended:boolean}[]} */
export function fitTemplates(structure) {
  const sh = shape(structure);
  const rows = TEMPLATE_IDS.map((template) => {
    const why = CHECK[template](structure, sh);
    return { template, ok: !!why, reason: why || UNFIT_REASON[template], recommended: false };
  });
  const rec = PRIORITY.find((t) => rows.find((r) => r.template === t)?.ok);
  if (rec) rows.find((r) => r.template === rec).recommended = true;
  return rows;
}
