# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Browser-native architecture - runs entirely in the browser
- IndexedDB storage for projects, scenes, and assets
- Direct Google GenAI SDK integration (@google/genai)
- ffmpeg.wasm for in-browser video stitching
- API key management in Settings (stored in localStorage)
- Video generation progress tracking
- Image generation with Gemini
- Project export with video concatenation

### Changed
- Migrated from Python/FastAPI backend to pure browser-based app
- Moved all source code from `frontend/` to root directory
- Updated all documentation for new architecture

### Removed
- Python backend (FastAPI, SQLAlchemy, SQLite)
- Server-side video processing
- Environment file configuration (.env)
- GCS bucket dependency

## [1.0.0] - 2024-XX-XX

### Added
- Initial browser-native release
- React + TypeScript + Vite frontend
- Tailwind CSS v4 styling
- Project management (create, delete, list)
- Asset management (upload, generate, link/unlink)
- Scene creation with prompt input
- Video generation via Google Veo 3.1
- Frame-to-frame continuity with first frame images
- Video preview and download
- Usage tracking (tokens, cost estimation)
- Dark theme UI
- Responsive sidebar navigation
- MIT License

## Migration Notes

### From Backend Version

If you were using the previous Python backend version:

1. **Data**: Your old SQLite database and files in `data/` are no longer used
2. **API Key**: Previously configured in `.env`, now enter in Settings UI
3. **Architecture**: No server needed - everything runs in browser

To start fresh:
```bash
npm install
npm run dev
```

Then add your Google API key in the Settings page.
