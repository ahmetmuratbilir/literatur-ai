import { BookmarkCheck, FileText } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

// İlk kez gelen kullanıcıya örnek konular: "örnek" diye etiketli, tıklayınca konu kutusuna yazılır.
const EXAMPLES = {
  tr: ['küçük modüler reaktörlerde pasif soğutma', 'kentsel ısı adası', 'içme suyunda mikroplastik', 'tedarik zinciri dayanıklılığı'],
  en: ['passive cooling in small modular reactors', 'urban heat islands', 'microplastics in drinking water', 'supply chain resilience'],
};

/**
 * Arama ana sayfasında "kaldığın yer" (WO-026 Faz 4, A2). Yalnız kullanıcının
 * kendi verisi: son taslak ve "Makalen için" sayısı. Veri yoksa kutucuk yok;
 * yeni kullanıcıya "örnek" etiketli konular. Uydurma sayı, istatistik yok (2.8).
 */
export default function HomeResume({ drafts = [], basketCount = 0, onOpenDraft, onOpenBasket, onPickTopic }) {
  const { t, lang } = useI18n();
  const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
  const last = [...drafts].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
  const when = (v) => (v ? new Date(v).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

  if (!last && !basketCount) {
    return (
      <section className="home-resume home-resume--new" aria-label={t('home.examplesLabel')} data-testid="home-examples">
        <span className="home-resume__lead">{t('home.examplesLead')} <em className="home-tag">{t('home.example')}</em></span>
        <div className="home-chips">
          {(EXAMPLES[lang] || EXAMPLES.tr).map((topic) => (
            <button key={topic} type="button" className="home-chip" onClick={() => onPickTopic(topic)} data-action="home-example">{topic}</button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="home-resume" aria-label={t('home.resumeLabel')} data-testid="home-resume">
      {last && (
        <button type="button" className="home-tile" onClick={() => onOpenDraft(last.id)} data-action="home-last-draft">
          <span className="home-tile__icon" aria-hidden="true"><FileText size={17} /></span>
          <span className="home-tile__text">
            <small>{t('home.lastDraft')}</small>
            <strong>{last.title || t('workspace.untitled')}</strong>
            <span>{t('sidebar.draftMeta', { n: (last.words || 0).toLocaleString(locale), when: when(last.savedAt) })}</span>
          </span>
        </button>
      )}
      {basketCount > 0 && (
        <button type="button" className="home-tile" onClick={onOpenBasket} data-action="home-basket">
          <span className="home-tile__icon" aria-hidden="true"><BookmarkCheck size={17} /></span>
          <span className="home-tile__text">
            <small>{t('basket.title')}</small>
            <strong>{t('home.basketCount', { n: basketCount.toLocaleString(locale) })}</strong>
            <span>{t('home.basketHint')}</span>
          </span>
        </button>
      )}
    </section>
  );
}
