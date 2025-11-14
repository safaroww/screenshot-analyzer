import OpenAI from 'openai';
import formidable from 'formidable';
import fs from 'fs/promises';
import sharp from 'sharp';

export const config = {
  api: {
    bodyParser: false,
  },
};

function ensureClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

async function parseMultipart(req) {
  const form = formidable({ multiples: false, keepExtensions: true, maxFileSize: 20 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const client = ensureClient();
    if (!client) return res.status(500).json({ error: 'OPENAI_API_KEY is not set on server' });

    const { fields, files } = await parseMultipart(req);
    const fileItem = files?.image;

    if (!fileItem) return res.status(400).json({ error: 'No image provided. Use field name "image".' });
    const first = Array.isArray(fileItem) ? fileItem[0] : fileItem;
    const filepath = first?.filepath || first?.path;
    if (!filepath) return res.status(400).json({ error: 'Upload failed: no file path' });

    let buffer = await fs.readFile(filepath);

    // Convert to JPEG if unsupported
    let metaFormat = '';
    try {
      const meta = await sharp(buffer).metadata();
      metaFormat = (meta.format || '').toLowerCase();
    } catch {}

    const allowedFormats = new Set(['png', 'jpeg', 'jpg', 'gif', 'webp']);
    if (!allowedFormats.has(metaFormat)) {
      try {
        buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
        metaFormat = 'jpeg';
      } catch {
        return res.status(415).json({ error: 'Unsupported image type, and conversion failed. Please upload PNG/JPEG/WEBP/GIF.' });
      }
    }

    const mime = metaFormat === 'png' ? 'image/png' : metaFormat === 'gif' ? 'image/gif' : metaFormat === 'webp' ? 'image/webp' : 'image/jpeg';
    const b64 = Buffer.from(buffer).toString('base64');

    const prompt = (fields?.prompt?.toString()) || (
      'Task: Analyze the screenshot.\n' +
      '1) Extract ALL visible text as precisely as possible (OCR). Do NOT translate this OCR text; keep the original language.\n' +
      '2) Produce a SHORT SUMMARY of 3–9 bullet points in English. Only include facts directly visible in the image.\n' +
      '3) Extract main visible headings in English in the "headings" array.\n' +
      'Return ONLY JSON: {"text": string, "summary": string[], "headings": string[]}'
    );

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.1,
      messages: [
        { role: 'system', content: 'You are a precise vision OCR+summarizer. Return ONLY strict JSON without code fences.' },
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
      const cleaned = raw.replace(/^```[a-z]*\n?|```$/g, '');
      json = JSON.parse(cleaned);
    }

    const text = typeof json.text === 'string' ? json.text : '';
    const summary = Array.isArray(json.summary) ? json.summary : [];
    const headings = Array.isArray(json.headings) ? json.headings : [];
    return res.status(200).json({ text, summary, headings, enrichment: { entities: [], sources: [] } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Analysis failed', details: String(err?.message || err) });
  }
}
