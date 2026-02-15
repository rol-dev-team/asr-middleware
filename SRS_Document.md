% ASR Middleware – Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) describes the functional and non-functional requirements of the **ASR Middleware** project. The document is intended for:
- Backend developers (FastAPI, SQLModel, PostgreSQL)
- Frontend developers (React, Vite)
- DevOps / Infrastructure engineers (Docker, docker-compose, Nginx, HTTPS)
- Test engineers and technical stakeholders

It should be used as the primary reference when implementing, testing, and maintaining the system.

### 1.2 Scope
**ASR Middleware** is a web-based solution that provides middleware services for Automatic Speech Recognition (ASR) and meeting intelligence. The system allows authenticated users to:
- Upload audio recordings
- Transcribe audio (Bangla + English) into **Banglish** (Bangla in Roman/Latin script)
- Translate Banglish transcriptions into natural English
- Generate meeting analyses (summary, insights, action items, topics) from translated text
- View histories of transcriptions, translations, and analyses

The project consists of:
- A **backend** service implemented in FastAPI with async SQLModel, using Google Gemini APIs for transcription, translation, and analysis.
- A **frontend** single-page application (SPA) implemented in React/Vite.
- Deployment artifacts based on Docker, docker-compose, and Nginx (including HTTPS helpers).

### 1.3 Definitions, Acronyms, and Abbreviations
- **ASR** – Automatic Speech Recognition.
- **Banglish** – Bangla language written using the Roman/Latin script.
- **API** – Application Programming Interface.
- **SPA** – Single Page Application.
- **JWT** – JSON Web Token.
- **Middleware (in this context)** – Service layer between client applications and AI models that provides orchestration, persistence, and security.

