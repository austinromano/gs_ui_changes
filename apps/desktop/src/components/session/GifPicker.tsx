import { useEffect, useState } from 'react';
import { useGiphy } from '../../hooks/useGiphy';

interface Props {
  onSelect: (url: string) => void;
  onOpen?: () => void;
}

export default function GifPicker({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const { results, loading, search } = useGiphy();

  useEffect(() => { search(''); }, [search]);

  return (
    <div className="mb-2 bg-[#111214] rounded-lg border border-white/10 overflow-hidden">
      <input
        autoFocus
        className="w-full bg-transparent text-[13px] text-white placeholder:text-white/30 px-3 py-2 outline-none border-b border-white/5"
        placeholder="Search GIFs..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
      />
      <div className="grid grid-cols-3 gap-1 p-1 max-h-[200px] overflow-y-auto">
        {loading && <div className="col-span-3 text-center text-[11px] text-white/30 py-4">Loading...</div>}
        {results.map((g) => (
          <button key={g.id} onClick={() => onSelect(g.url)} className="rounded overflow-hidden hover:ring-2 hover:ring-ghost-purple transition-all">
            <img src={g.preview} alt="" className="w-full h-[70px] object-cover" loading="lazy" />
          </button>
        ))}
        {!loading && results.length === 0 && query && (
          <div className="col-span-3 text-center text-[11px] text-white/30 py-4">No results</div>
        )}
      </div>
      <div className="px-2 py-1 text-[8px] text-white/20 text-right">Powered by GIPHY</div>
    </div>
  );
}
