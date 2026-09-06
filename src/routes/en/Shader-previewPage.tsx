import { useEffect } from 'react';
import ShaderPreview from '@/components/ShaderPreview';

export default function ShaderPreviewPage() {
  useEffect(() => {
    document.title = 'Shader preview | Bluebook';
    const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (robots) robots.content = 'noindex, nofollow';
  }, []);

  return <ShaderPreview />;
}
