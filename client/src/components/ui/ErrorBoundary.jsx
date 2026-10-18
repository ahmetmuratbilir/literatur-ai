import { Component } from 'react';
import CrashFallback from './CrashFallback.jsx';

/**
 * Hata sınırı (WO-024). Eskiden tek bir bileşenin çökmesi (ör. yanıt şekli
 * beklenmedik gelen Yapay zekâ bağlantıları) bütün uygulamayı beyaz sayfaya
 * çeviriyordu. Artık yalnız o bölüm düşer; kullanıcı yeniden deneyebilir,
 * sayfayı yenileyebilir ya da sorunu bildirebilir. Çıkışsız ekran yok.
 *
 *   <ErrorBoundary area="panel">…</ErrorBoundary>   // bir bölüm
 *   <ErrorBoundary area="page">…</ErrorBoundary>    // en dış katman
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = () => this.setState({ error: null });
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.area || 'panel', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <CrashFallback area={this.props.area || 'panel'} onRetry={this.reset} />;
  }
}
