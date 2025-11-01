import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

// Load environment variables robustly:
// 1) Try default CWD `.env`
// 2) If not found, also try `../.env` relative to this file (useful when starting from repo root)
try {
  dotenv.config();
  if (!process.env.OPENAI_API_KEY) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    dotenv.config({ path: path.resolve(__dirname, '../.env') });
  }
} catch {}

// Utility: small fetch with timeout
async function fetchWithTimeout(url, opts = {}, timeoutMs = 5000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...(opts || {}), signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Extract potential entities (movie/book/product/etc.) from visible text using the model
async function extractEntities(client, model, visibleText, visibleSummary) {
  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        { role: 'system', content: 'Extract up to 3 notable real-world entities present in the screenshot (based on visible text and the short summary). Types may include: movie, tv, book, music, product-perfume, product-electronics, product-cosmetics, product, person, game, app, website, brand, other. Only use information that is clearly visible (name/brand/model/author/year). Return ONLY strict JSON, no code fences.' },
        { role: 'user', content: `Visible text:\n${visibleText}\nVisible summary (bullets):\n${visibleSummary}\nReturn JSON shape: {"entities": [{"type":"movie|tv|book|music|product-perfume|product-electronics|product-cosmetics|product|person|game|app|website|brand|other","name":"string","year":number|null,"brand":string|null,"model":string|null,"searchQuery":string,"extra":object|null}]}.\nRules:\n- Choose a compact, useful searchQuery combining name + brand/model if visible (no guessing).\n- Do not invent data.\n- If multiple candidates, prefer the most prominent one (title/logo/large text).` }
      ],
      response_format: { type: 'json_object' },
    });
    const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
    const json = JSON.parse(raw);
    const entities = Array.isArray(json.entities) ? json.entities.slice(0, 3) : [];
    return entities;
  } catch (e) {
    return [];
  }
}

// Provider queries (best-effort, public APIs)
async function wikiSearchAndSummary(title) {
  try {
    // Search
    const q = encodeURIComponent(title);
    const sr = await fetchWithTimeout(`https://en.wikipedia.org/w/rest.php/v1/search/title?q=${q}&limit=1`);
    if (!sr.ok) return null;
    const js = await sr.json();
    const page = js?.pages?.[0];
    const matched = page?.title || title;
    const t = encodeURIComponent(matched);
    // Summary
    const sum = await fetchWithTimeout(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`);
    if (!sum.ok) return null;
    const sj = await sum.json();
    return {
      provider: 'wikipedia',
      title: sj?.title || matched,
      url: sj?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${t}`,
      description: sj?.extract || '',
      image: sj?.thumbnail?.source || null,
      meta: { lang: sj?.lang || 'en' },
    };
  } catch {
    return null;
  }
}

