import BaseLayout from '@/layouts/BaseLayout';
import HomeStage from '@/components/landing/HomeStage';
import '@/styles/landing.css';

export default function HomePage() {
  return (
    <BaseLayout
      title="Hong Kong AI automation and workflow design | Bluebook"
      description="Bluebook helps Hong Kong teams turn everyday operational work into AI, automation, and system integration. Start with one process."
      canonical="https://www.bluebook.blue/en/"
    >
      <div className="landing home-stage-page">
        <HomeStage />
      </div>
    </BaseLayout>
  );
}
