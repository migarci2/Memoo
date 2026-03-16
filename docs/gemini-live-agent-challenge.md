# Building Memoo: A Multimodal AI-Powered Browser Navigator with Gemini and Google Cloud

**Disclaimer: This blog post was created for the purposes of entering the #GeminiLiveAgentChallenge hackathon.**

## Introduction

In the world of business automation, repetitive browser workflows are everywhere—data entry, form submissions, report generation, and routine testing. But most automation tools require extensive coding or fragile CSS selectors that break when websites change.

Enter **Memoo**, a multimodal AI-powered UI Navigator that watches your screen, listens to voice context, and transforms one-time workflows into reusable, executable playbooks with step-by-step evidence.

Built with **Google Gemini models** and deployed entirely on **Google Cloud**, Memoo represents a new paradigm for browser automation—one that combines vision understanding, live voice interaction, and cloud-native infrastructure.


## The Problem: Why Traditional Automation Falls Short

Traditional browser automation tools like Selenium, Playwright, and Puppeteer are powerful but come with significant limitations:

1. **Fragile Selectors**: CSS selectors break when websites change
2. **No Context**: Tools don't understand *why* you're clicking something
3. **Blind Execution**: No awareness of page state or unexpected changes
4. **High Learning Curve**: Requires programming knowledge
5. **Limited Reusability**: Hardcoded values don't adapt to different data

Memoo solves these problems by using **Google Gemini's multimodal capabilities** to see, understand, and interact with browsers the way a human would.

## Core Architecture

Memoo consists of five main surfaces:

- **Web Frontend** (`apps/web`): Next.js App Router with the live capture interface
- **API Backend** (`apps/api`): FastAPI server with Gemini integrations
- **Video Studio** (`apps/video`): Remotion-based demo video generation
- **Agent Service** (`apps/agent`): Stagehand-compatible autonomous browser agent
- **Sandbox** (`apps/sandbox`): Visible Chromium sandbox for live playback

The stack is deployed on **Google Cloud** with:
- Cloud Run (web + API)
- Cloud SQL (PostgreSQL)
- Cloud Storage (evidence assets)
- Compute Engine (visible browser sandbox)
- Secret Manager (credentials)
- Artifact Registry (container images)
- Cloud Build (CI/CD pipeline)

## Google AI Integrations

### 1. Gemini Vision: Real-Time Screen Understanding

The core of Memoo's **Teach Mode** is its ability to watch a user's screen and detect meaningful actions in real-time. This uses **Gemini 2.0 Flash**'s multimodal vision capabilities.

```python
# apps/api/app/services/gemini_live.py

from google import genai
from google.genai import types

async def analyse_frame(
    image_b64: str,
    previous_events: list[dict],
    mime_type: str = 'image/jpeg',
) -> dict:
    """Send a screenshot frame to Gemini Vision and return detected events."""

    client = genai.Client(api_key=settings.google_api_key)
    image_bytes = base64.b64decode(image_b64)

    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=[
            types.Content(
                parts=[
                    types.Part.from_text(prompt),
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            response_mime_type='application/json',
        ),
    )
```

The vision prompt asks Gemini to:
- Detect meaningful browser interactions (navigations, clicks, inputs, submissions)
- Identify CSS selectors or human-readable element descriptions
- Capture observed text from the screen
- Provide confidence scores for each detection
- Include visible evidence cues

**Key Features:**
- **Grounded Detection**: Only reports actions supported by visible evidence
- **Context Awareness**: Maintains history of previously detected actions to avoid duplicates
- **Selector Intelligence**: Prefers descriptive selectors ("Login button") over fragile CSS
- **Confidence Scoring**: Returns confidence values to filter low-quality detections

### 2. Gemini Live: Voice Navigation Assistant

Memoo's **Navigator Live** feature uses the **Gemini Live API** for real-time voice interaction during workflow recording. Implemented using the official `@google/genai` SDK:

