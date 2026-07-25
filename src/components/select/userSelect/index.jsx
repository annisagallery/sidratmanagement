'use client';
import React, { useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { PATH_PAGE } from 'src/routes/paths';
import { UserList } from 'src/components/lists';
import * as Icon from 'react-icons/tb';
import { FaUser } from 'react-icons/fa6';
import useAdminUserStore from 'src/stores/userStore';

function getKeyByValue(object, value) {
  return Object.keys(object).find((key) => object[key] === value);
}

export default function UserSelect({ isAdmin }) {
  const { user, isAuthenticated } = useAdminUserStore();
  const firstChar = user?.name?.slice(0, 1)?.toUpperCase();
  const isLetter = /^[A-Z]$/i.test(firstChar);
  const IconComponent = isLetter ? Icon[`TbLetter${firstChar}`] : FaUser;

  const router = useRouter();
  const pathname = usePathname();
  const isAuthPath = getKeyByValue(PATH_PAGE.auth, pathname);
  const isHomePath = pathname.slice(3) === '';
  const [openUser, setOpen] = React.useState(false);
  const userListRef = useRef(null);

  const handleOpenUser = () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
    } else {
      setOpen((prev) => !prev);
    }
  };

  const handleClickOutside = (event) => {
    if (userListRef.current && !userListRef.current.contains(event.target)) {
      setOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative z-[999]">
      {!isAuthenticated ? (
        <div
          className="flex items-center cursor-pointer space-x-2"
          onClick={() => router.push(`/auth/login${isAuthPath || isHomePath ? '' : `?redirect=${pathname}`}`)}
        >
          <button
            className="ml-2 text-2xl text-primary-dark border border-primary bg-primary/10 hover:bg-primary/20 transition-all p-2 rounded-md"
            name="user-select"
          >
            <FaUser />
          </button>
          <div>
            <p className="text-base mb-[-0.15rem]">Hello, user</p>
            <p className="text-sm text-gray-600">Login Now</p>
          </div>
        </div>
      ) : (
        <>
          <div onClick={handleOpenUser} className="flex items-center cursor-pointer space-x-2">
            <div
              className="ml-2 text-2xl text-primary-dark border border-primary bg-primary/10 hover:bg-primary/20 transition-all p-2 rounded-md cursor-pointer"
              name="user-select"
            >
              <IconComponent />
            </div>
            <div>
              <p className="text-base mb-[-0.15rem]">{user.name}</p>
              <p className="text-sm text-gray-600">{user.role}</p>
            </div>
          </div>

          <div
            ref={userListRef}
            className={`absolute bg-white p-4 border top-full right-0 shadow-md ${openUser ? 'block' : 'hidden'}`}
          >
            <UserList
              openUser={openUser}
              isAuthenticated={isAuthenticated}
              user={user}
              setOpen={() => setOpen(false)}
            />
          </div>
        </>
      )}
    </div>
  );
}
