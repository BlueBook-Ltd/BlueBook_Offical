import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import InsightsListing from '@/components/InsightsListing';
import '@/styles/landing.css';

const currentPath = '/en/news/';

export default function NewsIndexPage() {
  return (
    <BaseLayout
      title="Insights | Hong Kong AI operations | Bluebook"
      description="Bluebook notes on architecture, operations, and digital transformation for teams doing the work."
      canonical="https://www.bluebook.blue/en/news/"
    >
      <SiteHeader currentPath={currentPath} />
      <div className="landing">
        <InsightsListing channel="news" basePath="/en/news/" />
      </div>
      <SiteFooter hideBanner />
    </BaseLayout>
  );
}
