'use client';

import { use } from 'react';
import ReportWorkspace from 'src/components/_admin/reports/ReportWorkspace';

export default function ReportKeyPage({ params }) {
  const { reportKey } = use(params);
  return <ReportWorkspace reportKey={reportKey} />;
}
