import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import NotFoundPage from './routes/NotFoundPage';
import RootRedirect from './routes/RootRedirect';
import SpringPageMotion from './motion/SpringPageMotion';
import PageTransition from './motion/PageTransition';
import HomePreloader from './motion/HomePreloader';
import CustomCursor from './motion/CustomCursor';

const HomePage = lazy(() => import('./routes/en/HomePage'));
const ContactPage = lazy(() => import('./routes/en/ContactPage'));
const NewsIndexPage = lazy(() => import('./routes/en/news/IndexPage'));
const NewsDetailPage = lazy(() => import('./routes/en/news/DetailPage'));
const CultureIndexPage = lazy(() => import('./routes/en/culture/IndexPage'));
const CultureDetailPage = lazy(() => import('./routes/en/culture/DetailPage'));
const CityPage = lazy(() => import('./routes/en/CityPage'));
const DataTreePage = lazy(() => import('./routes/en/Data-treePage'));
const DataRiverPage = lazy(() => import('./routes/en/Data-riverPage'));
const ShaderPreviewPage = lazy(() => import('./routes/en/Shader-previewPage'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    const jump = () => document.getElementById(id)?.scrollIntoView();
    jump();
    const t = window.setTimeout(jump, 80);
    return () => window.clearTimeout(t);
  }, [pathname, hash]);
  return null;
}

function PageLoader() {
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <HomePreloader />
      <CustomCursor />
      <PageTransition />
      <SpringPageMotion />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/en" element={<Navigate to="/en/" replace />} />
          <Route path="/en/" element={<HomePage />} />
          {/* About Us was removed; keep the old URL from 404ing. */}
          <Route path="/en/about" element={<Navigate to="/en/" replace />} />
          <Route path="/en/about/" element={<Navigate to="/en/" replace />} />
          <Route path="/en/contact/" element={<ContactPage />} />
          <Route path="/en/services/" element={<Navigate to="/en/" replace />} />
          <Route path="/en/services/whatsapp-ai-agent/" element={<Navigate to="/en/" replace />} />
          <Route path="/en/services/ai-ocr/" element={<Navigate to="/en/" replace />} />
          <Route path="/en/news/" element={<NewsIndexPage />} />
          <Route path="/en/news/:slug/" element={<NewsDetailPage />} />
          <Route path="/en/culture/" element={<CultureIndexPage />} />
          <Route path="/en/culture/:slug/" element={<CultureDetailPage />} />
          <Route path="/en/city/" element={<CityPage />} />
          <Route path="/en/data-tree/" element={<DataTreePage />} />
          <Route path="/en/data-river/" element={<DataRiverPage />} />
          <Route path="/en/shader-preview/" element={<ShaderPreviewPage />} />
          {/* The CMS admin now lives on its own deployment behind Cloudflare Access. */}
          <Route path="/backend" element={<Navigate to="/en/" replace />} />
          <Route path="/backend/*" element={<Navigate to="/en/" replace />} />
          <Route path="/zh/*" element={<Navigate to="/en/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
