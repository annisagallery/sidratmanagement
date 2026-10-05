'use client';
import PropTypes from 'prop-types';
import { useQuery } from 'react-query';
import { getSiteSettings } from 'src/services';
import { SiteSettingsProvider, defaultSettings } from 'src/context/SiteSettingsContext';
import Loading from 'src/components/loading';

const RETRY_MS = 10_000;

// The app is only ever drawn with the real SiteSettings — never the built-in
// defaults. The root layout fetches them on the server and passes them in as
// `initial`, so the first frame already has the right name, logo and colour.
// If that fetch failed, this waits behind a neutral spinner (and the server
// unavailable screen, when that is the reason) until the client fetch lands.
export default function SiteSettingsDataProvider({ initial, children }) {
  const { data } = useQuery('site-settings', getSiteSettings, {
    staleTime: 60_000,
    initialData: initial ? { data: initial } : undefined,
    refetchInterval: (current) => (current?.data ? false : RETRY_MS),
  });

  if (!data?.data) return <Loading />;
  // Defaults only fill fields the API left out; every value it sends wins.
  return <SiteSettingsProvider value={{ ...defaultSettings, ...data.data }}>{children}</SiteSettingsProvider>;
}

SiteSettingsDataProvider.propTypes = { initial: PropTypes.object, children: PropTypes.node.isRequired };