```typescript
// apps/web/src/hooks/use-gemini-live.ts

import { GoogleGenAI, Modality } from '@google/genai';

const ai = new GoogleGenAI({ apiKey });

const session = await ai.live.connect({
  model: 'gemini-2.0-flash-exp',
  config: {
    responseModalities: [Modality.AUDIO],
    inputAudioTranscription: {},
    systemInstruction: {
      parts: [{
        text: `You are Memoo Navigator, a calm workflow recording co-pilot.
        When you receive "[STEP DETECTED] <description>", decide whether
        to ask a short clarifying question or stay silent if the step is obvious.`
      }]
    },
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: { voiceName: 'Puck' },
      },
    },
  },
  callbacks: {
    onopen: () => console.log('[GeminiLive] SDK Connected'),
    onmessage: (msg) => handleGeminiResponse(msg),
    onclose: (e) => console.log('[GeminiLive] Session closed'),
  }
});
```

**How it Works:**
1. **Bidirectional Audio**: Streams user microphone input at 16kHz PCM
2. **Real-Time Transcription**: Captures user speech as text for the playbook
3. **Clarification Questions**: Gemini asks intelligent questions when steps are ambiguous
4. **Voice Responses**: Uses the "Puck" voice for calm, operational responses
5. **Context Integration**: Receives real-time updates when vision detects new steps

The implementation handles:
- PCM audio conversion (Float32 to Int16 base64)
- Transcript merging for streaming text
- Audio playback queue management
- Graceful session cleanup

### 3. Gemini Compile: From Raw Events to Semantic Playbooks

After capturing a workflow, raw events need to be transformed into structured, reusable playbook steps. **Gemini Compile** handles this intelligent transformation:

```python
# apps/api/app/services/gemini_compile.py

COMPILE_PROMPT = """You are an expert workflow analyst. Given the following raw browser
interaction events recorded during a user session, produce a structured list of semantic
playbook steps.

For each step, output:
- title: A clear, human-readable description
- step_type: One of navigate, click, input, submit, verify, wait, action
- target_url: The URL involved, if applicable
- selector: CSS selector or element identifier
- variables: Dict of variable_name -> template_string for parameterized values
- guardrails: Dict with "verify" key describing expected state after this step

Important rules:
1. Detect variables automatically — anything that looks like personal data should become {{variable}}
2. Merge consecutive related events into single logical steps
3. Add verification guardrails after form submissions and page navigations
4. Use voice_note and gemini_clarification entries as context for step titles and guardrails
"""

async def compile_events(raw_events: list[dict]) -> list[dict]:
    """Call Gemini to compile raw capture events into semantic playbook steps."""

    client = genai.Client(api_key=settings.google_api_key)
    events_json = json.dumps(raw_events, indent=2)
    prompt = COMPILE_PROMPT.format(events_json=events_json)

    response = await client.aio.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type='application/json',
        ),
    )

    steps = json.loads(response.text)
    return normalize_steps(steps)
```

**Intelligent Features:**
- **Variable Detection**: Automatically identifies values that should be parameterized (names, emails, IDs)
- **Step Merging**: Combines related actions into logical business steps
- **Guardrail Generation**: Adds verification steps after critical actions
- **Voice Context Integration**: Uses spoken context to clarify ambiguous actions
- **Business-Level Abstraction**: Transforms low-level events into meaningful workflow steps

### 4. Execution Engine with Fallback to AI Agents

For playbook execution, Memoo uses Playwright for deterministic actions but falls back to an autonomous agent (Stagehand) when selectors fail:

