const isDev = process.env.NODE_ENV !== 'production';

export function devWarn(scope: string, err: unknown) {
  if (isDev) console.warn(`[${scope}]`, err);
}

export function devError(scope: string, err: unknown) {
  console.error(`[${scope}]`, err);
}
