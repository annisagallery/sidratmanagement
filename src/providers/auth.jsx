'use client';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import Swal from 'sweetalert2';

import useAdminUserStore from 'src/stores/userStore';
import Loading from 'src/components/loading';
import * as api from 'src/services';

export default function AuthProvider({ children }) {
  const router = useRouter();
  const { isAuthenticated, user, logout, _hasHydrated } = useAdminUserStore();
  const [loading, setLoading] = useState(true);
  const accountKey = user?._id || user?.id || user?.email || 'unknown';
  const { isSuccess, isError } = useQuery(
    ['admin-panel-access', accountKey],
    api.getMyAbility,
    {
      enabled: _hasHydrated && isAuthenticated,
      retry: false,
      staleTime: 0,
      refetchOnMount: 'always'
    }
  );

  useEffect(() => {
    if (!_hasHydrated) return;

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    // /admin/me is protected by the backend's live AdminPanel ability check.
    // This supports Prisma's `super_admin` enum and permission-bearing custom
    // roles without trusting a stale role string stored in the browser.
    if (isSuccess) {
      setLoading(false);
    } else if (isError) {
      logout();
      Swal.fire("You're not allowed to access the dashboard", '', 'error');
      router.push('/auth/login');
    }
  }, [isAuthenticated, isSuccess, isError, _hasHydrated, logout, router]);

  if (loading) return <Loading />;
  return children;
}

AuthProvider.propTypes = { children: PropTypes.node.isRequired };
