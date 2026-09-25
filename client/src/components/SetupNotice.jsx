/**
 * Clerk anahtarı yokken gösterilen kurulum ekranı.
 *
 * main.jsx eskiden burada throw ediyordu. React kök render'ı patladığı için
 * kullanıcı bembeyaz bir sayfa görüyor, sebebi yalnızca tarayıcı konsolunda
 * yazıyordu. Uygulamayı ilk kez çalıştıran biri için bu, hatanın kendisinden
 * daha fazla zaman kaybettiriyor.
 */
export default function SetupNotice() {
  const box = {
    maxWidth: '620px',
    margin: '10vh auto',
    padding: '0 20px',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    color: '#1f2937',
    lineHeight: 1.6,
  };

  return (
    <div style={box}>
      <div style={{ fontSize: '12px', letterSpacing: '.12em', textTransform: 'uppercase', color: '#6b7280' }}>
        Kurulum tamamlanmadı
      </div>
      <h1 style={{ fontSize: '28px', margin: '10px 0 14px' }}>
        Clerk anahtarı eksik
      </h1>
      <p style={{ margin: '0 0 18px' }}>
        Arayüz, kimlik doğrulama için <code>VITE_CLERK_PUBLISHABLE_KEY</code> değişkenine
        ihtiyaç duyuyor. Bu değer bulunamadı, bu yüzden uygulama başlatılmadı.
      </p>
      <ol style={{ paddingLeft: '20px', margin: '0 0 18px' }}>
        <li style={{ marginBottom: '8px' }}>
          <a href="https://dashboard.clerk.com/" target="_blank" rel="noopener noreferrer">
            dashboard.clerk.com
          </a>{' '}
          adresinden uygulamanı aç ve sol menüdeki <strong>API keys</strong> sayfasına git.
        </li>
        <li style={{ marginBottom: '8px' }}>
          <code>pk_test_</code> ile başlayan publishable key değerini kopyala.
        </li>
        <li style={{ marginBottom: '8px' }}>
          Proje içinde <code>client/.env</code> dosyasını oluştur ve içine şunu yaz:
        </li>
      </ol>
      <pre style={{
        background: '#111827', color: '#e5e7eb', padding: '14px 16px',
        borderRadius: '6px', overflowX: 'auto', fontSize: '13px', margin: '0 0 18px',
      }}>
        VITE_CLERK_PUBLISHABLE_KEY=pk_test_...{'\n'}
        VITE_API_URL=http://localhost:3000
      </pre>
      <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
        Dosyayı kaydettikten sonra Vite sunucusunu durdurup yeniden başlat
        (<code>Ctrl + C</code>, sonra <code>npm run dev</code>). Ortam değişkenleri
        yalnızca başlangıçta okunur.
      </p>
    </div>
  );
}
