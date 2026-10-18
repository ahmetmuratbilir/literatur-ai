import { Check, Plus, RotateCcw, Table2 } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';
import { isEmptyGrid } from '../../visuals/table.js';
import TableEditor from './TableEditor.jsx';

/**
 * Görsel paneli (WO-019). Sağ panelin "Görsel" sekmesi: tablo bugün; şekil ve
 * grafik kendi fazlarında gelir — yarım özellik gösterilmez.
 *
 * Belgeye hiçbir şey kendiliğinden girmez (CLAUDE.md 2.9): yeni tablo yalnız
 * "Belgeye ekle" ile, değişiklik yalnız "Güncelle" ile yazılır. Belge
 * işlemleri Workspace'te; bu bileşen yalnız durumu gösterir ve olay bildirir.
 *
 * @param visual `{ mode: 'new'|'edit', grid, title, number, dirty, stale, notice }` ya da null
 * @param target Yeni tablonun yeri: `{ kind: 'after'|'at'|'end', excerpt }`
 * @param removed Son kaldırılan tablo varsa true: "Geri al" gösterilir
 */
export default function VisualPanel({
  visual, target, removed, onNew, onChange, onInsert, onUpdate, onRemove, onClose, onReread, onUndoRemove,
}) {
  const { t, lang } = useI18n();
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');

  if (!visual) {
    return (
      <section className="wx-visual" aria-label={t('workspace.visual.tab')}>
        {removed && (
          <p className="wx-visual__removed" role="status">
            {t('workspace.visual.removed')}
            <button type="button" className="wx-act" onClick={onUndoRemove} data-action="visual-undo-remove">
              <RotateCcw size={12} /> {t('workspace.visual.undo')}
            </button>
          </p>
        )}
        <article className="wx-card">
          <h4><Table2 size={14} /> {t('workspace.visual.table.title')}</h4>
          <p className="wx-muted">{t('workspace.visual.startText')}</p>
          <div className="wx-acts">
            <button type="button" className="wx-act wx-act--primary" onClick={onNew} data-action="visual-new-table">
              <Plus size={13} /> {t('workspace.visual.table.new')}
            </button>
          </div>
          <small className="wx-muted">{t('workspace.visual.editHint')}</small>
        </article>
      </section>
    );
  }

  const empty = isEmptyGrid(visual.grid);
  const word = t('audit.kind.table');
  return (
    <section className="wx-visual" aria-label={t('workspace.visual.tab')}>
      <div className="wx-visual__head">
        <strong>{visual.mode === 'new' ? t('workspace.visual.table.new') : t('workspace.visual.table.editing', { n: fmt(visual.number) })}</strong>
      </div>

      <label className="wx-visual__caption">
        <span>{word} {visual.number ? fmt(visual.number) : 'N'}.</span>
        <input
          type="text"
          value={visual.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={t('workspace.visual.table.captionPlaceholder')}
          aria-label={t('workspace.visual.table.captionLabel')}
          maxLength={200}
          data-action="visual-caption"
        />
      </label>

      <TableEditor grid={visual.grid} onChange={(grid) => onChange({ grid })} onNotice={(notice) => onChange({ notice }, { quiet: true })} />
      {visual.notice && <small className="wx-visual__notice" role="status">{visual.notice}</small>}

      {visual.stale && (
        <p className="wx-warn" role="status">
          {t('workspace.visual.stale')}{' '}
          <button type="button" className="wx-linkbtn" onClick={onReread} data-action="visual-reread">{t('workspace.visual.reread')}</button>
        </p>
      )}

      {visual.mode === 'new' ? (
        <>
          <p className="wx-visual__where" data-testid="visual-target">
            {target.kind === 'end' ? t('workspace.visual.whereEnd')
              : target.kind === 'at' ? t('workspace.visual.whereAt')
                : t('workspace.visual.whereAfter', { excerpt: target.excerpt })}
          </p>
          <div className="wx-acts">
            <button type="button" className="wx-act wx-act--primary" onClick={onInsert} disabled={empty} data-action="visual-insert">
              {t('workspace.visual.insert')}
            </button>
            <button type="button" className="wx-act" onClick={onClose} data-action="visual-cancel">{t('workspace.visual.cancel')}</button>
          </div>
          <small className="wx-muted">{empty ? t('workspace.visual.needCell') : t('workspace.visual.insertNote')}</small>
        </>
      ) : (
        <>
          <div className="wx-acts">
            {visual.dirty ? (
              <button type="button" className="wx-act wx-act--primary" onClick={onUpdate} data-action="visual-update">
                {t('workspace.visual.update')}
              </button>
            ) : (
              <span className="wx-done"><Check size={14} /> {t('workspace.visual.inDocument')}</span>
            )}
            <button type="button" className="wx-act" onClick={onRemove} data-action="visual-remove">{t('workspace.visual.remove')}</button>
            <button type="button" className="wx-act" onClick={onClose} data-action="visual-close">{t('workspace.visual.close')}</button>
          </div>
          <small className="wx-muted">{t('workspace.visual.editNote')}</small>
        </>
      )}
    </section>
  );
}
