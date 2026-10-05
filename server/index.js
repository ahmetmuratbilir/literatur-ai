import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
// Çeviri: Groq (translation.js) üzerinden yapılıyor — Gemini kaldırıldı
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import mongoose from 'mongoose';
import { searchAll } from './services/search.js';
import { analyzeAndExpandQuery, generateConsensusSnapshot } from './services/llm.js';
import { translateToEnglish } from './utils/translation.js';
import SearchHistory from './models/SearchHistory.js';
import Collection from './models/Collection.js';
import SharedSearch from './models/SharedSearch.js';
import crypto from 'crypto';
import Analysis from './models/Analysis.js';
import Basket, { BASKET_LIMIT } from './models/Basket.js';
import { planBasketAdd, collectLegacyPapers } from './services/basketService.js';
import { getWriterFlags } from './config/writerFlags.js';
import { validateEnvironment, formatEnvReport } from './config/envValidation.js';
import { probeAllServices } from './services/keyHealthService.js';
import { getZeroStreaks } from './services/sourceZeroTracker.js';
import { resolveRankingWeights, parseWeightsParam, listProfiles } from './services/ahpProfiles.js';
import { rankWithFirstPageRetractions } from './services/rankingPipeline.js';
import { createResolver } from './services/resolver/pipeline.js';
import { getSecondary, isSecondaryReady, secondaryStatus } from './services/db/secondary.js';
import { startBackupScheduler, runBackup, lastBackup } from './services/db/backup.js';
import { checkRetractions, normalizeDoi as normalizeRetractionDoi } from './services/retraction.js';
import { getWeightingMethodology } from './services/ahp.js';
import { ratingsToWeights, evaluateComparisons } from './services/ahpPairwise.js';
import { findOpenAccessCopy, isUnpaywallConfigured } from './services/unpaywall.js';
import { getLang, msg } from './services/serverI18n.js';
import { runRevisionCoach } from './services/revisionCoachService.js';
import { createRequestId, runWriterPipeline } from './services/writerPipeline.js';
import { logger } from './utils/logger.js';
import { clerkMiddleware, getAuth as clerkGetAuth, clerkClient } from '@clerk/express';
import { sendWelcomeDemoEmail, sendWelcomeOnboardingEmail } from './services/emailService.js';
import UserProfile from './models/UserProfile.js';
import {
  buildSearchCacheFingerprint,
  getSearchCacheConfig,
  getSharedSearchCache,
  saveSharedSearchCache,
  updateSearchCacheTranslations
} from './utils/searchCacheStore.js';

// Üretimde test kimliği asla kabul edilmez: aksi halde ALLOW_E2E_TEST_AUTH'u
// açık unutmak, tek bir x-test-user-id başlığıyla tam kimlik atlatması demek.
// process.env her çağrıda okunuyor; güvenlik kontrolü modül yükleme sırasına
// veya sabitlerin tanımlanma anına bağlı olmamalı.
const isTestAuthAllowed = () => {
  const env = process.env.NODE_ENV;
  if (env === 'production') return false;
  return env === 'test' || process.env.ALLOW_E2E_TEST_AUTH === 'true';
};

const getAuth = (req) => {
  const authHeader = req.headers['authorization'];
  const allowE2ETestAuth = isTestAuthAllowed();
  const isTestAuthRequest = allowE2ETestAuth && (
    req.headers['x-test-user-id'] ||
    (authHeader && authHeader === 'Bearer test-token') ||
    req.query?.test_state === 'signed-in'
  );
  if (isTestAuthRequest) {
    return { userId: req.headers['x-test-user-id'] || 'test-user-id' };
  }
  try {
    return clerkGetAuth(req);
  } catch (err) {
    return {};
  }
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const IS_TEST_MODE = process.env.NODE_ENV === 'test';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const CLERK_CONFIGURED = typeof process.env.CLERK_SECRET_KEY === 'string'
  && process.env.CLERK_SECRET_KEY.trim().length > 0;

// Abonelik zorunlulugu acikca acilmadikca uygulanmaz. Varsayilan olarak acik
// olmasi, ucret alinmayan bir kurulumda tum kullanicilari disarida birakiyordu.
const BILLING_REQUIRED = process.env.BILLING_REQUIRED === 'true';

// Yer tutucu degerler varlik kontrolunu gecip sistemin calisir gorunmesine yol
// aciyordu; hata ancak canli API 401 dondugunde ve kaynak bazinda sessizce
// yutuldugunda ortaya cikiyordu. Bunu baslangicta ve yuksek sesle yakaliyoruz.
const ENV_VALIDATION = validateEnvironment();

if (!IS_TEST_MODE) {
  const summary = formatEnvReport(ENV_VALIDATION);
  if (ENV_VALIDATION.errors.length > 0) {
    console.error(summary);
    if (IS_PRODUCTION) {
      console.error('[ENV] Uretim ortaminda eksik zorunlu yapilandirmayla baslatilmaz.');
      process.exit(1);
    }
  } else if (ENV_VALIDATION.warnings.length > 0) {
    console.warn(summary);
  }
}

const splitEnvList = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const unique = (items) => [...new Set(items.filter(Boolean))];

/**
 * Admin kullanicilari, virgulle ayrilmis Clerk kullanici kimlikleri olarak
 * ADMIN_USER_IDS icinde tanimlanir (ornek: user_2abc...,user_2def...).
 *
 * Bu proje halka acilacagi icin sistem durumu — hangi API anahtarinin
 * yapilandirildigi, veritabani baglantisi, kalan kota — siradan kullaniciya
 * gosterilemez. Bu bilgi bir saldirgana hangi servisin kapali oldugunu ve
 * nereye yuklenmesi gerektigini soyler.
 */
const getAdminUserIds = () => new Set(splitEnvList(process.env.ADMIN_USER_IDS));

const isAdminUser = (userId) => {
  if (!userId) return false;
  const admins = getAdminUserIds();
  // Hic admin tanimlanmamissa kimse admin degildir. "Bos liste = herkes admin"
  // yorumu, unutulmus bir yapilandirmayi tam yetkiye cevirirdi.
  if (admins.size === 0) return false;
  return admins.has(userId);
};

const getConfiguredCorsOrigins = () => unique([
  ...splitEnvList(process.env.CLIENT_URL),
  ...splitEnvList(process.env.CORS_ORIGIN),
  ...splitEnvList(process.env.CORS_ORIGINS),
]);

const isLocalDevOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin || '');

const getEffectiveCorsOrigins = () => {
  const configured = getConfiguredCorsOrigins();
  if (IS_PRODUCTION) return configured;
  return unique([
    ...configured,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);
};

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (!IS_PRODUCTION && isLocalDevOrigin(origin)) return true;
  return getConfiguredCorsOrigins().includes(origin);
};

const getCorsStatus = () => {
  const configured = getConfiguredCorsOrigins();
  if (IS_PRODUCTION && configured.length === 0) return 'config_required';
  return configured.length > 0 ? 'restricted' : 'development_open';
};

const corsOrigin = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, origin || true);
    return;
  }
  callback(null, false);
};

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;
const MONGO_RETRY_MS = 30 * 1000;
let mongoRetryTimer = null;

const scheduleMongoReconnect = () => {
  if (!MONGODB_URI || mongoRetryTimer) return;
  mongoRetryTimer = setTimeout(() => {
    mongoRetryTimer = null;
    connectMongo();
  }, MONGO_RETRY_MS);
  mongoRetryTimer.unref?.();
};

async function connectMongo() {
  if (!MONGODB_URI || mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    scheduleMongoReconnect();
  }
}

if (MONGODB_URI && !IS_TEST_MODE) {
  connectMongo();
  mongoose.connection.on('disconnected', scheduleMongoReconnect);
} else if (!MONGODB_URI && !IS_TEST_MODE) {
  console.warn('MONGODB_URI is not defined in .env. Search history will not be saved.');
}

// Ikinci MongoDB (MONGODB_URI_2): gece yedegi + DergiPark dizini.
// Tanimli degilse hicbir sey yapilmaz.
const getPrimaryDb = () => (mongoose.connection.readyState === 1 ? mongoose.connection.db : null);
const getSecondaryDb = () => {
  const conn = getSecondary();
  return conn && isSecondaryReady() ? conn.db : null;
};
if (!IS_TEST_MODE && getSecondary()) {
  startBackupScheduler({ getPrimaryDb, getSecondaryDb });
}

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_SEARCH_COUNT = 100;
const MAX_PAPERS_PER_COLLECTION = 50;
// Kütüphane: favori + geçmiş toplamı. Dolunca en eski geçmiş silinir, favori silinmez.
const USER_TOTAL_RESEARCH_LIMIT = 20;
const FAVORITES_COLLECTION_NAME = 'Favoriler';

