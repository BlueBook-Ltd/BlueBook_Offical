import { useEffect } from 'react';
import DataTree from '@/components/DataTree';

export default function DataTreePage() {
  useEffect(() => {
    document.title = 'Data tree study | Bluebook';
  }, []);

  return <DataTree />;
}
