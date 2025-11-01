# Deploy server to Vercel

This `server/` folder is a standalone Vercel project using Serverless Functions under `api/`.

Endpoints:
- `GET /api/health` → `{ ok: true }`
- `POST /api/analyze` → multipart form data with field `image` (file) and optional `prompt` (text)

## 1) Create the Vercel project

```bash
# from repo root or server/
cd server
npx vercel
# Follow prompts → scope, create new project → framework: Other → root directory: server
# For production deployment later:
# npx vercel --prod
```

If asked for output directory, leave empty (functions deploy from `api/`).

## 2) Set Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables:
- `OPENAI_API_KEY` = your key (Required)
- Optional:
  - `OPENAI_MODEL` = gpt-4o-mini (default)
  - `OMDB_API_KEY` (not required for minimal analyze)

Re-deploy after adding env variables.

## 3) Test the endpoints

```bash
curl -s https://<your-app>.vercel.app/api/health

# Upload an image
curl -s -X POST \
  -F image=@/path/to/image.png \
  https://<your-app>.vercel.app/api/analyze | jq
```

## 4) Point the mobile app to Vercel

In `mobile/ios/.xcode.env.local` set:

```
export EXPO_PUBLIC_API_BASE_URL=https://<your-app>.vercel.app
```

Rebuild the iOS app (Clean Build Folder → Run). The app will call:
- `GET https://<your-app>.vercel.app/health` (rewritten to `/api/health` by vercel.json)
- `POST https://<your-app>.vercel.app/analyze` (rewritten to `/api/analyze` by vercel.json)

## Notes
- CORS is enabled with `Access-Control-Allow-Origin: *` in the functions.
- The serverless function uses `formidable` and `sharp` to handle image uploads and conversion.
- For larger images, keep uploads < 5–10MB to avoid timeouts/limits on free tiers.