// --- Security & Middleware ---
app.use(cors({
  // Production should be restricted via CLIENT_URL/CORS_ORIGINS.
  // Development keeps localhost flexible so Vite port changes do not break local work.
  origin: corsOrigin,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Clerk, anahtarlari eksikse clerkMiddleware() icinden exception firlatir ve
// global middleware oldugu icin TUM endpointler 500 doner (401 degil).
// Anahtar yoksa middleware'i hic takmiyoruz: getAuth() zaten bos donup
// korumali uclarin temiz bir 401 uretmesini sagliyor.
if (CLERK_CONFIGURED) {
  app.use(clerkMiddleware());
} else if (IS_PRODUCTION) {
  console.error(
    '[FATAL] CLERK_SECRET_KEY tanimli degil. Kimlik dogrulama ve abonelik kontrolu calismaz.'
  );
  process.exit(1);
} else {
  console.warn(
    '[AUTH] CLERK_SECRET_KEY yok - kimlik dogrulama devre disi. Korumali uclar 401 donecek.'
  );
}
app.use((req, res, next) => {
  // Clerk dev middleware may not always keep ACAO during local proxy hops.
  // We re-assert per-request origin so the browser can consume API responses.
  const requestOrigin = req.headers.origin;
  if (typeof requestOrigin === 'string' && requestOrigin.length > 0 && isOriginAllowed(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    const varyHeader = res.getHeader('Vary');
    if (typeof varyHeader === 'string') {
      const hasOriginVary = varyHeader
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .includes('origin');
      if (!hasOriginVary) {
        res.setHeader('Vary', `${varyHeader}, Origin`);
      }
    } else {
      res.setHeader('Vary', 'Origin');
    }
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    return res.sendStatus(204);
  }

  return next();
});

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  keyGenerator: (req) => getAuth(req)?.userId || ipKeyGenerator(req.ip),
  message: { error: 'Çok fazla istek gönderildi. Lütfen 1 dakika bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const getRequestUserId = (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'Lutfen giris yapin' });
    return null;
  }
  return userId;
};

const isValidUserId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 64;

const getWriterUserId = (req) => {
  try {
    const authUserId = getAuth(req)?.userId;
    if (isValidUserId(authUserId)) return authUserId;
  } catch {}
  if (isTestAuthAllowed()) {
    const testUserId = req.headers['x-test-user-id'];
    if (isValidUserId(testUserId)) return testUserId;
  }
  return null;
};

/**
 * Yalnizca ADMIN_USER_IDS icinde listelenen kullanicilar gecer.
 *
 * Abonelik kontrolu yapmaz: admin islemleri faturalamadan bagimsizdir.
 */
// Canli servis yoklamasi 12 dis istek atar ve saglayici kotasindan yer.
const ADMIN_PROBE_RATE_LIMITER = IS_TEST_MODE
  ? (req, res, next) => next()
  : rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 4,
    keyGenerator: (req) => getWriterUserId(req) || ipKeyGenerator(req.ip),
    message: { error: 'Cok sik kontrol edildi. Lutfen birkac dakika bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

const requireAdmin = (req, res, next) => {
  const userId = getWriterUserId(req);
  if (!userId) return res.status(401).json({ error: 'Lütfen giriş yapın' });

  if (!isAdminUser(userId)) {
    // 404 degil 403: kaynagin varligi zaten dokumante, gizlemenin faydasi yok.
    return res.status(403).json({ error: 'Bu alana erişim yetkiniz yok.' });
  }

  return next();
};



// Genel sağlık kontrolü — sadece servis ayakta mı bilgisi, detay yok
app.get('/api/health', (req, res) => {
  return res.json({
    ok: true,
    status: 'operational',
    timestamp: new Date().toISOString(),
  });
});

// Oturum sahibinin kim oldugu ve admin olup olmadigi.
// Arayuz admin sekmesini yalnizca bu yanit isAdmin:true dondugunde gosterir.
app.get('/api/me', (req, res) => {
  const userId = getWriterUserId(req);
  if (!userId) return res.status(401).json({ error: 'Lütfen giriş yapın' });

  return res.json({ userId, isAdmin: isAdminUser(userId) });
});

// Detaylı sağlık kontrolü — yalnızca kimlik doğrulaması yapılmış kullanıcılara
app.get('/api/health/details', requireAdmin, (req, res) => {
  const has = (v) => typeof v === 'string' && v.trim().length > 0;
  const geminiConfigured = has(process.env.GEMINI_API_KEY);
  const groqConfigured = has(process.env.GROQ_API_KEY);
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const scopusConfigured = has(process.env.ELSEVIER_API_KEY || process.env.SCOPUS_API_KEY);
  const scopusInsttokenConfigured = has(process.env.ELSEVIER_INSTTOKEN || process.env.SCOPUS_INSTTOKEN);
  const openAlexMailConfigured = has(process.env.OPENALEX_MAIL || process.env.CONTACT_EMAIL);
  const coreConfigured = has(process.env.CORE_API_KEY);
  const writerAiStatus = geminiConfigured
    ? (groqConfigured ? 'Gemini configured; Groq fallback active on Gemini errors' : 'Gemini configured; no Groq fallback configured')
    : (groqConfigured ? 'Gemini unavailable, Groq fallback active' : 'No writer AI provider configured');

  return res.json({
    ok: true,
    port: Number(PORT),
    environment: process.env.NODE_ENV || 'development',
    cors: {
      status: getCorsStatus(),
      allowedOrigins: getEffectiveCorsOrigins(),
      productionRequiresClientOrigin: IS_PRODUCTION,
    },
    services: {
      scopus: scopusConfigured,
      scopusInsttoken: scopusInsttokenConfigured,
      openalex: openAlexMailConfigured,
      core: coreConfigured,
      gemini: geminiConfigured,
      groq: groqConfigured,
    },
    ai: {
      writer: {
        status: writerAiStatus,
        gemini: { configured: geminiConfigured, model: geminiModel },
        groq: { configured: groqConfigured, role: geminiConfigured ? 'fallback' : 'primary' },
        fallbackActive: groqConfigured,
      },
    },
    scopus: {
      configured: scopusConfigured,
      insttokenConfigured: scopusInsttokenConfigured,
      credentialAccessIssueClass: 'CREDENTIAL_ACCESS',
      status: scopusConfigured
        ? 'configured; credential/access errors are classified separately during smoke tests'
        : 'missing/config required; ELSEVIER_API_KEY or SCOPUS_API_KEY missing',
    },
    academicSources: {
      scopus: { configured: scopusConfigured, insttokenConfigured: scopusInsttokenConfigured, status: scopusConfigured ? 'configured' : 'missing/config required', credentialAccessIssueClass: 'CREDENTIAL_ACCESS' },
      openalex: { configured: openAlexMailConfigured, status: openAlexMailConfigured ? 'configured' : 'missing/config required; OPENALEX_MAIL recommended' },
      core: { configured: coreConfigured, status: coreConfigured ? 'configured' : 'missing/config required' },
      crossref: { configured: true, status: 'public/no key required' },
      semanticScholar: { configured: has(process.env.SEMANTIC_SCHOLAR_API_KEY), status: has(process.env.SEMANTIC_SCHOLAR_API_KEY) ? 'configured' : 'missing/config optional' },
      arxiv: { configured: true, status: 'public/no key required; timeout issues are operational' },
      doaj: { configured: true, status: 'public/no key required; timeout issues are operational' },
    },
    billing: {
      enforced: BILLING_REQUIRED,
      failOpen: process.env.BILLING_FAIL_OPEN === 'true',
      status: BILLING_REQUIRED
        ? 'abonelik zorunlu'
        : 'abonelik kontrolu kapali (BILLING_REQUIRED=true ile acilir)',
    },
    auth: {
      provider: 'clerk',
      configured: CLERK_CONFIGURED,
      middlewareMounted: CLERK_CONFIGURED,
      status: CLERK_CONFIGURED
        ? 'configured'
        : 'missing/config required; CLERK_SECRET_KEY yok - tum korumali uclar 401 doner',
    },
    environment_validation: {
      // configured | placeholder | malformed | missing
      // Onceki 'configured' bayraklari yalnizca varlik kontroluydu ve sablon
      // metnini gecerli deger sayiyordu.
      ...Object.fromEntries(
        Object.entries(ENV_VALIDATION.report).map(([name, info]) => [
          name,
          { state: info.state, required: info.required, detail: info.detail },
        ])
      ),
    },
    database: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
    },
    searchCache: {
      enabled: mongoose.connection.readyState === 1,
      ...getSearchCacheConfig(),
    },
    demoFallback: true,
  });
});

/**
 * Her saglayiciya canli istek atip anahtarlarin gercekten calisip
 * calismadigini raporlar. npm run verify-keys ile ayni mantigi kullanir.
 *
 * Yavas (12 dis istek) ve kota tuketir, bu yuzden ayri ve sikI bir rate limit
 * altinda. Anahtar degerleri yanitta yer almaz.
 */
app.post('/api/admin/verify-keys', ADMIN_PROBE_RATE_LIMITER, requireAdmin, async (req, res) => {
  const requestId = createRequestId();

  try {
    const report = await probeAllServices();

    logger.info({
      requestId,
      stage: 'adminVerifyKeys',
      status: 'ok',
      okCount: report.summary.ok,
      failingCount: report.summary.failing,
    });

    // Canary tek bir anlik yoklama; zeroStreaks ise GERCEK kullanici
    // aramalarinda ust uste bos donen kaynaklar. Ikisi farkli seyler olcer:
    // canary yesilken bile belirli sorgu kaliplari sifir donebilir.
    return res.json({ requestId, ...report, zeroStreaks: getZeroStreaks() });
  } catch (error) {
    logger.error({
      requestId,
      stage: 'adminVerifyKeys',
      status: 'failed',
      error: error?.message || 'Bilinmeyen hata',
    });
    return res.status(500).json({ error: 'Servis kontrolu tamamlanamadi.' });
  }
});


const isTestBypassUser = (userId) =>
  isTestAuthAllowed() && typeof userId === 'string' && userId.startsWith('test-user');

/**
 * Aboneliği doğrular. Geçerliyse true döner; değilse yanıtı kendisi yazar.
 *
 * Kullanıcı kimliğini parametre olarak alır çünkü writer uçları kimliği
 * getWriterUserId() üzerinden çözüyor (test başlığı desteği için).
 */
/**
 * "Bu kullanicinin aboneligi yok" hatasini, "abonelik servisi coktu"
 * hatasindan ayirir.
 *
 * Clerk Billing acik degilse ya da kullanicinin abonelik kaydi yoksa
 * getUserBillingSubscription() 404 firlatir. Bu bir arıza degil, normal bir
 * durum: kullanici ucretsiz katmanda.
 */
const isNoSubscriptionError = (error) => {
  if (error?.status === 404 || error?.statusCode === 404) return true;
  const codes = (error?.errors || []).map((e) => String(e?.code || ''));
  if (codes.some((code) => code.includes('not_found'))) return true;
  return /404|not[_ ]found|no subscription/i.test(String(error?.message || ''));
};

/**
 * Abonelik dogrulamasi.
 *
 * BILLING_REQUIRED=false (varsayilan) oldugunda kontrol hic yapilmaz. Sebebi:
 * uygulama henuz ucret almiyorsa, var olmayan bir aboneligi dogrulamaya
 * calisip kullaniciyi disarida birakmanin bir karsiligi yok. aba6160 bu
 * kontrolu "hata varsa engelle" yonune cevirmisti; Billing yapilandirilmamis
 * bir kurulumda bu, giris yapan HERKESE 503 donmesi demek — uretimde tam
 * olarak bu oldu.
 *
 * BILLING_REQUIRED=true oldugunda kontrol calisir ve uc durum ayrilir:
 *   - abonelik yok            -> gecir (ucretsiz katman)
 *   - abonelik var, aktif degil -> 403
 *   - servis hatasi           -> BILLING_FAIL_OPEN karar verir
 */
const hasActiveSubscription = async (res, userId) => {
  if (isTestBypassUser(userId)) return true;
  if (!BILLING_REQUIRED) return true;

  try {
    // Clerk Billing Beta API
    const subscription = await clerkClient.billing.getUserBillingSubscription(userId);

    // Eğer abonelik yoksa veya aktif/deneme değilse engelle
    if (subscription && subscription.status !== 'active' && subscription.status !== 'trialing') {
      res.status(403).json({
        error: 'Aboneliğiniz sona ermiştir veya aktif değildir.',
        needsBilling: true
      });
      return false;
    }
    return true;
  } catch (error) {
    // Abonelik kaydinin olmamasi bir ariza degil: ucretsiz katman.
    if (isNoSubscriptionError(error)) {
      return true;
    }

    // BILLING_FAIL_OPEN=true → eski davranış (billing API hatasında geçir)
    // BILLING_FAIL_OPEN=false (varsayılan) → hata durumunda engelle
    const failOpen = process.env.BILLING_FAIL_OPEN === 'true';

    console.error('[Billing] API hatası:', {
      message: error.message,
      userId,
      failOpen,
      timestamp: new Date().toISOString(),
    });

    if (failOpen) {
      console.warn('[Billing] UYARI: fail-open aktif, kullanıcı geçirildi. Dashboard billing ayarlarınızı kontrol edin.');
      return true;
    }

    res.status(503).json({
      error: 'Abonelik doğrulama servisi şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
      retryAfter: 30,
    });
    return false;
  }
};

const requireSubscription = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Lütfen giriş yapın' });

  if (await hasActiveSubscription(res, userId)) next();
};

/**
 * Writer uçları için abonelik kontrolü.
 *
 * /api/writer/generate sistemin en pahalı işlemi (LLM üretimi) olmasına rağmen
 * yalnızca rate limit ve kimlik doğrulamasıyla korunuyordu; /api/search ve
 * /api/analyze-query abonelik istiyordu. Aboneliği olmayan giriş yapmış bir
 * kullanıcı LLM üretimini serbestçe kullanabiliyordu.
 */
const requireWriterSubscription = async (req, res, next) => {
  const userId = getWriterUserId(req);
  if (!userId) return res.status(401).json({ error: 'Lütfen giriş yapın' });

  if (await hasActiveSubscription(res, userId)) next();
};


/**
 * Siralama profilleri: agirliklar dahil, seffaflik icin. Statik veri,
 * kimlik dogrulama gerektirmez.
 */
/**
 * Gelismis mod: kaydirici veya ikili yargilardan agirlik uretir. Saf hesap,
 * dis istek yok. Donen `weights` istemci tarafindan /api/search'e `weights`
 * parametresi olarak gonderilir; dogrulama orada tekrar yapilir.
 */
/**
 * Unpaywall: DOI icin yasal ucretsiz kopya. Arama sirasinda degil, kullanici
 * "Ucretsiz PDF" dugmesine bastiginda cagrilir (tek DOI = tek istek).
 * PDF barindirilmaz; yalnizca link ve surum bilgisi doner.
 */
app.get('/api/oa', searchLimiter, async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Lütfen giriş yapın' });

  const r = await findOpenAccessCopy(req.query.doi);
  const lang = getLang(req);
  if (r.status === 'ok') return res.json({ found: r.result.isOa && Boolean(r.result.pdfUrl || r.result.landingUrl), ...r.result });
  if (r.status === 'not_found') return res.json({ found: false });
  if (r.status === 'not_configured') return res.status(503).json({ error: msg(lang, 'oa.notConfigured'), configured: false });
  if (r.status === 'quota') return res.status(429).json({ error: msg(lang, 'oa.quota') });
  const invalid = r.message === 'Geçerli bir DOI değil.';
  return res.status(invalid ? 400 : 502).json({ error: invalid ? msg(lang, 'oa.invalidDoi') : msg(lang, 'oa.failed') });
});

app.post('/api/ranking/evaluate', (req, res) => {
  const body = req.body || {};
  const lang = getLang(req);
  if (body.mode === 'ratings') {
    return res.json({ ok: true, ...ratingsToWeights(body.ratings, lang) });
  }
  if (body.mode === 'pairwise') {
    // Eksik yanit serbest (Harker, 1987); yanitlar kriterleri baglamali.
    const result = evaluateComparisons(body.judgments, { allowedValues: body.allowedValues, lang });
    return res.status(result.ok ? 200 : 400).json(result);
  }
  return res.status(400).json({ ok: false, error: msg(lang, 'pairwise.badMode') });
});

app.get('/api/ranking/profiles', (req, res) => {
  res.json({ profiles: listProfiles(getLang(req)), methodology: getWeightingMethodology() });
});

// --- Yedek (yonetici) ---
app.get('/api/admin/backup', requireAdmin, async (req, res) => {
  try {
    const db2 = getSecondaryDb();
    return res.json({ secondary: secondaryStatus(), last: db2 ? await lastBackup(db2) : null, lastOk: db2 ? await lastBackup(db2, { onlyOk: true }) : null });
  } catch (error) {
    return res.status(500).json({ error: 'Yedek durumu okunamadi' });
  }
});

let manualBackupRunning = false;
app.post('/api/admin/backup', requireAdmin, async (req, res) => {
  const primaryDb = getPrimaryDb();
  const db2 = getSecondaryDb();
  if (!primaryDb || !db2) return res.status(503).json({ error: 'Veritabanlarindan biri bagli degil', secondary: secondaryStatus() });
  if (manualBackupRunning) return res.status(409).json({ error: 'Yedek zaten calisiyor' });
  manualBackupRunning = true;
  try {
    return res.json(await runBackup({ primaryDb, secondaryDb: db2, trigger: 'manual' }));
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error).slice(0, 200) });
  } finally {
    manualBackupRunning = false;
  }
});

