import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, Pencil, Plus, ListTree, Table2 } from 'lucide-react';
import { useI18n } from '../../i18n/context.js';

/**
 * Belge yapısı (WO-011 Faz 2): editördeki gerçek başlıklardan numaralı, iç
 * içe ağaç. Tıklayınca bölüme gider; kaydırınca aktif bölüm vurgulanır
 * (`current`). Yeniden adlandırma, ekleme ve sıralama belgedeki başlığı
 * değiştirir; taşıma bölümü içeriği ve alt bölümleriyle götürür, metin silmez.
 * Kelime sayısı yalnız şablonda hedef varsa, düz gri metin.
 */
export default function OutlineNav({
  headings, numbers, current, words, captions, readOnly,
  onGo, onRename, onMove, onStep, onAdd, onRevealCaption,
  renaming, setRenaming,
}) {
  const { t, lang } = useI18n();
  const fmt = (n) => Number(n || 0).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US');
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [dragFrom, setDragFrom] = useState(null);
  const [dropAt, setDropAt] = useState(null);

  const hasChildren = (i) => Boolean(headings[i + 1] && headings[i + 1].level > headings[i].level);
  // Katlanmış bir üst başlığın altındakiler gizlenir.
  const hidden = new Set();
  headings.forEach((h, i) => {
    if (!collapsed.has(i)) return;
    for (let j = i + 1; j < headings.length && headings[j].level > h.level; j += 1) hidden.add(j);
  });
  const toggle = (i) => setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  });

  const commitRename = (i, value) => {
    setRenaming(null);
    const text = value.trim();
    if (text && text !== headings[i]?.text) onRename(i, text);
  };

  return (
    <aside className="wx-nav" aria-label={t('workspace.outline')}>
      <div className="wx-panel-head">
        <strong>{t('workspace.outline')}</strong>
        {words > 0 && <small>{t('workspace.stat.words', { n: fmt(words) })}</small>}
        {/* Aç/kapa düğmesi biçim çubuğunun en solunda (Workspace, 21.10.2026). */}
      </div>
      <div className="wx-nav__body">
        {headings.length === 0 && <p className="wx-muted">{t('workspace.noSections')}</p>}
        <ol className="wx-outline" aria-label={t('workspace.outline')}>
          {headings.map((h, i) => {
            if (hidden.has(i)) return null;
            const name = h.text || t('workspace.untitledSection');
            const parent = hasChildren(i);
            return (
              <li
                key={`${i}-${name}`}
                className={`wx-ol wx-ol--l${h.level}${current === i ? ' is-current' : ''}${dropAt === i ? ' is-drop' : ''}`}
                data-index={i}
                draggable={!readOnly && renaming !== i}
                onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
                onDragOver={(e) => { if (dragFrom !== null) { e.preventDefault(); setDropAt(i); } }}
                onDragLeave={() => setDropAt((d) => (d === i ? null : d))}
                onDrop={(e) => { e.preventDefault(); if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i); setDragFrom(null); setDropAt(null); }}
                onDragEnd={() => { setDragFrom(null); setDropAt(null); }}
              >
                {parent ? (
                  <button type="button" className="wx-ol__fold" onClick={() => toggle(i)} aria-expanded={!collapsed.has(i)} aria-label={collapsed.has(i) ? t('workspace.outlineNav.expand') : t('workspace.outlineNav.collapse')}>
                    {collapsed.has(i) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>
                ) : <span className="wx-ol__fold" aria-hidden="true" />}
                {renaming === i ? (
                  <input
                    className="wx-ol__input"
                    defaultValue={h.text}
                    autoFocus
                    aria-label={t('workspace.outlineNav.renameLabel')}
                    onFocus={(e) => e.target.select()}
                    onBlur={(e) => commitRename(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(i, e.target.value);
                      if (e.key === 'Escape') { e.preventDefault(); setRenaming(null); }
                    }}
                    data-action="outline-rename-input"
                  />
                ) : (
                  <button
                    type="button"
                    className="wx-ol__go"
                    onClick={() => onGo(i)}
                    onDoubleClick={() => !readOnly && setRenaming(i)}
                    aria-label={t('workspace.goToSection', { name })}
                    aria-current={current === i ? 'location' : undefined}
                  >
                    <span className="wx-ol__num">{numbers[i]}</span>
                    <span className="wx-ol__name">{name}</span>
                    {h.target ? (
                      <span className="wx-ol__count" title={t('workspace.targetHint')}>{fmt(h.total)} / {fmt(h.target)}</span>
                    ) : null}
                  </button>
                )}
                {!readOnly && renaming !== i && (
                  <span className="wx-ol__acts">
                    <span className="wx-ol__grip" aria-hidden="true" title={t('workspace.outlineNav.drag')}><GripVertical size={13} /></span>
                    <button type="button" onClick={() => setRenaming(i)} aria-label={t('workspace.outlineNav.rename', { name })} title={t('workspace.outlineNav.rename', { name })} data-action="outline-rename"><Pencil size={12} /></button>
                    <button type="button" onClick={() => onStep(i, -1)} aria-label={t('workspace.outlineNav.moveUp', { name })} title={t('workspace.outlineNav.moveUp', { name })} data-action="outline-up"><ArrowUp size={12} /></button>
                    <button type="button" onClick={() => onStep(i, 1)} aria-label={t('workspace.outlineNav.moveDown', { name })} title={t('workspace.outlineNav.moveDown', { name })} data-action="outline-down"><ArrowDown size={12} /></button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        {!readOnly && (
          <button type="button" className="wx-act wx-act--sm wx-ol__add" onClick={onAdd} data-action="outline-add">
            <Plus size={13} /> {t('workspace.outlineNav.add')}
          </button>
        )}

        <section className="wx-figs" aria-label={t('workspace.outlineNav.figures')}>
          <h4><Table2 size={13} /> {t('workspace.outlineNav.figures')}</h4>
          {captions.length === 0 ? (
            <p className="wx-muted" data-testid="figures-empty">{t('workspace.outlineNav.figuresEmpty')}</p>
          ) : (
            <ul>
              {captions.map((c) => (
                <li key={`${c.key}-${c.text}`}>
                  <button type="button" onClick={() => onRevealCaption(c.key)} data-action="outline-caption">{c.text}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
