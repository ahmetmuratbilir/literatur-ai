import { AnimatePresence, motion } from 'framer-motion';

// App.jsx ile ayni kalip. ESLint yapilandirmasinda eslint-plugin-react yok,
// bu yuzden JSX icindeki motion.div kullanimi "kullanim" sayilmiyor ve `motion`
// "kullanilmayan degisken" olarak raporlaniyor. Buyuk harfle baslayan bir
// takma ad hem bu yanlis pozitifi kaldiriyor hem de kod tabanini tutarli
// kiliyor.
const MotionDiv = motion.div;
import {
  X,
  Share2,
  CheckCircle2,
  Link2,
  Linkedin,
  Mail
} from 'lucide-react';

export default function ShareModal({ show, onClose, shareUrl, copied, onCopy }) {
  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <MotionDiv
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)' }}
          />
          <MotionDiv
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '440px',
              background: '#1e293b',
              borderRadius: '24px',
              padding: '2.5rem 1.5rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <button
              onClick={onClose}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #4f46e5, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <Share2 size={28} color="white" />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '0.5rem' }}>Araştırmayı Paylaş</h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                Bu çalışmayı meslektaşlarınızla paylaşarak literatür tarama sürecini hızlandırın.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '2rem' }}>
              {/* Copy Link */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={onCopy}
                  className="share-circle-btn"
                  style={{
                    width: '64px', height: '64px', borderRadius: '50%', background: copied ? '#10b981' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', transform: copied ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                  }}
                >
                  {copied ? <CheckCircle2 size={24} color="white" strokeWidth={3} /> : <Link2 size={24} color="#1e293b" strokeWidth={2.5} />}
                </button>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: copied ? '#10b981' : 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.02em' }}>
                  {copied ? 'Kopyalandı!' : 'Bağlantı'}
                </span>
              </div>

              {/* WhatsApp */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent('Harika bir akademik araştırma buldum: \n\n' + shareUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="share-circle-btn"
                  style={{
                    width: '64px', height: '64px', borderRadius: '50%', background: '#25D366',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                    color: 'white', transition: 'all 0.3s ease', textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
                  }}
                >
                  <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.02em' }}>WhatsApp</span>
              </div>

              {/* LinkedIn */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="share-circle-btn"
                  style={{
                    width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                    color: 'white', transition: 'all 0.3s ease', textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <Linkedin size={22} strokeWidth={2.5} fill="currentColor" />
                </a>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.02em' }}>LinkedIn</span>
              </div>

              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <a
                  href={`mailto:?subject=${encodeURIComponent('LiteratureAI Araştırma Paylaşımı')}&body=${encodeURIComponent('Merhaba,\n\nBu akademik araştırmayı seninle paylaşmak istedim:\n\n' + shareUrl)}`}
                  className="share-circle-btn"
                  style={{
                    width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                    color: 'white', transition: 'all 0.3s ease', textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <Mail size={22} strokeWidth={2.5} />
                </a>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.7)', letterSpacing: '0.02em' }}>E-posta</span>
              </div>
            </div>
          </MotionDiv>
        </div>
      )}
    </AnimatePresence>
  );
}
