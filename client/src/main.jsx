import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DevModeBanner from './components/DevModeBanner.jsx'
import { CLERK_ENABLED } from './auth/clerkBridge.js'

import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const root = createRoot(document.getElementById('root'));

const clerkAppearance = {
  variables: {
    colorPrimary: '#4f46e5',
    borderRadius: '16px',
    fontSize: '1rem',
  },
  elements: {
    rootBox: {
      width: '480px',
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
      <DevModeBanner />
      <App />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} appearance={clerkAppearance}>
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}
