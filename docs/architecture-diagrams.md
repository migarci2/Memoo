# Memoo Architecture Diagrams

These diagrams are meant to be the quickest way to understand how Memoo is put together without reverse-engineering the codebase from `apps/` and `infra/`.

They intentionally focus on the real runtime boundaries in this repository:

- `apps/web` owns the product UI and operator experience
- `apps/api` owns capture, compile, runs, persistence, and scheduling
- `apps/agent` is the AI fallback for brittle browser steps
- `apps/sandbox` is the visible browser execution plane
- PostgreSQL stores structured product data
- MinIO or GCS stores evidence artifacts

## 1. System Overview

```mermaid
flowchart LR
    User[Operator]

    subgraph Product["Product surface"]
        Web["apps/web\nNext.js UI"]
    end

    subgraph Core["Core backend"]
        API["apps/api\nFastAPI orchestration"]
        DB[("PostgreSQL")]
        Evidence[("MinIO or GCS")]
    end

    subgraph AI["Gemini-backed intelligence"]
        Vision["Gemini Vision\nframe analysis"]
        Live["Gemini Live\nvoice copilot"]
        Compile["Gemini Compile\nsemantic playbook builder"]
    end

    subgraph Runtime["Execution plane"]
        Sandbox["apps/sandbox\nChromium + CDP + noVNC"]
        Agent["apps/agent\nStagehand service"]
    end

    User --> Web
    Web -->|"screen frames"| API
    Web -->|"microphone stream"| Live
    API -->|"analyse frames"| Vision
    API -->|"compile raw events"| Compile
    API <--> DB
    API <--> Evidence
    API -->|"sandbox execution"| Sandbox
    API -->|"autonomous fallback"| Agent
    Agent -->|"same browser via CDP"| Sandbox
    Web -->|"watch visible browser"| Sandbox
```

## 2. Teach Mode Capture And Compilation

This is the path from "someone shows the workflow once" to "Memoo saves a reusable playbook".

```mermaid
sequenceDiagram
    autonumber
    actor User as Operator
    participant Web as apps/web
    participant API as apps/api
    participant Vision as Gemini Vision
    participant Live as Gemini Live
    participant Compile as Gemini Compile
    participant DB as PostgreSQL

    User->>Web: Start Teach Mode and share screen
    Web->>API: Create capture session
    Web->>Live: Start live voice session

    loop Every few seconds
        Web->>API: Send screenshot frame
        API->>Vision: Analyse visible UI state
        Vision-->>API: Grounded events + frame summary
        API-->>Web: New detected actions
        Web->>Live: Send "[STEP DETECTED] ..."
    end

    User->>Live: Speak intent or clarification
    Live-->>Web: Short question or confirmation
    Web->>API: Persist voice_note / gemini_clarification

    User->>Web: Finish capture
    Web->>API: Compile capture into playbook
    API->>Compile: Transform raw events into semantic steps
    Compile-->>API: Titles + selectors + variables + guardrails
    API->>DB: Save playbook, version, and ordered steps
    API-->>Web: Return playbook id
```

## 3. Run Execution With Deterministic First, AI Fallback Second

This is the most important operational diagram because it shows Memoo's core reliability strategy: Playwright first, Stagehand only when needed.

```mermaid
flowchart TD
    User[Operator starts a run] --> Web["apps/web"]
    Web -->|"POST /runs"| API["apps/api run engine"]
    API --> DB[("PostgreSQL")]

    API --> Init["Load playbook steps\nresolve row variables\nload vault context"]
    Init --> Mode{"use_sandbox?"}

    Mode -->|Yes| Sandbox["Visible Chromium\napps/sandbox via CDP"]
    Mode -->|No| Headless["Headless Chromium\ninside API process"]

    Sandbox --> StepLoop["Execute step with Playwright"]
    Headless --> StepLoop

    StepLoop --> StepType{"Selector works\nand step is deterministic?"}
    StepType -->|Yes| Deterministic["Playwright action\nnavigate / click / input / verify / wait"]
    StepType -->|No| Agent["apps/agent\nStagehand + Gemini"]

    Agent -->|"connect to current browser via CDP"| BrowserState["Active browser page"]
    Deterministic --> BrowserState
    Sandbox --> BrowserState
    Headless --> BrowserState

    BrowserState --> Verify["Guardrail verification"]
    Verify --> Evidence["Capture screenshot evidence"]
    Evidence --> Store[("MinIO or GCS")]
    Evidence --> Events["Persist run events + item status"]
    Events --> DB

    DB --> Detail["Run detail API"]
    Detail --> Web
    Sandbox -->|"noVNC live view"| Web
```

## 4. Google Cloud Deployment Topology

This diagram reflects the Terraform split in `infra/terraform/gcp`.

```mermaid
flowchart TB
    User[Browser user]
    Build["Cloud Build + Terraform"]
    Registry[("Artifact Registry")]
    Secrets[("Secret Manager")]
    SQL[("Cloud SQL\nPostgreSQL")]
    GCS[("Cloud Storage\nEvidence bucket")]
    VPC["VPC + Serverless VPC Connector"]

    subgraph Run["Cloud Run"]
        Web["apps/web"]
        API["apps/api"]
        Agent["apps/agent"]
    end

    subgraph VM["Compute Engine"]
        Sandbox["Sandbox VM\nChromium + noVNC + Caddy"]
    end

    User -->|"HTTPS app traffic"| Web
    Web -->|"server-side API proxy"| API
    User -->|"HTTPS noVNC session"| Sandbox

    API -->|"Cloud SQL socket"| SQL
    API --> GCS
    API --> Secrets
    Agent --> Secrets

    API -->|"Stagehand fallback"| Agent
    API -->|"private CDP on :9223"| Sandbox
    Agent -->|"private CDP on :9223"| Sandbox

    API -.-> VPC
    Agent -.-> VPC

    Build --> Registry
    Registry --> Web
    Registry --> API
    Registry --> Agent
    Registry --> Sandbox
```

## Reading Notes

- `apps/web` talks to Gemini Live directly from the browser for the voice copilot, while frame analysis and compile go through `apps/api`.
- The visible sandbox is a first-class product surface, not just internal infrastructure.
- The GCP split is deliberate: the sandbox stays on a VM because a live browser with public noVNC and private CDP does not fit neatly into a single serverless service.
- The execution engine is designed around "deterministic first, AI fallback second", which is why the run diagram is split between Playwright and Stagehand instead of routing everything through the agent.
