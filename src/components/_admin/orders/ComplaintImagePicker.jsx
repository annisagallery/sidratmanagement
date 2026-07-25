'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { FiPaperclip, FiX } from 'react-icons/fi';

const createFileId = () =>
  globalThis.crypto?.randomUUID?.() || `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function ComplaintImagePicker({ files, setFiles, disabled = false, compact = false }) {
  const inputRef = useRef(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => () => filesRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  const addFiles = (event) => {
    const selected = Array.from(event.target.files || []).slice(0, Math.max(0, 10 - files.length));
    setFiles((current) => [
      ...current,
      ...selected.map((file) => ({
        id: createFileId(),
        file,
        preview: URL.createObjectURL(file)
      }))
    ]);
    event.target.value = '';
  };

  const remove = (id) =>
    setFiles((current) => {
      const target = current.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.id !== id);
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {files.map((item) => (
          <div
            key={item.id}
            className={`group relative overflow-hidden border border-gray-200 bg-gray-50 ${compact ? 'h-14 w-14 rounded-md' : 'h-20 w-20 rounded-md'}`}
          >
            <Image src={item.preview} alt={item.file.name} fill className="object-cover" />
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-md bg-black/70 text-white shadow-sm transition hover:bg-black"
              aria-label={`Remove ${item.file.name}`}
            >
              <FiX size={13} />
            </button>
          </div>
        ))}
        {files.length < 10 && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className={
              compact
                ? 'inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3.5 text-sm font-medium text-gray-600 shadow-sm transition hover:border-[var(--brand-ring)] hover:text-[var(--brand-strong)] disabled:opacity-40'
                : 'h-20 w-20 rounded-md border-2 border-dashed border-gray-200 text-xs font-semibold text-gray-400 transition hover:border-[var(--brand-ring)] hover:text-[var(--brand-strong)] disabled:opacity-40'
            }
          >
            {compact ? (
              <>
                <FiPaperclip size={16} />
                <span>Attach</span>
                <span className="text-gray-400">{files.length}/10</span>
              </>
            ) : (
              '+ Photo'
            )}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />
      {!compact && <p className="text-xs text-gray-400">Private attachments · up to 10 images</p>}
    </div>
  );
}