// --- Makale cozumleyici (kaynakca dogrulama) ---
// services/resolver: DOI/URL/kaynakca satiri -> dogrulanmis kanonik kayit.
// Sonuc onbellekli (Mongo + bellek); ayni satir ikinci kez dis API cagirmaz.
const resolver = createResolver();
const MAX_RESOLVE_INPUT = 1000;
const MAX_RESOLVE_BATCH = 50;
const RESOLVE_BATCH_CONCURRENCY = 3;

// Toplu dogrulama tek istekte 50 satir isleyebildigi icin ayri sinir.
const resolveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => getAuth(req)?.userId || ipKeyGenerator(req.ip),
  message: { error: 'Çok fazla doğrulama isteği. Lütfen 1 dakika bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Istemciye iz (trace) yalnizca ozet olarak gider; ham URL'lerde anahtar olabilir.
const publicTrace = (trace = []) => trace.map(({ layer, source, status, ms, cost_usd }) => ({ layer, source, status, ms, cost_usd }));
const publicResult = (r) => ({ ...r, trace: publicTrace(r.trace) });

app.post('/api/resolve', resolveLimiter, async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) return;
  const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
  if (!input) return res.status(400).json({ error: 'Girdi eksik' });
  if (input.length > MAX_RESOLVE_INPUT) return res.status(400).json({ error: `Girdi en fazla ${MAX_RESOLVE_INPUT} karakter olabilir` });
  try {
    return res.json(publicResult(await resolver.resolve(input)));
  } catch (error) {
    console.error('Resolve error:', error);
    return res.status(500).json({ error: 'Makale çözümlenemedi' });
  }
});