```python
# apps/api/app/services/playwright_executor.py

async def execute_playbook_steps(
    steps: list[dict],
    row_data: dict[str, Any],
    *,
    headless: bool = True,
    screenshot: bool = True,
    step_callback: Any | None = None,
) -> list[dict]:
    """Execute a list of playbook steps via Playwright and return per-step results."""

    async with async_playwright() as pw:
        browser_server = await pw.chromium.launch_server(
            headless=headless,
            args=['--remote-debugging-port=0']
        )

        for step in steps:
            try:
                # Try deterministic Playwright action
                if step_type == 'navigate':
                    await page.goto(target_url)
                elif step_type == 'click':
                    await page.click(selector)
                # ... other step types

            except Exception as action_error:
                # Fall back to autonomous Stagehand agent
                task = _build_autonomous_task(
                    title=title,
                    expected=expected,
                    target_url=target_url,
                    selector=selector,
                    resolved_values=resolved_values,
                )
                agent_result = await _run_stagehand_step(
                    settings,
                    ws_endpoint=ws_endpoint,
                    task=task,
                )
```

This hybrid approach ensures reliability:
- **Deterministic Path**: Fast, exact execution for known selectors
- **Autonomous Fallback**: AI-powered execution when selectors fail
- **Evidence Capture**: Screenshots after every step for verification
- **Real-Time Updates**: Callbacks notify the UI of progress

## Google Cloud Infrastructure

### Deployment Architecture

Memoo is entirely cloud-native on Google Cloud:

```hcl
# infra/terraform/gcp/cloud_run.tf

# API Service with Cloud SQL connection
resource "google_cloud_run_v2_service" "api" {
  name     = "memoo-api"
  location = "europe-west1"

  template {
    service_account = google_service_account.api.email

    vpc_access {
      connector = google_vpc_access_connector.serverless.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [google_sql_database_instance.main.connection_name]
      }
    }

    containers {
      env {
        name = "GOOGLE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_api_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "GEMINI_MODEL"
        value = "gemini-2.0-flash-exp"
      }
    }
  }
}

# Web Frontend
resource "google_cloud_run_v2_service" "web" {
  name     = "memoo-web"
  location = "europe-west1"

  template {
    containers {
      env {
        name  = "NEXT_PUBLIC_GEMINI_LIVE_MODEL"
        value = "gemini-2.0-flash-live-exp"
      }
    }
  }
}
```

**Infrastructure Components:**

| Service | Purpose |
|---------|---------|
| **Cloud Run** | Serverless containers for web and API (auto-scales to zero) |
| **Cloud SQL** | Managed PostgreSQL database for playbooks and runs |
| **Cloud Storage** | Evidence screenshots and artifacts |
| **Compute Engine** | Visible Chromium sandbox with noVNC for live playback |
| **Secret Manager** | Secure storage for API keys and credentials |
| **Artifact Registry** | Container image storage |
| **Cloud Build** | CI/CD pipeline for automated deployments |
| **VPC Connector** | Private connectivity between Cloud Run and Cloud SQL |

### Deployment Scripts

```bash
#!/bin/bash
# scripts/gcp/deploy.sh

export PROJECT_ID="your-project"
export REGION="europe-west1"

# Bootstrap Terraform state
./scripts/gcp/bootstrap_tf_state.sh

# Deploy infrastructure
cd infra/terraform/gcp
terraform init
terraform apply

# Build and push images
gcloud builds submit --tag gcr.io/$PROJECT_ID/memoo-api
gcloud builds submit --tag gcr.io/$PROJECT_ID/memoo-web
```

## Key Features

### 1. Teach Mode: Watch and Learn

1. User shares screen via browser Screen Capture API
2. Frontend captures frames every 2-3 seconds
3. Backend sends frames to Gemini Vision
4. Gemini detects actions with grounding metadata
5. Navigator Live asks clarifying questions via voice
6. User speaks additional context
7. All events compiled into structured playbook

### 2. Run Mode: Execute with Evidence

1. Playbook selected for execution
2. Row data provides variable values
3. Playwright executes deterministic steps
4. Stagehand agent handles ambiguous cases
5. Screenshot captured after each step
6. Evidence stored in Cloud Storage
7. Real-time progress updates via WebSocket

### 3. Visual Sandbox: Live Playback

