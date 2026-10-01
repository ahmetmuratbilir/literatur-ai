import {
  ArrowRight,
  BarChart2,
  Download,
  FileSearch,
  Languages,
  ListChecks,
  Moon,
  PenLine,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
  Unlock,
  Zap,
} from 'lucide-react';
import { AppSignInButton } from '../../auth/clerkBridge.js';
import { useI18n } from '../../i18n/context.js';
import LanguageSwitcher from '../LanguageSwitcher';

/**
 * Giriş yapmamış ziyaretçinin gördüğü tanıtım sayfası.
 *
 * Yalnızca ürünün gerçekten yaptığı şeyler anlatılıyor: kullanıcı sayısı,
 * "810M+ kayıt" gibi doğrulanamayan rakamlar ve kapalı olan Scopus çıkarıldı.
 * Örnek sonuç kartındaki makaleler gerçek yayınlar; puanlar örnek olduğu için
 * kartta "örnek" etiketi var.
 */

const SEARCH_SOURCES = ['openalex', 'crossref', 's2', 'europepmc', 'openaire', 'datacite', 'doaj', 'arxiv', 'core'];
const ENRICHMENT_SOURCES = ['opencitations', 'unpaywall'];
const SOURCE_NAMES = {
  openalex: 'OpenAlex',
  crossref: 'Crossref',
  s2: 'Semantic Scholar',
  europepmc: 'Europe PMC',
  doaj: 'DOAJ',
  arxiv: 'arXiv',
  core: 'CORE',
  openaire: 'OpenAIRE',
  datacite: 'DataCite',
  opencitations: 'OpenCitations',
  unpaywall: 'Unpaywall',
};

const FEATURES = [
  { key: 'profiles', icon: SlidersHorizontal },
  { key: 'explain', icon: BarChart2 },
  { key: 'retraction', icon: ShieldAlert },
  { key: 'oa', icon: Unlock },
  { key: 'writer', icon: PenLine },
  { key: 'export', icon: Download },
];

const STEPS = ['query', 'collect', 'rank'];

const EXAMPLE_QUERIES = ['transformer language models', 'urban heat islands', 'microplastics in drinking water', 'supply chain resilience'];

