import { AnimatePresence, motion } from 'framer-motion';
const MotionDiv = motion.div;

import {
  BarChart2,
  Search,
  Download,
  X,
  Zap,
  Sparkles,
  Sun,
  FileText,
  Cpu,
  Trophy,
  FileSearch,
  ChevronDown,
  Filter,
  Check,
  Bookmark,
  Star,
  Layers,
  Share2,
  Library,
  ShieldCheck,
  Moon,
  GraduationCap,
  Building2,
  Microscope,
  Users
} from 'lucide-react';
import { AppSignInButton } from '../../auth/clerkBridge.js';

const FEATURE_HIGHLIGHTS = [
  {
    icon: Sparkles,
    title: 'AI sorgu genişletme',
    text: 'Türkçe konunuz İngilizce Boolean sorguya çevrilir; 5 alternatif öneri sunulur.'
  },
  {
    icon: BarChart2,
    title: 'AHP skorlama',
    text: 'Alaka, atıf ve güncellik ağırlıklarıyla her makale 0-100 arası puanlanır.'
  },
  {
    icon: Download,
    title: 'Tek tık dışa aktarım',
    text: 'Sonuçları PDF, Word veya Excel olarak hazır rapor halinde indirin.'
  }
];

const USER_TIERS = [
  {
    icon: Users,
    title: 'Akademisyenler',
    text: 'Literatür taramasını saniyeler içinde tamamlayın.'
  },
  {
    icon: Building2,
    title: 'Kurumlar',
    text: 'Üniversite kütüphanenizi akıllı asistanla güçlendirin.'
  },
  {
    icon: Microscope,
    title: 'Araştırmacılar',
    text: 'Yüzbinlerce döküman içinden doğru veriyi bulun.'
  },
  {
    icon: GraduationCap,
    title: 'Öğrenciler',
    text: 'Araştırma ödevlerinizi doğru kaynaklarla tamamlayın.'
  }
];

const LANDING_STATS = [
  { value: '810M+', label: 'Akademik Kaynak' },
  { value: '1.2B+', label: 'Atıf Verisi' },
  { value: '60.000+', label: 'Bireysel Araştırmacı' }
];

