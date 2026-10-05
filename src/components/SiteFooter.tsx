import { Link } from 'react-router-dom';
import GetInTouch from './GetInTouch';
import '@/styles/components/site-footer.css';

interface Props {
  hideBanner?: boolean;
  hideCta?: boolean;
}

export default function SiteFooter({ hideBanner = false, hideCta = false }: Props) {
  const prefix = '/en';
  const hide = hideBanner || hideCta;

  return (
    <>
      {!hide && <GetInTouch />}
      <footer className="site-footer" data-node-id="404:4435">
        <div className="site-footer__inner">
          <div>
            <h2>BLUEBOOK</h2>
            <p>Bluebook helps companies start from real business workflows, introducing AI automation, and system integrations to turn repetitive, time-consuming, and error-prone tasks into more efficient and traceable operations.</p>
          </div>
          <div>
            <h3>CONTACT US</h3>
            <p>Start with one repetitive, time-consuming or error-prone process and explore the feasibility of AI automation.</p>
            <a href="mailto:info@bluebook.blue">info@bluebook.blue</a>
            <address>RM 702 7/F, KOWLOON BUILDING<br />555 NATHAN ROAD, KOWLOON,<br />HONG KONG</address>
            <Link className="site-footer__cta" to={`${prefix}/contact/`}>CONTACT BLUEBOOK →</Link>
          </div>
          <small>© 2026 Bluebook. All rights reserved.</small>
        </div>
      </footer>
    </>
  );
}
