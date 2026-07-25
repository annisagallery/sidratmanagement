import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useSettingsStore = create(
  persist(
    (set) => ({
      themeMode: 'light',
      currency: 'BDT',
      rate:      1,

      setThemeMode:         (mode)            => set({ themeMode: mode }),
      handleChangeCurrency: ({ currency, rate }) => set({ currency, rate }),
    }),
    {
      name: 'admin-settings-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ themeMode: s.themeMode, currency: s.currency, rate: s.rate }),
    }
  )
);

export default useSettingsStore;