### 1.4 References
- [README.md](README.md)
- [QUICKSTART.md](QUICKSTART.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [HTTPS_QUICKSTART.md](HTTPS_QUICKSTART.md)
- [CI-CD-QUICKREF.md](CI-CD-QUICKREF.md)
- Backend API entrypoint: [backend/app/api/main.py](backend/app/api/main.py)
- Example routers:
	- [backend/app/api/v1/routers/audios.py](backend/app/api/v1/routers/audios.py)
	- [backend/app/api/v1/routers/translations.py](backend/app/api/v1/routers/translations.py)
	- [backend/app/api/v1/routers/auth.py](backend/app/api/v1/routers/auth.py)

### 1.5 Overview
The remainder of this document describes the overall product perspective and major features (Section 2), detailed functional requirements (Section 3), non-functional requirements (Section 4), data and persistence (Section 5), external interfaces (Section 6), and deployment / environment requirements (Section 7).

## 2. Overall Description

### 2.1 Product Perspective
ASR Middleware is a standalone web service and SPA that can be used by internal and external clients to handle meeting audio and generate actionable insights. The system:
- Exposes a versioned REST API (`/api/v1/...`) via FastAPI.
- Persists users, authentication tokens, audio transcription metadata and content, translations, and analyses in a relational database (PostgreSQL via SQLModel).
- Integrates with Google Gemini APIs for:
	- Audio transcription
	- Text translation
	- Analytical summarization and markdown note generation
- Serves (or is fronted by) a React SPA 
	- Login and registration
	- Audio recording/upload UI
	- Lists and details for meetings, transcriptions, translations, and analyses

### 2.2 Product Functions (High-Level)
At a high level, the system provides:
1. **User Management & Authentication**
	 - Register new users.
	 - Authenticate existing users and issue JWT access/refresh tokens.
	 - Refresh tokens and blacklist tokens on logout.
	 - Retrieve the currently authenticated user profile.

2. **Audio Management & Transcription**
	 - Securely upload audio files.
	 - Validate that uploads are audio content.
	 - Store audio files in a per-user directory structure under `media/`.
	 - Invoke Google Gemini audio models to produce Banglish transcription text.
	 - Persist transcription metadata (filename, size, mime type, timestamps) and transcribed text.
	 - List and paginate a user’s previous audio transcriptions.

3. **Translation (Banglish → English)**
	 - Accept a transcription ID and optional override text.
	 - Use Gemini to translate Banglish to natural English.
	 - Extract or estimate a confidence score.
	 - Persist translations linked to source transcriptions.
	 - List and view individual translation records.

4. **Meeting Analysis**
	 - Accept an English translation and request a structured meeting analysis.
	 - Generate summary, business insights, technical insights, action items, and key topics.
	 - Optionally generate markdown meeting notes.
	 - Persist analyses linked to translations.
	 - Retrieve analyses by translation.

5. **Frontend SPA**
	 - User-facing login and registration.
	 - Interface for recording/uploading audio (meeting recorder), listing meetings, and viewing analyses.
	 - Integration with backend REST API via `src/services/api.js`.

6. **Health and Administration**
	 - Provide a `/health` endpoint for liveness checks.
	 - Provide internal admin routes (see `app/api/v1/internal/admin.py`) for operational needs (exact behaviors are implementation-specific).

### 2.3 User Classes and Characteristics
- **End Users (Business / Technical)**
	- Non-technical or semi-technical.
	- Use browser UI to upload/record meetings, review analyses, and export notes.

- **Developers / Integrators**
	- Consume the REST API directly for automation or integration with other systems.
	- Require authentication and role-based access to specific features.

- **Admins / DevOps**
	- Deploy and operate the system.
	- Monitor logs, configure credentials (Gemini API key), and manage persistence.

### 2.4 Operating Environment
- **Backend**
	- Python 3.x
	- FastAPI, SQLModel, async/await
	- PostgreSQL (or compatible relational database)
	- Google Gemini API access via network
	- Running in Docker containers (see `backend/Dockerfile`, root `docker-compose.yml`, `docker-compose.prod.yml`)

- **Frontend**
	- React + Vite SPA (see `frontend/`)
	- Modern browsers (Chrome, Edge, Firefox, Safari – latest 2 versions)

- **Infrastructure**
	- Nginx reverse proxy (see `nginx/` and `frontend/nginx.conf`)
	- Optional HTTPS termination (see `HTTPS_QUICKSTART.md`, `generate-ssl-cert.*`)

### 2.5 Design and Implementation Constraints
- Must use Google Gemini APIs; availability and quota of these services constrain functionality.
- Audio files may be large; storage and network bandwidth must be considered.
- System must respect environment-based configuration (e.g., `GEMINI_API_KEY`).
- Must support CORS for the SPA (`allow_origins=["*"]` currently configured).

### 2.6 Assumptions and Dependencies
- Users have stable internet connectivity for uploads and AI calls.
- Google Gemini API is reachable and configured correctly.
- Persistent storage (DB and media filesystem) is available and reasonably sized.
- Time synchronization across services is sufficient for token expiration and timestamps.

## 3. Specific Functional Requirements

### 3.1 Authentication & User Management

#### 3.1.1 User Registration
- **ID**: FR-AUTH-REGISTER
- **Description**: System shall support registering new users.
- **API**: `POST /api/v1/auth/register`
- **Input**: `username`, `email`, `full_name`, `password`.
- **Rules**:
	- Username must be unique.
	- Email must be unique.
	- Password shall be hashed using the configured hashing algorithm before storage.
- **Output**: Basic user representation (no plain-text password).
- **Errors**:
	- 400 if username already registered.
	- 400 if email already registered.

#### 3.1.2 Login and Token Issue
- **ID**: FR-AUTH-LOGIN
- **Description**: System shall authenticate users and issue JWT access and refresh tokens.
- **API**: `POST /api/v1/auth/login`
- **Input**: `username`, `password`.
- **Rules**:
	- If credentials invalid, return 401.
	- On success, create access and refresh tokens.
- **Output**: `TokenResponse { access_token, refresh_token }`.

#### 3.1.3 Token Refresh
- **ID**: FR-AUTH-REFRESH
- **Description**: System shall allow clients to obtain a new access token using a valid refresh token.
- **API**: `POST /api/v1/auth/refresh`
- **Rules**:
	- Decode refresh token and validate type = `refresh`.
	- If invalid, return 401.
	- Reuse existing refresh token; return new access token.

#### 3.1.4 Logout and Token Blacklist
- **ID**: FR-AUTH-LOGOUT
- **Description**: System shall support logout by blacklisting refresh tokens.
- **API**: `POST /api/v1/auth/logout`
- **Input**: `refresh_token`.
- **Rules**:
	- Decode token; persist token in blacklist table.
	- Future uses of this refresh token shall be rejected (enforced in token validation logic).

#### 3.1.5 Current User Endpoint
- **ID**: FR-AUTH-ME
- **Description**: System shall expose the profile of the currently authenticated user.
- **API**: `GET /api/v1/auth/users/me`
- **Rules**:
	- Requires authenticated user (`get_current_active_user`).
- **Output**: `UserBase` (id, username, email, full_name, etc.).

### 3.2 Audio Upload and Transcription

#### 3.2.1 Audio Upload & Transcription
- **ID**: FR-AUDIO-TRANSCRIBE
- **Description**: System shall accept an audio file upload and return a Banglish transcription.
- **API**: `POST /api/v1/audios/transcribe`
- **Inputs**:
	- Multipart form-field `file` (audio file).
	- Optional `title` (string, default: "Untitled").
- **Preconditions**:
	- User is authenticated.
- **Rules**:
	- Reject non-audio files (`content_type` must start with `audio/`).
	- Generate a unique filename as `{clean_title}_{userUUID}_{timestamp}{ext}`.
	- Store the file under `media/{user_id}/`.
	- Call Gemini model `gemini-2.5-flash` for transcription with a prompt instructing Banglish output and speaker/timestamp annotations.
	- Persist an `AudioTranscription` record including: filename, original filename, file size, mime type, transcription text, user_id, timestamps.
- **Output**: `AudioTranscriptionPublic` (including transcription text).
- **Errors**:
	- 400 if file is not audio.
	- 500 if saving file fails.
	- 500 if transcription fails (and file is removed).

#### 3.2.2 List User Transcriptions
- **ID**: FR-AUDIO-LIST
- **Description**: System shall allow a user to list their previous audio transcriptions.
- **API**: `GET /api/v1/audios/`
- **Inputs**:
	- Query: `skip`, `limit` (pagination).
- **Rules**:
	- Filter by `user_id` of current user.
	- Sort by `created_at` descending.
- **Output**: List of `AudioTranscriptionPublic`.

### 3.3 Translation (Banglish to English)

#### 3.3.1 Create Translation
- **ID**: FR-TRANS-CREATE
- **Description**: System shall translate Banglish text to English using Gemini.
- **API**: `POST /api/v1/translations/`
- **Inputs**:
	- `AudioTranslationCreate` containing:
		- `audio_transcription_id`
		- Optional `source_text` override.
- **Preconditions**:
	- Specified transcription exists; if not, 404.
	- Either `source_text` is provided or transcription has text; otherwise 400.
- **Rules**:
	- Call Gemini `gemini-2.5-flash` with appropriate translation prompt.
	- Expect translation text and optional `Confidence: X.XX` line.
	- Extract confidence score if present; else default 0.85.
	- Persist `AudioTranslation` linked to `AudioTranscription` and user.
- **Output**: `AudioTranslationPublic` (translated text, confidence, metadata).
- **Errors**:
	- 404 if transcription not found.
	- 400 if no text to translate.
	- 500 if translation fails.

#### 3.3.2 List User Translations
- **ID**: FR-TRANS-LIST
- **Description**: System shall list translations for the authenticated user.
- **API**: `GET /api/v1/translations/`
- **Inputs**:
	- Query: `skip`, `limit`.
- **Rules**:
	- Filter by `user_id`.
	- Sort by `created_at` descending.

#### 3.3.3 Retrieve Translation by ID
- **ID**: FR-TRANS-GET
- **Description**: System shall retrieve a specific translation by UUID.
- **API**: `GET /api/v1/translations/{translation_id}`
- **Rules**:
	- Ensure translation belongs to current user.
	- Return 404 if not found.

### 3.4 Meeting Analysis

#### 3.4.1 Create Meeting Analysis
- **ID**: FR-ANALYSIS-CREATE
- **Description**: System shall generate a structured meeting analysis from an English translation.
- **API**: `POST /api/v1/audios/analyses`
- **Inputs**:
	- `MeetingAnalysisCreate` including:
		- `audio_translation_id`
		- `generate_markdown` (boolean).
- **Preconditions**:
	- Translation with given ID exists and belongs to current user.
	- Translation has non-empty `translated_text`.
- **Rules**:
	- Prompt Gemini with transcript text and instructions to produce:
		- SUMMARY
		- BUSINESS_INSIGHTS
		- TECHNICAL_INSIGHTS
		- ACTION_ITEMS
		- KEY_TOPICS
	- Parse sections from the text response.
	- If `generate_markdown == true`, issue a second Gemini request to convert analysis to markdown notes.
	- Persist `MeetingAnalysis` including all parsed fields, markdown (if any), model name, and user.
- **Output**: `MeetingAnalysisPublic`.
- **Errors**:
	- 404 if translation not found.
	- 400 if translation has no text.
	- 500 if analysis or markdown generation fails.

#### 3.4.2 List Analyses for a Translation
- **ID**: FR-ANALYSIS-LIST-BY-TRANS
- **Description**: System shall return analyses for a specific translation.
- **API**: `GET /api/v1/translations/{translation_id}/analyses`
- **Rules**:
	- Ensure translation belongs to user.
	- Return all analyses for the translation, ordered by `created_at` descending.

### 3.5 Health and Internal APIs

#### 3.5.1 Health Check
- **ID**: FR-HEALTH
- **Description**: System shall expose a basic health endpoint.
- **API**: `GET /health`
- **Output**: JSON `{ "status": "ok", "message": "ASR Middleware is running." }`.

#### 3.5.2 Internal Admin APIs
- **ID**: FR-ADMIN
- **Description**: Internal admin routes shall be exposed under `/api/v1/admin/...` via `app/api/v1/internal/admin.py`.
- **Details**: Exact behaviors are implementation-specific but may include health, metrics, or data-maintenance operations. Access must be restricted (e.g., via auth/role checks, IP allow-lists, or infrastructure-level controls).

### 3.6 Frontend Functional Requirements (High-Level)

#### 3.6.1 Authentication UI
- Login form using username/password and `/auth/login`.
- Registration form using `/auth/register`.
- Store and attach JWT access tokens to API calls via `AuthContext` and `services/api.js`.

#### 3.6.2 Audio Recording / Upload UI
- Provide a component (e.g., `MeetingRecorder.jsx`) to capture or upload meeting audio.
- On submission, call `/audios/transcribe` and show progress/feedback.
- After success, show the transcription and link to further actions (translate, analyze).

#### 3.6.3 Lists and Detail Views
- **MeetingList / MeetingAnalysisList**: show historical items with basic metadata and timestamps.
- **MeetingAnalysisDetail**: show summary, insights, action items, key topics, and markdown notes (if available).

#### 3.6.4 Error Handling and Feedback
- Show user-friendly error messages for API failures (e.g., 400/401/404/500).
- Indicate loading states (spinners, disabled buttons) during network calls.

## 4. Non-Functional Requirements

### 4.1 Performance Requirements
- Typical audio uploads (up to N minutes – exact limit configurable) should be processed (transcription + translation + analysis) within an acceptable user experience window (e.g., under a few minutes, primarily bounded by Gemini latency).
- API endpoints shall respond quickly for metadata-only operations (list, get) – ideally under 500 ms on normal loads.

### 4.2 Scalability
- System shall support horizontal scaling of the backend container behind Nginx.
- Database and file storage shall be sized and configured to support expected concurrency and data retention.

### 4.3 Security Requirements
- All authenticated endpoints must enforce JWT-based authentication (`get_current_active_user`).
- Passwords must be stored as secure hashes (no plain-text).
- Tokens must be signed with a secure secret key.
- Refresh tokens shall be blacklistable on logout.
- In production, all access must be over HTTPS.
- Secrets (DB credentials, Gemini API key) must be provided via environment variables or secret management, not committed to source.

### 4.4 Reliability and Availability
- Failures in external AI calls (Gemini) must result in clear error responses (5xx) without corrupting local data.
- File system writes must be handled with error checking and cleanup on failure.
- Health endpoint should be used by orchestration (e.g., Docker, Kubernetes, or hosting platform) to determine container liveness.

### 4.5 Maintainability
- Codebase shall be organized by domain (routers, models, deps) and versioned API paths (`/api/v1`).
- Tests under `backend/tests/` shall be maintained and extended as new functionality is added.
- Configuration must be environment-driven (dev/stage/prod) with minimal code changes between environments.

### 4.6 Usability
- Frontend must provide intuitive flows for:
	- Logging in / registering.
	- Uploading/recording audio.
	- Viewing and navigating between transcription, translation, and analyses.
- Error states and validation messages must be clear and non-technical for end users.

## 5. Data and Persistence Requirements

### 5.1 Core Entities (Conceptual)
- **User**
	- `id`, `username`, `email`, `full_name`, `hashed_password`, `is_active`, timestamps.

- **AudioTranscription**
	- `id`, `filename`, `original_filename`, `file_size`, `mime_type`, `transcription_text`, `user_id`, `created_at`, etc.
	- Relationship: many-to-one with User.

- **AudioTranslation**
	- `id`, `audio_transcription_id`, `source_text`, `translated_text`, `confidence_score`, `user_id`, `model_used`, `created_at`, etc.
	- Relationship: many-to-one with AudioTranscription and User.

- **MeetingAnalysis**
	- `id`, `audio_translation_id`, `content_text`, `summary`, `business_insights`, `technical_insights`, `action_items`, `key_topics`, `notes_markdown`, `user_id`, `model_used`, `created_at`, etc.
	- Relationship: many-to-one with AudioTranslation and User.

- **TokenBlacklist**
	- `id`, `token`, `created_at`.

### 5.2 Storage
- Database schema managed via Alembic migrations (`backend/app/alembic/versions/`).
- Audio files stored on local disk under `media/{user_id}/` by default; in production may be mapped to persistent volumes or external storage.

## 6. External Interface Requirements

### 6.1 REST API
- All application functionality shall be accessible via FastAPI routers under `/api/v1`.
- OpenAPI schema is exposed by FastAPI for documentation and client generation.
- CORS is enabled for the SPA with `allow_origins=["*"]` (may be restricted in production).

### 6.2 Third-Party Services (Gemini)
- System must call Google Gemini using `google.genai` client with `GEMINI_API_KEY`.
- Models used (current): `gemini-2.5-flash`.
- Errors from Gemini must be handled and wrapped in appropriate HTTPException responses.

### 6.3 Frontend–Backend Contract
- Frontend shall use base API URL configured in environment (e.g., `.env` for Vite) and `services/api.js` for HTTP operations.
- Authentication tokens shall be set and refreshed via backend `/auth` endpoints.

### 6.4 Deployment & DevOps Interfaces
- Docker-based deployment with `docker-compose.yml` and `docker-compose.prod.yml`.
- Nginx configuration under `nginx/` and `frontend/nginx.conf` defines routing for frontend and backend.
- Scripts under `scripts/` and root (`deploy.*`, `vm-deploy.sh`) support automated deployment.

## 7. Deployment, Configuration, and Environments

### 7.1 Environments
- **Development**
	- Local Docker (optional) or direct `uvicorn`/`npm run dev` usage.
	- Debug logging enabled; relaxed CORS.

- **Staging/Production**
	- Dockerized services managed via compose or hosting provider.
	- HTTPS termination via Nginx; certificates generated via helper scripts or external ACME.
	- Environment variables configured via secrets.

### 7.2 Configuration Parameters (Examples)
- `GEMINI_API_KEY` – Gemini API key.
- `DATABASE_URL` – connection string for database.
- `SECRET_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, etc. – JWT settings.
- CORS origins, debug flags, log levels.

### 7.3 Logging and Monitoring
- Backend shall log key events (auth errors, AI call failures, file write errors).
- Health endpoint shall be used by infrastructure for liveness checks.
- Additional monitoring (metrics, tracing) can be added as needed.

---

**Note for .docx Generation**: This SRS is authored in Markdown for maintainability in the repository. To create **SRS.docx** for distribution, open this file in a Markdown-capable editor or use tools such as Microsoft Word (copy-paste) or `pandoc` to convert:

```bash
pandoc SRS_Document.md -o SRS.docx
```