For transparent execution, Memoo provides a visible Chromium sandbox:
- Deployed on Compute Engine with noVNC
- CDP (Chrome DevTools Protocol) for programmatic control
- Users can watch their playbooks execute in real-time
- Perfect for debugging and demonstration

## Technical Challenges & Solutions

### Challenge 1: Real-Time Audio Streaming

**Problem:** Gemini Live requires PCM audio at specific sample rates, but browser AudioContext uses Float32.

**Solution:** Implemented custom PCM conversion:
```typescript
function floatTo16BitB64(samples: Float32Array): string {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return btoa(bin);
}
```

### Challenge 2: Transcript Merging

**Problem:** Streaming transcription sends partial updates, full phrases, or deltas inconsistently.

**Solution:** Implemented intelligent merge logic:
```typescript
function mergeTranscriptProgress(current: string, chunk: string): string {
  if (chunk === current) return current;
  if (chunk.startsWith(current)) return chunk;
  if (current.startsWith(chunk)) return current;
  return appendTranscriptText(current, chunk);
}
```

### Challenge 3: Variable Detection

**Problem:** How to distinguish between constants (e.g., "United States") and variables (e.g., "John Doe")?

**Solution:** Gemini analyzes patterns and context:
- Personal names → `{{first_name}}`, `{{last_name}}`
- Email addresses → `{{email}}`
- Phone numbers → `{{phone}}`
- IDs and codes → `{{employee_id}}`
- Common options remain constant

### Challenge 4: Selector Fragility

**Problem:** CSS selectors break when websites change.

**Solution:** Hybrid approach:
1. Prefer descriptive selectors over raw CSS
2. Store human-readable descriptions as backup
3. Fall back to autonomous agent when selectors fail
4. Use Gemini's vision understanding to find elements

## Performance & Optimization

### Response Times

- **Vision Analysis**: ~500-800ms per frame
- **Voice Latency**: ~300-500ms end-to-end
- **Compile Time**: ~2-3 seconds for 20-step workflow
- **Step Execution**: ~200-500ms per step (deterministic)

### Cost Optimization

- **Cloud Run**: Auto-scales to zero when idle
- **Gemini Flash**: Optimized for speed and cost
- **Image Compression**: JPEG at 80% quality before sending to API
- **Frame Rate**: Adaptive (2-3 seconds) based on activity
- **Caching**: Compiled playbooks stored in Cloud SQL

## Future Enhancements

1. **Team Workflows**: Multi-user collaboration on playbooks
2. **Vault Integration**: Secure credential storage
3. **Scheduled Runs**: Cron-based execution
4. **Webhook Triggers**: Event-based automation
5. **Advanced Retry**: Smart error recovery
6. **Analytics**: Execution insights and optimization

## Conclusion

Memoo demonstrates the power of combining **Google's multimodal AI** with **cloud-native infrastructure** to solve real-world automation problems. By leveraging:

- **Gemini Vision** for screen understanding
- **Gemini Live** for natural voice interaction
- **Gemini Intelligence** for semantic compilation
- **Google Cloud** for scalable, reliable deployment

We've created a tool that makes browser automation accessible, reliable, and transparent.

The future of automation isn't code—it's conversation. And with Gemini and Google Cloud, that future is here.

---

**Built for the #GeminiLiveAgentChallenge**

*This blog post was created for the purposes of entering the Gemini Live Agent Challenge hackathon. The Memoo project demonstrates innovative use of Google Gemini models (Gemini 2.0 Flash, Gemini Live API) and Google Cloud services to create a multimodal AI-powered browser navigator.*

**Tech Stack:**
- Frontend: Next.js 15, React 19, Tailwind CSS
- Backend: FastAPI, Python 3.12
- AI: Google Gemini 2.0 Flash, Gemini Live API
- Infrastructure: Google Cloud Run, Cloud SQL, Cloud Storage, Compute Engine
- Automation: Playwright, Stagehand Agent
- Video: Remotion for demo generation

**Repository:** [github.com/migarci2/memoo](https://github.com/migarci2/memoo)
