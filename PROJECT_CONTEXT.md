# PET Speaking Coach Project Context

## 1. Project Goal

Build an iPad-friendly English speaking coach for the user's 10-year-old daughter.

The product goal is not a text chatbot. It should help the child improve spoken English and prepare for Cambridge PET / B1 Preliminary for Schools speaking tasks.

Core learning goal:

- Make the child willing to speak English every day.
- Keep practice short, friendly, and low-pressure.
- Gradually improve PET speaking skills: fluency, vocabulary, grammar, pronunciation, and interaction.
- Let the parent see useful Chinese reports after practice.

The expected child experience:

```text
Open iPad home screen icon
  ↓
Tap Start Speaking
  ↓
Listen to AI coach
  ↓
Answer by voice
  ↓
See short subtitles and feedback
```

## 2. Product Decision

The chosen 1.0 route is:

```text
Cloud PWA
```

Meaning:

- Mac is used for development and testing.
- The app is deployed to a cloud host such as Render or Railway.
- iPad opens the HTTPS URL in Safari.
- The user adds the site to the iPad home screen.
- The child uses it like an app.
- Mac does not need to stay on after deployment.

This route was chosen because it best satisfies:

- iPad independent use.
- Voice conversation with microphone access.
- OpenAI API key protection.
- Faster iteration than native iPad app development.
- Lower operational complexity than running a local iPad backend.

Important decision:

- Keep the cloud PWA version.
- Do not switch to native iPad app for 1.0.
- Do not put the OpenAI API key in frontend/iPad code.

## 3. Alternatives Considered

### Mac Local Server + iPad

Rejected as the main route.

Reason:

- Mac must remain on.
- The child cannot use it independently.
- Local HTTP often causes microphone limitations on iPad.
- ngrok is useful for temporary testing but not ideal for daily child use.

### Fully Local iPad Deployment

Not used for 1.0.

Reason:

- A pure PWA cannot safely store the OpenAI API key.
- Running a backend directly on iPad with tools like a-Shell or Pythonista is fragile.
- A true local iPad version would require a native SwiftUI app.

### Native iPad App

Possible future route, not 1.0.

Reason:

- Better long-term native experience.
- But requires Xcode, iOS packaging, Apple Developer/TestFlight decisions, and more development time.

## 4. Current Implementation

The current project is a Node.js server plus a static PWA frontend.

Key files:

- `server.js`
  - Serves the PWA.
  - Creates OpenAI Realtime voice sessions.
  - Generates post-practice reports.
  - Saves session JSON locally under `data/`.
  - Provides `/health`.

- `public/index.html`
  - Main iPad UI.

- `public/app.js`
  - Frontend interaction logic.
  - Handles WebRTC voice session.
  - Handles transcript display.
  - Handles parent report UI.

- `public/styles.css`
  - iPad-friendly visual design.

- `public/manifest.webmanifest`
  - PWA manifest for iPad home screen install.

- `public/sw.js`
  - Basic service worker for static asset caching.

- `render.yaml`
  - Render Blueprint deployment config.

- `README.md`
  - User-facing setup, deployment, and iPad install instructions.

## 5. 1.0 Features

### Child Side

- iPad-friendly PWA UI.
- Big `Start Speaking` button.
- Voice-first conversation.
- Short live subtitles.
- Three practice modes:
  - `Today`
  - `Photo`
  - `Mock`
- Built-in picture prompt for Photo Talk.
- Friendly AI coach persona named Lily.
- Practice completion feedback:
  - One encouragement.
  - Best sentence.
  - One correction.
  - New words.

### Parent Side

- Parent report page.
- Default PIN:

```text
2580
```

- Shows:
  - Chinese summary.
  - PET speaking ability scores.
  - Next practice suggestion.
  - Transcript.

### Backend

- Keeps OpenAI API key on server side.
- Protects paid API endpoints with `APP_ACCESS_CODE`.
- Uses OpenAI Realtime API for speech-to-speech conversation.
- Uses a report model for structured feedback.
- Has fallback report logic if the report API fails or no API key exists.
- Saves practice session JSON files locally.

## 6. OpenAI Model Configuration

Current environment variables:

```text
OPENAI_API_KEY=sk-your-openai-api-key
APP_ACCESS_CODE=change-this-family-code
REALTIME_MODEL=gpt-realtime-2.1
REPORT_MODEL=gpt-5.5
PORT=3000
HOST=127.0.0.1
```

Realtime voice:

- Default: `gpt-realtime-2.1`
- Used for low-latency speech conversation.

Report model:

- Default: `gpt-5.5`
- Used for post-practice structured report generation.

Note:

- If model availability changes, check current OpenAI docs before changing model IDs.

## 7. Deployment Plan

Recommended deployment:

```text
GitHub → Render Blueprint → HTTPS URL → iPad Safari → Add to Home Screen
```

Steps:

1. Push the project to GitHub.
2. In Render, create a new Blueprint.
3. Connect the GitHub repository.
4. Render reads `render.yaml`.
5. Add the environment variable:

```text
OPENAI_API_KEY=...
APP_ACCESS_CODE=...
```

6. Deploy.
7. Open the Render HTTPS URL on iPad Safari.
8. Allow microphone.
9. Add to iPad home screen.

## 8. Current Verification Status

Completed:

- `server.js` syntax check passed.
- `public/app.js` syntax check passed.
- `package.json` JSON validation passed.
- `manifest.webmanifest` JSON validation passed.
- README has iPad installation instructions.
- Render deployment config exists.

Not completed in this environment:

- The local server was not run successfully here because this Codex environment blocks listening on local ports.
- Browser/iPad voice testing has not been completed yet.
- OpenAI Realtime live call has not been tested with a real API key in this environment.

Next verification should be done on the user's Mac:

```bash
cp .env.example .env
# Fill OPENAI_API_KEY
npm start
```

Then open:

```text
http://localhost:3000
```

For iPad testing, deploy to Render or use ngrok temporarily.

## 9. Known Product Constraints

- iPad microphone requires secure context for reliable browser use, so HTTPS is recommended.
- Free Render services may sleep after inactivity, causing slower first load.
- OpenAI API usage is billed separately from hosting.
- The family access code is a lightweight 1.0 protection, not a full user account system.
- Current local JSON saving is not durable on many cloud hosts after redeploy/restart.
- 1.0 is designed for one child/family, not multi-user SaaS.

## 10. Recommended Next Steps

### Immediate

1. Run on the user's Mac with a real OpenAI API key.
2. Test the voice flow in desktop browser.
3. Deploy to Render.
4. Test on iPad Safari.
5. Add to iPad home screen.

### Product Improvements After First Test

- Fix any Realtime API event mismatch from real testing.
- Add a proper parent settings page:
  - Child name.
  - Daily duration.
  - Parent PIN.
  - Voice speed.
- Add persistent database storage if cloud use continues.
- Add a 30-day PET Speaking practice plan.
- Add more photo cards.
- Add weekly report summaries.
- Add child-safe session limits and daily usage caps.

## 11. Agent Handoff Notes

If another agent continues this project:

1. Preserve the cloud PWA direction.
2. Do not migrate to native iPad unless the user explicitly changes the strategy.
3. Keep the child UI voice-first and simple.
4. Keep text as support, not the main interaction.
5. Keep OpenAI API key server-side only.
6. Before changing OpenAI model/API details, verify against current official OpenAI docs.
7. Test on a real iPad before calling the voice experience complete.
