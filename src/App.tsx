import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import NotFoundPage from './routes/NotFoundPage';
import RootRedirect from './routes/RootRedirect';
import SpringPageMotion from './motion/SpringPageMotion';

const HomePage = lazy(() => import('./routes/en/HomePage'));
const AboutPage = lazy(() => import('./routes/en/AboutPage'));
const ContactPage = lazy(() => import('./routes/en/ContactPage'));
const ServicesPage = lazy(() => import('./routes/en/ServicesPage'));
const WhatsappPage = lazy(() => import('./routes/en/services/Whatsapp-ai-agentPage'));
const OcrPage = lazy(() => import('./routes/en/services/Ai-ocrPage'));
const NewsIndexPage = lazy(() => import('./routes/en/news/IndexPage'));
const NewsDetailPage = lazy(() => import('./routes/en/news/DetailPage'));
const CultureIndexPage = lazy(() => import('./routes/en/culture/IndexPage'));
const CultureDetailPage = lazy(() => import('./routes/en/culture/DetailPage'));
const CityPage = lazy(() => import('./routes/en/CityPage'));
const DataTreePage = lazy(() => import('./routes/en/Data-treePage'));
const DataRiverPage = lazy(() => import('./routes/en/Data-riverPage'));
const ShaderPreviewPage = lazy(() => import('./routes/en/Shader-previewPage'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PageLoader() {
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <SpringPageMotion />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/en" element={<Navigate to="/en/" replace />} />
          <Route path="/en/" element={<HomePage />} />
          <Route path="/en/about/" element={<AboutPage />} />
          <Route path="/en/contact/" element={<ContactPage />} />
          <Route path="/en/services/" element={<ServicesPage />} />
          <Route path="/en/services/whatsapp-ai-agent/" element={<WhatsappPage />} />
          <Route path="/en/services/ai-ocr/" element={<OcrPage />} />
          <Route path="/en/news/" element={<NewsIndexPage />} />
          <Route path="/en/news/:slug/" element={<NewsDetailPage />} />
          <Route path="/en/culture/" element={<CultureIndexPage />} />
          <Route path="/en/culture/:slug/" element={<CultureDetailPage />} />
          <Route path="/en/city/" element={<CityPage />} />
          <Route path="/en/data-tree/" element={<DataTreePage />} />
          <Route path="/en/data-river/" element={<DataRiverPage />} />
          <Route path="/en/shader-preview/" element={<ShaderPreviewPage />} />
          <Route path="/zh/*" element={<Navigate to="/en/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  );
}
