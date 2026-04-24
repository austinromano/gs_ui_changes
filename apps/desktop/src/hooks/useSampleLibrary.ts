import { useCallback, useEffect, useState } from 'react';
import { api, type SampleLibraryFolder, type SampleLibraryFile } from '../lib/api';
import { devWarn } from '../lib/log';

export function useSampleLibrary() {
  const [folders, setFolders] = useState<SampleLibraryFolder[]>([]);
  const [files, setFiles] = useState<SampleLibraryFile[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listSampleLibrary();
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (err) { devWarn('useSampleLibrary.fetchAll', err); }
    finally { setLoading(false); }
  }, []);

  const createFolder = useCallback(async (name: string) => {
    try {
      const folder = await api.createSampleLibraryFolder(name);
      setFolders((prev) => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)));
      return folder;
    } catch (err) { devWarn('useSampleLibrary.createFolder', err); return null; }
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    try {
      await api.deleteSampleLibraryFolder(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setFiles((prev) => prev.filter((f) => f.folderId !== id));
      window.dispatchEvent(new CustomEvent('ghost-storage-changed'));
    } catch (err) { devWarn('useSampleLibrary.deleteFolder', err); }
  }, []);

  const uploadFile = useCallback(async (file: File, folderId: string | null) => {
    try {
      const row = await api.uploadSampleLibraryFile(file, folderId);
      setFiles((prev) => [...prev, row].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      window.dispatchEvent(new CustomEvent('ghost-storage-changed'));
      return row;
    } catch (err) { devWarn('useSampleLibrary.uploadFile', err); return null; }
  }, []);

  const deleteFile = useCallback(async (id: string) => {
    try {
      await api.deleteSampleLibraryFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      window.dispatchEvent(new CustomEvent('ghost-storage-changed'));
    } catch (err) { devWarn('useSampleLibrary.deleteFile', err); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  return { folders, files, loading, fetchAll, createFolder, deleteFolder, uploadFile, deleteFile };
}
