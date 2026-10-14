import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Trash2 } from 'lucide-react';
import { useI18n } from '../i18n/context.js';

const MotionDiv = motion.div;
const CONFIRM_MS = 3000;
const TITLE_MAX = 22;

const shorten = (text) => (text.length > TITLE_MAX ? `${text.slice(0, TITLE_MAX - 1)}…` : text);

/**
 * Sağ kenardaki yazar modu düğmesi ve sayaç. Üzerine gelince altında çöp
 * kutusu çıkar: tutulan makaleleri temizler. 30 makaleyi tek yanlış tıklamayla
 * kaybetmemek için iki adımlı: ilk tıklama "Temizle?" diye sorar, 3 sn içinde
 * ikinci tıklama siler.
 *
 * Açık bir taslak varsa düğme ona döner ("Taslağa dön: …"); yoksa yazar
 * modunu açar ve biçim seçimiyle yeni taslak başlar (WO-011).
 */
const WriterDock = ({ count, limit, draftTitle, onOpen, onClear }) => {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleTrash = () => {
    clearTimeout(timer.current);
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), CONFIRM_MS);
      return;
    }
    setConfirming(false);
    onClear();
  };

  return (
    <MotionDiv
      className="ui-writer-dock-wrap"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      onMouseLeave={() => { if (confirming) { clearTimeout(timer.current); setConfirming(false); } }}
    >
      <button
        type="button"
        className="ui-writer-dock"
        data-basket-target="primary"
        onClick={onOpen}
        title={draftTitle ? t('writerDock.resume', { name: draftTitle }) : t('writerDock.title')}
        aria-label={draftTitle ? t('writerDock.resumeAria', { name: draftTitle }) : t('writerDock.aria', { n: count })}
        data-action="writer-dock"
      >
        <Sparkles size={17} />
        <span className="ui-writer-dock__label">
          {draftTitle ? t('writerDock.resume', { name: shorten(draftTitle) }) : t('writerDock.label')}
        </span>
        <span className="ui-writer-dock__count">{count}<small>/{limit}</small></span>
      </button>

      {count > 0 && (
        <button
          type="button"
          className={`ui-writer-dock__trash${confirming ? ' is-confirming' : ''}`}
          onClick={handleTrash}
          title={confirming ? t('writerDock.clearConfirm') : t('writerDock.clear')}
          aria-label={confirming ? t('writerDock.clearConfirm') : t('writerDock.clear')}
        >
          <Trash2 size={15} />
          {confirming && <span>{t('writerDock.clearShort')}</span>}
        </button>
      )}
    </MotionDiv>
  );
};

export default WriterDock;
