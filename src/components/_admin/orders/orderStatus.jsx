'use client';
import * as React from 'react';
import { useRouter } from 'next-nprogress-bar';
import { toast } from 'react-toastify';
import PropTypes from 'prop-types';
import { IoIosArrowDown } from 'react-icons/io';
import * as api from 'src/services';
import { useMutation } from 'react-query';

const STATUSES = ['pending', 'on the way', 'delivered', 'returned', 'canceled'];

SelectOrderStatus.propTypes = { data: PropTypes.object.isRequired };

export default function SelectOrderStatus({ data }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const ref = React.useRef(null);

  const { mutate, isLoading } = useMutation(api.updateOrderStatus, {
    onSuccess: (res) => { toast.success(res.message); router.push('/orders'); },
    onError: () => toast.error('Something went wrong!'),
  });

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (status) => {
    setOpen(false);
    setSelected(status);
    if (status !== selected) mutate({ id: data?._id, status });
  };

  const label = selected || data?.status || 'Loading';

  return (
    <div ref={ref} className="relative ml-2">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={isLoading || !data}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed capitalize transition-colors"
      >
        {isLoading ? (
          <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-md animate-spin" />
        ) : null}
        {label}
        <IoIosArrowDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50 overflow-hidden">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              className={`w-full text-left px-4 py-2 text-sm capitalize hover:bg-gray-50 transition-colors ${s === (selected || data?.status) ? 'font-semibold text-gray-900 bg-gray-50' : 'text-gray-700'}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
