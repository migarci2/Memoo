# Memoo System Architecture

## 🏗️ High-Level Overview

Memoo is a test automation platform that leverages Google's Gemini AI to provide intelligent code generation, live interaction processing, and automated test execution. The architecture is built on Google Cloud Platform (GCP) with a clear separation between frontend, backend, AI services, and infrastructure.

```
┌─────────────────────────────────────────────────────────────────┐
│                     MEMOO ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Users] ──HTTPS──> [Frontend]                                 │
│                         │                                        │
│                         │ /api/proxy                            │
│                         ▼                                        │
│                   [FastAPI Backend]                             │
│                         │                                        │
│         ┌───────────────┼───────────────┐                       │
│         │               │               │                       │
│         ▼               ▼               ▼                       │
│    [Gemini AI]   [PostgreSQL]    [Sandbox VM]                  │
│   Generation      Evidence       Browser Automation            │
│   Responses       Storage                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Detailed Component Architecture

### 1. **Frontend Layer** - Cloud Run (Next.js)
- **Purpose**: User-facing web interface
- **Technology**: Next.js with TypeScript
- **Deployment**: Google Cloud Run (serverless)
- **Communication**: REST API calls to backend via `/api/proxy`
- **Features**:
  - Team and project management
  - Test creation and execution UI
  - Live browser view (connects to Sandbox VM via noVNC)
  - Results visualization and reporting

### 2. **Backend API Layer** - Cloud Run (FastAPI)
- **Purpose**: Core application logic and orchestration
- **Technology**: Python FastAPI
- **Deployment**: Google Cloud Run (serverless)
- **Key Responsibilities**:
  - Request routing and validation
  - Workflow orchestration
  - AI integration coordination
  - Database operations
  - Evidence collection and storage

**Core Modules**:
- `automation_engine.py` - Orchestrates test automation workflows
- `gemini_live.py` - Handles live Gemini interactions
- `gemini_compile.py` - Pre-compilation code generation with Gemini
- `playwright_executor.py` - Browser automation execution
- `run_engine.py` - Test run management
- `sandbox_executor.py` - Sandbox VM communication
- `storage.py` - Evidence storage operations

### 3. **AI Integration** - Google Vertex AI / Gemini
- **Purpose**: Intelligent code generation and live assistance
- **Model**: Google Gemini (via Vertex AI)
- **Integration Points**:
  - **Live Mode**: Real-time interactions with AI during test creation
  - **Compile Mode**: Pre-generation of test code from natural language descriptions
- **Key Capabilities**:
  - Code generation from descriptions
  - Test assertion generation
  - Debugging suggestions
  - Automation best practices

**Connection Flow**:
```
Backend API ──(REST/gRPC)──> Vertex AI / Gemini API
                ↓
         (Requests + Context)
                ↓
         (AI-Generated Code/Suggestions)
                ↓
         Return to Frontend
```

### 4. **Execution Engine** - Compute Engine VM (Sandbox)
- **Purpose**: Isolated, secure environment for code execution
- **Technology**: Debian 12 VM with Playwright and headless browser
- **Communication**: 
  - Receives commands via CDP (Chrome DevTools Protocol)
  - Executes user code and automation scripts
  - Returns results and screenshots
- **Isolation**: 
  - Dedicated VM instance per workspace/project
  - Network isolation via VPC
  - No direct internet access (all requests proxied through backend)

### 5. **Data Storage**
- **Cloud SQL (PostgreSQL 16)**:
  - User accounts and authentication
  - Project and test definitions
  - Test execution history
  - Results metadata
  - Accessed via private VPC endpoint

- **Cloud Storage (GCS)**:
  - Evidence artifacts (screenshots, videos, logs)
  - Test artifacts
  - Generated reports
  - Accessed via private VPC endpoint with signed URLs

### 6. **Secrets Management**
- **Secret Manager**:
  - Database connection strings
  - Gemini/Vertex AI API keys
  - Service credentials
  - Accessed via IAM-authenticated service accounts

### 7. **Private Network**
- **VPC (memoo-vpc)**:
  - Private IP range: 10.10.0.0/24
  - Isolates all resources from the internet
  
- **Serverless VPC Access Connector**:
  - Enables Cloud Run services to access private resources
  - IP range: 10.10.1.0/28
  - Provides secure tunnel for database and Sandbox access

### 8. **Platform Operations**
- **Artifact Registry**: Container image distribution
- **IAM Service Accounts**: Runtime identity and permissions
- **Cloud Logging**: Centralized log aggregation
- **Cloud Monitoring**: Metrics, alerts, and cost tracking

## 🔄 Request Flow Example: Live Test Generation with AI

```
1. User Input
   └─> Frontend receives user description of test
       └─> Sends to Backend API (/api/generate)