app.post('/api/resolve/batch', resolveLimiter, async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) return;
  const lines = Array.isArray(req.body?.lines)
    ? req.body.lines.filter((l) => typeof l === 'string').map((l) => l.trim()).filter(Boolean)
    : [];
  if (lines.length === 0) return res.status(400).json({ error: 'Satır listesi eksik' });
  if (lines.length > MAX_RESOLVE_BATCH) return res.status(400).json({ error: `En fazla ${MAX_RESOLVE_BATCH} satır gönderilebilir` });
  if (lines.some((l) => l.length > MAX_RESOLVE_INPUT)) return res.status(400).json({ error: `Bir satır en fazla ${MAX_RESOLVE_INPUT} karakter olabilir` });

  try {
    const results = new Array(lines.length);
    let next = 0;
    // Kaynak basina hiz siniri cozumleyicide; burada yalnizca es zamanlilik.
    const worker = async () => {
      while (next < lines.length) {
        const i = next++;
        try {
          results[i] = { input: lines[i], ...publicResult(await resolver.resolve(lines[i])) };
        } catch (error) {
          results[i] = { input: lines[i], status: 'error', error: String(error?.message || error).slice(0, 200) };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(RESOLVE_BATCH_CONCURRENCY, lines.length) }, worker));
    const summary = { found: 0, candidates: 0, not_found: 0, error: 0, withDiscrepancies: 0 };
    for (const r of results) {
      summary[r.status] = (summary[r.status] || 0) + 1;
      if (r.discrepancies?.length) summary.withDiscrepancies++;
    }
    const costUsd = Math.round(results.reduce((s, r) => s + (r.cost_usd || 0), 0) * 10000) / 10000;
    return res.json({ results, summary, cost_usd: costUsd });
  } catch (error) {
    console.error('Resolve batch error:', error);
    return res.status(500).json({ error: 'Kaynakça doğrulanamadı' });
  }
});

// --- Geri cekilme kontrolu (sonraki sayfalar) ---
// Arama yalnizca ilk 25 sonucu kontrol ediyor (rankingPipeline.FIRST_PAGE_SIZE);
// istemci "Daha fazla goster" ile acilan sayfanin DOI'lerini buraya gonderir.
const MAX_RETRACTION_DOIS = 25;

app.post('/api/retractions', searchLimiter, async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) return;
  const dois = Array.isArray(req.body?.dois)
    ? [...new Set(req.body.dois.filter((d) => typeof d === 'string' && d.length <= 200).map(normalizeRetractionDoi))].filter((d) => d.length > 5)
    : [];
  if (dois.length === 0) return res.status(400).json({ error: 'DOI listesi eksik' });
  if (dois.length > MAX_RETRACTION_DOIS) {
    return res.status(400).json({ error: `En fazla ${MAX_RETRACTION_DOIS} DOI gonderilebilir` });
  }
  try {
    const { byDoi, errors } = await checkRetractions(dois);
    const results = {};
    // Yanit gelmeyen DOI 'unknown': "geri cekilmemis" demek icin kanit yok.
    for (const doi of dois) results[doi] = byDoi.get(doi) || { status: 'unknown', notices: [] };
    return res.json({ results, failed: errors.length > 0 });
  } catch (error) {
    console.error('Retraction check error:', error);
    return res.status(502).json({ error: 'Geri cekilme kontrolu yapilamadi' });
  }
});

