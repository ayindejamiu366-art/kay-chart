import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import { spotify } from '../services/spotify';

export default function SpotifySettings() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [config, setConfig] = useState(null);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    spotify.getConfig().then(setConfig).catch(() => {});
  }, []);

  const testSearch = async () => {
    if (!testQuery.trim()) return;
    setTesting(true);
    try {
      const result = await spotify.search(testQuery, 'track', 5);
      setTestResult(result.tracks || []);
    } catch (e) {
      setTestResult([]);
    }
    setTesting(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background page-enter">
      <div className="px-6 pt-14 pb-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-surface-card border border-border-subtle flex items-center justify-center press-feedback">
          <span className="material-symbols-outlined text-on-surface text-[20px]">arrow_back</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface">Spotify</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-28 hide-scrollbar">
        {/* Status */}
        <div className={`p-5 rounded-2xl border mb-6 ${config?.configured ? 'bg-[#1DB954]/5 border-[#1DB954]/20' : 'bg-orange-500/5 border-orange-500/20'}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config?.configured ? 'bg-[#1DB954]/15' : 'bg-orange-500/15'}`}>
              <span className={`material-symbols-outlined text-[22px] ${config?.configured ? 'text-[#1DB954]' : 'text-orange-400'}`}>
                {config?.configured ? 'check_circle' : 'warning'}
              </span>
            </div>
            <div>
              <p className="font-body-md text-body-md text-on-surface font-medium">
                {config?.configured ? 'Connected' : 'Not Connected'}
              </p>
              <p className="text-[12px] text-on-surface-variant">
                {config?.configured ? `App: ${config.clientId}` : 'Add your Spotify Developer credentials'}
              </p>
            </div>
          </div>
        </div>

        {/* Setup Instructions */}
        {!config?.configured && (
          <div className="mb-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">Setup Instructions</h3>
            <div className="bg-surface-card rounded-2xl border border-border-subtle p-5">
              <ol className="space-y-4">
                {[
                  { step: 1, text: 'Go to developer.spotify.com/dashboard', icon: 'open_in_new' },
                  { step: 2, text: 'Log in with your Spotify account', icon: 'login' },
                  { step: 3, text: 'Click "Create App" and fill in the details', icon: 'add_circle' },
                  { step: 4, text: 'Copy your Client ID and Client Secret', icon: 'content_copy' },
                  { step: 5, text: 'Set environment variables or add to server/index.cjs', icon: 'settings' },
                ].map(({ step, text, icon }) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[12px] font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{text}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-5 p-3 rounded-xl bg-surface-container-high border border-border-subtle">
                <p className="text-[11px] font-mono text-on-surface-variant break-all">
                  SPOTIFY_CLIENT_ID=your_client_id_here{'\n'}
                  SPOTIFY_CLIENT_SECRET=your_client_secret_here
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Features */}
        <div className="mb-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">Features</h3>
          <div className="flex flex-col gap-2">
            {[
              { icon: 'search', title: 'Search', desc: 'Search millions of songs on Spotify', active: config?.configured },
              { icon: 'album', title: 'Album Art', desc: 'Real album covers for all songs', active: config?.configured },
              { icon: 'headphones', title: '30s Previews', desc: 'Play 30-second track previews', active: config?.configured },
              { icon: 'recommend', title: 'Recommendations', desc: 'AI-powered song recommendations', active: config?.configured },
            ].map(({ icon, title, desc, active }) => (
              <div key={title} className={`flex items-center gap-3 p-3.5 rounded-xl border ${active ? 'bg-surface-card border-border-subtle' : 'bg-surface-card/50 border-border-subtle/50 opacity-60'}`}>
                <span className={`material-symbols-outlined text-[20px] ${active ? 'text-primary' : 'text-on-surface-variant/40'}`}>{icon}</span>
                <div className="flex-1">
                  <p className="font-body-sm text-body-sm text-on-surface font-medium">{title}</p>
                  <p className="text-[11px] text-on-surface-variant">{desc}</p>
                </div>
                {active && <span className="material-symbols-outlined text-primary text-[16px]">check_circle</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Test Search */}
        {config?.configured && (
          <div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-3">Test Connection</h3>
            <div className="flex gap-2 mb-3">
              <input
                value={testQuery}
                onChange={e => setTestQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && testSearch()}
                placeholder="Search a song..."
                className="flex-1 bg-surface-card border border-border-subtle rounded-xl px-4 py-2.5 text-on-surface text-[14px] outline-none focus:border-primary/50"
              />
              <button onClick={testSearch} disabled={testing} className="px-4 py-2.5 bg-primary text-on-primary rounded-xl font-medium text-[13px] disabled:opacity-50">
                {testing ? '...' : 'Test'}
              </button>
            </div>
            {testResult && (
              <div className="flex flex-col gap-2">
                {testResult.map(track => (
                  <div key={track.id} className="flex items-center gap-3 p-2 rounded-xl bg-surface-card border border-border-subtle">
                    <img src={track.coverSmall || track.cover} alt="" className="w-10 h-10 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-on-surface truncate">{track.title}</p>
                      <p className="text-[11px] text-on-surface-variant truncate">{track.artistName}</p>
                    </div>
                    {track.previewUrl && <span className="text-[10px] bg-[#1DB954]/15 text-[#1DB954] px-2 py-0.5 rounded-full">Preview</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