2. Backend Processing
   └─> Validates request and context
       └─> Prepares prompt for Gemini
           └─> Includes: workspace context, test type, requirements

3. AI Generation
   └─> Backend calls Gemini API via Vertex AI
       └─> Gemini generates test code
           └─> Returns code and suggestions

4. Code Validation
   └─> Backend validates generated code
       └─> Stores in database
           └─> Returns to Frontend

5. Frontend Display
   └─> Shows generated code to user
       └─> User can edit and execute
           └─> Sends to Sandbox for execution
               └─> Results returned with evidence
```

## 🔐 Security Considerations

### Network Security
- ✅ All services run in private VPC (no public IPs)
- ✅ Serverless VPC Access provides encrypted tunnel
- ✅ Database accessible only from within VPC
- ✅ Firewall rules restrict to necessary ports only

### Application Security
- ✅ API authentication via JWT tokens
- ✅ Service account-based authorization
- ✅ Secrets encrypted in Secret Manager
- ✅ Input validation on all endpoints

### Data Security
- ✅ Database encryption at rest
- ✅ Cloud Storage encryption
- ✅ All evidence artifacts encrypted
- ✅ Audit logging for all operations

### Execution Security
- ✅ Code executes in isolated VM
- ✅ No access to production databases
- ✅ Limited network access from Sandbox
- ✅ Resource quotas and limits enforced

## 📈 Scalability Architecture

### Horizontal Scaling
- **Frontend (Cloud Run)**: Auto-scales based on traffic
- **Backend (Cloud Run)**: Auto-scales based on request rate
- **Database (Cloud SQL)**: Can scale vertically (storage/compute)
- **Sandbox VMs**: Can create multiple instances for parallel test execution

### Performance Optimization
- CDN for static assets
- Database connection pooling
- Caching layer for AI models
- Async job processing for long-running operations

## 🚀 Deployment Architecture

```
Source Code (GitHub)
       │
       ├──> CI/CD Pipeline (Cloud Build)
       │         │
       │         ├──> Build & Test
       │         ├──> Push to Artifact Registry
       │         └──> Deploy to Cloud Run
       │
       └──> Infrastructure (Terraform)
               │
               ├──> GCP Resources
               ├──> VPC & Networking
               ├──> Secret Manager
               └──> Monitoring & Logging
```

## 🔌 Integration Points

### Gemini/Vertex AI Integration
- **Endpoint**: Vertex AI API (us-central1)
- **Authentication**: Service account with Vertex AI permissions
- **Rate Limiting**: Handled by Vertex AI quotas
- **Fallback**: Graceful degradation if API unavailable

### Database Integration
- **Connection**: Cloud SQL socket via VPC
- **Pool Size**: Configurable connection pooling
- **Transactions**: ACID compliance for all operations

### Storage Integration
- **Bucket**: Private GCS bucket with signed URLs
- **Retention**: Configurable evidence retention policy
- **Access**: Service account with specific IAM roles

## 📊 Monitoring & Observability

### Metrics
- Request latency and throughput
- AI response times
- Database query performance
- Error rates and types
- Resource utilization

### Logging
- All API requests and responses
- AI interaction logs
- Database queries
- Error stack traces
- User actions

### Alerting
- High error rates
- Increased latency
- AI API failures
- Database connection issues
- Cost threshold breaches

## 🎯 Key Architecture Principles

1. **Separation of Concerns**: Clear layers for frontend, backend, AI, and execution
2. **Security First**: Encrypted, private network with service account authentication
3. **Scalability**: Serverless components that scale automatically
4. **Observability**: Complete logging and monitoring throughout the stack
5. **Resilience**: Graceful error handling and fallbacks
6. **Efficiency**: Caching and optimization for cost-effectiveness

## 📝 Environment Configuration

See `infra/terraform/gcp/` for detailed infrastructure-as-code definitions:
- `apis.tf` - Enabled GCP APIs
- `cloud_run.tf` - Cloud Run services
- `sql.tf` - Cloud SQL configuration
- `storage.tf` - GCS buckets
- `network.tf` - VPC and networking
- `secrets.tf` - Secret Manager setup
