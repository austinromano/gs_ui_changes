import { useState, useEffect } from 'react';
import type { SamplePack } from '@ghost/types';
import { api } from '../lib/api';

export type { SamplePack };

export function useSamplePacks() {
  const [packs, setPacks] = useState<SamplePack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<(SamplePack & { items?: any[] }) | null>(null);

  const fetchPacks = async () => {
    try {
      const result = await api.listSamplePacks();
      setPacks(result.map((p: any) => ({ id: p.id, name: p.name, samples: [], updatedAt: p.updatedAt })));
    } catch {}
  };

  const fetchDetail = async (id: string) => {
    try {
      const detail = await api.getSamplePack(id);
      setSelectedPack(detail);
    } catch {}
  };

  const createPack = async () => {
    try {
      const pack = await api.createSamplePack({ name: 'Untitled' });
      await fetchPacks();
      setSelectedPackId(pack.id);
      fetchDetail(pack.id);
      return pack;
    } catch { return null; }
  };

  const selectPack = (id: string) => {
    setSelectedPackId(id);
    fetchDetail(id);
  };

  const renamePack = async (id: string, name: string) => {
    setPacks(prev => prev.map(sp => sp.id === id ? { ...sp, name } : sp));
    setSelectedPack(prev => prev && prev.id === id ? { ...prev, name } : prev);
    try { await api.updateSamplePack(id, { name }); } catch {}
  };

  const deletePack = async (id: string) => {
    try {
      await api.deleteSamplePack(id);
      setPacks(prev => prev.filter(sp => sp.id !== id));
      if (selectedPackId === id) { setSelectedPackId(null); setSelectedPack(null); }
    } catch {}
  };

  const removeSample = async (packId: string, itemId: string) => {
    try {
      await api.removeSamplePackItem(packId, itemId);
      fetchDetail(packId);
    } catch {}
  };

  useEffect(() => { fetchPacks(); }, []);

  return {
    packs,
    selectedPackId,
    selectedPack,
    setSelectedPackId,
    createPack,
    selectPack,
    renamePack,
    deletePack,
    removeSample,
    fetchDetail,
    fetchPacks,
  };
}
