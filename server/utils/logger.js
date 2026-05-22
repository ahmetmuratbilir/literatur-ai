function write(level, payload = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    ...payload,
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info(payload) {
    write('info', payload);
  },
  warn(payload) {
    write('warn', payload);
  },
  error(payload) {
    write('error', payload);
  },
};

