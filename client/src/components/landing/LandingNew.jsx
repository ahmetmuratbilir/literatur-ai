import { useEffect, useRef, useState } from 'react';
import BrandMark from '../ui/BrandMark.jsx';
import { AppSignInButton } from '../../auth/clerkBridge.js';
import { useI18n } from '../../i18n/context.js';
import '../../styles/landing-new.css';

/**
 * Yeni açılış sayfası — ana sayfa v9 (`docs/design/mockup-ana-sayfa-v9.html`).
 *
 * Eski `LandingPage` varsayılan kalır; bu sayfa `?giris=yeni` ile açılır
 * (kullanıcı kararı 19.10.2026). Eskisinin silinmesi kullanıcının kararı.
 *
 * Taslaktan ayrılan yerler (tüzük 2.8 — olmayanı vaat etme):
 * - "Türkçe korpus: DergiPark · TR Dizin · YÖK Tez gece toplanır" bugün kodda
 *   yok (`server/services/sourceQuery.js`: "DergiPark eklendiğinde"). Yerine
 *   bugün çalışan: konu Türkçe yazılır, kaynaklar için İngilizceye çevrilir.
 * - "Kayıt olmadan deneyebilirsiniz": arama girişsiz çalışmıyor
 *   (`/api/search` 401). Yerine: ücretsiz hesap.
 * - "Denetim izi … dışa aktarılabilir": cümle–kanıt kaydı ve dışa aktarımı
 *   henüz yok (CLAUDE.md 3, Claim modeli hedef). Örnek pencerede yerine
 *   "Belgeye siz eklersiniz" (2.9).
 * Kaynak şeridi bugün aranan kaynaklardır (eski sayfadaki listeyle aynı).
 */

const SEARCH_SOURCES = ['openalex', 'crossref', 's2', 'europepmc', 'openaire', 'datacite', 'doaj', 'arxiv', 'core'];
const ENRICHMENT_SOURCES = ['opencitations', 'unpaywall'];
const SOURCE_NAMES = {
  openalex: 'OpenAlex', crossref: 'Crossref', s2: 'Semantic Scholar', europepmc: 'Europe PMC',
  openaire: 'OpenAIRE', datacite: 'DataCite', doaj: 'DOAJ', arxiv: 'arXiv', core: 'CORE',
  opencitations: 'OpenCitations', unpaywall: 'Unpaywall',
};
const MARQUEE_ROWS = [SEARCH_SOURCES.slice(0, 6), [...SEARCH_SOURCES.slice(6), ...ENRICHMENT_SOURCES]];
// Şerit genişliği en çok 1120 px; 5 kaynaklı satır üç kopyayla her ekranı doldurur.
const MARQUEE_COPIES = 3;

const NAV = [['nasil', 'how'], ['ozellikler', 'features'], ['kaynaklar', 'sources'], ['sss', 'faq']];
const CLASSES = ['ok', 'warn', 'gray', 'bad', 'none'];
const FEATURES = [['✓', 'f1'], ['◱', 'f2'], ['⌘', 'f3'], ['⇄', 'f4'], ['文', 'f5'], ['◈', 'f6']];

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const SignInCta = ({ className, children }) => (
  <AppSignInButton mode="modal">
    <button type="button" className={className}>{children}</button>
  </AppSignInButton>
);

const Swash = () => (
  <svg className="swash" viewBox="0 0 220 12" preserveAspectRatio="none" aria-hidden="true">
    <path pathLength="1" d="M2 9 C 40 3, 90 2, 130 6 S 200 8, 218 4" />
  </svg>
);

const scrollTo = (id) => (e) => {
  e?.preventDefault?.();
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
};

/**
 * Kanıt defteri döngüsü: cümle yazılır → kaynaklar taranır → pasaj bulunur,
 * vurgulanan ifade cümleye uçar ve [1] düşer → ikinci iddiaya pasaj yok.
 * Ekranda değilken ya da sekme gizliyken durur, son hal durağan kalır;
 * hareket azaltılmışsa hiç başlamaz. Cümle ve sayaç bu işlevin yönettiği
 * düğümlerdir: React onlara çocuk yazmaz, harf harf bölme React'i bozmaz.
 */
