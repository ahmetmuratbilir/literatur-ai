/**
 * Clerk kapalıyken onun görsel bileşenlerinin yerine geçen basit karşılıklar.
 * Ayrı bir .jsx dosyasında duruyorlar çünkü clerkBridge.js JSX içermiyor.
 */

/** Clerk'in <UserButton> bileşeninin geliştirme karşılığı. */
export function DevUserButton() {
  return (
    <div
      title="Geliştirme kullanıcısı — gerçek oturum yok"
      style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
        border: '2px solid rgba(99, 102, 241, 0.3)',
        display: 'grid',
        placeItems: 'center',
        color: 'white',
        fontSize: '0.8rem',
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      G
    </div>
  );
}

/** Clerk'in <SignInButton> bileşeninin geliştirme karşılığı: sadece içeriği gösterir. */
export function DevSignInButton({ children }) {
  return children ?? null;
}
