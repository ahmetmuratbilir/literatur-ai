import { SignedIn, SignedOut, SignInButton, UserButton, useAuth, useUser } from '@clerk/clerk-react';
import { DevUserButton, DevSignInButton } from './devAuthComponents.jsx';

/**
 * Clerk ile uygulama arasındaki köprü.
 *
 * Clerk anahtarı yokken uygulama hiç açılmıyordu. Geliştirme sırasında bu,
 * arayüzün tamamını görünmez yapıyor. Burada anahtar yoksa Clerk'siz bir yol
 * sunuyoruz: uygulama normal şekilde render edilir, kimlik yerel bir geliştirme
 * kimliğiyle taklit edilir.
 *
 * GÜVENLİK: Bu yol sunucuda üretimde kesin olarak reddedilir. Sunucu
 * `Bearer test-token` başlığını yalnızca NODE_ENV üretim DEĞİLKEN ve
 * ALLOW_E2E_TEST_AUTH=true iken kabul eder. Üretim derlemesinde anahtar
 * zaten tanımlı olduğu için bu dal hiç çalışmaz.
 */
export const CLERK_ENABLED = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

/**
 * Sunucunun geliştirme modunda tanıdığı jeton.
 * `getAuth()` bunu görünce kullanıcıyı `test-user-id` olarak çözer.
 *
 * Bu değeri döndürmek, koddaki 17 ayrı `Authorization: Bearer ${token}`
 * çağrısını değiştirmeden çalışmalarını sağlıyor.
 */
const DEV_TOKEN = 'test-token';

const devAuth = {
  isLoaded: true,
  isSignedIn: true,
  userId: 'test-user-id',
  getToken: async () => DEV_TOKEN,
};

/**
 * CLERK_ENABLED derleme anında sabitlenir ve çalışma sırasında değişmez, bu
 * yüzden hangi hook'un kullanılacağını modül yüklenirken seçmek güvenli:
 * bileşen her render'da aynı hook'u çağırmış olur.
 */
export const useAppAuth = CLERK_ENABLED ? useAuth : () => devAuth;

const PassThrough = ({ children }) => children;
const RenderNothing = () => null;

/** Giriş yapmış kullanıcıya gösterilen bölüm. Clerk kapalıyken hep gösterilir. */
export const AuthedOnly = CLERK_ENABLED ? SignedIn : PassThrough;

/** Giriş yapmamış kullanıcıya gösterilen bölüm. Clerk kapalıyken hiç gösterilmez. */
export const AnonOnly = CLERK_ENABLED ? SignedOut : RenderNothing;

const devUser = {
  isLoaded: true,
  isSignedIn: true,
  user: { id: 'test-user-id', fullName: 'Geliştirme Kullanıcısı' },
};

/** Clerk'in useUser'i. Kapaliyken sabit bir gelistirme kullanicisi doner. */
export const useAppUser = CLERK_ENABLED ? useUser : () => devUser;

/** Profil/oturum dugmesi. */
export const AppUserButton = CLERK_ENABLED ? UserButton : DevUserButton;

/** Giris dugmesi. Clerk kapaliyken yalnizca icerigini gosterir. */
export const AppSignInButton = CLERK_ENABLED ? SignInButton : DevSignInButton;
