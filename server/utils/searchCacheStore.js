import crypto from 'crypto';
import mongoose from 'mongoose';
import SearchCache from '../models/SearchCache.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_DAYS = 30;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;
const DEFAULT_MAX_RESULTS = 100;
const DEFAULT_MAX_DOC_BYTES = 12 * 1024 * 1024;
const SEARCH_CACHE_VERSION = 'v4';

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const CACHE_TTL_DAYS = toPositiveInt(process.env.SEARCH_CACHE_TTL_DAYS, DEFAULT_TTL_DAYS);
const CACHE_TTL_MS = CACHE_TTL_DAYS * DAY_MS;
const CACHE_MAX_BYTES = toPositiveInt(process.env.SEARCH_CACHE_MAX_BYTES, DEFAULT_MAX_BYTES);
const CACHE_MAX_RESULTS = toPositiveInt(process.env.SEARCH_CACHE_MAX_RESULTS, DEFAULT_MAX_RESULTS);
const CACHE_MAX_DOC_BYTES = toPositiveInt(process.env.SEARCH_CACHE_MAX_DOC_BYTES, DEFAULT_MAX_DOC_BYTES);

const normalizeText = (value) => String(value || '')
  .normalize('NFKC')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ');

const normalizeKeywords = (keywords) => {
  const list = Array.isArray(keywords) ? keywords : [];
  return [...new Set(list.map(normalizeText).filter(Boolean))].sort();
};

const normalizeCount = (count) => {
  const parsed = Number.parseInt(count, 10);
  if (!Number.isFinite(parsed)) return 25;
  return Math.min(100, Math.max(10, parsed));
};

const isDbReady = () => mongoose.connection.readyState === 1;

const addCacheMeta = (data, cached) => ({
  ...data,
  isCached: true,
  cache: {
    hit: true,
    storage: 'mongo',
    ttlDays: CACHE_TTL_DAYS,
    cachedAt: cached.createdAt,
    expiresAt: cached.expiresAt,
    searchCount: (cached.searchCount || 0) + 1
  }
});

const fromLegacyCache = (cached) => {
  if (!cached?.results) return null;
  return {
    totalFound: cached.totalFound || 0,
    analyzedCount: cached.analyzedCount || 0,
    results: cached.results || [],
    sourceBreakdown: cached.sourceBreakdown || {},
    totalFromAPIs: cached.totalFromAPIs || {}
  };
};

const byteLength = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

const prepareCacheData = (data) => {
  if (!data || !Array.isArray(data.results) || data.results.length === 0 || data.demoMode) {
    return null;
  }

  const clean = { ...data, isCached: false };
  delete clean.cache;
  delete clean._id;
  delete clean.query;
  delete clean.cacheKey;
  delete clean.createdAt;
  delete clean.updatedAt;

  clean.results = clean.results.slice(0, CACHE_MAX_RESULTS);

  while (byteLength(clean) > CACHE_MAX_DOC_BYTES && clean.results.length > 5) {
    clean.results = clean.results.slice(0, Math.ceil(clean.results.length * 0.75));
  }

  return byteLength(clean) <= CACHE_MAX_DOC_BYTES ? clean : null;
};

export const getSearchCacheConfig = () => ({
  ttlDays: CACHE_TTL_DAYS,
  maxBytes: CACHE_MAX_BYTES,
  maxResults: CACHE_MAX_RESULTS,
  maxDocumentBytes: CACHE_MAX_DOC_BYTES
});

export const buildSearchCacheFingerprint = (params) => {
  const normalizedParams = {
    cacheVersion: SEARCH_CACHE_VERSION,
    mainTopic: normalizeText(params.mainTopic),
    aiQuery: normalizeText(params.aiQuery),
    authorName: normalizeText(params.authorName),
    language: normalizeText(params.language),
    keywords: normalizeKeywords(params.keywords),
    count: normalizeCount(params.count)
  };

  const serialized = JSON.stringify(normalizedParams);
  const digest = crypto.createHash('sha256').update(serialized).digest('hex');
  const displayParts = [
    normalizedParams.aiQuery || normalizedParams.mainTopic,
    normalizedParams.authorName ? `author:${normalizedParams.authorName}` : '',
    normalizedParams.keywords.length ? `keywords:${normalizedParams.keywords.join(',')}` : '',
    normalizedParams.language ? `language:${normalizedParams.language}` : '',
    `count:${normalizedParams.count}`
  ].filter(Boolean);

  return {
    cacheKey: `search:${SEARCH_CACHE_VERSION}:${digest}`,
    displayQuery: displayParts.join(' | '),
    normalizedParams
  };
};

export const getSharedSearchCache = async ({ cacheKey }) => {
  if (!isDbReady()) return null;

  const cached = await SearchCache.findOne({
    $or: [{ cacheKey }, { query: cacheKey }]
  }).lean();

  if (!cached) return null;

  const now = new Date();
  if (cached.expiresAt && cached.expiresAt <= now) {
    await SearchCache.deleteOne({ _id: cached._id });
    return null;
  }

  const cachedData = cached.data || fromLegacyCache(cached);
  if (!cachedData) return null;

  await SearchCache.updateOne(
    { _id: cached._id },
    { $inc: { searchCount: 1 }, $set: { lastHitAt: now } }
  );

  return addCacheMeta(cachedData, cached);
};

export const pruneSearchCache = async () => {
  if (!isDbReady() || !CACHE_MAX_BYTES) return;

  const [stats] = await SearchCache.aggregate([
    { $group: { _id: null, totalBytes: { $sum: '$byteSize' } } }
  ]);
  let totalBytes = stats?.totalBytes || 0;
  if (totalBytes <= CACHE_MAX_BYTES) return;

  const victims = await SearchCache.find({})
    .sort({ lastHitAt: 1, createdAt: 1 })
    .select('_id byteSize')
    .limit(250)
    .lean();

  const deleteIds = [];
  for (const victim of victims) {
    deleteIds.push(victim._id);
    totalBytes -= victim.byteSize || 0;
    if (totalBytes <= CACHE_MAX_BYTES) break;
  }

  if (deleteIds.length) {
    await SearchCache.deleteMany({ _id: { $in: deleteIds } });
  }
};

export const saveSharedSearchCache = async (fingerprint, data) => {
  if (!isDbReady()) return { saved: false, reason: 'db_unavailable' };

  const cacheData = prepareCacheData(data);
  if (!cacheData) return { saved: false, reason: 'empty_or_too_large' };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);
  const byteSize = byteLength(cacheData);

  await SearchCache.findOneAndUpdate(
    { query: fingerprint.cacheKey },
    {
      $set: {
        query: fingerprint.cacheKey,
        cacheKey: fingerprint.cacheKey,
        displayQuery: fingerprint.displayQuery,
        normalizedParams: fingerprint.normalizedParams,
        data: cacheData,
        resultCount: cacheData.results.length,
        totalFound: cacheData.totalFound || 0,
        analyzedCount: cacheData.analyzedCount || 0,
        sourceBreakdown: cacheData.sourceBreakdown || {},
        totalFromAPIs: cacheData.totalFromAPIs || {},
        byteSize,
        lastHitAt: now,
        expiresAt
      },
      $setOnInsert: {
        createdAt: now,
        searchCount: 1
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await pruneSearchCache();
  return { saved: true, byteSize, expiresAt };
};