const EXAMPLE_RESULTS = [
  { title: 'Attention Is All You Need', meta: 'Vaswani et al. · 2017 · NeurIPS', sources: ['arXiv', 'OpenAlex'], score: 92 },
  { title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', meta: 'Devlin et al. · 2019 · NAACL', sources: ['Crossref', 'Semantic Scholar'], score: 88 },
  { title: 'LoRA: Low-Rank Adaptation of Large Language Models', meta: 'Hu et al. · 2022 · ICLR', sources: ['arXiv', 'OpenAlex'], score: 81 },
];

const SignInCta = ({ className, children }) => (
  <AppSignInButton mode="modal">
    <button type="button" className={className}>{children}</button>
  </AppSignInButton>
);

export default function LandingPage({ landingTheme = 'light', setLandingTheme }) {
  const { t } = useI18n();
  const dark = landingTheme === 'dark';

  return (
    <div className="lp" data-theme={dark ? 'dark' : 'light'}>
      <header className="lp-nav">
        <a className="lp-brand" href="#top">
          <span className="ui-brand-mark"><Zap size={16} fill="currentColor" /></span>
          Literatür AI
        </a>
        <nav className="lp-nav__links" aria-label={t('landing.nav.label')}>
          <a href="#how">{t('landing.nav.how')}</a>
          <a href="#features">{t('landing.nav.features')}</a>
          <a href="#sources">{t('landing.nav.sources')}</a>
        </nav>
        <div className="lp-nav__actions">
          <LanguageSwitcher />
          {setLandingTheme && (
            <button
              type="button"
              className="lp-icon-btn"
              onClick={() => setLandingTheme(dark ? 'light' : 'dark')}
              aria-label={dark ? t('landing.nav.lightMode') : t('landing.nav.darkMode')}
              title={dark ? t('landing.nav.lightMode') : t('landing.nav.darkMode')}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          )}
          <SignInCta className="lp-btn lp-btn--ghost lp-hide-sm">{t('landing.nav.signIn')}</SignInCta>
          <SignInCta className="lp-btn lp-btn--primary">{t('landing.nav.start')}</SignInCta>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero">
          <p className="lp-eyebrow">{t('landing.hero.eyebrow')}</p>
          <h1>{t('landing.hero.title')}</h1>
          <p className="lp-lead">{t('landing.hero.lead')}</p>

          <div className="lp-search">
            <Search size={20} aria-hidden="true" />
            <input readOnly placeholder={t('landing.hero.placeholder')} aria-label={t('landing.hero.placeholder')} />
            <SignInCta className="lp-btn lp-btn--primary">{t('landing.hero.search')}</SignInCta>
          </div>
          <div className="lp-examples">
            <span>{t('landing.hero.try')}</span>
            {EXAMPLE_QUERIES.map((q) => (
              <SignInCta key={q} className="lp-chip">{q}</SignInCta>
            ))}
          </div>
        </section>

        <section className="lp-preview" aria-label={t('landing.preview.label')}>
          <div className="lp-preview__head">
            <FileSearch size={18} aria-hidden="true" />
            <span className="lp-preview__query">transformer language models</span>
            <span className="lp-tag">{t('landing.preview.example')}</span>
            <span className="lp-preview__profile">{t('landing.preview.profile')}</span>
          </div>
          <ol className="lp-preview__list">
            {EXAMPLE_RESULTS.map((r, i) => (
              <li key={r.title} className="lp-result">
                <span className="lp-result__rank">{i + 1}</span>
                <div className="lp-result__body">
                  <strong>{r.title}</strong>
                  <span>{r.meta}</span>
                  <div className="lp-result__sources">
                    {r.sources.map((s) => <span key={s} className="lp-tag lp-tag--soft">{s}</span>)}
                  </div>
                </div>
                <div className="lp-result__score" aria-label={t('landing.preview.score', { n: r.score })}>
                  <span>{r.score}</span>
                  <div className="lp-bar"><div style={{ width: `${r.score}%` }} /></div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="how" className="lp-section">
          <p className="lp-eyebrow">{t('landing.how.eyebrow')}</p>
          <h2>{t('landing.how.title')}</h2>
          <ol className="lp-steps">
            {STEPS.map((step, i) => (
              <li key={step}>
                <span className="lp-steps__num">{i + 1}</span>
                <h3>{t(`landing.how.${step}.title`)}</h3>
                <p>{t(`landing.how.${step}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="lp-section">
          <p className="lp-eyebrow">{t('landing.features.eyebrow')}</p>
          <h2>{t('landing.features.title')}</h2>
          <div className="lp-features">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.key} className="lp-feature">
                  <span className="lp-feature__icon"><Icon size={18} /></span>
                  <h3>{t(`landing.features.${feature.key}.title`)}</h3>
                  <p>{t(`landing.features.${feature.key}.text`)}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="sources" className="lp-section">
          <p className="lp-eyebrow">{t('landing.sources.eyebrow')}</p>
          <h2>{t('landing.sources.title')}</h2>
          <p className="lp-section__lead">{t('landing.sources.lead')}</p>
          <div className="lp-sources">
            {SEARCH_SOURCES.map((key) => (
              <div key={key} className="lp-source">
                <strong>{SOURCE_NAMES[key]}</strong>
                <span>{t(`landing.sources.items.${key}`)}</span>
              </div>
            ))}
          </div>
          <h3 className="lp-subhead"><ListChecks size={16} aria-hidden="true" /> {t('landing.sources.enrichment')}</h3>
          <div className="lp-sources lp-sources--two">
            {ENRICHMENT_SOURCES.map((key) => (
              <div key={key} className="lp-source">
                <strong>{SOURCE_NAMES[key]}</strong>
                <span>{t(`landing.sources.items.${key}`)}</span>
              </div>
            ))}
          </div>
          <p className="lp-note"><Languages size={14} aria-hidden="true" /> {t('landing.sources.language')}</p>
        </section>

        <section className="lp-cta">
          <h2>{t('landing.cta.title')}</h2>
          <p>{t('landing.cta.text')}</p>
          <SignInCta className="lp-btn lp-btn--primary lp-btn--lg">
            {t('landing.nav.start')} <ArrowRight size={18} />
          </SignInCta>
        </section>
      </main>

      <footer className="lp-footer">
        <span>© {new Date().getFullYear()} Literatür AI</span>
        <span>{t('landing.footer')}</span>
      </footer>
    </div>
  );
}
