import React from 'react';
import { useRouter } from 'next-nprogress-bar';
import PropTypes from 'prop-types';
import { LuLogOut } from 'react-icons/lu';
import useAdminUserStore from 'src/stores/userStore';
import * as api from 'src/services';

UserList.propTypes = {
  openUser: PropTypes.bool.isRequired,
  user: PropTypes.object.isRequired,
  setOpen: PropTypes.func.isRequired
};

export default function UserList({ ...props }) {
  const { openUser, user, setOpen } = props;
  const router = useRouter();
  const logout = useAdminUserStore((s) => s.logout);

  const onLogout = async () => {
    await api.logout().catch(() => null);
    logout();
    setOpen(false);
    setTimeout(() => {
      router.push('/auth/login');
    }, 300);
  };

  return (
    <>
      <div className="">
        <p className="text-lg font-semibold text-gray-900 truncate">{user?.name}</p>
        <p className="text-sm text-gray-500 truncate pb-2">{user?.email}</p>
      </div>
      <hr className="my-2 border-gray-200" />

      <div className="mt-4">
        <button
          onClick={onLogout}
          className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex items-center justify-center"
        >
          <LuLogOut className="mr-2" />
          Logout
        </button>
      </div>
    </>
  );
}
