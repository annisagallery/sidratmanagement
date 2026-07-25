'use client';
import { createContext, useContext, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from 'react-query';
import { createMongoAbility } from '@casl/ability';

import * as api from 'src/services';
import useAdminUserStore from 'src/stores/userStore';

/**
 * Hydrates a CASL ability from the server's serialized rules (/admin/me) and
 * exposes `can(action, subject)` for nav/button visibility.
 *
 * UX only — the server independently enforces every rule. Until the rules
 * have loaded, `can` is permissive so the UI doesn't flash empty; a denied
 * click simply gets a 403 from the API.
 */
const PermissionsContext = createContext({ can: () => true, ready: false, ability: null });

export function usePermissions() {
  return useContext(PermissionsContext);
}

export default function PermissionsProvider({ children }) {
  const { isAuthenticated } = useAdminUserStore();

  // Poll instead of relying on window-focus refetch (disabled app-wide in
  // providers/index.jsx) — otherwise a role edit never reaches an already
  // logged-in tab until it's manually reloaded.
  const { data, isSuccess } = useQuery(['my-ability'], api.getMyAbility, {
    enabled: isAuthenticated,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const value = useMemo(() => {
    const rules = data?.rules;
    if (!isSuccess || !Array.isArray(rules)) {
      return { can: () => true, ready: false, ability: null };
    }
    const ability = createMongoAbility(rules);
    return {
      can: (action, subject) => ability.can(action, subject),
      ready: true,
      ability,
    };
  }, [data, isSuccess]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

PermissionsProvider.propTypes = { children: PropTypes.node.isRequired };