function createLedger(win, text) {
  const body = win.querySelector('.aw-body');
  const claim = win.querySelector('.claim');
  const claimText = claim.querySelector('.claim__text');
  const cite = claim.querySelector('.cite');
  const [ev1, ev2] = win.querySelectorAll('.ev');
  const skel = ev2.querySelector('.ev-skel');
  const status = win.querySelector('.aw-status');
  const statusText = status.querySelector('.t');
  const progress = win.querySelector('.aw-progress');
  const counter = win.querySelector('.aw-count');
  const exportNote = win.querySelector('.aw-foot').lastElementChild;
  const STOP = Symbol('stop');
  let token = 0;
  let running = false;

  const fillClaim = () => {
    claimText.replaceChildren(
      document.createTextNode(text.claimPre),
      Object.assign(document.createElement('span'), { className: 'mk', textContent: text.claimMark }),
      document.createTextNode(text.claimPost),
    );
  };
  const fillCounter = (n) => { counter.textContent = `${n} ${text.countUnit}`; };

  const wait = (ms, t) => new Promise((resolve, reject) => setTimeout(() => (t === token ? resolve() : reject(STOP)), ms));
  const say = (key, extra = '', mode = '') => {
    const roomy = status.parentElement.clientWidth >= 360; // dar çubukta kaynak adı sığmaz
    statusText.textContent = key ? text.status[key] + (extra && roomy ? ` · ${extra}` : '') : '';
    status.className = `aw-status${key ? ' on' : ''}${mode ? ` ${mode}` : ''}`;
  };
  const parts = () => [ev1, ev2].flatMap((ev) => [...ev.querySelectorAll('.chip, .passage, .src')]);

  const split = () => {
    fillClaim();
    const chars = [];
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const c of n.textContent) {
          const el = document.createElement('span');
          el.className = 'ch';
          el.textContent = c;
          frag.append(el);
          chars.push(el);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === Node.ELEMENT_NODE) walk(n);
    });
    walk(claimText);
    return chars;
  };

  const countUp = (t, ms) => {
    const t0 = performance.now();
    const step = (now) => {
      if (t !== token || !counter.isConnected) return;
      const k = Math.min(1, (now - t0) / ms);
      fillCounter(Math.round(text.count * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // Pasajda boyanan ifade kopyalanıp kavis çizerek cümledeki karşılığına uçar.
  const fly = () => {
    const hit = ev1.querySelector('.hit');
    const mk = claim.querySelector('.mk');
    if (!hit || !mk || !hit.animate) return;
    const box = body.getBoundingClientRect();
    const from = hit.getBoundingClientRect();
    const to = mk.getClientRects()[0];
    if (!to) return;
    const cs = getComputedStyle(hit);
    const tok = document.createElement('span');
    tok.className = 'aw-token';
    tok.textContent = hit.textContent;
    Object.assign(tok.style, {
      left: `${from.left - box.left}px`, top: `${from.top - box.top}px`,
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
    });
    body.append(tok);
    const dx = to.left - from.left;
    const dy = to.top - from.top;
    const k = parseFloat(getComputedStyle(mk).fontSize) / parseFloat(cs.fontSize);
    tok.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 0 },
      { transform: 'translate(0, -2px) scale(1.06)', opacity: 1, offset: 0.12 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.5 - 18}px) scale(1.14)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 1, offset: 0.88 },
      { transform: `translate(${dx}px, ${dy}px) scale(${k})`, opacity: 0 },
    ], { duration: 950, easing: 'cubic-bezier(.45,.05,.25,1)' }).onfinish = () => tok.remove();
  };

  const reset = () => {
    win.classList.add('anim');
    body.querySelectorAll('.aw-token').forEach((el) => el.remove());
    [claim, cite, ev1, ev2, exportNote, skel, ...parts()].forEach((el) => el.classList.remove('in', 'on', 'ok', 'shake'));
    ev1.querySelector('.hit')?.classList.remove('on');
    progress.classList.remove('on');
    say('');
    fillCounter(0);
    const chars = split();
    claim.querySelector('.mk')?.classList.remove('on');
    return chars;
  };

  const showFinal = () => {
    win.classList.remove('anim');
    body.classList.remove('resetting');
    body.querySelectorAll('.aw-token').forEach((el) => el.remove());
    fillClaim();
    [claim, skel].forEach((el) => el.classList.remove('ok', 'on'));
    progress.classList.remove('on');
    say('');
    fillCounter(text.count);
  };

  const play = async (t, fade) => {
    if (fade) { body.classList.add('resetting'); await wait(450, t); }
    const chars = reset();
    body.classList.remove('resetting');
    await wait(fade ? 300 : 650, t);

    say('typing');
    for (let i = 0; i < chars.length; i += 1) {
      if (i) chars[i - 1].classList.remove('cur');
      chars[i].classList.add('v', 'cur');
      await wait(chars[i].textContent === ' ' ? 14 : 28, t);
    }
    await wait(380, t);
    chars.at(-1)?.classList.remove('cur');

    progress.classList.add('on');
    for (const src of ['OpenAlex', 'Crossref', 'Semantic Scholar', 'Europe PMC']) { say('scan', src, 'scan'); await wait(360, t); }
    progress.classList.remove('on');
    say('found');

    ev1.classList.add('in'); await wait(380, t);
    const [chipA, chipB] = ev1.querySelectorAll('.chip');
    chipA.classList.add('in'); await wait(110, t);
    chipB.classList.add('in'); await wait(200, t);
    ev1.querySelector('.passage').classList.add('in'); await wait(320, t);
    ev1.querySelector('.hit')?.classList.add('on'); await wait(650, t);
    fly(); await wait(840, t);
    claim.querySelector('.mk')?.classList.add('on');
    claim.classList.add('ok');
    cite.classList.add('on');
    say('match', '', 'ok');
    ev1.querySelector('.src').classList.add('in');
    countUp(t, 1100);
    await wait(1000, t);

    ev2.classList.add('in'); skel.classList.add('on'); progress.classList.add('on');
    for (const src of ['Crossref', 'OpenAlex']) { say('scan', src, 'scan'); await wait(480, t); }
    skel.classList.remove('on'); progress.classList.remove('on');
    ev2.querySelector('.chip').classList.add('in'); await wait(140, t);
    ev2.querySelector('.passage').classList.add('in'); await wait(320, t);
    ev2.querySelector('.src').classList.add('in', 'shake');
    say('none', '', 'none');
    await wait(800, t);

    exportNote.classList.add('in');
    say('ready', '', 'ok');
    await wait(1600, t);
    say('');
    await wait(2800, t);
  };

  const loop = async (t, fade) => {
    try {
      for (let first = true; ; first = false) await play(t, fade || !first);
    } catch (err) {
      if (err !== STOP) throw err;
    }
  };

  showFinal();
  return {
    start(fade) {
      if (running) return;
      running = true;
      token += 1;
      loop(token, fade);
    },
    stop() {
      if (!running) return;
      running = false;
      token += 1;
      showFinal();
    },
  };
}

