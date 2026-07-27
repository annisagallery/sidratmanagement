'use client';

import { useQuery } from 'react-query';
import * as api from 'src/services';

/**
 * Branch dropdown shared by the Branch Finance pages. Emits the branch id
 * (empty string = no selection / all, when allowAll is set).
 */
export default function BranchSelect({ value, onChange, allowAll = false, className = 'select-ui' }) {
  const { data } = useQuery(['admin-branches'], api.adminGetBranches, { staleTime: 5 * 60_000 });
  const branches = (data?.data || []).filter((branch) => branch.isActive !== false);

  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allowAll ? 'All branches' : 'Select branch…'}</option>
      {branches.map((branch) => (
        <option key={branch.id} value={branch.id}>
          {branch.name} {branch.code ? `(${branch.code})` : ''}
        </option>
      ))}
    </select>
  );
}
