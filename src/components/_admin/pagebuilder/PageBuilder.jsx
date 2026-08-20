'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import {
  FiEye,
  FiEyeOff,
  FiTrash2,
  FiPlus,
  FiX,
  FiSave,
  FiMonitor,
  FiSmartphone,
  FiTablet,
  FiRotateCcw,
  FiRotateCw,
  FiExternalLink,
  FiLayers,
  FiCopy
} from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import {
  getHomepageSectionsAdmin,
  createHomepageSection,
  updateHomepageSection,
  deleteHomepageSection,
  reorderHomepageSections
} from 'src/services';
import { BLOCKS, BLOCK_GROUPS, blocksInGroup, getBlock, resolveBlockKey, defaultConfigFor } from './blocks';
import BlockSettings from './BlockSettings';

// The storefront renders the canvas. Editing chrome (hover outlines, per-block
// toolbars, insert points) lives there and talks back over postMessage, which
// is what makes the preview an editor rather than a picture.
const STOREFRONT_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

const DEVICES = {
  desktop: { label: 'Desktop', width: '100%', icon: FiMonitor },
  tablet: { label: 'Tablet', width: '768px', icon: FiTablet },
  mobile: { label: 'Mobile', width: '390px', icon: FiSmartphone }
};

// ── Block picker ─────────────────────────────────────────────────────────────

