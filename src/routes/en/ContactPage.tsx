import { useCallback, useEffect, useRef, useState } from 'react';
import BaseLayout from '@/layouts/BaseLayout';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import '@/styles/landing.css';
import '@/styles/pages/contact.css';

const title = 'Contact Us | Bluebook';
const description =
  'Start with one process you want to improve. Reach out to Bluebook to discuss a practical path to digital transformation.';
const prefix = '/en';
const interests = [
  'Digital consultancy',
  'WhatsApp AI Agent',
  'AI OCR & data extraction',
  'Workflow automation',
  'Other',
];

export default function ContactPage() {
  const selectRootRef = useRef<HTMLDivElement>(null);
  const [selectOpen, setSelectOpen] = useState(false);
  const [interest, setInterest] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [messageError, setMessageError] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formHidden, setFormHidden] = useState(false);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!selectRootRef.current?.contains(e.target as Node)) {
        setSelectOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSelectOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    setNameError(false);
    setEmailError(false);
    setMessageError(false);
    setGeneralError('');

    let valid = true;
    if (!name.trim()) {
      setNameError(true);
      valid = false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(true);
      valid = false;
    }
    if (!message.trim()) {
      setMessageError(true);
      valid = false;
    }
    if (!valid) return;

    setSubmitting(true);
    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: 'e7852671-07c4-429a-aeac-7b5907c54c47',
          to: 'info@bluebook.blue',
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          interest,
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFormHidden(true);
        setSubmitted(true);
      } else {
        setGeneralError(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setGeneralError('Network error. Please try again or email us directly.');
    }
    setSubmitting(false);
  }, [name, email, message, company, interest]);

  return (
    <BaseLayout title={title} description={description} canonical="https://www.bluebook.blue/en/contact/">
      <div className="contact-page" data-motion-pending>
        <SiteHeader currentPath={`${prefix}/contact/`} />

        <main>
          <section className="cu-hero" data-node-id="39:4418">
            <div className="cu-shell">
              <div className="cu-rail">
                <h1>START WITH ONE<br /><span>PROCESS</span> YOU WANT<br />TO IMPROVE.</h1>
                <p>We specialize in unpicking complex legacy workflows and rebuilding them with clarity and intent. Reach out to discuss a practical path to digital transformation.</p>
              </div>
            </div>
          </section>

          <section className="cu-split" data-node-id="39:4424">
            <div className="cu-shell cu-split__inner">
              <aside className="cu-info">
                <div className="cu-rail cu-rail--mute">
                  <div className="cu-block">
                    <p className="cu-block__label">01. DIRECT LINE</p>
                    <a className="cu-block__link" href="mailto:info@bluebook.blue">info@bluebook.blue</a>
                    <p className="cu-block__copy">We aim to respond to all new inquiries within 24 hours, ensuring a swift transition from conversation to strategy.</p>
                  </div>
                  <div className="cu-block">
                    <p className="cu-block__label">02. HEADQUARTERS</p>
                    <address>RM 702 7/F, Kowloon Building<br />555 Nathan Road, Kowloon<br />Hong Kong</address>
                  </div>
                </div>
              </aside>

              <div className="cu-form-card" data-node-id="39:4466">
                <i className="cu-form-card__accent" aria-hidden="true" />
                <div className="cu-form" id="contactForm" hidden={formHidden || undefined}>
                  <div className="_hp">
                    <label htmlFor="_hp">Leave this empty</label>
                    <input type="text" id="_hp" name="_hp" autoComplete="off" tabIndex={-1} />
                  </div>

                  <div className="cu-form__row">
                    <label className="cu-field">
                      <span>Full Name</span>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        autoComplete="name"
                        placeholder="Jane Doe"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={nameError ? 'error' : undefined}
                      />
                      <em className="cu-err" id="nameError" style={{ display: nameError ? 'block' : 'none' }}>Please enter your name.</em>
                    </label>
                    <label className="cu-field">
                      <span>Organization</span>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        autoComplete="organization"
                        placeholder="Acme Corp"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="cu-form__row">
                    <label className="cu-field">
                      <span>Email Address</span>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        autoComplete="email"
                        placeholder="jane@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={emailError ? 'error' : undefined}
                      />
                      <em className="cu-err" id="emailError" style={{ display: emailError ? 'block' : 'none' }}>Please enter a valid email.</em>
                    </label>
                    <div className="cu-field cu-field--select" data-select ref={selectRootRef}>
                      <span id="interestLabel">Primary Interest</span>
                      <button
                        type="button"
                        className="cu-select__trigger"
                        id="interestTrigger"
                        aria-haspopup="listbox"
                        aria-expanded={selectOpen}
                        aria-labelledby="interestLabel"
                        data-empty={interest ? 'false' : 'true'}
                        onClick={() => setSelectOpen((o) => !o)}
                      >
                        <span data-select-label>{interest || 'Select an area of focus'}</span>
                        <img className="cu-field__chevron" src="/assets/figma/contact/icon-chevron.svg" alt="" width={12} height={8} />
                      </button>
                      <input type="hidden" id="interest" name="interest" value={interest} />
                      <ul className="cu-select__list" id="interestList" role="listbox" hidden={!selectOpen || undefined}>
                        {interests.map((item) => (
                          <li
                            key={item}
                            role="option"
                            tabIndex={-1}
                            data-value={item}
                            aria-selected={interest === item || undefined}
                            onClick={() => {
                              setInterest(item);
                              setSelectOpen(false);
                            }}
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <label className="cu-field cu-field--full">
                    <span>Project Details</span>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      required
                      placeholder="Briefly describe the current bottleneck or operational challenge..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className={messageError ? 'error' : undefined}
                    />
                    <em className="cu-err" id="messageError" style={{ display: messageError ? 'block' : 'none' }}>Please enter your message.</em>
                  </label>

                  <div className="cu-form__foot">
                    <p>Strict confidentiality maintained.</p>
                    <button type="button" className="cu-submit" id="submitBtn" disabled={submitting} onClick={handleSubmit}>
                      {submitting ? (
                        'Sending...'
                      ) : (
                        <>
                          INITIATE REVIEW
                          <img src="/assets/figma/contact/icon-arrow.svg" alt="" width={12} height={12} />
                        </>
                      )}
                    </button>
                  </div>
                  <em className="cu-err cu-err--block" id="generalError" style={{ display: generalError ? 'block' : 'none' }}>{generalError}</em>
                </div>

                <div className="cu-success" id="formSuccess" hidden={!submitted || undefined}>
                  <p className="cu-success__title">Your enquiry has been sent</p>
                  <p>We will get back to you soon.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="cu-map-section" aria-label="Headquarters location">
            <div className="cu-shell">
              <div className="cu-map">
                <iframe
                  title="Bluebook headquarters — Kowloon Building, 555 Nathan Road, Kowloon, Hong Kong"
                  src="https://www.google.com/maps?q=Kowloon+Building,+555+Nathan+Road,+Kowloon,+Hong+Kong&z=17&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  tabIndex={-1}
                />
              </div>
            </div>
          </section>
        </main>

        <SiteFooter hideBanner />
      </div>
    </BaseLayout>
  );
}
