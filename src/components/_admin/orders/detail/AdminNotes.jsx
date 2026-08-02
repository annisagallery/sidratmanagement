'use client';

/**
 * Internal discussion about this order — never shown to the customer.
 *
 * It sits at the bottom of the main column rather than the sidebar because it
 * is the one block that grows without limit, and reading it is a deliberate act
 * rather than a glance.
 */

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useMutation } from 'react-query';
import { format } from 'date-fns';
import { FiImage, FiMessageSquare, FiSend, FiX } from 'react-icons/fi';

import * as api from 'src/services';
import { Section, SectionBody, errorAlert, oid, toast } from './parts';

const MAX_IMAGES = 10;

export default function AdminNotes({ orderNo, comments = [], onPosted }) {
  const [body, setBody] = useState('');
  const [files, setFiles] = useState([]);
  const fileRef = useRef(null);

  const { mutate: post, isLoading: posting } = useMutation(
    async () => {
      let imageIds = [];
      if (files.length) {
        const form = new FormData();
        files.forEach((entry) => form.append('files', entry.file));
        form.append('model', 'order-admin-comments');
        const uploaded = await api.uploadImages(form);
        imageIds = (uploaded || []).map((image) => oid(image)).filter(Boolean);
      }
      return api.addOrderAdminComment({ orderNo, body: body.trim(), imageIds });
    },
    {
      onSuccess: () => {
        files.forEach((entry) => URL.revokeObjectURL(entry.preview));
        setFiles([]);
        setBody('');
        toast('Comment added');
        onPosted();
      },
      onError: (error) => errorAlert('Could not add comment', error)
    }
  );

  const addFiles = (event) => {
    const selected = Array.from(event.target.files || []).slice(0, Math.max(0, MAX_IMAGES - files.length));
    setFiles((current) => [
      ...current,
      ...selected.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        id: `${file.name}-${file.lastModified}-${file.size}`
      }))
    ]);
    event.target.value = '';
  };

  const removeFile = (id) =>
    setFiles((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return current.filter((entry) => entry.id !== id);
    });

  return (
    <Section
      title="Internal notes"
      icon={FiMessageSquare}
      hint={comments.length ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Admins only'}
    >
      {comments.length ? (
        <ul className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">
          {comments.map((comment) => (
            <li key={oid(comment)} className="p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-bold text-slate-800">{comment.author?.name || 'Admin'}</p>
                <p className="shrink-0 text-[11px] text-slate-400">
                  {comment.createdAt ? format(new Date(comment.createdAt), 'dd MMM yyyy, hh:mm a') : ''}
                </p>
              </div>
              {comment.body ? (
                <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">{comment.body}</p>
              ) : null}
              {comment.images?.length ? (
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {comment.images.map((image) => (
                    <a
                      key={oid(image)}
                      href={image.path}
                      target="_blank"
                      rel="noreferrer"
                      className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50"
                    >
                      <Image src={image.path || '/placeholder.svg'} alt="Attachment" fill className="object-cover" />
                    </a>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <SectionBody>
          <p className="text-sm text-slate-400">No internal notes yet.</p>
        </SectionBody>
      )}

      <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 p-4">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Write a note for the team…"
          className="w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand-ring)]"
        />

        {files.length ? (
          <div className="flex flex-wrap gap-2">
            {files.map((entry) => (
              <div key={entry.id} className="group relative h-16 w-16 overflow-hidden rounded-md border border-slate-200">
                <Image src={entry.preview} alt={entry.file.name} fill className="object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(entry.id)}
                  aria-label={`Remove ${entry.file.name}`}
                  className="absolute inset-0 hidden items-center justify-center bg-slate-950/50 text-white group-hover:flex"
                >
                  <FiX />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addFiles} />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={posting || files.length >= MAX_IMAGES}
            className="btn-ghost h-9 !text-xs"
          >
            <FiImage size={14} /> Attach images
          </button>
          <button
            type="button"
            onClick={() => post()}
            disabled={posting || (!body.trim() && !files.length)}
            className="btn-brand h-9 !text-xs"
          >
            <FiSend size={14} /> {posting ? 'Posting…' : 'Post note'}
          </button>
        </div>
      </div>
    </Section>
  );
}
