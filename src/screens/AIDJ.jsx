import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { useI18n } from '../context/I18nContext';
import { songs, getMoodPlaylist } from '../data/library';

const MOOD_KEYWORDS = {
  energetic: ['energetic', 'energy', 'workout', 'hype', 'pump', 'fast', 'intense', 'party'],
  chill: ['chill', 'calm', 'relax', 'slow', 'mellow', 'peaceful', 'quiet', 'wind down', 'soothe'],
  romantic: ['romantic', 'love', 'date', 'sweet', 'tender', 'passion'],
  epic: ['epic', 'power', 'strong', 'anthem', 'epic', 'movie', 'dramatic'],
  sad: ['sad', 'sad songs', 'moody', 'melancholy', 'heartbreak', 'depress'],
  tamil: ['tamil', 'anirudh', 'yuvan', 'ilaiyaraaja', 'kuthu', 'desi'],
  electronic: ['electronic', 'edm', 'synth', 'synthwave', 'techno', 'dance', 'rave'],
};

function detectMood(text) {
  const lower = text.toLowerCase();
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return mood;
  }
  return null;
}

function generateResponse(mood, matchedTracks) {
  const count = matchedTracks.length;
  const titles = matchedTracks.slice(0, 3).map(t => t.title).join(', ');
  const artistNames = [...new Set(matchedTracks.map(t => t.artistName))].slice(0, 2).join(' & ');

  const responses = {
    energetic: `Found ${count} high-energy tracks to get you moving. Starting with ${titles}. ${artistNames} bring the heat!`,
    chill: `${count} mellow tracks coming up. ${titles} — perfect for unwinding.`,
    romantic: `Here's ${count} romantic tracks to set the mood. ${titles} and more.`,
    epic: `${count} epic tracks queued up. ${titles} — turn up the volume!`,
    sad: `${count} soulful tracks for the mood. ${titles}. Take your time.`,
    tamil: `Found ${count} Tamil tracks including ${titles}. ${artistNames} never disappoints!`,
    electronic: `${count} electronic tracks on deck. ${titles}. Let the beats drop!`,
  };

  return responses[mood] || `Found ${count} tracks matching your request. Playing ${titles}.`;
}

