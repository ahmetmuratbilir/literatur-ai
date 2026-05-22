import { generateAcademicText } from './aiService.js';

let generationAdapter = generateAcademicText;

function toText(chunk) {
  if (typeof chunk === 'string') return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString('utf-8');
  return String(chunk ?? '');
}

export async function streamAcademicTextWithBridge({
  safePapers,
  prompt,
  outputType,
  tone,
  length,
  language,
  bibliographyFormat = 'APA 7',
  req,
  onToken,
}) {
  let generatedText = '';
  let bridgeError = null;
  let doneSeen = false;
  let doneEventCount = 0;
  let provider = 'unknown';
  let buffer = '';
  let ended = false;

  const safeReq = req && typeof req.on === 'function'
    ? req
    : { closed: false, on() {} };

  const parseSse = (raw) => {
    buffer += raw;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;

      const jsonText = trimmed.slice(6);
      try {
        const payload = JSON.parse(jsonText);
        if (payload.token) {
          generatedText += payload.token;
          if (typeof onToken === 'function') onToken(payload.token);
        } else if (payload.done) {
          doneSeen = true;
          doneEventCount += 1;
        } else if (payload.provider) {
          provider = String(payload.provider);
        } else if (payload.meta?.provider) {
          provider = String(payload.meta.provider);
        } else if (payload.error) {
          bridgeError = new Error(String(payload.error));
        }
      } catch {
        // Ignore malformed chunks from legacy stream boundaries.
      }
    }
  };

  const fakeRes = {
    write(chunk) {
      parseSse(toText(chunk));
      return true;
    },
    end(chunk) {
      if (chunk) parseSse(toText(chunk));
      ended = true;
      return true;
    },
  };

  await generationAdapter(
    safePapers,
    prompt,
    outputType,
    tone,
    length,
    language,
    fakeRes,
    safeReq,
    bibliographyFormat,
  );

  if (bridgeError) {
    throw bridgeError;
  }

  return {
    text: generatedText,
    doneSeen,
    doneEventCount,
    provider,
    ended,
  };
}

export function __setGenerationAdapterForTests(fn) {
  generationAdapter = typeof fn === 'function' ? fn : generateAcademicText;
}

export function __resetGenerationAdapterForTests() {
  generationAdapter = generateAcademicText;
}
