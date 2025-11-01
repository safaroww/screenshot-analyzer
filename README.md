# Screenshot Summarize (Expo + OpenAI)

A simple React Native (Expo) app that extracts text from a screenshot and summarizes it using OpenAI, backed by a tiny Node.js proxy server to keep your API key safe.

## What’s inside

- `mobile/`: Expo app (TypeScript) with Image Picker and a one-tap Analyze flow
- `server/`: Express server that receives an image, calls OpenAI Vision, and returns `{ text, summary }`

## Prerequisites

- Node.js 18+
- An OpenAI API key

## Setup

1. Server (recommended to run first)
   - Copy `.env.example` to `.env` inside `server/` and set your key:
     ```env
  OPENAI_API_KEY=sk-...
  PORT=4000
  # Screenshot Summarize — macOS Setup (Xcode only)

  This guide helps you run the app on a Mac that only has Xcode installed (no Node/PNPM/Yarn yet). You’ll install the minimal tools, start the backend server, and launch the iOS Simulator.

  > Note: The project has two parts:
  > - `server/` — Node/Express API that calls OpenAI.
  > - `mobile/` — Expo React Native app (iOS Simulator).

  ## 1) One‑time prerequisites

  1. Install Homebrew (if you don’t have it):

  ```bash
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  ```

  2. Install Node.js and Watchman (for React Native/Metro):

  ```bash
  brew install node watchman
  ```

  - Node 18+ is supported; Node 20 LTS is recommended. If you prefer `nvm` for version control:

  ```bash
  brew install nvm
  mkdir -p ~/.nvm
  echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.zshrc
  echo '[ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"' >> ~/.zshrc
  source ~/.zshrc
  nvm install 20
  nvm use 20
  ```

  3. Ensure Xcode command line tools are installed and iOS Simulator is available (open Xcode once).

  ## 2) Clone and configure the repo

  ```bash
  git clone <YOUR_REPO_URL>
  cd screenshot-summorize
  ```

  ### Server env (.env)
  Create `server/.env` with your OpenAI API key:

  ```properties
  # server/.env
  OPENAI_API_KEY=your_api_key_here
  PORT=4000
  OPENAI_MODEL=gpt-4o-mini
  ```

  Important: If a real key appeared in prior commits or screenshots, rotate it in the OpenAI dashboard.

  ## 3) Install and run the server (API)

  ```bash
  cd server
  npm install
  npm run dev
  ```

  - Server runs on http://localhost:4000
  - Health check: http://localhost:4000/health

  Keep this terminal running.

  ## 4) Install and run the mobile app (iOS Simulator)

  Open a new terminal window/tab:

  ```bash
  cd mobile
  npm install
  # Point the app to the local server
  export EXPO_PUBLIC_API_BASE_URL="http://localhost:4000"
  # Launch iOS Simulator
  npx expo start --ios --clear
  ```

  - If the Simulator doesn’t auto‑open, run `open -a Simulator` once and try again.
  - First build can be slow; the app will load in the Simulator.

  ## 5) Using the app
  - Tap the big card to choose a screenshot (or use the in‑app camera), then press Analyze.
  - Free users: 1 analysis per day.
  - Subscription/Trial (client‑side): Selecting a plan will start a 3‑day local trial.

  ## Troubleshooting
  - Port busy (8081, Metro):
    ```bash
    lsof -i:8081 | awk 'NR>1{print $2}' | xargs kill -9
    ```
  - Server not reachable in the app:
    - Ensure the server terminal shows “listening on 0.0.0.0:4000”.
    - Confirm `EXPO_PUBLIC_API_BASE_URL` is exported in the same terminal where you run `expo start`.
    - Try LAN mode in Expo Dev Tools if needed.
  - Photos/Camera permission:
    - iOS Settings → Simulator → Privacy → Photos/Camera; or in the real device’s Settings for Expo Go builds.
  - Slow bundles:
    ```bash
    npx expo start --ios --no-dev --minify
    ```

  ## Notes
  - This repo is configured with a `.gitignore` for Expo RN and Node. Large folders like `node_modules/`, `ios/`, `android/` are ignored.
  - For production payments, use real IAP (e.g., `react-native-iap` or RevenueCat) and server‑side receipt validation. The current trial is local (client‑side) for MVP/testing.
  - If you need to run on a real iPhone without building a native binary, you can also use Expo Go via QR code from the Dev Tools (requires the phone and Mac to be on the same network).
