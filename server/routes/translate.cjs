const express = require('express');
const router = express.Router();

const cache = new Map();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Simple rate limiter: 10 requests per minute per IP
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimit.get(ip);
  if (!record || now - record.start > RATE_LIMIT_WINDOW) {
    rateLimit.set(ip, { start: now, count: 1 });
    return true;
  }
  record.count++;
  return record.count <= RATE_LIMIT_MAX;
}

// Batch translate using MyMemory API (free, 5000 chars/day)
async function translateBatch(texts, targetLang) {
  const joined = texts.join('\n');
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(joined)}&langpair=en|${targetLang}`;
  
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    headers: {
      'User-Agent': 'Nocturne/1.0',
    },
  });
  
  if (!res.ok) throw new Error(`MyMemory ${res.status}`);
  const data = await res.json();
  
  if (data.responseStatus !== 200 && data.responseStatus !== '200') {
    throw new Error(data.responseData?.translatedText || 'Translation failed');
  }
  
  const translated = data.responseData.translatedText;
  // MyMemory returns translated text with \n separators
  const results = translated.split('\n');
  
  // If the count doesn't match, it might be concatenated — return as-is for each text
  if (results.length === texts.length) return results;
  
  // Fallback: wrap original text
  return texts;
}

// Alternative: Google Translate (free endpoint, more reliable from server)
async function googleTranslateBatch(texts, targetLang) {
  const joined = texts.join('\n');
  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'en',
    tl: targetLang,
    dt: 't',
    q: joined,
  });
  
  const res = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
    signal: AbortSignal.timeout(20000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  
  if (!res.ok) throw new Error(`Google Translate ${res.status}`);
  const data = await res.json();
  
  if (!data[0]) throw new Error('Empty response');
  
  return data[0].map(item => item[0]);
}

// POST /api/translate
// Body: { keys: { KEY: "English text", ... }, targetLang: "ja" }
router.post('/', async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const { keys, targetLang } = req.body;
    if (!keys || !targetLang || targetLang === 'en') {
      return res.json({ translations: {} });
    }
    
    // Check cache
    const cacheKey = `${targetLang}:${JSON.stringify(Object.keys(keys).sort())}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return res.json({ translations: cached.data, cached: true });
    }
    
    const keyList = Object.keys(keys);
    const textList = keyList.map(k => keys[k]);
    
    // Split into batches of 15 to stay under character/time limits
    const BATCH_SIZE = 15;
    const translations = {};
    
    for (let i = 0; i < keyList.length; i += BATCH_SIZE) {
      const batchKeys = keyList.slice(i, i + BATCH_SIZE);
      const batchTexts = textList.slice(i, i + BATCH_SIZE);
      
      try {
        const results = await googleTranslateBatch(batchTexts, targetLang);
        batchKeys.forEach((key, idx) => {
          if (results[idx]) translations[key] = results[idx];
        });
      } catch (e) {
        // Fallback to MyMemory
        try {
          const results = await translateBatch(batchTexts, targetLang);
          batchKeys.forEach((key, idx) => {
            if (results[idx]) translations[key] = results[idx];
          });
        } catch (e2) {
          console.error(`Translation batch failed:`, e2.message);
        }
      }
      
      // Delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < keyList.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    // Cache result
    if (Object.keys(translations).length > 0) {
      cache.set(cacheKey, { data: translations, ts: Date.now() });
    }
    
    res.json({ translations });
  } catch (e) {
    console.error('[Translate]', e.message);
    res.json({ translations: {}, error: 'Translation failed' });
  }
});

module.exports = router;
