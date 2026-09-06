import { useEffect } from 'react';
import DataRiver from '@/components/DataRiver';

export default function DataRiverPage() {
  useEffect(() => {
    document.title = 'Data river study | Bluebook';
  }, []);

  return <DataRiver />;
}