app.get('/api/search', searchLimiter, requireSubscription, async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Lütfen giriş yapın' });

  try {
    const { mainTopic, authorName, keywords, language, count } = req.query;

    let keywordList = [];

    try {
      if (keywords) {
        keywordList = JSON.parse(keywords);
      }
    } catch {
      keywordList = [];
    }

    const requestedLimit = Number.isFinite(Number.parseInt(count, 10)) ? Number.parseInt(count, 10) : 25;
    const limit = Math.min(MAX_SEARCH_COUNT, Math.max(10, requestedLimit));
    // Siralama agirliklari. Bilerek onbellek anahtarina GIRMIYOR: onbellek AHP
    // oncesi havuzu tutuyor ve siralama her istekte bu agirliklarla uretiliyor.
    const weightsParam = parseWeightsParam(req.query.weights);
    const lang = getLang(req);
    const ranking = resolveRankingWeights({ profileId: req.query.profileId, weights: weightsParam, lang });
    if (req.query.weights && !weightsParam) {
      ranking.warnings.push(msg(lang, 'warnings.badWeightsParam'));
    }
    // Turkce ceviri istege bagli (varsayilan Ingilizce). Onbellek anahtarina
    // girmiyor: ceviri havuzun degil sunumun parcasi.
    const translateEnabled = req.query.translate === 'tr';
    const rankingInfo = {
      profileId: ranking.profileId,
      source: ranking.source,
      weights: ranking.weights,
      warnings: ranking.warnings,
    };

    const cacheFingerprint = buildSearchCacheFingerprint({
      mainTopic,
      authorName,
      keywords: keywordList,
      language,
      aiQuery: req.query.aiQuery,
      count: limit
    });
    const hasSearchInput = Boolean(
      mainTopic?.trim() ||
      authorName?.trim() ||
      req.query.aiQuery?.trim() ||
      keywordList.length > 0
    );

    if (hasSearchInput) {
      const cachedResult = await getSharedSearchCache(cacheFingerprint);
      if (cachedResult) {
        // Cache'teki sonuç boşsa (eski hatalı kayıt) bypass et, canlı arama yap
        const cachedResultCount = Array.isArray(cachedResult.results) ? cachedResult.results.length : 0;
        if (cachedResultCount > 0) {
          console.log(`[SearchCache] Mongo hit: ${cacheFingerprint.displayQuery || cacheFingerprint.cacheKey} (${cachedResultCount} sonuç)`);
          const { _cache, ...cachedPublic } = cachedResult;
          const pool = _cache?.pool;
          if (Array.isArray(pool) && pool.length > 0) {
            // Onbellekteki siralamayi DEGIL havuzu kullan: siralama bu
            // kullanicinin agirliklariyla yeniden uretilir.
            const reranked = await rankWithFirstPageRetractions(pool, {
              weights: ranking.weights,
              displayCount: limit,
              translations: _cache.translations || {},
              translateEnabled,
            });
            if (reranked.translatedCount > 0) {
              updateSearchCacheTranslations(cacheFingerprint, reranked.translations)
                .catch((e) => console.warn('[SearchCache] Ceviri kaydedilemedi:', e.message));
            }
            return res.json({
              ...cachedPublic,
              results: reranked.results,
              ranking: rankingInfo,
              translation: { enabled: translateEnabled },
              features: { unpaywall: isUnpaywallConfigured() },
              methodology: getWeightingMethodology(ranking.weights),
            });
          }
          // Havuzsuz eski kayit: yalnizca varsayilan agirlikla servis edilebilir.
          if (ranking.source === 'default') {
            return res.json({ ...cachedPublic, ranking: rankingInfo, features: { unpaywall: isUnpaywallConfigured() } });
          }
          console.log('[SearchCache] Eski kayitta havuz yok ve ozel agirlik istendi; canli aramaya geciliyor.');
        } else {
          console.log(`[SearchCache] Mongo hit AMA sonuç boş, cache bypass ediliyor...`);
        }
      }
    }

    const queryParts = [];
    const booleanQueryParts = [];
    let queryContextWords = []; // AHP kelime sayacı için saf kelimeler

    // Yapılandırılmış sorgu planı: her ifadenin özgün hali ve çevirisi ayrı
    // tutulur. services/sourceQuery.js bundan kaynak başına sorgu üretiyor —
    // tek dizeyi yedi farklı sorgu diline göndermek DOAJ'ın sessiz sıfırının
    // ve arXiv'in gürültüsünün ortak sebebiydi.
    const phrases = [];

    if (req.query.aiQuery) {
      // Convert single quotes to double quotes for Scopus/Academic engines
      let aiQuery = req.query.aiQuery.replace(/'/g, '"');

      // AI prompt İngilizce sorgu üretmesi için zorlanıyor ama her zaman doğrulayalım:
      // ASCII-Türkçe (yapay zeka, elektrikli arac vb.) veya tam Türkçe karakterler olabilir.
      // Çeviri DeepSeek ile (utils/translation.js → translateToEnglish); prompt boolean
      // operatörleri korumasını istiyor. Operatörler ("OR", "AND", parantezler, tırnaklar) çoğunlukla bozulmaz;
      // yine de çevirinin orijinalden anlamlı şekilde farklı olduğu durumda çeviriyi kullanırız.
      try {
        const translatedAi = await translateToEnglish(aiQuery);
        const original = aiQuery.trim().toLowerCase();
        const translated = translatedAi?.text?.trim();
        if (translated && translated.toLowerCase() !== original) {
          console.log(`AI sorgusu İngilizce'ye çevrildi: "${aiQuery}" → "${translated}"`);
          aiQuery = translated;
        }
      } catch (transErr) {
        console.warn('AI Query translation failed', transErr?.message || transErr);
      }

      const words = aiQuery.replace(/[()"]/g, ' ').split(/\s+/).filter(w => w.length > 2 && w !== 'OR' && w !== 'AND');
      queryContextWords.push(...words);

      queryParts.push(`TITLE-ABS-KEY(${aiQuery})`);
      booleanQueryParts.push(`(${aiQuery})`);
      // aiQuery İngilizce bir BOOLEAN sorgu ("..." OR "...") AND ...; düz ifade
      // gibi tırnaklanırsa kaynaklar 0 döndürür (M0 regresyonu, ölçüldü).
      phrases.push({ original: aiQuery, translated: null, boolean: true });
    } else if (mainTopic) {
      // Clean and sanitize main topic
      const cleanTopic = mainTopic.trim().replace(/'/g, '"');
      queryContextWords.push(cleanTopic);
      let topicQuery = `title("${cleanTopic}") OR key("${cleanTopic}") OR abs("${cleanTopic}")`;

      let topicTranslated = null;
      try {
        const translated = await translateToEnglish(cleanTopic);
        let topicBoolean = `"${cleanTopic}"`;

        if (
          translated?.text &&
          translated.text.toLowerCase() !== String(cleanTopic).toLowerCase()
        ) {
          const transText = translated.text.replace(/'/g, '"');
          topicTranslated = transText;
          topicQuery += ` OR title("${transText}") OR key("${transText}") OR abs("${transText}")`;
          topicBoolean += ` OR "${transText}"`;
          queryContextWords.push(transText);
        }
        booleanQueryParts.push(`(${topicBoolean})`);
      } catch (error) {
        console.error('Translate error:', error);
      }
      phrases.push({ original: cleanTopic, translated: topicTranslated });

      queryParts.push(`(${topicQuery})`);
    }

    if (authorName) {
      queryParts.push(`aut(${authorName})`);
    }

    if (keywordList.length > 0) {
      const keywordQueries = [];

      for (const keyword of keywordList) {
        queryContextWords.push(keyword);
        // abs() ile abstract da aranıyor; key() ile resmi keyword alanı
        let keywordQuery = `key(${keyword}) OR abs(${keyword})`;
        let keywordBoolean = `"${keyword}"`;
        let keywordTranslated = null;

        try {
          const translated = await translateToEnglish(keyword);

          if (
            translated?.text &&
            translated.text.toLowerCase() !== String(keyword).toLowerCase()
          ) {
            keywordTranslated = translated.text;
            keywordQuery += ` OR key(${translated.text}) OR abs(${translated.text})`;
            keywordBoolean += ` OR "${translated.text}"`;
            queryContextWords.push(translated.text);
          }
        } catch (error) {
          console.error('Translate error:', error);
        }

        keywordQueries.push(`(${keywordQuery})`);
        booleanQueryParts.push(`(${keywordBoolean})`);
        phrases.push({ original: keyword, translated: keywordTranslated });
      }

      // AND: tüm keywordler eşleşmeli → hassas arama
      queryParts.push(keywordQueries.join(' AND '));
    }

    if (language) {
      queryParts.push(`language(${language})`);
    }

    const finalQuery = queryParts.join(' AND ');

    if (!finalQuery) {
      return res.status(400).json({ error: 'At least one search parameter is required.' });
    }

    const queryContext = queryContextWords.join(' ');
    const booleanQuery = booleanQueryParts.join(' AND ');
    const queryPlan = { phrases, terms: queryContextWords, authorName: authorName || null };

    console.log(`Received search request. Final Scopus Query: ${finalQuery}, limit: ${limit}`);
    console.log(`Boolean Query for CORE/OpenAlex: ${booleanQuery}`);

    // Yeni yapıya parametreleri gönderiyoruz
    const params = { mainTopic, authorName, keywords: keywordList, count: limit };
    const results = await searchAll(params, queryContext, finalQuery, booleanQuery, queryPlan, ranking.weights, { translate: translateEnabled });
    let cacheSave = { saved: false };
    try {
      // Sadece dolu sonuçları cache'e kaydet
      const resultCount = Array.isArray(results.results) ? results.results.length : 0;
      if (resultCount > 0) {
        cacheSave = await saveSharedSearchCache(cacheFingerprint, results);
        if (cacheSave.saved) {
          console.log(`[SearchCache] Mongo save: ${cacheFingerprint.displayQuery || cacheFingerprint.cacheKey} (${resultCount} sonuç)`);
        }
      } else {
        console.warn('[SearchCache] Sonuç boş, cache\'e kaydedilmiyor.');
      }
    } catch (cacheError) {
      console.warn('[SearchCache] Save skipped:', cacheError.message);
    }

    const { _cache: _omitCache, ...publicResults } = results;
    return res.json({
      ...publicResults,
      ranking: rankingInfo,
      features: { unpaywall: isUnpaywallConfigured() },
      isCached: false,
      cache: {
        hit: false,
        storage: 'live',
        saved: Boolean(cacheSave.saved),
        ttlDays: getSearchCacheConfig().ttlDays
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Dahili Sunucu Hatası';
    
    let status = 500;
    let friendlyMessage = message;

    if (message.includes('429') || message.includes('Kotanız') || message.includes('QUOTA')) {
      status = 429;
      friendlyMessage = 'Scopus veya akademik kaynak kotası doldu. Sistem demo verilerle devam ediyor.';
    } else if (message.includes('401')) {
      status = 401;
      friendlyMessage = 'API erişim hatası (Yetkisiz). Lütfen anahtarlarınızı kontrol edin.';
    } else if (message.includes('timeout') || message.includes('zaman aşımı')) {
      status = 504;
      friendlyMessage = 'Arama zaman aşımına uğradı. Lütfen daha dar bir konu deneyin.';
    }

    return res.status(status).json({
      error: friendlyMessage,
      originalError: message,
      quota: error?.quota || null,
    });
  }
});

app.post('/api/analyze-query', requireSubscription, async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    if (!process.env.GROQ_API_KEY?.trim()) {
      return res.status(400).json({ error: 'GROQ_API_KEY is not defined on the server' });
    }
    const analysis = await analyzeAndExpandQuery(topic);
    return res.json(analysis);
  } catch (error) {
    console.error('AI analyze error:', error);
    return res.status(500).json({ error: error.message || 'AI analysis failed' });
  }
});

const getArchiveLimitByFavoriteCount = (favoriteCount) =>
  Math.max(0, USER_TOTAL_RESEARCH_LIMIT - favoriteCount);

const getFavoriteCountForUser = async (userId) => {
  const favorites = await Collection.findOne({ userId, name: FAVORITES_COLLECTION_NAME })
    .select({ papers: 1, _id: 0 })
    .lean();
  return Array.isArray(favorites?.papers) ? favorites.papers.length : 0;
};

const enforceArchiveQuota = async (userId) => {
  const favoriteCount = await getFavoriteCountForUser(userId);
  const maxArchiveCount = getArchiveLimitByFavoriteCount(favoriteCount);
  const archiveCount = await SearchHistory.countDocuments({ userId });
  let removedArchiveCount = 0;

  if (archiveCount > maxArchiveCount) {
    removedArchiveCount = archiveCount - maxArchiveCount;
    const overflowEntries = await SearchHistory.find({ userId })
      .sort({ createdAt: 1 })
      .limit(removedArchiveCount)
      .select('_id');

    if (overflowEntries.length > 0) {
      await SearchHistory.deleteMany({ _id: { $in: overflowEntries.map((entry) => entry._id) } });
    }
  }

  return {
    favoriteCount,
    maxArchiveCount,
    archiveCount: Math.max(archiveCount - removedArchiveCount, 0),
    removedArchiveCount
  };
};

// --- History API ---

app.get('/api/history', async (req, res) => {
  const authUserId = getRequestUserId(req, res);
  if (!authUserId) return;
  req.query.userId = authUserId;

  try {
    const { userId } = req.query;
    if (!isValidUserId(userId)) return res.status(400).json({ error: 'Geçersiz veya eksik kullanıcı kimliği.' });

    // DB connection check
    if (mongoose.connection.readyState !== 1) {
      return res.json([]);
    }

    const quota = await enforceArchiveQuota(userId);
    if (quota.maxArchiveCount === 0) {
      return res.json([]);
    }

    const history = await SearchHistory.find({ userId })
      .sort({ createdAt: -1 })
      .limit(quota.maxArchiveCount);
    
    return res.json(history);
  } catch (error) {
    console.error('History fetch error:', error);
    return res.status(500).json({ error: 'Geçmiş yüklenemedi.' });
  }
});

app.post('/api/history', async (req, res) => {
  const authUserId = getRequestUserId(req, res);
  if (!authUserId) return;
  req.body = { ...req.body, userId: authUserId };

  try {
    const { userId, mainTopic, authorName, keywords, aiQuery } = req.body;
    console.log(`[History] Yeni kayıt isteği: User=${userId}, Topic=${mainTopic || 'AI Sorgusu'}`);
    
    if (!userId || (!mainTopic && !authorName && !aiQuery)) {
      console.warn('[History] Kayıt başarısız: Eksik veri');
      return res.status(400).json({ error: 'Missing history data' });
    }

    // DB connection check
    if (mongoose.connection.readyState !== 1) {
      return res.json({ message: 'DB not connected, history not saved' });
    }

    // Data minimization
    const cleanHistory = {
      userId,
      mainTopic: mainTopic?.trim().slice(0, 150),
      authorName: authorName?.trim().slice(0, 80),
      keywords: Array.isArray(keywords) ? keywords.map(k => k.trim().slice(0, 40)).filter(Boolean) : [],
      aiQuery: aiQuery?.trim().slice(0, 300)
    };

    // Duplicate check: compare only with the latest history entry
    const lastSearch = await SearchHistory.findOne({ userId }).sort({ createdAt: -1 });
    if (lastSearch) {
      const isDuplicate =
        (lastSearch.mainTopic || '') === (cleanHistory.mainTopic || '') &&
        (lastSearch.authorName || '') === (cleanHistory.authorName || '') &&
        JSON.stringify(lastSearch.keywords || []) === JSON.stringify(cleanHistory.keywords || []) &&
        (lastSearch.aiQuery || '') === (cleanHistory.aiQuery || '');

      if (isDuplicate) {
        lastSearch.createdAt = new Date();
        await lastSearch.save();
        await enforceArchiveQuota(userId);
        return res.json(lastSearch);
      }
    }

    const newHistory = new SearchHistory(cleanHistory);

    await newHistory.save();
    console.log(`[History] Başarıyla kaydedildi: ${newHistory._id}`);

    await enforceArchiveQuota(userId);

    return res.status(201).json(newHistory);
  } catch (error) {
    console.error('History save error:', error);
    return res.status(500).json({ error: 'Failed to save history' });
  }
});

const requireDb = (res) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ error: 'DB not connected' });
    return false;
  }
  return true;
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

app.delete('/api/history/entry/:id', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim' });

  try {
    if (!requireDb(res)) return;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz id' });
    const result = await SearchHistory.findOneAndDelete({ _id: id, userId });
    if (!result) return res.status(404).json({ error: 'Entry not found' });
    return res.json({ message: 'Entry deleted' });
  } catch (error) {
    console.error('Entry delete error:', error);
    return res.status(500).json({ error: 'Failed to delete entry' });
  }
});

app.delete('/api/history', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim' });

  try {
    if (!requireDb(res)) return;
    await SearchHistory.deleteMany({ userId });
    return res.json({ message: 'History cleared' });
  } catch (error) {
    console.error('History delete error:', error);
    return res.status(500).json({ error: 'Failed to clear history' });
  }
});

