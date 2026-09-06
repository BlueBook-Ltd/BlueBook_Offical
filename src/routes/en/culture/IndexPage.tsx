import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import NewsContent from '@/components/NewsContent';
import '@/styles/landing.css';

const currentPath = '/en/culture/';

export default function CultureIndexPage() {
  return (
    <BaseLayout
      title="Culture & Code | Bluebook"
      description="Essays and notes from Bluebook on culture, code, systems, and how teams actually get work done."
      canonical="https://www.bluebook.blue/en/culture/"
    >
      <SiteHeader currentPath={currentPath} />
      <div className="landing">
        <NewsContent channel="culture" />
      </div>
      <SiteFooter hideBanner />
    </BaseLayout>
  );
}