export default function LandingPage({ landingTheme, activeLandingTab, setActiveLandingTab, setLandingTheme, isMobile }) {
  return (
    <div className="landing-page" style={{
      minHeight: '100vh',
      background: landingTheme === 'light' ? '#f8fafc' : '#0f172a',
      color: landingTheme === 'light' ? '#0f172a' : '#f8fafc',
      overflowX: 'hidden',
      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      {/* Custom Clerk Styling to make it larger and premium */}
      <style>{`
        .cl-modalBackdrop {
          backdrop-filter: blur(8px) !important;
          background-color: rgba(0, 0, 0, 0.4) !important;
        }
      `}</style>

      {/* Landing Info Modals */}
      <AnimatePresence>
        {activeLandingTab && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveLandingTab(null)}
              style={{ position: 'absolute', inset: 0, background: landingTheme === 'light' ? 'rgba(15, 23, 42, 0.4)' : 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)' }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{
                position: 'relative', width: '100%', maxWidth: '600px',
                background: landingTheme === 'light' ? 'white' : '#1e293b',
                borderRadius: '32px',
                padding: '3rem',
                boxShadow: '0 30px 60px -12px rgba(0,0,0,0.25)',
                border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                color: landingTheme === 'light' ? '#0f172a' : '#f8fafc'
              }}
            >
              <button onClick={() => setActiveLandingTab(null)} style={{ position: 'absolute', right: '24px', top: '24px', background: landingTheme === 'light' ? '#f1f5f9' : '#334155', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}><X size={18} /></button>

              {activeLandingTab === 'features' && (
                <div>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: landingTheme === 'light' ? '#eef2ff' : 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}><Zap size={28} /></div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Platform Özellikleri</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: landingTheme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontWeight: '700', marginBottom: '4px' }}>AHP Tabanlı Akıllı Sıralama</div>
                      <div style={{ fontSize: '0.9rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Makaleleri sadece anahtar kelimeye göre değil; atıf sayısı, güncellik ve alaka düzeyine göre puanlarız.</div>
                    </div>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: landingTheme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontWeight: '700', marginBottom: '4px' }}>AI Literatür Sentezi</div>
                      <div style={{ fontSize: '0.9rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Seçtiğiniz makalelerin özetlerini okuyup atıflı bir akademik taslak üretiriz; iç atıflar ve kaynakça yalnızca sizin seçtiğiniz makalelerle sınırlıdır.</div>
                    </div>
                    <div style={{ padding: '1rem', borderRadius: '16px', background: landingTheme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)', border: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontWeight: '700', marginBottom: '4px' }}>Çapraz Kaynak Taraması</div>
                      <div style={{ fontSize: '0.9rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Scopus, OpenAlex ve Crossref dahil 7 farklı dev veri tabanını aynı anda tararız.</div>
                    </div>
                  </div>
                </div>
              )}

              {activeLandingTab === 'how-it-works' && (
                <div>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: landingTheme === 'light' ? '#f0fdf4' : 'rgba(22, 163, 74, 0.1)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}><Cpu size={28} /></div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Sistem Nasıl Çalışır?</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: '800' }}>1</div>
                      <div>
                        <div style={{ fontWeight: '700' }}>Akıllı Sorgu Analizi</div>
                        <div style={{ fontSize: '0.85rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Girdiğiniz konu yapay zeka tarafından analiz edilir ve en geniş sonuç için akademik terimlere dönüştürülür.</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: '800' }}>2</div>
                      <div>
                        <div style={{ fontWeight: '700' }}>Veri Madenciliği ve Filtreleme</div>
                        <div style={{ fontSize: '0.85rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Milyonlarca kayıt taranır, DOI doğrulamaları yapılır ve mükerrer sonuçlar temizlenir.</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: '800' }}>3</div>
                      <div>
                        <div style={{ fontWeight: '700' }}>AHP Puanlama ve Sunum</div>
                        <div style={{ fontSize: '0.85rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Matematiksel ağırlıklandırma ile en değerli yayınlar en üste çıkarılarak önünüze getirilir.</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeLandingTab === 'resources' && (
                <div>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: landingTheme === 'light' ? '#fff7ed' : 'rgba(234, 88, 12, 0.1)', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}><FileSearch size={28} /></div>
                  <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '1rem', letterSpacing: '-0.02em' }}>Veri Kaynaklarımız</h2>
                  <p style={{ color: landingTheme === 'light' ? '#64748b' : '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>Literatur AI, dünyanın en saygın ve geniş kapsamlı akademik veri sağlayıcılarıyla tam entegre çalışır:</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {['Scopus (Elsevier)', 'OpenAlex (Full Open)', 'CORE UK', 'Crossref (DOI)', 'Semantic Scholar', 'ArXiv (Pre-print)', 'DOAJ (Open Access)'].map(src => (
                      <div key={src} style={{ padding: '12px', border: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '600', color: landingTheme === 'light' ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ea580c' }}></div>
                        {src}
                      </div>
                    ))}
                  </div>
                  <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>* Toplamda 810 milyondan fazla metaveri ve tam metin kaydına erişim sağlanmaktadır.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <nav className="landing-nav" style={{ background: landingTheme === 'light' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.8)', borderBottom: landingTheme === 'light' ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'linear-gradient(135deg, #4f46e5, #a855f7)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={22} color="white" fill="white" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>Literatur AI</span>
        </div>

        <div className="nav-links nav-links-center">
          <button onClick={() => setActiveLandingTab('features')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', letterSpacing: '0.01em', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Özellikler</button>
          <button onClick={() => setActiveLandingTab('how-it-works')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', letterSpacing: '0.01em', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Nasıl Çalışır?</button>
          <button onClick={() => setActiveLandingTab('resources')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', letterSpacing: '0.01em', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Kaynaklar</button>
        </div>

        <div className="nav-links auth-btns nav-links-auth">
          <button
            onClick={() => setLandingTheme(landingTheme === 'light' ? 'dark' : 'light')}
            style={{ background: 'transparent', border: 'none', padding: '10px', cursor: 'pointer', color: landingTheme === 'light' ? '#64748b' : '#94a3b8', transition: 'transform 0.3s ease' }}
          >
            {landingTheme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <AppSignInButton mode="modal">
            <button style={{ background: 'transparent', border: 'none', fontWeight: '700', color: landingTheme === 'light' ? '#1e293b' : '#f8fafc', cursor: 'pointer', fontSize: '0.9rem' }}>Giriş Yap</button>
          </AppSignInButton>
          <AppSignInButton mode="modal">
            <button style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)' }}>Ücretsiz Başlayın</button>
          </AppSignInButton>
        </div>
      </nav>

      {/* Hero Section */}
      <div style={{
        padding: '160px 2rem 100px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-badge"
          style={{ background: landingTheme === 'light' ? '#f5f3ff' : 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}
        >
          <Sparkles size={14} />
          <span>AI destekli akademik arama &amp; AHP sıralama</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ fontSize: 'min(4rem, 10vw)', fontWeight: '900', maxWidth: '900px', lineHeight: '1.1', marginBottom: '1.5rem', letterSpacing: '-0.04em', color: landingTheme === 'light' ? '#0f172a' : '#ffffff' }}
        >
          En iyi akademik makaleleri <span style={{ color: '#6366f1' }}>saniyeler</span> içinde bulun.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ color: landingTheme === 'light' ? '#64748b' : '#94a3b8', fontSize: '1.15rem', maxWidth: '600px', marginBottom: '3rem', lineHeight: '1.6' }}
        >
          810 milyondan fazla akademik yayını tarayın, analiz edin ve en kaliteli kaynaklara ulaşın.
        </motion.p>

        {/* Mock Search Bar */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          style={{
            width: '100%',
            maxWidth: '720px',
            background: landingTheme === 'light' ? 'white' : '#1e293b',
            padding: '8px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            boxShadow: landingTheme === 'light' ? '0 20px 50px -12px rgba(0,0,0,0.1)' : '0 20px 50px -12px rgba(0,0,0,0.5)',
            border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
            marginBottom: '1.5rem'
          }}
        >
          <div style={{ padding: '0 15px', color: '#94a3b8' }}><Search size={22} /></div>
          <input
            readOnly
            placeholder="Araştırmak istediğiniz konuyu yazın..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1.1rem', color: landingTheme === 'light' ? '#1e293b' : '#f8fafc', background: 'transparent' }}
          />
          <div style={{ padding: '6px 12px', background: landingTheme === 'light' ? '#f1f5f9' : '#334155', borderRadius: '8px', color: '#94a3b8', fontSize: '0.8rem', fontWeight: '700', marginRight: '10px' }}>⌘ K</div>
          <AppSignInButton mode="modal">
            <button style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '14px', fontWeight: '700', cursor: 'pointer', fontSize: '1rem' }}>Ara</button>
          </AppSignInButton>
        </motion.div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: '600', alignSelf: 'center' }}>Örnek aramalar:</span>
          {['transportation models', 'sustainable cities', 'AI in healthcare', 'supply chain optimization', 'renewable energy'].map(tag => (
            <button key={tag} style={{ background: landingTheme === 'light' ? 'white' : 'rgba(255,255,255,0.05)', border: landingTheme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', padding: '6px 16px', borderRadius: '99px', color: landingTheme === 'light' ? '#475569' : '#cbd5e1', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>{tag}</button>
          ))}
        </div>

        {/* User Tiers Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1.5rem',
          marginTop: '4rem',
          width: '100%',
          maxWidth: '1200px'
        }}>
          {USER_TIERS.map((tier, idx) => {
            const TierIcon = tier.icon;
            return (
              <motion.div
                key={tier.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (idx * 0.1) }}
                whileHover={{ y: -8, boxShadow: landingTheme === 'light' ? '0 20px 40px -15px rgba(0,0,0,0.1)' : '0 20px 40px -15px rgba(0,0,0,0.4)' }}
                style={{
                  background: landingTheme === 'light' ? 'white' : 'rgba(30, 41, 59, 0.4)',
                  padding: '2rem',
                  borderRadius: '24px',
                  border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  backdropFilter: 'blur(12px)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: landingTheme === 'light' ? '#f5f3ff' : 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <TierIcon size={28} />
                </div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '800',
                  marginBottom: '0.75rem',
                  color: landingTheme === 'light' ? '#0f172a' : '#f8fafc'
                }}>
                  {tier.title}
                </h3>
                <p style={{
                  fontSize: '0.9rem',
                  lineHeight: '1.6',
                  color: landingTheme === 'light' ? '#64748b' : '#94a3b8'
                }}>
                  {tier.text}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* Stats Section */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '4rem',
          marginTop: '5rem',
          padding: '4rem 2rem',
          width: '100%',
          maxWidth: '900px',
          borderTop: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)'
        }}>
          {LANDING_STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 + (idx * 0.2) }}
              style={{ textAlign: 'center', flex: 1 }}
            >
              <div style={{
                fontSize: '3.5rem',
                fontWeight: '900',
                color: landingTheme === 'light' ? '#0f172a' : '#ffffff',
                letterSpacing: '-0.02em',
                lineHeight: '1'
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: '1rem',
                fontWeight: '700',
                color: '#6366f1',
                marginTop: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Features */}
        <div className="feature-grid">
          <div className="feature-item" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255,255,255,0.05)' }}>
            <div className="feature-icon-wrapper" style={{ background: landingTheme === 'light' ? '#f5f3ff' : 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}><Library size={24} /></div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>7 Dev Kaynak</div>
              <div style={{ fontSize: '0.8rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>En Büyük Veri Tabanları</div>
            </div>
          </div>
          <div className="feature-item" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255,255,255,0.05)' }}>
            <div className="feature-icon-wrapper" style={{ background: landingTheme === 'light' ? '#eff6ff' : 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}><Cpu size={24} /></div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>AI Destekli</div>
              <div style={{ fontSize: '0.8rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Akıllı Analiz</div>
            </div>
          </div>
          <div className="feature-item" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255,255,255,0.05)' }}>
            <div className="feature-icon-wrapper" style={{ background: landingTheme === 'light' ? '#f0fdf4' : 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}><Trophy size={24} /></div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>AHP Sıralama</div>
              <div style={{ fontSize: '0.8rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>En Doğru Sonuçlar</div>
            </div>
          </div>
          <div className="feature-item" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.04)' : '1px solid rgba(255,255,255,0.05)' }}>
            <div className="feature-icon-wrapper" style={{ background: landingTheme === 'light' ? '#fffbeb' : 'rgba(217, 119, 6, 0.1)', color: '#d97706' }}><Zap size={24} /></div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.1rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>Hızlı &amp; Etkili</div>
              <div style={{ fontSize: '0.8rem', color: landingTheme === 'light' ? '#64748b' : '#94a3b8' }}>Saniyeler İçinde</div>
            </div>
          </div>
        </div>

        {/* Mock Results Preview */}
        <div className="mock-results-card" style={{ background: landingTheme === 'light' ? 'white' : '#1e293b', border: landingTheme === 'light' ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ padding: '20px 30px', borderBottom: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ color: '#4f46e5' }}><FileSearch size={22} /></div>
              <span style={{ fontWeight: '700', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>Arama Sonuçları</span>
              <span style={{ padding: '4px 12px', background: landingTheme === 'light' ? '#f1f5f9' : '#334155', borderRadius: '8px', fontSize: '0.8rem', color: '#64748b' }}>transportation models in urban areas</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ padding: '8px 16px', background: landingTheme === 'light' ? '#f8fafc' : '#334155', border: landingTheme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', color: landingTheme === 'light' ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>Sırala: AHP Skor <ChevronDown size={14} /></div>
              <div style={{ padding: '8px 16px', background: landingTheme === 'light' ? '#f8fafc' : '#334155', border: landingTheme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', color: landingTheme === 'light' ? '#475569' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}><Download size={14} /> Dışa Aktar</div>
            </div>
          </div>

          <div style={{ display: 'flex' }}>
            {/* Mock Filter Sidebar */}
            <div style={{ width: '220px', padding: '30px', borderRight: landingTheme === 'light' ? '1px solid #f1f5f9' : '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '25px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: '800', marginBottom: '15px', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}><Filter size={14} /> Filtreler</div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Yayın Yılı</div>
                <div style={{ height: '4px', background: 'linear-gradient(to right, #4f46e5 80%, #e2e8f0 80%)', borderRadius: '2px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '0', top: '-6px', width: '16px', height: '16px', background: landingTheme === 'light' ? 'white' : '#1e293b', border: '3px solid #4f46e5', borderRadius: '50%' }}></div>
                  <div style={{ position: 'absolute', right: '15%', top: '-6px', width: '16px', height: '16px', background: landingTheme === 'light' ? 'white' : '#1e293b', border: '3px solid #4f46e5', borderRadius: '50%' }}></div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Kaynak</div>
                {['OpenAlex', 'CORE', 'Crossref', 'Scopus'].map(k => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', fontSize: '0.85rem', fontWeight: '600', color: landingTheme === 'light' ? '#475569' : '#cbd5e1' }}>
                    <div style={{ width: '16px', height: '16px', background: '#4f46e5', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="white" /></div>
                    {k}
                  </div>
                ))}
              </div>
            </div>

            {/* Mock List */}
            <div style={{ flex: 1, padding: '30px' }}>
              {[
                { title: 'A comprehensive review of urban transportation models', authors: 'Z. Liu, Y. He, X. Zhang', source: 'OpenAlex', score: 0.87, cited: 152, color: landingTheme === 'light' ? '#f5f3ff' : 'rgba(124, 58, 237, 0.1)' },
                { title: 'Sustainable urban mobility: modeling and optimization', authors: 'M. Behrisch, L. Bieker', source: 'CORE', score: 0.79, cited: 98, color: landingTheme === 'light' ? '#fffbeb' : 'rgba(217, 119, 6, 0.1)' },
                { title: 'Agent-based models in urban transportation planning', authors: 'J. Barceló, P. Picornell', source: 'Crossref', score: 0.71, cited: 84, color: landingTheme === 'light' ? '#f0fdf4' : 'rgba(22, 163, 74, 0.1)' }
              ].map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', background: i === 0 ? (landingTheme === 'light' ? 'rgba(79,70,229,0.02)' : 'rgba(79,70,229,0.05)') : 'transparent', border: i === 0 ? '1px solid rgba(79,70,229,0.1)' : '1px solid transparent', borderRadius: '16px', marginBottom: '10px' }}>
                  <div style={{ width: '40px', height: '40px', background: m.color, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}><FileText size={20} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '4px', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>{m.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{m.authors}</div>
                  </div>
                  <div style={{ width: '100px', fontSize: '0.8rem', fontWeight: '700', color: '#4f46e5' }}>{m.source}</div>
                  <div style={{ width: '150px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#4f46e5', marginBottom: '4px' }}>{m.score}</div>
                    <div style={{ height: '6px', background: landingTheme === 'light' ? '#e2e8f0' : '#334155', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${m.score * 100}%`, height: '100%', background: '#4f46e5' }}></div>
                    </div>
                  </div>
                  <div style={{ width: '60px', textAlign: 'right', fontWeight: '700', fontSize: '0.9rem', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>{m.cited}</div>
                  <div style={{ color: '#cbd5e1' }}><Bookmark size={18} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Comparison Section - Card Grid Version */}
        <div style={{ width: '100%', maxWidth: '1100px', marginTop: '100px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '800', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc', marginBottom: '1rem' }}>
            Neden Literatur AI?
          </h2>
          <p style={{ fontSize: '1.1rem', color: '#64748b', marginBottom: '3rem' }}>
            Bilimsel bütünlük ve akademik etik çerçevesinde teknolojik farkımız.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2rem', padding: '0 1rem' }}>
            {[
              { k: 'Referans Güvenilirliği', l: 'Doğrulanmış Bilimsel Yayınlar', s: 'Halüsinasyon (Uydurma Veri) Riski', icon: <ShieldCheck size={24} /> },
              { k: 'Bibliyografik Hassasiyet', l: 'Akademik Format Uyumluluğu', s: 'Standart Dışı veya Hatalı Atıf', icon: <FileText size={24} /> },
              { k: 'Kapsanan Literatür', l: 'Milyonlarca İndeksli Yayın', s: 'Genel İnternet ve Web İçeriği', icon: <Library size={24} /> },
              { k: 'Veri Güncelliği', l: 'Gerçek Zamanlı Literatür Erişimi', s: 'Kısıtlı Eğitim Seti', icon: <Zap size={24} /> }
            ].map((row, idx) => (
              <MotionDiv
                key={idx}
                whileHover={{ y: -5 }}
                className="glass-panel"
                style={{
                  padding: '2rem',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem',
                  background: landingTheme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid ' + (landingTheme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)')
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ color: '#4f46e5' }}>{row.icon}</div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>{row.k}</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{
                    padding: '1rem 1.25rem',
                    background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                    borderRadius: '12px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.2)'
                  }}>
                    <Check size={20} strokeWidth={3} />
                    <div style={{ fontSize: '0.95rem', fontWeight: '700' }}>{row.l}</div>
                  </div>

                  <div style={{
                    padding: '1rem 1.25rem',
                    background: landingTheme === 'light' ? '#f8fafc' : 'rgba(255,255,255,0.03)',
                    borderRadius: '12px',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    border: '1px dashed ' + (landingTheme === 'light' ? '#e2e8f0' : 'rgba(255,255,255,0.1)')
                  }}>
                    <X size={20} color="#f43f5e" style={{ opacity: 0.6 }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: '500', fontStyle: 'italic' }}>{row.s}</div>
                  </div>
                </div>
              </MotionDiv>
            ))}
          </div>
        </div>

        {/* Brand logos & Social Proof */}
        <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '80px', paddingBottom: '60px' }}>
          <div style={{ display: 'flex', gap: '3rem', opacity: landingTheme === 'light' ? 0.5 : 0.8 }}>
            {['OpenAlex', 'CORE', 'Crossref', 'Scopus'].map(b => (
              <div key={b} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '1rem', color: landingTheme === 'light' ? '#1e293b' : '#cbd5e1' }}>
                <div style={{ width: '20px', height: '20px', background: landingTheme === 'light' ? '#cbd5e1' : '#334155', borderRadius: '4px' }}></div>
                {b}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', background: landingTheme === 'light' ? 'white' : '#1e293b', padding: '12px 24px', borderRadius: '99px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: landingTheme === 'light' ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', marginLeft: '10px' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ width: '32px', height: '32px', borderRadius: '50%', background: landingTheme === 'light' ? '#e2e8f0' : '#334155', border: '2px solid ' + (landingTheme === 'light' ? 'white' : '#1e293b'), marginLeft: '-10px' }}></div>
              ))}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: '800', color: landingTheme === 'light' ? '#0f172a' : '#f8fafc' }}>60.000+ araştırmacı</div>
              <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Literatur AI kullanıyor</div>
            </div>
            <div style={{ color: '#4f46e5', marginLeft: '10px' }}><Zap size={18} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
