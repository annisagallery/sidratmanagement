'use client';
import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { toast } from 'react-toastify';
import { FiEye, FiEyeOff, FiTrash2, FiPlus } from 'react-icons/fi';
import { MdDragIndicator } from 'react-icons/md';
import {
  getHomepageSectionsAdmin,
  createHomepageSection,
  updateHomepageSection,
  deleteHomepageSection,
  reorderHomepageSections,
  getCampaignsByAdmin
} from 'src/services';

const SECTION_TYPES = [
  { value: 'banners', label: 'Hero Banners', color: 'bg-blue-100 text-blue-700', hasLink: false },
  { value: 'categories', label: 'Categories', color: 'bg-purple-100 text-purple-700', hasLink: false },
  { value: 'products', label: 'Products', color: 'bg-green-100 text-green-700', hasLink: true },
  { value: 'campaign', label: 'Campaign', color: 'bg-red-100 text-red-700', hasLink: false },
  { value: 'label', label: 'Label/Heading', color: 'bg-gray-100 text-gray-600', hasLink: false }
];

const LINK_PRESETS = [
  { label: 'New Arrivals', value: '?sort=date&limit=10' },
  { label: 'Best Sellers', value: '?sort=top&limit=10' },
  { label: 'Featured', value: '?featured=true&limit=10' },
  { label: 'Lowest Price', value: '?sort=price_asc&limit=10' },
  { label: 'Custom…', value: '__custom__' }
];

function typeMeta(type) {
  return SECTION_TYPES.find((t) => t.value === type) || { label: type, color: 'bg-gray-100 text-gray-600' };
}

