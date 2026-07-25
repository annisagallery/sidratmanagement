import React, { useCallback } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import PropTypes from 'prop-types';

PaginationRounded.propTypes = {
  data: PropTypes.shape({
    count: PropTypes.number
  })
};

export default function PaginationRounded({ ...props }) {
  const { data } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = searchParams.get('page');
  const [state, setstate] = React.useState(1);

  const createQueryString = useCallback(
    (name, value) => {
      const params = new URLSearchParams(searchParams);
      params.set(name, value);

      return params.toString();
    },
    [searchParams]
  );

  const handleChange = (event, value) => {
    setstate(value);
    router.push(`${pathname}?${createQueryString('page', value)}`);
  };

  React.useEffect(() => {
    if (page) {
      setstate(Number(page));
    }
  }, [page]);

  const pageCount = Boolean(data?.count) ? data?.count : 1;

  return (
    <div className="flex justify-center space-x-4 my-4">
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
        <button
          key={pageNum}
          className={`btn btn-outline ${state === pageNum ? 'btn-active' : ''}`}
          onClick={() => handleChange(null, pageNum)}
        >
          {pageNum}
        </button>
      ))}
    </div>
  );
}
