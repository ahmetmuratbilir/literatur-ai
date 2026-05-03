import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { ClerkProvider } from '@clerk/clerk-react';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

createRoot(document.getElementById('root')).render(
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