function AddBlockModal({ onClose, onAdd, existingTypes, atIndex }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-md bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="font-bold text-gray-800">
            Add a block{typeof atIndex === 'number' ? ` at position ${atIndex + 1}` : ''}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {BLOCK_GROUPS.map((group) => (
            <div key={group}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{group}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {blocksInGroup(group).map((block) => {
                  const taken = block.singleton && existingTypes.includes(block.key);
                  return (
                    <button
                      key={block.key}
                      disabled={taken}
                      onClick={() => {
                        onAdd(block.key, atIndex);
                        onClose();
                      }}
                      className="rounded-md border border-gray-200 p-3 text-left transition-colors hover:border-[#93003f] hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${block.color}`}>
                          {block.label}
                        </span>
                        {taken && <span className="text-[10px] text-gray-400">already added</span>}
                      </div>
                      <p className="mt-1 text-xs leading-snug text-gray-500">{block.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Builder ──────────────────────────────────────────────────────────────────

export default function PageBuilder() {
  const qc = useQueryClient();
  const iframeRef = useRef(null);
  const dragIdx = useRef(null);

  const [sections, setSections] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [addAt, setAddAt] = useState(null); // index for insert, or null when closed
  const [showAdd, setShowAdd] = useState(false);
  const [device, setDevice] = useState('desktop');
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);

  // Undo/redo over the whole layout. Snapshots are cheap here — a homepage is
  // a few dozen small objects — so the simple approach is the right one. These
  // are state rather than refs because the toolbar's enabled/disabled state is
  // rendered from them.
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const snapshot = useCallback(() => {
    const shot = JSON.stringify(sections);
    setUndoStack((cur) => [...cur, shot].slice(-50));
    setRedoStack([]);
  }, [sections]);

  const { data, isLoading } = useQuery(['admin-homepage-sections'], getHomepageSectionsAdmin);

  useEffect(() => {
    if (!data?.data) return;
    setSections(data.data);
    setSelectedId((cur) => cur ?? data.data[0]?.id ?? null);
  }, [data]);

  const selected = sections.find((s) => s.id === selectedId) || null;
  const selectedBlock = selected ? getBlock(selected.type) : null;

  // ── Preview bridge ─────────────────────────────────────────────────────────

  const previewPayload = useMemo(
    () => ({
      type: 'sidrat:preview-sections',
      selectedId,
      sections: sections
        .filter((s) => s.isVisible)
        .map((s) => ({
          id: s.id,
          type: resolveBlockKey(s.type),
          label: s.label,
          link: s.link,
          campaignSlug: s.campaignSlug,
          config: s.config || {}
        }))
    }),
    [sections, selectedId]
  );

  const pushPreview = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(previewPayload, STOREFRONT_URL);
  }, [previewPayload]);

  useEffect(() => {
    pushPreview();
  }, [pushPreview]);

  const patchLocal = (id, patch, { history = true } = {}) => {
    if (history) snapshot();
    setSections((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  // ── Actions the canvas can trigger ─────────────────────────────────────────

  const moveBlock = useCallback(
    async (id, dir) => {
      const idx = sections.findIndex((s) => s.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= sections.length) return;
      snapshot();
      const next = [...sections];
      [next[idx], next[target]] = [next[target], next[idx]];
      setSections(next);
      try {
        await reorderHomepageSections(next.map((s) => s.id));
      } catch {
        toast.error('Reorder failed');
        qc.invalidateQueries('admin-homepage-sections');
      }
    },
    [sections, qc, snapshot]
  );

  const addBlock = useCallback(
    async (type, atIndex) => {
      try {
        const block = BLOCKS[type];
        const res = await createHomepageSection({
          type,
          label: block.defaults?.heading || block.label,
          config: defaultConfigFor(type),
          isVisible: true
        });
        const created = res?.data;
        toast.success(`${block.label} added`);

        // The API always appends; if the block was inserted mid-page, push the
        // corrected order straight after so the canvas matches where it landed.
        if (typeof atIndex === 'number' && created?.id) {
          const ids = sections.map((s) => s.id);
          ids.splice(atIndex, 0, created.id);
          await reorderHomepageSections(ids).catch(() => {});
        }
        await qc.invalidateQueries('admin-homepage-sections');
        if (created?.id) setSelectedId(created.id);
      } catch (e) {
        toast.error(e.response?.data?.message || 'Could not add block');
      }
    },
    [sections, qc]
  );

  const duplicateBlock = useCallback(
    async (id) => {
      const source = sections.find((s) => s.id === id);
      if (!source) return;
      try {
        const res = await createHomepageSection({
          type: source.type,
          label: `${source.label} copy`,
          config: source.config || {},
          link: source.link,
          campaignSlug: source.campaignSlug,
          isVisible: true
        });
        const created = res?.data;
        if (created?.id) {
          const ids = sections.map((s) => s.id);
          ids.splice(sections.findIndex((s) => s.id === id) + 1, 0, created.id);
          await reorderHomepageSections(ids).catch(() => {});
        }
        await qc.invalidateQueries('admin-homepage-sections');
        if (created?.id) setSelectedId(created.id);
        toast.success('Duplicated');
      } catch {
        toast.error('Could not duplicate');
      }
    },
    [sections, qc]
  );

  const removeBlock = useCallback(
    async (id) => {
      const section = sections.find((s) => s.id === id);
      if (!section) return;
      if (!confirm(`Remove the "${section.label}" block?`)) return;
      snapshot();
      try {
        await deleteHomepageSection(id);
        setSections((cur) => cur.filter((s) => s.id !== id));
        setSelectedId((cur) => (cur === id ? null : cur));
        toast.success('Removed');
        qc.invalidateQueries('admin-homepage-sections');
      } catch {
        toast.error('Failed to remove');
      }
    },
    [sections, qc, snapshot]
  );

  // Messages coming back from the canvas.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== STOREFRONT_URL) return;
      const { type, id, dir, index } = event.data || {};
      switch (type) {
        case 'sidrat:preview-ready':
          pushPreview();
          break;
        case 'sidrat:select':
          setSelectedId(id);
          break;
        case 'sidrat:move':
          moveBlock(id, dir);
          break;
        case 'sidrat:duplicate':
          duplicateBlock(id);
          break;
        case 'sidrat:delete':
          removeBlock(id);
          break;
        case 'sidrat:insert':
          setAddAt(index);
          setShowAdd(true);
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pushPreview, moveBlock, duplicateBlock, removeBlock]);

  // ── Undo / redo ────────────────────────────────────────────────────────────

  // Undo/redo only restore the in-editor draft; the change still has to be
  // saved to reach the storefront, so the dirty flags come back too.
  const applyHistory = (restored) => {
    setSections(restored);
    setDirty(Object.fromEntries(restored.map((s) => [s.id, true])));
  };

  const undo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((cur) => cur.slice(0, -1));
    setRedoStack((cur) => [...cur, JSON.stringify(sections)]);
    applyHistory(JSON.parse(prev));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((cur) => cur.slice(0, -1));
    setUndoStack((cur) => [...cur, JSON.stringify(sections)]);
    applyHistory(JSON.parse(next));
  };

  // ── Saving ─────────────────────────────────────────────────────────────────

  const saveAll = async () => {
    const pending = sections.filter((s) => dirty[s.id]);
    if (pending.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        pending.map((s) =>
          updateHomepageSection(s.id, {
            label: s.label,
            config: s.config || {},
            link: s.config?.customQuery ?? s.link ?? '',
            campaignSlug: s.config?.campaignSlug ?? s.campaignSlug ?? null
          })
        )
      );
      setDirty({});
      toast.success(`Saved ${pending.length} block${pending.length > 1 ? 's' : ''}`);
      qc.invalidateQueries('admin-homepage-sections');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (section) => {
    const next = !section.isVisible;
    setSections((cur) => cur.map((s) => (s.id === section.id ? { ...s, isVisible: next } : s)));
    try {
      await updateHomepageSection(section.id, { isVisible: next });
    } catch {
      toast.error('Failed to update');
      qc.invalidateQueries('admin-homepage-sections');
    }
  };

  const onDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setSections((cur) => {
      const next = [...cur];
      const [moved] = next.splice(dragIdx.current, 1);
      next.splice(idx, 0, moved);
      return next;
    });
    dragIdx.current = idx;
  };

  const onDragEnd = async () => {
    dragIdx.current = null;
    try {
      await reorderHomepageSections(sections.map((s) => s.id));
    } catch {
      toast.error('Reorder failed');
      qc.invalidateQueries('admin-homepage-sections');
    }
  };

  const unsavedCount = Object.values(dirty).filter(Boolean).length;
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return (
    <div className="flex h-[calc(100vh-7rem)] w-full flex-col overflow-hidden rounded-md border border-gray-200 bg-white">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <FiLayers className="text-[#93003f]" />
          <p className="text-sm font-bold text-gray-800">Homepage Builder</p>
          {unsavedCount > 0 && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              {unsavedCount} unsaved
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <FiRotateCcw size={15} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <FiRotateCw size={15} />
          </button>

          <span className="mx-1 h-5 w-px bg-gray-200" />

          {Object.entries(DEVICES).map(([key, d]) => {
            const Icon = d.icon;
            return (
              <button
                key={key}
                onClick={() => setDevice(key)}
                title={d.label}
                className={`rounded-md p-1.5 ${device === key ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
              >
                <Icon size={15} />
              </button>
            );
          })}

          <span className="mx-1 h-5 w-px bg-gray-200" />

          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="noreferrer"
            title="Open storefront"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <FiExternalLink size={15} />
          </a>
          <button
            onClick={saveAll}
            disabled={saving || unsavedCount === 0}
            className="flex items-center gap-1.5 rounded-md bg-[#93003f] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            <FiSave size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── Left rail ──────────────────────────────────────────────────── */}
        <div className="flex w-64 shrink-0 flex-col border-r border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Structure</p>
            <button
              onClick={() => {
                setAddAt(null);
                setShowAdd(true);
              }}
              className="flex items-center gap-1 rounded-md bg-[#93003f] px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
            >
              <FiPlus size={12} /> Add
            </button>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {isLoading && sections.length === 0 && <p className="py-8 text-center text-xs text-gray-400">Loading…</p>}

            {sections.map((section, idx) => {
              const block = getBlock(section.type);
              const active = section.id === selectedId;
              return (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => (dragIdx.current = idx)}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDragEnd={onDragEnd}
                  onClick={() => setSelectedId(section.id)}
                  className={`group flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors ${
                    active ? 'border-[#93003f] bg-pink-50' : 'border-transparent hover:bg-gray-50'
                  } ${!section.isVisible ? 'opacity-50' : ''}`}
                >
                  <MdDragIndicator className="shrink-0 cursor-grab text-gray-300" size={15} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-gray-800">
                      {section.label}
                      {dirty[section.id] && <span className="ml-1 text-amber-500">•</span>}
                    </p>
                    <span
                      className={`mt-0.5 inline-block rounded px-1 py-px text-[9px] font-bold ${
                        block?.color || 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {block?.label || section.type}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateBlock(section.id);
                    }}
                    className="p-0.5 text-gray-300 opacity-0 hover:text-gray-600 group-hover:opacity-100"
                    aria-label="Duplicate"
                  >
                    <FiCopy size={13} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisible(section);
                    }}
                    className={`p-0.5 ${section.isVisible ? 'text-green-500' : 'text-gray-300'}`}
                    aria-label={section.isVisible ? 'Hide' : 'Show'}
                  >
                    {section.isVisible ? <FiEye size={13} /> : <FiEyeOff size={13} />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBlock(section.id);
                    }}
                    className="p-0.5 text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                    aria-label="Remove"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              );
            })}

            {!isLoading && sections.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-400">No blocks yet.</p>
            )}
          </div>
        </div>

        {/* ── Settings ───────────────────────────────────────────────────── */}
        <div className="flex w-80 shrink-0 flex-col border-r border-gray-200">
          <div className="border-b border-gray-100 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {selected ? 'Edit block' : 'Settings'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!selected ? (
              <p className="py-8 text-center text-xs text-gray-400">
                Click a block in the canvas to edit it.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Block name (admin only)</label>
                  <input
                    value={selected.label}
                    onChange={(e) => patchLocal(selected.id, { label: e.target.value })}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#93003f] focus:outline-none"
                  />
                </div>

                <BlockSettings
                  block={selectedBlock}
                  config={selected.config || {}}
                  onChange={(key, value) =>
                    patchLocal(selected.id, { config: { ...(selected.config || {}), [key]: value } })
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Canvas ─────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 justify-center overflow-hidden bg-gray-100 p-3">
          <iframe
            ref={iframeRef}
            title="Homepage canvas"
            src={`${STOREFRONT_URL}/?preview=1`}
            onLoad={pushPreview}
            style={{ width: DEVICES[device].width }}
            className="h-full max-w-full rounded-md border border-gray-300 bg-white shadow-sm transition-all"
          />
        </div>
      </div>

      {showAdd && (
        <AddBlockModal
          atIndex={addAt}
          onClose={() => {
            setShowAdd(false);
            setAddAt(null);
          }}
          onAdd={addBlock}
          existingTypes={sections.map((s) => resolveBlockKey(s.type))}
        />
      )}
    </div>
  );
}