function AddModal({ onClose, onAdd }) {
  const [type, setType] = useState('products');
  const [label, setLabel] = useState('');
  const [preset, setPreset] = useState('?sort=date&limit=10');
  const [customLink, setCustomLink] = useState('');
  const [campaignSlug, setCampaignSlug] = useState('');

  const isCustom = preset === '__custom__';
  const resolvedLink = isCustom ? customLink : preset;

  const { data: campData } = useQuery(['campaigns-for-section'], () => getCampaignsByAdmin(1, ''), {
    enabled: type === 'campaign'
  });
  const campaigns = campData?.data ?? [];

  const handleAdd = () => {
    if (type === 'campaign' && !campaignSlug) {
      toast.error('Select a campaign');
      return;
    }
    if (type === 'products' && !resolvedLink) {
      toast.error('Provide a product query link');
      return;
    }
    const meta = typeMeta(type);
    const defaultLabel =
      type === 'products'
        ? LINK_PRESETS.find((p) => p.value === preset)?.label?.replace('…', '') || 'Products'
        : meta.label;
    onAdd({
      type,
      label: label || defaultLabel,
      link: type === 'products' ? resolvedLink : '',
      campaignSlug: type === 'campaign' ? campaignSlug : null
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-md shadow-xl w-full max-w-sm p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-gray-800">Add Section</h3>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Section Type</label>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setLabel('');
            }}
            className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none"
          >
            {SECTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {type === 'products' && (
          <>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">Product Filter</label>
              <div className="grid grid-cols-2 gap-1.5">
                {LINK_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPreset(p.value)}
                    className={`text-xs px-2 py-2 rounded-md border transition-colors text-left leading-tight ${
                      preset === p.value
                        ? 'border-yellow-500 bg-yellow-50 text-yellow-700 font-semibold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {isCustom ? (
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Custom Query String</label>
                <input
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  placeholder="?category=dresses&sort=top&limit=10"
                  className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  sort: date · top · price_asc · price_desc · name &nbsp;|&nbsp; category=slug &nbsp;|&nbsp;
                  featured=true
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-gray-400 bg-gray-50 rounded-md px-2 py-1.5 font-mono">{resolvedLink}</p>
            )}
          </>
        )}

        {type === 'campaign' && (
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Campaign *</label>
            <select
              value={campaignSlug}
              onChange={(e) => setCampaignSlug(e.target.value)}
              className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none"
            >
              <option value="">— Select campaign —</option>
              {campaigns.map((c) => (
                <option key={c._id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Section Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={typeMeta(type).label}
            className="border border-gray-200 rounded-md px-3 py-2 w-full text-sm focus:outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 rounded-md py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md py-2 text-sm font-semibold"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SectionsManager() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  // Drag tracking — use a ref so onDragOver always sees the latest array
  const dragIdx = useRef(null);
  const orderRef = useRef([]);

  // Local display state (drives renders)
  const [displaySections, setDisplaySections] = useState([]);

  const { data, isLoading } = useQuery(['admin-homepage-sections'], getHomepageSectionsAdmin);

  // Sync from server whenever data arrives (initial load or after mutations)
  useEffect(() => {
    if (data?.data) {
      setDisplaySections(data.data);
      orderRef.current = data.data;
    }
  }, [data]);

  const toggleMut = useMutation(({ id, isVisible }) => updateHomepageSection(id, { isVisible }), {
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries('admin-homepage-sections');
    },
    onError: () => toast.error('Failed to update')
  });

  const deleteMut = useMutation(deleteHomepageSection, {
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries('admin-homepage-sections');
    },
    onError: () => toast.error('Failed to delete')
  });

  const addMut = useMutation(createHomepageSection, {
    onSuccess: () => {
      toast.success('Section added');
      qc.invalidateQueries('admin-homepage-sections');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to add')
  });

  const reorderMut = useMutation(reorderHomepageSections, {
    onError: () => {
      toast.error('Reorder failed');
      // Revert to server data
      if (data?.data) {
        setDisplaySections(data.data);
        orderRef.current = data.data;
      }
    }
  });

  // ── Drag handlers ────────────────────────────────────────────────────────
  const onDragStart = (idx) => {
    dragIdx.current = idx;
  };

  const onDragOver = (e, idx) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;

    // Mutate the ref array synchronously (no stale closure)
    const next = [...orderRef.current];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    orderRef.current = next;

    // Trigger re-render with updated order
    setDisplaySections([...next]);
  };

  const onDragEnd = () => {
    dragIdx.current = null;
    // Send the current ref order (guaranteed up-to-date)
    reorderMut.mutate(orderRef.current.map((s) => s._id));
  };

  const handleToggle = (s) => {
    const next = !s.isVisible;
    // Optimistic UI
    const updated = orderRef.current.map((x) => (x._id === s._id ? { ...x, isVisible: next } : x));
    orderRef.current = updated;
    setDisplaySections([...updated]);
    toggleMut.mutate({ id: s._id, isVisible: next });
  };

  const handleDelete = (s) => {
    if (!confirm(`Remove "${s.label}" section?`)) return;
    deleteMut.mutate(s._id);
  };

  if (isLoading && displaySections.length === 0) {
    return <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Loading sections…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Drag to reorder. Toggle to show/hide.</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-semibold"
        >
          <FiPlus /> Add Section
        </button>
      </div>

      <div className="space-y-2">
        {displaySections.map((s, idx) => {
          const meta = typeMeta(s.type);
          return (
            <div
              key={s._id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-3 bg-white border rounded-md px-4 py-3 shadow-sm select-none cursor-grab active:cursor-grabbing transition-opacity ${
                !s.isVisible ? 'opacity-50' : ''
              }`}
            >
              <span className="text-gray-300 shrink-0">
                <MdDragIndicator size={20} />
              </span>

              <span className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                {idx + 1}
              </span>

              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md shrink-0 ${meta.color}`}>
                {meta.label}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{s.label}</p>
                {s.link && <p className="text-[10px] text-gray-400 font-mono truncate">{s.link}</p>}
                {s.campaignSlug && <p className="text-xs text-gray-400 truncate">Campaign: {s.campaignSlug}</p>}
              </div>

              <button
                onClick={() => handleToggle(s)}
                className={`p-2 rounded-md transition-colors ${
                  s.isVisible ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-50'
                }`}
              >
                {s.isVisible ? <FiEye size={16} /> : <FiEyeOff size={16} />}
              </button>

              <button
                onClick={() => handleDelete(s)}
                className="p-2 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          );
        })}

        {displaySections.length === 0 && (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-md">
            No sections yet. Add one above.
          </div>
        )}
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdd={(payload) => addMut.mutate(payload)} />}
    </div>
  );
}