// --- Collections API ---

app.get('/api/collections', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim' });

  try {
    if (!requireDb(res)) return;
    // Özel koleksiyonlar kaynak sepetine dönüştü; listede yalnızca Favoriler kalıyor.
    let collections = await Collection.find({ userId, name: FAVORITES_COLLECTION_NAME });

    if (collections.length === 0) {
      try {
        const defaultColl = new Collection({ userId, name: FAVORITES_COLLECTION_NAME, papers: [] });
        await defaultColl.save();
        collections = [defaultColl];
      } catch (error) {
        if (error.code !== 11000) throw error;
        collections = await Collection.find({ userId, name: FAVORITES_COLLECTION_NAME });
      }
    }
    return res.json(collections);
  } catch (error) {
    console.error('Collections fetch error:', error);
    return res.status(500).json({ error: 'Koleksiyonlar yüklenemedi' });
  }
});

const MAX_COLLECTIONS_PER_USER = 10;

app.post('/api/collections', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim' });

  try {
    const { name } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Missing data' });
    if (String(name).trim() !== FAVORITES_COLLECTION_NAME) {
      return res.status(410).json({ error: 'Koleksiyonlar kaldırıldı; kaynak sepetini kullanın.', code: 'COLLECTIONS_REMOVED' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'DB not connected' });
    }

    const total = await Collection.countDocuments({ userId });
    if (total >= MAX_COLLECTIONS_PER_USER) {
      return res.status(400).json({ error: `En fazla ${MAX_COLLECTIONS_PER_USER} koleksiyon oluşturulabilir.` });
    }

    const newCollection = new Collection({
      userId,
      name: String(name).trim().slice(0, 60),
      papers: []
    });
    await newCollection.save();
    return res.status(201).json(newCollection);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Bu isimde bir koleksiyon zaten var' });
    }
    console.error('Collection save error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to create collection' });
  }
});

const MAX_SHARED_RESULTS = MAX_SEARCH_COUNT;

const truncate = (s, n) => (typeof s === 'string' ? s.trim().slice(0, n) : '');

// --- Sharing API ---

app.post('/api/share', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Yetkisiz erisim' });

  try {
    if (!requireDb(res)) return;
    const { mainTopic, results, aiAnalysis, originalParams } = req.body;

    if (!Array.isArray(results) || results.length === 0) {
      return res.status(400).json({ error: 'Paylaşılacak veri bulunamadı' });
    }

    const shareId = crypto.randomBytes(8).toString('hex');
    const safeResults = results.slice(0, MAX_SHARED_RESULTS);

    const newShare = new SharedSearch({
      shareId,
      userId,
      mainTopic: truncate(mainTopic || 'Paylasilan arastirma', 150),
      results: safeResults,
      aiAnalysis,
      originalParams: originalParams || {}
    });

    await newShare.save();
    
    // In production, req.headers.origin might be missing or unreliable.
    // We prefer an absolute URL if possible, otherwise we let the client handle it.
    let shareUrl = null;
    if (req.headers.origin) {
      shareUrl = `${req.headers.origin}?s=${shareId}`;
    }

    return res.status(201).json({ shareId, url: shareUrl });
  } catch (error) {
    console.error('Share create error:', error);
    return res.status(500).json({ error: 'Paylaşım oluşturulamadı' });
  }
});

app.get('/api/share/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // shareId crypto.randomBytes(8).toString('hex') ile uretiliyor.
    // Bicim kontrolu veritabanina danismadan once yapiliyor: gecersiz bir kimlik
    // icin baglanti durumunu sorgulamanin anlami yok.
    if (typeof id !== 'string' || !/^[a-f0-9]{16}$/.test(id)) {
      return res.status(404).json({ error: 'Paylaşım bulunamadı veya süresi dolmuş' });
    }

    if (!requireDb(res)) return;

    // Tek atomik islem. Onceki surum dokumani okuyup viewCount'u artirip save()
    // cagiriyordu; bu her goruntulemede tum results dizisini (100 kayda kadar)
    // yeniden yaziyor ve es zamanli iki istek birbirinin sayacini eziyordu.
    //
    // Projeksiyon userId'yi disarida birakiyor: yanit tum mongoose dokumanini
    // donduruyordu, yani baglantiya sahip herkes paylasan kullanicinin Clerk
    // kimligini gorebiliyordu.
    const share = await SharedSearch.findOneAndUpdate(
      { shareId: id },
      { $inc: { viewCount: 1 } },
      { new: true, projection: { userId: 0, __v: 0 } }
    ).lean();

    if (!share) return res.status(404).json({ error: 'Paylaşım bulunamadı veya süresi dolmuş' });

    return res.json(share);
  } catch (error) {
    console.error('Share fetch error:', error);
    return res.status(500).json({ error: 'Paylaşım yüklenemedi' });
  }
});

app.post('/api/collections/:id/add', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim' });

  try {
    if (!requireDb(res)) return;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz id' });
    const { paper } = req.body || {};

    if (!paper || (!paper.title && !paper.doi)) {
      return res.status(400).json({ error: 'Paper data eksik' });
    }

    const collection = await Collection.findOne({ _id: id, userId });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });

    const minimizedPaper = {
      title: truncate(paper.title, 200),
      year: truncate(String(paper.year ?? ''), 8),
      authors: truncate(paper.authors || paper.creator, 100),
      url: truncate(paper.url, 200),
      doi: truncate(paper.doi, 80),
      publicationName: truncate(paper.publicationName, 100),
      citedBy: Math.max(0, Number(paper.citedBy) || 0),
      description: truncate(paper.description, 150)
    };

    const exists = collection.papers.some(p =>
      (minimizedPaper.doi && p.doi === minimizedPaper.doi) ||
      (!minimizedPaper.doi && p.title === minimizedPaper.title)
    );
    if (exists) return res.status(400).json({ error: 'Bu makale zaten koleksiyonda' });

    const isFavoritesCollection = collection.name === FAVORITES_COLLECTION_NAME;

    if (isFavoritesCollection && collection.papers.length >= USER_TOTAL_RESEARCH_LIMIT) {
      return res.status(400).json({ error: `Favoriler en fazla ${USER_TOTAL_RESEARCH_LIMIT} makale tutabilir.` });
    }

    if (!isFavoritesCollection && collection.papers.length >= MAX_PAPERS_PER_COLLECTION) {
      collection.papers.sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0));
      collection.papers.shift();
    }

    collection.papers.push(minimizedPaper);
    await collection.save();

    if (isFavoritesCollection) {
      await enforceArchiveQuota(userId);
    }

    return res.json(collection);
  } catch (error) {
    console.error('Add to collection error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to add paper' });
  }
});

