import { useI18n } from '../i18n/context.js';

/**
 * EN | TR segment anahtarı. Hem arayüz dili (üst çubuk) hem sonuç dili
 * (sonuç çubuğu) için kullanılır; `value`/`onChange` verilmezse arayüz dilini
 * yönetir.
 */
const LanguageSwitcher = ({ value, onChange, label, disabled = false, title }) => {
  const { lang, setLang, t } = useI18n();
  const current = value ?? lang;
  const change = onChange ?? setLang;

  return (
    <div className="ui-seg" role="group" aria-label={label || t('common.language')} title={title}>
      {['en', 'tr'].map((code) => (
        <button
          key={code}
          type="button"
          className="ui-seg__btn"
          aria-pressed={current === code}
          disabled={disabled}
          onClick={() => current !== code && change(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
