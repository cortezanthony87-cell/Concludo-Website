# Concludo Meeting Intelligence Pipeline and Output Selection Engine v1.0
## Master Architecture and Operating Model Specification

---

## Executive Metadata

| Dimension | Specification |
| :--- | :--- |
| Document Identifier | `CON-ARCH-MIP-001` |
| Document Release | Version 1.0 (Production Master) |
| Authoritative Scope | Concludo Workspace SaaS Intelligence Framework |
| Target Host Platform | `app.concludo.com` / Cloudflare Global Network |
| Data Tier Hosting | Supabase Enterprise (PostgreSQL 15+, Sydney `ap-southeast-2`) |
| Governance Alignment | ISO/IEC 27001, SOC 2 Type II, Australian Privacy Principles (APPs) |
| Typography & Visual Standard | Poppins (Headings), Inter (Body Text), Australian English |
| Editorial Restrictions | Zero em dashes, zero en dashes, strict executive clarity |

---

# SECTION 1: MISSION OF THE PIPELINE

### 1.1 The Fundamental Flaw of Conversational Summarisation

Modern corporate productivity tools suffer from an architectural blind spot: they treat business dialogue as ephemeral text to be condensed rather than operational intelligence to be structured, governed, and operationalised. The standard industry paradigm, represented by utilities such as Fireflies.ai, Otter.ai, Microsoft Teams Intelligent Recap, and Zoom AI Companion, follows a simplistic, lossy pipeline:

```
[Raw Audio / Transcript] ──> [Generic LLM Summariser] ──> [Unstructured Bullet Points]
```

This model is fundamentally flawed for enterprise operations. Summaries produce the illusion of productivity while systematically destroying strategic fidelity:

1. **Summaries Are Inherently Lossy:** Narrative summaries discard critical contextual nuance, dissent, counter-proposals, technical figures, and accountability subtleties. A five-sentence summary cannot represent the rigorous trade-offs of an executive strategy session.
2. **Summaries Are Structurally Unusable:** Unstructured paragraphs and generic bullet points cannot be programmatically queried, imported into a relational database, linked to a knowledge graph, or evaluated against past decisions.
3. **Summaries Are Operationally Passive:** A summary documents what was said in the past. It does not actively drive future organisational execution, calculate risk exposure, or establish unambiguous accountability.
4. **Summaries Ignore Historical Context:** Every meeting is processed in total isolation. Legacy tools have no persistent memory of prior board resolutions, ongoing project risks, or strategic key performance indicators.
5. **Summaries Obscure Decision Lineage:** When a major strategic choice is compressed into a single bullet point, the underlying rationale, discarded alternatives, financial projections, and executive sponsor are permanently lost.
6. **Summaries Create Executive Cognitive Fatigue:** Reading a generic 500-word summary requires almost as much cognitive energy as scanning the transcript, yet yields zero verifiable business deliverables.
7. **Summaries Fail the Delegation Standard:** Vague phrases such as "the team will investigate the platform migration" create operational paralysis. They fail to assign an unambiguous single owner, a firm calendar due date, or a measurable definition of done.

### 1.2 The Concludo Paradigm: From Dialogue to Executive Deliverables

Concludo Workspace completely rejects the summarisation paradigm. In Concludo, nothing generates outputs directly from an unstructured transcript. Every piece of business dialogue must pass through the multi-stage Meeting Intelligence Pipeline:

```
                                  CONCLUDO WORKSPACE
                                  
 [Raw Meeting Dialogue] 
           │
           ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 MEETING INTELLIGENCE PIPELINE                          │
 │                                                                        │
 │  * Acoustic & Text Normalisation      * Risk & Opportunity Detection   │
 │  * Bayesian Meeting Classification    * Meeting Health Engine (10-Dim) │
 │  * Business Intent Identification     * Dynamic Output Selection       │
 │  * Entity Disambiguation              * Concludo Insight Generation    │
 │  * Rigorous Decision Extraction       * Multi-Document Package Builder │
 │  * Five-Field Action Enforcement      * Knowledge Graph Linking        │
 └────────────────────────────────────────────────────────────────────────┘
           │
           ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 STRUCTURED ENTERPRISE INTELLIGENCE                     │
 │                                                                        │
 │  * Decision Memory (Audit Trailed)    * Executive Dashboards           │
 │  * Action Tracker (Firm Delegation)   * Strategic Roadmaps             │
 │  * Corporate Knowledge Graph          * Board Decision Packs           │
 │  * Predictive Risk Snapshots          * Autonomous AI Agent Directives │
 └────────────────────────────────────────────────────────────────────────┘
```

The transformation from `Transcript -> Intelligence -> Outputs` creates exponential enterprise value:
- **Mathematical Precision:** Converts verbal agreements into typed entities with explicit ownership and verifiable deadlines.
- **Persistent Organisational Memory:** Populates an enterprise-grade Knowledge Graph that tracks how strategies, risks, and decisions evolve across quarters and years.
- **Boardroom Deliverables:** Rather than providing a list of notes, the pipeline outputs structured business plans, risk registers, financial assumption matrices, and executive briefing packs formatted for senior leadership.
- **Autonomous Governance:** Feeds downstream AI agents, Copilot assistants, and external project management suites without re-processing raw text.

### 1.3 Comparative Competitive Analysis

To understand Concludo's defensible moat, the Meeting Intelligence Pipeline must be contrasted against current market utilities:

| Evaluation Dimension | Fireflies.ai / Otter.ai | Microsoft Teams Recap | Zoom AI Companion | Concludo Workspace SaaS |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Philosophy** | Audio transcription & keyword search | Platform-locked convenience notes | Ephemeral meeting recap | Enterprise Intelligence & Execution OS |
| **Data Transformation Model** | Lossy text condensation | Bulleted meeting notes | Generic conversational summary | Structured entity extraction & intelligence synthesis |
| **Decision Architecture** | None (embedded in text) | None (occasional task bullet) | None (ephemeral recap) | Dedicated Decision Memory with rationale & alternatives |
| **Action Delegation Standard** | Informal phrase capture | Basic task mentions in To-Do | Basic chat action items | Strict Five-Field Delegation Standard |
| **Meeting Health Diagnostics** | Talk-time percentage only | Basic speaking duration | Basic participation metrics | Comprehensive 10-Dimension Health Scoring (0 to 100) |
| **Risk & Opportunity Detection** | Keyword sentiment tagging | None | Basic sentiment highlights | Multi-tier categorised risk matrix & commercial opportunities |
| **Output Generation Breadth** | Single text summary | Single recap page | Single summary email | 10 Spine Outputs & 48 Catalogue Deliverables |
| **Visualisation Capabilities** | None (pure text/audio) | None | None | 28 Visual Types (SWOT, Gantt, Heatmaps, Roadmaps) |
| **Knowledge Graph Integration** | None | Limited Microsoft Graph | None | Living relational knowledge graph with evidence chains |
| **Strategic Advisory Insight** | None | None | None | Concludo Insight (blind spots, weak assumptions, risk gaps) |
| **AI Agent Consumption** | Human consumption only | Human consumption only | Human consumption only | Machine-readable JSON contracts for autonomous agents |
| **Data Sovereignty & Security** | US cloud tenancy | Standard tenant boundary | Shared cloud infrastructure | Australian data sovereignty, isolated RLS, zero model training |

### 1.4 What Makes Concludo Unique

Concludo is not an audio recorder; it is an Executive Operating System. Five structural differentiators separate Concludo from all legacy meeting software:

1. **Context-Adaptive Intelligence:** Concludo determines what kind of meeting occurred and adapts its analytical engines accordingly. A Board Meeting requires formal resolution tracking and governance compliance; a Product Discovery session requires user journey analysis and feature prioritisation.
2. **The Five-Field Delegation Standard:** Concludo strictly enforces Anthony Cortez's operational methodology. No action item is accepted without a task description, a single named owner, an explicit calendar due date, a verifiable definition of done, and an interim checkpoint date.
3. **The Unspoken Intelligence Layer (Concludo Insight):** Concludo analyses what was *not* said. It detects unaddressed risks, unchallenged assumptions, missing executive questions, and regulatory blind spots.
4. **Unified Output Packages:** Rather than a solitary email, Concludo compiles coordinated deliverable suites, combining executive briefings, visual roadmaps, decision registers, and risk heatmaps.
5. **Zero Transcript Re-Processing:** Downstream systems, Copilot queries, and autonomous AI agents query structured intelligence and relational knowledge graph nodes directly, eliminating redundant token costs and latency.


---

# SECTION 2: END-TO-END PIPELINE OVERVIEW

### 2.1 Visual Pipeline Architecture

The Concludo Meeting Intelligence Pipeline operates as an asynchronous, deterministic, directed acyclic graph (DAG) composed of sixteen orchestrated analytical stages. Every incoming meeting transcript must traverse this sequence to generate structured business artifacts.

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     STAGE 1: TRANSCRIPT INTAKE                         │
 │  * Multi-Source Ingestion (Teams, Zoom, Meet, Manual VTT/SRT/Text)     │
 │  * Acoustic Sanitisation, Normalisation & Speaker Diarisation Matching │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 STAGE 2: MEETING CLASSIFICATION                        │
 │  * Multi-Label Classification across 50 Distinct Enterprise Archetypes │
 │  * Modulation Indices (Strategic Importance & Risk Level Calculation)  │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    STAGE 3: CONTEXT EXTRACTION                         │
 │  * Historical Project Linking & Organisational Knowledge Graph Hydration│
 │  * Active Goal, Prior Decision & Ongoing Action Item Alignment         │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    STAGE 4: BUSINESS INTENT DETECTION                  │
 │  * Identification of Core Commercial Purpose (12 Strategic Intents)    │
 │  * Determination of Strategic Objectives & Success Criteria            │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                   STAGE 5: DECISION EXTRACTION                         │
 │  * Extraction of Explicit & Implicit Consensus Resolutions             │
 │  * Rationale, Discarded Alternatives, Impact & Sponsor Attribution     │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    STAGE 6: ACTION EXTRACTION                          │
 │  * Enforcement of Five-Field Delegation Standard (Owner, Due Date, DoD)│
 │  * Dependency Mapping & Accountability Integrity Validation            │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      STAGE 7: RISK DETECTION                           │
 │  * Categorisation across 9 Risk Domains (Strategic, Financial, Tech)   │
 │  * Severity x Probability 5x5 Matrix & Verbatim Citation Pinning       │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                   STAGE 8: OPPORTUNITY DETECTION                       │
 │  * Commercial, Efficiency, Product & Strategic Upside Identification   │
 │  * Feasibility vs Impact Scoring (0 to 100)                            │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                  STAGE 9: MEETING HEALTH ANALYSIS                      │
 │  * 10-Dimension Health Scoring (Clarity, Participation, Velocity)      │
 │  * Waste-of-Time Index & Executive ROI Determination                   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    STAGE 10: OUTPUT SELECTION                          │
 │  * Dynamic Routing to 10 Universal Spine & 48 Catalogue Deliverables   │
 │  * Audience Variation Gating (Executive, Technical, Operational)       │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 STAGE 11: VISUALIZATION SELECTION                      │
 │  * Dynamic Selection across 28 Visual Types (SWOT, Roadmaps, Heatmaps) │
 │  * Precondition Validation & Fallback Path Determination               │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                   STAGE 12: INSIGHT GENERATION                         │
 │  * Synthesis of Unspoken Intelligence (Weak Assumptions, Blind Spots)  │
 │  * High-Leverage Strategic Advisory Recommendations                    │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                STAGE 13: OUTPUT PACKAGE GENERATION                     │
 │  * Multi-Document Coordinated Suite Assembly (8 Standard Blueprints)   │
 │  * Print, Markdown, JSON & Interactive DOM Package Bundling            │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 STAGE 14: PERSISTENCE & AUDIT LOGGING                  │
 │  * Relational Insertion into Supabase (PostgreSQL 15+ in Sydney)       │
 │  * 30-Day Soft-Delete Quarantine & Append-Only Audit Trail             │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 STAGE 15: KNOWLEDGE GRAPH LINKING                      │
 │  * Entity & Directed Relationship Insertion (14 Node & 15 Edge Types)  │
 │  * Bidirectional Evidence Chain Traversal & Provenance Anchoring       │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 STAGE 16: DOWNSTREAM CONSUMPTION                       │
 │  * Instant Copilot Conversational Context (Zero Transcript Re-Reading) │
 │  * Autonomous AI Agent Directives with Human-in-the-Loop Governance    │
 │  * Executive Command Centre, Digital Twin & Predictive Intelligence    │
 └────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Detailed Explanation of Pipeline Stages

Every stage of the pipeline adheres to a strict contract: receiving validated inputs, applying deterministic heuristics and governed inference, and emitting strongly-typed schemas.

1. **Stage 1: Transcript Intake:** Ingests raw meeting data across six ingest channels. Standardises timestamps, strips audio artifacts and filler disfluencies, normalises punctuation, and maps speaker diarisation identifiers to verified internal user profiles or registered external stakeholders.
2. **Stage 2: Meeting Classification:** Evaluates the sanitised transcript against 50 enterprise meeting archetypes using Bayesian keyword density and semantic clustering. Determines two core modulation indices: Strategic Importance (1 to 10) and Inherent Risk Level (1 to 10).
3. **Stage 3: Context Extraction:** Hydrates the pipeline context with relevant organisational background from PostgreSQL and the Knowledge Graph. Pulls active project charters, past meeting decisions, outstanding team action items, and strategic goals.
4. **Stage 4: Business Intent Detection:** Classifies the primary commercial driver of the session across twelve strategic business intents. Establishes the expected executive deliverables required to satisfy the meeting's true business purpose.
5. **Stage 5: Decision Extraction:** Identifies explicit resolutions, policy changes, and architectural mandates. Extracts the underlying business rationale, evaluated alternatives that were rejected, financial exposure, and executive sponsors.
6. **Stage 6: Action Extraction:** Isolates operational commitments and strictly enforces the Five-Field Delegation Standard. Verifies that every task has a single human owner, a calendar deadline, and an objective definition of done.
7. **Stage 7: Risk Detection:** Scans dialogue for unmitigated vulnerabilities across nine enterprise risk categories. Scores each risk on a 5x5 severity and probability matrix and anchors the risk to exact transcript utterances.
8. **Stage 8: Opportunity Detection:** Uncovers potential commercial, operational, or technological upside discussed during the meeting. Ranks each opportunity by feasibility, strategic fit, and estimated value creation.
9. **Stage 9: Meeting Health Analysis:** Executes a quantitative diagnostic across ten dimensions of meeting performance, generating a 0 to 100 Meeting Health Score and identifying dysfunctions such as conversational monopolisation or action ambiguity.
10. **Stage 10: Output Selection:** Acts as the strategic switchboard. Evaluates the meeting classification, business intent, and health metrics to select the optimal suite of deliverables from the 10 universal spine outputs and 48 catalogue deliverables.
11. **Stage 11: Visualization Selection:** Evaluates the selected deliverables against 28 visual types. Determines which charts, diagrams, heatmaps, or roadmaps possess sufficient structured data to render with high fidelity.
12. **Stage 12: Insight Generation (Concludo Insight):** Examines the structural gaps in the conversation. Identifies what the executive team failed to discuss, unverified assumptions, and unaddressed governance requirements.
13. **Stage 13: Output Package Generation:** Assembles individual deliverables into cohesive executive suites (such as the Board Governance Pack or the Product Launch Suite), rendering both human-readable Markdown/PDF documents and machine-readable JSON payloads.
14. **Stage 14: Persistence & Storage:** Writes all extracted records into Supabase PostgreSQL tables (`outputs`, `decision_memory`, `action_tracker`, `generated_intelligence`, `audit_logs`). Enforces Australian data residency and Row-Level Security.
15. **Stage 15: Knowledge Graph Linking:** Ingests newly extracted entities and directed relationships into the relational knowledge graph tables (`knowledge_nodes`, `knowledge_relationships`), establishing immutable evidence chains back to the transcript.
16. **Stage 16: Downstream Consumption:** Exposes structured intelligence to the Concludo Copilot conversational interface, autonomous AI agents, and the Executive Command Centre without requiring any component to re-ingest raw transcript text.

### 2.3 Execution Context and State Machine

The pipeline operates within an immutable execution envelope known as the `PipelineExecutionContext`. This envelope tracks pipeline lifecycle states, execution metrics, and intermediate artifacts:

```typescript
export interface PipelineExecutionContext {
  executionId: string;
  transcriptId: string;
  projectId: string;
  organizationId: string;
  triggeredByUserId: string;
  currentStage: PipelineStage;
  stageTimingsMs: Record<PipelineStage, number>;
  classificationResult?: ClassificationPayload;
  intentResult?: IntentPayload;
  extractedEntities?: EntityCollection;
  extractedDecisions?: DecisionPayload[];
  extractedActions?: ActionPayload[];
  detectedRisks?: RiskPayload[];
  detectedOpportunities?: OpportunityPayload[];
  healthScorecard?: MeetingHealthScorecard;
  selectedOutputs?: SelectedOutputItem[];
  selectedVisualizations?: SelectedVisualItem[];
  generatedInsights?: InsightCollection;
  finalPackages?: OutputPackageCollection;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'quarantined';
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}
```

The pipeline enforces strict state transitions. If a critical extraction stage fails validation (such as an unresolvable diarisation failure or an empty transcript payload), the execution envelope transitions to `quarantined`, emitting an administrative audit event and alerting the user with an actionable remedy.


---

# SECTION 3: TRANSCRIPT INTAKE ENGINE

### 3.1 Ingestion Channels and Protocols

The Transcript Intake Engine is the authoritative gateway through which external meeting recordings and conversational text enter Concludo Workspace. The engine supports six primary intake channels:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     SUPPORTED INTAKE CHANNELS                          │
 ├─────────────────────────┬──────────────────────────────────────────────┤
 │ 1. Manual File Upload   │ Web UI drag-and-drop supporting .vtt, .srt,  │
 │                         │ .json, .txt, .docx, and audio files.         │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 2. Microsoft Teams      │ Automated Graph API webhook listening for    │
 │                         │ onlineMeeting.transcript.ready events.       │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 3. Zoom Cloud Meetings  │ Webhook receiver for recording.completed and │
 │                         │ transcript.completed OAuth app payloads.     │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 4. Google Meet          │ Google Workspace Drive webhook capturing     │
 │                         │ recorded Meet VTT transcripts and docs.      │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 5. Web Ingest API       │ Authenticated HTTPS REST endpoint (/api/v1/  │
 │                         │ transcripts/ingest) for programmatic feeds.  │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 6. Future Telephony     │ Direct SIP/RTP stream and carrier call-centre│
 │                         │ ingestion via dedicated WebSocket relays.    │
 └─────────────────────────┴──────────────────────────────────────────────┘