app.delete('/api/collections/:id/papers/:paperId', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim' });

  try {
    if (!requireDb(res)) return;
    const { id, paperId } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz collection id' });
    const collection = await Collection.findOne({ _id: id, userId });
    if (!collection) return res.status(404).json({ error: 'Collection not found' });
    const before = collection.papers.length;
    collection.papers = collection.papers.filter(p => String(p._id) !== String(paperId));
    if (collection.papers.length === before) {
      return res.status(404).json({ error: 'Paper not found in collection' });
    }
    await collection.save();
    return res.json(collection);
  } catch (error) {
    console.error('Remove paper error:', error);
    return res.status(500).json({ error: 'Failed to remove paper' });
  }
});

app.delete('/api/collections/:id', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: 'Yetkisiz erişim' });

  try {
    if (!requireDb(res)) return;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz id' });
    const result = await Collection.findOneAndDelete({ _id: id, userId });
    if (!result) return res.status(404).json({ error: 'Collection not found' });
    return res.json({ message: 'Collection deleted' });
  } catch (error) {
    console.error('Collection delete error:', error);
    return res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// --- Kaynak sepeti API ---
// Kullanıcının aramalar arasında topladığı makaleler (en fazla BASKET_LIMIT).
// Yazar modu ve kaynakça dışa aktarımı bu listeyle çalışır.

const BASKET_ERRORS = {
  invalid: [400, 'Makale verisi eksik'],
  duplicate: [409, 'Bu makale zaten sepette'],
  full: [400, `Sepet dolu (en fazla ${BASKET_LIMIT} makale). Önce bir makale çıkarın.`]
};

const sendBasket = (res, basket, status = 200) =>
  res.status(status).json({ papers: basket?.papers || [], limit: BASKET_LIMIT });

// Sepeti getirir; ilk çağrıda eski koleksiyonlardaki makaleleri bir kez aktarır.
// Eski koleksiyon belgeleri silinmez.
const loadBasket = async (userId) => {
  let basket = await Basket.findOne({ userId });
  if (basket?.migratedCollections) return basket;

  const legacy = await Collection.find({ userId, name: { $ne: FAVORITES_COLLECTION_NAME } })
    .select({ papers: 1 })
    .lean();
  const legacyPapers = collectLegacyPapers(legacy);

  if (!basket) {
    try {
      basket = await Basket.create({ userId, papers: legacyPapers, migratedCollections: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      basket = await Basket.findOne({ userId });
    }
    return basket;
  }

  basket.migratedCollections = true;
  await basket.save();
  return basket;
};

app.get('/api/basket', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) return;
  try {
    if (!requireDb(res)) return;
    return sendBasket(res, await loadBasket(userId));
  } catch (error) {
    console.error('Basket fetch error:', error);
    return res.status(500).json({ error: 'Sepet yüklenemedi' });
  }
});

app.post('/api/basket', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) return;
  try {
    if (!requireDb(res)) return;
    const basket = await loadBasket(userId);
    const plan = planBasketAdd(basket.papers, req.body?.paper);
    if (!plan.ok) {
      const [status, error] = BASKET_ERRORS[plan.reason];
      return res.status(status).json({ error, code: plan.reason.toUpperCase() });
    }
    // Koşullu atomik ekleme: iki sekmeden aynı anda eklemek sınırı aşmasın.
    const updated = await Basket.findOneAndUpdate(
      { userId, [`papers.${BASKET_LIMIT - 1}`]: { $exists: false } },
      { $push: { papers: plan.paper } },
      { new: true }
    );
    if (!updated) {
      const [status, error] = BASKET_ERRORS.full;
      return res.status(status).json({ error, code: 'FULL' });
    }
    return sendBasket(res, updated, 201);
  } catch (error) {
    console.error('Basket add error:', error);
    return res.status(500).json({ error: 'Makale sepete eklenemedi' });
  }
});

app.delete('/api/basket/papers/:paperId', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) return;
  try {
    const { paperId } = req.params;
    if (!isValidId(paperId)) return res.status(400).json({ error: 'Geçersiz id' });
    if (!requireDb(res)) return;
    const updated = await Basket.findOneAndUpdate(
      { userId },
      { $pull: { papers: { _id: paperId } } },
      { new: true }
    );
    return sendBasket(res, updated);
  } catch (error) {
    console.error('Basket remove error:', error);
    return res.status(500).json({ error: 'Makale sepetten çıkarılamadı' });
  }
});

app.delete('/api/basket', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) return;
  try {
    if (!requireDb(res)) return;
    const updated = await Basket.findOneAndUpdate({ userId }, { $set: { papers: [] } }, { new: true });
    return sendBasket(res, updated);
  } catch (error) {
    console.error('Basket clear error:', error);
    return res.status(500).json({ error: 'Sepet boşaltılamadı' });
  }
});

// --- Analyses API ---

