import { useRef, useState, useCallback } from 'react';
import { devWarn } from '../lib/log';

export interface GiphyResult {
  id: string;
  url: string;
  preview: string;
}

interface GiphyResponseItem {
  id: string;
  images: {
    fixed_height: { url: string };
    fixed_width_small: { url: string };
  };
}

const GIPHY_KEY = (import.meta as any).env?.VITE_GIPHY_KEY || 'GlVGYHkr3WSBnllca54iNt0yFbjz7L65';
const DEBOUNCE_MS = 300;
const TRENDING_DEBOUNCE_MS = 100;

function mapGiphyResult(g: GiphyResponseItem): GiphyResult {
  return { id: g.id, url: g.images.fixed_height.url, preview: g.images.fixed_width_small.url };
}

export function useGiphy() {
  const [results, setResults] = useState<GiphyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runFetch = useCallback(async (url: string) => {
    setLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      setResults((data.data || []).map(mapGiphyResult));
    } catch (err) {
      devWarn('useGiphy.fetch', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback((query: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      timerRef.current = setTimeout(() => {
        runFetch(`https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=pg-13`);
      }, TRENDING_DEBOUNCE_MS);
      return;
    }
    timerRef.current = setTimeout(() => {
      runFetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(trimmed)}&limit=12&rating=pg-13`);
    }, DEBOUNCE_MS);
  }, [runFetch]);

  return { results, loading, search };
}
