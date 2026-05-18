const MIN_VALID_YEAR = 1000;
const MAX_FUTURE_YEAR_OFFSET = 1;

const EMPTY_DATE_METADATA = Object.freeze({
  publicationYear: null,
  publicationDate: null,
  metadataYear: null,
  metadataDate: null,
  dateSource: null,
  yearConfidence: 'low'
});

const CONFIDENCE_RANK = {
  low: 1,
  medium: 2,
  high: 3
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeConfidence(value) {
  return CONFIDENCE_RANK[value] ? value : 'low';
}

function isValidYear(year) {
  const numericYear = Number.parseInt(year, 10);
  const maxYear = new Date().getFullYear() + MAX_FUTURE_YEAR_OFFSET;
  return Number.isInteger(numericYear)
    && numericYear >= MIN_VALID_YEAR
    && numericYear <= maxYear;
}

function readDateParts(value) {
  if (!value) return null;

  if (Array.isArray(value)) {
    if (Array.isArray(value[0])) return value[0];
    return value;
  }

  if (isPlainObject(value)) {
    const parts = value['date-parts'] || value.dateParts;
    if (Array.isArray(parts)) {
      return Array.isArray(parts[0]) ? parts[0] : parts;
    }
  }

  return null;
}

function padDatePart(value) {
  return String(value).padStart(2, '0');
}

function dateFromParts(parts) {
  if (!Array.isArray(parts) || !isValidYear(parts[0])) return null;

  const [year, month, day] = parts;
  if (!month) return null;
  if (day) return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
  return `${year}-${padDatePart(month)}`;
}

function normalizeDateString(value) {
  const parts = readDateParts(value);
  if (parts) return dateFromParts(parts);

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?/);
  if (!isoMatch || !isValidYear(isoMatch[1])) return null;

  const [, year, month, day] = isoMatch;
  if (!month) return null;
  if (day) return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
  return `${year}-${padDatePart(month)}`;
}

export function extractYearFromDate(value) {
  if (value === null || value === undefined || value === '') return null;

  const parts = readDateParts(value);
  if (parts && isValidYear(parts[0])) return Number.parseInt(parts[0], 10);

  if (value instanceof Date) {
    const year = value.getFullYear();
    return isValidYear(year) ? year : null;
  }

  if (typeof value === 'number' && isValidYear(value)) {
    return Number.parseInt(value, 10);
  }

  if (typeof value === 'string') {
    const match = value.trim().match(/(?:^|[^\d])(\d{4})(?!\d)/);
    if (!match) return null;
    const year = Number.parseInt(match[1], 10);
    return isValidYear(year) ? year : null;
  }

  if (isPlainObject(value)) {
    const nestedDate = value.date || value.dateTime || value['date-time'] || value.timestamp;
    if (nestedDate) return extractYearFromDate(nestedDate);
  }

  return null;
}

function makeCandidate(kind, value, source, priority, yearConfidence) {
  const year = extractYearFromDate(value);
  if (!year) return null;

  return {
    kind,
    year,
    date: normalizeDateString(value),
    source,
    priority,
    yearConfidence: normalizeConfidence(yearConfidence)
  };
}

function addCandidate(candidates, rawSource, field, candidateConfig) {
  if (!Object.prototype.hasOwnProperty.call(rawSource, field)) return;

  const candidate = makeCandidate(
    candidateConfig.kind,
    rawSource[field],
    candidateConfig.source,
    candidateConfig.priority,
    candidateConfig.yearConfidence
  );

  if (candidate) candidates.push(candidate);
}

