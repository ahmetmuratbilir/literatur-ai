import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SetupNotice from './components/SetupNotice.jsx'

import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const root = createRoot(document.getElementById('root'));

// Anahtar yoksa throw etmek yerine kurulum ekranını göster: throw, React kök
// render'ini tamamen engelleyip bembeyaz bir sayfa birakiyordu.
if (!PUBLISHABLE_KEY) {
  console.error('[Clerk] VITE_CLERK_PUBLISHABLE_KEY tanımlı değil.');
  root.render(<SetupNotice />);
} else {
  root.render(
    <StrictMode>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        appearance={{
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
        }}
      >
        <App />
      </ClerkProvider>
    </StrictMode>,
  )
}
