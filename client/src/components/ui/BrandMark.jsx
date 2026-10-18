import { useId } from 'react';

/**
 * Literatür AI marka işareti (WO-024): rafine şimşek. `public/favicon.svg`
 * ile aynı çizim; uygulama içinde lucide `Zap` yerine kullanılır. Degrade
 * kimlikleri `useId` ile tekildir, aynı sayfada birden çok işaret çakışmaz.
 */
export default function BrandMark({ size = 32, className, title }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 140 140"
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}bg`} x1="18" y1="6" x2="122" y2="134" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6d5dfc" /><stop offset=".55" stopColor="#5b4cf0" /><stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id={`${id}sh`} x1="70" y1="0" x2="70" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}bo`} x1="60" y1="22" x2="80" y2="118" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#e8e5ff" />
        </linearGradient>
      </defs>
      <rect width="140" height="140" rx="34" fill={`url(#${id}bg)`} />
      <rect width="140" height="140" rx="34" fill={`url(#${id}sh)`} />
      <path d="M83 20 L41 77 H67 L57 120 L100 61 H74 Z" fill={`url(#${id}bo)`} stroke={`url(#${id}bo)`} strokeWidth="7" strokeLinejoin="round" />
    </svg>
  );
}
