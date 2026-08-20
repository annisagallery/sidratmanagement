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
  FiCopy,
  FiClipboard,
  FiDroplet,
  FiSearch,
  FiAlertTriangle,
  FiSettings,
  FiChevronRight
} from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import Link from 'next/link';
import { useSiteSettings } from 'src/context/SiteSettingsContext';
import {
  getHomepageSectionsAdmin,
  createHomepageSection,
  updateHomepageSection,
  deleteHomepageSection,
  reorderHomepageSections
} from 'src/services';
import {
  BLOCKS,
  BLOCK_GROUPS,
  COLUMN_PRESETS,
  blocksInGroup,
  getBlock,
  resolveBlockKey,
  defaultConfigFor,
  WIDGET_BLOCKS
} from './blocks';
import BlockSettings from './BlockSettings';

// The storefront renders the canvas. Editing chrome (hover outlines, per-block
// toolbars, insert points) lives there and talks back over postMessage, which
// is what makes the preview an editor rather than a picture.
//
// Which storefront, though, is a deployment fact, not a build-time one. It is
// read from Settings -> Branding first so a live admin can be pointed at a live
// storefront without rebuilding; the env vars stay as a fallback for local work.
const ENV_STOREFRONT = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || '').replace(
  /\/+$/,
  ''
);

const isLocal = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin || '');

/**
 * Works out which storefront to frame, and says so when it cannot.
 *
 * The failure this guards against is specific: an admin served over HTTPS whose
 * build never received NEXT_PUBLIC_SITE_URL used to fall back to
 * http://localhost:3000 and frame the operator's own machine — a preview that
 * is blank for everyone but the developer who wrote it.
 */
function useStorefrontOrigin() {
  const { storefrontUrl } = useSiteSettings();
  const [adminIsLocal, setAdminIsLocal] = useState(true);

  useEffect(() => {
    setAdminIsLocal(isLocal(window.location.origin));
  }, []);

  return useMemo(() => {
    const configured = String(storefrontUrl || '').replace(/\/+$/, '') || ENV_STOREFRONT;

    if (configured && !(isLocal(configured) && !adminIsLocal)) {
      return { origin: configured, problem: null };
    }
    if (adminIsLocal) return { origin: configured || 'http://localhost:3000', problem: null };

    return {
      origin: '',
      problem: configured
        ? 'The storefront address is set to a localhost URL, which only exists on a developer machine.'
        : 'No storefront address is configured, so there is nothing to preview.'
    };
  }, [storefrontUrl, adminIsLocal]);
}

const DEVICES = {
  desktop: { label: 'Desktop', width: '100%', icon: FiMonitor },
  tablet: { label: 'Tablet', width: '820px', icon: FiTablet },
  mobile: { label: 'Mobile', width: '390px', icon: FiSmartphone }
};

// ── Selection paths ──────────────────────────────────────────────────────────
// A selection is either a whole section ("<id>") or one widget nested in a
// container column ("<id>::<column>::<index>"). Encoding it as a string keeps
// the postMessage protocol a single scalar, which the canvas already speaks.

const encodePath = (id, col, idx) => (col === null || col === undefined ? String(id) : `${id}::${col}::${idx}`);

function parsePath(selection) {
  const [id, col, idx] = String(selection || '').split('::');
  if (col === undefined) return { id, col: null, idx: null };
  return { id, col: Number(col), idx: Number(idx) };
}

const columnsOf = (config) => (Array.isArray(config?.columns) ? config.columns : []);

const childAt = (config, col, idx) => columnsOf(config)[col]?.children?.[idx] || null;

/** Replaces one nested widget's config, returning a new section config. */
function withChildConfig(config, col, idx, nextChildConfig) {
  const columns = columnsOf(config).map((column, ci) => {
    if (ci !== col) return column;
    const children = (column.children || []).map((child, i) =>
      i === idx ? { ...child, config: nextChildConfig } : child
    );
    return { ...column, children };
  });
  return { ...config, columns };
}

