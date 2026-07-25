'use client';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next-nprogress-bar';
import useAdminUserStore from 'src/stores/userStore';
import Loading from 'src/components/loading';

Guest.propTypes = { children: PropTypes.node.isRequired };

export default function Guest({ children }) {
  const router = useRouter();
  const { isAuthenticated } = useAdminUserStore();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    } else {
      setShow(true);
    }
  }, []);

  if (!show) return <Loading />;
  return children;
}
