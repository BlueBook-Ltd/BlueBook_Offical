import { Link } from 'react-router-dom';
import { SpringReveal } from '@/motion/SpringReveal';
import { SpringParallax } from '@/motion/SpringParallax';
import '@/styles/components/get-in-touch.css';

interface Props {
  id?: string;
  href?: string;
  title?: string;
  lede?: string;
  cta?: string;
  image?: string;
}

export default function GetInTouch({
  id = 'get-in-touch',
  href = '/en/contact/',
  title = 'CONTACT',
  lede = 'For any enquiries, or just to say hello, get in touch and contact us.',
  cta = 'CONTACT US ↗',
  image = '/images/contact-panel.jpg',
}: Props) {
  return (
    <section className="git" id={id} data-node-id="178:9" data-no-spring aria-label="Get in touch">
      <SpringReveal className="git__panel" fromY={28} fromX={-12}>
        <div className="git__stack">
          <h2 className="git__title">{title}</h2>
          <p className="git__lede">{lede}</p>
          <Link className="git__btn" to={href}>{cta}</Link>
        </div>
      </SpringReveal>
      <SpringParallax distance={36} className="git__visual">
        <img src={image} alt="" width={900} height={1200} loading="lazy" decoding="async" />
      </SpringParallax>
    </section>
  );
}
