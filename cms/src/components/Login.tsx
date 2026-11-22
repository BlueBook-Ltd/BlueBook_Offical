import { useState, type FormEvent } from 'react';
import { ApiError } from '../api';

interface Props {
  onSubmit: (token: string) => Promise<void>;
}

export default function Login({ onSubmit }: Props) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token.trim()) {
      setError('Enter the admin token to continue.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(token.trim());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not sign in. Check the CMS Worker is running.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login__panel">
        <div className="login__panel-inner">
          <span className="login__eyebrow">BLUEBOOK · EDITORIAL SYSTEM</span>
          <h1 className="login__display">
            Write it down.
            <br />
            Ship it clearly.
          </h1>
          <p className="login__lede">
            News and Culture, edited in one place. Draft, preview, and publish
            without touching the website code.
          </p>
          <div className="login__rule" />
          <dl className="login__facts">
            <div>
              <dt>Channels</dt>
              <dd>News / Culture</dd>
            </div>
            <div>
              <dt>Content</dt>
              <dd>Markdoc</dd>
            </div>
            <div>
              <dt>Storage</dt>
              <dd>D1 + R2</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="login__card-wrap">
        <form className="login__card" onSubmit={handleSubmit}>
          <div className="login__brand">
            <span className="login__brand-mark" aria-hidden="true">B</span>
            <span className="login__brand-name">BLUEBOOK CMS</span>
          </div>
          <h2 className="login__title">Sign in</h2>
          <p className="login__hint">
            Use the <code>ADMIN_TOKEN</code> configured on the CMS Worker. If the
            site is behind Cloudflare Access, you will be signed in automatically.
          </p>

          <label className="field">
            <span className="field__label">Admin token</span>
            <input
              className="input input--token"
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste your admin token"
              autoComplete="current-password"
              autoFocus
              spellCheck={false}
            />
          </label>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          <button className="btn btn--primary btn--block" type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Enter CMS'}
          </button>

          <p className="login__foot">
            Local development token is in <code>cms/.dev.vars</code>.
          </p>
        </form>
      </section>
    </div>
  );
}
