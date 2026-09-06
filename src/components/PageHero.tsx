import '@/styles/pages/page-hero.css';

interface Props {
  eyebrow?: string;
  title: string;
  lead?: string;
}

export default function PageHero({ eyebrow, title, lead }: Props) {
  return (
    <section className="page-hero">
      <div className="page-hero__inner container">
        {eyebrow && <p className="page-hero__eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lead && <div className="page-hero__lead">{lead}</div>}
      </div>
    </section>
  );
}