app.get('/api/analyses', async (req, res) => {
  const authUserId = getRequestUserId(req, res);
  if (!authUserId) return;
  req.query.userId = authUserId;

  try {
    const { userId } = req.query;
    if (!isValidUserId(userId)) return res.status(400).json({ error: 'Geçersiz kullanıcı kimliği.' });

    if (mongoose.connection.readyState !== 1) return res.json([]);

    const analyses = await Analysis.find({ userId }).sort({ createdAt: -1 });
    return res.json(analyses);
  } catch (error) {
    console.error('Analyses fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

const MAX_ANALYSES_PER_USER = 20;

app.post('/api/analyses', async (req, res) => {
  const authUserId = getRequestUserId(req, res);
  if (!authUserId) return;
  req.body = { ...req.body, userId: authUserId };

  try {
    const { userId, topic, explanation, queries } = req.body || {};
    if (!userId || !topic) return res.status(400).json({ error: 'Missing analysis data' });

    if (mongoose.connection.readyState !== 1) {
      return res.json({ message: 'DB not connected, analysis not saved' });
    }

    const cleanQueries = Array.isArray(queries)
      ? queries.slice(0, 10).map(q => ({
          text: typeof q?.text === 'string' ? q.text.trim().slice(0, 180) : '',
          relevanceScore: Math.max(0, Math.min(100, Number(q?.relevanceScore) || 0))
        }))
      : [];

    const newAnalysis = new Analysis({
      userId,
      topic: String(topic).trim().slice(0, 150),
      explanation: typeof explanation === 'string' ? explanation.trim().slice(0, 500) : '',
      queries: cleanQueries
    });
    await newAnalysis.save();

    // Auto-cleanup: 100 kayıt cap'i, en eskileri sil
    try {
      const total = await Analysis.countDocuments({ userId });
      if (total > MAX_ANALYSES_PER_USER) {
        const overflow = await Analysis.find({ userId })
          .sort({ createdAt: 1 })
          .limit(total - MAX_ANALYSES_PER_USER);
        await Analysis.deleteMany({ _id: { $in: overflow.map(a => a._id) } });
      }
    } catch (cleanupErr) {
      console.warn('Analysis cleanup failed', cleanupErr);
    }

    return res.status(201).json(newAnalysis);
  } catch (error) {
    console.error('Analysis save error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to save analysis' });
  }
});

app.delete('/api/analyses/:id', async (req, res) => {
  const userId = getRequestUserId(req, res);
  if (!userId) return;

  try {
    if (!requireDb(res)) return;
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ error: 'Geçersiz id' });
    const result = await Analysis.findOneAndDelete({ _id: id, userId });
    if (!result) return res.status(404).json({ error: 'Analysis not found' });
    return res.json({ message: 'Analysis deleted' });
  } catch (error) {
    console.error('Analysis delete error:', error);
    return res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

// --- Writer API: Atıflı Metin Üretimi ---
const WRITER_RATE_LIMITER = IS_TEST_MODE
  ? (req, res, next) => next()
  : rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req) => getAuth(req)?.userId || ipKeyGenerator(req.ip),
    message: { error: 'Çok fazla yazma isteği gönderildi. Lütfen 1 dakika bekleyin.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

app.post('/api/writer/generate', WRITER_RATE_LIMITER, requireWriterSubscription, async (req, res) => {
  const userId = getWriterUserId(req);
  if (!userId) return res.status(401).json({ error: 'Lütfen giriş yapın' });

  const requestId = createRequestId();
  const {
    papers,
    prompt,
    outputType = 'literature-review',
    tone = 'akademik',
    length = 'orta',
    language = 'tr',
    bibliographyFormat = 'APA 7',
  } = req.body || {};

  if (!Array.isArray(papers) || papers.length === 0) {
    return res.status(400).json({ error: 'En az bir makale seçilmelidir.' });
  }
  if (papers.length > BASKET_LIMIT) {
    return res.status(400).json({ error: `En fazla ${BASKET_LIMIT} makale seçilebilir.` });
  }
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
    return res.status(400).json({ error: 'Yönlendirme metni en az 10 karakter olmalıdır.' });
  }

  // SSE (Server-Sent Events) header'ları
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('X-Request-Id', requestId);
  res.flushHeaders();

  const safePapers = papers.slice(0, BASKET_LIMIT).map((p, i) => ({
    ref: i + 1,
    id: String(p.id || p.doi || p.url || p.title || p.titleTR || `paper-${i + 1}`).slice(0, 300),
    title: String(p.title || p.titleTR || 'Başlıksız').slice(0, 200),
    authors: String(p.creator || (Array.isArray(p.authors) ? p.authors.slice(0, 3).join(', ') : p.authors) || 'Bilinmiyor').slice(0, 150),
    year: p.year || 'n.d.',
    journal: String(p.publicationName || '').slice(0, 150),
    citedBy: p.citedBy || p.citedbyCount || 0,
    abstract: String(p.description || p.teaserTR || '').slice(0, 600),
    doi: String(p.doi || '').slice(0, 100),
    url: String(p.url || '').slice(0, 300),
  }));

  try {
    await runWriterPipeline({
      requestId,
      safePapers,
      prompt,
      outputType,
      tone,
      length,
      language,
      bibliographyFormat,
      req,
      res,
    });
  } catch (err) {
    logger.error({
      requestId,
      stage: 'writerPipeline',
      status: 'failed',
      error: err?.message || 'Unexpected pipeline error',
    });
    try {
      res.write(`data: ${JSON.stringify({ error: err.message || 'Beklenmeyen hata oluştu.' })}\n\n`);
      res.end();
    } catch {}
  }
});

app.post('/api/writer/revision-roadmap', WRITER_RATE_LIMITER, requireWriterSubscription, async (req, res) => {
  const userId = getWriterUserId(req);
  if (!userId) return res.status(401).json({ error: 'Lütfen giriş yapın' });

  const flags = getWriterFlags();
  if (!flags.revisionCoachEnabled) {
    return res.status(403).json({
      error: 'Revision coach özelliği şu an kapalı.',
      featureFlag: 'WRITER_REVISION_COACH_ENABLED',
    });
  }

  const requestId = createRequestId();
  res.setHeader('X-Request-Id', requestId);

  const { reviewerText = '' } = req.body || {};
  if (typeof reviewerText !== 'string' || reviewerText.trim().length < 10) {
    return res.status(400).json({ error: 'reviewerText en az 10 karakter olmalıdır.' });
  }

  const { stageResult, roadmap } = runRevisionCoach(reviewerText);

  logger.info({
    requestId,
    stage: 'revisionCoach',
    status: stageResult.status,
    severity: stageResult.severity,
    durationMs: stageResult.durationMs,
  });

  return res.json({
    requestId,
    report: stageResult,
    roadmap,
  });
});

// Giriş gerektirmeden e-posta gönderen tek uç nokta; IP başına sıkı sınır olmadan
// herkes uygulamanın adresinden istediği kişiye sınırsız e-posta attırabilir.
const DEMO_EMAIL_LIMITER = IS_TEST_MODE
  ? (req, res, next) => next()
  : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    message: { error: 'Çok fazla e-posta isteği gönderildi. Lütfen 15 dakika sonra tekrar deneyin.' },
    standardHeaders: true,
    legacyHeaders: false,
  });

app.post('/api/demo/welcome', DEMO_EMAIL_LIMITER, async (req, res) => {
  try {
    const { email, name = 'Araştırmacı', query = '' } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Geçerli bir e-posta adresi giriniz.' });
    }
    const result = await sendWelcomeDemoEmail({ email, name, query });
    return res.json({ success: true, message: 'Hoş geldin e-postası başarıyla gönderildi.', result });
  } catch (error) {
    logger.error({ error: error.message }, '[API] /api/demo/welcome hatası');
    return res.status(500).json({ error: 'E-posta gönderilirken bir hata oluştu.' });
  }
});

// Veritabanı bağlı değilken veya dev ortamında mükerrer e-posta gönderimini önleyen bellek içi küme
const inMemoryWelcomeSent = new Set();

/**
 * Kullanıcı Giriş / Kayıt Senkronizasyonu ve Otomatik Hoş Geldin E-postası
 * Clerk ile giriş yapıldığında tetiklenir, kullanıcı ilk kez giriş yapıyorsa
 * doğrudan hoş geldin e-postasını gönderir.
 */
app.post('/api/auth/sync-user', async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ error: 'Lütfen giriş yapın.' });
  }

  try {
    // Alıcı adresi yalnızca Clerk'ten alınır. İstek gövdesindeki adrese güvenmek, herhangi bir
    // hesabın uygulama adına istediği adrese e-posta attırmasına izin veriyordu.
    let email = '';
    let name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim().slice(0, 100) : 'Araştırmacı';

    if (CLERK_CONFIGURED) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        if (clerkUser?.emailAddresses?.length > 0) {
          const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
          email = primary ? primary.emailAddress : clerkUser.emailAddresses[0].emailAddress;
        }
        const fullName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ');
        if (fullName) name = fullName;
      } catch (clerkErr) {
        logger.warn({ error: clerkErr.message, userId }, '[AuthSync] Clerk kullanıcı bilgisi alınamadı');
      }
    }

    const hasValidEmail = typeof email === 'string' && email.includes('@');
    let shouldSendWelcome = false;

    if (mongoose.connection.readyState === 1) {
      let profile = await UserProfile.findOne({ userId });
      if (!profile) {
        profile = new UserProfile({
          userId,
          email: hasValidEmail ? email.trim().toLowerCase() : '',
          name: typeof name === 'string' ? name.trim() : 'Araştırmacı',
          welcomeEmailSent: false,
          lastLoginAt: new Date(),
        });
        shouldSendWelcome = hasValidEmail;
      } else {
        profile.lastLoginAt = new Date();
        if (hasValidEmail && !profile.email) {
          profile.email = email.trim().toLowerCase();
        }
        if (name && name !== 'Araştırmacı' && (!profile.name || profile.name === 'Araştırmacı')) {
          profile.name = typeof name === 'string' ? name.trim() : 'Araştırmacı';
        }
        shouldSendWelcome = !profile.welcomeEmailSent && hasValidEmail;
      }

      if (shouldSendWelcome) {
        try {
          await sendWelcomeOnboardingEmail({
            email: profile.email || email,
            name: profile.name || name,
          });
          profile.welcomeEmailSent = true;
          profile.welcomeEmailSentAt = new Date();
        } catch (mailErr) {
          logger.error({ error: mailErr.message, userId, email }, '[AuthSync] Hoş geldin e-postası gönderim hatası');
        }
      }

      await profile.save();
    } else {
      // MongoDB bağlı değilse bellek içi takip ile hoş geldin gönder
      if (hasValidEmail && !inMemoryWelcomeSent.has(userId)) {
        shouldSendWelcome = true;
        try {
          await sendWelcomeOnboardingEmail({ email, name });
          inMemoryWelcomeSent.add(userId);
        } catch (mailErr) {
          logger.error({ error: mailErr.message, userId, email }, '[AuthSync] Hoş geldin e-postası gönderim hatası');
        }
      }
    }

    return res.json({
      success: true,
      userId,
      email: hasValidEmail ? email : null,
      name,
      welcomeEmailSent: shouldSendWelcome,
    });
  } catch (error) {
    logger.error({ error: error.message, userId }, '[API] /api/auth/sync-user hatası');
    return res.status(500).json({ error: 'Kullanıcı senkronizasyonunda bir hata oluştu.' });
  }
});


app.post('/api/consensus', async (req, res) => {
  try {
    const { topic = '', papers = [] } = req.body || {};
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'Konu parametresi gereklidir.' });
    }
    const snapshot = await generateConsensusSnapshot(topic, papers);
    return res.json({ success: true, snapshot });
  } catch (error) {
    logger.error({ error: error.message }, '[API] /api/consensus hatası');
    return res.status(500).json({ error: 'Literatür konsensüsü oluşturulamadı.' });
  }
});

// Son savunma hatti: buraya dusen her hata, istemciye stack trace sizdirmadan
// JSON olarak doner. Express'in varsayilan handler'i HTML icinde dosya yollarini
// ve node_modules ic yapisini aciga cikariyordu.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  // Bozuk JSON gövdesi ya da sınırı aşan gövde istemci hatasıdır, 500 değil
  // (body-parser bu hataları err.type ile işaretliyor).
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Geçersiz JSON gövdesi' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'İstek gövdesi çok büyük' });
  }

  logger.error({
    stage: 'unhandled',
    status: 'failed',
    path: req.path,
    method: req.method,
    error: err?.message || 'Unknown error',
  });

  return res.status(500).json({ error: 'Sunucu hatasi olustu.' });
});

if (!IS_TEST_MODE) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export { app };