export default function LandingNew({ landingTheme = 'light', setLandingTheme }) {
  const { t, lang, setLang } = useI18n();
  const dark = landingTheme === 'dark';
  const rootRef = useRef(null);
  const winRef = useRef(null);
  const seenRef = useRef(false);
  const [stuck, setStuck] = useState(false);
  const [active, setActive] = useState(null);
  const [phrase, setPhrase] = useState(0);
  const [cls, setCls] = useState('ok');
  const [preWindow, setPreWindow] = useState(() => !reducedMotion());
  const k = (key, params) => t(`landingNew.${key}`, params);

  // Menü: kaydırınca alt çizgi, görünen bölüme göre etkin bağlantı.
  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY > 8);
      if (window.scrollY < 200) setActive(null);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (!('IntersectionObserver' in window)) return () => window.removeEventListener('scroll', onScroll);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    NAV.forEach(([id]) => { const el = document.getElementById(id); if (el) spy.observe(el); });
    return () => { window.removeEventListener('scroll', onScroll); spy.disconnect(); };
  }, []);

  // Bölümler görünür alana girince bir kez yükselir.
  useEffect(() => {
    const rises = [...(rootRef.current?.querySelectorAll('.rise') || [])];
    if (!('IntersectionObserver' in window)) { rises.forEach((el) => el.classList.add('in')); return undefined; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    rises.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Başlığın ikinci satırı yavaşça döner.
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const id = setInterval(() => setPhrase((p) => (p + 1) % 3), 6800);
    return () => clearInterval(id);
  }, []);

  // Kanıt defteri: dil değişince metinle yeniden kurulur.
  useEffect(() => {
    const win = winRef.current;
    if (!win) return undefined;
    const tt = (key) => t(`landingNew.aw.${key}`);
    const ledger = createLedger(win, {
      claimPre: tt('claimPre'), claimMark: tt('claimMark'), claimPost: tt('claimPost'),
      count: 24, countUnit: tt('countUnit'),
      status: {
        typing: tt('status.typing'), scan: tt('status.scan'), found: tt('status.found'),
        match: tt('status.match'), none: tt('status.none'), ready: tt('status.ready'),
      },
    });
    if (reducedMotion()) return undefined;
    let onScreen = false;
    let timer = 0;
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (!onScreen) { ledger.stop(); return; }
      if (document.hidden) return;
      ledger.start(seenRef.current);
      if (!seenRef.current) {
        seenRef.current = true;
        timer = setTimeout(() => setPreWindow(false), 120);
      }
    }, { threshold: 0.2 });
    io.observe(win);
    const onVisibility = () => {
      if (document.hidden) ledger.stop();
      else if (onScreen) ledger.start(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      io.disconnect();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      ledger.stop();
    };
  }, [t, lang]);

  const onClassKey = (e, i) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = CLASSES[(i + (e.key === 'ArrowDown' ? 1 : CLASSES.length - 1)) % CLASSES.length];
    setCls(next);
    e.currentTarget.parentElement.querySelector(`[data-c="${next}"]`)?.focus();
  };

  return (
    <div ref={rootRef} className="ln" data-theme={dark ? 'dark' : 'light'} lang={lang}>
      <header className={`ln-nav${stuck ? ' stuck' : ''}`}>
        <div className="wrap nav__in">
          <button type="button" className="brand" onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })}>
            <BrandMark size={28} /> Literatür AI <span className="beta">beta</span>
          </button>
          <nav className="nav__links" aria-label={k('nav.label')}>
            {NAV.map(([id, key]) => (
              <a key={id} href={`#${id}`} onClick={scrollTo(id)} className={active === id ? 'active' : undefined} aria-current={active === id ? 'true' : undefined}>
                {k(`nav.${key}`)}
              </a>
            ))}
          </nav>
          <div className="nav__right">
            <div className="lang" role="group" aria-label={t('common.language')}>
              {['en', 'tr'].map((code) => (
                <button key={code} type="button" aria-pressed={lang === code} onClick={() => lang !== code && setLang(code)}>{code.toUpperCase()}</button>
              ))}
            </div>
            {setLandingTheme && (
              <button type="button" className="icon-btn" onClick={() => setLandingTheme(dark ? 'light' : 'dark')} aria-label={dark ? k('nav.light') : k('nav.dark')} title={dark ? k('nav.light') : k('nav.dark')}>
                <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
              </button>
            )}
            <SignInCta className="signin">{k('nav.signin')}</SignInCta>
            <SignInCta className="btn btn--primary">{k('nav.start')}</SignInCta>
          </div>
        </div>
      </header>

      <main>
        {/* ══ HERO ══ */}
        <section className="hero">
          <div className="wrap hero__grid">
            <div className="hero__copy">
              <span className="eyebrow">{k('hero.eyebrow')}</span>
              <h1>
                <span className="l1">{k('hero.l1')}</span>
                <span className="l2">
                  {['r1', 'r2', 'r3'].map((key, i) => (
                    <span key={key} className={`ph${phrase === i ? ' on' : ''}`} aria-hidden={phrase === i ? undefined : 'true'}>
                      <span className="txt">{k(`hero.${key}`)}</span><Swash />
                    </span>
                  ))}
                </span>
              </h1>
              <p className="lead">{k('hero.lead')}</p>
              <div className="cta">
                <SignInCta className="btn btn--primary btn--lg">{k('hero.cta')} <span className="arw" aria-hidden="true">→</span></SignInCta>
                <button type="button" className="link" onClick={scrollTo('nasil')}>{k('hero.cta2')}</button>
              </div>
              <div className="trust3">
                {['t1', 't2', 't3'].map((key) => (
                  <div key={key}><span className="tick" aria-hidden="true">✓</span><span>{k(`hero.${key}`)}</span></div>
                ))}
              </div>
            </div>

            <div className="stage" aria-label={k('aw.label')}>
              <div className="halo" aria-hidden="true" />
              <div ref={winRef} className={`appwindow${preWindow ? ' pre' : ''}`}>
                <div className="aw-bar">
                  <span className="dots" aria-hidden="true"><i /><i /><i /></span>
                  <span className="title">{k('aw.title')}</span><span className="tag">{k('aw.tag')}</span>
                  <span className="aw-status" aria-hidden="true"><i className="spin" /><span className="t" /></span>
                  <span className="aw-live-dot" aria-hidden="true" />
                  <span className="aw-progress" aria-hidden="true" />
                </div>
                <div className="aw-body">
                  <div className="claim">
                    <span className="claim__text" />
                    <sup className="cite" aria-hidden="true">[1]</sup>
                  </div>
                  <div className="ev">
                    <div className="ev__row">
                      <span className="chip chip--ok">{k('aw.c1')}</span>
                      <span className="chip chip--plain">{k('aw.c2')}</span>
                    </div>
                    <div className="passage">“<span className="hit">{k('aw.p1Hit')}</span>{k('aw.p1Rest')}”</div>
                    <div className="src">{k('aw.s1')}</div>
                  </div>
                  <div className="ev ev--muted">
                    <div className="ev-skel" aria-hidden="true"><i /><i /><i /></div>
                    <div className="ev__row"><span className="chip chip--none">{k('aw.c3')}</span></div>
                    <div className="passage">{k('aw.p2')}</div>
                    <div className="src">{k('aw.s2')}</div>
                  </div>
                </div>
                <div className="aw-foot">
                  <span>{k('aw.f1')} <b className="aw-count" /> {k('aw.f1Post')}</span>
                  <span>{k('aw.f2')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="wrap">
            <div className="proofbar">
              {[['“', 'pb1'], ['◱', 'pb2'], ['✓', 'pb3'], ['文', 'pb4']].map(([glyph, key]) => (
                <div key={key}><span className="glyph" aria-hidden="true">{glyph}</span><div><b>{k(`${key}t`)}</b><span>{k(`${key}p`)}</span></div></div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ NASIL ÇALIŞIR ══ */}
        <section id="nasil">
          <div className="wrap">
            <div className="sec-head rise">
              <span className="kicker">{k('how.kicker')}</span>
              <h2>{k('how.title')}</h2>
              <p>{k('how.lead')}</p>
            </div>
            <div className="steps">
              {['s1', 's2', 's3'].map((key, i) => (
                <article key={key} className="step rise"><div className="step__n">{i + 1}</div><h3>{k(`how.${key}t`)}</h3><p>{k(`how.${key}p`)}</p></article>
              ))}
            </div>
          </div>
        </section>

        {/* ══ ÖZELLİKLER ══ */}
        <section id="ozellikler" className="flush">
          <div className="wrap">
            <div className="sec-head rise">
              <span className="kicker">{k('feat.kicker')}</span>
              <h2>{k('feat.title')}</h2>
              <p>{k('feat.lead')}</p>
            </div>
            <div className="grid">
              {FEATURES.map(([ico, key]) => (
                <article key={key} className="feat rise"><div className="feat__ico" aria-hidden="true">{ico}</div><h3>{k(`feat.${key}t`)}</h3><p>{k(`feat.${key}p`)}</p></article>
              ))}
            </div>
          </div>
        </section>

        {/* ══ KANIT SINIFLARI ══ */}
        <section id="kanit" className="flush">
          <div className="wrap">
            <div className="sec-head rise">
              <span className="kicker">{k('cls.kicker')}</span>
              <h2>{k('cls.title')}</h2>
              <p>{k('cls.lead')}</p>
            </div>
            <div className="classes">
              <div className="class-list" role="group" aria-label={k('cls.kicker')}>
                {CLASSES.map((c, i) => (
                  <button key={c} type="button" className="class-btn" data-c={c} aria-pressed={cls === c} onClick={() => setCls(c)} onKeyDown={(e) => onClassKey(e, i)}>
                    <span className={`sw sw-${c}`} aria-hidden="true" /> {k(`cls.${c}.name`)}
                  </button>
                ))}
              </div>
              <div className="class-card">
                <div key={cls} className="pane">
                  <h3>{k(`cls.${cls}.name`)}</h3>
                  <p className="def">{k(`cls.${cls}.def`)}</p>
                  {cls !== 'none' && <span className="eg">{k('cls.eg')}</span>}
                  <p className="quote">{k(`cls.${cls}.quote`)}</p>
                  <p className={`verdict verdict--${cls}`}>{k(`cls.${cls}.verdict`)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ KAYNAKLAR ══ */}
        <section id="kaynaklar" className="flush">
          <div className="wrap">
            <div className="sec-head rise">
              <span className="kicker">{k('src.kicker')}</span>
              <h2>{k('src.title')}</h2>
              <p>{k('src.lead')}</p>
            </div>
            <div className="src-marquee rise" aria-label={t('landing.sources.marqueeLabel')}>
              {MARQUEE_ROWS.map((row, r) => (
                <div key={r} className={`src-marquee__row${r % 2 ? ' src-marquee__row--reverse' : ''}`}>
                  <div className="src-marquee__track">
                    {[0, 1].map((half) => (
                      <div key={half} className="src-marquee__group" aria-hidden={half === 1 || undefined}>
                        {Array.from({ length: MARQUEE_COPIES }, (_, copy) => row.map((key) => {
                          const enrich = ENRICHMENT_SOURCES.includes(key);
                          const first = half === 0 && copy === 0;
                          return (
                            <span
                              key={`${copy}-${key}`}
                              className={`src-chip${enrich ? ' src-chip--enrich' : ''}`}
                              title={first ? t(`landing.sources.items.${key}`) : undefined}
                              aria-hidden={first ? undefined : 'true'}
                            >
                              <i aria-hidden="true" />{SOURCE_NAMES[key]}
                              {enrich && <small>{t('landing.sources.enrichTag')}</small>}
                            </span>
                          );
                        }))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="src-note">{k('src.note')}</p>
          </div>
        </section>

        {/* ══ SINIRLAR ══ */}
        <section className="honest" id="durust">
          <div className="wrap">
            <div className="sec-head rise">
              <span className="kicker">{k('hon.kicker')}</span>
              <h2>{k('hon.titlePre')}<span className="no">{k('hon.titleNo')}</span>{k('hon.titlePost')}</h2>
              <p>{k('hon.lead')}</p>
            </div>
            <div className="grid">
              {['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((key) => (
                <article key={key} className="feat rise"><h3>{k(`hon.${key}t`)}</h3><p>{k(`hon.${key}p`)}</p></article>
              ))}
            </div>
          </div>
        </section>

        {/* ══ SSS ══ */}
        <section id="sss">
          <div className="wrap">
            <div className="sec-head rise">
              <span className="kicker">{k('faq.kicker')}</span>
              <h2>{k('faq.title')}</h2>
            </div>
            <div className="rise">
              {['1', '2', '3', '4'].map((n) => (
                <details key={n} className="faq"><summary>{k(`faq.q${n}`)}</summary><p>{k(`faq.a${n}`)}</p></details>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CTA ══ */}
        <section id="giris" className="flush">
          <div className="wrap">
            <div className="band rise">
              <h2>{k('band.title')}</h2>
              <p>{k('band.lead')}</p>
              <div className="cta">
                <SignInCta className="btn btn--primary btn--lg">{k('band.cta')} <span className="arw" aria-hidden="true">→</span></SignInCta>
                <button type="button" className="btn btn--lg btn--ghostlight" onClick={scrollTo('nasil')}>{k('band.cta2')}</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap foot">
          <div>
            <span className="brand"><BrandMark size={28} /> Literatür AI</span>
            <p>{k('ft.desc')}</p>
          </div>
          <div>
            <h4>{k('ft.h1')}</h4>
            <a href="#nasil" onClick={scrollTo('nasil')}>{k('nav.how')}</a>
            <a href="#ozellikler" onClick={scrollTo('ozellikler')}>{k('nav.features')}</a>
            <a href="#kanit" onClick={scrollTo('kanit')}>{k('cls.kicker')}</a>
          </div>
          <div>
            <h4>{k('ft.h2')}</h4>
            <a href="#kaynaklar" onClick={scrollTo('kaynaklar')}>{k('ft.data')}</a>
            <a href="#durust" onClick={scrollTo('durust')}>{k('hon.kicker')}</a>
            <a href="#sss" onClick={scrollTo('sss')}>{k('nav.faq')}</a>
          </div>
          <div>
            <h4>{k('ft.h3')}</h4>
            <SignInCta className="foot-link">{k('nav.signin')}</SignInCta>
            <SignInCta className="foot-link">{k('nav.start')}</SignInCta>
            <a href="mailto:info@literatur-ai.com">{k('ft.contact')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
