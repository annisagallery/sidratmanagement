import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

const useAdminUserStore = create(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      _hasHydrated: false,

      login:       (user) => set({ isAuthenticated: true, user }),
      logout:      ()     => set({ isAuthenticated: false, user: null }),
      setHydrated: ()     => set({ _hasHydrated: true }),
    }),
    {
      name: 'admin-user-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ isAuthenticated: s.isAuthenticated, user: s.user }),
      onRehydrateStorage: () => (state) => { state?.setHydrated(); },
    }
  )
);

export { isTokenExpired };
export default useAdminUserStore;