function getCandidateConfigs(sourceName) {
  const source = String(sourceName || 'Unknown').trim() || 'Unknown';
  const lowerSource = source.toLowerCase();
  const configs = [];

  const pub = (field, label, priority, yearConfidence = 'high') => {
    configs.push({
      field,
      kind: 'publication',
      source: `${source} ${label}`,
      priority,
      yearConfidence
    });
  };

  const meta = (field, label, priority = 100) => {
    configs.push({
      field,
      kind: 'metadata',
      source: `${source} ${label}`,
      priority,
      yearConfidence: 'low'
    });
  };

  if (lowerSource.includes('crossref')) {
    pub('published-print', 'published-print', 10);
    pub('published_print', 'published-print', 10);
    pub('issued', 'issued', 20, 'medium');
    pub('published-online', 'published-online', 30, 'medium');
    pub('published_online', 'published-online', 30, 'medium');
    pub('published', 'published', 35, 'medium');
    meta('indexed', 'indexed');
    meta('deposited', 'deposited');
    meta('created', 'created');
    meta('updated', 'updated');
    return configs;
  }

  if (lowerSource.includes('openalex')) {
    pub('publication_date', 'publication_date', 10);
    pub('publicationDate', 'publication_date', 10);
    pub('publication_year', 'publication_year', 20);
    pub('publicationYear', 'publication_year', 20);
    meta('updated_date', 'updated_date');
    meta('updatedDate', 'updated_date');
    meta('created_date', 'created_date');
    meta('createdDate', 'created_date');
    meta('updated', 'updated');
    meta('created', 'created');
    return configs;
  }

  if (lowerSource.includes('semantic')) {
    pub('publicationDate', 'publicationDate', 10);
    pub('publication_date', 'publicationDate', 10);
    pub('year', 'year', 30, 'medium');
    meta('updated', 'updated');
    meta('created', 'created');
    return configs;
  }

  if (lowerSource.includes('core')) {
    pub('publishedDate', 'publishedDate', 10);
    pub('published_date', 'publishedDate', 10);
    pub('yearPublished', 'yearPublished', 30, 'medium');
    pub('year', 'year', 40, 'medium');
    meta('updatedDate', 'updatedDate');
    meta('updated_date', 'updatedDate');
    meta('createdDate', 'createdDate');
    meta('created_date', 'createdDate');
    return configs;
  }

  if (lowerSource.includes('arxiv')) {
    pub('published', 'published', 10);
    meta('updated', 'updated');
    return configs;
  }

  if (
    lowerSource.includes('scopus')
    || lowerSource.includes('elsevier')
  ) {
    pub('prism:coverDate', 'prism:coverDate', 10);
    pub('coverDate', 'coverDate', 10);
    pub('publicationDate', 'publicationDate', 15);
    pub('publication_date', 'publicationDate', 15);
    pub('pubYear', 'pubYear', 30, 'medium');
    pub('year', 'year', 40, 'medium');
    meta('updated', 'updated');
    meta('updatedDate', 'updatedDate');
    meta('updated_date', 'updated_date');
    meta('created', 'created');
    meta('createdDate', 'createdDate');
    meta('created_date', 'created_date');
    return configs;
  }

  pub('publication_date', 'publication_date', 10);
  pub('publicationDate', 'publication_date', 10);
  pub('published-print', 'published-print', 10);
  pub('published_print', 'published-print', 10);
  pub('prism:coverDate', 'prism:coverDate', 10);
  pub('coverDate', 'coverDate', 10);
  pub('published-online', 'published-online', 20);
  pub('published_online', 'published-online', 20);
  pub('issued', 'issued', 30);
  pub('published', 'published', 35);
  pub('publication_year', 'publication_year', 40);
  pub('publicationYear', 'publication_year', 40);
  pub('pubYear', 'pubYear', 50, 'medium');
  pub('yearPublished', 'yearPublished', 50, 'medium');
  pub('year', 'year', 60, 'medium');
  meta('updated_date', 'updated_date');
  meta('updatedDate', 'updatedDate');
  meta('updated', 'updated');
  meta('created_date', 'created_date');
  meta('createdDate', 'createdDate');
  meta('created', 'created');
  meta('deposited', 'deposited');
  meta('indexed', 'indexed');
  return configs;
}

function comparePublicationCandidates(a, b) {
  const confidenceDelta = CONFIDENCE_RANK[b.yearConfidence] - CONFIDENCE_RANK[a.yearConfidence];
  if (confidenceDelta !== 0) return confidenceDelta;
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (Boolean(b.date) !== Boolean(a.date)) return b.date ? 1 : -1;
  return 0;
}

function compareMetadataCandidates(a, b) {
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.year !== b.year) return b.year - a.year;
  if (Boolean(b.date) !== Boolean(a.date)) return b.date ? 1 : -1;
  return 0;
}

export function chooseBestPublicationDate(candidates) {
  const safeCandidates = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
  const publicationCandidates = safeCandidates
    .filter(candidate => candidate.kind === 'publication')
    .sort(comparePublicationCandidates);
  const metadataCandidates = safeCandidates
    .filter(candidate => candidate.kind === 'metadata')
    .sort(compareMetadataCandidates);

  const bestPublication = publicationCandidates[0] || null;
  const bestMetadata = metadataCandidates[0] || null;

  if (!bestPublication && !bestMetadata) {
    return { ...EMPTY_DATE_METADATA };
  }

  return {
    publicationYear: bestPublication?.year ?? null,
    publicationDate: bestPublication?.date ?? null,
    metadataYear: bestMetadata?.year ?? null,
    metadataDate: bestMetadata?.date ?? null,
    dateSource: (bestPublication || bestMetadata)?.source ?? null,
    yearConfidence: bestPublication?.yearConfidence ?? 'low'
  };
}

export function normalizePublicationDate(rawSource, sourceName = 'Unknown') {
  if (!isPlainObject(rawSource)) {
    return { ...EMPTY_DATE_METADATA };
  }

  const candidates = [];
  for (const config of getCandidateConfigs(sourceName)) {
    addCandidate(candidates, rawSource, config.field, config);
  }

  return chooseBestPublicationDate(candidates);
}

function normalizedMetadataToCandidates(dateMetadata, sourcePrefix) {
  if (!isPlainObject(dateMetadata)) return [];

  const source = dateMetadata.dateSource || sourcePrefix;
  const candidates = [];

  if (dateMetadata.publicationYear) {
    candidates.push({
      kind: 'publication',
      year: dateMetadata.publicationYear,
      date: dateMetadata.publicationDate || null,
      source,
      priority: dateMetadata.yearConfidence === 'high' ? 10 : 50,
      yearConfidence: normalizeConfidence(dateMetadata.yearConfidence)
    });
  }

  if (dateMetadata.metadataYear) {
    candidates.push({
      kind: 'metadata',
      year: dateMetadata.metadataYear,
      date: dateMetadata.metadataDate || null,
      source: dateMetadata.publicationYear ? `${sourcePrefix} metadata` : source,
      priority: 100,
      yearConfidence: 'low'
    });
  }

  return candidates;
}

export function mergeDateMetadata(existing, incoming) {
  const candidates = [
    ...normalizedMetadataToCandidates(existing, 'existing'),
    ...normalizedMetadataToCandidates(incoming, 'incoming')
  ];

  return chooseBestPublicationDate(candidates);
}
