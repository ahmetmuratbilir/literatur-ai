import { motion } from 'framer-motion';
import { Database, Globe, Unlock, Zap } from 'lucide-react';

const MotionDiv = motion.div;

const InfiniteTicker = () => {
  const content = (
    <div className="ticker-content">
      <span className="ticker-item">
        <Zap size={16} className="ticker-icon highlight" />
        <span className="ticker-text highlight-text">LiteratureAI</span>
      </span>
      <span className="ticker-dot">•</span>
      
      <span className="ticker-item">
        <Database size={16} className="ticker-icon" />
        <span className="ticker-text">Scopus (90M+ Kayıt)</span>
      </span>
      <span className="ticker-dot">•</span>
      
      <span className="ticker-item">
        <Globe size={16} className="ticker-icon" />
        <span className="ticker-text">OpenAlex (250M+ Kayıt)</span>
      </span>
      <span className="ticker-dot">•</span>
      
      <span className="ticker-item">
        <Unlock size={16} className="ticker-icon" />
        <span className="ticker-text">CORE (200M+ Açık Erişim)</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Database size={16} className="ticker-icon" />
        <span className="ticker-text">Crossref (150M+ Metadata)</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Zap size={16} className="ticker-icon" />
        <span className="ticker-text">S. Scholar (215M+ AI Destekli)</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Globe size={16} className="ticker-icon" />
        <span className="ticker-text">ArXiv (2.4M+ Ön Baskı)</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Unlock size={16} className="ticker-icon" />
        <span className="ticker-text">DOAJ (10M+ Hakemli)</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <span className="ticker-text bold" style={{ color: '#fbbf24' }}>LiteratureAI: 7 Dev Kaynak, 810 Milyondan Fazla Makale</span>
      </span>
      <span className="ticker-dot">•</span>
    </div>
  );

  return (
    <div className="ticker-wrapper">
      <div className="ticker-container">
        <MotionDiv
          className="ticker-track"
          animate={{ x: ["0%", "-50%"] }}
          transition={{
            repeat: Infinity,
            ease: "linear",
            duration: 25, // Animasyon hızı (saniye)
          }}
        >
          {/* İçeriği iki kere kopyalıyoruz ki sonsuz döngü kesintisiz aksın */}
          {content}
          {content}
        </MotionDiv>
      </div>
    </div>
  );
};

export default InfiniteTicker;
