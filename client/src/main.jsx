import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DevModeBanner from './components/DevModeBanner.jsx'
import { CLERK_ENABLED } from './auth/clerkBridge.js'

import { ClerkProvider } from '@clerk/clerk-react';
import I18nProvider from './i18n/I18nProvider.jsx';
import { DialogProvider } from './components/ui/DialogProvider.jsx';
import ErrorBoundary from './components/ui/ErrorBoundary.jsx';
import TooltipLayer from './components/ui/TooltipLayer.jsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const root = createRoot(document.getElementById('root'));

// İki dalın (Clerk'li / Clerk'siz) ortak ağacı. En dış hata sınırı: bir
// bileşen çökerse beyaz sayfa yerine kurtarma ekranı (WO-024).
const shell = (
  <DialogProvider>
    <ErrorBoundary area="page">
      <App />
    </ErrorBoundary>
    <TooltipLayer />
  </DialogProvider>
);

const clerkAppearance = {
  variables: {
    colorPrimary: '#4f46e5',
    borderRadius: '16px',
    fontSize: '1rem',
  },
  elements: {
    // Sabit 480px telefonda ekrandan genişti: 390px ekranda pencere 45px sola
    // taşıyordu (sol kenar kesik, sağda boşluk). Ekrandan 32px dar, en fazla 480px.
    rootBox: {
      width: 'min(480px, calc(100vw - 32px))',
    },
    cardBox: {
      width: '100%',
      maxWidth: '100%',
    },
    card: {
      width: '100%',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
      border: '1px solid rgba(255,255,255,0.08)',
    },
    formButtonPrimary: {
      height: '48px',
      fontSize: '1rem',
      textTransform: 'none',
    },
    formFieldInput: {
      height: '44px',
    },
    socialButtonsBlockButton: {
      height: '48px',
    }
  }
};

if (!CLERK_ENABLED) {
  // Anahtar yokken uygulamayı engellemek yerine, ClerkProvider olmadan
  // render ediyoruz. clerkBridge kimlik hook'unu yerel bir geliştirme
  // kimliğiyle değiştirir; üstteki şerit durumun ne olduğunu söyler.
  console.warn(
    '[Clerk] VITE_CLERK_PUBLISHABLE_KEY tanımlı değil — geliştirme modunda çalışılıyor.'
  );
  root.render(
    <StrictMode>
      <I18nProvider>
        <DevModeBanner />
        {shell}
      </I18nProvider>
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <I18nProvider>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
          {shell}
        </ClerkProvider>
      </I18nProvider>
    </StrictMode>,
  );
}
