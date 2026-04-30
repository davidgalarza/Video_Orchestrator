# Project Plan: Veo Generative Video Orchestrator

This document outlines the technical architecture, database schema, and implementation steps for building a custom video generation tool using Google Veo, FastAPI, React, and SQLite.

## 1. Project Overview
A "Google Flow" inspired workspace for creating cinematic product explainers. It maintains character and style consistency across multiple scenes using reference images and frame-to-frame continuity.

## 2. Technical Stack
- **Frontend:** React (Vite), Tailwind CSS, Lucide Icons, Axios.
- **Backend:** FastAPI (Python 3.10+).
- **Database:** SQLite (SQLAlchemy ORM).
- **AI Models:** Google Veo 3.1 (`veo-3.1-generate-preview`), Vertex AI TTS.
- **Processing:** FFmpeg (for stitching and overlays).
- **Storage:** Google Cloud Storage (GCS) for media assets.

## 3. Database Schema (SQLite)

### Table: `projects`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `name` | String | Project Title |
| `system_prompt` | Text | Global style/lighting instructions |
| `created_at` | DateTime | Timestamp |

### Table: `assets`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `project_id` | UUID | Foreign Key (projects) |
| `type` | String | 'CHARACTER', 'PRODUCT', 'STYLE' |
| `gcs_uri` | String | Path in Google Cloud Storage |

### Table: `scenes`
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `project_id` | UUID | Foreign Key (projects) |
| `order` | Integer | Sequence order (1, 2, 3...) |
| `prompt` | Text | Scene-specific action |
| `status` | String | 'pending', 'processing', 'completed', 'failed' |
| `video_uri` | String | Resulting GCS URI |
| `operation_id`| String | Google Vertex AI Operation Name |

## 4. Implementation Roadmap

### Phase 1: Environment & Backend Foundation
1.  **GCP Setup:** Enable Vertex AI API and create a GCS bucket.
2.  **FastAPI Setup:** Initialize SQLAlchemy with SQLite.
3.  **Authentication:** Configure `GOOGLE_APPLICATION_CREDENTIALS`.
4.  **Endpoints:** - `POST /projects`: Create a new flow.
    - `POST /projects/{id}/assets`: Upload character/product reference images to GCS.

### Phase 2: The Generation Engine
1.  **Scene Orchestration:** Implement logic to fetch the `video_uri` of `Scene[n-1]` and inject it as `first_frame_image` for `Scene[n]`.
2.  **Veo Integration:** Use `google-genai` SDK to trigger asynchronous generation.
3.  **Background Worker:** Create a polling mechanism (or use FastAPI `BackgroundTasks`) to monitor Google Operations and update SQLite status.

### Phase 3: The Storyboard UI (React)
1.  **Project Dashboard:** View and create video projects.
2.  **Asset Tray:** A sidebar to manage "Ingredients" (Character/Product images).
3.  **The Canvas:** A vertical list of Scene Cards showing:
    - Prompt input.
    - Status badges (Processing/Done).
    - Video preview once complete.
4.  **Global Controls:** Settings for System Prompt and Aspect Ratio.

### Phase 4: Final Assembly
1.  **Audio Integration:** Generate a script via LLM and convert to audio via Vertex TTS.
2.  **The Stitcher:** A FastAPI service using FFmpeg to:
    - Download all scene `.mp4` files.
    - Concatenate them into a master file.
    - Overlay audio and (optionally) captions.
3.  **Signed URLs:** Generate temporary HTTPS links for the frontend to display private GCS content.

## 5. Key Veo Configuration Logic
For each scene generation, the tool will programmatically construct the following config:

```python
config = {
    "prompt": project.system_prompt + scene.prompt,
    "reference_images": [
        {"uri": char_asset.uri, "type": "CHARACTER"},
        {"uri": product_asset.uri, "type": "SUBJECT"}
    ],
    "first_frame_image": prev_scene_last_frame, # For continuity
    "generate_audio": True,
    "aspect_ratio": "16:9"
}
```
## 6. Local Development Setup
1.  Clone repository.
2.  `pip install -r requirements.txt`
3.  `npm install` in frontend folder.
4.  Set up `.env` with `PROJECT_ID` and `GCS_BUCKET`.
5.  Run `uvicorn main:app` and `npm run dev`.