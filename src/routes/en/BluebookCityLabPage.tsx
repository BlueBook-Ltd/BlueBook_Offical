import { useEffect } from 'react';
import BluebookCityLab from '@/components/city/BluebookCityLab';

export default function BluebookCityLabPage() {
  useEffect(() => {
    document.title = 'Bluebook City | Bluebook';
    const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const previous = robots?.content;
    if (robots) robots.content = 'noindex, nofollow';
    return () => {
      if (robots && previous) robots.content = previous;
    };
  }, []);

  return <BluebookCityLab />;
}