/** Applies `fn` to one column's children array. */
function withChildren(config, col, fn) {
  const columns = columnsOf(config).map((column, ci) =>
    ci === col ? { ...column, children: fn(column.children || []) } : column
  );
  return { ...config, columns };
}

const newWidgetId = () =>
  `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

// ── Block picker ─────────────────────────────────────────────────────────────

function AddBlockModal({ onClose, onAdd, existingTypes, target }) {
  const [query, setQuery] = useState('');
  const widgetsOnly = target?.mode === 'widget';

  const groups = widgetsOnly ? ['Elements'] : BLOCK_GROUPS;
  const term = query.trim().toLowerCase();

  const matches = (block) =>
    !term || block.label.toLowerCase().includes(term) || block.description.toLowerCase().includes(term);

  const listFor = (group) =>
    (widgetsOnly ? WIDGET_BLOCKS : blocksInGroup(group)).filter((b) => (widgetsOnly ? true : b.group === group)).filter(matches);

  const anything = groups.some((g) => listFor(g).length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-md bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="font-bold text-gray-800">
            {widgetsOnly ? `Add an element to column ${target.col + 1}` : 'Add a block'}
            {!widgetsOnly && typeof target?.index === 'number' ? ` at position ${target.index + 1}` : ''}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="border-b border-gray-100 px-5 py-2">
          <div className="flex items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1.5">
            <FiSearch size={14} className="text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks…"
              className="w-full text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          {groups.map((group) => {
            const list = listFor(group);
            if (list.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{group}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((block) => {
                    const taken = block.singleton && existingTypes.includes(block.key);
                    return (
                      <button
                        key={block.key}
                        disabled={taken}
                        onClick={() => {
                          onAdd(block.key);
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
            );
          })}
          {!anything && <p className="py-8 text-center text-xs text-gray-400">Nothing matches “{query}”.</p>}
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
  const { origin: STOREFRONT_URL, problem: originProblem } = useStorefrontOrigin();

  const [sections, setSections] = useState([]);
  const [selection, setSelection] = useState(null); // encoded path, see above
  const [addTarget, setAddTarget] = useState(null);
  const [device, setDevice] = useState('desktop');
  const [dirty, setDirty] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [clipboard, setClipboard] = useState(null); // { kind: 'block' | 'style', payload }

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
    setSelection((cur) => cur ?? (data.data[0]?.id ? String(data.data[0].id) : null));
  }, [data]);

  const path = parsePath(selection);
  const selectedSection = sections.find((s) => s.id === path.id) || null;
  const selectedChild = selectedSection && path.col !== null ? childAt(selectedSection.config, path.col, path.idx) : null;

  // What the settings panel is editing: either the section or a nested widget.
  const editing = selectedChild
    ? { type: selectedChild.type, config: selectedChild.config || {}, label: selectedChild.label }
    : selectedSection
      ? { type: selectedSection.type, config: selectedSection.config || {}, label: selectedSection.label }
      : null;
  const editingBlock = editing ? getBlock(editing.type) : null;

  // ── Preview bridge ─────────────────────────────────────────────────────────

  const previewPayload = useMemo(
    () => ({
      type: 'sidrat:preview-sections',
      selectedId: selection,
      device,
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
    [sections, selection, device]
  );

  const pushPreview = useCallback(() => {
    if (!STOREFRONT_URL) return;
    iframeRef.current?.contentWindow?.postMessage(previewPayload, STOREFRONT_URL);
  }, [previewPayload, STOREFRONT_URL]);

  useEffect(() => {
    pushPreview();
  }, [pushPreview]);

  // ── Editing ────────────────────────────────────────────────────────────────

  const patchSection = (id, patch, { history = true } = {}) => {
    if (history) snapshot();
    setSections((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty((d) => ({ ...d, [id]: true }));
  };

  /** Writes a config key on whatever is selected — section or nested widget. */
  const patchConfig = (key, value) => {
    if (!selectedSection) return;
    if (path.col !== null) {
      const nextChild = { ...(selectedChild?.config || {}), [key]: value };
      patchSection(path.id, { config: withChildConfig(selectedSection.config || {}, path.col, path.idx, nextChild) });
      return;
    }
    patchSection(path.id, { config: { ...(selectedSection.config || {}), [key]: value } });
  };

  /** The Style and Advanced panels write the whole `style` object at once. */
  const patchStyle = (nextStyle) => patchConfig('style', nextStyle);

  // Changing a container's column preset rewrites its columns while keeping
  // whatever was already inside the ones that survive.
  useEffect(() => {
    if (!selectedSection || path.col !== null) return;
    const config = selectedSection.config || {};
    if (resolveBlockKey(selectedSection.type) !== 'container') return;
    const widths = COLUMN_PRESETS[config.preset];
    if (!widths) return;
    const current = columnsOf(config);
    if (current.length === widths.length && current.every((c, i) => c.width === widths[i])) return;

    const columns = widths.map((width, i) => ({ width, children: current[i]?.children || [] }));
    // Anything in a column being removed is moved into the last survivor rather
    // than silently deleted.
    const orphans = current.slice(widths.length).flatMap((c) => c.children || []);
    if (orphans.length) columns[columns.length - 1].children = [...columns[columns.length - 1].children, ...orphans];

    patchSection(selectedSection.id, { config: { ...config, columns } }, { history: false });
    // patchSection is stable enough for this guard-railed effect; the deps that
    // matter are the preset and which section is selected.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSection?.id, selectedSection?.config?.preset]);

  // ── Actions the canvas can trigger ─────────────────────────────────────────

  const moveBlock = useCallback(
    async (selector, dir) => {
      const p = parsePath(selector);

      // A nested widget moves inside its column, not on the page.
      if (p.col !== null) {
        const section = sections.find((s) => s.id === p.id);
        if (!section) return;
        const children = columnsOf(section.config)[p.col]?.children || [];
        const target = p.idx + dir;
        if (target < 0 || target >= children.length) return;
        snapshot();
        const next = withChildren(section.config || {}, p.col, (list) => {
          const copy = [...list];
          [copy[p.idx], copy[target]] = [copy[target], copy[p.idx]];
          return copy;
        });
        setSections((cur) => cur.map((s) => (s.id === p.id ? { ...s, config: next } : s)));
        setDirty((d) => ({ ...d, [p.id]: true }));
        setSelection(encodePath(p.id, p.col, target));
        return;
      }

      const idx = sections.findIndex((s) => s.id === p.id);
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
    [sections, qc, snapshot, setSelection]
  );

  /** Drops a block onto the page, or a widget into a container column. */
  const addBlock = useCallback(
    async (type, target) => {
      const block = BLOCKS[type];
      if (!block) return;

      if (target?.mode === 'widget') {
        const section = sections.find((s) => s.id === target.sectionId);
        if (!section) return;
        snapshot();
        const widget = { id: newWidgetId(), type, config: defaultConfigFor(type) };
        const at = typeof target.index === 'number' ? target.index : Infinity;
        const next = withChildren(section.config || {}, target.col, (list) => {
          const copy = [...list];
          copy.splice(Math.min(at, copy.length), 0, widget);
          return copy;
        });
        setSections((cur) => cur.map((s) => (s.id === section.id ? { ...s, config: next } : s)));
        setDirty((d) => ({ ...d, [section.id]: true }));
        const landed = Math.min(at, (columnsOf(section.config)[target.col]?.children || []).length);
        setSelection(encodePath(section.id, target.col, landed));
        toast.success(`${block.label} added — remember to save`);
        return;
      }

      try {
        const res = await createHomepageSection({
          type,
          label: block.defaults?.heading || block.defaults?.text || block.label,
          config: defaultConfigFor(type),
          isVisible: true
        });
        const created = res?.data;
        toast.success(`${block.label} added`);

        // The API always appends; if the block was inserted mid-page, push the
        // corrected order straight after so the canvas matches where it landed.
        if (typeof target?.index === 'number' && created?.id) {
          const ids = sections.map((s) => s.id);
          ids.splice(target.index, 0, created.id);
          await reorderHomepageSections(ids).catch(() => {});
        }
        await qc.invalidateQueries('admin-homepage-sections');
        if (created?.id) setSelection(String(created.id));
      } catch (e) {
        toast.error(e.response?.data?.message || 'Could not add block');
      }
    },
    [sections, qc, snapshot, setSelection]
  );

  const duplicateBlock = useCallback(
    async (selector) => {
      const p = parsePath(selector);
      const section = sections.find((s) => s.id === p.id);
      if (!section) return;

      if (p.col !== null) {
        const child = childAt(section.config, p.col, p.idx);
        if (!child) return;
        snapshot();
        const next = withChildren(section.config || {}, p.col, (list) => {
          const copy = [...list];
          copy.splice(p.idx + 1, 0, { ...child, id: newWidgetId() });
          return copy;
        });
        setSections((cur) => cur.map((s) => (s.id === p.id ? { ...s, config: next } : s)));
        setDirty((d) => ({ ...d, [p.id]: true }));
        setSelection(encodePath(p.id, p.col, p.idx + 1));
        return;
      }

      try {
        const res = await createHomepageSection({
          type: section.type,
          label: `${section.label} copy`,
          config: section.config || {},
          link: section.link,
          campaignSlug: section.campaignSlug,
          isVisible: true
        });
        const created = res?.data;
        if (created?.id) {
          const ids = sections.map((s) => s.id);
          ids.splice(sections.findIndex((s) => s.id === p.id) + 1, 0, created.id);
          await reorderHomepageSections(ids).catch(() => {});
        }
        await qc.invalidateQueries('admin-homepage-sections');
        if (created?.id) setSelection(String(created.id));
        toast.success('Duplicated');
      } catch {
        toast.error('Could not duplicate');
      }
    },
    [sections, qc, snapshot, setSelection]
  );

  const removeBlock = useCallback(
    async (selector) => {
      const p = parsePath(selector);
      const section = sections.find((s) => s.id === p.id);
      if (!section) return;

      if (p.col !== null) {
        const child = childAt(section.config, p.col, p.idx);
        if (!child) return;
        snapshot();
        const next = withChildren(section.config || {}, p.col, (list) => list.filter((_, i) => i !== p.idx));
        setSections((cur) => cur.map((s) => (s.id === p.id ? { ...s, config: next } : s)));
        setDirty((d) => ({ ...d, [p.id]: true }));
        setSelection(String(p.id));
        return;
      }

      if (!confirm(`Remove the "${section.label}" block?`)) return;
      snapshot();
      try {
        await deleteHomepageSection(p.id);
        setSections((cur) => cur.filter((s) => s.id !== p.id));
        setSelection((cur) => (parsePath(cur).id === p.id ? null : cur));
        toast.success('Removed');
        qc.invalidateQueries('admin-homepage-sections');
      } catch {
        toast.error('Failed to remove');
      }
    },
    [sections, qc, snapshot, setSelection]
  );

  /** Moves a block from one position to another in a single step. */
  const reorderTo = useCallback(
    async (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= sections.length || to >= sections.length) return;
      snapshot();
      const next = [...sections];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
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

  /** Inline text edited straight on the canvas. */
  const applyInlineEdit = useCallback(
    (selector, key, value) => {
      const p = parsePath(selector);
      const section = sections.find((s) => s.id === p.id);
      if (!section) return;
      snapshot();
      const next =
        p.col !== null
          ? withChildConfig(section.config || {}, p.col, p.idx, {
              ...(childAt(section.config, p.col, p.idx)?.config || {}),
              [key]: value
            })
          : { ...(section.config || {}), [key]: value };
      setSections((cur) => cur.map((s) => (s.id === p.id ? { ...s, config: next } : s)));
      setDirty((d) => ({ ...d, [p.id]: true }));
    },
    [sections, snapshot]
  );

  // Messages coming back from the canvas.
  useEffect(() => {
    if (!STOREFRONT_URL) return undefined;
    const onMessage = (event) => {
      if (event.origin !== STOREFRONT_URL) return;
      const { type, id, dir, index, col, key, value, from, to } = event.data || {};
      switch (type) {
        case 'sidrat:preview-ready':
          pushPreview();
          break;
        case 'sidrat:select':
          setSelection(id);
          break;
        case 'sidrat:move':
          moveBlock(id, dir);
          break;
        case 'sidrat:reorder':
          reorderTo(from, to);
          break;
        case 'sidrat:duplicate':
          duplicateBlock(id);
          break;
        case 'sidrat:delete':
          removeBlock(id);
          break;
        case 'sidrat:insert':
          setAddTarget({ mode: 'section', index });
          break;
        case 'sidrat:insert-widget':
          setAddTarget({ mode: 'widget', sectionId: id, col, index });
          break;
        case 'sidrat:inline-edit':
          applyInlineEdit(id, key, value);
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [pushPreview, moveBlock, reorderTo, duplicateBlock, removeBlock, applyInlineEdit, STOREFRONT_URL]);

  // ── Undo / redo ────────────────────────────────────────────────────────────

  // Undo/redo only restore the in-editor draft; the change still has to be
  // saved to reach the storefront, so the dirty flags come back too.
  const applyHistory = (restored) => {
    setSections(restored);
    setDirty(Object.fromEntries(restored.map((s) => [s.id, true])));
  };

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const prev = stack[stack.length - 1];
      setRedoStack((cur) => [...cur, JSON.stringify(sections)]);
      applyHistory(JSON.parse(prev));
      return stack.slice(0, -1);
    });
  }, [sections]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((cur) => [...cur, JSON.stringify(sections)]);
      applyHistory(JSON.parse(next));
      return stack.slice(0, -1);
    });
  }, [sections]);

  // ── Saving ─────────────────────────────────────────────────────────────────

  const unsavedCount = Object.values(dirty).filter(Boolean).length;

  const saveAll = useCallback(async () => {
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
  }, [sections, dirty, qc]);

  // Losing a page's worth of styling to a stray Cmd-W is not recoverable.
  useEffect(() => {
    if (unsavedCount === 0) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsavedCount]);

  // ── Clipboard ──────────────────────────────────────────────────────────────

  const copySelection = useCallback(() => {
    if (!editing) return;
    setClipboard({ kind: 'block', payload: { type: editing.type, config: editing.config } });
    toast.info('Block copied');
  }, [editing]);

  const copyStyle = useCallback(() => {
    if (!editing) return;
    setClipboard({ kind: 'style', payload: editing.config?.style || {} });
    toast.info('Style copied');
  }, [editing]);

  const pasteStyle = useCallback(() => {
    if (!clipboard || !editing) return;
    const style = clipboard.kind === 'style' ? clipboard.payload : clipboard.payload?.config?.style;
    if (!style) return;
    patchStyle(structuredClone ? structuredClone(style) : JSON.parse(JSON.stringify(style)));
    toast.success('Style pasted');
    // patchStyle closes over the current selection, which is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipboard, editing]);

  const pasteBlock = useCallback(async () => {
    if (clipboard?.kind !== 'block') return;
    const { type, config } = clipboard.payload;
    const block = BLOCKS[resolveBlockKey(type)];
    if (!block) return;
    try {
      const res = await createHomepageSection({
        type,
        label: `${block.label} copy`,
        config,
        isVisible: true
      });
      await qc.invalidateQueries('admin-homepage-sections');
      if (res?.data?.id) setSelection(String(res.data.id));
      toast.success('Pasted');
    } catch {
      toast.error('Could not paste');
    }
  }, [clipboard, qc, setSelection]);

  const clearStyle = () => {
    if (!editing) return;
    if (!confirm('Clear every style setting on this block?')) return;
    patchStyle({});
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveAll();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (inField) return;
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        if (inField) return;
        e.preventDefault();
        redo();
        return;
      }
      if (inField) return;
      if (mod && e.key.toLowerCase() === 'c') copySelection();
      if (mod && e.key.toLowerCase() === 'v') pasteBlock();
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selection) duplicateBlock(selection);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault();
        removeBlock(selection);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveAll, undo, redo, copySelection, pasteBlock, duplicateBlock, removeBlock, selection]);

  // ── Structure list ─────────────────────────────────────────────────────────

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

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  const term = filter.trim().toLowerCase();
  const visibleSections = term
    ? sections.filter(
        (s) => s.label.toLowerCase().includes(term) || (getBlock(s.type)?.label || '').toLowerCase().includes(term)
      )
    : sections;

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
            title="Undo (Ctrl+Z)"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <FiRotateCcw size={15} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <FiRotateCw size={15} />
          </button>

          <span className="mx-1 h-5 w-px bg-gray-200" />

          <button
            onClick={copySelection}
            disabled={!editing}
            title="Copy block (Ctrl+C)"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <FiCopy size={15} />
          </button>
          <button
            onClick={pasteBlock}
            disabled={clipboard?.kind !== 'block'}
            title="Paste block (Ctrl+V)"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <FiClipboard size={15} />
          </button>
          <button
            onClick={copyStyle}
            disabled={!editing}
            title="Copy this block's style"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <FiDroplet size={15} />
          </button>
          <button
            onClick={pasteStyle}
            disabled={!clipboard || !editing}
            title="Paste style onto this block"
            className="rounded-md px-1.5 py-1 text-[10px] font-bold text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            PASTE
          </button>

          <span className="mx-1 h-5 w-px bg-gray-200" />

          {Object.entries(DEVICES).map(([key, d]) => {
            const Icon = d.icon;
            return (
              <button
                key={key}
                onClick={() => setDevice(key)}
                title={`${d.label} — also switches which screen the settings edit`}
                className={`rounded-md p-1.5 ${device === key ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}
              >
                <Icon size={15} />
              </button>
            );
          })}

          <span className="mx-1 h-5 w-px bg-gray-200" />

          {STOREFRONT_URL && (
            <a
              href={STOREFRONT_URL}
              target="_blank"
              rel="noreferrer"
              title="Open storefront"
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            >
              <FiExternalLink size={15} />
            </a>
          )}
          <button
            onClick={saveAll}
            disabled={saving || unsavedCount === 0}
            title="Save (Ctrl+S)"
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
              onClick={() => setAddTarget({ mode: 'section', index: null })}
              className="flex items-center gap-1 rounded-md bg-[#93003f] px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90"
            >
              <FiPlus size={12} /> Add
            </button>
          </div>

          <div className="border-b border-gray-100 px-2 py-1.5">
            <div className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2 py-1">
              <FiSearch size={11} className="text-gray-400" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find a block…"
                className="w-full text-[11px] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {isLoading && sections.length === 0 && <p className="py-8 text-center text-xs text-gray-400">Loading…</p>}

            {visibleSections.map((section) => {
              const idx = sections.indexOf(section);
              const block = getBlock(section.type);
              const active = path.id === section.id && path.col === null;
              const columns = columnsOf(section.config);

              return (
                <div key={section.id}>
                  <div
                    draggable
                    onDragStart={() => (dragIdx.current = idx)}
                    onDragOver={(e) => onDragOver(e, idx)}
                    onDragEnd={onDragEnd}
                    onClick={() => setSelection(String(section.id))}
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
                        duplicateBlock(String(section.id));
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
                        removeBlock(String(section.id));
                      }}
                      className="p-0.5 text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                      aria-label="Remove"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>

                  {/* A container's columns and their contents, so the tree shows
                      the same nesting the canvas does. */}
                  {columns.length > 0 && (
                    <div className="ml-4 border-l border-gray-100 pl-1.5">
                      {columns.map((column, col) => (
                        <div key={col}>
                          <div className="flex items-center justify-between py-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400">
                              Column {col + 1} · {column.width}%
                            </span>
                            <button
                              onClick={() => setAddTarget({ mode: 'widget', sectionId: section.id, col, index: null })}
                              className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-[#93003f]"
                              aria-label={`Add to column ${col + 1}`}
                            >
                              <FiPlus size={11} />
                            </button>
                          </div>
                          {(column.children || []).map((child, i) => {
                            const childBlock = getBlock(child.type);
                            const childActive = path.id === section.id && path.col === col && path.idx === i;
                            return (
                              <button
                                key={child.id || i}
                                onClick={() => setSelection(encodePath(section.id, col, i))}
                                className={`flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[10px] ${
                                  childActive ? 'bg-pink-50 font-semibold text-[#93003f]' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                              >
                                <FiChevronRight size={9} className="shrink-0 text-gray-300" />
                                <span className="truncate">
                                  {child.config?.text || child.config?.title || child.config?.label || childBlock?.label || child.type}
                                </span>
                              </button>
                            );
                          })}
                          {(column.children || []).length === 0 && (
                            <p className="px-1.5 py-1 text-[10px] italic text-gray-300">Empty</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {!isLoading && visibleSections.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-400">{term ? 'Nothing matches.' : 'No blocks yet.'}</p>
            )}
          </div>
        </div>

        {/* ── Settings ───────────────────────────────────────────────────── */}
        <div className="flex w-80 shrink-0 flex-col border-r border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
              {editing ? (selectedChild ? 'Edit element' : 'Edit block') : 'Settings'}
            </p>
            {editing && (
              <button onClick={clearStyle} className="text-[10px] font-semibold text-gray-400 hover:text-red-500">
                Reset style
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!editing ? (
              <p className="py-8 text-center text-xs text-gray-400">Click a block in the canvas to edit it.</p>
            ) : (
              <div className="space-y-4">
                {selectedChild ? (
                  <button
                    onClick={() => setSelection(String(path.id))}
                    className="text-[10px] font-semibold text-[#93003f] hover:underline"
                  >
                    ← Back to {selectedSection?.label}
                  </button>
                ) : (
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-gray-600">Block name (admin only)</label>
                    <input
                      value={selectedSection.label}
                      onChange={(e) => patchSection(selectedSection.id, { label: e.target.value })}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-[#93003f] focus:outline-none"
                    />
                  </div>
                )}

                <BlockSettings
                  block={editingBlock}
                  config={editing.config}
                  onChange={patchConfig}
                  onStyleChange={patchStyle}
                  device={device}
                  onDevice={setDevice}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Canvas ─────────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 justify-center overflow-hidden bg-gray-100 p-3">
          {STOREFRONT_URL ? (
            <iframe
              ref={iframeRef}
              title="Homepage canvas"
              src={`${STOREFRONT_URL}/?preview=1`}
              onLoad={pushPreview}
              style={{ width: DEVICES[device].width }}
              className="h-full max-w-full rounded-md border border-gray-300 bg-white shadow-sm transition-all"
            />
          ) : (
            <div className="flex max-w-md flex-col items-center justify-center gap-3 text-center">
              <FiAlertTriangle className="text-3xl text-amber-500" />
              <p className="text-sm font-bold text-gray-700">The preview is not configured</p>
              <p className="text-xs leading-relaxed text-gray-500">
                {originProblem} Blocks can still be added, edited and saved from the panels on the left — only the live
                canvas needs the storefront address.
              </p>
              <Link
                href="/site-settings/global/brand"
                className="flex items-center gap-1.5 rounded-md bg-[#93003f] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
              >
                <FiSettings size={13} /> Set the storefront address
              </Link>
            </div>
          )}
        </div>
      </div>

      {addTarget && (
        <AddBlockModal
          target={addTarget}
          onClose={() => setAddTarget(null)}
          onAdd={(type) => addBlock(type, addTarget)}
          existingTypes={sections.map((s) => resolveBlockKey(s.type))}
        />
      )}
    </div>
  );
}
