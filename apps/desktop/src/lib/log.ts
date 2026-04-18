const isDev = typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV;

export function devWarn(scope: string, err: unknown) {
  if (isDev) console.warn(`[${scope}]`, err);
}

export function devError(scope: string, err: unknown) {
  if (isDev) console.error(`[${scope}]`, err);
}
