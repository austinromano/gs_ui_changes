import { useState, useEffect } from 'react';
import type { SamplePack } from '@ghost/types';
import { api } from '../lib/api';
import { devWarn } from '../lib/log';

export type { SamplePack };

export function useSamplePacks() {
  const [packs, setPacks] = useState<SamplePack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<(SamplePack & { items?: any[] }) | null>(null);

  const fetchPacks = async () => {
    try {
      const result = await api.listSamplePacks();
      setPacks(result.map((p: any) => ({ id: p.id, name: p.name, samples: [], updatedAt: p.updatedAt })));
    } catch (err) { devWarn('useSamplePacks.fetchPacks', err); }
  };

  const fetchDetail = async (id: string) => {
    try {
      const detail = await api.getSamplePack(id);
      setSelectedPack(detail);
    } catch (err) { devWarn('useSamplePacks.fetchDetail', err); }
  };

  const createPack = async () => {
    try {
      const pack = await api.createSamplePack({ name: 'Untitled' });
      await fetchPacks();
      setSelectedPackId(pack.id);
      fetchDetail(pack.id);
      return pack;
    } catch (err) { devWarn('useSamplePacks.createPack', err); return null; }
  };

  const selectPack = (id: string) => {
    setSelectedPackId(id);
    fetchDetail(id);
  };

  const renamePack = async (id: string, name: string) => {
    setPacks(prev => prev.map(sp => sp.id === id ? { ...sp, name } : sp));
    setSelectedPack(prev => prev && prev.id === id ? { ...prev, name } : prev);
    try { await api.updateSamplePack(id, { name }); } catch (err) { devWarn('useSamplePacks.renamePack', err); }
  };

  const deletePack = async (id: string) => {
    try {
      await api.deleteSamplePack(id);
      setPacks(prev => prev.filter(sp => sp.id !== id));
      if (selectedPackId === id) { setSelectedPackId(null); setSelectedPack(null); }
    } catch (err) { devWarn('useSamplePacks.deletePack', err); }
  };

  const removeSample = async (packId: string, itemId: string) => {
    try {
      await api.removeSamplePackItem(packId, itemId);
      fetchDetail(packId);
    } catch (err) { devWarn('useSamplePacks.removeSample', err); }
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
