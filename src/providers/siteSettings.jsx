'use client';
import { useQuery } from 'react-query';
import { getSiteSettings } from 'src/services';
import { SiteSettingsProvider, defaultSettings } from 'src/context/SiteSettingsContext';

export default function SiteSettingsDataProvider({ children }) {
  const { data } = useQuery('site-settings', getSiteSettings, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const settings = data?.data ? { ...defaultSettings, ...data.data } : defaultSettings;

  return (
    <SiteSettingsProvider value={settings}>
      {children}
    </SiteSettingsProvider>
  );
}
