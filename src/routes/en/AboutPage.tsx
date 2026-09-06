import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import PageHero from '@/components/PageHero';
import '@/styles/landing.css';
import '@/styles/pages/about.css';

export default function AboutPage() {
  return (
    <BaseLayout
      title="About Bluebook | Hong Kong AI automation"
      description="Bluebook maps the work your team already does, then designs AI and automation your people can trust. Based in Kowloon, Hong Kong."
      canonical="https://www.bluebook.blue/en/about/"
    >
      <SiteHeader currentPath="/en/about/" />
      <main>
        <PageHero
          eyebrow="About Bluebook"
          title="Automation starts with understanding the work."
          lead="We help teams turn everyday operational friction into practical, connected systems."
        />
        <section className="section">
          <div className="container split">
            <div>
              <p className="eyebrow">Our approach</p>
              <h2>Useful AI is built around the people doing the work.</h2>
            </div>
            <div className="copy">
              <p>We do not begin by selling a tool. We begin with the conversations, documents, decisions, and handoffs that already shape your day.</p>
              <p>Then we design a focused automation path that your team can understand, trust, and improve over time.</p>
            </div>
          </div>
        </section>
        <section className="principles">
          <div className="container">
            <p className="eyebrow">Principles</p>
            <div className="principle-grid">
              <article>
                <b>01</b>
                <h3>Start from reality</h3>
                <p>Map the work your team actually does, including the exceptions.</p>
              </article>
              <article>
                <b>02</b>
                <h3>Keep context connected</h3>
                <p>Make decisions and data visible across the systems that need them.</p>
              </article>
              <article>
                <b>03</b>
                <h3>Build for adoption</h3>
                <p>Deliver workflows people can use without creating another layer of work.</p>
              </article>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </BaseLayout>
  );
}
