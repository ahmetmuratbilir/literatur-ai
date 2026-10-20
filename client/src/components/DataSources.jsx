import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Database, X } from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import { useModal } from './ui/useModal.js';

/**
 * Veri kaynakları (WO-029; tüzük 2.7 "Atıf yükümlülükleri"). Bugün kodda aranan
 * kaynaklar, ne için kullanıldıkları, lisansları ve istedikleri atıf/bağlantı.
 * Liste `server/services/search.js` ve zenginleştiricilerle aynı; durumları
 * `docs/sources.md`'de kanıtıyla. Metinler sağlayıcıların istediği ibarelerdir.
 */
const SOURCES = [
  { id: 'openalex', name: 'OpenAlex', url: 'https://openalex.org', license: 'CC0' },
  { id: 'crossref', name: 'Crossref', url: 'https://www.crossref.org', license: 'metadata' },
  { id: 'retraction', name: 'Retraction Watch (Crossref)', url: 'https://retractionwatch.com', license: 'cite' },
  { id: 's2', name: 'Semantic Scholar', url: 'https://www.semanticscholar.org/?utm_source=api', license: 'api' },
  { id: 'europepmc', name: 'Europe PMC', url: 'https://europepmc.org', license: 'mixed' },
  { id: 'pubmed', name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov', license: 'nlm' },
  { id: 'doaj', name: 'DOAJ', url: 'https://doaj.org', license: 'CC0' },
  { id: 'openaire', name: 'OpenAIRE Graph', url: 'https://graph.openaire.eu', license: 'CC-BY' },
  { id: 'datacite', name: 'DataCite', url: 'https://datacite.org', license: 'CC0' },
  { id: 'arxiv', name: 'arXiv', url: 'https://arxiv.org', license: 'CC0' },
  { id: 'core', name: 'CORE', url: 'https://core.ac.uk', license: 'cite' },
  { id: 'unpaywall', name: 'Unpaywall', url: 'https://unpaywall.org', license: 'enrich' },
  { id: 'opencitations', name: 'OpenCitations', url: 'https://opencitations.net', license: 'CC0' },
];

export default function DataSources({ open, onClose }) {
  const { t } = useI18n();
  const id = useId();
  const rootRef = useRef(null);
  const onKeyDown = useModal(rootRef, { open, onCancel: onClose });
  if (!open) return null;
  const k = (key) => t(`dataSources.${key}`);
  return createPortal(
    <div ref={rootRef} className="ui-dialog-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ui-dialog ui-dialog--wide ui-help ui-sources" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} onKeyDown={onKeyDown} data-testid="data-sources">
        <div className="ui-help__head">
          <span className="ui-help__icon" aria-hidden="true"><Database size={18} /></span>
          <h2 id={`${id}-t`} className="ui-dialog__title">{k('title')}</h2>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-help__close" onClick={onClose} aria-label={t('common.close')} data-action="sources-close"><X size={18} /></button>
        </div>
        <p className="ui-sources__lead">{k('lead')}</p>
        <ul className="ui-sources__list">
          {SOURCES.map((s) => (
            <li key={s.id} className="ui-sources__item">
              <div className="ui-sources__row">
                <a href={s.url} target="_blank" rel="noopener noreferrer"><strong>{s.name}</strong></a>
                <span className="ui-sources__lic">{k(`license.${s.license}`)}</span>
              </div>
              <span className="ui-sources__use">{k(`use.${s.id}`)}</span>
              {t(`dataSources.credit.${s.id}`) !== `dataSources.credit.${s.id}` && (
                <span className="ui-sources__credit">{k(`credit.${s.id}`)}</span>
              )}
            </li>
          ))}
        </ul>
        <p className="ui-sources__note">{k('note')}</p>
      </div>
    </div>,
    document.body,
  );
}
