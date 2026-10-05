import { useMemo } from 'react';
import { Library, X } from 'lucide-react';
import { useI18n } from '../i18n/context.js';
import { journalKey, isRealJournal } from '../utils/journalKey.js';

/**
 * Konunun hangi dergilerde yayımlandığı: bibliyometride "kaynak dağılımı".
 * Araştırmacıya alanın çekirdek dergilerini ve nereye gönderebileceğini gösterir.
 * Dergiye tıklanınca liste yalnızca o dergiyle süzülür.
 */
export default function JournalBreakdown({ results = [], selectedJournal, onSelectJournal }) {
  const { t } = useI18n();

  const { rows, max, totalJournals } = useMemo(() => {
    const byKey = new Map();
    for (const paper of results) {
      const name = String(paper.publicationName || '').trim();
      if (!isRealJournal(name)) continue;
      const key = journalKey(name);
      if (!key) continue;
      const entry = byKey.get(key) || { key, label: name, count: 0 };
      // En kısa yazımı etiket olarak tut: "Energies" > "Energies (Basel)"
      if (name.length < entry.label.length) entry.label = name;
      entry.count += 1;
      byKey.set(key, entry);
    }
    const all = [...byKey.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    // Tek makalelik dergiler listeyi uzatır, bilgi vermez: en az iki yayını olanlar.
    const repeated = all.filter((row) => row.count > 1).slice(0, 6);
    return { rows: repeated, max: repeated[0]?.count || 1, totalJournals: all.length };
  }, [results]);

  if (rows.length === 0) return null;

  return (
    <section className="jb" aria-labelledby="jb-title">
      <div className="jb__head">
        <span className="jb__icon" aria-hidden="true"><Library size={16} /></span>
        <div className="jb__titles">
          <h4 id="jb-title">{t('journals.title')}</h4>
          <p>{t('journals.hint', { n: totalJournals })}</p>
        </div>
        {selectedJournal && (
          <button type="button" className="jb__clear" onClick={() => onSelectJournal(null)}>
            {t('journals.clear')} <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="jb__list">
        {rows.map((row) => {
          const active = selectedJournal === row.key;
          return (
            <li key={row.key}>
              <button
                type="button"
                className={`jb__row${active ? ' is-active' : ''}`}
                onClick={() => onSelectJournal(active ? null : row.key)}
                aria-pressed={active}
                title={t('journals.filterBy', { name: row.label })}
              >
                <span className="jb__name">{row.label}</span>
                <span className="jb__bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(8, Math.round((row.count / max) * 100))}%` }} />
                </span>
                <span className="jb__count">{row.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
