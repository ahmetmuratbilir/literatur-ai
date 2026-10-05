import { motion } from 'framer-motion';
import { Database, Globe, Unlock, Zap, FileText, HeartPulse, Network, Award } from 'lucide-react';

const MotionDiv = motion.div;

const InfiniteTicker = () => {
  const content = (
    <div className="ticker-content">
      <span className="ticker-item">
        <Zap size={15} className="ticker-icon highlight" />
        <span className="ticker-text highlight-text">LiteraturAI</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Database size={15} className="ticker-icon" />
        <span className="ticker-text">Scopus</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Globe size={15} className="ticker-icon" />
        <span className="ticker-text">OpenAlex</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <HeartPulse size={15} className="ticker-icon" />
        <span className="ticker-text">PubMed (NCBI)</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <FileText size={15} className="ticker-icon" />
        <span className="ticker-text">Europe PMC</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Unlock size={15} className="ticker-icon" />
        <span className="ticker-text">Unpaywall</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Database size={15} className="ticker-icon" />
        <span className="ticker-text">Crossref</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Unlock size={15} className="ticker-icon" />
        <span className="ticker-text">CORE</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Zap size={15} className="ticker-icon" />
        <span className="ticker-text">Semantic Scholar</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Globe size={15} className="ticker-icon" />
        <span className="ticker-text">ArXiv</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Unlock size={15} className="ticker-icon" />
        <span className="ticker-text">DOAJ</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Network size={15} className="ticker-icon" />
        <span className="ticker-text">OpenCitations</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <Award size={15} className="ticker-icon" />
        <span className="ticker-text">DergiPark & TR Dizin</span>
      </span>
      <span className="ticker-dot">•</span>

      <span className="ticker-item">
        <span className="ticker-text bold" style={{ color: '#818cf8' }}>Federated Akademik Tarama & AHP Motoru</span>
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
            duration: 32, // Rahat okunabilir akış hızı
          }}
        >
          {content}
          {content}
        </MotionDiv>
      </div>
    </div>
  );
};

export default InfiniteTicker;
