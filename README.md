# Veo Generative Video Orchestrator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-Latest-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Google AI](https://img.shields.io/badge/Google%20AI-Veo%203.1-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)

A **browser-native**, "Google Flow" inspired workspace for creating cinematic product explainers using Google Veo. No server required - runs entirely in your browser.

## Features

- **Project Management** - Create and manage multiple video generation flows
- **Asset Tray** - Upload character and product reference images for consistency
- **Storyboard** - Sequential scene generation with frame-to-frame continuity
- **Video Stitching** - Concatenate scenes into final videos (in-browser via ffmpeg.wasm)
- **Image Generation** - Generate reference images with Gemini
- **Veo Integration** - Powered by Google's `veo-3.1-generate-preview`

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS v4
- **Storage:** IndexedDB (browser-native database)
- **Video Processing:** ffmpeg.wasm (WebAssembly)
- **AI SDK:** @google/genai (direct browser calls)
- **Icons:** Lucide React

## Prerequisites

- **Google AI API Key** - Get yours at [https://ai.google.dev/](https://ai.google.dev/)
- **Modern Browser** - Chrome/Edge 90+, Firefox 90+, or Safari 15+

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Setup

1. **Get API Key**
   - Visit [Google AI Studio](https://ai.google.dev/)
   - Create or select a project
   - Generate an API key

2. **Configure the App**
   - Open the app in your browser
   - Go to **Settings** (gear icon in sidebar)
   - Enter your API key in the "Google API Key" section
   - Click **Save Key**
   - Click **Test** to verify

3. **Create Your First Project**
   - Click **+** next to "Active Flows" in the sidebar
   - Enter a project name
   - Start adding scenes!

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   React UI   │  │  IndexedDB   │  │  @google/genai  │  │
│  │              │  │  (Data)      │  │  (AI Calls)     │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         │                 │                    │           │
│         └─────────────────┴────────────────────┘           │
│                           │                                 │
│                    ┌──────────────┐                        │
│                    │ ffmpeg.wasm  │                        │
│                    │ (Video Edit) │                        │
│                    └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  Google AI API  │
                    │ (Veo & Gemini)  │
                    └─────────────────┘
```

## Data Storage

All data is stored locally in your browser:

| Storage | Purpose | Data |
|---------|---------|------|
| **IndexedDB** | Projects, Scenes, Assets | Videos, Images, Metadata |
| **localStorage** | Settings | API Key, Model Config |

**Note:** Videos are stored as blobs in IndexedDB. Large projects may approach browser storage limits (~50-100MB depending on browser).

## Privacy & Security

- **Your API key** is stored only in your browser's localStorage
- **Your videos and images** never leave your device except when sent to Google's API for generation
- **No backend server** - everything runs client-side
- **No tracking or analytics** - completely private

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Browser Compatibility

| Feature | Chrome/Edge | Firefox | Safari |
|---------|-------------|---------|--------|
| IndexedDB | ✅ 90+ | ✅ 90+ | ✅ 15+ |
| WebAssembly | ✅ 90+ | ✅ 90+ | ✅ 15+ |
| File System Access | ✅ 86+ | ⚠️ Partial | ⚠️ Partial |

## Roadmap

- [x] Browser-only architecture
- [x] IndexedDB data storage
- [x] Google GenAI direct integration
- [x] ffmpeg.wasm video stitching
- [x] API key management in settings
- [ ] Audio generation and overlay
- [ ] Caption/subtitle support
- [ ] Export to different formats
- [ ] Offline mode improvements

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## Acknowledgments

- [Google GenAI SDK](https://github.com/googleapis/js-genai)
- [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)
- [idb](https://github.com/jakearchibald/idb) - IndexedDB wrapper
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)

## Troubleshooting

### "API key not configured"
Go to Settings and add your Google API key.

### "IndexedDB not available"
Ensure you're not in private/incognito mode. Some browsers disable IndexedDB in private mode.

### Video generation fails
Check browser console for errors. Common issues:
- API quota exceeded
- API key not valid
- Network issues

### ffmpeg.wasm fails to load
Ensure you have a stable internet connection for the initial WASM download (~25MB).

---

**Made with ❤️ for the open-source community**
