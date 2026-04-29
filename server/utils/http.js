import { fetch } from 'undici';

export async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function withTimeout(promise, timeoutMs, timeoutMessage) {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

export function maskUrlSecret(url, secretParamNames = ['api_key']) {
  try {
    const safeUrl = new URL(url);
    for (const paramName of secretParamNames) {
      if (safeUrl.searchParams.has(paramName)) {
        safeUrl.searchParams.set(paramName, '***');
      }
    }
    return safeUrl.toString();
  } catch {
    return String(url);
  }
}
