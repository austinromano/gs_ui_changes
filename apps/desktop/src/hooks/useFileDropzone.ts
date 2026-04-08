import { useState, useCallback, type DragEvent } from 'react';

const AUDIO_EXTENSIONS = /\.(wav|mp3|flac|aiff|ogg|m4a|aac)$/i;

export function useFileDropzone(options: {
  accept?: 'audio';
  onDrop: (files: File[]) => void;
}) {
  const [isDragOver, setDragOver] = useState(false);

  const filterFiles = useCallback((files: FileList | File[]): File[] => {
    const arr = Array.from(files);
    if (options.accept === 'audio') {
      return arr.filter(f => f.type.startsWith('audio/') || AUDIO_EXTENSIONS.test(f.name));
    }
    return arr;
  }, [options.accept]);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const onDropHandler = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const filtered = filterFiles(e.dataTransfer.files);
    if (filtered.length > 0) {
      options.onDrop(filtered);
    }
  }, [filterFiles, options.onDrop]);

  const browse = useCallback((acceptAttr = 'audio/*,.wav,.mp3,.flac,.aiff,.ogg,.m4a,.aac') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = acceptAttr;
    input.onchange = () => {
      if (input.files && input.files.length > 0) {
        const filtered = filterFiles(input.files);
        if (filtered.length > 0) {
          options.onDrop(filtered);
        }
      }
    };
    input.click();
  }, [filterFiles, options.onDrop]);

  return {
    isDragOver,
    dropzoneProps: {
      onDragOver,
      onDragLeave,
      onDrop: onDropHandler,
    },
    browse,
  };
}
