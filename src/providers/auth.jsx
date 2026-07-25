'use client';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next-nprogress-bar';
import Swal from 'sweetalert2';

import useAdminUserStore from 'src/stores/userStore';
import Loading from 'src/components/loading';

export default function AuthProvider({ children }) {
  const router = useRouter();
  const { isAuthenticated, user, logout, _hasHydrated } = useAdminUserStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!_hasHydrated) return;

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (user?.role === 'super admin' || user?.role === 'admin') {
      setLoading(false);
    } else {
      logout();
      Swal.fire("You're not allowed to access the dashboard", '', 'error');
      router.push('/auth/login');
    }
  }, [isAuthenticated, user, _hasHydrated, logout, router]);

  if (loading) return <Loading />;
  return children;
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };
