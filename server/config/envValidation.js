/**
 * Ortam değişkeni doğrulaması.
 *
 * Buradaki asıl sorun "eksik anahtar" değil, `.env.example` şablonundaki
 * yer tutucu metnin gerçek bir değermiş gibi davranması. `has(value)` tarzı
 * varlık kontrolleri `your_groq_api_key_here` değerini "yapılandırılmış"
 * sayıyor; sistem ancak canlı istek 401 döndüğünde hata veriyor ve bu da
 * kaynak bazında sessizce yutuluyor.
 *
 * KURAL: Bu modül hiçbir koşulda değişken DEĞERİNİ loglamaz veya döndürmez.
 * Yalnızca durum bilgisi üretir.
 */

const PLACEHOLDER_PATTERNS = [
  /your[_-]/i,
  /_here$/i,
  /^<.*>$/,
  /change[_-]?me/i,
  /xxxx/i,
  /example\.(com|org|net)/i,
  /username:password/i,
  /cluster\.mongodb\.net/i,
  /^your_key$/i,
];

/**
 * Sağlayıcıların anahtar biçimleri. Yanlış panodan kopyalanan bir değeri
 * canlı istek atmadan yakalar.
 */
const EXPECTED_PREFIXES = {
  CLERK_SECRET_KEY: ['sk_test_', 'sk_live_'],
  CLERK_PUBLISHABLE_KEY: ['pk_test_', 'pk_live_'],
  GROQ_API_KEY: ['gsk_'],
  MONGODB_URI: ['mongodb://', 'mongodb+srv://'],
};

const VARIABLES = [
  {
    name: 'MONGODB_URI',
    required: true,
    purpose: 'Geçmiş, koleksiyonlar, paylaşım, arama cache ve RAG vektör araması',
  },
  {
    name: 'CLERK_SECRET_KEY',
    required: true,
    purpose: 'Kimlik doğrulama ve abonelik kontrolü',
  },
  {
    name: 'GEMINI_API_KEY',
    required: false,
    purpose: 'Birincil metin üretimi ve embedding',
  },
  {
    name: 'GROQ_API_KEY',
    required: false,
    purpose: 'Gemini başarısız olduğunda yedek LLM',
  },
  {
    name: 'SCOPUS_API_KEY',
    alternatives: ['ELSEVIER_API_KEY'],
    required: false,
    purpose: 'Scopus akademik kaynağı',
  },
  {
    name: 'CORE_API_KEY',
    required: false,
    purpose: 'CORE akademik kaynağı',
  },
  {
    name: 'SEMANTIC_SCHOLAR_API_KEY',
    required: false,
    purpose: 'Semantic Scholar kota artırımı',
  },
  {
    name: 'OPENALEX_MAIL',
    alternatives: ['CONTACT_EMAIL'],
    required: false,
    purpose: 'OpenAlex polite-pool erişimi',
  },
];

export function isPlaceholderValue(value) {
  if (typeof value !== 'string') return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

/**
 * Tek bir değişkenin durumunu belirler. Dönen nesne asla değeri içermez.
 *
 * @returns {'missing'|'placeholder'|'malformed'|'configured'}
 */
export function inspectEnvValue(name, rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';

  if (!value) return { name, state: 'missing', detail: 'tanımlı değil' };

  if (isPlaceholderValue(value)) {
    return { name, state: 'placeholder', detail: '.env.example şablon metni girilmiş' };
  }

  const prefixes = EXPECTED_PREFIXES[name];
  if (prefixes && !prefixes.some((prefix) => value.startsWith(prefix))) {
    return {
      name,
      state: 'malformed',
      detail: `beklenen ön ek: ${prefixes.join(' veya ')}`,
    };
  }

  return { name, state: 'configured', detail: 'geçerli görünüyor' };
}

/**
 * Tüm ortamı doğrular.
 *
 * @returns {{ errors: string[], warnings: string[], report: Record<string, object> }}
 */
export function validateEnvironment(env = process.env) {
  const errors = [];
  const warnings = [];
  const report = {};

  for (const variable of VARIABLES) {
    const candidates = [variable.name, ...(variable.alternatives || [])];

    // Alternatifler arasında en iyi durumu seçiyoruz: SCOPUS_API_KEY eksikse
    // ama ELSEVIER_API_KEY doluysa kaynak yapılandırılmış sayılır.
    let best = null;
    for (const candidate of candidates) {
      const inspection = inspectEnvValue(candidate, env[candidate]);
      if (!best || rank(inspection.state) > rank(best.state)) best = inspection;
      if (inspection.state === 'configured') break;
    }

    report[variable.name] = {
      state: best.state,
      detail: best.detail,
      required: Boolean(variable.required),
      purpose: variable.purpose,
      checkedVariables: candidates,
    };

    if (best.state === 'configured') continue;

    const message =
      `${variable.name}: ${best.detail} (${variable.purpose})`;

    if (variable.required) errors.push(message);
    else warnings.push(message);
  }

  return { errors, warnings, report };
}

function rank(state) {
  return { missing: 0, malformed: 1, placeholder: 2, configured: 3 }[state] ?? 0;
}

/**
 * Konsola yazdırılabilir özet. Değer içermez.
 */
export function formatEnvReport({ errors, warnings }) {
  const lines = [];

  if (errors.length > 0) {
    lines.push('[ENV] Zorunlu yapılandırma eksik veya geçersiz:');
    for (const error of errors) lines.push(`  ✗ ${error}`);
  }

  if (warnings.length > 0) {
    lines.push('[ENV] İsteğe bağlı yapılandırma eksik veya geçersiz:');
    for (const warning of warnings) lines.push(`  ! ${warning}`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    lines.push('[ENV] Tüm ortam değişkenleri geçerli görünüyor.');
  }

  return lines.join('\n');
}