```

### 3.2 Ingestion Validation Pipeline

Upon receipt of a transcript payload, the intake engine executes five mandatory validation checks:
1. **MIME-Type & Format Verification:** Validates that incoming files conform to known transcript structures (VTT, SRT, WebVTT, JSON diarised format, or plain text). Non-conforming binary files are rejected immediately.
2. **Payload Size Guardrails:** Supports transcripts from 5 minutes (minimum 250 words) up to 8 hours (maximum 150,000 words or 15 MB of formatted text). Payloads exceeding 150,000 words are chunked into contiguous session segments.
3. **Character Encoding Normalisation:** Enforces UTF-8 encoding across all incoming streams, converting legacy Windows-1252 or ISO-8859 text to avoid typographic corruption.
4. **Security Sanitisation:** Scans text payloads for script injection tags, malformed XML control sequences, and malicious markdown exploits before writing to raw storage.
5. **Diarisation Integrity Check:** Verifies whether the transcript contains speaker labels. Transcripts lacking speaker labels are flagged for heuristic speaker segmentation.

### 3.3 Text Cleaning and Acoustic Normalisation

Raw speech-to-text transcripts are notorious for acoustic artifacts, false starts, and filler words that distort semantic analysis. Concludo applies a multi-pass cleaning pipeline:

```
  [Raw STT Output]
         │
         ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Pass 1: Disfluency & Acoustic Noise Removal                      │
  │ Filters conversational fillers ("um", "ah", "er", "like", "you   │
  │ know", "sort of") while strictly preserving technical hesitations│
  │ and deliberate qualifications ("I believe", "under condition").  │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Pass 2: Punctuation & Sentence Boundary Repair                   │
  │ Restores missing full stops, capitalisation, and question marks  │
  │ based on acoustic pitch pauses and grammatical clause boundaries.│
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Pass 3: Technical Term & Financial Unit Normalisation            │
  │ Standardises currency expressions ("fifty k" -> "$50,000 AUD"),  │
  │ dates ("next Tuesday the 15th" -> "2026-09-15"), and software    │
  │ terminology (e.g., "Kubernetes", "PostgreSQL", "Supabase").      │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │ Pass 4: Australian English Standardisation                       │
  │ Enforces consistent Australian spelling conventions across all   │
  │ dialogue tokens (e.g., "programme", "optimise", "organisation"). │
  └──────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
  [Clean Sanitised Dialogue Corpus]
```

### 3.4 Speaker Identification and Resolution

Assigning verbal commitments to unambiguous individuals requires robust speaker resolution. The Intake Engine reconciles raw speaker labels (e.g., "Speaker 1", "John", "Unknown Guest") through a four-tier identity resolution hierarchy:

```
 Tier 1: Platform Metadata Resolution
 Match calendar invite attendees via email addresses provided by Teams, Zoom, or Google Meet.
                       │ (if unresolved)
                       ▼
 Tier 2: Workspace Member Matching
 Match display names, first names, or acoustic voiceprints against profiles in public.organization_members.
                       │ (if unresolved)
                       ▼
 Tier 3: Contextual In-Transcript Self-Identification
 Parse opening greetings and address statements (e.g., "Thanks Sarah, this is David from Finance").
                       │ (if unresolved)
                       ▼
 Tier 4: Registered External Stakeholder Assignment
 Create a scoped external guest entity (e.g., "David Wilson (External / Vendor: Oracle)") linked to the meeting.
```

### 3.5 Metadata Extraction Schema

The engine extracts and structures all operational metadata into the `transcripts` table:

```json
{
  "transcript_id": "trn_9a8b7c6d-e5f4-4a3b-8c2d-1e0f9a8b7c6d",
  "project_id": "prj_550e8400-e29b-41d4-a716-446655440000",
  "organization_id": "org_770e8400-e29b-41d4-a716-446655440000",
  "source_platform": "teams",
  "external_meeting_id": "Mtg_20260914_StrategyQ4",
  "meeting_title": "Q4 Strategic Capital Allocation and Programme Governance",
  "scheduled_start": "2026-09-14T09:00:00+10:00",
  "actual_duration_seconds": 3480,
  "word_count": 8740,
  "speaker_count": 6,
  "participants": [
    {
      "speaker_id": "spk_1",
      "user_id": "usr_c01a-88bf",
      "name": "Anthony Cortez",
      "email": "anthony@concludo.au",
      "role": "Managing Director",
      "talk_time_seconds": 1280,
      "utterance_count": 42
    },
    {
      "speaker_id": "spk_2",
      "user_id": "usr_e44d-11ac",
      "name": "Sarah Jenkins",
      "email": "sarah.j@concludo.au",
      "role": "Head of Product",
      "talk_time_seconds": 940,
      "utterance_count": 31
    }
  ],
  "cleaning_metrics": {
    "fillers_removed": 184,
    "punctuation_repairs": 67,
    "confidence_average": 0.942
  }
}
```

### 3.6 Error Handling and Dead-Letter Quarantine

To maintain enterprise reliability, unprocessable or corrupt transcripts never crash the pipeline. Transcripts with unrecoverable defects are routed to an isolated quarantine table (`quarantined_transcripts`) with automated telemetry alerts. Common quarantine triggers include:
- Audio-to-text confidence score below 0.60.
- Transcripts under 250 words with no verifiable business content.
- Unresolvable foreign language streams where English translation is unavailable.
- Severe diarisation collision where 80% or more of dialogue is attributed to an unidentifiable single speaker.


---

The Meeting Classification Engine determines the fundamental business character of the meeting from its sanitised transcript. Concludo enforces a 50-type classification ontology across six enterprise families:\n\n| Code | Meeting Archetype | Strategic Family | Primary Keywords | Expected Primary Outputs | Confidence Scoring Model |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| **M-01** | Executive Strategy Session | Executive & Governance | `vision, 3-year plan, competitive advanta...` | `OUT-01 (Executive Briefing), OUT-02...` | Prior 0.20; keyword density +0... |\n| **M-02** | Board of Directors Meeting | Executive & Governance | `quorum, resolution, moved, seconded, fid...` | `OUT-01 (Executive Briefing), OUT-02...` | Prior 0.10; governance keyword... |\n| **M-03** | Risk & Audit Committee | Executive & Governance | `internal controls, compliance, vulnerabi...` | `OUT-05 (Risk and Issue Log), OUT-20...` | Prior 0.15; compliance keyword... |\n| **M-04** | Senior Leadership Team (SLT) Weekly | Executive & Governance | `weekly pulse, cross-functional blockers,...` | `OUT-01 (Executive Briefing), OUT-03...` | Prior 0.25; executive attendan... |\n| **M-05** | Investor & Shareholder Briefing | Executive & Governance | `runway, burn rate, ARR, CAC, LTV, valuat...` | `OUT-01 (Executive Briefing), OUT-13...` | Prior 0.10; investor terminolo... |\n| **M-06** | Annual General Meeting (AGM) | Executive & Governance | `ordinary business, special resolution, p...` | `OUT-02 (Decision Register), OUT-04 ...` | Prior 0.05; statutory phrasing... |\n| **M-07** | Advisory Board Consultation | Executive & Governance | `industry trend, domain perspective, regu...` | `OUT-04 (Discussion Synthesis), OUT-...` | Prior 0.15; advisor attendees ... |\n| **M-08** | Crisis Management Council | Executive & Governance | `incident response, press statement, regu...` | `OUT-01 (Executive Briefing), OUT-03...` | Prior 0.05; incident keywords ... |\n| **M-09** | Mergers & Acquisitions Steering | Executive & Governance | `due diligence, target valuation, synergy...` | `OUT-13 (Commercial Investment Case)...` | Prior 0.10; M&A keywords +0.55... |\n| **M-10** | Annual Business Planning | Strategic & Commercial | `operating budget, head count plan, reven...` | `OUT-11 (Strategic Business Plan), O...` | Prior 0.20; budgeting terms +0... |\n| **M-11** | Commercial Contract Negotiation | Strategic & Commercial | `master services agreement, indemnity, li...` | `OUT-02 (Decision Register), OUT-05 ...` | Prior 0.15; contract keywords ... |\n| **M-12** | Go-To-Market (GTM) Strategy | Strategic & Commercial | `ideal customer profile, positioning, mes...` | `OUT-15 (Product Launch Plan), OUT-1...` | Prior 0.20; marketing terms +0... |\n| **M-13** | Quarterly Business Review (QBR) | Strategic & Commercial | `quarterly quota, pipeline coverage, chur...` | `OUT-01 (Executive Briefing), OUT-18...` | Prior 0.25; quarterly metrics ... |\n| **M-14** | Strategic Partnership Summit | Strategic & Commercial | `co-selling, joint venture, distribution ...` | `OUT-04 (Discussion Synthesis), OUT-...` | Prior 0.15; partner keywords +... |\n| **M-15** | Pricing & Packaging Review | Strategic & Commercial | `tiering, willingness to pay, gross margi...` | `OUT-02 (Decision Register), OUT-13 ...` | Prior 0.10; pricing terms +0.5... |\n| **M-16** | Market Expansion Workshop | Strategic & Commercial | `new territory, regulatory hurdles, local...` | `OUT-11 (Strategic Business Plan), O...` | Prior 0.15; expansion keywords... |\n| **M-17** | Sales Pipeline & Deal Review | Strategic & Commercial | `stage 3, procurement hurdle, economic bu...` | `OUT-03 (Action Plan), OUT-01 (Execu...` | Prior 0.30; sales CRM terms +0... |\n| **M-18** | Brand & Corporate Positioning | Strategic & Commercial | `narrative, brand archetype, tone of voic...` | `OUT-04 (Discussion Synthesis), OUT-...` | Prior 0.15; branding keywords ... |\n| **M-19** | Product Discovery Workshop | Product & Engineering | `user pain point, jobs to be done, custom...` | `OUT-16 (Product Feature Specificati...` | Prior 0.20; UX keywords +0.45;... |\n| **M-20** | Product Roadmap Planning | Product & Engineering | `quarterly themes, epic, engineering capa...` | `OUT-14 (Strategic Roadmap), OUT-16 ...` | Prior 0.25; roadmap terms +0.4... |\n| **M-21** | Architecture Governance Board | Product & Engineering | `microservices, latency, throughput, sche...` | `OUT-17 (Technical Architecture Spec...` | Prior 0.15; infrastructure ter... |\n| **M-22** | Sprint Planning & Backlog | Product & Engineering | `story points, sprint backlog, acceptance...` | `OUT-03 (Action Plan), OUT-16 (Produ...` | Prior 0.35; agile terminology ... |\n| **M-23** | Technical Post-Mortem & Incident Review | Product & Engineering | `root cause, five whys, MTTD, MTTR, outag...` | `OUT-21 (Incident Post-Mortem), OUT-...` | Prior 0.10; incident post-mort... |\n| **M-24** | Security & Penetration Audit Review | Product & Engineering | `CVE, zero-day, OWASP, SQL injection, RCE...` | `OUT-20 (Enterprise Risk Audit), OUT...` | Prior 0.10; infosec keywords +... |\n| **M-25** | AI & Machine Learning Strategy | Product & Engineering | `token budget, inference latency, RAG, em...` | `OUT-17 (Technical Architecture Spec...` | Prior 0.15; AI keywords +0.55;... |\n| **M-26** | Design Sprint & UX Critique | Product & Engineering | `visual hierarchy, affordance, Figma, des...` | `OUT-16 (Product Feature Specificati...` | Prior 0.20; UX design terms +0... |\n| **M-27** | Platform Scaling & Infrastructure Review | Product & Engineering | `auto-scaling, read replica, cloud spend,...` | `OUT-17 (Technical Architecture Spec...` | Prior 0.15; infrastructure key... |\n| **M-28** | Programme Governance & SteerCo | Operational & Delivery | `milestone delivery, critical path, budge...` | `OUT-19 (Programme Delivery Status),...` | Prior 0.25; project management... |\n| **M-29** | Operational Performance Review | Operational & Delivery | `throughput, operational bottleneck, SLA ...` | `OUT-18 (Operational Performance Rev...` | Prior 0.25; operations terms +... |\n| **M-30** | Project Kick-Off Meeting | Operational & Delivery | `project charter, RACI, scope in/out, del...` | `OUT-19 (Programme Delivery Status),...` | Prior 0.20; kickoff terms +0.5... |\n| **M-31** | Weekly Project Status Sync | Operational & Delivery | `what was done, what is next, blockers, d...` | `OUT-03 (Action Plan), OUT-19 (Progr...` | Prior 0.35; status terms +0.40... |\n| **M-32** | Continuous Improvement & Kaizen | Operational & Delivery | `waste elimination, cycle time, process m...` | `OUT-18 (Operational Performance Rev...` | Prior 0.15; lean keywords +0.5... |\n| **M-33** | Budget & Cost Control Review | Operational & Delivery | `OPEX, CAPEX, cost overrun, unbudgeted ex...` | `OUT-18 (Operational Performance Rev...` | Prior 0.20; financial cost ter... |\n| **M-34** | Resource & Workforce Capacity Planning | Operational & Delivery | `utilisation rate, bench, billable hours,...` | `OUT-19 (Programme Delivery Status),...` | Prior 0.20; resource managemen... |\n| **M-35** | Vendor & Supplier Performance Review | Operational & Delivery | `contractor SLA, deliverables quality, in...` | `OUT-18 (Operational Performance Rev...` | Prior 0.15; procurement terms ... |\n| **M-36** | Supply Chain & Logistics Operational Review | Operational & Delivery | `lead times, inventory levels, freight co...` | `OUT-18 (Operational Performance Rev...` | Prior 0.15; supply chain terms... |\n| **M-37** | Executive Talent & Search Briefing | People & Culture | `candidate shortlist, compensation packag...` | `OUT-02 (Decision Register), OUT-04 ...` | Prior 0.15; hiring terms +0.50... |\n| **M-38** | Performance Calibration Review | People & Culture | `bell curve, rating distribution, promoti...` | `OUT-02 (Decision Register), OUT-04 ...` | Prior 0.10; HR terms +0.55; ra... |\n| **M-39** | Succession & Talent Planning | People & Culture | `nine box grid, flight risk, key person r...` | `OUT-02 (Decision Register), OUT-05 ...` | Prior 0.15; succession terms +... |\n| **M-40** | Company Town Hall & All-Hands | People & Culture | `quarterly highlights, company vision, we...` | `OUT-07 (Stakeholder Communication),...` | Prior 0.20; town hall keywords... |\n| **M-41** | Team Retrospective | People & Culture | `what went well, what could be improved, ...` | `OUT-04 (Discussion Synthesis), OUT-...` | Prior 0.25; retro terms +0.45;... |\n| **M-42** | Culture, Engagement & DE&I Council | People & Culture | `engagement survey, eNPS, inclusion, pay ...` | `OUT-04 (Discussion Synthesis), OUT-...` | Prior 0.15; engagement keyword... |\n| **M-43** | Remuneration & Incentive Committee | People & Culture | `executive compensation, short-term incen...` | `OUT-02 (Decision Register), OUT-04 ...` | Prior 0.10; executive comp ter... |\n| **M-44** | Enterprise Sales Discovery Call | Customer & External | `current stack, workflow pain, budget aut...` | `OUT-13 (Commercial Investment Case)...` | Prior 0.30; discovery keywords... |\n| **M-45** | Enterprise Client Solutions Pitch | Customer & External | `proposed solution, implementation timeli...` | `OUT-13 (Commercial Investment Case)...` | Prior 0.25; pitch terms +0.45;... |\n| **M-46** | Client Implementation Kick-Off | Customer & External | `project charter, data migration, user pr...` | `OUT-19 (Programme Delivery Status),...` | Prior 0.20; implementation ter... |\n| **M-47** | Client Success Executive Business Review | Customer & External | `value realized, adoption metrics, featur...` | `OUT-01 (Executive Briefing), OUT-06...` | Prior 0.20; client success ter... |\n| **M-48** | Client Escalation & Remediation | Customer & External | `breach of contract, executive sponsor es...` | `OUT-01 (Executive Briefing), OUT-03...` | Prior 0.10; escalation terms +... |\n| **M-49** | Professional Services Advisory Workshop | Customer & External | `current state assessment, target operati...` | `OUT-11 (Strategic Business Plan), O...` | Prior 0.15; consulting terms +... |\n| **M-50** | Public Stakeholder & Community Consultation | Customer & External | `public feedback, environmental impact, c...` | `OUT-04 (Discussion Synthesis), OUT-...` | Prior 0.10; public consultatio... |\n\n### 4.2 Comprehensive Meeting Type Specifications\n\n#### M-01: Executive Strategy Session (Executive & Governance)\n- **Semantic Keywords:** vision, 3-year plan, competitive advantage, market positioning, moat, capital allocation, EBITDA, strategic pillar\n- **Behavioural Indicators:** Senior executive attendance, multi-year forward horizons, discussion of industry macro shifts, low operational jargon.\n- **Expected Conversational Behaviour:** Deliberate debate, long speaking turns, rigorous challenge of assumptions, synthesis of company trajectory.\n- **Mandatory Deliverables:** OUT-01 (Executive Briefing), OUT-02 (Decision Register), OUT-11 (Strategic Business Plan), OUT-14 (Strategic Roadmap)\n- **Mandatory Visualisations:** VIS-01 (SWOT Analysis), VIS-03 (Strategic Roadmap), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.20; keyword density +0.40; executive attendee seniority +0.30; horizon > 2 years +0.10. Threshold: 0.82\n\n#### M-02: Board of Directors Meeting (Executive & Governance)\n- **Semantic Keywords:** quorum, resolution, moved, seconded, fiduciary, shareholder, governance, statutory, audited accounts, charter\n- **Behavioural Indicators:** Formal roll-call, presence of non-executive directors, legal counsel, sequential agenda adherence.\n- **Expected Conversational Behaviour:** Strict parliamentary procedure, voting, recorded dissent, high formality, structured financial reporting.\n- **Mandatory Deliverables:** OUT-01 (Executive Briefing), OUT-02 (Decision Register), OUT-12 (Board Decision Pack), OUT-09 (Verbatim Evidence Index)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-09 (Revenue Forecast), VIS-11 (Organisation Map)\n- **Bayesian Scoring Model:** Prior 0.10; governance keywords +0.50; formal resolution phrases +0.30; external director presence +0.10. Threshold: 0.85\n\n#### M-03: Risk & Audit Committee (Executive & Governance)\n- **Semantic Keywords:** internal controls, compliance, vulnerability, audit findings, appetite, penetration test, SOX, regulatory penalty, mitigation\n- **Behavioural Indicators:** Audit leads present, focus on statutory risks, operational resilience, past non-compliance remediation.\n- **Expected Conversational Behaviour:** Critical interrogation, evidence-based review, adversarial testing of management assertions, focus on downside protection.\n- **Mandatory Deliverables:** OUT-05 (Risk and Issue Log), OUT-20 (Enterprise Risk Audit), OUT-02 (Decision Register), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-05 (Risk Heatmap), VIS-10 (Risk-Reward Matrix), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.15; compliance keywords +0.45; severity discussion +0.25; risk officer presence +0.15. Threshold: 0.80\n\n#### M-04: Senior Leadership Team (SLT) Weekly (Executive & Governance)\n- **Semantic Keywords:** weekly pulse, cross-functional blockers, department update, executive escalation, hiring approvals, KPI variance\n- **Behavioural Indicators:** Weekly recurring cadence, departmental heads present, rapid cross-functional status reporting.\n- **Expected Conversational Behaviour:** High dialogue velocity, rapid transitions between business units, active escalation of cross-team blockers.\n- **Mandatory Deliverables:** OUT-01 (Executive Briefing), OUT-03 (Action Plan), OUT-02 (Decision Register), OUT-10 (Meeting Performance Report)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-06 (Action Priority Matrix)\n- **Bayesian Scoring Model:** Prior 0.25; executive attendance +0.35; weekly cadence +0.25; cross-department topics +0.15. Threshold: 0.78\n\n#### M-05: Investor & Shareholder Briefing (Executive & Governance)\n- **Semantic Keywords:** runway, burn rate, ARR, CAC, LTV, valuation, capital raise, dilution, term sheet, series round, investor deck\n- **Behavioural Indicators:** External investor attendees, financial performance slides, capital management dialogue, forward guidance.\n- **Expected Conversational Behaviour:** Defensive presentation, value proposition reinforcement, growth narrative framing, market opportunity sizing.\n- **Mandatory Deliverables:** OUT-01 (Executive Briefing), OUT-13 (Commercial Investment Case), OUT-06 (Opportunity Assessment)\n- **Mandatory Visualisations:** VIS-09 (Revenue Forecast), VIS-03 (Strategic Roadmap), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.10; investor terminology +0.50; external participant domains +0.30; valuation dialogue +0.10. Threshold: 0.84\n\n#### M-06: Annual General Meeting (AGM) (Executive & Governance)\n- **Semantic Keywords:** ordinary business, special resolution, proxy votes, annual report, director election, shareholder questions, poll\n- **Behavioural Indicators:** Large attendance list, legal declarations, statutory timing, presentation of audited financial statements.\n- **Expected Conversational Behaviour:** Formal script reading, structured shareholder question period, formal recording of shareholder voting percentages.\n- **Mandatory Deliverables:** OUT-02 (Decision Register), OUT-04 (Discussion Synthesis), OUT-09 (Verbatim Evidence Index)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-11 (Organisation Map)\n- **Bayesian Scoring Model:** Prior 0.05; statutory phrasing +0.60; annual financial mentions +0.25; shareholder question markers +0.10. Threshold: 0.88\n\n#### M-07: Advisory Board Consultation (Executive & Governance)\n- **Semantic Keywords:** industry trend, domain perspective, regulatory tailwind, sounding board, market introduction, external benchmark\n- **Behavioural Indicators:** External advisors present, exploratory strategic discourse, lack of binding corporate resolutions.\n- **Expected Conversational Behaviour:** Consultative dialogue, open brainstorming, strategic mentoring, exploration of alternative scenarios.\n- **Mandatory Deliverables:** OUT-04 (Discussion Synthesis), OUT-06 (Opportunity Assessment), OUT-14 (Strategic Roadmap)\n- **Mandatory Visualisations:** VIS-01 (SWOT Analysis), VIS-03 (Strategic Roadmap)\n- **Bayesian Scoring Model:** Prior 0.15; advisor attendees +0.40; macro industry keywords +0.30; exploratory markers +0.15. Threshold: 0.75\n\n#### M-08: Crisis Management Council (Executive & Governance)\n- **Semantic Keywords:** incident response, press statement, regulatory breach, ransomware, data leak, immediate containment, war room\n- **Behavioural Indicators:** Emergency unscheduled meeting, senior legal, PR and executive leads present, high stress tone.\n- **Expected Conversational Behaviour:** Urgent directives, minute-by-minute timeline tracking, strict communication protocol enforcement.\n- **Mandatory Deliverables:** OUT-01 (Executive Briefing), OUT-03 (Action Plan), OUT-05 (Risk and Issue Log), OUT-07 (Stakeholder Communication)\n- **Mandatory Visualisations:** VIS-05 (Risk Heatmap), VIS-02 (Timeline Map)\n- **Bayesian Scoring Model:** Prior 0.05; incident keywords +0.60; rapid turn taking +0.25; unscheduled cadence +0.10. Threshold: 0.85\n\n#### M-09: Mergers & Acquisitions Steering (Executive & Governance)\n- **Semantic Keywords:** due diligence, target valuation, synergy, accretive, asset purchase, LOI, exclusivity, integration cost, antitrust\n- **Behavioural Indicators:** Confidential code names, corporate development leads, legal and financial due diligence reviews.\n- **Expected Conversational Behaviour:** Analytical scrutiny, risk evaluation, valuation modelling challenges, deal viability debates.\n- **Mandatory Deliverables:** OUT-13 (Commercial Investment Case), OUT-05 (Risk and Issue Log), OUT-02 (Decision Register)\n- **Mandatory Visualisations:** VIS-10 (Risk-Reward Matrix), VIS-09 (Revenue Forecast), VIS-05 (Risk Heatmap)\n- **Bayesian Scoring Model:** Prior 0.10; M&A keywords +0.55; corporate finance leads +0.25; valuation models +0.10. Threshold: 0.86\n\n#### M-10: Annual Business Planning (Strategic & Commercial)\n- **Semantic Keywords:** operating budget, head count plan, revenue targets, operating model, strategic initiatives, resource allocation\n- **Behavioural Indicators:** Comprehensive financial models, annual cycle alignment, multi-departmental representation.\n- **Expected Conversational Behaviour:** Resource negotiation, trade-off analysis, KPI target setting, priority rationalisation.\n- **Mandatory Deliverables:** OUT-11 (Strategic Business Plan), OUT-02 (Decision Register), OUT-14 (Strategic Roadmap), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-01 (SWOT Analysis), VIS-03 (Strategic Roadmap), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.20; budgeting terms +0.40; annual targets +0.25; cross-departmental attendees +0.15. Threshold: 0.80\n\n#### M-11: Commercial Contract Negotiation (Strategic & Commercial)\n- **Semantic Keywords:** master services agreement, indemnity, liability cap, SLA, payment terms, termination for convenience, redline, clause\n- **Behavioural Indicators:** Legal counsel and commercial leads present, review of draft agreement clauses, commercial posture debate.\n- **Expected Conversational Behaviour:** Position bargaining, risk mitigation, concession trading, legal exposure evaluation.\n- **Mandatory Deliverables:** OUT-02 (Decision Register), OUT-05 (Risk and Issue Log), OUT-03 (Action Plan), OUT-09 (Verbatim Evidence Index)\n- **Mandatory Visualisations:** VIS-05 (Risk Heatmap), VIS-07 (Decision Logic Tree)\n- **Bayesian Scoring Model:** Prior 0.15; contract keywords +0.50; clause citations +0.25; commercial terms +0.10. Threshold: 0.82\n\n#### M-12: Go-To-Market (GTM) Strategy (Strategic & Commercial)\n- **Semantic Keywords:** ideal customer profile, positioning, messaging, launch channels, sales enablement, demand gen, CAC payback, conversion\n- **Behavioural Indicators:** Product marketing, sales leadership, and growth marketing teams collaborating on launch execution.\n- **Expected Conversational Behaviour:** Channel prioritisation, tactical timeline coordination, competitive differentiation analysis.\n- **Mandatory Deliverables:** OUT-15 (Product Launch Plan), OUT-14 (Strategic Roadmap), OUT-03 (Action Plan), OUT-06 (Opportunity Assessment)\n- **Mandatory Visualisations:** VIS-03 (Strategic Roadmap), VIS-06 (Action Priority Matrix), VIS-02 (Timeline Map)\n- **Bayesian Scoring Model:** Prior 0.20; marketing terms +0.40; customer segment focus +0.25; launch timeline +0.15. Threshold: 0.79\n\n#### M-13: Quarterly Business Review (QBR) (Strategic & Commercial)\n- **Semantic Keywords:** quarterly quota, pipeline coverage, churn, expansion revenue, net retention, customer health, win rate, variance\n- **Behavioural Indicators:** Quarterly recurring cadence, performance slide reviews, target attainment vs actuals.\n- **Expected Conversational Behaviour:** Retrospective performance accounting, forward quarter forecasting, accountability for missed targets.\n- **Mandatory Deliverables:** OUT-01 (Executive Briefing), OUT-18 (Operational Performance Review), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-09 (Revenue Forecast)\n- **Bayesian Scoring Model:** Prior 0.25; quarterly metrics +0.45; recurring cadence +0.20; quota analysis +0.10. Threshold: 0.81\n\n#### M-14: Strategic Partnership Summit (Strategic & Commercial)\n- **Semantic Keywords:** co-selling, joint venture, distribution agreement, technology integration, rev share, partner tier, channel enablement\n- **Behavioural Indicators:** External executive attendees from partner firm, strategic collaboration frameworks, shared upside models.\n- **Expected Conversational Behaviour:** Alignment on joint value propositions, trust building, commercial terms outlining, governance setup.\n- **Mandatory Deliverables:** OUT-04 (Discussion Synthesis), OUT-06 (Opportunity Assessment), OUT-02 (Decision Register), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-03 (Strategic Roadmap), VIS-10 (Risk-Reward Matrix)\n- **Bayesian Scoring Model:** Prior 0.15; partner keywords +0.45; external partner email domains +0.30; joint objectives +0.10. Threshold: 0.80\n\n#### M-15: Pricing & Packaging Review (Strategic & Commercial)\n- **Semantic Keywords:** tiering, willingness to pay, gross margin, discounting, feature gating, grandfathering, price elasticity, bundle\n- **Behavioural Indicators:** Product and finance leads present, unit economic modelling, competitor pricing benchmarks.\n- **Expected Conversational Behaviour:** Rigorous sensitivity analysis, customer reaction modeling, churn risk assessment vs margin uplift.\n- **Mandatory Deliverables:** OUT-02 (Decision Register), OUT-13 (Commercial Investment Case), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-07 (Decision Logic Tree), VIS-09 (Revenue Forecast)\n- **Bayesian Scoring Model:** Prior 0.10; pricing terms +0.55; margin discussions +0.25; product tier focus +0.10. Threshold: 0.83\n\n#### M-16: Market Expansion Workshop (Strategic & Commercial)\n- **Semantic Keywords:** new territory, regulatory hurdles, localisation, market entry, TAM, beachhead, distribution partner, legal entity\n- **Behavioural Indicators:** Internationalization strategy, exploratory geographic focus, market sizing spreadsheets.\n- **Expected Conversational Behaviour:** Exploration of entry barriers, capital requirement estimations, competitor mapping.\n- **Mandatory Deliverables:** OUT-11 (Strategic Business Plan), OUT-06 (Opportunity Assessment), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-01 (SWOT Analysis), VIS-03 (Strategic Roadmap), VIS-05 (Risk Heatmap)\n- **Bayesian Scoring Model:** Prior 0.15; expansion keywords +0.45; regulatory compliance focus +0.25; new market sizing +0.15. Threshold: 0.78\n\n#### M-17: Sales Pipeline & Deal Review (Strategic & Commercial)\n- **Semantic Keywords:** stage 3, procurement hurdle, economic buyer, closed won, slips, champion, MEDDIC, discount approval, quota\n- **Behavioural Indicators:** Sales managers and reps, CRM pipeline walkthrough, deal-by-deal interrogation.\n- **Expected Conversational Behaviour:** Rapid tactical coaching, qualification interrogation, close-plan pressure testing.\n- **Mandatory Deliverables:** OUT-03 (Action Plan), OUT-01 (Executive Briefing), OUT-10 (Meeting Performance Report)\n- **Mandatory Visualisations:** VIS-06 (Action Priority Matrix), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.30; sales CRM terms +0.45; pipeline deal stages +0.20; rep speaking patterns +0.05. Threshold: 0.82\n\n#### M-18: Brand & Corporate Positioning (Strategic & Commercial)\n- **Semantic Keywords:** narrative, brand archetype, tone of voice, visual identity, category creation, PR angle, analyst relations, perception\n- **Behavioural Indicators:** Creative agency, brand leaders, executive communications staff present, narrative pitch decks.\n- **Expected Conversational Behaviour:** Subjective messaging debate, positioning alignment, resonance testing with target buyers.\n- **Mandatory Deliverables:** OUT-04 (Discussion Synthesis), OUT-07 (Stakeholder Communication), OUT-02 (Decision Register)\n- **Mandatory Visualisations:** VIS-01 (SWOT Analysis), VIS-03 (Strategic Roadmap)\n- **Bayesian Scoring Model:** Prior 0.15; branding keywords +0.50; qualitative discourse +0.25; communication leads +0.10. Threshold: 0.76\n\n#### M-19: Product Discovery Workshop (Product & Engineering)\n- **Semantic Keywords:** user pain point, jobs to be done, customer interview, prototype, hypothesis, wireframe, usability, friction\n- **Behavioural Indicators:** Product designers and managers present, qualitative user feedback analysis, problem framing.\n- **Expected Conversational Behaviour:** Empathy-driven inquiry, divergent thinking, user journey mapping, hypothesis validation.\n- **Mandatory Deliverables:** OUT-16 (Product Feature Specification), OUT-06 (Opportunity Assessment), OUT-04 (Discussion Synthesis)\n- **Mandatory Visualisations:** VIS-01 (SWOT Analysis), VIS-07 (Decision Logic Tree)\n- **Bayesian Scoring Model:** Prior 0.20; UX keywords +0.45; customer feedback citations +0.25; designer presence +0.10. Threshold: 0.78\n\n#### M-20: Product Roadmap Planning (Product & Engineering)\n- **Semantic Keywords:** quarterly themes, epic, engineering capacity, feature prioritisation, RICE score, tech debt vs features, backlog\n- **Behavioural Indicators:** Product and engineering leadership, trade-off discussions between velocity and technical stability.\n- **Expected Conversational Behaviour:** Prioritisation debates, feasibility reality-checks, sequencing of customer deliverables.\n- **Mandatory Deliverables:** OUT-14 (Strategic Roadmap), OUT-16 (Product Feature Specification), OUT-02 (Decision Register)\n- **Mandatory Visualisations:** VIS-03 (Strategic Roadmap), VIS-06 (Action Priority Matrix), VIS-04 (Delivery Gantt Chart)\n- **Bayesian Scoring Model:** Prior 0.25; roadmap terms +0.45; priority scoring keywords +0.20; engineering capacity mentions +0.10. Threshold: 0.82\n\n#### M-21: Architecture Governance Board (Product & Engineering)\n- **Semantic Keywords:** microservices, latency, throughput, schema migration, RLS, idempotent, event-driven, Kafka, Supabase, SLA, RFC\n- **Behavioural Indicators:** Principal architects, engineering directors, deep technical documentation walkthroughs.\n- **Expected Conversational Behaviour:** System design critique, non-functional requirement validation, architectural pattern enforcement.\n- **Mandatory Deliverables:** OUT-17 (Technical Architecture Specification), OUT-02 (Decision Register), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-13 (Architecture Dependency Diagram), VIS-07 (Decision Logic Tree)\n- **Bayesian Scoring Model:** Prior 0.15; infrastructure terms +0.55; architectural diagrams cited +0.20; architect presence +0.10. Threshold: 0.84\n\n#### M-22: Sprint Planning & Backlog (Product & Engineering)\n- **Semantic Keywords:** story points, sprint backlog, acceptance criteria, velocity, definition of done, tickets, blockers, sprint goal\n- **Behavioural Indicators:** Scrum master, engineers, product owner, rapid traversal of issue tracking tickets.\n- **Expected Conversational Behaviour:** Task breakdown, complexity estimation, commitment to sprint capacity, blocker identification.\n- **Mandatory Deliverables:** OUT-03 (Action Plan), OUT-16 (Product Feature Specification)\n- **Mandatory Visualisations:** VIS-06 (Action Priority Matrix), VIS-04 (Delivery Gantt Chart)\n- **Bayesian Scoring Model:** Prior 0.35; agile terminology +0.45; ticket numbers cited +0.15; high turn count +0.05. Threshold: 0.85\n\n#### M-23: Technical Post-Mortem & Incident Review (Product & Engineering)\n- **Semantic Keywords:** root cause, five whys, MTTD, MTTR, outage, blast radius, rollback, telemetry, blameless, prevention action\n- **Behavioural Indicators:** Occurs following a production outage, engineering and support leadership, timeline reconstruction.\n- **Expected Conversational Behaviour:** Objective analytical inquiry, root-cause deduction, preventive action item generation.\n- **Mandatory Deliverables:** OUT-21 (Incident Post-Mortem), OUT-03 (Action Plan), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-02 (Timeline Map), VIS-05 (Risk Heatmap), VIS-07 (Decision Logic Tree)\n- **Bayesian Scoring Model:** Prior 0.10; incident post-mortem terms +0.60; timeline breakdown +0.20; blameless posture +0.10. Threshold: 0.88\n\n#### M-24: Security & Penetration Audit Review (Product & Engineering)\n- **Semantic Keywords:** CVE, zero-day, OWASP, SQL injection, RCE, privilege escalation, SOC2, cipher suite, patch window, bug bounty\n- **Behavioural Indicators:** Information security officers, third-party penetration testers, remediation tracking.\n- **Expected Conversational Behaviour:** Severity triage, exploitability assessment, remediation deadline enforcement.\n- **Mandatory Deliverables:** OUT-20 (Enterprise Risk Audit), OUT-05 (Risk and Issue Log), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-05 (Risk Heatmap), VIS-06 (Action Priority Matrix)\n- **Bayesian Scoring Model:** Prior 0.10; infosec keywords +0.60; vulnerability scores +0.20; security staff presence +0.10. Threshold: 0.86\n\n#### M-25: AI & Machine Learning Strategy (Product & Engineering)\n- **Semantic Keywords:** token budget, inference latency, RAG, embeddings, vector database, prompt grounding, fine-tuning, hallucination\n- **Behavioural Indicators:** AI engineers, data scientists, discussions of model capabilities, evaluation benchmarks.\n- **Expected Conversational Behaviour:** Evaluation of model trade-offs, accuracy vs latency benchmarks, safety guardrail design.\n- **Mandatory Deliverables:** OUT-17 (Technical Architecture Specification), OUT-06 (Opportunity Assessment), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-13 (Architecture Dependency Diagram), VIS-03 (Strategic Roadmap)\n- **Bayesian Scoring Model:** Prior 0.15; AI keywords +0.55; evaluation metrics +0.20; data scientist leads +0.10. Threshold: 0.83\n\n#### M-26: Design Sprint & UX Critique (Product & Engineering)\n- **Semantic Keywords:** visual hierarchy, affordance, Figma, design system, component library, accessibility, WCAG, user testing\n- **Behavioural Indicators:** Designers, front-end engineers, screen-sharing of design mockups and design token libraries.\n- **Expected Conversational Behaviour:** Detailed visual feedback, ergonomics evaluation, design consistency checking.\n- **Mandatory Deliverables:** OUT-16 (Product Feature Specification), OUT-04 (Discussion Synthesis)\n- **Mandatory Visualisations:** VIS-07 (Decision Logic Tree), VIS-02 (Timeline Map)\n- **Bayesian Scoring Model:** Prior 0.20; UX design terms +0.50; screen-share references +0.20; designer speaking turns +0.10. Threshold: 0.77\n\n#### M-27: Platform Scaling & Infrastructure Review (Product & Engineering)\n- **Semantic Keywords:** auto-scaling, read replica, cloud spend, egress costs, database connection pooling, CPU utilisation, p99 latency\n- **Behavioural Indicators:** DevOps, SRE, and cloud architects, AWS/Cloudflare dashboard reviews, cost optimisation.\n- **Expected Conversational Behaviour:** Capacity planning, bottleneck analysis, infrastructure right-sizing decisions.\n- **Mandatory Deliverables:** OUT-17 (Technical Architecture Specification), OUT-02 (Decision Register), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-13 (Architecture Dependency Diagram), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.15; infrastructure keywords +0.50; cloud metrics +0.25; DevOps presence +0.10. Threshold: 0.81\n\n#### M-28: Programme Governance & SteerCo (Operational & Delivery)\n- **Semantic Keywords:** milestone delivery, critical path, budget variance, schedule slip, cross-project dependencies, steering committee\n- **Behavioural Indicators:** Programme directors, project managers, executive sponsors, structured traffic-light status decks.\n- **Expected Conversational Behaviour:** Scope management, change request approvals, schedule integrity enforcement.\n- **Mandatory Deliverables:** OUT-19 (Programme Delivery Status), OUT-01 (Executive Briefing), OUT-02 (Decision Register), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-04 (Delivery Gantt Chart), VIS-08 (Executive RAG Dashboard), VIS-05 (Risk Heatmap)\n- **Bayesian Scoring Model:** Prior 0.25; project management terms +0.45; milestone citations +0.20; PM presence +0.10. Threshold: 0.84\n\n#### M-29: Operational Performance Review (Operational & Delivery)\n- **Semantic Keywords:** throughput, operational bottleneck, SLA compliance, backlog volume, error rates, capacity constraints, shift handover\n- **Behavioural Indicators:** Operations managers, team leads, review of daily and weekly operational metrics.\n- **Expected Conversational Behaviour:** Root cause probing on operational variances, workload re-balancing, process refinement.\n- **Mandatory Deliverables:** OUT-18 (Operational Performance Review), OUT-03 (Action Plan), OUT-10 (Meeting Performance Report)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-06 (Action Priority Matrix)\n- **Bayesian Scoring Model:** Prior 0.25; operations terms +0.45; metric variance analysis +0.20; team lead presence +0.10. Threshold: 0.80\n\n#### M-30: Project Kick-Off Meeting (Operational & Delivery)\n- **Semantic Keywords:** project charter, RACI, scope in/out, deliverables, governance cadence, success criteria, kickoff, team roles\n- **Behavioural Indicators:** New project initiative, cross-functional team assembly, introductory project alignment.\n- **Expected Conversational Behaviour:** Role clarification, objective setting, baseline expectation establishment, team question handling.\n- **Mandatory Deliverables:** OUT-19 (Programme Delivery Status), OUT-03 (Action Plan), OUT-07 (Stakeholder Communication)\n- **Mandatory Visualisations:** VIS-04 (Delivery Gantt Chart), VIS-11 (Organisation Map), VIS-02 (Timeline Map)\n- **Bayesian Scoring Model:** Prior 0.20; kickoff terms +0.50; RACI references +0.20; charter walkthrough +0.10. Threshold: 0.82\n\n#### M-31: Weekly Project Status Sync (Operational & Delivery)\n- **Semantic Keywords:** what was done, what is next, blockers, deadline check, task status, ticket update, quick sync\n- **Behavioural Indicators:** Frequent recurring cadence, compact duration (15 to 30 mins), task-focused updates.\n- **Expected Conversational Behaviour:** Rapid round-robin updates, quick identification of blockers, fast task reassignments.\n- **Mandatory Deliverables:** OUT-03 (Action Plan), OUT-19 (Programme Delivery Status)\n- **Mandatory Visualisations:** VIS-06 (Action Priority Matrix), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.35; status terms +0.40; recurring weekly markers +0.20; rapid turns +0.05. Threshold: 0.80\n\n#### M-32: Continuous Improvement & Kaizen (Operational & Delivery)\n- **Semantic Keywords:** waste elimination, cycle time, process map, root cause, standard operating procedure, lean, automation opportunity\n- **Behavioural Indicators:** Operations practitioners, workflow process diagrams, focus on operational friction.\n- **Expected Conversational Behaviour:** Process dissection, identifying non-value-added steps, collaborative problem-solving.\n- **Mandatory Deliverables:** OUT-18 (Operational Performance Review), OUT-06 (Opportunity Assessment), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-07 (Decision Logic Tree), VIS-12 (Capability Maturity Matrix)\n- **Bayesian Scoring Model:** Prior 0.15; lean keywords +0.50; workflow mapping cited +0.25; efficiency focus +0.10. Threshold: 0.77\n\n#### M-33: Budget & Cost Control Review (Operational & Delivery)\n- **Semantic Keywords:** OPEX, CAPEX, cost overrun, unbudgeted expense, purchase order, vendor spend, run-rate, savings target\n- **Behavioural Indicators:** Finance business partners and department budget holders, ledger variance analysis.\n- **Expected Conversational Behaviour:** Rigorous justification of expenses, spending freezes, cost reduction planning.\n- **Mandatory Deliverables:** OUT-18 (Operational Performance Review), OUT-02 (Decision Register), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-09 (Revenue Forecast)\n- **Bayesian Scoring Model:** Prior 0.20; financial cost terms +0.50; ledger citations +0.20; finance presence +0.10. Threshold: 0.83\n\n#### M-34: Resource & Workforce Capacity Planning (Operational & Delivery)\n- **Semantic Keywords:** utilisation rate, bench, billable hours, hiring requisition, contractor spend, capacity constraint, burnout risk\n- **Behavioural Indicators:** Resource managers, practice leads, resource allocation spreadsheets.\n- **Expected Conversational Behaviour:** Workload balancing, scheduling conflict resolution, contractor vs permanent hiring trade-offs.\n- **Mandatory Deliverables:** OUT-19 (Programme Delivery Status), OUT-03 (Action Plan), OUT-02 (Decision Register)\n- **Mandatory Visualisations:** VIS-04 (Delivery Gantt Chart), VIS-11 (Organisation Map)\n- **Bayesian Scoring Model:** Prior 0.20; resource management terms +0.45; utilisation figures +0.25; capacity focus +0.10. Threshold: 0.79\n\n#### M-35: Vendor & Supplier Performance Review (Operational & Delivery)\n- **Semantic Keywords:** contractor SLA, deliverables quality, invoice dispute, vendor score, renewal terms, penalty clause, master agreement\n- **Behavioural Indicators:** Procurement leads, vendor relationship managers, external vendor representatives.\n- **Expected Conversational Behaviour:** Performance score evaluation, contract compliance review, service credit demands.\n- **Mandatory Deliverables:** OUT-18 (Operational Performance Review), OUT-05 (Risk and Issue Log), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-10 (Risk-Reward Matrix)\n- **Bayesian Scoring Model:** Prior 0.15; procurement terms +0.50; vendor metrics +0.25; external vendor email +0.10. Threshold: 0.82\n\n#### M-36: Supply Chain & Logistics Operational Review (Operational & Delivery)\n- **Semantic Keywords:** lead times, inventory levels, freight costs, warehouse throughput, stockouts, customs clearance, safety stock\n- **Behavioural Indicators:** Supply chain directors, logistics coordinators, inventory tracking dashboards.\n- **Expected Conversational Behaviour:** Delivery bottleneck troubleshooting, buffer stock adjustments, freight carrier evaluation.\n- **Mandatory Deliverables:** OUT-18 (Operational Performance Review), OUT-05 (Risk and Issue Log), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-05 (Risk Heatmap)\n- **Bayesian Scoring Model:** Prior 0.15; supply chain terms +0.55; logistics data +0.20; warehouse focus +0.10. Threshold: 0.81\n\n#### M-37: Executive Talent & Search Briefing (People & Culture)\n- **Semantic Keywords:** candidate shortlist, compensation package, equity grant, executive presence, references, cultural fit, headhunter\n- **Behavioural Indicators:** Executive search committee, confidential personnel discussions, candidate resume reviews.\n- **Expected Conversational Behaviour:** Rigorous candidate comparison, leadership competency evaluation, package benchmarking.\n- **Mandatory Deliverables:** OUT-02 (Decision Register), OUT-04 (Discussion Synthesis), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-11 (Organisation Map), VIS-07 (Decision Logic Tree)\n- **Bayesian Scoring Model:** Prior 0.15; hiring terms +0.50; confidential markers +0.20; candidate names +0.15. Threshold: 0.83\n\n#### M-38: Performance Calibration Review (People & Culture)\n- **Semantic Keywords:** bell curve, rating distribution, promotion cycle, top tier, performance improvement plan, PIP, compensation review\n- **Behavioural Indicators:** HR business partners, department heads, confidential employee rating spreadsheets.\n- **Expected Conversational Behaviour:** Cross-manager rating standardisation, advocacy for promotions, performance standard alignment.\n- **Mandatory Deliverables:** OUT-02 (Decision Register), OUT-04 (Discussion Synthesis)\n- **Mandatory Visualisations:** VIS-11 (Organisation Map), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.10; HR terms +0.55; rating distribution references +0.25; HRBP presence +0.10. Threshold: 0.85\n\n#### M-39: Succession & Talent Planning (People & Culture)\n- **Semantic Keywords:** nine box grid, flight risk, key person risk, leadership bench, development plan, interim successor, retention bonus\n- **Behavioural Indicators:** Executive committee and Chief People Officer, long-term organisational stability focus.\n- **Expected Conversational Behaviour:** Vulnerability assessment on key departures, executive development pathway design.\n- **Mandatory Deliverables:** OUT-02 (Decision Register), OUT-05 (Risk and Issue Log), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-11 (Organisation Map), VIS-12 (Capability Maturity Matrix)\n- **Bayesian Scoring Model:** Prior 0.15; succession terms +0.50; retention discussions +0.25; CPO presence +0.10. Threshold: 0.81\n\n#### M-40: Company Town Hall & All-Hands (People & Culture)\n- **Semantic Keywords:** quarterly highlights, company vision, welcome new joiners, slido questions, culture award, state of the nation\n- **Behavioural Indicators:** Company-wide attendance list, presentation decks, live Q&A session.\n- **Expected Conversational Behaviour:** Broadcasting strategic progress, celebrating achievements, addressing general employee queries.\n- **Mandatory Deliverables:** OUT-07 (Stakeholder Communication), OUT-04 (Discussion Synthesis), OUT-01 (Executive Briefing)\n- **Mandatory Visualisations:** VIS-03 (Strategic Roadmap), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.20; town hall keywords +0.50; large attendee count +0.20; presentation format +0.10. Threshold: 0.80\n\n#### M-41: Team Retrospective (People & Culture)\n- **Semantic Keywords:** what went well, what could be improved, action items, retro board, stop starting doing, team sentiment, psychological safety\n- **Behavioural Indicators:** Intact project or agile team, end-of-cycle timing, structured facilitation board.\n- **Expected Conversational Behaviour:** Reflective dialogue, open vulnerability, team process refinement, small-scale commitments.\n- **Mandatory Deliverables:** OUT-04 (Discussion Synthesis), OUT-03 (Action Plan), OUT-10 (Meeting Performance Report)\n- **Mandatory Visualisations:** VIS-06 (Action Priority Matrix), VIS-01 (SWOT Analysis)\n- **Bayesian Scoring Model:** Prior 0.25; retro terms +0.45; reflective keywords +0.20; agile team presence +0.10. Threshold: 0.79\n\n#### M-42: Culture, Engagement & DE&I Council (People & Culture)\n- **Semantic Keywords:** engagement survey, eNPS, inclusion, pay equity, flexible working, employee resource group, burnout metrics\n- **Behavioural Indicators:** People leaders, employee committee leads, engagement survey data analysis.\n- **Expected Conversational Behaviour:** Empathetic review of employee sentiment, cultural initiative formulation.\n- **Mandatory Deliverables:** OUT-04 (Discussion Synthesis), OUT-03 (Action Plan), OUT-07 (Stakeholder Communication)\n- **Mandatory Visualisations:** VIS-11 (Organisation Map), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.15; engagement keywords +0.50; survey metrics +0.25; committee presence +0.10. Threshold: 0.78\n\n#### M-43: Remuneration & Incentive Committee (People & Culture)\n- **Semantic Keywords:** executive compensation, short-term incentive, long-term incentive, vesting, stock options, remuneration benchmarking\n- **Behavioural Indicators:** RemCo board members, external compensation consultants, confidential compensation sheets.\n- **Expected Conversational Behaviour:** Market benchmarking review, incentive plan governance, executive compensation approval.\n- **Mandatory Deliverables:** OUT-02 (Decision Register), OUT-04 (Discussion Synthesis), OUT-05 (Risk and Issue Log)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-07 (Decision Logic Tree)\n- **Bayesian Scoring Model:** Prior 0.10; executive comp terms +0.60; board committee attendees +0.20; confidential flags +0.10. Threshold: 0.86\n\n#### M-44: Enterprise Sales Discovery Call (Customer & External)\n- **Semantic Keywords:** current stack, workflow pain, budget authority, timeline, evaluation criteria, decision process, current vendor\n- **Behavioural Indicators:** External prospective client attendees, sales representative leading diagnostic questioning.\n- **Expected Conversational Behaviour:** Inquisitive questioning, active listening, pain discovery, qualification validation.\n- **Mandatory Deliverables:** OUT-13 (Commercial Investment Case), OUT-06 (Opportunity Assessment), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-01 (SWOT Analysis), VIS-06 (Action Priority Matrix)\n- **Bayesian Scoring Model:** Prior 0.30; discovery keywords +0.40; external prospect attendees +0.20; qualification cues +0.10. Threshold: 0.80\n\n#### M-45: Enterprise Client Solutions Pitch (Customer & External)\n- **Semantic Keywords:** proposed solution, implementation timeline, enterprise pricing, ROI calculation, case study, proof of concept, SLA\n- **Behavioural Indicators:** External executive buyers, solutions engineering presence, formal presentation deck.\n- **Expected Conversational Behaviour:** Value proposition presentation, technical objection handling, pricing defensiveness.\n- **Mandatory Deliverables:** OUT-13 (Commercial Investment Case), OUT-07 (Stakeholder Communication), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-03 (Strategic Roadmap), VIS-09 (Revenue Forecast), VIS-02 (Timeline Map)\n- **Bayesian Scoring Model:** Prior 0.25; pitch terms +0.45; external buyer attendees +0.20; solution demo refs +0.10. Threshold: 0.81\n\n#### M-46: Client Implementation Kick-Off (Customer & External)\n- **Semantic Keywords:** project charter, data migration, user provisioning, integration architecture, go-live date, joint steering committee\n- **Behavioural Indicators:** External client implementation team, professional services consultants, project milestone schedules.\n- **Expected Conversational Behaviour:** Expectation setting, technical prerequisites walkthrough, delivery governance establishment.\n- **Mandatory Deliverables:** OUT-19 (Programme Delivery Status), OUT-03 (Action Plan), OUT-07 (Stakeholder Communication)\n- **Mandatory Visualisations:** VIS-04 (Delivery Gantt Chart), VIS-02 (Timeline Map), VIS-11 (Organisation Map)\n- **Bayesian Scoring Model:** Prior 0.20; implementation terms +0.45; client and delivery teams +0.25; timeline focus +0.10. Threshold: 0.82\n\n#### M-47: Client Success Executive Business Review (Customer & External)\n- **Semantic Keywords:** value realized, adoption metrics, feature requests, renewal timeline, license utilization, customer roadmap, NPS\n- **Behavioural Indicators:** External client executive sponsor, internal customer success manager, account review deck.\n- **Expected Conversational Behaviour:** Value verification, partnership health check, roadmap preview, relationship expansion exploration.\n- **Mandatory Deliverables:** OUT-01 (Executive Briefing), OUT-06 (Opportunity Assessment), OUT-03 (Action Plan)\n- **Mandatory Visualisations:** VIS-08 (Executive RAG Dashboard), VIS-03 (Strategic Roadmap)\n- **Bayesian Scoring Model:** Prior 0.20; client success terms +0.45; client sponsor present +0.25; adoption data +0.10. Threshold: 0.80\n\n#### M-48: Client Escalation & Remediation (Customer & External)\n- **Semantic Keywords:** breach of contract, executive sponsor escalation, SLA failure, corrective action plan, cure period, critical bug\n- **Behavioural Indicators:** External agitated client executives, internal leadership response, formal remediation posture.\n- **Expected Conversational Behaviour:** Apologetic accountability, precise corrective commitments, rigorous timeline setting.\n- **Mandatory Deliverables:** OUT-01 (Executive Briefing), OUT-03 (Action Plan), OUT-05 (Risk and Issue Log), OUT-07 (Stakeholder Communication)\n- **Mandatory Visualisations:** VIS-02 (Timeline Map), VIS-05 (Risk Heatmap)\n- **Bayesian Scoring Model:** Prior 0.10; escalation terms +0.55; agitated client sentiment +0.25; executive attendance +0.10. Threshold: 0.85\n\n#### M-49: Professional Services Advisory Workshop (Customer & External)\n- **Semantic Keywords:** current state assessment, target operating model, gap analysis, recommendations, change management, deliverables\n- **Behavioural Indicators:** External fee-paying client, internal management consultants, structured consultative exercises.\n- **Expected Conversational Behaviour:** Facilitated client discovery, challenge of client assumptions, consensus building around target solutions.\n- **Mandatory Deliverables:** OUT-11 (Strategic Business Plan), OUT-18 (Operational Performance Review), OUT-04 (Discussion Synthesis)\n- **Mandatory Visualisations:** VIS-12 (Capability Maturity Matrix), VIS-01 (SWOT Analysis), VIS-03 (Strategic Roadmap)\n- **Bayesian Scoring Model:** Prior 0.15; consulting terms +0.50; client attendees +0.25; workshop exercises +0.10. Threshold: 0.79\n\n#### M-50: Public Stakeholder & Community Consultation (Customer & External)\n- **Semantic Keywords:** public feedback, environmental impact, community concern, regulatory filing, town council, submission period, transparency\n- **Behavioural Indicators:** External public stakeholders, community representatives, corporate regulatory officers.\n- **Expected Conversational Behaviour:** Public listening, addressing local grievances, regulatory disclosure, recording public record.\n- **Mandatory Deliverables:** OUT-04 (Discussion Synthesis), OUT-07 (Stakeholder Communication), OUT-09 (Verbatim Evidence Index)\n- **Mandatory Visualisations:** VIS-02 (Timeline Map), VIS-08 (Executive RAG Dashboard)\n- **Bayesian Scoring Model:** Prior 0.10; public consultation terms +0.55; diverse public attendees +0.25; formal recording +0.10. Threshold: 0.80\n\n### 4.3 Multi-Label Classification and Modulation Indices

A meeting is rarely uni-dimensional. For instance, a Board Meeting (`M-02`) may contain a critical M&A Steering segment (`M-09`). The classification engine computes:
1. **Primary Meeting Type:** Highest confidence classification (e.g., `M-02`, 92% confidence).
2. **Secondary Meeting Types:** Ancillary classifications exceeding a 65% confidence threshold (e.g., `M-09`, 71% confidence).
3. **Strategic Importance Index (1 to 10):** Calculated from attendee seniority, multi-year forward horizons, capital allocation figures, and organisational scope.
4. **Inherent Risk Level (1 to 10):** Calculated from legal liability keywords, regulatory exposure, capital risk, and executive escalations.

These indices dynamically scale the depth, formality, and validation thresholds of the downstream output engines.


---

# SECTION 5: BUSINESS INTENT DETECTION ENGINE\n\n### 5.1 The Intent Classification Framework\nWhile Meeting Classification determines *what* type of meeting occurred, Business Intent Detection uncovers *why* the meeting was convened. Business intent represents the underlying commercial objective driving executive leadership. Concludo identifies twelve core strategic business intents:\n\n| Intent ID | Business Intent Archetype | Primary Detection Methodology | Typical Deliverables | Executive Deliverable Pack |\n| :--- | :--- | :--- | :--- | :--- |\n| **INT-01** | Acquire Business (M&A and Asset Acquisition) | Scans for target company evaluation, valuatio... | `OUT-13 (Commercial Investment ...` | Executive Valuation Summary, Synerg... |\n| **INT-02** | Launch Product (GTM and Commercialisation) | Identifies product readiness criteria, go-to-... | `OUT-15 (Product Launch Plan), ...` | Commercial Launch Scorecard, GTM Cr... |\n| **INT-03** | Expand Market (Geographic and Segment Growth) | Detects cross-border expansion, regulatory co... | `OUT-11 (Strategic Business Pla...` | Market Entry Feasibility Brief, Cap... |\n| **INT-04** | Reduce Cost (Operational Rationalisation and Efficiency) | Identifies vendor renegotiations, workforce r... | `OUT-18 (Operational Performanc...` | Cost Rationalisation Ledger, Net Ru... |\n| **INT-05** | Improve Process (Operational Streamlining and Automation) | Maps references to workflow friction, manual ... | `OUT-18 (Operational Performanc...` | Target Operating Model Transformati... |\n| **INT-06** | Manage Risk (Crisis Response and Regulatory Compliance) | Triggers on acute operational vulnerabilities... | `OUT-05 (Risk and Issue Log), O...` | Critical Risk Exposure Briefing, Le... |\n| **INT-07** | Create Strategy (Multi-Year Corporate Direction) | Evaluates foundational corporate positioning,... | `OUT-11 (Strategic Business Pla...` | Executive Strategy Brief, 3-Year St... |\n| **INT-08** | Hire Team (Executive Search and Organisational Scaling) | Analyses leadership talent gaps, organisation... | `OUT-02 (Decision Register), OU...` | Executive Talent Acquisition Scorec... |\n| **INT-09** | Perform Governance (Fiduciary Oversight and Compliance) | Monitors statutory compliance checks, corpora... | `OUT-12 (Board Decision Pack), ...` | Fiduciary Governance Audit, Formal ... |\n| **INT-10** | Solve Customer Issue (Account Escalation and Retention) | Identifies urgent client grievances, contract... | `OUT-01 (Executive Briefing), O...` | Client Retention Action Plan, SLA B... |\n| **INT-11** | Transform Digital Systems (Architecture and Cloud Modernisation) | Tracks technical debt remediation, legacy sys... | `OUT-17 (Technical Architecture...` | Digital Transformation Roadmap, Tec... |\n| **INT-12** | Capital Allocation (Budget Setting and Investment Prioritisation) | Identifies financial investment decisions acr... | `OUT-13 (Commercial Investment ...` | Capital Allocation Framework, Portf... |\n\n### 5.2 Deep Intent Specifications\n\n#### INT-01: Acquire Business (M&A and Asset Acquisition)\n- **Detection Methodology:** Scans for target company evaluation, valuation multiple discussions (EBITDA, ARR), synergy modelling, and purchase structures.\n- **Conversational Signals & Triggers:** Target entity names, enterprise valuation metrics, due diligence checklists, post-merger integration timelines.\n- **Typical Baseline Outputs:** OUT-13 (Commercial Investment Case), OUT-02 (Decision Register), OUT-05 (Risk and Issue Log)\n- **Recommended Supplementary Outputs:** OUT-11 (Strategic Business Plan), OUT-06 (Opportunity Assessment)\n- **Executive Deliverable Pack:** Executive Valuation Summary, Synergy Realisation Model, Deal Risk Heatmap\n\n#### INT-02: Launch Product (GTM and Commercialisation)\n- **Detection Methodology:** Identifies product readiness criteria, go-to-market channels, customer acquisition campaigns, and commercial release dates.\n- **Conversational Signals & Triggers:** Launch dates, feature freeze milestones, marketing collateral readiness, sales enablement training, press release drafts.\n- **Typical Baseline Outputs:** OUT-15 (Product Launch Plan), OUT-03 (Action Plan), OUT-14 (Strategic Roadmap)\n- **Recommended Supplementary Outputs:** OUT-07 (Stakeholder Communication), OUT-16 (Product Feature Specification)\n- **Executive Deliverable Pack:** Commercial Launch Scorecard, GTM Critical Path, Executive Revenue Projections\n\n#### INT-03: Expand Market (Geographic and Segment Growth)\n- **Detection Methodology:** Detects cross-border expansion, regulatory compliance in new jurisdictions, translation/localisation efforts, and local partner identification.\n- **Conversational Signals & Triggers:** New jurisdiction names, currency considerations, local tax/legal structures, addressable market estimations.\n- **Typical Baseline Outputs:** OUT-11 (Strategic Business Plan), OUT-06 (Opportunity Assessment), OUT-05 (Risk and Issue Log)\n- **Recommended Supplementary Outputs:** OUT-14 (Strategic Roadmap), OUT-18 (Operational Performance Review)\n- **Executive Deliverable Pack:** Market Entry Feasibility Brief, Capital Exposure Model, Jurisdictional Risk Register\n\n#### INT-04: Reduce Cost (Operational Rationalisation and Efficiency)\n- **Detection Methodology:** Identifies vendor renegotiations, workforce restructuring, software license consolidation, and operating expense reductions.\n- **Conversational Signals & Triggers:** OPEX reduction targets, vendor redundancy, headcount rationalisation, efficiency percentage goals, contract terminations.\n- **Typical Baseline Outputs:** OUT-18 (Operational Performance Review), OUT-02 (Decision Register), OUT-03 (Action Plan)\n- **Recommended Supplementary Outputs:** OUT-01 (Executive Briefing), OUT-05 (Risk and Issue Log)\n- **Executive Deliverable Pack:** Cost Rationalisation Ledger, Net Run-Rate Savings Forecast, Severance & Transition Risk Matrix\n\n#### INT-05: Improve Process (Operational Streamlining and Automation)\n- **Detection Methodology:** Maps references to workflow friction, manual handoffs, process bottlenecks, SLA breaches, and digital tooling upgrades.\n- **Conversational Signals & Triggers:** Cycle time metrics, rework rates, manual data entry complaints, automation candidates, lean standardisation phrases.\n- **Typical Baseline Outputs:** OUT-18 (Operational Performance Review), OUT-17 (Technical Architecture Specification), OUT-03 (Action Plan)\n- **Recommended Supplementary Outputs:** OUT-06 (Opportunity Assessment), OUT-10 (Meeting Performance Report)\n- **Executive Deliverable Pack:** Target Operating Model Transformation Map, Automation ROI Projection, Bottleneck Resolution Plan\n\n#### INT-06: Manage Risk (Crisis Response and Regulatory Compliance)\n- **Detection Methodology:** Triggers on acute operational vulnerabilities, statutory regulatory notices, security audit findings, or litigation threats.\n- **Conversational Signals & Triggers:** Audit citations, breach notifications, legal damages, remediation deadlines, containment actions, public relations fallout.\n- **Typical Baseline Outputs:** OUT-05 (Risk and Issue Log), OUT-20 (Enterprise Risk Audit), OUT-03 (Action Plan)\n- **Recommended Supplementary Outputs:** OUT-01 (Executive Briefing), OUT-07 (Stakeholder Communication)\n- **Executive Deliverable Pack:** Critical Risk Exposure Briefing, Legal & Regulatory Containment Protocol, Board Liability Assessment\n\n#### INT-07: Create Strategy (Multi-Year Corporate Direction)\n- **Detection Methodology:** Evaluates foundational corporate positioning, long-term competitive moats, resource allocation philosophies, and core mission execution.\n- **Conversational Signals & Triggers:** 3-5 year horizons, competitive strategy models, industry macro trends, customer value proposition redesigns.\n- **Typical Baseline Outputs:** OUT-11 (Strategic Business Plan), OUT-14 (Strategic Roadmap), OUT-01 (Executive Briefing)\n- **Recommended Supplementary Outputs:** OUT-02 (Decision Register), OUT-06 (Opportunity Assessment)\n- **Executive Deliverable Pack:** Executive Strategy Brief, 3-Year Strategic Horizon Roadmap, Strategic Trade-off Matrix\n\n#### INT-08: Hire Team (Executive Search and Organisational Scaling)\n- **Detection Methodology:** Analyses leadership talent gaps, organisational capability deficits, executive recruitment scorecards, and compensation structures.\n- **Conversational Signals & Triggers:** Job titles, candidate names, search firm updates, executive compensation numbers, reporting line adjustments.\n- **Typical Baseline Outputs:** OUT-02 (Decision Register), OUT-04 (Discussion Synthesis), OUT-03 (Action Plan)\n- **Recommended Supplementary Outputs:** OUT-05 (Risk and Issue Log), OUT-07 (Stakeholder Communication)\n- **Executive Deliverable Pack:** Executive Talent Acquisition Scorecard, Organisational Structure Impact Chart, Equity Dilution Model\n\n#### INT-09: Perform Governance (Fiduciary Oversight and Compliance)\n- **Detection Methodology:** Monitors statutory compliance checks, corporate charter reviews, formal board voting procedures, and audited balance sheets.\n- **Conversational Signals & Triggers:** Voting motions, conflicts of interest disclosures, regulatory filings, committee charter amendments, director resolutions.\n- **Typical Baseline Outputs:** OUT-12 (Board Decision Pack), OUT-02 (Decision Register), OUT-09 (Verbatim Evidence Index)\n- **Recommended Supplementary Outputs:** OUT-01 (Executive Briefing), OUT-05 (Risk and Issue Log)\n- **Executive Deliverable Pack:** Fiduciary Governance Audit, Formal Resolution Extract, Statutory Sign-off Matrix\n\n#### INT-10: Solve Customer Issue (Account Escalation and Retention)\n- **Detection Methodology:** Identifies urgent client grievances, contract breach threats, product performance failures, and executive intervention requirements.\n- **Conversational Signals & Triggers:** Customer executive complaints, SLA credit discussions, emergency bug fixes, renewal cancellation threats, apology letters.\n- **Typical Baseline Outputs:** OUT-01 (Executive Briefing), OUT-03 (Action Plan), OUT-05 (Risk and Issue Log)\n- **Recommended Supplementary Outputs:** OUT-07 (Stakeholder Communication), OUT-18 (Operational Performance Review)\n- **Executive Deliverable Pack:** Client Retention Action Plan, SLA Breach Remediation Ledger, Commercial Exposure Brief\n\n#### INT-11: Transform Digital Systems (Architecture and Cloud Modernisation)\n- **Detection Methodology:** Tracks technical debt remediation, legacy system decommissioning, modern cloud infrastructure migrations, and enterprise integrations.\n- **Conversational Signals & Triggers:** Legacy ERP names, cloud migration deadlines, API contract standardisation, data synchronization challenges, vendor sunsetting.\n- **Typical Baseline Outputs:** OUT-17 (Technical Architecture Specification), OUT-14 (Strategic Roadmap), OUT-05 (Risk and Issue Log)\n- **Recommended Supplementary Outputs:** OUT-03 (Action Plan), OUT-13 (Commercial Investment Case)\n- **Executive Deliverable Pack:** Digital Transformation Roadmap, Technical Debt Paydown Analysis, Cloud Infrastructure ROI\n\n#### INT-12: Capital Allocation (Budget Setting and Investment Prioritisation)\n- **Detection Methodology:** Identifies financial investment decisions across competing initiatives, business unit funding approvals, and ROI thresholding.\n- **Conversational Signals & Triggers:** CAPEX proposals, hurdle rates, internal rate of return (IRR), payback periods, competing project business cases.\n- **Typical Baseline Outputs:** OUT-13 (Commercial Investment Case), OUT-02 (Decision Register), OUT-11 (Strategic Business Plan)\n- **Recommended Supplementary Outputs:** OUT-08 (Strategic Alignment Scorecard), OUT-14 (Strategic Roadmap)\n- **Executive Deliverable Pack:** Capital Allocation Framework, Portfolio Investment Scorecard, Hurdle Rate Sensitivity Analysis\n\n### 5.3 Intent-Driven Modulation of Output Packaging

The detected business intent directly dictates the tone, framing, and priority ordering of downstream document generation. When `INT-06 (Manage Risk)` is detected:
- Risk Registers and Action Plans are elevated to primary visual prominence.
- Executive Briefings adopt a concise, threat-mitigation tone.
- Timelines default to immediate hourly and daily milestones rather than quarterly horizons.

Conversely, when `INT-07 (Create Strategy)` is detected:
- SWOT analyses, multi-year roadmaps, and opportunity frameworks take precedence.
- Action items are framed around strategic feasibility checks and exploratory work packages.


---

# SECTION 6: ENTITY EXTRACTION ENGINE\n\n### 6.1 The 15 Core Business Entities\nThe Entity Extraction Engine is responsible for identifying, disambiguating, and structuring the fundamental semantic building blocks of the conversation. Rather than treating text as an undifferentiated stream, Concludo extracts fifteen strongly-typed business entities:\n\n| Entity Type | Enterprise Definition | Core Structured Attributes |\n| :--- | :--- | :--- |\n| **People** | Named individuals, internal employees, external contractors, board members, and executive leaders. | `Full name, role, email, organisation, sentiment, speaker affiliation.` |\n| **Companies** | Corporate entities, subsidiary companies, competitors, partner firms, and institutional investors. | `Legal company name, ABN/ACN, relationship type (client/vendor/partner/competitor), domain.` |\n| **Projects** | Internal work streams, engineering programmes, consulting engagements, and corporate initiatives. | `Project code, project name, charter summary, stage, executive sponsor.` |\n| **Clients** | Customer accounts, commercial buyers, enterprise prospects, and account stakeholders. | `Account name, contract value, account tier, industry vertical, key contact.` |\n| **Budgets** | Financial allocations, expenditure approvals, cost centres, OPEX/CAPEX figures, and revenue quotas. | `Currency, amount, fiscal period, allocation type, approving authority.` |\n| **Products** | Software modules, physical goods, service tiers, features, and commercial packages. | `Product name, SKU/tier, target market, development lifecycle stage.` |\n| **Risks** | Uncertainties, vulnerabilities, compliance hurdles, technical bottlenecks, and threat vectors. | `Risk title, category, severity, probability, mitigation owner, timestamp.` |\n| **Opportunities** | Potential upside, new revenue streams, efficiency gains, strategic partnerships, and market openings. | `Opportunity title, archetype, value potential, feasibility, required investment.` |\n| **Milestones** | Key progress gates, contractual delivery points, regulatory deadlines, and release dates. | `Milestone name, target completion date, critical path flag, owner.` |\n| **Deadlines** | Firm operational due dates, submission windows, statutory filing cut-offs, and SLA timers. | `Target timestamp, time zone, associated task, hard vs soft constraint.` |\n| **Actions** | Operational commitments requiring individual human execution and verifiable completion criteria. | `Five-Field parameters (task, owner, due date, definition of done, checkpoint date).` |\n| **Decisions** | Explicit resolutions, strategic policy choices, and consensus agreements. | `Decision title, rationale, alternatives discarded, sponsor, impact.` |\n| **Problems** | Existing defects, operational failures, systemic bottlenecks, customer escalations, and outages. | `Problem summary, root cause, business impact, affected users/systems.` |\n| **Recommendations** | Expert proposals, advisory suggestions, strategic interventions, and next-step actions. | `Recommendation text, rationale, expected benefit, effort, sponsoring agent.` |\n| **Goals** | High-level strategic objectives, OKRs, quarterly targets, and corporate KPIs. | `Objective statement, target metric, baseline, target date, executive owner.` |\n
### 6.2 Entity Extraction Standards and Disambiguation

To guarantee corporate data integrity, the Entity Extraction Engine adheres to rigorous disambiguation standards:

1. **Entity Resolution Against Knowledge Graph:** Every extracted entity is matched against existing records in PostgreSQL (`profiles`, `organisations`, `projects`, `knowledge_nodes`). If "Sarah" is mentioned in a Concludo strategic meeting, the engine resolves her entity to `usr_e44d-11ac` (Sarah Jenkins, Head of Product) using organisational membership context.
2. **Strict Verbatim Provenance:** Extracted entities are never invented or hallucinated. Each entity record stores the exact transcript span (character start, character end, and timestamp) where it was referenced:
   ```json
   {
     "entity_type": "Budget",
     "value": 450000,
     "currency": "AUD",
     "period": "FY27",
     "transcript_citation": {
       "utterance_id": "utt_412",
       "speaker": "Anthony Cortez",
       "timestamp": "00:24:18",
       "verbatim_text": "We are locking in a four hundred and fifty thousand dollar cap for the platform infrastructure."
     }
   }
   ```
3. **Fuzzy String and Alias Matching:** Handles executive nicknames, truncated software project names, and client brand abbreviations (e.g., "K-Skull" resolves to "King Skull Jewellery & Accessories Pty Ltd").
4. **Entity Relationship Linking:** Entities are extracted as interconnected nodes. A `Decision` entity is linked to its `People` sponsor, its `Budget` impact, and the affected `Project`.


---

# SECTION 7: DECISION EXTRACTION ENGINE

### 7.1 Decision Identification Architecture

Decisions represent the strategic turning points of an organisation. In legacy tools, decisions are buried in paragraphs of discussion. In Concludo, the Decision Extraction Engine isolates, evaluates, and codifies every explicit agreement, policy change, and strategic direction agreed upon by participants.

The engine utilizes a multi-layer detection pipeline:
1. **Linguistic Consensus Markers:** Identifies definitive verbal closures ("we have agreed", "the decision is made", "let us lock this in", "resolving to approve", "I sponsor this approach").
2. **Objection Resolution Detection:** Scans for dialogue sequences where dissent or debate transitions into consensus or executive mandate.
3. **Implicit Policy Shifts:** Detects tacit executive approvals where a leader issues an affirmative direction and no counter-objection is raised.
4. **Negative Decision Detection:** Explicitly tracks discarded proposals, deferred options, and rejected commercial paths.

### 7.2 Decision Data Schema

Every extracted decision is structured into an enterprise-grade record:

```typescript
export interface ExtractedDecision {
  decisionId: string;
  transcriptId: string;
  projectId: string;
  title: string;
  summary: string;
  decisionOwner: {
    userId: string;
    name: string;
    role: string;
  };
  rationale: string;
  rejectedAlternatives: Array<{
    alternativeText: string;
    rejectionReason: string;
  }>;
  impact: {
    financialAud: number | null;
    operationalScope: 'low' | 'medium' | 'high' | 'enterprise_wide';
    strategicPillarsAffected: string[];
  };
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidenceScore: number; // 0 to 100
  dependencies: string[];
  associatedRisks: string[];
  verbatimExcerpt: {
    timestamp: string;
    speaker: string;
    text: string;
  };
  supersedesDecisionId?: string;
}
```

### 7.3 Real-World Decision Extraction Example

#### Input Transcript Dialogue:
> **Anthony Cortez (00:32:15):** "We have looked at both AWS Sydney and Cloudflare Workers for edge deployment, but looking at our PostgreSQL requirements and Australian data residency, we cannot afford split latency. We are officially choosing Supabase Enterprise hosted in Sydney as our primary database tier. We are discarding the distributed DynamoDB option because the relational schema complexity is too high for our knowledge graph. Sarah, you will own the migration architecture. Budget cap is fifty thousand dollars."
> 
> **Sarah Jenkins (00:32:55):** "Agreed. I will take ownership. We need this complete before the Q4 enterprise pilot launches."

#### Extracted Decision Intelligence:
- **Decision Title:** Selection of Supabase Enterprise (Sydney) as Primary Database Tier
- **Decision Owner:** Sarah Jenkins (Head of Product & Architecture), sponsored by Anthony Cortez (Managing Director).
- **Decision Rationale:** Australian data residency compliance, sub-millisecond local latency, and native support for relational knowledge graph schema.
- **Rejected Alternatives:** Distributed DynamoDB (rejected due to excessive relational schema complexity for knowledge graph queries).
- **Decision Impact:** Critical enterprise infrastructure; budget cap $50,000 AUD; affects Q4 Enterprise Pilot.
- **Priority:** Critical.
- **Confidence Score:** 98 / 100 (Unanimous executive consensus and explicit verbal confirmation).
- **Dependencies:** Contract execution with Supabase; AWS Sydney VPC peering setup.
- **Associated Risks:** Data migration timeline slippage prior to Q4 enterprise pilot.

### 7.4 Persistence into Decision Memory

Extracted decisions are inserted directly into the `decision_memory` table in PostgreSQL:
```sql
INSERT INTO public.decision_memory (
  project_id,
  organization_id,
  title,
  summary,
  decision_maker,
  rationale,
  alternatives_considered,
  impact_level,
  priority,
  confidence_score,
  dependencies,
  created_by
) VALUES (
  'prj_550e8400-e29b-41d4-a716-446655440000',
  'org_770e8400-e29b-41d4-a716-446655440000',
  'Selection of Supabase Enterprise (Sydney) as Primary Database Tier',
  'Formal resolution establishing Supabase Sydney as the core relational data store.',
  'Sarah Jenkins (Sponsored by Anthony Cortez)',
  'Australian data residency, low-latency relational queries, and knowledge graph graph-traversal capability.',
  '[{"alternative": "DynamoDB", "reason": "Excessive relational complexity for graph traversal"}]'::jsonb,
  'high',
  'critical',
  98,
  ARRAY['VPC Peering', 'Q4 Pilot'],
  'usr_c01a-88bf'
);
```

Decisions stored in Decision Memory are version-tracked, support superseding relationships (where a new decision overturns an older one), and are indexed for instantaneous Copilot retrieval.


---

# SECTION 8: ACTION EXTRACTION ENGINE

### 8.1 The Five-Field Delegation Standard

In typical meeting software, action items are captured as vague, passive phrases: "review the sales deck", "investigate database options", or "follow up with the client". In the real world, vague tasks result in zero execution.

Concludo Workspace strictly enforces **Anthony Cortez's Five-Field Delegation Standard**. The Action Extraction Engine will not accept an action item unless all five structural fields are determined:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │               THE FIVE-FIELD DELEGATION STANDARD                       │
 ├─────────────────────────┬──────────────────────────────────────────────┤
 │ 1. Task Description     │ An action-oriented, imperative directive     │
 │                         │ specifying an unambiguous business outcome.  │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 2. Single Named Owner   │ Exactly one accountable individual. Shared   │
 │                         │ ownership ("the team", "devs") is rejected.  │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 3. Explicit Calendar Due│ A concrete calendar date (e.g. 2026-10-15).  │
 │    Date                 │ Vague terms like "ASAP" or "next week" are   │
 │                         │ calculated to an exact working day cut-off.  │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 4. Verifiable Definition│ An objective, verifiable acceptance criterion│
 │    of Done (DoD)        │ that leaves zero ambiguity as to completion. │
 ├─────────────────────────┼──────────────────────────────────────────────┤
 │ 5. Interim Checkpoint   │ A mandatory milestone review date before the │
 │    Date                 │ deadline to surface blockers early.          │
 └─────────────────────────┴──────────────────────────────────────────────┘
```

### 8.2 Action Identification Pipeline

The Action Extraction Engine parses dialogue through four analysis phases:
1. **Commitment Verb Scanning:** Identifies binding commitments ("I will deliver", "Anthony assigned me", "Marcus is responsible for", "taking ownership of").
2. **Accountability Disambiguation:** Resolves named individuals against workspace profiles, assigning a verified `user_id`. If multiple individuals are mentioned, the engine assigns the primary lead as single owner and designates others as contributors.
3. **Temporal Normalisation:** Converts relative temporal expressions ("by next Friday at 5pm", "before the end of October", "in three sprints") into ISO 8601 timestamps (`2026-10-23T17:00:00+10:00`).
4. **Acceptance Criteria Synthesis:** Extracts the verifiable condition that proves the task is finished (e.g., "signed document in Drive", "PR merged to main with passing CI").

### 8.3 Real-World Action Extraction Example

#### Input Transcript Dialogue:
> **Anthony Cortez (00:41:10):** "Marcus, we cannot proceed with the enterprise sales rollout until we have the formal SOC 2 Type II compliance audit roadmap locked down. I need you to lead this. Can you have the full audit gap analysis and vendor engagement brief finalised by the 25th of October?"
> 
> **Marcus Vance (00:41:35):** "Yes, Anthony. I will own the SOC 2 roadmap. The definition of done will be the completed gap matrix signed off by our external security auditor, uploaded to the compliance drive. Let us do a mid-point check on the 10th of October to review initial auditor findings."
> 
> **Anthony Cortez (00:41:50):** "Locked in. If the external auditor stalls, escalate to me immediately."

#### Extracted Five-Field Action Record:
- **Task Description:** Finalise SOC 2 Type II compliance audit gap analysis and external vendor engagement brief.
- **Single Accountable Owner:** Marcus Vance (`usr_m77b-99ef`), Head of Compliance.
- **Explicit Due Date:** 25 October 2026 (17:00 AEST).
- **Definition of Done:** Completed gap matrix signed off by external security auditor and uploaded to the compliance drive folder.
- **Interim Checkpoint Date:** 10 October 2026 (Mid-point findings review).
- **Escalation Path:** Anthony Cortez (Managing Director) for external auditor delays.
- **Priority:** High.
- **Risk Level:** Medium (External auditor availability dependency).
- **Initial Status:** `not_started`.

### 8.4 Persistence into Action Tracker

The extracted action is persisted into the `action_tracker` table:
```sql
INSERT INTO public.action_tracker (
  project_id,
  organization_id,
  title,
  description,
  owner_id,
  owner_name,
  due_date,
  checkpoint_date,
  definition_of_done,
  escalation_path,
  priority,
  risk_level,
  status,
  created_by
) VALUES (
  'prj_550e8400-e29b-41d4-a716-446655440000',
  'org_770e8400-e29b-41d4-a716-446655440000',
  'Finalise SOC 2 Type II Compliance Gap Analysis',
  'Complete comprehensive security gap audit and engagement brief for external auditor.',
  'usr_m77b-99ef',
  'Marcus Vance',
  '2026-10-25',
  '2026-10-10',
  'Completed gap matrix signed off by external security auditor and uploaded to compliance drive.',
  'Anthony Cortez (Managing Director)',
  'high',
  'medium',
  'not_started',
  'usr_c01a-88bf'
);
```

Actions stored in the Action Tracker integrate directly with external task management connectors (Microsoft Planner, Jira, Asana) and feed the Action Drift Index (ADI) in predictive intelligence.


---

# SECTION 9: RISK DETECTION ENGINE\n\n### 9.1 The Nine Enterprise Risk Domains\nRisk detection in Concludo moves far beyond generic sentiment analysis. The Risk Detection Engine continuously interrogates conversational transcripts across nine distinct enterprise risk domains, ensuring that every vulnerability voiced in executive dialogue is quantified, mitigated, and tracked:\n\n| Risk Domain | Enterprise Scope | Baseline Severity | Baseline Probability | Business Impact Summary | Core Mitigation Strategy | Escalation Target |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n| **Strategic Risks** | Threats to market positioning, competitive disruption, flawed strategic assumptions, or obsolete business models. | High | Possible | Loss of market leadership or failed strategic repositioning. | Quarterly strategic review, scenario modelling. | Board of Directors |\n| **Project Risks** | Scope creep, milestone slippage, unmanaged dependencies, critical path delays, and resource bottlenecks. | High | Likely | Delivery delay of core product releases and customer onboarding. | Scope de-scoping, critical path compression. | Steering Committee |\n| **Financial Risks** | Budget overruns, cash runway depletion, margin erosion, unexpected tax liabilities, or customer bad debt. | Critical | Possible | Liquidity constraints, requirement for unbudgeted emergency capital. | Strict spend authorization gating, financial audits. | Chief Financial Officer |\n| **People Risks** | Key-person dependency, leadership burnout, high employee turnover, recruitment failure, or cultural disharmony. | Medium | Likely | Loss of institutional knowledge and engineering delivery velocity. | Retention bonuses, succession planning, cross-training. | Chief People Officer |\n| **Technology Risks** | System outages, database scaling bottlenecks, architectural technical debt, and platform vulnerabilities. | Critical | Unlikely | Customer service disruption, contractual SLA penalty payouts. | High-availability clustering, automated regression tests. | Head of Architecture |\n| **Vendor Risks** | Third-party API downtime, supplier price hikes, single-source dependency, or vendor insolvency. | Medium | Possible | Operational blockage of upstream SaaS workflows. | Multi-vendor fallback contracts, SLA enforcement. | Head of Procurement |\n| **Governance Risks** | Statutory non-compliance, board fiduciary breaches, failure of internal controls, or conflict of interest. | Critical | Rare | Director personal liability, regulatory penalties, loss of license. | Statutory compliance audits, legal counsel oversight. | Company Secretary & Board |\n| **Operational Risks** | Process failure, customer support queues, manual data corruption, and operational handoff gaps. | Medium | Likely | Customer dissatisfaction, churn, and operational inefficiency. | SOP standardisation, workflow automation. | Chief Operating Officer |\n| **Compliance Risks** | Breaches of Australian Privacy Principles (APPs), GDPR, SOC 2, ISO 27001, or industry regulations. | Critical | Unlikely | Regulatory fines, public reputational damage, customer contract breach. | Continuous compliance automation, automated audit logging. | Head of Compliance |\n
### 9.2 Risk Evaluation Methodology and 5x5 Matrix

Every detected risk is mapped to an industry-standard 5x5 Risk Matrix:

```
                  5x5 ENTERPRISE RISK SCORING MATRIX
                  
     Probability  │ Rare (1) │ Unlikely (2) │ Possible (3) │ Likely (4) │ Almost Certain (5)
 ─────────────────┼──────────┼──────────────┼──────────────┼────────────┼───────────────────
  Catastrophic (5)│  Medium  │     High     │   Critical   │  Critical  │     Critical
  Major (4)       │   Low    │    Medium    │     High     │  Critical  │     Critical
  Moderate (3)    │   Low    │     Low      │    Medium    │    High    │       High
  Minor (2)       │   Low    │     Low      │     Low      │   Medium   │      Medium
  Insignificant(1)│   Low    │     Low      │     Low      │    Low     │       Low
```

A composite Risk Score (1 to 25) is calculated as:
$$	ext{Risk Score} = 	ext{Severity (1-5)} 	imes 	ext{Probability (1-5)}$$

### 9.3 Structured Risk Record and Evidence Pinning

A risk item is only valid if anchored by verbatim evidence. The Risk Engine constructs an immutable record:

```json
{
  "risk_id": "rsk_441a-88cd",
  "transcript_id": "trn_9a8b7c6d",
  "risk_domain": "Technology Risks",
  "title": "Database Connection Pool Saturation under Multi-Tenant Spike",
  "severity": "Major (4)",
  "probability": "Possible (3)",
  "risk_score": 12,
  "risk_level": "High",
  "business_impact": "Multi-tenant latency degradation and connection drops during concurrent peak usage.",
  "mitigation_strategy": "Implement Supabase connection pooler with dedicated PgBouncer instances in Sydney.",
  "mitigation_owner": "Sarah Jenkins",
  "mitigation_deadline": "2026-10-14",
  "escalation_path": "Anthony Cortez (Managing Director)",
  "verbatim_evidence": {
    "speaker": "Sarah Jenkins",
    "timestamp": "00:38:12",
    "utterance": "If ten enterprise tenants run concurrent knowledge graph aggregations, our current connection pool will choke and cause timeouts."
  }
}
```

Detected risks are written to `public.generated_intelligence` and populate the Risk and Issue Log (`OUT-05`) and Risk Heatmaps (`VIS-05`).


---

# SECTION 10: OPPORTUNITY DETECTION ENGINE\n\n### 10.1 The Eight Commercial Opportunity Archetypes\nWhere conventional tools listen solely for tasks, Concludo actively hunts for value creation. The Opportunity Detection Engine identifies upside potential across eight commercial archetypes:\n\n| Opportunity Archetype | Strategic Definition | Key Evaluation Metrics |\n| :--- | :--- | :--- |\n| **Growth Opportunities** | Expansion into new customer cohorts, geographic regions, or adjacent market verticals. | `Addressable TAM, customer acquisition velocity, scalable distribution.` |\n| **Efficiency Opportunities** | Process automation, operational cost elimination, cycle-time compression, and resource re-allocation. | `Cost savings in AUD, hours saved per week, error reduction percentage.` |\n| **Innovation Opportunities** | Novel intellectual property, breakthrough technological architectures, or disruptive feature sets. | `Defensible patents, technological barrier to entry, customer delight.` |\n| **Revenue Opportunities** | Up-selling, cross-selling, pricing tier optimisation, and new commercialization models. | `Immediate ARR expansion, Net Retention Rate (NRR) expansion, customer LTV.` |\n| **Partnership Opportunities** | Strategic alliances, channel distribution agreements, co-selling, and technology integrations. | `Partner distribution reach, shared deal flow, joint go-to-market credibility.` |\n| **Market Opportunities** | Capitalizing on competitor missteps, regulatory changes, or sudden industry macro shifts. | `First-mover advantage, market share capture, brand authority enhancement.` |\n| **Product Opportunities** | High-demand feature enhancements, platform integrations, or UX friction reductions. | `User adoption rate, churn reduction, feature engagement depth.` |\n| **Strategic Opportunities** | M&A consolidation, enterprise transformation, corporate spin-offs, or category creation. | `Long-term shareholder value creation, multi-year competitive moat.` |\n
### 10.2 Opportunity Scoring Algorithm

Opportunities are evaluated across five weighted criteria to yield a standardised **Opportunity Score (0 to 100)**:

$$\text{Opportunity Score} = (V \times 0.30) + (F \times 0.25) + (S \times 0.20) + (I \times 0.15) + (T \times 0.10)$$

Where:
- $V$ = **Value Potential (0 to 100):** Estimated financial or strategic upside.
- $F$ = **Execution Feasibility (0 to 100):** Technical and operational ease of execution.
- $S$ = **Strategic Alignment (0 to 100):** Consistency with corporate 3-year objectives.
- $I$ = **Capital Investment Efficiency (0 to 100):** Ratio of return to required capital outlay.
- $T$ = **Time-to-Value (0 to 100):** Speed with which benefits can be realized.

### 10.3 Influence on Output Selection

Detected high-scoring opportunities (Score > 75) trigger dynamic output generation:
1. **Commercial Investment Cases (`OUT-13`):** High-value revenue or partnership opportunities trigger automated commercial business case generation.
2. **Product Feature Specifications (`OUT-16`):** High-feasibility product opportunities generate draft functional specifications and user journey maps.
3. **Strategic Roadmaps (`VIS-03`):** Long-term growth opportunities are automatically sequenced into the multi-quarter corporate roadmap.


---

# SECTION 11: MEETING HEALTH ENGINE\n\n### 11.1 The 10-Dimension Health Scoring Framework\nMeetings represent one of the largest un-audited capital expenditures in an enterprise. The Meeting Health Engine executes an automated diagnostic on every meeting, scoring performance across ten distinct dimensions from 0 to 100:\n\n| Dimension Code & Name | Diagnostic Focus | Mathematical Weight | Measurement Signals |\n| :--- | :--- | :--- | :--- |\n| **D1: Purpose Clarity** | Evaluates whether the meeting possessed an explicit objective, shared agenda, and structured opening statement. | 10% | `Agenda shared, clear statement of purpose in first 5 minutes.` |\n| **D2: Participation Balance** | Calculates conversational equality, speaking distribution, and psychological safety across attendees. | 10% | `Gini coefficient of speaking time, question-to-statement ratio.` |\n| **D3: Decision Quality** | Measures whether choices were made with clear rationale, considered alternatives, and unambiguous ownership. | 15% | `Decisions made, explicit rationale articulated, alternatives weighed.` |\n| **D4: Action Quality** | Audits extracted actions against the Five-Field Delegation Standard (Task, Owner, Due Date, DoD, Checkpoint). | 15% | `Percentage of actions satisfying all five mandatory fields.` |\n| **D5: Strategic Value** | Assesses whether the dialogue advanced high-level corporate pillars versus descending into tactical minutiae. | 10% | `Relevance of discussion topics to active strategic projects.` |\n| **D6: Time Efficiency** | Measures pacing, avoidance of circular conversational loops, and adherence to scheduled time limits. | 10% | `Topic transit velocity, absence of repetitive circular debate.` |\n| **D7: Risk Identification** | Evaluates whether participants actively surfaced downside scenarios, regulatory hurdles, and failure modes. | 8% | `Proactive identification of vulnerabilities, absence of groupthink.` |\n| **D8: Opportunity Identification** | Measures creative upside exploration, commercial brainstorming, and competitive positioning dialogue. | 7% | `Surfacing of commercial, product, or partnership opportunities.` |\n| **D9: Outcome Quality** | Evaluates the tangible business artifacts produced by the session (deliverables, policies, charters). | 10% | `Volume and completeness of downstream deliverables generated.` |\n| **D10: Overall Meeting Value** | Integrates all component sub-scores into an authoritative executive index of organisational ROI. | 5% | `Executive sentiment, momentum rating, composite health.` |\n
### 11.2 Mathematical Health Scoring Formula

The Overall Meeting Health Score ($H_{\text{meeting}}$) is computed as:

$$H_{\text{meeting}} = \sum_{i=1}^{10} (D_i \times W_i)$$

Where $D_i$ represents the normalized score (0 to 100) for dimension $i$, and $W_i$ represents its mathematical weight.

### 11.3 Classification Bands and Executive Verdicts

The resulting score places the meeting into one of five rigorous classification bands:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                   MEETING PERFORMANCE CLASSIFICATIONS                  │
 ├────────────────┬──────────┬────────────────────────────────────────────┤
 │ Classification │ Score    │ Executive Interpretation & Prescribed Action│
 ├────────────────┼──────────┼────────────────────────────────────────────┤
 │ Excellent      │ 90 - 100 │ Flawless executive governance. Clear goals,│
 │                │          │ balanced debate, rigorous Five-Field tasks.│
 ├────────────────┼──────────┼────────────────────────────────────────────┤
 │ Good           │ 75 - 89  │ Productive session. Tangible decisions made│
 │                │          │ with minor drift or slight action gaps.    │
 ├────────────────┼──────────┼────────────────────────────────────────────┤
 │ Average        │ 60 - 74  │ Sub-optimal meeting. High conversational   │
 │                │          │ loopiness, vague deadlines, weak dissent.  │
 ├────────────────┼──────────┼────────────────────────────────────────────┤
 │ Poor           │ 40 - 59  │ Low-leverage session. Discussion without    │
 │                │          │ closure, monopolised speaking, zero DoD.   │
 ├────────────────┼──────────┼────────────────────────────────────────────┤
 │ Waste of Time  │ 0 - 39   │ Severe organisational capital waste. Could │
 │                │          │ have been an email. No decisions or owners.│
 └────────────────┴──────────┴────────────────────────────────────────────┘
```

When a meeting scores in the `Waste of Time` band, Concludo generates a dedicated Meeting Performance Report (`OUT-10`) providing explicit behavioural recommendations for the meeting organiser to eliminate calendar bloat.


---

# SECTION 12: OUTPUT SELECTION ENGINE\n\n### 12.1 The Core Output Architecture\nThe Output Selection Engine is the operational heart of Concludo. It evaluates the classification, intent, attendee hierarchy, and extracted entities to determine the exact portfolio of business deliverables generated for the organisation.\nDeliverables are divided into two primary tiers:\n1. **The 10 Universal Spine Outputs (OUT-01 to OUT-10):** Essential baseline intelligence artifacts generated across core business scenarios.\n2. **The 48 Catalogue Deliverables (OUT-11 to OUT-58):** Specialized, domain-specific corporate documents (Board Packs, Strategic Plans, Product Roadmaps, Technical Specs, Risk Audits).\n\n### 12.2 The 50 Meeting Type Output Mapping Matrix\n\n| Code | Meeting Archetype | Mandatory Primary Deliverables | Recommended Secondary Deliverables | Integrated Visualisation Suite |\n| :--- | :--- | :--- | :--- | :--- |\n| **M-01** | Executive Strategy Session | `OUT-01, OUT-02, OUT-11, OUT-14` | `OUT-05, OUT-06, OUT-08` | `VIS-01, VIS-03, VIS-08` |\n| **M-02** | Board of Directors Meeting | `OUT-01, OUT-02, OUT-12, OUT-09` | `OUT-05, OUT-08, OUT-07` | `VIS-08, VIS-09, VIS-11` |\n| **M-03** | Risk & Audit Committee | `OUT-05, OUT-20, OUT-02, OUT-03` | `OUT-01, OUT-09, OUT-18` | `VIS-05, VIS-10, VIS-08` |\n| **M-04** | Senior Leadership Team Weekly | `OUT-01, OUT-03, OUT-02, OUT-10` | `OUT-05, OUT-18, OUT-08` | `VIS-08, VIS-06` |\n| **M-05** | Investor & Shareholder Briefing | `OUT-01, OUT-13, OUT-06, OUT-14` | `OUT-04, OUT-07, OUT-08` | `VIS-09, VIS-03, VIS-08` |\n| **M-06** | Annual General Meeting (AGM) | `OUT-02, OUT-04, OUT-09, OUT-07` | `OUT-01, OUT-12` | `VIS-08, VIS-11` |\n| **M-07** | Advisory Board Consultation | `OUT-04, OUT-06, OUT-14, OUT-01` | `OUT-02, OUT-11` | `VIS-01, VIS-03` |\n| **M-08** | Crisis Management Council | `OUT-01, OUT-03, OUT-05, OUT-07` | `OUT-02, OUT-09, OUT-21` | `VIS-05, VIS-02` |\n| **M-09** | Mergers & Acquisitions Steering | `OUT-13, OUT-05, OUT-02, OUT-01` | `OUT-06, OUT-09, OUT-11` | `VIS-10, VIS-09, VIS-05` |\n| **M-10** | Annual Business Planning | `OUT-11, OUT-02, OUT-14, OUT-03` | `OUT-05, OUT-08, OUT-13` | `VIS-01, VIS-03, VIS-08` |\n| **M-11** | Commercial Contract Negotiation | `OUT-02, OUT-05, OUT-03, OUT-09` | `OUT-04, OUT-01, OUT-13` | `VIS-05, VIS-07` |\n| **M-12** | Go-To-Market (GTM) Strategy | `OUT-15, OUT-14, OUT-03, OUT-06` | `OUT-01, OUT-07, OUT-16` | `VIS-03, VIS-06, VIS-02` |\n| **M-13** | Quarterly Business Review (QBR) | `OUT-01, OUT-18, OUT-03, OUT-08` | `OUT-02, OUT-05, OUT-10` | `VIS-08, VIS-09` |\n| **M-14** | Strategic Partnership Summit | `OUT-04, OUT-06, OUT-02, OUT-03` | `OUT-01, OUT-07, OUT-13` | `VIS-03, VIS-10` |\n| **M-15** | Pricing & Packaging Review | `OUT-02, OUT-13, OUT-05, OUT-01` | `OUT-06, OUT-16, OUT-08` | `VIS-07, VIS-09` |\n| **M-16** | Market Expansion Workshop | `OUT-11, OUT-06, OUT-05, OUT-14` | `OUT-01, OUT-03, OUT-13` | `VIS-01, VIS-03, VIS-05` |\n| **M-17** | Sales Pipeline & Deal Review | `OUT-03, OUT-01, OUT-10, OUT-06` | `OUT-05, OUT-18` | `VIS-06, VIS-08` |\n| **M-18** | Brand & Corporate Positioning | `OUT-04, OUT-07, OUT-02, OUT-01` | `OUT-11, OUT-06` | `VIS-01, VIS-03` |\n| **M-19** | Product Discovery Workshop | `OUT-16, OUT-06, OUT-04, OUT-03` | `OUT-02, OUT-14` | `VIS-01, VIS-07` |\n| **M-20** | Product Roadmap Planning | `OUT-14, OUT-16, OUT-02, OUT-03` | `OUT-01, OUT-05, OUT-08` | `VIS-03, VIS-06, VIS-04` |\n| **M-21** | Architecture Governance Board | `OUT-17, OUT-02, OUT-05, OUT-03` | `OUT-01, OUT-09, OUT-20` | `VIS-13, VIS-07` |\n| **M-22** | Sprint Planning & Backlog | `OUT-03, OUT-16, OUT-10` | `OUT-02, OUT-04` | `VIS-06, VIS-04` |\n| **M-23** | Technical Post-Mortem & Incident Review | `OUT-21, OUT-03, OUT-05, OUT-09` | `OUT-01, OUT-02, OUT-17` | `VIS-02, VIS-05, VIS-07` |\n| **M-24** | Security & Penetration Audit Review | `OUT-20, OUT-05, OUT-03, OUT-02` | `OUT-01, OUT-09, OUT-17` | `VIS-05, VIS-06` |\n| **M-25** | AI & Machine Learning Strategy | `OUT-17, OUT-06, OUT-05, OUT-14` | `OUT-01, OUT-02, OUT-13` | `VIS-13, VIS-03` |\n| **M-26** | Design Sprint & UX Critique | `OUT-16, OUT-04, OUT-03` | `OUT-02, OUT-06` | `VIS-07, VIS-02` |\n| **M-27** | Platform Scaling & Infrastructure Review | `OUT-17, OUT-02, OUT-05, OUT-03` | `OUT-01, OUT-18` | `VIS-13, VIS-08` |\n| **M-28** | Programme Governance & SteerCo | `OUT-19, OUT-01, OUT-02, OUT-03` | `OUT-05, OUT-08, OUT-10` | `VIS-04, VIS-08, VIS-05` |\n| **M-29** | Operational Performance Review | `OUT-18, OUT-03, OUT-10, OUT-01` | `OUT-02, OUT-05` | `VIS-08, VIS-06` |\n| **M-30** | Project Kick-Off Meeting | `OUT-19, OUT-03, OUT-07, OUT-02` | `OUT-01, OUT-04, OUT-05` | `VIS-04, VIS-11, VIS-02` |\n| **M-31** | Weekly Project Status Sync | `OUT-03, OUT-19, OUT-10` | `OUT-05, OUT-01` | `VIS-06, VIS-08` |\n| **M-32** | Continuous Improvement & Kaizen | `OUT-18, OUT-06, OUT-03, OUT-04` | `OUT-02, OUT-10` | `VIS-07, VIS-12` |\n| **M-33** | Budget & Cost Control Review | `OUT-18, OUT-02, OUT-05, OUT-03` | `OUT-01, OUT-08` | `VIS-08, VIS-09` |\n| **M-34** | Resource & Workforce Capacity Planning | `OUT-19, OUT-03, OUT-02, OUT-18` | `OUT-05, OUT-01` | `VIS-04, VIS-11` |\n| **M-35** | Vendor & Supplier Performance Review | `OUT-18, OUT-05, OUT-03, OUT-02` | `OUT-01, OUT-09` | `VIS-08, VIS-10` |\n| **M-36** | Supply Chain & Logistics Operational Review | `OUT-18, OUT-05, OUT-03, OUT-01` | `OUT-02, OUT-10` | `VIS-08, VIS-05` |\n| **M-37** | Executive Talent & Search Briefing | `OUT-02, OUT-04, OUT-05, OUT-03` | `OUT-01, OUT-07` | `VIS-11, VIS-07` |\n| **M-38** | Performance Calibration Review | `OUT-02, OUT-04, OUT-03` | `OUT-01, OUT-10` | `VIS-11, VIS-08` |\n| **M-39** | Succession & Talent Planning | `OUT-02, OUT-05, OUT-03, OUT-14` | `OUT-01, OUT-04` | `VIS-11, VIS-12` |\n| **M-40** | Company Town Hall & All-Hands | `OUT-07, OUT-04, OUT-01, OUT-14` | `OUT-08, OUT-10` | `VIS-03, VIS-08` |\n| **M-41** | Team Retrospective | `OUT-04, OUT-03, OUT-10` | `OUT-06, OUT-05` | `VIS-06, VIS-01` |\n| **M-42** | Culture, Engagement & DE&I Council | `OUT-04, OUT-03, OUT-07, OUT-01` | `OUT-05, OUT-08` | `VIS-11, VIS-08` |\n| **M-43** | Remuneration & Incentive Committee | `OUT-02, OUT-04, OUT-05, OUT-01` | `OUT-03, OUT-09` | `VIS-08, VIS-07` |\n| **M-44** | Enterprise Sales Discovery Call | `OUT-13, OUT-06, OUT-03, OUT-04` | `OUT-05, OUT-07` | `VIS-01, VIS-06` |\n| **M-45** | Enterprise Client Solutions Pitch | `OUT-13, OUT-07, OUT-03, OUT-14` | `OUT-01, OUT-06` | `VIS-03, VIS-09, VIS-02` |\n| **M-46** | Client Implementation Kick-Off | `OUT-19, OUT-03, OUT-07, OUT-02` | `OUT-05, OUT-01` | `VIS-04, VIS-02, VIS-11` |\n| **M-47** | Client Success Executive Business Review | `OUT-01, OUT-06, OUT-03, OUT-14` | `OUT-07, OUT-18` | `VIS-08, VIS-03` |\n| **M-48** | Client Escalation & Remediation | `OUT-01, OUT-03, OUT-05, OUT-07` | `OUT-02, OUT-09` | `VIS-02, VIS-05` |\n| **M-49** | Professional Services Advisory Workshop | `OUT-11, OUT-18, OUT-04, OUT-03` | `OUT-06, OUT-14` | `VIS-12, VIS-01, VIS-03` |\n| **M-50** | Public Stakeholder & Community Consultation | `OUT-04, OUT-07, OUT-09, OUT-01` | `OUT-05, OUT-03` | `VIS-02, VIS-08` |\n
### 12.3 Selection Decision Trees and Gating Rules

Output selection is not static. The engine executes three dynamic gating rules:
1. **The Data Sufficiency Gate:** An output will not generate if its underlying structured data threshold is unmet. For example, `OUT-02 (Decision Register)` is omitted if zero valid decisions were extracted, emitting an explanatory notice: *"No formal decisions were resolved during this session."*
2. **The Audience Modulation Gate:** Automatically tailors the phrasing and detail level based on intended audience:
   - *Executive Tier:* Concise, metric-driven, forward-looking, highlighting capital exposure.
   - *Operational Tier:* Granular, procedural, highlighting owners, dependencies, and deadlines.
   - *Client-Facing Tier:* Polished, professional, sanitising confidential internal debate.
3. **The Stated Omission Standard:** When expected information is missing from the meeting (e.g., an Annual Planning session where budget figures were avoided), the engine explicitly logs the omission in the Executive Briefing rather than guessing or hallucinating numbers.


---

# SECTION 13: VISUALIZATION SELECTION ENGINE\n\n### 13.1 Automated Visual Selection Principles\nExecutives absorb visual models significantly faster than dense narrative prose. The Visualization Selection Engine parses extracted structured intelligence and programmatically selects, renders, and places high-fidelity visual artifacts into generated deliverables.\nThe engine enforces **The Four Visual Tests**:\n1. **Data Authenticity:** The visual must be completely populated from verified in-transcript data. Synthetic or placeholder data is strictly prohibited.\n2. **Executive Decidability:** The visual must drive an immediate business decision or strategic realization.\n3. **Zero Visual Noise:** Every axis, label, colour token, and data point must convey meaningful corporate information.\n4. **Accessible Design System:** All visuals use Concludo design tokens (Navy `#16263F`, Gold `#E2B53C`, Canvas `#F4F6FA`, Poppins headings, Inter data labels) and satisfy WCAG 2.1 AA contrast standards.\n\n### 13.2 Core Visualization Catalogue\n\n| Visual Code & Name | Business Purpose & Topology | Strict Data Preconditions | Target Deliverable Placement |\n| :--- | :--- | :--- | :--- |\n| **VIS-01: SWOT Analysis** | 2x2 strategic matrix mapping Strengths, Weaknesses, Opportunities, and Threats. | `At least 2 entries in each quadrant extracted from dialogue.` | OUT-11 (Business Plan), OUT-01 (Strategy Brief) |\n| **VIS-02: Timeline Map** | Sequential horizontal chronological event diagram with date pins. | `At least 3 dated historical or forward milestone events.` | OUT-19 (Status), OUT-21 (Post-Mortem) |\n| **VIS-03: Strategic Roadmap** | Multi-quarter swimlane diagram grouping themes by strategic pillar. | `Quarterly milestones across at least 2 functional tracks.` | OUT-14 (Roadmap), OUT-15 (Launch Plan) |\n| **VIS-04: Delivery Gantt Chart** | Detailed task schedule with dependencies, owners, and critical path. | `At least 4 scheduled actions with start and due dates.` | OUT-19 (Programme Delivery Status) |\n| **VIS-05: Risk Heatmap** | 5x5 matrix plotting Severity vs Probability with colour intensity. | `At least 3 detected risks with quantified severity and probability.` | OUT-05 (Risk Log), OUT-20 (Risk Audit) |\n| **VIS-06: Action Priority Matrix** | 2x2 matrix plotting Urgency vs Business Impact for all tasks. | `At least 4 extracted actions with priority parameters.` | OUT-03 (Action Plan), SLT Weekly |\n| **VIS-07: Decision Logic Tree** | Branching logic graph tracing decision criteria and discarded paths. | `Complex multi-step decision with explicit alternatives considered.` | OUT-02 (Decision Register) |\n| **VIS-08: Executive RAG Dashboard** | High-level Red-Amber-Green status cards with key KPI variance. | `At least 3 tracked operational or strategic metrics.` | OUT-01 (Executive Briefing), Board Packs |\n| **VIS-09: Revenue Forecast** | Bar and line chart showing ARR/EBITDA projections and cash burn. | `Numerical financial projections articulated in dialogue.` | OUT-13 (Investment Case), Investor Briefings |\n| **VIS-10: Risk-Reward Matrix** | Scatter plot mapping financial/strategic risk against expected return. | `Competing investment or strategic options discussed.` | OUT-13 (Investment Case), M&A Steering |\n| **VIS-11: Organisation Map** | Hierarchical reporting structure showing teams, leads, and vacancies. | `Organisational restructuring or cross-team collaboration discussed.` | OUT-11 (Business Plan), Talent Planning |\n| **VIS-12: Capability Maturity Matrix** | Radar chart or maturity curve evaluating 5-8 core competencies. | `Process or technology maturity assessment discussions.` | OUT-18 (Operational Review), Kaizen |\n| **VIS-13: Architecture Dependency Diagram** | Directed graph showing microservices, databases, and third-party APIs. | `Technical architecture or platform scaling discussions.` | OUT-17 (Technical Architecture Spec) |\n
### 13.3 Fallback and Degraded Visual Paths

If an output template prescribes a visual (e.g., a Gantt chart in a Programme Delivery Report) but the transcript lacks the required timestamp density, the Visualization Selection Engine automatically triggers a graceful fallback path:
- **Gantt Chart Fallback:** Degrades to an **Action Priority Matrix (`VIS-06`)** or a structured chronological table.
- **Revenue Forecast Fallback:** Degrades to a structured **Financial Assumptions Table** highlighting un-modeled figures.
- **Risk Heatmap Fallback:** Degrades to a high-priority **Top-3 Critical Vulnerabilities Card**.

Under no circumstance will Concludo invent numerical dates, dollars, or probability scores to satisfy a chart renderer.


---

# SECTION 14: CONCLUDO INSIGHT ENGINE\n\n### 14.1 The Unspoken Intelligence Layer\nConventional AI utilities transcribe and summarise only what was verbally spoken. However, the greatest business failures stem from what leadership teams *failed* to say. The Concludo Insight Engine is the proprietary analytical layer that interrogates the structural gaps, logical inconsistencies, and unvoiced risks of a meeting.\n\n### 14.2 The Eight Insight Dimensions\n\n| Insight Dimension | Strategic Focus | Real-World Enterprise Example |\n| :--- | :--- | :--- |\n| **Missing Discussions** | Identifies critical business topics that standard executive practice requires but which attendees completely overlooked. | *"A commercial pricing review that failed to discuss customer churn or gross margin impact."* |\n| **Weak Assumptions** | Detects unsupported assertions, optimistic biases, or unverified facts treated as certainties by participants. | *"Assuming an uncontracted third-party vendor will deliver an API integration in two weeks without a signed agreement."* |\n| **Risk Gaps** | Identifies second-order failure modes and downstream operational vulnerabilities that the team ignored. | *"Deciding to launch an enterprise sales campaign without auditing current customer support team capacity."* |\n| **Opportunity Gaps** | Highlights commercial upside, adjacent market opportunities, or efficiency gains that were bypassed in conversation. | *"Failing to discuss enterprise tier up-selling when evaluating new multi-tenant feature requests."* |\n| **Strategic Gaps** | Flags direct contradictions between agreed meeting actions and the organisation's stated 3-year strategic pillars. | *"Committing significant capital to a legacy on-premise feature while the corporate strategy is 100% cloud SaaS."* |\n| **Decision Issues** | Surfaces ambiguous mandates, apparent consensus that masks unvoiced skepticism, or decisions lacking an accountable sponsor. | *"A resolution where two executives gave conflicting verbal directives and neither took formal ownership."* |\n| **Governance Concerns** | Identifies statutory compliance exposure, conflicts of interest, missing board approvals, or delegated authority breaches. | *"Approving a $500k capital expenditure in a weekly sync without formal board or CFO sign-off."* |\n| **Recommended Next Steps** | Synthesizes 3-5 high-leverage executive interventions to mitigate detected blind spots and accelerate execution. | *"Commissioning an immediate third-party security gap audit before proceeding with the public API release."* |\n
### 14.3 Insight Generation Safeguards and Verification Rules

Because insights introduce analytical observations beyond verbatim transcript quotes, they are subjected to strict anti-hallucination guardrails:
1. **The Grounding Rule:** Every insight must be anchored to a specific conversational premise. If an assumption is flagged as weak, the insight must cite the exact executive assertion being challenged.
2. **The Stated Benchmark:** The engine references established corporate governance frameworks (e.g., SOC 2, ISO 27001, ASX Corporate Governance Principles) or active project charter documents stored in the database.
3. **Calm, Constructive Tone:** Insights avoid alarmist language. They are framed as calm, high-value executive counsel designed to empower the Managing Director and leadership team.
4. **Actionable Remediation:** An insight is never delivered in a vacuum. Every identified gap is paired with an actionable next step or clarifying question for the next meeting.


---

# SECTION 15: OUTPUT PACKAGE BUILDER\n\n### 15.1 The Multi-Deliverable Packaging Philosophy\nIn high-performing enterprises, leadership teams never operate from a single, generic document. A strategic meeting requires an Executive Briefing for the CEO, an Action Tracker for operational leads, a Risk Register for the compliance team, and a Roadmap for product engineering.\nThe Output Package Builder coordinates multiple specialized deliverables into a unified **Output Package**, compiling human-readable documents, interactive visual charts, and structured machine-readable JSON feeds into a single governed artifact.\n\n### 15.2 The Eight Standard Output Package Blueprints\n\n| Package Code & Name | Primary Enterprise Use Case | Bundled Deliverables & Visualisations |\n| :--- | :--- | :--- |\n| **PKG-01: Executive Governance & Board Pack** | Formal board and investor governance. Focuses on fiduciary compliance, statutory decisions, and high-level risk exposure. | `OUT-01 (Executive Briefing), OUT-02 (Decision Register), OUT-12 (Board Decision Pack), OUT-05 (Risk Log), OUT-09 (Evidence Index), VIS-08 (RAG Dashboard), VIS-05 (Risk Heatmap).` |\n| **PKG-02: Strategic Business Planning Suite** | Annual planning and corporate strategy sessions. Focuses on commercial viability, market positioning, and capital allocation. | `OUT-01 (Briefing), OUT-11 (Strategic Business Plan), OUT-02 (Decisions), OUT-03 (Action Plan), OUT-14 (Roadmap), OUT-05 (Risk Log), VIS-01 (SWOT), VIS-03 (Roadmap), Concludo Insights.` |\n| **PKG-03: Commercial & Sales Deal Closing Pack** | Enterprise sales pitches, contract negotiations, and discovery sessions. Tailored for commercial deal closing. | `OUT-13 (Commercial Investment Case), OUT-03 (Action Plan), OUT-05 (Risk Log), OUT-07 (Stakeholder Communication), OUT-06 (Opportunity Assessment), VIS-09 (Revenue Forecast), VIS-06 (Priority Matrix).` |\n| **PKG-04: Product & Engineering Delivery Suite** | Product discovery, roadmap planning, and architecture governance. Bridges business requirements and technical implementation. | `OUT-16 (Feature Specification), OUT-17 (Technical Architecture Spec), OUT-14 (Roadmap), OUT-03 (Action Plan), OUT-02 (Decisions), VIS-13 (Architecture Diagram), VIS-04 (Gantt Chart).` |\n| **PKG-05: Operational Performance & Review Suite** | Weekly operations, SLT syncs, and business unit performance reviews. Focuses on throughput and SLA accountability. | `OUT-01 (Briefing), OUT-18 (Operational Performance Review), OUT-03 (Action Plan), OUT-10 (Meeting Performance Report), VIS-08 (RAG Dashboard), VIS-06 (Priority Matrix).` |\n| **PKG-06: Transformation & Programme Delivery Pack** | Major corporate transformation, ERP implementation, and system migration programmes. | `OUT-19 (Programme Delivery Status), OUT-01 (Briefing), OUT-02 (Decisions), OUT-03 (Action Plan), OUT-05 (Risk Log), VIS-04 (Gantt Chart), VIS-02 (Timeline Map).` |\n| **PKG-07: Risk, Audit & Compliance Governance Pack** | Internal controls, cyber security reviews, and statutory regulatory compliance audits. | `OUT-20 (Enterprise Risk Audit), OUT-05 (Risk Log), OUT-02 (Decisions), OUT-03 (Action Plan), OUT-09 (Evidence Index), VIS-05 (Risk Heatmap), VIS-10 (Risk-Reward Matrix).` |\n| **PKG-08: Startup & Venture Advisory Pack** | Early-stage business planning, founder advisory, and seed capital raising. | `OUT-11 (Business Plan), OUT-13 (Investment Case), OUT-06 (Opportunities), OUT-14 (Roadmap), OUT-03 (Action Plan), VIS-01 (SWOT), VIS-09 (Revenue Forecast).` |\n
### 15.3 Packaging Architecture and Technical Assembly

The Output Package Builder executes a multi-step compilation process:
1. **Dynamic Artifact Compilation:** Each constituent output is generated via the Template Engine (Tasklet A1) and written to the `outputs` table.
2. **Unified PDF Compilation:** Generates a unified, boardroom-ready PDF document incorporating:
   - Concludo Executive Cover Page with Navy (`#16263F`) and Gold (`#E2B53C`) visual hierarchy.
   - Interactive Table of Contents with hyperlinked section bookmarks.
   - High-resolution SVG visualisations rendered inline with print-optimised pagination.
   - Standalone Meeting Performance Report and Concludo Insight Summary.
3. **Structured Machine-Readable Bundle:** Emits an authenticated JSON manifest containing raw entity arrays, decision schemas, and Five-Field action items for downstream API consumption:
   ```json
   {
     "package_id": "pkg_772a-11bc",
     "blueprint_code": "PKG-02",
     "title": "Concludo FY27 Strategic Planning Suite",
     "created_at": "2026-09-14T11:45:00+10:00",
     "artifacts": [
       {"output_id": "out_01_briefing", "type": "OUT-01", "format": "markdown"},
       {"output_id": "out_11_busplan", "type": "OUT-11", "format": "markdown"},
       {"output_id": "out_02_decisions", "type": "OUT-02", "format": "json"},
       {"output_id": "out_03_actions", "type": "OUT-03", "format": "json"}
     ],
     "visuals": [
       {"visual_id": "vis_01", "type": "VIS-01", "format": "svg"},
       {"visual_id": "vis_03", "type": "VIS-03", "format": "svg"}
     ],
     "pdf_bundle_url": "https://dikthezsghsssnwtctem.supabase.co/storage/v1/object/authenticated/exports/pkg_772a-11bc.pdf"
   }
   ```


---

# SECTION 16: KNOWLEDGE GRAPH INTEGRATION

### 16.1 Mapping Extracted Entities into the Knowledge Graph

Extracted meeting intelligence does not remain isolated in relational database rows. Every extracted entity, decision, action, risk, and opportunity is projected into the Concludo Knowledge Graph (as formally defined in Tasklet A3).

This integration transforms fragmented meeting conversations into a living, interconnected organisational brain:

```
                      CONCLUDO KNOWLEDGE GRAPH TOPOLOGY
                      
      [Project Node] 
            │
            ├──────────────(produced)─────────────> [Transcript Node]
            │                                              │
            │                                        (extracted_from)
            ▼                                              │
     [Decision Node] <──────(addresses)────── [Risk Node] <┘
            │                                      │
       (resulted_in)                          (mitigated_by)
            │                                      │
            ▼                                      ▼
     [Action Node] ───(assigned_to)───> [User Node: Sarah Jenkins]
            │
       (depends_on)
            ▼
    [Milestone Node: Q4 Pilot Launch]
```

### 16.2 Node and Relationship Creation

The pipeline maps extracted meeting artifacts to the schema in `public.knowledge_nodes` and `public.knowledge_relationships`:

1. **Transcript Node:** Represents the meeting itself, linked to participants, project, and duration.
2. **Decision Nodes:** Created with properties containing rationale, impact, and alternatives. Linked to the sponsoring `user` node via `owned_by` edges, and to the `transcript` via `extracted_from`.
3. **Action Nodes:** Created with full Five-Field parameters. Linked to the single accountable owner via `assigned_to` edges, and to precursor decisions via `resulted_in`.
4. **Risk Nodes:** Created with 5x5 severity and probability scores. Linked to affected projects via `threatens` and to mitigation actions via `mitigated_by`.
5. **Opportunity Nodes:** Created with feasibility and impact scores. Linked to strategic goals via `supports`.

### 16.3 Bidirectional Evidence Chains and Provenance

A foundational guarantee of Concludo is the **Immutable Evidence Chain**. In the Knowledge Graph, any high-level strategic recommendation can be traversed backward along directed edges directly to the raw conversational utterance that originated it:

$$\text{Executive Recommendation} \xrightarrow{\text{derived\_from}} \text{Strategic Risk} \xrightarrow{\text{extracted\_from}} \text{Decision Memory} \xrightarrow{\text{anchored\_in}} \text{Transcript Utterance (00:32:15)}$$

This eliminates corporate hallucination and ensures that every strategic recommendation is fully defensible in board reviews and statutory audits.


---

# SECTION 17: COPILOT INTEGRATION

### 17.1 Zero Transcript Re-Processing Philosophy

In legacy meeting assistants, conversational queries force the AI to execute slow, expensive vector scans over thousands of pages of raw audio transcripts. This approach is computationally wasteful, introduces high latency, and frequently hallucinates facts from casual conversational banter.

Concludo Copilot operates on a **Zero Transcript Re-Processing Principle**:
- Copilot never reads raw meeting transcripts to answer user questions.
- Copilot queries structured intelligence, verified Decision Memory, the Five-Field Action Tracker, and the Knowledge Graph directly.
- By querying pre-computed, verified business entities, Copilot achieves sub-150ms response latency, deterministic accuracy, and zero token waste.

```
                           CONCLUDO COPILOT RETRIEVAL FLOW
                           
  [User Prompt: "What did we decide regarding database architecture for Q4?"]
                               │
                               ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 1. Natural Language Intent & Entity Parser                             │
  │ Resolves intent to 'query_decision', topic 'database architecture',    │
  │ temporal scope 'Q4 FY26', project 'Concludo Workspace'.                │
  └────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 2. Scoped Relational & Knowledge Graph Traversal                       │
  │ Direct SQL query into decision_memory WHERE project_id = $id AND       │
  │ 'database' ILIKE ANY(keywords) AND status = 'active'.                  │
  │ 1-hop traversal across knowledge_relationships to find owner & actions.│
  └────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 3. Dynamic Structured Context Assembly                                 │
  │ Injects exact Decision Schema, Rationale, Sponsoring Executive, and    │
  │ downstream Action Items into the LLM prompt context window.            │
  └────────────────────────────┬───────────────────────────────────────────┘
                               │
                               ▼
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 4. Deterministic Grounded Response Synthesis                           │
  │ Returns exact resolution, rationale, discarded alternatives, and       │
  │ interactive citation chips linking to Decision Memory.                 │
  └────────────────────────────────────────────────────────────────────────┘
```

### 17.2 Copilot Consumption of Meeting Intelligence Domains

Concludo Copilot directly consumes six pre-computed intelligence domains:

1. **Decision Memory Consumption:** Instantly retrieves historical resolutions, who sponsored them, what alternatives were discarded, and whether any decision was subsequently superseded.
2. **Action Tracker Consumption:** Interrogates action item status, flags tasks that have breached their checkpoint date, and reports on individual owner accountability.
3. **Risk & Opportunity Feeds:** Answers questions regarding corporate exposure, providing top risks across all nine risk categories and prioritising commercial opportunities.
4. **Meeting Health Diagnostics:** Explains team meeting effectiveness, identifies chronic time-wasting patterns, and provides coaching on how to raise Meeting Health Scores.
5. **Concludo Insight Consumption:** Surfaces unvoiced blind spots, unchallenged assumptions, and missing strategic discussions across past meetings.
6. **Knowledge Graph Subgraph Exploration:** Traverses complex corporate dependencies (e.g., "Show me every project dependent on Sarah's database migration decision").

### 17.3 Interactive Citation Chips and Grounding

Copilot responses provide clickable citation chips in the UI:
- `[Decision: Supabase Enterprise Sydney]`
- `[Action: Marcus Vance / SOC 2 Audit]`
- `[Risk: Connection Pool Saturation]`

Clicking a chip navigates the user directly to the authoritative database record, providing full provenance without exposing the user to confusing transcript logs.


---

# SECTION 18: AI AGENT INTEGRATION

### 18.1 Autonomous Agent Ecosystem Overview

Concludo Workspace supports a governed ecosystem of specialized autonomous AI Agents (defined in Tasklet A2 and A3). Unlike ad-hoc chatbots, these agents execute complex multi-step corporate workflows, such as updating project management boards, synchronising enterprise CRMs, compiling weekly executive briefings, and monitoring critical project risks.

The Meeting Intelligence Pipeline serves as the primary intelligence ingestion engine for all AI agents:

```
                      AI AGENT CONSUMPTION PIPELINE
                      
           [Meeting Intelligence Pipeline Completion]
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │ Event Dispatcher: 'meeting.intelligence.published'      │
  │ Broadcasts strongly-typed JSON payload to active agents. │
  └────────────┬───────────────────────────────┬────────────┘
               │                               │
               ▼                               ▼
  ┌─────────────────────────┐     ┌─────────────────────────┐
  │ Delivery & Action Agent │     │ Risk & Compliance Agent │
  │ Reads Action Tracker;   │     │ Reads Risk Log; audits  │
  │ syncs Five-Field tasks  │     │ severity; checks audit  │
  │ to Microsoft Planner.   │     │ trail; alerts Director. │
  └────────────┬────────────┘     └────────────┬────────────┘
               │                               │
               ▼                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │ MANDATORY HUMAN APPROVAL GATE (workflow_approvals)      │
  │ External changes remain staged until Anthony Cortez or  │
  │ an authorized executive clicks 'Approve'.               │
  └─────────────────────────────────────────────────────────┘
```

### 18.2 Agent Consumption Without Transcript Ingestion

Autonomous agents are strictly prohibited from parsing raw audio or unstructured text transcripts. Re-parsing raw dialogue introduces non-deterministic execution, high token cost, and potential security boundary violations.

Instead, agents consume pre-structured intelligence artifacts:
- **Delivery Agent:** Ingests the `action_tracker` payload, extracting tasks that adhere to the Five-Field Delegation Standard. It stages two-way synchronization with external issue trackers (Jira, Microsoft Planner, Asana).
- **Executive Governance Agent:** Ingests `decision_memory` records to update the organisational charter and append resolutions to the corporate ledger.
- **Risk Mitigation Agent:** Monopolises `generated_intelligence` risk records, monitoring whether identified high-severity risks have assigned mitigation owners and active checkpoints.
- **Strategic Health Agent:** Ingests the 10-dimension Meeting Health Scorecard, updating the digital twin organisation model and adjusting the company's Action Drift Index (ADI).

### 18.3 The Mandatory Human Approval Control Model

In strict accordance with Concludo governance principles:
- **No Unrestricted Autonomous Execution:** AI agents cannot independently alter external production systems, issue contractual emails, or commit corporate funds without explicit human sign-off.
- **The Staged Execution Protocol:** All agent actions that touch external environments or create legally binding records are stored in `workflow_approvals` with `status = 'pending'`.
- **Executive Notification:** An authorized human manager receives an interactive approval card in Concludo Workspace with exact before-and-after diffs, enabling one-click approval, modification, or rejection.


---

# SECTION 19: ENTERPRISE CONSIDERATIONS

### 19.1 Performance and Latency Requirements

The Meeting Intelligence Pipeline is engineered for enterprise-grade throughput and predictable processing latency:

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    PIPELINE PERFORMANCE SERVICE LEVELS                │
 ├────────────────────────────┬────────────────────┬──────────────────────┤
 │ Transcript Duration        │ Word Count Target  │ Max Processing Time  │
 ├────────────────────────────┼────────────────────┼──────────────────────┤
 │ Short Sync (15 mins)       │ Up to 2,500 words  │ Sub-15 seconds       │
 ├────────────────────────────┼────────────────────┼──────────────────────┤
 │ Standard Meeting (45 mins) │ Up to 7,500 words  │ Sub-35 seconds       │
 ├────────────────────────────┼────────────────────┼──────────────────────┤
 │ Executive Session (90 mins)│ Up to 15,000 words │ Sub-60 seconds       │
 ├────────────────────────────┼────────────────────┼──────────────────────┤
 │ Extended Workshop (4 hours)│ Up to 40,000 words │ Sub-180 seconds      │
 └────────────────────────────┴────────────────────┴──────────────────────┘
```

- **Query Latency:** Downstream Copilot queries and entity lookups must resolve in under 150ms (p95) using PostgreSQL indexing and materialized views.
- **Concurrent Throughput:** The pipeline architecture scales horizontally to process 500 concurrent enterprise transcript streams using a non-blocking queue architecture.

### 19.2 Scalability and Queue Architecture

To prevent database bottlenecks during peak business hours (e.g., Monday morning executive syncs), the pipeline utilizes a robust queueing model built on PostgreSQL:
- **Transactional Job Queue:** Jobs are enqueued into `pipeline_job_queue` and consumed by worker processes using `SELECT ... FOR UPDATE SKIP LOCKED`, guaranteeing zero contention and strict once-only execution.
- **Asynchronous Chunked Processing:** For extended sessions (over 15,000 words), transcripts are split into contextual semantic scenes, processed through classification and extraction in parallel, and merged via deterministic reconciliation.

### 19.3 Row-Level Security (RLS) and Tenant Isolation

Data isolation is enforced at the database kernel level, never in application middleware:
- Every table (`transcripts`, `outputs`, `decision_memory`, `action_tracker`, `knowledge_nodes`) enforces strict RLS policies bound to `auth.uid()`.
- Users can only access transcripts and intelligence outputs belonging to organisations or teams where they hold active membership in `organization_members` or `team_members`.
- Service-role privileges are restricted strictly to trusted background workers operating within isolated Sydney VPC instances.

### 19.4 Governance, Audit and Statutory Legal Holds

Concludo provides institutional governance controls satisfying global regulatory frameworks:
1. **Append-Only Immutable Audit Trail:** Every pipeline stage, extraction modification, and output generation emits an immutable audit event to `public.audit_logs`. Audit logs cannot be updated or deleted by any user or administrator.
2. **Statutory Legal Holds:** When a legal hold is applied to an organisation, project, or user (via `public.legal_holds`), the pipeline and automated purge workers strictly freeze all associated transcripts, decisions, and intelligence outputs. Legal holds override all standard retention policies.
3. **Data Retention and 30-Day Recovery:** Active records are retained indefinitely. Soft-deleted items enter a mandatory 30-day quarantine period (`purge_after = now() + interval '30 days'`) during which they remain fully recoverable by organisation administrators.
4. **Regulatory Standards Compliance:** Architected to satisfy the Australian Privacy Principles (APPs), the *Privacy Act 1988 (Cth)*, SOC 2 Type II controls, and ISO/IEC 27001 standards. Customer data is strictly segregated, encrypted at rest using AES-256, and never used to train external foundational AI models.


---

# SECTION 20: FUTURE VISION

### 20.1 The Evolutionary Trajectory of Concludo

The Meeting Intelligence Pipeline is not an endpoint; it is the algorithmic engine that powers Concludo's evolution across seven institutional stages:

```
                      THE SEVEN-STAGE CONCLUDO EVOLUTION
                      
  Stage 7: THE EXECUTIVE OPERATING SYSTEM
  Autonomous corporate nervous system coordinating strategy, capital, & execution.
                               ▲
  Stage 6: STRATEGIC INTELLIGENCE PLATFORM
  Predictive organisational simulation, digital twin modeling, & scenario forecasting.
                               ▲
  Stage 5: CONVERSATIONAL COPILOT PLATFORM
  Sub-150ms executive advisory interface grounded in living corporate memory.
                               ▲
  Stage 4: ENTERPRISE KNOWLEDGE PLATFORM
  Graph-traversable institutional memory completely immune to personnel turnover.
                               ▲
  Stage 3: EXECUTION INTELLIGENCE PLATFORM
  Strict operational enforcement of the Five-Field Delegation Standard.
                               ▲
  Stage 2: DECISION INTELLIGENCE PLATFORM
  Immutable decision lineage tracing rationale, discarded options, & sponsors.
                               ▲
  Stage 1: MEETING INTELLIGENCE PLATFORM
  Transforming raw conversational audio into 58 structured corporate deliverables.
```

### 20.2 The Seven Operational Identities

1. **Meeting Intelligence Platform (Stage 1):** Eliminates passive, lossy summarisation by converting enterprise dialogue into 58 structured business outputs and 28 executive visualisations.
2. **Decision Intelligence Platform (Stage 2):** Solves corporate amnesia by recording not just what was decided, but *why* it was decided, what alternatives were rejected, and who sponsored the mandate.
3. **Execution Intelligence Platform (Stage 3):** Transforms verbal promises into disciplined delivery through Anthony Cortez's Five-Field Delegation Standard, eliminating task ambiguity and drift.
4. **Enterprise Knowledge Platform (Stage 4):** Connects disparate projects, teams, and meetings into an interconnected Knowledge Graph that preserves institutional wisdom across executive tenures.
5. **Conversational Copilot Platform (Stage 5):** Equips leaders with an on-demand executive advisor that answers strategic questions instantly using pre-computed, verified corporate intelligence.
6. **Strategic Intelligence Platform (Stage 6):** Leverages historical meeting data to simulate organisational capacity, predict project bottlenecks, and forecast strategic health.
7. **The Executive Operating System (Stage 7):** The ultimate destination. Concludo becomes the central nervous system of the enterprise, seamlessly translating high-level executive vision into governed, verifiable execution across every department.

---

## Technical Architecture Sign-Off and Master Verification

| Authority | Title / Role | Verification Status | Timestamp |
| :--- | :--- | :--- | :--- |
| **Anthony Cortez** | Founder & Managing Director, Concludo Pty Ltd | Architectural Approval | Mon, 14 Sep 2026 |
| **Concludo Architecture Board** | Core Systems Engineering | Verified Production Ready | Mon, 14 Sep 2026 |
| **Compliance & Governance** | Enterprise Security & Audit | RLS & APP Compliance Confirmed | Mon, 14 Sep 2026 |

```
[END OF MASTER ARCHITECTURE SPECIFICATION: CONCLUDO_MEETING_INTELLIGENCE_PIPELINE_V1]
```
