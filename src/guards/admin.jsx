'use client';
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useRouter } from 'next-nprogress-bar';
import { useQuery } from 'react-query';
import Swal from 'sweetalert2';
import useAdminUserStore from 'src/stores/userStore';
import Loading from 'src/components/loading';
import * as api from 'src/services';

export default function AdminGuard({ children }) {
  const router = useRouter();
  const { isAuthenticated, user, login, logout } = useAdminUserStore();
  const [allowed, setAllowed] = useState(false);

  // /admin/me is itself gated by can("access", "AdminPanel") at the mount, so
  // a successful response is live proof of access — the persisted `user.role`
  // (a legacy snapshot taken when the role was last assigned) goes stale the
  // moment an admin edits that role's permissions, and previously let anyone
  // whose access had since been revoked straight into the dashboard.
  const { isSuccess, isError } = useQuery(['my-ability'], api.getMyAbility, {
    enabled: isAuthenticated,
    retry: false,
    refetchInterval: 60_000,
    onSuccess: (res) => login({ ...user, ...res.user }),
    onError: () => {
      logout();
      Swal.fire("You're not allowed to access dashboard", '', 'error');
      router.push('/auth/login');
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (isSuccess) setAllowed(true);
    if (isError) setAllowed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isSuccess, isError]);

  if (!allowed) return <Loading />;
  return children;
}

AdminGuard.propTypes = { children: PropTypes.node.isRequired };
