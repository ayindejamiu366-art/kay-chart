import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { formatTime } from '../data/library';

const API = import.meta.env.VITE_API_BASE_URL || '/api';

async function fetchLyrics(track) {
  if (!track) return null;

  const params = new URLSearchParams({
    title: track.title || '',
    artist: track.artistName || '',
    provider: track.provider || 'local',
  });
  if (track.albumName) params.set('album', track.albumName);
  if (track.duration) params.set('duration', String(track.duration));

  try {
    const res = await fetch(`${API}/lyrics/${encodeURIComponent(track.id)}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.syncedLyrics || (data.plainLyrics ? data.plainLyrics.split('\n').map((text, i) => ({ time: i * 4, text })) : null);
  } catch {
    return null;
  }
}

async function fetchLyricsExplanation(lyrics, title, artist) {
  try {
    const res = await fetch(`${API}/lyrics/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lyrics: lyrics.map(l => l.text).join('\n'), title, artist }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.explanation || null;
  } catch {
    return null;
  }
}

export default function SyncedLyrics() {
  const navigate = useNavigate();
  const { audio } = useApp();
  const { currentTrack, currentTime, duration, isPlaying, togglePlay, handleNext, handlePrev, seek, shuffle, repeat, toggleShuffle, cycleRepeat } = audio;
  const lyricsRef = useRef(null);
  const [activeLine, setActiveLine] = useState(-1);
  const [lyrics, setLyrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLyrics(null);
    setExplanation(null);
    setShowExplanation(false);

    fetchLyrics(currentTrack).then(data => {
      if (!cancelled) {
        setLyrics(data);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!lyrics) return;
    let idx = -1;
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (currentTime >= lyrics[i].time) { idx = i; break; }
    }
    setActiveLine(idx);
  }, [currentTime, lyrics]);

  useEffect(() => {
    if (activeLine >= 0 && lyricsRef.current) {
      const activeEl = lyricsRef.current.children[activeLine];
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLine]);

  const handleExplain = async () => {
    if (!lyrics || !currentTrack) return;
    if (explanation) { setShowExplanation(!showExplanation); return; }
    const exp = await fetchLyricsExplanation(lyrics, currentTrack.title, currentTrack.artistName);
    if (exp) { setExplanation(exp); setShowExplanation(true); }
  };

  if (!currentTrack) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background page-enter">
        <span className="material-symbols-outlined text-on-surface-variant text-[64px] mb-4">lyrics</span>
        <p className="font-headline-md text-headline-md text-on-surface mb-2">No Track Playing</p>
        <button onClick={() => navigate(-1)} className="btn-primary rounded-full px-8 py-3 font-body-sm text-body-sm text-on-primary-container">Go Back</button>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background page-enter">
      <div className="absolute inset-0">
        <img src={currentTrack.cover} alt="" className="w-full h-full object-cover" style={{ filter: 'blur(100px) brightness(0.25)' }} />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/40 to-surface-dim/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="flex justify-between items-center w-full px-6 py-4 fade-up">
          <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined">expand_more</span>
          </button>
          <h1 className="font-label-caps text-label-caps text-on-surface tracking-wider uppercase">Now Playing</h1>
          <button onClick={handleExplain} className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">{showExplanation ? 'lyrics' : 'auto_awesome'}</span>
          </button>
        </header>

        <div className="flex flex-col items-center px-6 pt-2 fade-up-1">
          <div className="w-full max-w-[300px] text-center mb-4">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface truncate">{currentTrack.title}</h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">{currentTrack.artistName}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar" ref={lyricsRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">Fetching lyrics...</p>
            </div>
          ) : showExplanation && explanation ? (
            <div className="flex flex-col gap-4 py-20 fade-up-2">
              <div className="bg-surface/60 rounded-2xl p-5 border border-outline/10">
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">auto_awesome</span>
                  AI Lyrics Analysis
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">{explanation.summary}</p>
              </div>

              <div className="bg-surface/60 rounded-2xl p-5 border border-outline/10">
                <h4 className="font-label-lg text-label-lg text-on-surface mb-3">Themes</h4>
                <div className="flex flex-wrap gap-2">
                  {explanation.themes.length > 0 ? explanation.themes.map(t => (
                    <span key={t} className="px-3 py-1 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm capitalize">{t}</span>
                  )) : <span className="text-on-surface-variant font-body-sm text-body-sm">No dominant themes detected</span>}
                </div>
              </div>

              <div className="bg-surface/60 rounded-2xl p-5 border border-outline/10">
                <h4 className="font-label-lg text-label-lg text-on-surface mb-3">Details</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col">
                    <span className="font-label-sm text-on-surface-variant">Sentiment</span>
                    <span className="font-body-md text-body-md text-on-surface capitalize">{explanation.sentiment}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-on-surface-variant">Lines</span>
                    <span className="font-body-md text-body-md text-on-surface">{explanation.stats.lineCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-on-surface-variant">Words</span>
                    <span className="font-body-md text-body-md text-on-surface">{explanation.stats.wordCount}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-label-sm text-on-surface-variant">Repetition</span>
                    <span className="font-body-md text-body-md text-on-surface">{explanation.hasRepetition ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              {explanation.structure && (
                <div className="bg-surface/60 rounded-2xl p-5 border border-outline/10">
                  <h4 className="font-label-lg text-label-lg text-on-surface mb-3">Structure</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(explanation.structure).filter(([, v]) => v).map(([k]) => (
                      <span key={k} className="px-3 py-1 rounded-full bg-secondary/10 text-secondary font-label-sm text-label-sm capitalize">{k.replace('has', '')}</span>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setShowExplanation(false)} className="btn-outline rounded-full px-6 py-3 font-body-sm text-body-sm self-center">
                Back to Lyrics
              </button>
            </div>
          ) : lyrics ? (
            <div className="flex flex-col gap-6 py-20 min-h-[300px] fade-up-2">
              {lyrics.map((line, i) => {
                const dist = Math.abs(i - activeLine);
                const opacity = i === activeLine ? 1 : Math.max(0.15, 1 - dist * 0.25);
                const isActive = i === activeLine;
                return (
                  <button
                    key={i}
                    onClick={() => seek(line.time)}
                    className={`text-left transition-all duration-500 ${
                      isActive
                        ? 'text-on-surface text-2xl font-bold scale-105'
                        : 'text-on-surface-variant/50 hover:text-on-surface-variant'
                    }`}
                    style={{ opacity, fontSize: isActive ? '1.5rem' : '1.25rem', textShadow: isActive ? '0 0 20px rgba(214,255,61,0.6), 0 0 40px rgba(214,255,61,0.3)' : 'none', color: isActive ? '#D6FF3D' : undefined }}
                  >
                    {line.text}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <span className="material-symbols-outlined text-on-surface-variant text-[48px] mb-3">lyrics_off</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">No lyrics available for this track</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 bg-gradient-to-t from-black/60 to-transparent fade-up-3">
          <div className="w-full flex flex-col gap-1 mb-4">
            <div className="relative w-full h-6 flex items-center">
              <input type="range" min="0" max={duration} value={currentTime} onChange={e => seek(Number(e.target.value))} className="w-full z-10 cursor-pointer" aria-label="Progress" />
              <div className="absolute top-1/2 left-0 h-1 bg-primary rounded-full pointer-events-none -translate-y-1/2" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-on-surface-variant opacity-70">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          <div className="flex justify-between items-center px-2">
            <button onClick={toggleShuffle} className={`transition-colors ${shuffle ? 'text-primary' : 'text-on-surface-variant'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>shuffle</span>
            </button>
            <button onClick={handlePrev} className="text-on-surface hover:text-primary transition-colors">
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: 36 }}>skip_previous</span>
            </button>
            <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-[0_0_24px_rgba(214,255,61,0.35)] hover:shadow-[0_0_32px_rgba(214,255,61,0.5)] transition-shadow">
              <span className="material-symbols-outlined text-background icon-fill" style={{ fontSize: 36 }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
            </button>
            <button onClick={handleNext} className="text-on-surface hover:text-primary transition-colors">
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: 36 }}>skip_next</span>
            </button>
            <button onClick={cycleRepeat} className={`transition-colors ${repeat !== 'off' ? 'text-primary' : 'text-on-surface-variant'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{repeat === 'one' ? 'repeat_one' : 'repeat'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
