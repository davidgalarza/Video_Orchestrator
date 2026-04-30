# Veo Generative Video Orchestrator

A "Google Flow" inspired workspace for creating cinematic product explainers using Google Veo.

## Features
- **Project Management:** Create and manage multiple video generation flows.
- **Asset Tray:** Upload character and product reference images for consistency.
- **Storyboard:** Sequential scene generation with frame-to-frame continuity.
- **Veo Integration:** Powered by Google's `veo-3.1-generate-preview`.

## Tech Stack
- **Frontend:** React (Vite), Tailwind CSS v4, Lucide Icons.
- **Backend:** FastAPI, SQLAlchemy (SQLite), Google GenAI SDK.
- **Storage:** Google Cloud Storage.

## Setup

### Backend
1. Navigate to `backend/`.
2. Install dependencies: `pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and fill in your GCP details:
   - `GOOGLE_CLOUD_PROJECT`: Your GCP Project ID.
   - `GCS_BUCKET_NAME`: Your Google Cloud Storage bucket name.
   - `GOOGLE_APPLICATION_CREDENTIALS`: Path to your service account JSON.
4. Run the server: `python main.py` or `uvicorn main:app --reload`.

### Frontend
1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Run the development server: `npm run dev`.

## Roadmap
- [x] Phase 1: Environment & Backend Foundation
- [x] Phase 2: Generation Engine (Veo Integration)
- [x] Phase 3: Storyboard UI (React)
- [ ] Phase 4: Final Assembly (Audio & Stitching)
