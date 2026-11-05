import { useState } from 'react';
import { NEEDS_API_BASE, normaliseApiBase, setApiBase } from '../config';

/**
 * Shown on a native build that has no API address configured.
 *
 * Without this the app opens, renders its shell, and then fails every request
 * against https://localhost/api — which looks exactly like a broken app with no
 * explanation. This gives the user a way to point the installed build at a
 * reachable server and says plainly what is wrong.
 */
export default function ConnectServer() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (!normaliseApiBase(value)) {
      setError('Enter a server address such as 192.168.1.5:3001 or https://api.yourdomain.com');
      return;
    }
    setError('');
    setApiBase(value);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <span className="material-symbols-outlined text-primary text-[26px] icon-fill" aria-hidden="true">music_note</span>
        </div>

        <h1 className="font-headline-md text-on-surface">Connect to your Kay Chart server</h1>
        <p className="font-body-sm text-on-surface-variant mt-2">
          This build has no server address saved, so it cannot load your music yet.
          Enter the address of your Kay Chart backend. On the same Wi-Fi, that is
          usually your computer&apos;s local address and port{' '}
          <span className="text-on-surface">3001</span>.
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <label htmlFor="api-base" className="sr-only">Server address</label>
          <input
            id="api-base"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="192.168.1.5:3001"
            aria-describedby="api-base-help"
            className="w-full h-14 px-5 rounded-2xl bg-surface-card border border-border-subtle text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
          />
          <p id="api-base-help" className="font-body-xs text-on-surface-variant">
            The app adds <span className="text-on-surface">/api</span> automatically.
          </p>

          {error && (
            <p role="alert" className="font-body-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            className="mt-2 h-14 rounded-2xl bg-primary text-background font-body-md font-semibold press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Connect
          </button>
        </form>

        {!NEEDS_API_BASE && (
          <p className="font-body-xs text-on-surface-variant mt-6">Already connected.</p>
        )}
      </div>
    </div>
  );
}