async function omdbLookup(title) {
  const key = process.env.OMDB_API_KEY;
  if (!key) return null;
  try {
    const q = encodeURIComponent(title);
    const res = await fetchWithTimeout(`https://www.omdbapi.com/?t=${q}&apikey=${key}`);
    if (!res.ok) return null;
    const js = await res.json();
    if (js?.Response === 'True') {
      return {
        provider: 'omdb',
        title: js.Title,
        url: `https://www.imdb.com/title/${js.imdbID}`,
        description: `${js.Type}, ${js.Year}. ${js.Genre}. IMDb: ${js.imdbRating}`,
        image: js.Poster && js.Poster !== 'N/A' ? js.Poster : null,
        meta: { year: js.Year, type: js.Type, rating: js.imdbRating },
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function openLibraryLookup(title) {
  try {
    const q = encodeURIComponent(title);
    const res = await fetchWithTimeout(`https://openlibrary.org/search.json?title=${q}&limit=1`);
    if (!res.ok) return null;
    const js = await res.json();
    const doc = js?.docs?.[0];
    if (!doc) return null;
    const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
    return {
      provider: 'openlibrary',
      title: doc.title,
      url: doc.key ? `https://openlibrary.org${doc.key}` : null,
      description: doc.author_name ? `Author: ${doc.author_name.join(', ')}` : '',
      image: cover,
      meta: { year: doc.first_publish_year },
    };
  } catch {
    return null;
  }
}

async function iTunesLookup(title) {
  try {
    const q = encodeURIComponent(title);
    const res = await fetchWithTimeout(`https://itunes.apple.com/search?term=${q}&limit=1`);
    if (!res.ok) return null;
    const js = await res.json();
    const it = js?.results?.[0];
    if (!it) return null;
    return {
      provider: 'itunes',
      title: it.trackName || it.collectionName || it.artistName || title,
      url: it.trackViewUrl || it.collectionViewUrl || it.artistViewUrl || null,
      description: `${it.kind || it.wrapperType || ''} • ${it.primaryGenreName || ''}`.trim(),
      image: it.artworkUrl100 || null,
      meta: { genre: it.primaryGenreName, country: it.country },
    };
  } catch {
    return null;
  }
}

// Lightweight web search via DuckDuckGo HTML, with optional site: filter
async function duckSearch(query, siteDomain) {
  try {
    const q = siteDomain ? `site:${siteDomain} ${query}` : query;
    const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(q)}&kl=us-en`;
    const res = await fetchWithTimeout(url, {}, 6000);
    if (!res.ok) return [];
    const html = await res.text();
    // Very naive anchor extract; DDG wraps results in <a rel="nofollow" class="result__a" href="...">Title</a>
    const items = [];
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gim;
    let m;
    while ((m = re.exec(html)) && items.length < 3) {
      const href = m[1];
      const title = m[2].replace(/<[^>]+>/g, '').trim();
      // Filter unwanted redirect URLs
      if (href && /^https?:\/\//i.test(href)) items.push({ url: href, title });
    }
    return items;
  } catch {
    return [];
  }
}

function isPerfumeEntity(e, summaryText) {
  const n = `${e?.name || ''} ${e?.brand || ''}`.toLowerCase();
  const s = (summaryText || '').toLowerCase();
  const hints = ['perfume', 'parfum', 'eau de parfum', 'edp', 'edt', 'cologne', 'fragrance'];
  return e?.type?.startsWith('product-perfume') || hints.some(h => n.includes(h) || s.includes(h));
}

function isMusicEntity(e, summaryText) {
  const n = `${e?.name || ''}`.toLowerCase();
  const s = (summaryText || '').toLowerCase();
  const hints = ['song', 'album', 'single', 'track', 'artist'];
  return e?.type === 'music' || hints.some(h => n.includes(h) || s.includes(h));
}

function isBookEntity(e, summaryText) {
  const n = `${e?.name || ''}`.toLowerCase();
  const s = (summaryText || '').toLowerCase();
  const hints = ['book', 'author', 'isbn'];
  return e?.type === 'book' || hints.some(h => n.includes(h) || s.includes(h));
}

function isMovieOrTv(e) {
  return e?.type === 'movie' || e?.type === 'tv';
}

function isElectronics(e, summaryText) {
  const n = `${e?.name || ''} ${e?.model || ''}`.toLowerCase();
  const s = (summaryText || '').toLowerCase();
  const hints = ['gb ram', 'mp camera', 'inch', 'hz', 'snapdragon', 'apple m', 'usb-c', 'android', 'ios'];
  return e?.type?.startsWith('product-electronics') || hints.some(h => n.includes(h) || s.includes(h));
}

async function enrichFromInternet(entities, summaryText) {
  const tasks = [];
  for (const e of entities) {
    const name = (e?.name || '').trim();
    if (!name) continue;
    const q = e.searchQuery || name;
    const calls = [];
    // Category-aware providers
    if (isMovieOrTv(e)) calls.push(omdbLookup(q));
    if (isBookEntity(e, summaryText)) calls.push(openLibraryLookup(q));
    if (isMusicEntity(e, summaryText)) calls.push(iTunesLookup(q));
    if (isPerfumeEntity(e, summaryText)) {
      calls.push((async () => {
        const hits = await duckSearch(q, 'www.fragrantica.com');
        return hits[0] ? { provider: 'fragrantica', title: hits[0].title, url: hits[0].url } : null;
      })());
      calls.push((async () => {
        const hits = await duckSearch(q, 'www.sephora.com');
        return hits[0] ? { provider: 'sephora', title: hits[0].title, url: hits[0].url } : null;
      })());
      calls.push((async () => {
        const hits = await duckSearch(q, 'www.notino.com');
        return hits[0] ? { provider: 'notino', title: hits[0].title, url: hits[0].url } : null;
      })());
    }
    if (isElectronics(e, summaryText)) {
      calls.push((async () => {
        const hits = await duckSearch(q, 'www.gsmarena.com');
        return hits[0] ? { provider: 'gsmarena', title: hits[0].title, url: hits[0].url } : null;
      })());
      calls.push((async () => {
        const hits = await duckSearch(q, 'www.amazon.com');
        return hits[0] ? { provider: 'amazon', title: hits[0].title, url: hits[0].url } : null;
      })());
    }
    // General knowledge fallback
    calls.push(wikiSearchAndSummary(q));
    // Generic web fallback (top hit)
    calls.push((async () => {
      const hits = await duckSearch(q);
      return hits[0] ? { provider: 'web', title: hits[0].title, url: hits[0].url } : null;
    })());

    tasks.push(Promise.allSettled(calls).then(results => results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean)));
  }
  const settled = await Promise.allSettled(tasks);
  const sources = [];
  for (const s of settled) {
    if (s.status === 'fulfilled' && Array.isArray(s.value)) {
      for (const v of s.value) sources.push(v);
    }
  }
  // Deduplicate by URL/title/provider
  const seen = new Set();
  const unique = [];
  for (const item of sources) {
    const key = `${item.provider}|${item.url || item.title}`;
    if (!seen.has(key)) { seen.add(key); unique.push(item); }
  }
  return unique.slice(0, 5);
}

const app = express();
const upload = multer({ dest: 'uploads/' });

const PORT = process.env.PORT || 4000;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const origins = process.env.CORS_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: origins || true }));
app.use(express.json());

// Lazily create client only when key exists to allow server to boot without it (e.g., health checks)
function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

app.get('/health', (req, res) => res.json({ ok: true }));

app.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set on server' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided. Use field name "image".' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname || '').replace('.', '').toLowerCase();
    const inputMime = (req.file.mimetype || '').toLowerCase();
    const guessedMime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'heic' ? 'image/heic' : ext === 'heif' ? 'image/heif' : '';
    let mime = guessedMime || inputMime || 'application/octet-stream';

    let buffer = fs.readFileSync(filePath);
    // Clean up temp file asap
    fs.unlink(filePath, () => {});

    // Sniff actual format from buffer regardless of filename/mimetype
    const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']);
    const allowedFormats = new Set(['png', 'jpeg', 'jpg', 'gif', 'webp']);
    let metaFormat = '';
    try {
      const meta = await sharp(buffer).metadata();
      metaFormat = (meta.format || '').toLowerCase();
    } catch (metaErr) {
      // Continue with mime-based detection; we'll still try conversion below
    }

    const looksUnsupported = !allowedMimes.has(mime) || (metaFormat && !allowedFormats.has(metaFormat));
    if (looksUnsupported) {
      try {
        // Convert anything unsupported to JPEG
        const converted = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
        buffer = converted;
        mime = 'image/jpeg';
      } catch (convErr) {
        console.error('Image conversion failed, mime=', mime, 'format=', metaFormat, 'err=', convErr);
        return res.status(415).json({ error: 'Unsupported image type, and conversion failed. Please upload PNG/JPEG/WEBP/GIF.' });
      }
    }

    const b64 = buffer.toString('base64');

    const prompt = req.body?.prompt || (
      'Task: Analyze the screenshot.\n' +
      '1) Extract ALL visible text as precisely as possible (OCR). Do NOT translate this OCR text; keep the original language.\n' +
      '2) Produce a SHORT SUMMARY of 3–9 bullet points. Each bullet must be a full sentence, explaining to a reader what is visible. IMPORTANT: The summary MUST be in English. Only include facts directly visible in the image: page/section structure, headings, buttons/icons, notifications, status bar (time/battery/network), visible app or site name, active view/tab, other visible tabs, language/currency/date formats, etc. If a category is not visible, skip it. Do NOT guess.\n' +
      '3) In the "headings" array, extract the main VISIBLE headings (page or section titles). IMPORTANT: Headings MUST be in English (translate if needed), but remain faithful to what is visible.\n' +
      'Return ONLY JSON: {"text": string, "summary": string[], "headings": string[]} — no extra text.'
    );

    const client = getOpenAI();
    if (!client) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set on server' });
    }
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      messages: [
  { role: 'system', content: 'You are a precise vision OCR+summarizer. Rules: Only state information that is directly visible in the image (text/UI/branding/icons). Do NOT guess platform/app/tab names unless visible. Prefer concise, factual bullet points. The summary and headings MUST be in English. The raw OCR "text" MUST NOT be translated (keep original language). Return ONLY strict JSON without code fences.' },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

  const raw = completion.choices?.[0]?.message?.content?.trim() || '{}';
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      // Try to strip code fences if any
      const cleaned = raw.replace(/^```[a-z]*\n?|```$/g, '');
      json = JSON.parse(cleaned);
    }

  let text = typeof json.text === 'string' ? json.text : '';
  let summary = Array.isArray(json.summary) ? json.summary : [];
  let headings = Array.isArray(json.headings) ? json.headings : [];

    // Fallback: heç bir mətn və xülasə yoxdursa, təsviri xülasə istə
    const empty = (!text || !text.trim()) && (!summary || summary.length === 0);
    if (empty) {
      const client2 = getOpenAI();
      if (!client2) return res.status(500).json({ error: 'OPENAI_API_KEY is not set on server' });
      const completion2 = await client2.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'You are a precise vision assistant. Rules: Only state information that is directly visible in the image (text/UI/branding/icons). Do NOT guess platform/app/tab names unless visible. Be comprehensive but concise in bullets. The summary and headings MUST be in English. The raw OCR "text" MUST NOT be translated (keep original language). Return ONLY strict JSON without code fences.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe the image briefly and provide a short summary of 3–9 bullets as full sentences. Only include facts directly visible (sections, UI elements, icons, notifications, status bar, visible app/site name if present, active view/tab, other visible tabs, etc.). Do NOT guess. Also extract main visible headings in the "headings" array. IMPORTANT: The summary and headings MUST be in English. The raw OCR "text" MUST NOT be translated. Return only JSON: {"text": "", "summary": string[], "headings": string[]}' },
              { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      });
      const raw2 = completion2.choices?.[0]?.message?.content?.trim() || '{}';
      try {
        const j2 = JSON.parse(raw2);
        text = typeof j2.text === 'string' ? j2.text : '';
        summary = Array.isArray(j2.summary) ? j2.summary : [];
        headings = Array.isArray(j2.headings) ? j2.headings : [];
      } catch {}
    }

    // Enrichment: best-effort internet info (run with a soft time cap)
    let enrichment = { entities: [], sources: [] };
    try {
      const client3 = getOpenAI();
      if (client3 && text) {
        const summaryText = Array.isArray(summary) ? summary.join('\n') : '';
        const entities = await extractEntities(client3, MODEL, text, summaryText);
        enrichment.entities = entities;
        // Run sources with overall 7s cap
        const cap = new Promise(resolve => setTimeout(() => resolve([]), 7000));
        const srcPromise = enrichFromInternet(entities, summaryText);
        const sources = await Promise.race([srcPromise, cap]);
        enrichment.sources = Array.isArray(sources) ? sources : [];
      }
    } catch (e) {
      // ignore enrichment failures
    }

    res.json({ text, summary, headings, enrichment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analysis failed', details: String(err?.message || err) });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
