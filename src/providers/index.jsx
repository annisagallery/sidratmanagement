'use client';
import { useState } from 'react';
import PropTypes from 'prop-types';
import dynamic from 'next/dynamic';
import { QueryClient, QueryClientProvider } from 'react-query';

import ThemeRegistry from 'src/theme';
import LinearIndeterminate from '../components/loading';
import SiteSettingsDataProvider from './siteSettings';
import PermissionsProvider from 'src/context/PermissionsContext';
import useAdminUserStore from 'src/stores/userStore';

const ProgressBar = dynamic(() => import('src/components/ProgressBar'), { ssr: false });

function HydrationGate({ children }) {
  const hasHydrated = useAdminUserStore((s) => s._hasHydrated);
  if (!hasHydrated) return <LinearIndeterminate />;
  return children;
}

HydrationGate.propTypes = { children: PropTypes.node.isRequired };

Providers.propTypes = { children: PropTypes.node.isRequired };

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            // Serve cached data for 30s before refetching — admin lists don't
            // need an instant refetch on every navigation.
            staleTime: 30_000,
            retry: (failureCount, error) => {
              if (error?.response?.status === 401 || error?.response?.status === 403) return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  return (
    <ThemeRegistry>
      <QueryClientProvider client={queryClient}>
        <HydrationGate>
          <PermissionsProvider>
            <SiteSettingsDataProvider>
              {children}
            </SiteSettingsDataProvider>
          </PermissionsProvider>
        </HydrationGate>
      </QueryClientProvider>
      <ProgressBar />
    </ThemeRegistry>
  );
}