export default function AIDJ() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { audio, addRecentlyPlayed, getTopGenres, getTopArtists } = useApp();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [lastTracks, setLastTracks] = useState([]);

  const topGenres = getTopGenres();
  const topGenre = topGenres[0] || 'Tamil Hits';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('AI_DJ_GREETING_MORNING');
    if (hour < 18) return t('AI_DJ_GREETING_AFTERNOON');
    return t('AI_DJ_GREETING_EVENING');
  };

  // No skeleton here, deliberately. This screen has no initial data request:
  // `messages` is seeded synchronously with a greeting above, `topGenres` comes
  // from the already-loaded context, and the only pending state is `isThinking`,
  // which belongs to an in-flight AI reply rather than page load. Its existing
  // indicator is left as it is, and no recommendations are invented.
  if (messages.length === 0) {
    setMessages([{
      role: 'ai',
      text: `${getGreeting()}! I'm your Kay Chart AI DJ. Based on your listening, you seem to enjoy ${topGenre || 'a variety of music'}. Tell me what mood you're in, or tap a suggestion below.`
    }]);
  }

  const QUICK_PROMPTS = [
    t('AI_DJ_PROMPT_ENERGETIC'),
    t('AI_DJ_PROMPT_MORE_GENRE', { genre: topGenre || 'Tamil Hits' }),
    t('AI_DJ_PROMPT_CHILL'),
    t('AI_DJ_PROMPT_SURPRISE'),
    t('AI_DJ_PROMPT_ROMANTIC'),
    t('AI_DJ_PROMPT_WORKOUT'),
  ];

  const sendMessage = (text) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setIsThinking(true);

    setTimeout(() => {
      const mood = detectMood(text);
      let matchedTracks;
      let responseText;

      if (mood === 'surprise' || text.toLowerCase().includes('surprise')) {
        matchedTracks = [...songs].sort(() => Math.random() - 0.5).slice(0, 8);
        responseText = `Here's a surprise mix! ${matchedTracks.slice(0, 3).map(t => t.title).join(', ')} and more. Enjoy the unexpected!`;
      } else if (mood) {
        matchedTracks = getMoodPlaylist(mood, songs);
        responseText = generateResponse(mood, matchedTracks);
      } else {
        matchedTracks = songs.filter(s =>
          s.title.toLowerCase().includes(text.toLowerCase()) ||
          s.artistName.toLowerCase().includes(text.toLowerCase()) ||
          s.genre.toLowerCase().includes(text.toLowerCase())
        );
        if (matchedTracks.length === 0) {
          matchedTracks = [...songs].sort(() => Math.random() - 0.5).slice(0, 5);
          responseText = `I couldn't find exact matches for "${text}", but here are some tracks you might enjoy based on your taste.`;
        } else {
          responseText = `Found ${matchedTracks.length} tracks matching "${text}". Playing ${matchedTracks[0]?.title} first.`;
        }
      }

      setLastTracks(matchedTracks);
      setMessages(prev => [...prev, { role: 'ai', text: responseText }]);
      setIsThinking(false);
    }, 1200);
  };

  const startListening = () => {
    if (lastTracks.length > 0) {
      addRecentlyPlayed(lastTracks[0].id);
      audio.play(lastTracks[0], lastTracks);
      navigate('/now-playing');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background page-enter">
      <header className="flex justify-between items-center w-full px-6 py-4 bg-background/70 backdrop-blur-xl">
        <div className="flex items-center gap-3 fade-up">
          <div className="bg-gradient-to-r from-primary to-primary-container w-10 h-10 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(214,255,61,0.3)]">
            <span className="material-symbols-outlined text-background text-[20px] icon-fill">auto_awesome</span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">{t('AI_DJ_HEADING')}</h1>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-label-caps text-[10px] text-on-surface-variant">{t('AI_DJ_STATUS')}</span>
            </div>
          </div>
        </div>
        <button onClick={() => navigate(-1)} className="text-on-surface-variant hover:text-on-surface transition-colors press-feedback">
          <span className="material-symbols-outlined">close</span>
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} fade-up`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-surface-container-high text-on-surface rounded-br-md'
                : 'bg-surface-card border border-primary/20 shadow-[0_0_12px_rgba(214,255,61,0.08)] text-on-surface rounded-bl-md'
            }`}>
              {msg.role === 'ai' && i === messages.length - 1 && messages.length > 1 && (
                <div className="flex items-center gap-2 mb-2">
                  <div className="px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-primary-container">
                    <span className="material-symbols-outlined text-background text-[10px] icon-fill">auto_awesome</span>
                  </div>
                  <span className="font-label-caps text-[10px] text-primary">{t('AI_DJ_BADGE')}</span>
                </div>
              )}
              <p className="font-body-sm text-body-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start fade-up">
            <div className="glass-panel rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary/30 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Quick Suggestions */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          {QUICK_PROMPTS.map(prompt => (
            <button key={prompt} onClick={() => sendMessage(prompt)} className="px-4 py-2 rounded-full bg-surface-card text-on-surface-variant border border-border-subtle hover:border-primary/40 hover:text-primary font-body-sm text-body-sm whitespace-nowrap transition-all press-feedback shrink-0">
              {prompt}
            </button>
          ))}
        </div>

        {/* Start Listening CTA */}
        {lastTracks.length > 0 && (
          <button onClick={startListening} className="btn-primary rounded-full h-12 flex items-center justify-center font-headline-md text-headline-md mx-8 press-feedback">
            <span className="material-symbols-outlined text-[20px] mr-2 icon-fill">play_arrow</span>
            {t('AI_DJ_PLAY_TRACKS', { count: lastTracks.length })}
          </button>
        )}
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-3 border-t border-border-subtle">
        <div className="bg-surface-card rounded-full flex items-center px-4 h-12 w-full border border-border-subtle border-glow">
          <input
            className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-body-sm text-body-sm placeholder:text-on-surface-variant/50 p-0"
            placeholder={t('AI_DJ_INPUT_PLACEHOLDER')}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          />
          <button onClick={() => sendMessage(input)} className="ml-2 text-primary hover:text-primary-hover transition-colors press-feedback">
            <span className="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
