'use client';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next-nprogress-bar';
import useAdminUserStore from 'src/stores/userStore';
import Loading from 'src/components/loading';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const { isAuthenticated } = useAdminUserStore();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setAllowed(true);
    } else {
      router.push('/auth/login');
    }
  }, []);

  if (!allowed) return <Loading />;
  return children;
}

AuthGuard.propTypes = { children: PropTypes.node.isRequired };
