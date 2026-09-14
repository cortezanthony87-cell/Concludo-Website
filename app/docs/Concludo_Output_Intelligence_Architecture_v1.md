# Concludo Output Intelligence Architecture
## Master Operating Model and Enterprise Deliverable Specification
### Document Reference: Concludo_Output_Intelligence_Architecture_v1
### Version: 1.0 (Authoritative Engineering and Consulting Standard)
### Author: Anthony Cortez, Founder and Managing Director, Concludo Pty Ltd (Melbourne VIC)
### Foundation: Built upon A0 (Concludo Meeting Intelligence Pipeline); Integrates with A2 (Technical Architecture) and A3 (Data, Knowledge and AI Architecture)

---

## Executive Summary and Document Control

This specification establishes the authoritative architecture for the Concludo Output Intelligence System. Sitting directly upon the sixteen-stage Concludo Meeting Intelligence Pipeline (Tasklet A0), this document defines how structured meeting intelligence is synthesised, formatted, visualised, and packaged into premium business deliverables.

Nothing in Concludo generates outputs directly from an unstructured meeting transcript. Every conversational interaction must first traverse the intake, classification, extraction, risk, opportunity, and health scoring stages of the Meeting Intelligence Pipeline. Once structured intelligence records exist within the relational database and knowledge graph, the Output Intelligence System activates to determine what business artefacts should exist, what visual models must be rendered, what strategic gaps must be articulated, and how the resulting deliverable suite must be styled.

Generic artificial intelligence tools produce shallow conversational summaries that fail executive standards. They provide passive lists of topics discussed, omitting commercial impact, governance accountability, strategic blind spots, and defensible action lineages. Concludo rejects conversational summarisation as a final product. Instead, Concludo applies a rigorous consulting-grade standard modelled upon global tier-one management consultancies (McKinsey, BCG, Bain, Deloitte, PwC, KPMG, and Accenture). Every Concludo deliverable is structured to be immediately decidable, sendable to external stakeholders, intellectually honest regarding unrecorded facts, and fully traceable back to primary conversational evidence.

This architecture governs the end-to-end lifecycle of fifty-eight distinct business deliverables, twenty-eight executive visualisation models, nineteen comprehensive document templates, eight strategic insight channels, ten recommendation categories, and a dedicated four-dimensional deliverable quality scoring engine.

```
====================================================================================================
                        CONCLUDO MASTER ARCHITECTURAL HIERARCHY
====================================================================================================

      TASKLET A0: MEETING INTELLIGENCE PIPELINE (Operating Engine)
      [Raw Audio / Transcript] -> [Ingest] -> [Classification (50 Types)] -> [Entity / Intent]
                               -> [Decisions] -> [Actions (5-Field)] -> [Risks] -> [Opportunities]
                               -> [Meeting Health (10 Dim)] -> [Structured JSON Payload]
                                                        |
                                                        v
      TASKLET A1: OUTPUT INTELLIGENCE ARCHITECTURE (Deliverable Specification - This Document)
      [Intelligence Payload]   -> [Output Selection (50 Mappings)] -> [Document Templates (T1-T19)]
                               -> [Visualisation Selection (VIS-01 to VIS-28)]
                               -> [Concludo Insight Engine] -> [Concludo Recommendation Engine]
                               -> [Deliverable Quality Scoring] -> [Premium Output Packages]
                                                        |
                         +------------------------------+------------------------------+
                         |                                                             |
                         v                                                             v
      TASKLET A2: TECHNICAL ARCHITECTURE                            TASKLET A3: DATA, KNOWLEDGE & AI
      (Engineering & Runtime Infrastructure)                        (Relational & Cognitive Substrate)
      - React 19 Frontend & Design Tokens                           - PostgreSQL Schema (42 Tables)
      - Vite / Node.js Engine Middleware                            - Knowledge Graph (14 Node / 15 Edge)
      - SVG / Canvas / PDF Rendering Engines                        - Decision & Action Memory Lineage
      - Webhook, Planner & Slack Integrations                       - Hybrid RAG & Copilot Retrieval
      - Transactional Queue & Job Workers                           - Statutory Legal Hold & Governance
====================================================================================================
```

### Document Metadata and Control

| Attribute | Specification |
| :--- | :--- |
| **Document Identifier** | `DOC-ARCH-A1-OUTINTEL-V1` |
| **Classification** | Concludo Intellectual Property, Commercial-in-Confidence |
| **Operating Jurisdiction** | Australia (Federal Law and Corporations Act 2001 Cth) |
| **Governing Entity** | Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898, Melbourne VIC) |
| **Language Standard** | Australian English strictly enforced across all narrative and templates |
| **Punctuation Rules** | Zero em dashes and zero en dashes sitewide; spaced hyphens or parentheses utilised |
| **Visual Palette** | Concludo Navy (`#16263F`), Slate Navy (`#21395C`), Accent Gold (`#E2B53C`), Light Canvas (`#F4F6FA`) |
| **Typography Standards** | Poppins (Headings, Display, Metric Callouts), Inter (Body Narrative, Tables, Metadata) |
| **Downstream Targets** | Concludo Workspace SaaS (`app.concludo.com`), Supabase DB (`dikthezsghsssnwtctem`) |

---

## SECTION 1: CONCLUDO OUTPUT PHILOSOPHY

### 1.1 Why AI-Generated Summaries Are Insufficient

In enterprise environments, the standard output of transcription tools is an artificial intelligence summary. Modern collaboration platforms record audio, run automated speech-to-text diarisation, and prompt a large language model to produce a condensed version of what was said. These summaries are universally promoted as productivity enhancements. In actual practice, they represent a profound failure of executive utility.

AI-generated summaries fail in executive environments because:

1. **They Lack Structural Decision Architecture:** Summaries treat conversational assertions with equal weight. An offhand speculative comment by a junior attendee receives the same bullet point status as a formal strategic determination by the Chief Executive Officer.
2. **They Fail the Delegation Accountability Standard:** When an action item is summarised as "The team will look into vendor contracts," it is operationally worthless. It lacks a single named individual, an explicit calendar deadline, a verifiable Definition of Done (DoD), and an agreed checkpoint milestone.
3. **They Ignore Governance and Fiduciary Lineage:** When a board or steering committee resolves a multi-million-dollar expenditure, a summary notes "Budget was approved." It fails to capture the discarded alternative options, the dissenting perspectives, the financial exposure thresholds, or the risk mitigation prerequisites.
4. **They Create Cognitive Fatigue Rather Than Decision Velocity:** An executive reading a five-page bulleted summary must spend fifteen minutes parsing text, mentally extracting commitments, evaluating risk exposures, and drafting follow-up emails. The tool has not eliminated work; it has merely transformed auditory noise into textual noise.

### 1.2 The Transformational Shift: Transcript to Intelligence to Outputs

Concludo is built upon a fundamental architectural axiom: **No deliverable is ever generated directly from an unstructured transcript.**

```
====================================================================================================
                      THE ENTERPRISE VALUE MULTIPLIER PIPELINE
====================================================================================================

  THE FLAWED INDUSTRY MODEL:
  [Raw Audio / Transcript] ───────────────────> [Generic LLM Summary] ───> Passive Text (Zero Value)

  THE CONCLUDO INTELLIGENCE PIPELINE:
  [Raw Audio / Transcript]
            │
            ▼ (Tasklet A0 Pipeline)
  [Structured Business Intelligence]
    ├── Meeting Classification & Intent
    ├── Verified Entities & Stakeholder Roles
    ├── Defensible Decision Memory Records
    ├── 5-Field Action Tracker Commitments
    ├── Quantified 5x5 Risk Registers & Mitigation Owners
    ├── Scored Commercial Opportunities & Investment Cases
    └── 10-Dimension Meeting Health Scores (0-100)
            │
            ▼ (Tasklet A1 Output Intelligence System)
  [Executive Business Deliverables]
    ├── Executive Briefings & Board Decks (McKinsey / BCG Quality)
    ├── End-to-End Business Plans & Investment Proposals
    ├── Transformation Roadmaps & Operating Models
    ├── Comprehensive Document Generation (T1 to T19)
    ├── High-Impact Executive Visualisations (VIS-01 to VIS-28)
    └── Unspoken Strategic Intelligence (Concludo Insight & Recommendation Engines)
====================================================================================================
```

Transforming conversational data into structured intelligence before generating deliverables achieves three critical enterprise outcomes:
- **Idempotency and Consistency:** Different downstream deliverables (a Board Brief, a Project RAG Dashboard, and an Operational Action Plan) can be generated from the exact same validated intelligence records without factual drift or divergent numbers.
- **Computational Efficiency:** The compute-heavy extraction and verification stages run exactly once per transcript. Subsequent outputs, queries, Copilot interactions, and Agent executions query structured database records rather than re-ingesting massive conversational context windows.
- **Auditable Provenance:** Every claim, figure, deadline, and risk assertion in an executive deliverable points to a cryptographic database record anchored to verbatim primary transcript utterances.

### 1.3 The Four Pillars of Organisational Intelligence

Concludo organises business operations across four continuous intelligence horizons:

#### Pillar 1: Meeting Intelligence
Captures the factual reality of collaborative exchanges. It answers: Who spoke? What was the true business intent? Was time used efficiently? Did dialogue reflect psychological safety and balanced engagement? Did the session produce clear outcomes or conclude in unresolved ambiguity?

#### Pillar 2: Decision Intelligence
Transforms transient consensus into permanent institutional memory. It records what was decided, the explicit rationale, the financial and operational boundaries, the discarded alternatives, the formal owner, and the review milestones. It prevents retrospective revisionism and eliminates the corporate phenomenon of re-litigating settled decisions.

#### Pillar 3: Execution Intelligence
Enforces operational accountability through the Five-Field Delegation Standard. It eliminates ambiguous task lists by ensuring every operational commitment has exactly one owner, an unambiguous Definition of Done, a firm calendar due date, and an interim checkpoint date.

#### Pillar 4: Strategic Intelligence
Identifies longitudinal trajectory, systemic blind spots, cross-functional dependencies, and strategic health trends. It analyses what was unspoken, evaluates strategic alignment across disparate business units, and provides executive leadership with predictive risk and opportunity forecasting.

### 1.4 Comparative Market Positioning

| Feature / Capability | Generic LLM Outputs and Summarisers | Collaboration Recaps (Teams Recap / Zoom AI Companion) | Transcription Platforms (Otter / Fireflies) | Concludo Workspace SaaS |
| :--- | :--- | :--- | :--- | :--- |
| **Core Architecture** | Prompt-to-text transformation | Simple agenda bulleting and chat summarisation | Speech-to-text keyword indexing and search | Multi-stage intelligence pipeline and relational graph |
| **Output Philosophy** | Single passive narrative summary | Short chat recap with crude automated bullets | Transcript search with automated action snippet tags | Complete consulting-grade deliverable suites |
| **Quality Standard** | Conversational prose with frequent hallucination | Surface-level meeting notes | Unvalidated task extractions | Tier-one consulting firm (McKinsey, BCG, Bain) parity |
| **Accountability Model** | Unassigned bullet points | Generic task assignments | Basic task tagging without operational criteria | Mandatory Five-Field Delegation Standard |
| **Decision Tracking** | Embedded in narrative | Untracked or brief bullet | Basic highlight filter | Formal Decision Memory with rationale and boundaries |
| **Unspoken Analysis** | Completely absent | Completely absent | Sentiment scoring only | Concludo Insight Engine (Blind spots and weak assumptions) |
| **Visual Frameworks** | None (pure Markdown text) | None | Audio waveform only | 28 automated executive visualisation models |
| **Deliverable Depth** | Single document output | Chat message snippet | Downloadable text or PDF transcript | 58 specialised outputs and 19 master templates |
| **Data Governance** | Uncontrolled prompt forwarding | Proprietary ecosystem lock-in | Public multi-tenant cloud storage | Sovereign Australian storage, strict RLS, legal holds |

### 1.5 The Concludo Intelligence Principle

Every business deliverable compiled by Concludo must satisfy the Concludo Intelligence Principle. It must answer six fundamental executive questions:

1. **What happened?** (Factual, objective, non-editorialised synthesis of the collaborative interaction).
2. **Why it matters?** (Why does it matter - Commercial, operational, regulatory, and strategic significance of the discussion). (Commercial, operational, regulatory, and strategic significance of the discussion).
3. **What should happen next?** (The optimal, prioritised forward path based on verified commitments).
4. **What risks exist?** (Explicit and latent threats across strategic, financial, operational, and delivery domains).
5. **What opportunities exist?** (Commercial upside, process efficiencies, market openings, and innovation avenues).
6. **What actions should be taken?** (Unambiguous delegation packages adhering to the Five-Field Standard).

Outputs that merely state what was said without addressing commercial significance and forward trajectory are discarded by the Output Quality Scoring Engine as non-compliant.

### 1.6 The Four Quality Bars

To ensure that Concludo deliverables consistently achieve parity with tier-one global consulting firms, every generated artefact must pass four uncompromising quality bars:

```
====================================================================================================
                              THE FOUR CONCLUDO QUALITY BARS
====================================================================================================

  [1. DECIDABLE]    ──> Contains complete context, financials, risks, and trade-offs so an
                        executive can make an immediate go/no-go determination without follow-up.

  [2. SENDABLE]     ──> Polished, branded, professionally formatted, and executive-ready so it
                        can be forwarded directly to a Board, Client, or Regulator without editing.

  [3. HONEST]       ──> Strictly obeys the Stated Omission Standard; explicitly labels unrecorded
                        data or missing discussions rather than inventing plausible assumptions.

  [4. TRACEABLE]    ──> Every finding, metric, risk, and decision links directly to an immutable
                        primary evidence record anchored to timestamped conversational dialogue.
====================================================================================================
```

### 1.7 The Eight Context Variables (CV-1 to CV-8)

Outputs are dynamically modulated based on eight contextual parameters extracted during the Meeting Intelligence Pipeline:

- **CV-1: Meeting Classification:** The primary taxonomy category (from M-01 to M-50) determining baseline deliverable suites.
- **CV-2: Business Intent:** The strategic purpose of the session (e.g., Acquire Business, Launch Product, Resolve Crisis).
- **CV-3: Strategic Importance (1 to 10):** The organisational gravity of the session, dictating executive summary depth and oversight level.
- **CV-4: Inherent Risk Level (1 to 10):** The exposure profile, dictating whether deep 5x5 risk heatmaps and mitigation registers are required.
- **CV-5: Audience Hierarchy:** The target consumer level (Board of Directors, Executive C-Suite, Delivery Team, External Client).
- **CV-6: Commercial / Financial Stakes:** The quantitative capital allocation or contract value discussed in the session.
- **CV-7: Governance Rigour:** The statutory, regulatory, or audit requirements governing the meeting type.
- **CV-8: Relational Context:** The historical lineage of the project, including prior decisions, open actions, and active legal holds.

---

## SECTION 2: OUTPUT MATURITY MODEL

The Concludo Output Maturity Model defines the progression of business value from basic transcription to strategic executive guidance. Concludo enforces Level 4 as the minimum acceptable baseline for all production deliverables.

```
====================================================================================================
                            THE CONCLUDO OUTPUT MATURITY MODEL
====================================================================================================

  Level 6: Executive Operating Guidance (Predictive trajectories, autonomous workflows, board packs)
     ▲
  Level 5: Strategic Intelligence (Cross-meeting synthesis, unstated assumptions, blind spot audit)
     ▲
  Level 4: Business Deliverables (Structured business plans, roadmaps, risk registers, T1-T19 templates)
     ▲  <--- [CONCLUDO MINIMUM PRODUCTION BASELINE]
  Level 3: Summary + Decisions + Risks (Decision logs, 5x5 risk registers, basic accountability)
     ▲
  Level 2: Summary + Actions (Basic action lists, unverified task assignments)
     ▲
  Level 1: Summary (Passive narrative text, conversational bullet points)
====================================================================================================
```

### 2.1 Detailed Level Characteristics and Enterprise Value Progression

#### Level 1: Summary
- **Description:** Basic conversational synopsis produced by first-generation artificial intelligence tools.
- **Content:** Paragraph summaries and chronological bullet points detailing what was discussed.
- **Enterprise Deficiencies:** Zero decision tracking, no structured action accountability, high risk of hallucination, no commercial insight.
- **Concludo Position:** Rejected as unacceptable for enterprise deployment.

#### Level 2: Summary + Actions
- **Description:** Conversational summary supplemented by extracted task bullet points.
- **Content:** General task descriptions with loosely assigned names.
- **Enterprise Deficiencies:** Tasks lack verifiable Definitions of Done and checkpoint dates. Accountability diffuses into collective failure.
- **Concludo Position:** Sub-standard. Concludo elevates every action to the Five-Field Delegation Standard.

#### Level 3: Summary + Decisions + Risks
- **Description:** Structured record capturing what was said, what was decided, and what immediate threats were raised.
- **Content:** Segmented sections for dialogue synthesis, decision logs, and an initial risk register.
- **Enterprise Deficiencies:** Isolated to a single meeting session. Fails to generate comprehensive commercial artefacts or forward-looking strategy.
- **Concludo Position:** Acceptable only as an intermediate data transfer stage within the internal pipeline.

#### Level 4: Business Deliverables (Concludo Minimum Baseline)
- **Description:** Transformation of structured intelligence into complete, polished, stand-alone business artefacts.
- **Content:** Formal Business Plans, Transformation Roadmaps, 5x5 Risk Registers, Decision Memory Packs, and Five-Field Action Plans.
- **Enterprise Value:** Deliverables are immediately usable by operational teams and project managers without supplementary drafting.
- **Concludo Standard:** Mandatory minimum tier for all Concludo Workspace outputs.

#### Level 5: Strategic Intelligence
- **Description:** Advanced consulting-grade analysis identifying what was unsaid, latent organisational threats, and systemic opportunities.
- **Content:** Concludo Insights detailing weak assumptions, planning gaps, governance vulnerabilities, and longitudinal trend analyses.
- **Enterprise Value:** Provides management teams with an objective third-party audit of their operational and strategic assumptions.
- **Concludo Standard:** Default output level for Pro, Team, and Enterprise tier workspace subscriptions.

#### Level 6: Executive Operating Guidance
- **Description:** The pinnacle of organisational intelligence. Integrates real-time meeting outputs with the enterprise knowledge graph, predictive risk modelling, and digital twin organisation simulations.
- **Content:** C-Suite Executive Briefings, Board Strategy Packs, dynamic resource reallocation recommendations, and automated workflow triggers.
- **Enterprise Value:** Operates as an automated Chief of Staff and strategic advisor to the executive leadership team.
- **Concludo Standard:** Exclusive capability for Enterprise and Administration tiers.

### 2.2 Transition Hurdles Between Levels

Ascending between maturity levels requires rigorous architectural gates:
- **Level 3 to Level 4 Gate:** Requires successful validation against the Data Sufficiency Gate and strict application of the 19 master document templates.
- **Level 4 to Level 5 Gate:** Requires activation of the Concludo Insight Engine, executing multi-dimensional divergence checks against corporate memory.
- **Level 5 to Level 6 Gate:** Requires integration with the enterprise knowledge graph, multi-meeting longitudinal correlation, and executive confidence scoring.

---

## SECTION 3: OUTPUT CATEGORIES

Concludo categorises its fifty-eight master deliverables across twelve functional enterprise domains:

### 3.1 Category 1: Meeting Outputs (Operational Spine)
The primary operational record of the collaborative session. Includes the Universal Meeting Report (`OUT-01`), Executive Summary Briefing (`OUT-02`), and Meeting Performance Report (`OUT-10`). Provides objective documentation of discussions, attendee contributions, and session dynamics.

### 3.2 Category 2: Decision Outputs (Governance Lineage)
Dedicated records capturing the authoritative choices of leadership. Includes the Comprehensive Decision Pack (`OUT-04`), Decision Lineage Register (`OUT-23`), and Corporate Resolution Memorandum (`OUT-24`). Focuses on rationale, rejected alternatives, financial limits, and review milestones.

### 3.3 Category 3: Action Outputs (Execution Rigour)
Operational accountability artefacts enforcing execution. Includes the Master Action Tracker (`OUT-03`), Sprint Commitment Register (`OUT-25`), and Critical Path Task Schedule (`OUT-26`). Every record strictly complies with the Five-Field Delegation Standard.

### 3.4 Category 4: Strategic Outputs (Direction and Trajectory)
High-level architectural artefacts defining long-term corporate path. Includes the Strategic Direction Brief (`OUT-07`), Corporate Strategy Paper (`OUT-27`), Market Expansion Strategy (`OUT-28`), and Competitive Positioning Blueprint (`OUT-29`).

### 3.5 Category 5: Business Outputs (Commercial Architecture)
Commercial and economic documentation. Includes the Full Commercial Business Plan (`OUT-11`), Commercial Business Case (`OUT-13`), Financial Assumptions and Forecast Model (`OUT-30`), and Revenue Model Architecture (`OUT-31`).

### 3.6 Category 6: Leadership Outputs (Organisational Alignment)
Artefacts designed to align executive teams and communicate strategic intent. Includes the Leadership Alignment Briefing (`OUT-08`), Executive Follow-Up Memorandum (`OUT-09`), and Organisational Change Readiness Plan (`OUT-32`).

### 3.7 Category 7: Governance Outputs (Fiduciary Control)
Formal compliance, audit, and oversight documentation. Includes the Formal Board Pack (`OUT-12`), Fiduciary Governance Briefing (`OUT-33`), Audit Committee Evidence Dossier (`OUT-34`), and Regulatory Compliance Report (`OUT-35`).

### 3.8 Category 8: Risk Outputs (Downside Protection)
Comprehensive threat assessment and exposure mitigation. Includes the Enterprise Risk Register (`OUT-05`), 5x5 Risk Heatmap Assessment (`OUT-36`), Risk Mitigation Action Plan (`OUT-37`), and Supply Chain and Vendor Vulnerability Audit (`OUT-38`).

### 3.9 Category 9: Opportunity Outputs (Commercial Upside)
Systematic identification and capture of commercial potential. Includes the Commercial Opportunity Assessment (`OUT-06`), Operational Efficiency Blueprint (`OUT-39`), Partnership Evaluation Paper (`OUT-40`), and Innovation Pipeline Brief (`OUT-41`).

### 3.10 Category 10: Executive Outputs (C-Suite Synthesis)
Condensed, high-impact intelligence designed for rapid executive consumption. Includes the CEO Executive Briefing (`OUT-14`), C-Suite Strategic Decision Pack (`OUT-42`), and Portfolio Performance Scorecard (`OUT-43`).

### 3.11 Category 11: Board Outputs (Director Level)
Formal governance artefacts prepared for company directors. Includes the Board Strategic Committee Memorandum (`OUT-44`), Quarterly Board Governance Pack (`OUT-45`), and Director Fiduciary Disclosure Document (`OUT-46`).

### 3.12 Category 12: Enterprise Outputs (Portfolio and Ecosystem)
Cross-functional, multi-programme architectural artefacts. Includes the Transformation Programme Roadmap (`OUT-15`), Target Operating Model (`OUT-17`), Enterprise Architecture Transition Plan (`OUT-47`), and Post-Merger Integration Playbook (`OUT-48`).

---



## SECTION 4: OUTPUT SELECTION FRAMEWORK

### 4.1 Selection Logic and Business Rules (Built on A0 Classifications)

The Concludo Output Selection Framework is grounded directly in the foundational Tasklet A0 classifications (covering 50 distinct meeting types from M-01 to M-50). It establishes comprehensive 50+ mappings that evaluate meeting metadata, detected business intent, attendee hierarchy, and the eight context variables (CV-1 to CV-8) to determine what outputs should be created.

Key meeting archetype selection exemplars include:
- **Business Planning Meeting:** Generates Business Plan, Strategic Roadmap, SWOT Analysis, Risk Register, Action Plan, and Executive Summary.
- **Startup Planning Meeting:** Generates Business Model Canvas, Market Assessment, Financial Assumptions, Launch Plan, and Investment Readiness Review.
- **Program Governance Meeting:** Generates Program Report, RAG Dashboard, Risk Register, Decision Log, and Action Tracker.
- **Executive Strategy Session:** Generates Strategy Brief, Decision Pack, Strategic Roadmap, Priority Matrix, Risk Assessment, and Opportunity Assessment.


The Output Selection Framework operates as an intelligent rules-based engine that evaluates the meeting metadata, classification (M-01 to M-50 from Tasklet A0), detected intent, and audience context to compile a tailored suite of deliverables.

```
====================================================================================================
                        DYNAMIC DELIVERABLE SELECTION FLOW
====================================================================================================
  [A0 Meeting Classification (M-01 to M-50)]
                    │
                    ▼
  [Intent & Context Evaluation (CV-1 to CV-8)]
                    │
                    ▼
  [Data Sufficiency Gate] ──(Insufficient)──> [Stated Omission Stubs & Warning Flags]
                    │ (Sufficient)
                    ▼
  [Core Spine Compilation] ───> OUT-01, OUT-02, OUT-03, OUT-04 (Mandatory Baseline)
                    │
                    ▼
  [Domain Deliverable Selection] ───> Specific Catalogue Deliverables (OUT-11 to OUT-58)
                    │
                    ▼
  [Visualisation Mapping] ───> Matching Visual Models (VIS-01 to VIS-28)
                    │
                    ▼
  [Executive Packaging] ───> Coordinated Deliverable Bundle (T1 to T19 Templates)
====================================================================================================
```

### 4.2 Comprehensive 50-Meeting Type Output Selection Matrix

Below is the authoritative mapping connecting all fifty meeting classifications established in Tasklet A0 to their primary business deliverables, secondary deliverables, and mandatory visual models.

| Code | Meeting Type Name | Primary Deliverables (Mandatory) | Secondary Deliverables (Conditional) | Mandatory Visualisations |
| :--- | :--- | :--- | :--- | :--- |
| **M-01** | Executive Strategy Session | OUT-02, OUT-07, OUT-14, OUT-04 | OUT-05, OUT-06, OUT-27 | VIS-02, VIS-06, VIS-07, VIS-19 |
| **M-02** | Board of Directors Meeting | OUT-02, OUT-12, OUT-04, OUT-33 | OUT-05, OUT-44, OUT-46 | VIS-01, VIS-03, VIS-13, VIS-23 |
| **M-03** | Strategic Advisory Board | OUT-02, OUT-07, OUT-06, OUT-27 | OUT-14, OUT-40, OUT-41 | VIS-07, VIS-10, VIS-12, VIS-28 |
| **M-04** | Senior Leadership Meeting | OUT-02, OUT-08, OUT-03, OUT-04 | OUT-05, OUT-09, OUT-32 | VIS-01, VIS-02, VIS-04, VIS-11 |
| **M-05** | Quarterly Business Review | OUT-02, OUT-18, OUT-03, OUT-05 | OUT-06, OUT-30, OUT-43 | VIS-01, VIS-13, VIS-16, VIS-18 |
| **M-06** | Annual Operating Planning | OUT-02, OUT-11, OUT-30, OUT-05 | OUT-03, OUT-07, OUT-31 | VIS-05, VIS-06, VIS-15, VIS-20 |
| **M-07** | Investment & Capital Allocation | OUT-02, OUT-13, OUT-30, OUT-04 | OUT-05, OUT-20, OUT-40 | VIS-02, VIS-15, VIS-19, VIS-20 |
| **M-08** | Governance & Fiduciary Oversight | OUT-02, OUT-33, OUT-04, OUT-35 | OUT-05, OUT-34, OUT-46 | VIS-01, VIS-03, VIS-12, VIS-23 |
| **M-09** | Enterprise Risk Workshop | OUT-02, OUT-05, OUT-36, OUT-37 | OUT-03, OUT-04, OUT-38 | VIS-01, VIS-02, VIS-03, VIS-14 |
| **M-10** | Business Planning Workshop | OUT-02, OUT-11, OUT-03, OUT-05 | OUT-06, OUT-07, OUT-30 | VIS-04, VIS-06, VIS-07, VIS-08 |
| **M-11** | Startup Strategy & Planning | OUT-02, OUT-11, OUT-21, OUT-30 | OUT-03, OUT-06, OUT-20 | VIS-06, VIS-07, VIS-08, VIS-17 |
| **M-12** | Commercial Business Case | OUT-02, OUT-13, OUT-30, OUT-04 | OUT-05, OUT-06, OUT-19 | VIS-02, VIS-15, VIS-19, VIS-20 |
| **M-13** | M&A Assessment & Due Diligence | OUT-02, OUT-13, OUT-05, OUT-30 | OUT-04, OUT-40, OUT-48 | VIS-03, VIS-09, VIS-15, VIS-28 |
| **M-14** | Commercial Deal Negotiation | OUT-02, OUT-04, OUT-03, OUT-19 | OUT-05, OUT-06, OUT-40 | VIS-02, VIS-04, VIS-19, VIS-27 |
| **M-15** | Market Expansion & Go-To-Market | OUT-02, OUT-28, OUT-06, OUT-29 | OUT-03, OUT-11, OUT-22 | VIS-04, VIS-06, VIS-07, VIS-17 |
| **M-16** | Strategic Partnership Forum | OUT-02, OUT-40, OUT-04, OUT-03 | OUT-06, OUT-07, OUT-19 | VIS-02, VIS-06, VIS-14, VIS-27 |
| **M-17** | Pricing & Monetisation Strategy | OUT-02, OUT-31, OUT-04, OUT-13 | OUT-05, OUT-06, OUT-30 | VIS-02, VIS-15, VIS-18, VIS-20 |
| **M-18** | Product Portfolio Strategy | OUT-02, OUT-07, OUT-16, OUT-04 | OUT-03, OUT-06, OUT-43 | VIS-02, VIS-06, VIS-09, VIS-10 |
| **M-19** | Product Roadmap Planning | OUT-02, OUT-16, OUT-03, OUT-04 | OUT-05, OUT-26, OUT-47 | VIS-04, VIS-05, VIS-06, VIS-14 |
| **M-20** | Product Launch Steering Committee| OUT-02, OUT-16, OUT-03, OUT-05 | OUT-04, OUT-08, OUT-22 | VIS-01, VIS-04, VIS-05, VIS-06 |
| **M-21** | Engineering Architecture Design | OUT-02, OUT-47, OUT-04, OUT-03 | OUT-05, OUT-23, OUT-26 | VIS-04, VIS-09, VIS-12, VIS-14 |
| **M-22** | Technology Modernisation | OUT-02, OUT-15, OUT-47, OUT-13 | OUT-03, OUT-05, OUT-30 | VIS-05, VIS-06, VIS-09, VIS-10 |
| **M-23** | Technical Debt & Refactoring | OUT-02, OUT-03, OUT-05, OUT-26 | OUT-04, OUT-39, OUT-47 | VIS-01, VIS-02, VIS-03, VIS-21 |
| **M-24** | Sprint Planning & Commitments | OUT-01, OUT-03, OUT-25, OUT-26 | OUT-04, OUT-05, OUT-10 | VIS-01, VIS-04, VIS-05, VIS-21 |
| **M-25** | Sprint Review & Retrospective | OUT-01, OUT-10, OUT-03, OUT-39 | OUT-04, OUT-25, OUT-49 | VIS-01, VIS-13, VIS-21, VIS-22 |
| **M-26** | Quality Engineering & Testing | OUT-01, OUT-03, OUT-05, OUT-26 | OUT-04, OUT-10, OUT-35 | VIS-01, VIS-03, VIS-13, VIS-21 |
| **M-27** | Cyber Security & Data Privacy | OUT-02, OUT-05, OUT-35, OUT-36 | OUT-03, OUT-04, OUT-38 | VIS-01, VIS-03, VIS-09, VIS-10 |
| **M-28** | Transformation Programme Review | OUT-02, OUT-15, OUT-17, OUT-05 | OUT-03, OUT-04, OUT-08 | VIS-01, VIS-05, VIS-06, VIS-14 |
| **M-29** | PMO Portfolio Governance | OUT-02, OUT-17, OUT-03, OUT-04 | OUT-05, OUT-43, OUT-50 | VIS-01, VIS-02, VIS-04, VIS-13 |
| **M-30** | Operational Excellence Workshop | OUT-02, OUT-39, OUT-03, OUT-05 | OUT-04, OUT-10, OUT-17 | VIS-01, VIS-02, VIS-03, VIS-25 |
| **M-31** | Supply Chain & Logistics Review | OUT-02, OUT-38, OUT-03, OUT-05 | OUT-04, OUT-13, OUT-39 | VIS-01, VIS-03, VIS-14, VIS-25 |
| **M-32** | Critical Incident Retrospective | OUT-02, OUT-05, OUT-03, OUT-37 | OUT-04, OUT-10, OUT-49 | VIS-03, VIS-04, VIS-25, VIS-26 |
| **M-33** | Major Crisis Response Session | OUT-02, OUT-14, OUT-03, OUT-05 | OUT-04, OUT-08, OUT-37 | VIS-01, VIS-02, VIS-03, VIS-04 |
| **M-34** | Cost Reduction & Restructuring | OUT-02, OUT-39, OUT-30, OUT-04 | OUT-03, OUT-05, OUT-32 | VIS-02, VIS-15, VIS-18, VIS-20 |
| **M-35** | Regulatory Compliance Audit | OUT-02, OUT-35, OUT-34, OUT-03 | OUT-04, OUT-05, OUT-46 | VIS-01, VIS-03, VIS-13, VIS-24 |
| **M-36** | Service Delivery Management | OUT-01, OUT-03, OUT-05, OUT-10 | OUT-02, OUT-04, OUT-39 | VIS-01, VIS-13, VIS-16, VIS-21 |
| **M-37** | Executive Succession & Talent | OUT-02, OUT-08, OUT-04, OUT-32 | OUT-03, OUT-05, OUT-51 | VIS-02, VIS-10, VIS-11, VIS-27 |
| **M-38** | Organisational Restructuring | OUT-02, OUT-17, OUT-32, OUT-04 | OUT-03, OUT-05, OUT-08 | VIS-06, VIS-11, VIS-14, VIS-25 |
| **M-39** | People & Culture Committee | OUT-02, OUT-08, OUT-10, OUT-03 | OUT-04, OUT-05, OUT-32 | VIS-01, VIS-13, VIS-16, VIS-22 |
| **M-40** | Change Management Forum | OUT-02, OUT-32, OUT-03, OUT-08 | OUT-04, OUT-05, OUT-15 | VIS-04, VIS-06, VIS-10, VIS-27 |
| **M-41** | Department Town Hall Alignment | OUT-02, OUT-08, OUT-09, OUT-03 | OUT-07, OUT-10, OUT-16 | VIS-01, VIS-04, VIS-06, VIS-13 |
| **M-42** | Leadership Development Review | OUT-02, OUT-08, OUT-03, OUT-10 | OUT-04, OUT-32, OUT-51 | VIS-10, VIS-11, VIS-22, VIS-27 |
| **M-43** | Workplace Health & Safety (WHS)| OUT-02, OUT-05, OUT-35, OUT-03 | OUT-04, OUT-36, OUT-37 | VIS-01, VIS-03, VIS-13, VIS-24 |
| **M-44** | Enterprise Client Steering Group| OUT-02, OUT-17, OUT-03, OUT-04 | OUT-05, OUT-08, OUT-09 | VIS-01, VIS-04, VIS-06, VIS-13 |
| **M-45** | Strategic Account Review (QBR) | OUT-02, OUT-18, OUT-06, OUT-03 | OUT-04, OUT-05, OUT-40 | VIS-01, VIS-13, VIS-16, VIS-27 |
| **M-46** | Sales Discovery & Commercial Fit| OUT-02, OUT-06, OUT-21, OUT-03 | OUT-05, OUT-13, OUT-19 | VIS-02, VIS-07, VIS-17, VIS-27 |
| **M-47** | Customer Onboarding Kickoff | OUT-02, OUT-03, OUT-17, OUT-05 | OUT-04, OUT-08, OUT-09 | VIS-01, VIS-04, VIS-05, VIS-25 |
| **M-48** | Customer Escalation & Resolution| OUT-02, OUT-03, OUT-05, OUT-09 | OUT-04, OUT-08, OUT-37 | VIS-01, VIS-02, VIS-03, VIS-04 |
| **M-49** | Voice of Customer Research | OUT-02, OUT-06, OUT-16, OUT-21 | OUT-03, OUT-07, OUT-29 | VIS-02, VIS-07, VIS-17, VIS-28 |
| **M-50** | Vendor Selection & Evaluation | OUT-02, OUT-19, OUT-04, OUT-05 | OUT-03, OUT-13, OUT-38 | VIS-02, VIS-10, VIS-19, VIS-28 |

---





### 4.4 The 50-Meeting Classification Taxonomy & Signal Indicators

### 2.1 What the Output Detection Engine Decides

The Output Detection Engine (Engine E1) performs automated classification over the incoming conversation record before any drafting begins. It determines the meeting category, detects primary and secondary objectives, evaluates participant profiles, and calculates modulation indices.

The output of Engine E1 is the `meeting_context` object, structured as follows:

```json
{
  "meeting_context": {
    "type_primary": "MT-A01",
    "type_secondary": null,
    "type_confidence": 0.88,
    "type_basis": ["F1_lexical_strategy_terms", "F4_executive_seniority_present", "F5_high_materiality_decisions"],
    "objective": "decide",
    "objective_confidence": 0.82,
    "participants": {
      "count": 6,
      "seniority_profile": "executive",
      "external_present": false,
      "client_present": false,
      "decision_authority_present": true,
      "role_coverage_gaps": []
    },
    "decision_profile": {
      "count": 3,
      "closure_pct": 100,
      "materiality": "significant",
      "reversibility": "costly_to_reverse"
    },
    "strategic_importance_index": 84,
    "risk_level_index": 65,
    "industry": "professional_services",
    "industry_source": "workspace_setting",
    "business_maturity": "mid_market",
    "transcript_quality": {
      "word_count": 4820,
      "speaker_label_quality": "good",
      "completeness": "complete",
      "coverage_minutes_estimated": 45
    },
    "override": {
      "by_user": false,
      "fields_overridden": []
    }
  }
}
```

### 2.2 The Five-Stage Processing Pipeline

Processing follows five sequential stages. Stages 0, 1, 3, and 4 are deterministic and computationally efficient; Stage 2 leverages structured classification models.

```
STAGE 0: PRE-FLIGHT SCREENING
Deterministic verification of record fitness, length, speaker labels, consent, and safety.
   |
   +--> (Fail) --> Divert to Degraded Processing Path (Section 2.9) or Restricted Path (Section 2.10)
   |
   v (Pass)
STAGE 1: SIGNAL EXTRACTION
Rule-based scanning across the seven core signal families (lexical, speech acts, structural, etc.).
   |
   v
STAGE 2: MEETING TAXONOMY CLASSIFICATION
Structured classification evaluating evidence weights across the 47 meeting categories.
   |
   v
STAGE 3: MODULATION INDICES COMPUTATION
Mathematical calculation of Strategic Importance (0-100) and Risk Level (0-100).
   |
   v
STAGE 4: CONFIDENCE GATING & BUNDLE SELECTION
Threshold gating determining whether to execute full typed bundle, request confirmation, or fall back to spine.
```

### 2.3 Stage 0: Pre-Flight Screening and Safety Verification

Stage 0 validates that the conversation transcript is legally and technically fit for processing:

| Pre-Flight Check | Evaluation Test | Failure Behaviour |
| :--- | :--- | :--- |
| **Fitness Test** | Transcript contains >= 150 words and >= 2 distinct speaker turns. | Reject processing. Emit user notification: "Transcript insufficient to extract reliable meeting outcomes." |
| **Language Test** | Dominant language is English (Australian, UK, US, NZ, CA). | If non-English detected, pause automated pipeline and flag for language translation support. |
| **Truncation Test** | Checks whether transcript cuts off abruptly mid-turn during critical debate. | Flag quality note: `transcript_truncated: true`. Append truncation warning to all generated headers. |
| **Speaker Label Test** | Validates presence of identifiable speaker names or persistent speaker IDs. | Set `speaker_label_quality: limited`. Suppress per-participant attribution; use neutral meeting-level passive voice. |
| **Prompt Injection Screen** | Scans for adversarial override strings (e.g., "Ignore previous instructions"). | Quarantine record. Strip hostile tokens. Log security event in immutable audit log. |
| **Consent & Sensitive Content** | Detects explicit non-recording requests, HR disciplinary, whistleblower, or legally privileged tags. | Trigger the Restricted Content Path (Section 2.10). Restrict output visibility strictly to uploader. |

### 2.4 Stage 1: The Seven Signal Families

Seven orthogonal signal families provide the empirical inputs into the classification engine:

* **F1: Lexical and Taxonomic Signals**: Specific terminology, acronyms, and vocabulary sets characteristic of specialized domains (e.g., "EBITDA", "runway", "sprint backlog", "appraisal", "settlement").
* **F2: Speech Act and Intent Signals**: Distribution of speech acts across discussion turns: directives ("Make sure X happens"), commitments ("I will deliver Y by Friday"), queries ("What are our options?"), and assertions ("The vendor is ready").
* **F3: Structural and Agenda Signals**: Explicit agenda announcements, time allocations, transition markers ("Moving to item 3"), and structured facilitation phases.
* **F4: Social and Seniority Signals**: Participant title profiles, executive presence, external client involvement, vendor dynamics, and authority relationships.
* **F5: Governance and Decision Signals**: Formal motions, voting language, consensus verification ("Do we all agree?"), policy invocations, and board committee references.
* **F6: Temporal and Horizon Signals**: Forward-looking time horizons referenced during debate: immediate (this week), near-term (this quarter), annual planning, or multi-year strategic vision.
* **F7: Quantitative and Commercial Signals**: Financial amounts, percentages, headcount volumes, commercial contract terms, delivery milestones, and whether figures represent validated data or unverified assumptions.

### 2.5 Stage 2: The Meeting Taxonomy (47 Meeting Types across 6 Families)

Concludo establishes a comprehensive taxonomy of 47 meeting categories organised into 6 distinct families. Every meeting type defines its unique inputs, discriminating signals, default objective, and expected deliverables:


#### Family A: Strategy and Direction

*High-altitude corporate direction, capital allocation, entity governance, and strategic growth initiatives.*

| ID | Meeting Type | Discriminating Signals (Inputs & Logic) | Default Objective | Expected Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **MT-A01** | Executive Strategy Session | Executive seniority present; strategic multi-year horizon dominant; direction-setting language; high materiality decisions. | `decide` | OUT-11 Decision pack, OUT-12 Risk assessment, OUT-13 Opportunity assessment, OUT-14 Ranked priorities, OUT-15 Executive dashboard, OUT-51 Leadership brief. |
| **MT-A02** | Strategy Workshop | Divergent speech act profile; active options generation; facilitation prompts; deliberately low closure by design. | `explore` | OUT-16 Strategy paper, OUT-17 Options analysis, OUT-18 Assumption register, OUT-19 Scenario outline, VIS-02 Priority matrix. |
| **MT-A03** | Business Planning | Annual or quarterly planning focus; resource and target setting; balanced mix of commercial, operational, and delivery topics. | `plan` | OUT-23 Business plan draft, OUT-20 Business Model Canvas, OUT-22 SWOT analysis, OUT-24 Revenue/cost assumptions, OUT-32 Roadmap view. |
| **MT-A04** | New Business or Startup Planning | Venture formation, product-market fit, runway, initial capitalisation, equity structure, and early go-to-market architecture. | `plan` | OUT-20 Business Model Canvas, OUT-23 Business plan draft, OUT-22 SWOT, OUT-24 Financial assumptions, OUT-26 Go-to-market outline. |
| **MT-A05** | Market Entry or Expansion Review | Geographic, segment, or channel expansion; competitive dynamics; unit economics; regulatory entry barriers. | `recommend` | OUT-21 Market opportunity review, OUT-17 Options analysis, OUT-27 Business case, OUT-12 Risk assessment. |
| **MT-A06** | Acquisition or Merger Discussion | Target valuation, due diligence, deal synergy, intellectual property evaluation, integration complexity, and transaction terms. | `explore` | OUT-11 Decision pack, OUT-27 Business case, OUT-18 Assumption register, OUT-12 Risk assessment (Restricted Path default). |
| **MT-A07** | Investment or Capital Allocation Review | CapEx proposals, investment hurdle rates, payback periods, balance sheet allocation, and project business cases. | `decide` | OUT-27 Business case, OUT-11 Decision pack, OUT-24 Cost/revenue assumptions, OUT-25 Sensitivity view. |
| **MT-A08** | Board Meeting | Formal governance procedure; quorum established; directors present; statutory oversight; approval of audited reports and major policies. | `decide` | OUT-52 Board briefing paper, OUT-53 Decision pack board grade, OUT-12 Risk assessment, OUT-15 Executive dashboard. |
| **MT-A09** | Board Subcommittee | Specialised board focus (Audit & Risk, Remuneration, Nomination); deep technical scrutiny; formal governance minutes. | `review` | OUT-52 Board briefing paper, OUT-12 Risk assessment, OUT-50 Control/compliance summary, OUT-11 Decision pack. |

#### Family B: Governance and Oversight

*Multi-tier program management, project delivery governance, risk control, compliance, and post-incident analysis.*

| ID | Meeting Type | Discriminating Signals (Inputs & Logic) | Default Objective | Expected Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **MT-B01** | Steering Committee | Cross-functional executive sponsors; program escalation resolution; budget tolerance reviews; stage-gate approvals. | `decide` | OUT-29 Status assessment RAG, OUT-31 Escalation pack, OUT-11 Decision pack, OUT-30 Dependency map. |
| **MT-B02** | Program Governance Review | Multi-project program oversight; inter-project dependencies; portfolio milestone tracking; aggregated risk exposure. | `review` | OUT-33 Program report, OUT-29 Status assessment RAG, OUT-30 Dependency map, OUT-35 Benefits tracking view. |
| **MT-B03** | Project Status Review | Single initiative progress tracking; milestone variance analysis; action burn-down; task blocker identification. | `review` | OUT-29 Status assessment RAG, OUT-32 Milestone/roadmap view, OUT-03 Action register, OUT-18 Assumption register. |
| **MT-B04** | Risk Workshop | Systematic threat identification; probability-consequence rating; mitigation strategy development; risk ownership allocation. | `diagnose` | OUT-12 Risk assessment, OUT-31 Escalation pack, VIS-03 Risk heat map, OUT-18 Assumption register. |
| **MT-B05** | Audit or Compliance Review | Formal control verification; regulatory standard adherence; finding remediation tracking; governance gap analysis. | `review` | OUT-50 Control and compliance summary, OUT-12 Risk assessment, OUT-03 Action register. |
| **MT-B06** | Incident or Post Incident Review | Post-outage or operational failure review; chronology reconstruction; root cause analysis; preventive control remediation. | `diagnose` | OUT-49 Incident timeline and root cause analysis, OUT-03 Action register, OUT-50 Compliance summary. |
| **MT-B07** | Post Implementation Review or Retrospective | Project completion reflection; what went well vs what failed; organisational memory capture; reusable capability lessons. | `learn` | OUT-46 Capability assessment, OUT-03 Action register, Lessons learned database payload. |

#### Family C: Operations and Performance

*Ongoing operational cadences, leadership coordination, departmental reviews, resourcing, and supplier performance.*

| ID | Meeting Type | Discriminating Signals (Inputs & Logic) | Default Objective | Expected Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **MT-C01** | Operational Review | Weekly or monthly department operational rhythm; KPI throughput; backlog velocity; process handoff bottlenecks. | `review` | OUT-15 Executive dashboard, OUT-29 Status assessment RAG, OUT-03 Action register, OUT-48 Process map. |
| **MT-C02** | Leadership Team Meeting | Functional executive team coordination; company pulse; cross-department alignment; immediate operational priorities. | `align` | OUT-51 Leadership brief, OUT-14 Ranked priorities, OUT-15 Executive dashboard, OUT-03 Action register. |
| **MT-C03** | Performance or KPI Review | Target vs actual variance analysis; operational metrics review; scorecard evaluations; corrective action triggers. | `review` | OUT-15 Executive dashboard, OUT-29 Status assessment RAG, OUT-03 Action register, VIS-13 KPI tiles. |
| **MT-C04** | Resourcing and Capacity Planning | Headcount requirements; skill gap analysis; workload distribution; hiring plans; delivery capacity constraints. | `plan` | OUT-36 Resource and capacity view, OUT-14 Ranked priorities, OUT-03 Action register. |
| **MT-C05** | Vendor or Supplier Review | Third-party SLA review; contract delivery performance; supplier dispute resolution; commercial rate renegotiation. | `review` | OUT-43 Commercial terms summary, OUT-29 Status assessment RAG, OUT-31 Escalation pack. |
| **MT-C06** | Budget and Forecast Review | P&L variance review; quarterly budget updates; revenue projections; cost centre burn rate monitoring. | `review` | OUT-24 Revenue/cost assumption sheet, OUT-25 Sensitivity view, OUT-15 Executive dashboard. |

#### Family D: Commercial and Client

*Revenue-generating discovery, sales proposals, account renewals, professional advisory, and client relationships.*

| ID | Meeting Type | Discriminating Signals (Inputs & Logic) | Default Objective | Expected Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **MT-D01** | Sales Discovery | Prospective client qualification; pain point identification; current state tech/process discovery; budget and timeline probing. | `diagnose` | OUT-38 Requirements summary, OUT-39 Objection/concern register, OUT-40 Proposal input brief, OUT-41 CRM payload. |
| **MT-D02** | Sales Proposal or Negotiation | Pricing and scope negotiation; contract clause redlines; executive sign-off steps; commercial closing conditions. | `negotiate` | OUT-43 Commercial terms summary, OUT-39 Objection register, OUT-41 CRM payload, OUT-11 Decision pack. |
| **MT-D03** | Client Onboarding or Kickoff | Client engagement kickoff; scope verification; delivery milestone alignment; communication protocols and team intro. | `align` | OUT-37 Client-ready meeting record, OUT-32 Milestone/roadmap view, OUT-03 Action register. |
| **MT-D04** | Client Progress or Service Review | Ongoing client service review; deliverable sign-offs; client sentiment monitoring; relationship health check. | `review` | OUT-37 Client-ready meeting record, OUT-44 Account health snapshot, OUT-03 Action register. |
| **MT-D05** | Client Advisory or Consulting Session | Strategic advisory delivery; expert recommendations; diagnostic findings presentation; transformational roadmap advice. | `recommend` | OUT-54 Recommendation paper, OUT-16 Strategy paper, OUT-37 Client-ready meeting record. |
| **MT-D06** | Renewal or Retention | Contract renewal terms; account expansion options; churn risk mitigation; pricing and tier adjustments. | `negotiate` | OUT-43 Commercial terms summary, OUT-44 Account health snapshot, OUT-41 CRM payload. |
| **MT-D07** | Complaint or Escalation | High-severity client escalation; SLA breach resolution; executive remediation commitments; retention salvage plan. | `diagnose` | OUT-31 Escalation pack, OUT-49 Incident timeline, OUT-03 Action register, OUT-37 Client record. |
| **MT-D08** | Real Estate Appraisal or Listing Presentation | Property appraisal; comparative market analysis; vendor expectations; marketing campaign recommendations. | `recommend` | OUT-38 Requirements summary, OUT-54 Recommendation paper, OUT-40 Proposal brief. |
| **MT-D09** | Real Estate Vendor Update or Price Review | Buyer inspection feedback; campaign enquiry stats; price reserve alignment; auction/private sale strategy. | `recommend` | OUT-37 Client-ready meeting record, OUT-54 Recommendation paper, OUT-41 CRM payload. |
| **MT-D10** | Real Estate Buyer Consultation | Buyer criteria qualification; borrowing capacity; property preference profile; search shortlisting. | `diagnose` | OUT-38 Requirements summary, OUT-41 CRM payload, OUT-03 Action register. |
| **MT-D11** | Partnership or Alliance Discussion | Co-marketing, integration, distribution, or joint venture alignment; shared value proposition; revenue share terms. | `explore` | OUT-16 Strategy paper, OUT-43 Commercial terms summary, OUT-11 Decision pack. |

#### Family E: Build and Change

*Product engineering, architecture design, digital transformation, organisational change, and process optimisation.*

| ID | Meeting Type | Discriminating Signals (Inputs & Logic) | Default Objective | Expected Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **MT-E01** | Product Development or Roadmap | Feature prioritisation; user feedback synthesis; sprint theme planning; product release roadmap updates. | `plan` | OUT-32 Milestone/roadmap view, OUT-14 Ranked priorities, OUT-38 Requirements summary. |
| **MT-E02** | Design or Technical Review | Architecture decision review; code/design RFCs; security and scalability trade-offs; technical debt evaluation. | `review` | OUT-11 Decision pack, OUT-17 Options analysis, OUT-18 Assumption register, OUT-30 Dependency map. |
| **MT-E03** | Marketing Planning or Campaign Review | Go-to-market campaigns; acquisition channel performance; messaging positioning; marketing collateral review. | `plan` | OUT-26 Go-to-market outline, OUT-32 Milestone view, OUT-15 Executive dashboard. |
| **MT-E04** | Transformation or Change Program Design | Operating model transformation; org restructuring; change management impact; culture and adoption roadmap. | `plan` | OUT-47 Transformation plan, OUT-45 Operating model view, OUT-30 Dependency map, OUT-12 Risk assessment. |
| **MT-E05** | Process Improvement Workshop | Value stream mapping; waste elimination; process handoff friction; standard operating procedure updates. | `diagnose` | OUT-48 Process and handoff map, OUT-46 Capability assessment, OUT-03 Action register. |
| **MT-E06** | Requirements or Scoping Workshop | System requirements elicitation; functional specification debate; edge case definition; acceptance criteria. | `explore` | OUT-38 Requirements and needs summary, OUT-18 Assumption register, OUT-11 Decision pack. |

#### Family F: People and Knowledge

*Human capital decisions, agile sprint planning, coaching, qualitative research, and unclassified conversations.*

| ID | Meeting Type | Discriminating Signals (Inputs & Logic) | Default Objective | Expected Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **MT-F01** | Hiring or Interview Panel Debrief | Candidate interview evaluation; scorecard comparison; hiring decision debate; compensation package alignment. | `decide` | OUT-56 Candidate evaluation summary, OUT-11 Decision pack (Restricted Content Path). |
| **MT-F02** | Team Planning or Sprint Planning | Agile sprint planning; task estimation; capacity allocation; sprint goal definition; backlog commitment. | `plan` | OUT-03 Action register, OUT-32 Milestone view, OUT-36 Resource capacity view. |
| **MT-F03** | Training or Coaching Session, group | Cohort learning; skills development workshop; conceptual walkthrough; practical exercise debrief. | `learn` | OUT-58 Training session summary, OUT-03 Action register, OUT-46 Capability assessment. |
| **MT-F04** | One to One or Individual Coaching | Individual professional mentoring; developmental goals; career progression; personal obstacle resolution. | `learn` | OUT-57 Coaching session record, OUT-03 Action register (Restricted Content Path). |
| **MT-F05** | Performance Conversation | Formal performance appraisal; target achievement review; feedback delivery; performance improvement plan. | `learn` | OUT-57 Coaching record, OUT-03 Action register (Restricted Content Path). |
| **MT-F06** | Interview or Research Session | Qualitative research interview; stakeholder perspective gathering; ethnographic inquiry; thematic capture. | `explore` | OUT-38 Requirements summary, OUT-18 Assumption register, OUT-16 Strategy paper. |
| **MT-F07** | Community, Association or Committee Meeting | Association governance; committee volunteer coordination; community initiative updates; public resolutions. | `decide` | OUT-02 Decision log, OUT-03 Action register, OUT-37 Meeting record. |
| **MT-F08** | General or Unclassified | General discussion lacking strong discriminating signals; ad-hoc informational exchange; baseline catch-up. | `inform` | OUT-01 to OUT-10 Deterministic Spine outputs only. |

### 2.6 Stage 3: Computing the Modulation Indices

In addition to discrete categorization, Concludo computes two continuous modulation indices (0 to 100) that govern document depth, visual elegance, and escalation triggers:

#### Strategic Importance Index (0 to 100)
Measures the institutional significance of the discussion based on four weighted components:
1. **Time Horizon Distribution (Weight: 35%)**: Proportion of forward-looking debate focused on multi-year strategic milestones vs. immediate daily operational fires.
2. **Seniority and Authority Profile (Weight: 30%)**: Presence of C-suite executives, board directors, managing partners, or statutory officers.
3. **Commitment Scale and Materiality (Weight: 20%)**: Stated monetary value, multi-quarter contractual lock-in, balance sheet allocation, or entity restructuring.
4. **Directional Pivot Signals (Weight: 15%)**: Explicit choices to alter corporate direction, sunset initiatives, enter new markets, or change core operating models.

```
Strategic Importance Formula:
Index = round( (Horizon_Score * 0.35) + (Seniority_Score * 0.30) + (Materiality_Score * 0.20) + (Pivot_Score * 0.15) )
```

* **Impact**: Scores >= 70 escalate deliverables to Executive and Board grade (activating executive briefings, decision packs, and high-fidelity visual canvases). Scores < 30 maintain crisp operational task registers.

#### Risk Level Index (0 to 100)
Evaluates organisational vulnerability across four weighted risk vectors:
1. **Raised Risk Severity (Weight: 35%)**: Consequence language and severity ratings explicitly articulated during discussion.
2. **Unmanaged Risk Load (Weight: 30%)**: Proportion of raised threats that concluded without a designated human owner or mitigation plan.
3. **Regulatory and Compliance Signals (Weight: 20%)**: Discussion touching statutory requirements, legal liability, data privacy, or safety standards.
4. **External Dependency Friction (Weight: 15%)**: Critical deliverables relying entirely on uncommitted third-party vendors or volatile partners.

```
Risk Level Formula:
Index = round( (Severity_Score * 0.35) + (Unmanaged_Score * 0.30) + (Compliance_Score * 0.20) + (Dependency_Score * 0.15) )
```

* **Impact**: Scores >= 65 make OUT-12 (Strategic Risk Assessment) and OUT-31 (Escalation Pack) mandatory deliverables regardless of the baseline scenario bundle.

### 2.7 Stage 4: Confidence Gating and Execution Paths

Engine E1 evaluates classification certainty against four rigorous confidence bands:

| Confidence Band | Range | System Behaviour |
| :--- | :--- | :--- |
| **High Confidence** | **0.80 and above** | Fully automated execution. Directly generate the complete scenario bundle (Section 3.6) and lead template. |
| **Moderate Confidence** | **0.55 to 0.79** | Generate the baseline bundle. In the UI, surface an unobtrusive classification banner: *"Categorised as [Type Name]. Change category."* Re-generation is instant if the user updates category. |
| **Low Confidence** | **0.35 to 0.54** | Fall back to the Deterministic Spine (OUT-01 to OUT-10). Display top two candidate categories as suggested upgrades with preview badges. |
| **Unclassified** | **Below 0.35** | Route to `MT-F08 (General / Unclassified)`. Deliver standard spine outputs and Meeting Performance Report. Prevent false specialization. |

### 2.8 The Continuous Learning Loop

Concludo maintains a strictly privacy-preserving, tenant-isolated learning loop:
* When a user manually overrides a meeting category or adjusts a suggested objective, the system captures the delta between extracted signal vectors and user selection.
* Overrides adjust tenant-specific classification weights over time without exposing transcript data externally.
* Workspace administrators can view aggregate classification accuracy and define workspace-level default types for recurring scheduled meetings.

### 2.9 Degraded Processing Paths

When transcripts fail technical fitness checks (e.g., poor audio transcription, severe background noise, unlabelled speakers), Concludo shifts to defined degraded paths:
* **Missing Speaker Labels**: System suppresses individual attribution. Actions are assigned to roles or marked `[Unassigned Owner]` with an explicit quality note. Health scoring suppresses Dimension D2 (Attendance Value) and Dimension D6 (Participation Quality).
* **Truncated Transcripts**: Extracted decisions and actions are generated with an explicit warning banner: *"Partial meeting record. Outputs reflect discussion up to minute [X] only."* Stated omissions indicate potential downstream uncaptured agreements.
* **Low Information Density**: If a 60-minute recording yields fewer than 300 words of substantive exchange, the system suppresses complex templates and delivers a brief 1-page memorandum.

### 2.10 Restricted Content Path and Sensitive Data Isolation

Certain conversations involve profound commercial sensitivity, regulatory protection, or personal confidentiality (e.g., MT-F01 Hiring panels, MT-F04/F05 Disciplinary/coaching reviews, whistleblower reports, M&A deal structures).

When sensitive keywords or restricted categories are detected:
1. **Access Isolation**: Deliverables are encrypted and restricted exclusively to the uploading user's personal vault. They are hidden from shared organisation activity feeds and team libraries.
2. **Suppression of Public Distribution**: Export options default to password-protected local downloads. Silent CRM writes or webhook broadcasts are permanently disabled.
3. **Restricted Retention Policy**: Records processed under the Restricted Content Path inherit a shortened retention schedule (e.g., 7 days) unless explicitly flagged for legal hold compliance under Enterprise policies.

---

### 4.3 Data Sufficiency and Gating Protocols

Outputs must never be generated on insufficient data. Concludo enforces three rigorous operational gates before compiling any catalogue deliverable:

1. **The Primary Evidence Gate:** An output requires a minimum quantum of substantiated conversational evidence. If a commercial contract value, financial projection, or technical architecture was unmentioned in the primary transcript, the system must not extrapolate.
2. **The Audience Gating Matrix:** Deliverables are calibrated strictly for their target audience hierarchy:
   - *Board of Directors:* Strategic direction, fiduciary compliance, enterprise solvency, major capital resolutions. Omit tactical minutiae.
   - *Executive Leadership (C-Suite):* Operational velocity, cross-functional dependencies, resource constraints, milestone risks.
   - *Operational Delivery Teams:* Granular Five-Field Action commitments, sprint tasks, technical dependency graphs, acceptance criteria.
   - *External Clients & Regulators:* Polished executive summaries, verified compliance milestones, contractual deliverables.
3. **The Stated Omission Standard:** When a required template section lacks primary evidence, the engine outputs an explicit, standardized notice:
   `[STATUTORY DISCLOSURE / STATED OMISSION: This section was not addressed or substantively evidenced during the collaborative session. Recommended action: Schedule dedicated discovery session with accountable lead.]`


## SECTION 5: DOCUMENT DESIGN PHILOSOPHY

### 5.1 Presentation Standards and Consulting Excellence

Concludo enforces tier-one Consulting Firm Standards and rigorous Professionalism Requirements across three distinct tiers of corporate presentation:
1. **Executive Presentation Standards:** High information density, action titles, quantified metrics, clear trade-offs, and immediate decidability tailored for C-suite leaders.
2. **Board Presentation Standards:** Fiduciary rigour, governance transparency, strategic risks, statutory disclosure compliance, and formal resolution registers tailored for company directors.
3. **Operational Presentation Standards:** Granular execution clarity, Five-Field Delegation accountability, milestone timelines, technical dependencies, and sprint commitments tailored for delivery teams.
4. **Brand Standards:** Consistent application of Concludo Navy (`#16263F`), Slate Navy (`#21395C`), Accent Gold (`#E2B53C`), Light Canvas (`#F4F6FA`), Poppins headings, Inter body typography, 100% Australian English, and zero em/en dashes.


Every deliverable generated by Concludo must reflect the visual and structural polish associated with elite management consulting firms (McKinsey, BCG, Bain, Deloitte, PwC, KPMG, and Accenture). To achieve this standard, Concludo implements the following five foundational pillars:

```
====================================================================================================
                        CONSULTING FIRM VISUAL DESIGN STANDARDS
====================================================================================================

  1. THE GOVERNING THOUGHT (The "Action Title" Rule)
     Every slide, page, and section header must state a complete declarative insight.
     Poor:   "Market Expansion" (Passive topic)
     Elite:  "Expanding into APAC Captures AU$12M Pipeline by Q4 via Existing Regional Channels"

  2. THE 3-SECOND EXECUTIVE SCAN TEST
     An executive reading only bolded headings, lead sentences, and visual callouts must grasp
     100% of the strategic message, commercial implications, and required actions within 3 seconds.

  3. PYRAMID PRINCIPLE SYNTHESIS (Barbara Minto Architecture)
     Lead with the answer, recommendation, or decision first. Group supporting arguments into
     mutually exclusive and collectively exhaustive (MECE) categories. Detail evidence last.

  4. VISUAL RESTRAINT AND INTENTIONALITY
     Visual models are analytical tools, not decorative illustrations. Charts appear only when
     numerical relationships, sequences, or multi-dimensional trade-offs cannot be stated in text.

  5. UNCOMPROMISING DATA HONESTY (The Stated Omission Rule)
     Never invent placeholder figures or fill knowledge gaps with synthetic narrative. Explicitly
     state: "Not Discussed / Unverified in Session" with clear forward remediation steps.
====================================================================================================
```

### 5.2 Layout Rules, Page Composition and Whitespace Strategy

1. **Grid Alignment:** All document pages follow a strict 12-column layout grid with standard 24px margins. Content cards, metric panels, and visualisations snap strictly to 3, 4, 6, or 12-column increments.
2. **Whitespace Budgeting:** At least 30% to 35% of every page surface must remain unprinted whitespace. Crammed layouts produce executive cognitive resistance; generous whitespace conveys authority, focus, and clarity.
3. **Information Density Balance:** High-density numerical tables must be paired with low-density executive commentary blocks.
4. **Header and Footer Cadence:** Every deliverable features an executive document control header (Document ID, Version, Classification, Date) and an auditable footer (Concludo Primary Provenance Hash, Page X of Y, Legal Confidentiality Notice).

### 5.3 Typography Standards

Typography is strictly paired to maintain brand identity and executive readability:

- **Display and Headings:** Poppins (Geometric Sans-Serif). Conveys modern authority, architectural precision, and confidence.
  - Page Titles / Document Headers: Poppins SemiBold (28pt / 32px)
  - Major Section Headers (H1): Poppins SemiBold (20pt / 24px)
  - Subsection Headers (H2): Poppins Medium (16pt / 20px)
  - Structural Labels (H3): Poppins Medium (12pt / 16px, Uppercase, Tracking +1.5px)
- **Body Text and Data:** Inter (Grotesque Sans-Serif). Engineered specifically for high-legibility digital and print documentation.
  - Primary Body Narrative: Inter Regular (10pt / 14px, Line Height 1.5)
  - Lead Paragraphs: Inter Medium (11pt / 16px, Line Height 1.55)
  - Tables, Data Grids, Metadata: Inter Regular (9pt / 12px)
  - Footnotes and Citations: Inter Light (8pt / 10px, Color Slate `#4A5568`)

### 5.4 Colour Standards and Design Tokens

Concludo enforces a focused executive palette anchored in Navy and Gold:

```
====================================================================================================
                           CONCLUDO EXECUTIVE COLOUR PALETTE
====================================================================================================

  [PRIMARY BRAND PALETTE]
  Deep Concludo Navy:     #16263F (Primary headings, dark card fills, structural borders)
  Slate Executive Navy:   #21395C (Subsections, table headers, primary data bars)
  Concludo Bright Gold:   #E2B53C (Key metrics, active highlights, primary focal accents)
  Concludo Deep Gold:     #BC8A1C (Hover states, visual borders, authoritative callouts)
  Canvas Background:      #F4F6FA (Page canvas, container backgrounds, contrasting cards)
  Clean White:            #FFFFFF (Content card surfaces, table cells)

  [SEMANTIC GOVERNANCE PALETTE]
  RAG Red (Critical):     #E53E3E (Critical risks, overdue actions, severe blockers)
  RAG Amber (Warning):    #DD6B20 (At-risk milestones, pending dependencies, moderate threats)
  RAG Green (Stable):     #38A169 (On-track deliverables, approved decisions, resolved items)
  Neutral Slate:          #718096 (Completed actions, inactive paths, baseline borders)
====================================================================================================
```

### 5.5 Brand Identity and Australian English Rigour

1. **Spelling and Grammar:** 100% Australian English strictly enforced sitewide (e.g., `organisation`, `prioritise`, `optimise`, `behaviour`, `programme`, `centre`, `categorise`, `synthesise`, `defence`).
2. **Zero Em Dashes and Zero En Dashes:** Em dashes (` - `) and en dashes (` - `) are strictly banned from all narrative and template output. Use spaced hyphens (` - `) or structured parentheses.
3. **Entity Independence:** Concludo Pty Ltd (ACN 701 605 898, ABN 61 701 605 898, Melbourne VIC) is completely independent. Outputs must never assert official affiliation or endorsement by video conferencing platforms, hardware vendors, or third-party SaaS tools.


### 5.6 Detailed Typography and Component Hierarchy Specifications

| Visual Level | Typeface | Weight | Size / Line Height | Color Token | Application Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Document Display Title** | Poppins | SemiBold | 28pt / 34px | `#16263F` (Deep Navy) | Title covers and primary deliverable banners |
| **Section Header (H1)** | Poppins | SemiBold | 20pt / 26px | `#16263F` (Deep Navy) | Numbered top-level architectural sections |
| **Subsection Header (H2)** | Poppins | Medium | 15pt / 20px | `#21395C` (Slate Navy) | Distinct thematic subsections and card titles |
| **Operational Label (H3)** | Poppins | Medium | 11pt / 15px | `#BC8A1C` (Deep Gold) | Uppercase category badges, table grouping chips |
| **Lead Executive Summary** | Inter | Medium | 11pt / 17px | `#16263F` (Deep Navy) | First paragraph of briefings and core takeaways |
| **Body Narrative Text** | Inter | Regular | 10pt / 15px | `#2D3748` (Charcoal) | Standard narrative prose, explanatory descriptions |
| **Data Grids & Cell Content**| Inter | Regular | 9pt / 13px | `#2D3748` (Charcoal) | High-density tables, financial ledgers, action rows |
| **Footnotes & Provenance** | Inter | Light | 8pt / 11px | `#718096` (Slate Grey)| Cryptographic hashes, transcript timestamps, disclaimers|


## SECTION 6: VISUALISATION FRAMEWORK

### 6.1 The Twenty-Eight Executive Visualisation Models

Concludo features twenty-eight automated executive visualisation models (VIS-01 through VIS-28). Visual models are not decorative illustrations; they are structured analytical instruments that reveal relationships, priorities, timelines, risks, and trade-offs that cannot be effectively parsed in raw narrative prose.

Every visual model in Concludo must satisfy **The Four Visual Tests**:
1. **The Data Authenticity Test:** Every node, bar, milestone, and score must derive strictly from primary meeting evidence or verified historical memory. Zero speculative decoration is permitted.
2. **The Executive Decidability Test:** An executive inspecting the visualisation must be able to make an immediate, defensible business decision within three seconds of review.
3. **The Zero Visual Noise Test:** Drop shadows, 3D skeuomorphism, non-standard gradients, and arbitrary decorative vectors are prohibited. Layouts must remain clean, flat, and legible.
4. **The Palette Compliance Test:** Visualisations strictly adhere to Concludo Navy (`#16263F`), Slate Navy (`#21395C`), Accent Gold (`#E2B53C`), Light Canvas (`#F4F6FA`), and semantic RAG tokens (`#E53E3E`, `#DD6B20`, `#38A169`).

```
====================================================================================================
                        CONCLUDO 28-MODEL VISUALISATION SUITE
====================================================================================================
  [GOVERNANCE & PERFORMANCE]            [STRATEGY & ARCHITECTURE]
  - VIS-01: RAG Status Set               - VIS-06: Roadmap Swimlane
  - VIS-02: Priority Matrix 2x2          - VIS-07: Strategic SWOT Quadrant
  - VIS-03: 5x5 Risk Heatmap             - VIS-08: Business Model Canvas
  - VIS-13: KPI Tile Row                 - VIS-09: Enterprise Capability Map
  - VIS-16: Trend Line Graph             - VIS-10: Strategic Maturity Curve
  - VIS-21: Action Ageing Distribution   - VIS-11: Accountability / Org Chart
  - VIS-22: Meeting Health Radar         - VIS-12: Executive Decision Tree
  - VIS-23: Decision Closure Gauge       - VIS-27: Stakeholder Influence Grid
  - VIS-24: Coverage Progress Bars       - VIS-28: Scenario Comparison Panel

  [DELIVERY & EXECUTION]                 [FINANCIAL & QUANTITATIVE]
  - VIS-04: Timeline Milestone Bar       - VIS-15: Financial Waterfall Bridge
  - VIS-05: Operational Gantt Chart      - VIS-17: Commercial Funnel / Pipeline
  - VIS-14: Dependency Network Graph     - VIS-18: Stacked Composition Bar
  - VIS-19: Options Trade-off Matrix     - VIS-20: Sensitivity Tornado Chart
  - VIS-25: Process & Handoff Flow       
  - VIS-26: Incident Chronology Timeline 
====================================================================================================
```

#### VIS-01: Red-Amber-Green (RAG) Governance Status Set
- **Business Purpose:** Communicates the operational health, schedule adherence, budget posture, and resource adequacy of projects, programmes, and strategic initiatives.
- **When Used:** Board reports, program steering committees, PMO portfolio reviews, quarterly business reviews, and executive leadership briefings.
- **How Rendered:** Clean rounded pill badges and status tiles utilising semantic tokens (`#38A169` Green, `#DD6B20` Amber, `#E53E3E` Red). Includes explicit variance commentary and remediation checkpoint dates.
- **Recommended Placement:** Document header block, portfolio summary dashboard, executive summary side panel.

#### VIS-02: Priority Matrix 2x2 (Impact vs Effort Quadrant)
- **Business Purpose:** Forces strategic triage by categorising initiatives into Quick Wins (High Impact, Low Effort), Strategic Bets (High Impact, High Effort), Fill-Ins (Low Impact, Low Effort), and Money Pits / Deprioritise (Low Impact, High Effort).
- **When Used:** Annual business planning, strategic direction sessions, backlog grooming, technology modernisation forums, and cost reduction workshops.
- **How Rendered:** Balanced 2x2 grid with Concludo Navy axes, Gold target focus zone, and numbered interactive entity bubbles anchored to primary database keys.
- **Recommended Placement:** Immediately following the strategic recommendations section or project scope breakdown.

#### VIS-03: 5x5 Enterprise Risk Heatmap (Risk Matrix)
- **Business Purpose:** Visualises downside exposure across a 25-cell probability versus severity matrix, establishing clear risk appetite boundaries.
- **When Used:** Enterprise risk workshops, cybersecurity audits, audit committee dossiers, board risk briefings, and M&A due diligence reviews.
- **How Rendered:** 5x5 matrix with dynamic colour interpolation from muted green to deep crimson. Risk items plotted as distinct circular tokens linking to explicit mitigation owners in `public.action_tracker`.
- **Recommended Placement:** Risk Assessment section, Board governance pack, investment proposal appendices.

#### VIS-04: Timeline Milestone Bar (Linear Chronological Sequence)
- **Business Purpose:** Establishes critical milestone sequencing, delivery gates, and hard calendar deadlines across a single chronological horizontal axis.
- **When Used:** Product launch plans, transformation programmes, client onboarding kickoffs, and executive follow-up memorandums.
- **How Rendered:** Sleek horizontal line in Slate Navy with gold milestone nodes, calendar date badges, and status indicators.
- **Recommended Placement:** Executive summary header, project overview page, client handover documentation.

#### VIS-05: Operational Gantt Chart
- **Business Purpose:** Details multi-workstream project execution, task duration, critical path interdependencies, and resource constraints over calendar time.
- **When Used:** Programme delivery governance, engineering roadmaps, sprint execution tracking, and transformation rollout schedules.
- **How Rendered:** Horizontal stacked timeline bars with alternating row shading, dependency connector vectors, and current date indicator.
- **Recommended Placement:** Operational Delivery section, Detailed Implementation annex.

#### VIS-06: Roadmap Swimlane (Multi-Horizon Strategic Roadmap)
- **Business Purpose:** Maps strategic initiatives across functional swimlanes (e.g., Product, Technology, Commercial, Governance) and delivery horizons (Horizon 1: Current, Horizon 2: Next, Horizon 3: Future).
- **When Used:** Corporate strategy papers, executive briefings, technology modernization plans, and multi-year business plans.
- **How Rendered:** Full-width container with vertical horizon columns and horizontal department swimlanes. Cards feature progress chips and lead owners.
- **Recommended Placement:** Centrefold of strategy reports, business plan execution sections.

#### VIS-07: Strategic SWOT Matrix (SWOT and PESTLE Analysis) (Strengths, Weaknesses, Opportunities, Threats)
- **Business Purpose:** Provides a structured 4-quadrant environmental analysis synthesising internal capabilities and external market dynamics.
- **When Used:** Business planning meetings, startup strategy workshops, market expansion sessions, and competitive positioning forums.
- **How Rendered:** Clean 2x2 quadrant layout with distinct card headers, bulleted evidence points, and verified primary citation anchors.
- **Recommended Placement:** Market analysis section, business plan environmental overview.

#### VIS-08: Business Model Canvas Grid and Strategic Mind Map
- **Business Purpose:** Maps the nine essential building blocks of enterprise value creation (Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structure, Revenue Streams).
- **When Used:** Startup planning, corporate venturing, new product incubation, commercial business cases, and strategic pivots.
- **How Rendered:** High-fidelity 9-box modular grid adhering to Strategyzer conventions, rendered in Navy border lines with Gold accent badges.
- **Recommended Placement:** Standalone centrefold in Business Plans and Commercial Investment Proposals.

#### VIS-09: Enterprise Capability Map
- **Business Purpose:** Deconstructs an organisation into functional capability domains (Core, Differentiating, Supporting), highlighting investment adequacy and maturity.
- **When Used:** Target operating model design, technology modernisation, post-merger integration, and enterprise architecture reviews.
- **How Rendered:** Hierarchical nested grid categorised by business capability tiers with color-coded operational maturity indicators.
- **Recommended Placement:** Operating model documentation, technology strategy reports.

#### VIS-10: Strategic Capability Maturity Curve
- **Business Purpose:** Benchmarks current organisational capability against future target states across five progressive maturity tiers (Initial, Managed, Defined, Quantitatively Managed, Optimising).
- **When Used:** Digital transformation reviews, leadership development forums, governance audits, and capability uplift initiatives.
- **How Rendered:** Stepped progression curve with current baseline markers and target milestone pins.
- **Recommended Placement:** Transformation roadmap, capability development annex.

#### VIS-11: Accountability / Organisational Hierarchy Chart (Org Chart and Impact Matrix)
- **Business Purpose:** Defines formal governance lines, reporting relationships, team ownership, and decision-making authority.
- **When Used:** Restructuring meetings, succession planning forums, operating model definitions, and programme governance kickoffs.
- **How Rendered:** Clean hierarchical tree with role cards detailing executive titles, named owners, and functional spans of control.
- **Recommended Placement:** Governance overview, leadership alignment briefs.

#### VIS-12: Executive Decision Tree
- **Business Purpose:** Visualises branching logic, decision nodes, probabilistic outcomes, financial boundaries, and contingency criteria.
- **When Used:** Major capital allocation reviews, risk response forums, regulatory escalation sessions, and commercial contract negotiations.
- **How Rendered:** Directed acyclic tree with diamond decision gates, rectangular outcome nodes, and branch condition labels.
- **Recommended Placement:** Decision memory packs, board strategic memorandums.

#### VIS-13: KPI Tile Row (KPI Dashboard)
- **Business Purpose:** Provides instantaneous visibility into top-tier operational metrics, target thresholds, and historical trajectory.
- **When Used:** Executive dashboards, QBR reports, sales reviews, and monthly performance scorecards.
- **How Rendered:** Horizontal ribbon of 3 to 5 metrics cards featuring bold Poppins numerals, trend arrows, and target variance chips.
- **Recommended Placement:** Immediate top of Executive Summaries and Board Briefs.

#### VIS-14: Dependency Network Graph
- **Business Purpose:** Maps complex, multi-team deliverable handoffs, upstream blockers, and cross-functional critical path networks.
- **When Used:** Multi-workstream transformation programmes, software architecture design, and complex product launches.
- **How Rendered:** Node-link network diagram with directional arrows, critical path highlighting, and node status colors.
- **Recommended Placement:** Technical architecture papers, programme risk reviews.

#### VIS-15: Financial Waterfall Bridge
- **Business Purpose:** Deconstructs the variance between two financial states (e.g., Budget vs Actual, Year-on-Year Revenue) into specific additive and subtractive drivers.
- **When Used:** Financial planning, annual operating reviews, commercial business cases, and pricing strategy forums.
- **How Rendered:** Stepped bar chart with initial balance, positive green bars, negative red bars, and final balance column.
- **Recommended Placement:** Financial assumptions section, executive business case summary.

#### VIS-16: Trend Line Graph
- **Business Purpose:** Tracks historical trajectories and forward predictive forecasts over regular calendar time intervals.
- **When Used:** Operational metric monitoring, sales velocity reviews, customer retention tracking, and capacity planning.
- **How Rendered:** Smooth vector line with discrete data points, target benchmark ceiling line, and confidence intervals.
- **Recommended Placement:** Performance review reports, quarterly business reviews.

#### VIS-17: Commercial Funnel / Pipeline
- **Business Purpose:** Visualises stage-by-stage conversion efficiency, drop-off rates, and deal velocity across a commercial or operational pipeline.
- **When Used:** Sales discovery reviews, customer onboarding analysis, recruitment pipelines, and partnership forums.
- **How Rendered:** Inverted trapezoidal funnel with volume figures, conversion percentages, and stage velocity metrics.
- **Recommended Placement:** Commercial go-to-market strategies, sales reviews.

#### VIS-18: Stacked Composition Bar and Cluster Map
- **Business Purpose:** Shows the proportional breakdown of a whole (e.g., cost structures, revenue channels, headcount allocation) across categories.
- **When Used:** Budget planning, cost reduction workshops, portfolio allocation, and resource planning.
- **How Rendered:** Segmented horizontal or vertical bar with distinct tonal shadings and percentage callout labels.
- **Recommended Placement:** Financial analysis, resource planning sections.

#### VIS-19: Options Trade-Off Matrix
- **Business Purpose:** Evaluates competing strategic, architectural, or vendor options against weighted criteria (e.g., Cost, Speed, Risk, Scalability).
- **When Used:** Vendor selection, platform architecture design, strategic direction sessions, and capital allocation forums.
- **How Rendered:** Multi-column scorecard with weighted criteria rows, Harvey balls or numerical ratings, and total weighted scores.
- **Recommended Placement:** Vendor evaluation reports, strategic decision papers.

#### VIS-20: Sensitivity Tornado Chart and Decision Graph
- **Business Purpose:** Highlights which underlying assumptions have the greatest positive or negative impact on overall financial or operational outcomes.
- **When Used:** Commercial business cases, M&A valuations, investment proposals, and strategic planning.
- **How Rendered:** Horizontal bars extending left (downside) and right (upside) from a baseline, ranked by magnitude from largest to smallest.
- **Recommended Placement:** Financial risk section, investment proposals.

#### VIS-21: Action Ageing Distribution
- **Business Purpose:** Tracks outstanding operational commitments by days open (0-7 days, 8-14 days, 15-30 days, 30+ days), pinpointing execution bottlenecks.
- **When Used:** Sprint retrospectives, operational delivery reviews, leadership meetings, and PMO oversight.
- **How Rendered:** Segmented bar chart with escalation warning flags for actions exceeding agreed threshold limits.
- **Recommended Placement:** Action tracker dashboard, operational excellence reports.

#### VIS-22: Meeting Health Radar (Spider Chart)
- **Business Purpose:** Visualises performance across all ten dimensions of meeting effectiveness (Purpose Clarity, Participation, Decision Quality, etc.).
- **When Used:** Meeting Health Reports, leadership coaching reviews, culture assessments, and agile retrospectives.
- **How Rendered:** 10-axis radar plot displaying session performance against organisational benchmarks.
- **Recommended Placement:** Standalone Meeting Health Report, leadership alignment brief.

#### VIS-23: Decision Closure Gauge
- **Business Purpose:** Measures the velocity and decisiveness of a leadership group, displaying the ratio of resolved decisions versus deferred items.
- **When Used:** Executive governance reviews, board committee debriefs, and strategic alignment sessions.
- **How Rendered:** Semicircular radial gauge with percentage needle, benchmark targets, and status classification.
- **Recommended Placement:** Decision memory packs, governance summary dashboards.

#### VIS-24: Coverage Progress Bars
- **Business Purpose:** Displays percentage completion against statutory, regulatory, or policy requirements.
- **When Used:** Compliance audits, WHS reviews, security certifications, and governance oversight sessions.
- **How Rendered:** Stacked progress bars with audit pass/fail thresholds and outstanding gap markers.
- **Recommended Placement:** Regulatory compliance dossiers, audit committee packs.

#### VIS-25: Process and Handoff Flow (Swimlane Flowchart)
- **Business Purpose:** Maps operational workflows across teams, identifying approval gates, manual handoffs, and process friction points.
- **When Used:** Operational excellence workshops, supply chain reviews, customer journey mapping, and restructuring sessions.
- **How Rendered:** Structured horizontal swimlane flowchart with standardized BPMN node symbols in Concludo Navy and Gold.
- **Recommended Placement:** Target operating models, process improvement reports.

#### VIS-26: Incident Chronology Timeline
- **Business Purpose:** Reconstructs minute-by-minute operational incidents, system outages, or critical escalations.
- **When Used:** Critical incident retrospectives, cybersecurity breach debriefs, and crisis management sessions.
- **How Rendered:** Vertical timeline with exact timestamps, system events, speaker quotes, and impact severity chips.
- **Recommended Placement:** Incident retrospective reports, disaster recovery reviews.

#### VIS-27: Stakeholder Influence Grid (Power vs Interest Matrix)
- **Business Purpose:** Maps internal and external stakeholders across power and interest dimensions to guide engagement and change management.
- **When Used:** Change management forums, client steering committees, M&A integrations, and major transformation kickoffs.
- **How Rendered:** 2x2 grid categorised into Manage Closely, Keep Satisfied, Keep Informed, and Monitor.
- **Recommended Placement:** Change management plans, commercial negotiation strategies.

#### VIS-28: Scenario Comparison Panel
- **Business Purpose:** Side-by-side comparative analysis of alternative operating scenarios (e.g., Base Case, Aggressive Growth, Defensive Downside).
- **When Used:** Strategic planning, market expansion reviews, M&A valuations, and executive strategy sessions.
- **How Rendered:** 3-column comparative scorecard with uniform metric rows, pros/cons breakdowns, and sensitivity indices.
- **Recommended Placement:** Executive strategy briefs, board investment memorandums.

---









## SECTION 7: DOCUMENT TEMPLATE LIBRARY

Concludo maintains a library of nineteen comprehensive master document templates (T1 through T19). Each template defines a standardized executive deliverable engineered to tier-one management consulting standards.

```
====================================================================================================
                        THE 19 MASTER DOCUMENT TEMPLATES
====================================================================================================
  [CORE OPERATIONAL & GOVERNANCE]        [STRATEGIC & COMMERCIAL]
  - T1: Executive Summary                - T6: Strategy Brief
  - T2: Meeting Report                   - T7: Action Plan
  - T3: Decision Pack                    - T8: Business Plan
  - T4: Board Briefing                   - T9: Transformation Roadmap
  - T5: Program Report                   - T10: Operating Model
                                         - T11: Risk Assessment
  [COMMERCIAL & MARKET]                  - T12: Opportunity Assessment
  - T13: Commercial Business Case        - T14: Investment Proposal
  - T15: Market Analysis Report          - T16: Project Health Report
  - T17: Leadership Briefing             - T18: Quarterly Business Review (QBR)
  - T19: Future-State Strategic Roadmap
====================================================================================================
```

### Template Blueprints (T1 to T19)

#### T1: Executive Summary
- **Primary Objective:** Provide a high-density, 1-2 page briefing enabling an executive to grasp context, decisions, and required actions in under 60 seconds.
- **Required Sections:** 1. Strategic Context & Purpose, 2. Key Decisions Reached, 3. Immediate Action Commitments, 4. Critical Downside Risks, 5. Concludo Insights.
- **Visual Models:** VIS-01 (RAG Status), VIS-13 (KPI Tiles), VIS-04 (Milestone Bar).
- **Target Length:** 1-2 pages (600-1,000 words).

#### T2: Meeting Report
- **Primary Objective:** Deliver an authoritative operational record of a collaborative session.
- **Required Sections:** 1. Session Metadata & Attendee Ledger, 2. Executive Synthesis, 3. Detailed Thematic Discussion, 4. Decision Log, 5. Action Tracker, 6. Meeting Health Score.
- **Visual Models:** VIS-01 (RAG Status), VIS-21 (Action Ageing), VIS-22 (Health Radar).
- **Target Length:** 3-6 pages (1,500-3,000 words).

#### T3: Decision Pack
- **Primary Objective:** Document executive resolutions, fiduciary approvals, and governance choices.
- **Required Sections:** 1. Executive Summary, 2. Decision Register, 3. Rationale & Commercial Impact, 4. Discarded Alternatives, 5. Risk & Dependency Matrix, 6. Sign-off Ledger.
- **Visual Models:** VIS-12 (Decision Tree), VIS-19 (Trade-off Matrix), VIS-23 (Closure Gauge).
- **Target Length:** 2-5 pages (1,200-2,500 words).

#### T4: Board Briefing
- **Primary Objective:** Furnish company directors with strategic synthesis, fiduciary oversight, and decision requests.
- **Required Sections:** 1. Chairman's Overview, 2. Strategic Context, 3. Required Board Resolutions, 4. Enterprise Risk Assessment, 5. Capital & Financial Implications.
- **Visual Models:** VIS-01 (RAG Status), VIS-03 (Risk Heatmap), VIS-13 (KPI Tiles).
- **Target Length:** 4-8 pages (2,000-4,000 words).

#### T5: Program Report
- **Primary Objective:** Provide PMO and steering committee oversight across multi-workstream initiatives.
- **Required Sections:** 1. Programme Health Summary, 2. Workstream Status Breakdown, 3. Critical Path Milestones, 4. Escalated Risks & Blockers, 5. Financial Spend vs Budget.
- **Visual Models:** VIS-01 (RAG Status), VIS-05 (Gantt Chart), VIS-14 (Dependency Graph).
- **Target Length:** 5-10 pages (2,500-5,000 words).

#### T6: Strategy Brief
- **Primary Objective:** Articulate long-term competitive positioning, strategic priorities, and organisational direction.
- **Required Sections:** 1. Strategic Vision & Problem Statement, 2. Market Environment & SWOT, 3. Strategic Pillars, 4. Horizon Delivery Roadmap, 5. Capability Requirements.
- **Visual Models:** VIS-06 (Roadmap Swimlane), VIS-07 (SWOT Quadrant), VIS-10 (Maturity Curve).
- **Target Length:** 4-8 pages (2,000-4,000 words).

#### T7: Action Plan
- **Primary Objective:** Enforce operational execution through the Five-Field Delegation Standard.
- **Required Sections:** 1. Executive Overview, 2. Master Action Schedule, 3. Critical Path Milestones, 4. Dependency & Escalation Protocol, 5. Review Cadence.
- **Visual Models:** VIS-04 (Timeline Bar), VIS-14 (Dependency Network), VIS-21 (Action Ageing).
- **Target Length:** 2-5 pages (1,000-2,500 words).

#### T8: Business Plan
- **Primary Objective:** Provide a complete commercial, operational, and financial blueprint for a venture or business unit.
- **Required Sections:** 1. Executive Summary, 2. Problem Statement, 3. Market Opportunity, 4. Business Model Canvas, 5. Operational Plan, 6. Financial Forecasts, 7. Risk Mitigation.
- **Visual Models:** VIS-08 (Business Model Canvas), VIS-15 (Waterfall Bridge), VIS-20 (Tornado Chart).
- **Target Length:** 8-15 pages (4,000-8,000 words).

#### T9: Transformation Roadmap
- **Primary Objective:** Guide enterprise change across people, processes, systems, and operating structures.
- **Required Sections:** 1. Transformation Vision, 2. Current vs Target State, 3. Multi-Horizon Implementation Plan, 4. Change Management Strategy, 5. Governance & Benefits Realisation.
- **Visual Models:** VIS-06 (Roadmap Swimlane), VIS-10 (Maturity Curve), VIS-25 (Handoff Flow).
- **Target Length:** 6-12 pages (3,000-6,000 words).

#### T10: Target Operating Model
- **Primary Objective:** Define how an organisation configures capabilities, governance, and technology to deliver its strategy.
- **Required Sections:** 1. Executive Summary, 2. Design Principles, 3. Core Capability Architecture, 4. Organisational Structure & Roles, 5. Technology & Data Enablers.
- **Visual Models:** VIS-09 (Capability Map), VIS-11 (Org Chart), VIS-25 (Process Flow).
- **Target Length:** 6-12 pages (3,000-6,000 words).

#### T11: Risk Assessment
- **Primary Objective:** Identify, evaluate, and mitigate downside threats to organisational objectives.
- **Required Sections:** 1. Executive Summary, 2. Methodology & Appetite, 3. 5x5 Enterprise Risk Register, 4. Deep-Dive Treatment Plans, 5. Monitoring & Escalation Triggers.
- **Visual Models:** VIS-03 (Risk Heatmap), VIS-14 (Dependency Network), VIS-01 (RAG Set).
- **Target Length:** 4-8 pages (2,000-4,000 words).

#### T12: Opportunity Assessment
- **Primary Objective:** Quantify and prioritise commercial, operational, and innovation opportunities.
- **Required Sections:** 1. Executive Summary, 2. Opportunity Catalogue & Scoring, 3. Commercial Potential Analysis, 4. Feasibility & Resource Requirements, 5. Pursuit Roadmap.
- **Visual Models:** VIS-02 (Priority Matrix), VIS-17 (Commercial Funnel), VIS-28 (Scenario Panel).
- **Target Length:** 4-8 pages (2,000-4,000 words).

#### T13: Commercial Business Case
- **Primary Objective:** Justify capital investment by comparing financial costs against commercial benefits.
- **Required Sections:** 1. Executive Summary, 2. Strategic Rationale, 3. Options Evaluation, 4. Cost-Benefit & ROI Analysis, 5. Implementation & Risk Plan.
- **Visual Models:** VIS-15 (Financial Waterfall), VIS-19 (Trade-off Matrix), VIS-20 (Tornado Chart).
- **Target Length:** 6-12 pages (3,000-6,000 words).

#### T14: Investment Proposal
- **Primary Objective:** Secure formal capital allocation or investor backing for a defined commercial initiative.
- **Required Sections:** 1. Investment Overview, 2. Market Problem & Traction, 3. Use of Funds & Financial Returns, 4. Team & Governance, 5. Exit or Payback Horizons.
- **Visual Models:** VIS-13 (KPI Tiles), VIS-15 (Waterfall Bridge), VIS-28 (Scenario Panel).
- **Target Length:** 5-10 pages (2,500-5,000 words).

#### T15: Market Analysis Report
- **Primary Objective:** Evaluate customer demand, competitive threats, and external macroeconomic conditions.
- **Required Sections:** 1. Executive Summary, 2. Addressable Market (TAM/SAM/SOM), 3. Customer Segments, 4. Competitive Landscape, 5. Strategic Recommendations.
- **Visual Models:** VIS-07 (SWOT Quadrant), VIS-17 (Pipeline Funnel), VIS-27 (Stakeholder Grid).
- **Target Length:** 5-10 pages (2,500-5,000 words).

#### T16: Project Health Report
- **Primary Objective:** Provide quick-read diagnostic oversight on single-project trajectory and risk exposure.
- **Required Sections:** 1. Project Scorecard, 2. Milestone Burn-Up, 3. Open Issues & Blockers, 4. Budget & Resourcing Variance, 5. Next Period Commitments.
- **Visual Models:** VIS-01 (RAG Status), VIS-04 (Timeline Bar), VIS-21 (Action Ageing).
- **Target Length:** 2-4 pages (1,000-2,000 words).

#### T17: Leadership Briefing
- **Primary Objective:** Cascade strategic alignment, priorities, and executive expectations to operational managers.
- **Required Sections:** 1. Strategic Context, 2. Key Decisions & Priorities, 3. Functional Expectations, 4. Support Mechanisms, 5. Q&A and Feedback Channels.
- **Visual Models:** VIS-01 (RAG Status), VIS-04 (Timeline Bar), VIS-11 (Org Chart).
- **Target Length:** 3-5 pages (1,500-2,500 words).

#### T18: Quarterly Business Review (QBR)
- **Primary Objective:** Retrospective and forward-looking evaluation of quarterly operational performance.
- **Required Sections:** 1. Executive Performance Dashboard, 2. OKR Achievement Audit, 3. Financial Review, 4. Challenges & Root Causes, 5. Forward Quarter Strategy.
- **Visual Models:** VIS-13 (KPI Tiles), VIS-16 (Trend Line), VIS-18 (Stacked Composition).
- **Target Length:** 6-12 pages (3,000-6,000 words).

#### T19: Future-State Roadmap
- **Primary Objective:** Paint a compelling, phased picture of organisational evolution over 3 to 5 years.
- **Required Sections:** 1. Executive Vision, 2. Horizon Architecture, 3. Phase 1 Foundations, 4. Phase 2 Acceleration, 5. Phase 3 Market Dominance, 6. Risk Guardrails.
- **Visual Models:** VIS-06 (Roadmap Swimlane), VIS-10 (Maturity Curve), VIS-28 (Scenario Panel).
- **Target Length:** 6-12 pages (3,000-6,000 words).


### 7.2 Detailed Architectural Specifications for Master Templates

### 6.1 Principles Common to All Sixteen Templates

Every Concludo deliverable is composed using a library of sixteen foundational business templates. These templates are governed by five shared engineering principles:

1. **The Executive Conclusion Leads**: Every template begins with the conclusion, decision, or current state answer in the opening paragraph. Introductory warm-ups, administrative throat-clearing, and chronological narrative build-ups are strictly prohibited.
2. **Explicit Evidence Provenance**: Every block separates verified claims (`confirmed`, `proposed`) from analytical inferences (`inferred`) and unaddressed ambiguities (`unknown`).
3. **Structured Gap Blocks**: When an expected topic was neglected during discussion, the template includes a mandatory gap callout rather than silently omitting the section.
4. **Actionable Closure**: Templates conclude with operational next steps formatted to the Five-Field Delegation Standard.
5. **Audience-Calibrated Depth**: Density, tone, and visual layout dynamically calibrate between executive briefing, operational delivery, client-safe presentation, and statutory board records.

### 6.2 Template Selection and Conflict Resolution Rules

When multiple templates match a conversation's extracted signals, Concludo resolves selection using a strict deterministic priority ladder:

```
TEMPLATE PRECEDENCE ORDER (First Match Wins):
1. T14: Board Briefing           --> Triggered if MT-A08/A09 or Board Quorum detected
2. T15: Decision Pack            --> Triggered if CV-4 Decisions count >= 3 and Materiality = Significant
3. T3: Business Case             --> Triggered if CapEx investment or business case evaluation detected
4. T4: Business Plan             --> Triggered if MT-A03/A04 Annual Planning or Startup Formation
5. T9: Transformation Plan       --> Triggered if MT-E04 Organisational Change or Restructuring
6. T10: Risk Assessment          --> Triggered if CV-6 Risk Index >= 75
7. T12: Program Report           --> Triggered if MT-B01/B02 Multi-Workstream Program Governance
8. T13: Leadership Brief         --> Triggered if MT-C02 Leadership Alignment and CV-5 Importance >= 70
9. T8: Roadmap                   --> Triggered if Multi-Milestone Delivery Schedule dominant
10. T7: Action Plan              --> Triggered if MT-F02 Sprint Planning or Task Execution dominant
11. T2: Meeting Report           --> Default baseline deliverable for standard operational reviews
```

### 6.3 Detailed Specifications for All 16 Templates (T1 to T16)

Below are the complete architectural specifications for all sixteen Concludo business templates:


#### T1. Executive Summary

* **Primary Reader**: The executive or director who will not read the full pack.
* **Target Length**: 200 to 350 words (Single Page)
* **Mandated Lead Visual**: `VIS-13 KPI Tile Row`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. The Answer** | One or two sentences stating what this meeting settled or failed to settle. | Written strictly as an active conclusion, never as a passive topic. |
| **2. Key Decisions** | Up to five confirmed decisions, each on a single line with designated owner. | If more than five decisions exist, link out to full Decision Log (OUT-02). |
| **3. Immediate Next Steps** | Top three critical actions with owner and completion date. | Sourced directly from the 'Now' horizon band of the Action Plan. |
| **4. Critical Risks** | Up to three articulated threats with stated consequence. | Omitted if no risks were raised; that omission is explicitly recorded. |
| **5. What Was Not Settled** | The mandatory gap block identifying unclosed items. | Mandatory block. Builds executive trust through honesty. |

#### T2. Meeting Report

* **Primary Reader**: Meeting participants, immediate stakeholders, and absent team members.
* **Target Length**: 2 to 4 pages
* **Mandated Lead Visual**: `VIS-01 RAG Status Set or VIS-04 Milestone Timeline`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Meeting Context** | Date, duration, chair, attendee roster, and confirmed objective. | Records role coverage gaps if critical functions were absent. |
| **2. Executive Summary** | Distilled outcome paragraph highlighting major agreements. | Positioned at top of page 1. |
| **3. Key Discussion Themes** | Structured thematic synthesis of major debate topics. | Groups spoken points into coherent business themes. |
| **4. Confirmed Decision Log** | Full register of decisions with rationale and conditions. | Every entry carries an owner and review date. |
| **5. Complete Action Register** | All assigned actions formatted to the Delegation Standard. | Must include Owner, Verb, Object, Date, and Definition of Done. |
| **6. Open Questions & Gaps** | Unresolved issues, unverified assumptions, and next agenda items. | Directly seeds the next meeting's agenda. |

#### T3. Business Case

* **Primary Reader**: The commercial approver, investment committee, or capital allocation sponsor.
* **Target Length**: 3 to 5 pages plus annexes
* **Mandated Lead Visual**: `VIS-15 Financial Waterfall Bridge`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Executive Summary & Recommendation** | Core investment request, proposed option, and net return. | Clear binary recommendation: Proceed, Reject, or Re-scope. |
| **2. Problem Statement & Opportunity** | The operational friction, market gap, or commercial threat. | Grounded in quantified business impact. |
| **3. Options Evaluated** | Comparison of minimum three options: Do Nothing, Preferred, Alternative. | Requires VIS-19 Options Trade-Off Matrix. |
| **4. Financial Analysis & Payback** | CapEx, OpEx, payback period, net return, and sensitivity. | Requires VIS-15 Financial Waterfall Bridge. |
| **5. Implementation Roadmap** | High-level stage-gate delivery phases and milestones. | Requires VIS-04 Milestone Timeline Bar. |
| **6. Risk Assessment & Mitigations** | Key delivery, commercial, and operational failure modes. | Links to VIS-03 Risk Heat Map. |

#### T4. Business Plan

* **Primary Reader**: Business founders, corporate development leads, executive committees, bank/investors.
* **Target Length**: 8 to 15 pages
* **Mandated Lead Visual**: `VIS-08 Business Model Canvas Grid or VIS-06 Roadmap`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Executive Summary** | Company vision, value proposition, and growth trajectory. | High-altitude strategic narrative. |
| **2. Market Opportunity** | Target customer segments, market sizing, and competitive moat. | Requires OUT-21 Market Opportunity Review. |
| **3. Business Model Canvas** | Structured 9-box operational and revenue architecture. | Requires VIS-08 Business Model Canvas Grid. |
| **4. Products & Services** | Core offerings, technical architecture, and value delivery. | Separates current capabilities from roadmap promises. |
| **5. Go-to-Market Strategy** | Acquisition channels, pricing model, and sales cycle. | Outlines customer acquisition cost assumptions. |
| **6. Operating & Resourcing Plan** | Team structure, critical hiring milestones, and facilities. | Links to VIS-11 Organisation Chart. |
| **7. Financial Projections** | 3-year revenue, cost, and cash burn projections. | Separates validated facts from sensitive assumptions. |
| **8. Risk Management & Roadmap** | Key strategic vulnerabilities and multi-phase milestones. | Requires VIS-06 Roadmap Swimlanes. |

#### T5. Operating Model

* **Primary Reader**: Transformation directors, chief operating officers, and practice leaders.
* **Target Length**: 4 to 8 pages
* **Mandated Lead Visual**: `VIS-10 Maturity Curve or VIS-25 Process Flow`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Target Operating Model Overview** | Core operating philosophy, design principles, and service delivery. | Contrasts current state against target state. |
| **2. Capability Assessment** | Evaluation of current organisational capabilities against scale. | Requires VIS-09 Capability Map. |
| **3. Governance & Decision Rights** | RACI matrix, escalation thresholds, and approval charters. | Clarifies who decides vs who executes. |
| **4. Process Architecture & Handoffs** | Core value stream mapping and inter-team handoffs. | Requires VIS-25 Process Flow Diagram. |
| **5. Technology & Data Enablers** | Platform tooling, automation, and shared systems. | Identifies technical debt and integration gaps. |

#### T6. Strategy Paper

* **Primary Reader**: Chief Strategy Officer, executive committee, board directors.
* **Target Length**: 4 to 7 pages
* **Mandated Lead Visual**: `VIS-19 Options Trade-Off Matrix`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Strategic Context & Mandate** | Macro market shifts, competitive pressure, and core challenge. | Frames why the organisation must act now. |
| **2. Strategic Choices Evaluated** | Mutually exclusive strategic pathways under consideration. | Contrasts trade-offs, required investments, and risks. |
| **3. Recommended Pathway** | The chosen strategic direction with supporting evidence. | Documents dissent, rejected alternatives, and assumptions. |
| **4. Resource Reallocation** | Capital, headcount, and capacity shifting from legacy work. | Quantifies what the organisation will STOP doing. |
| **5. Strategic Execution Roadmap** | Multi-year horizon milestones and horizon gates. | Requires VIS-06 Roadmap Swimlanes. |

#### T7. Action Plan

* **Primary Reader**: Project managers, scrum masters, operational delivery contributors.
* **Target Length**: 1 to 3 pages
* **Mandated Lead Visual**: `VIS-05 Gantt Schedule View or VIS-21 Action Ageing`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Action Portfolio Overview** | Total action tally, completion rate, overdue load, and burndown. | Highlights operational delivery velocity. |
| **2. Immediate Actions (Horizon: Now)** | Tasks due within the current sprint or 14-day cycle. | Strict Five-Field Delegation Standard compliance. |
| **3. Near-Term Actions (Horizon: Next)** | Tasks scheduled for subsequent operational periods. | Carries designated owners and dependencies. |
| **4. Blocked & Overdue Items** | Tasks past due date or blocked by upstream bottlenecks. | Requires root cause explanation and recovery plan. |

#### T8. Roadmap

* **Primary Reader**: Product managers, program managers, executive sponsors, enterprise clients.
* **Target Length**: 2 to 4 pages
* **Mandated Lead Visual**: `VIS-06 Roadmap Swimlanes`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Strategic Horizons Overview** | Horizon 1 (Now), Horizon 2 (Next), and Horizon 3 (Later). | Maps initiatives against calendar horizons. |
| **2. Workstream Swimlanes** | Parallel delivery tracks (e.g., Platform, Commercial, Operations). | Requires VIS-06 Roadmap Swimlanes. |
| **3. Critical Path Dependencies** | Cross-initiative linkages where delay cascades downstream. | Requires VIS-14 Dependency Network Graph. |
| **4. Release Gates & Milestones** | Formal stage-gate criteria required to unlock phases. | Defines tangible deliverables for gate passage. |

#### T9. Transformation Plan

* **Primary Reader**: Chief Transformation Officer, Steering Committee, Program Sponsors.
* **Target Length**: 5 to 10 pages
* **Mandated Lead Visual**: `VIS-10 Maturity Curve & VIS-06 Roadmap`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Transformation Vision & Goals** | Core organisational North Star, business outcomes, and timeline. | Establishes quantifiable transformation metrics. |
| **2. Capability Maturity Progression** | Current baseline maturity vs target state progression. | Requires VIS-10 Maturity Assessment Curve. |
| **3. Workstream Execution Plans** | Detailed plans across People, Process, Technology, and Culture. | Assigns workstream leads and milestones. |
| **4. Change Management & Adoption** | Stakeholder communication, training, and resistance management. | Requires VIS-27 Stakeholder Matrix. |
| **5. Governance & Benefits Realization** | Tracking metrics, value release timeline, and audit gates. | Maps direct commercial return on investment. |

#### T10. Risk Assessment

* **Primary Reader**: Chief Risk Officer, Audit & Risk Committee, Program Managers.
* **Target Length**: 2 to 5 pages
* **Mandated Lead Visual**: `VIS-03 Risk Heat Map`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Risk Portfolio Summary** | Overall organisational risk posture, total risk count, severity tier. | Categorises risks into High, Medium, Low. |
| **2. Risk Heat Map** | Graphical plotting of probability vs commercial consequence. | Requires VIS-03 Risk Heat Map (3x3 or 5x5). |
| **3. Comprehensive Risk Register** | ID, description, category, owner, pre-mitigation rating, post-mitigation rating. | Every risk must have a named human owner. |
| **4. Mitigation Strategies & Triggers** | Concrete operational controls and escalation triggers. | Defines specific events that trigger escalation. |

#### T11. Opportunity Assessment

* **Primary Reader**: Chief Commercial Officer, Head of Growth, New Venture Leads.
* **Target Length**: 2 to 4 pages
* **Mandated Lead Visual**: `VIS-02 Priority Matrix (2x2)`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Executive Summary** | Top commercial opportunities identified and potential enterprise value. | Summarises revenue potential and feasibility. |
| **2. Opportunity Prioritisation Matrix** | Evaluation across Commercial Impact vs Implementation Ease. | Requires VIS-02 Priority Matrix (2x2). |
| **3. Opportunity Profiles** | Detailed profile for each initiative: market size, moat, requirements. | Documents required resource investment. |
| **4. Recommended Go-Forward Actions** | Fast-validation experiments and initial exploration milestones. | Emphasises low-cost hypothesis testing. |

#### T12. Program Report

* **Primary Reader**: Program Directors, PMO Leads, Steering Committee members.
* **Target Length**: 3 to 6 pages
* **Mandated Lead Visual**: `VIS-01 RAG Status Set & VIS-14 Dependency Graph`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Program Health Snapshot** | Consolidated executive RAG status, budget variance, schedule variance. | Requires VIS-01 RAG Status Set. |
| **2. Workstream Status Summaries** | Progress updates across all active program initiatives. | Focuses on variances, achievements, and blockers. |
| **3. Program Dependency Network** | Inter-workstream bottlenecks and cross-project links. | Requires VIS-14 Dependency Network Graph. |
| **4. Key Decisions Required** | Escalated choices requiring steering committee approval. | Links directly to Decision Log (OUT-02). |

#### T13. Leadership Brief

* **Primary Reader**: Chief Executive Officer, Managing Director, Executive Leadership Team.
* **Target Length**: 2 to 3 pages
* **Mandated Lead Visual**: `VIS-13 KPI Tile Row & VIS-02 Priority Matrix`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Strategic Pulse** | Current organisational momentum, critical victories, and top concerns. | Written for rapid executive consumption. |
| **2. Key Operational Indicators** | Throughput, pipeline, revenue burn, and delivery stats. | Requires VIS-13 KPI Tile Row. |
| **3. Urgent Decisions & Escalations** | Matters requiring immediate executive intervention or sign-off. | Clear operational options presented. |
| **4. Cross-Department Priorities** | Ranked alignment initiatives across functional departments. | Requires OUT-14 Ranked Priorities. |

#### T14. Board Briefing

* **Primary Reader**: Company Board of Directors, Non-Executive Directors, Advisory Board.
* **Target Length**: 3 to 6 pages
* **Mandated Lead Visual**: `VIS-03 Risk Heat Map & VIS-13 KPI Tiles`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Board Executive Summary** | High-level strategic update, corporate health, major milestones. | Strictly boardroom-grade formal prose. |
| **2. Statutory Governance & Quorum** | Confirmation of directors present, declarations of interest, motions. | Meets corporate governance requirements. |
| **3. Strategic Performance & Metrics** | Financial runway, enterprise KPIs, and market performance. | Requires VIS-13 KPI Tile Row. |
| **4. Enterprise Risk Profile** | Top strategic risks, compliance status, and legal matters. | Requires VIS-03 Risk Heat Map. |
| **5. Matters for Formal Approval** | Specific board resolutions submitted for vote and sign-off. | Formatted for corporate secretarial minutes. |

#### T15. Decision Pack

* **Primary Reader**: Decision-makers, executive sponsors, company secretaries, auditors.
* **Target Length**: 2 to 4 pages
* **Mandated Lead Visual**: `VIS-19 Options Trade-Off Matrix or VIS-12 Decision Tree`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Decision Summary** | Title, context, decision-makers, and formal choice agreed. | Framed as an unambiguous resolution statement. |
| **2. Problem Definition & Context** | Background operational challenge and business urgency. | Documents why a decision was mandated. |
| **3. Options Evaluated & Trade-Offs** | Detailed analysis of considered options and why others were rejected. | Requires VIS-19 Options Trade-Off Matrix. |
| **4. Dissent & Alternative Perspectives** | Explicit recording of dissenting views or operational concerns. | Protects governance integrity by recording debate. |
| **5. Execution Commitments & Review** | Enabling actions, designated owner, conditions, and review date. | Strictly binds decision to an Action Plan. |

#### T16. Recommendation Paper

* **Primary Reader**: Corporate clients, executive sponsors, advisory boards.
* **Target Length**: 3 to 6 pages
* **Mandated Lead Visual**: `VIS-19 Options Trade-Off Matrix`
* **Structural Blocks**:

| Block Name | Content Description | Architectural Rule & Constraints |
| :--- | :--- | :--- |
| **1. Executive Summary** | The recommended strategic choice, core rationale, and expected impact. | Clear, authoritative advisory guidance. |
| **2. Diagnostic Findings** | Observed challenges, empirical evidence, and root causes. | Grounds recommendations in observed data. |
| **3. Strategic Recommendations** | Detailed advisory recommendations, ranked by business leverage. | Carries non-binding disclaimer notice. |
| **4. Options Comparison** | Comparison against alternative pathways and risks of inaction. | Requires VIS-19 Options Trade-Off Matrix. |
| **5. Implementation Roadmap** | Recommended phasing, milestones, and governance oversight. | Links to VIS-04 Milestone Timeline. |

---

## SECTION 8: BUSINESS PLAN INTELLIGENCE FRAMEWORK

The Concludo Business Plan Intelligence Framework transforms collaborative commercial discussions into a rigorous, bankable, and investor-grade business plan. Rather than outputting conversational summaries, this framework synthesises primary meeting facts, market constraints, financial parameters, and operational milestones into sixteen structured sections.

```
====================================================================================================
                        BUSINESS PLAN INTELLIGENCE ARCHITECTURE
====================================================================================================
  [PRIMARY MEETING INTELLIGENCE] ──> Commercial Discussions, Financial Asserts, Strategy Debates
                 │
                 ▼
  [THE 16 STRUCTURAL SECTIONS]
    1. Executive Summary               9. Operational Plan
    2. Problem Statement              10. Resource Plan
    3. Market Opportunity             11. Financial Assumptions
    4. Target Audience & Personas     12. Risk Assessment
    5. Revenue Model & Unit Economics 13. Master Action Plan
    6. Business Model Canvas (VIS-08) 14. Success Indicators (KPIs)
    7. Strategic SWOT Matrix (VIS-07) 15. Concludo Insights
    8. Competitive Positioning        16. Strategic Recommendations
                 │
                 ▼
  [TIER-ONE CONSULTING DELIVERABLE] ──> T8 Business Plan Template (Bankable, Decidable, Sendable)
====================================================================================================
```

### 8.1 The Sixteen Structural Sections of the Concludo Business Plan

#### Section 1: Executive Summary
The governing thought of the entire commercial venture. Synthesises the commercial vision, target market, distinct competitive advantage, capital requirements, and three-year financial trajectory into a concise two-page briefing. An investor or board director reading this section alone understands the core investment thesis.

#### Section 2: Problem Statement
Articulates the unmet customer pain point, structural market inefficiency, or enterprise vulnerability addressed by the venture. Grounded in verbatim client quotes, market feedback, and quantified operational costs of inaction.

#### Section 3: Market Opportunity
Establishes the total market boundaries using the standard TAM/SAM/SOM framework:
- **Total Addressable Market (TAM):** The macroscopic annual expenditure across the broader market domain.
- **Serviceable Addressable Market (SAM):** The specific segment reachable through current regional and regulatory footprints.
- **Serviceable Obtainable Market (SOM):** The realistic market share target captured across years one to three.

#### Section 4: Target Audience and Customer Personas
Defines the primary economic buyers, operational champions, and end-users. Details demographic profiles, buying criteria, regulatory constraints, and decision-making authority hierarchies.

#### Section 5: Revenue Model and Unit Economics
Deconstructs commercial mechanics: pricing strategy (subscription tiers, usage-based fees, professional services), Customer Acquisition Cost (CAC), Lifetime Value (LTV), gross margin targets, and churn tolerances.

#### Section 6: Business Model Canvas
Integrates the complete business architecture into the Strategyzer 9-box modular grid (VIS-08), mapping Key Partners, Key Activities, Key Resources, Value Propositions, Customer Relationships, Channels, Customer Segments, Cost Structures, and Revenue Streams.

#### Section 7: Strategic SWOT Matrix
Synthesises internal capabilities against external market forces using the four-quadrant SWOT framework (VIS-07). Every assertion is paired with a strategic implication (e.g., leveraging a Strength to neutralise an external Threat).

#### Section 8: Competitive Positioning
Maps the competitive landscape using a 2x2 positioning grid. Highlights white-space opportunities, sustainable defensibility moats, intellectual property protections, and switching costs.

#### Section 9: Operational Plan
Details the day-to-day delivery architecture: facilities, supply chain partnerships, technical hosting infrastructure (e.g., Sydney AWS `ap-southeast-2`), vendor integrations, customer support cadences, and service level agreements (SLAs).

#### Section 10: Resource Plan
Maps the human and technical capital requirements across the planning horizon: executive leadership team, core engineering headcount, sales velocity teams, operational staff, and external professional advisors.

#### Section 11: Financial Assumptions and Forecast Model
Defines the underlying drivers of commercial success: sales velocity, pipeline conversion rates, staffing costs, capital expenditures, and working capital buffers. Incorporates the Financial Waterfall Bridge (VIS-15) and Sensitivity Tornado Chart (VIS-20). Strictly adheres to the Stated Omission Standard: unverified financial claims are flagged with remediation tasks.

#### Section 12: Enterprise Risk Assessment
Quantifies downside vulnerabilities using the 5x5 Enterprise Risk Heatmap (VIS-03). Evaluates strategic, operational, financial, and regulatory risks, pairing each with a dedicated mitigation strategy and named accountable owner.

#### Section 13: Master Action Plan
Details the operational execution schedule enforcing the Five-Field Delegation Standard. Highlights critical path milestones, regulatory approvals, and pilot launches over the initial 90, 180, and 360 days.

#### Section 14: Success Indicators and Governance KPIs
Defines the core metrics dashboard: Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), Net Revenue Retention (NRR), Operating Margin, and System Availability. Features the KPI Tile Row (VIS-13) and RAG Status Set (VIS-01).

#### Section 15: Concludo Insights
The unspoken intelligence audit. Highlights weak assumptions in the business model, unvalidated financial leaps, missing competitive considerations, and operational vulnerabilities identified by the Concludo Insight Engine.

#### Section 16: Strategic Recommendations
Prioritised, high-impact guidance for executive leadership and founders. Defines immediate next steps, critical partner introductions, required governance checkpoints, and capital deployment milestones.

---

## SECTION 9: EXECUTIVE BRIEFING FRAMEWORK

The Executive Briefing Framework governs the synthesis of complex collaborative data into concise, high-impact deliverables tailored for specific C-suite and governance personas.

```
====================================================================================================
                        EXECUTIVE BRIEFING ARCHETYPES
====================================================================================================
  [CEO BRIEFING]                 ──> High-altitude strategy, capital allocation, enterprise risk
  [EXECUTIVE LEADERSHIP BRIEF]   ──> Cross-functional alignment, resource trade-offs, OKRs
  [STRATEGY BRIEFING]            ──> Competitive positioning, market horizons, M&A due diligence
  [BOARD BRIEFING]               ──> Fiduciary compliance, statutory risk, major capital sign-offs
  [PORTFOLIO BRIEFING]           ──> Multi-programme delivery RAG, critical path, budget variances
  [TRANSFORMATION BRIEFING]      ──> Change readiness, operating model transition, culture adoption
====================================================================================================
```

### 9.1 The Six Specialised Executive Briefing Archetypes

#### 1. CEO Executive Briefing (`OUT-14`)
- **Executive Persona:** Chief Executive Officer, Managing Director, Company Founder.
- **Cognitive Horizon:** Strategic, whole-of-enterprise, shareholder value, commercial risk.
- **Core Sections:** 1. Strategic Snapshot & Market Posture, 2. Major Executive Decisions Resolved, 3. Critical Enterprise Risks & Escalations, 4. Capital Allocation & Run Rate Impact, 5. High-Priority CEO Actions.
- **Visual Standards:** VIS-01 (RAG Set), VIS-13 (KPI Tiles), VIS-03 (Risk Heatmap). Max length 2-3 pages.

#### 2. Executive Leadership Team (ELT) Briefing (`OUT-08`)
- **Executive Persona:** C-Suite Peers (COO, CFO, CTO, CMO, CPO, General Counsel).
- **Cognitive Horizon:** Cross-functional coordination, operational alignment, resource bottlenecks.
- **Core Sections:** 1. Executive Summary & Alignments, 2. Cross-Functional Dependencies & Blockers, 3. Resource & Capacity Trade-offs, 4. Agreed Inter-Team Commitments, 5. Escalation Review Cadence.
- **Visual Standards:** VIS-02 (Priority Matrix), VIS-11 (Org Chart), VIS-14 (Dependency Graph). Max length 3-4 pages.

#### 3. Strategic Direction Briefing (`OUT-07`)
- **Executive Persona:** Chief Strategy Officer, VP Corporate Development, Investment Committee.
- **Cognitive Horizon:** 3 to 5-year competitive advantage, market entry, disruption threats.
- **Core Sections:** 1. Strategic Imperative & Market Shift, 2. Multi-Horizon Vision, 3. Competitive Moats & IP, 4. Strategic Bets vs Quick Wins, 5. Resource Reallocation Plan.
- **Visual Standards:** VIS-06 (Roadmap Swimlane), VIS-07 (SWOT Quadrant), VIS-19 (Trade-off Matrix). Max length 4-6 pages.

#### 4. Board Strategic Briefing (`OUT-12` / `OUT-44`)
- **Executive Persona:** Board Chairman, Non-Executive Directors, Committee Chairs.
- **Cognitive Horizon:** Fiduciary oversight, compliance, solvency, executive accountability.
- **Core Sections:** 1. Chairman's Statement, 2. Resolutions for Board Approval, 3. Solvency & Financial Run Rate, 4. Governance, Regulatory & Compliance Status, 5. Material Risk Disclosures.
- **Visual Standards:** VIS-01 (RAG Set), VIS-03 (Risk Heatmap), VIS-23 (Decision Gauge). Max length 4-8 pages.

#### 5. Portfolio Performance Briefing (`OUT-43`)
- **Executive Persona:** Chief Operating Officer, Head of PMO, Programme Directors.
- **Cognitive Horizon:** Multi-workstream delivery, milestone variance, budget burn, bottleneck resolution.
- **Core Sections:** 1. Portfolio Health Overview, 2. Workstream Scorecards, 3. Critical Path Milestones at Risk, 4. Cross-Project Dependency Heatmap, 5. Action Ageing & Overdue Tasks.
- **Visual Standards:** VIS-01 (RAG Status), VIS-05 (Gantt Chart), VIS-21 (Action Ageing). Max length 4-8 pages.

#### 6. Enterprise Transformation Briefing (`OUT-15`)
- **Executive Persona:** Chief Transformation Officer, Head of People & Culture, Business Unit Heads.
- **Cognitive Horizon:** Organisational change management, operating model transition, capability uplift.
- **Core Sections:** 1. Transformation Vision & Business Case, 2. Capability Maturity Progress, 3. Organisational Change Readiness, 4. Process Flow & Handoff Optimisation, 5. Benefits Realisation Tracking.
- **Visual Standards:** VIS-06 (Roadmap Swimlane), VIS-10 (Maturity Curve), VIS-25 (Process Flow). Max length 4-8 pages.

### 9.2 Executive Language and Formatting Standards

Executive briefings must adhere to strict linguistic and stylistic conventions:
1. **The Active Voice Imperative:** Passive sentences are prohibited. (e.g., "The steering committee approved the AU$500k budget" rather than "The budget was approved").
2. **Quantitative Precision:** Avoid vague qualifiers like "significant growth" or "minor delay." Use exact figures and dates: "Revenue increased by 18% (AU$1.4M)" and "Delivery delayed by 11 calendar days to 14 October."
3. **The Executive Headline Rule:** Section headers must articulate the conclusion, not the topic.
4. **Zero Fluff and Rhetorical Filler:** Eliminate conversational framing phrases such as "It is worth noting that," "The team engaged in a fruitful discussion," or "As previously mentioned."

---

## SECTION 10: CONCLUDO INSIGHT ENGINE

The Concludo Insight Engine represents the intellectual core of Concludo's competitive differentiation. While legacy tools merely transcribe spoken dialogue, the Insight Engine analyzes the conversational transcript to identify what was **omitted, assumed without evidence, under-scoped, or strategically vulnerable**.

```
====================================================================================================
                        THE CONCLUDO INSIGHT ENGINE
====================================================================================================
  [STRUCTURED MEETING TRANSCRIPT & METADATA]
                    │
                    ▼
  [THE ELEVEN STRATEGIC INSIGHT CHANNELS]
    ├── Channel 1:  Missed Strategic Risks         (Latent regulatory or competitor threats)
    ├── Channel 2:  Missed Commercial Opportunities (Uncaptured revenue or partnership angles)
    ├── Channel 3:  Weak Assumptions               (Unvalidated metrics or optimistic timelines)
    ├── Channel 4:  Decision Gaps                  (Ambiguous ownership or absent boundaries)
    ├── Channel 5:  Governance Issues              (Exceeded delegations or missing approvals)
    ├── Channel 6:  Delivery & Execution Risks     (Unfunded mandates or resource crunches)
    ├── Channel 7:  Strategic Alignment Gaps       (Misalignment with stated corporate strategy)
    ├── Channel 8:  Capability Gaps                (Missing skills or technological debt)
    ├── Channel 9:  Stakeholder & Cultural Risks   (Absent key decision-makers or team friction)
    ├── Channel 10: Data & Information Gaps        (Key choices made in absence of baseline data)
    └── Channel 11: Planning Weaknesses            (Missing buffer days or optimistic scheduling)
                    │
                    ▼
  [VERIFICATION & GROUNDING GATE] ──(Anti-Invention)──> Grounded Citations & Remediations
                    │
                    ▼
  [EXECUTIVE CONCLUDO INSIGHTS PANEL] ──> Embedded in Deliverables (OUT-01 to OUT-58)
====================================================================================================
```

### 10.1 The Eleven Strategic Insight Channels

#### Channel 1: Missed Risks (Strategic and Regulatory Threats)
- **Detection Logic:** Evaluates discussion against external regulatory frameworks, competitive retaliation patterns, and macroeconomic headwinds. Triggered when major strategic commitments are made without evaluating competitive response or compliance constraints.
- **Business Value:** Prevents strategic blind spots and protects enterprise value.
- **Output Placement:** Executive Summary side panel, Risk Assessment Section, Board Briefing.

#### Channel 2: Missed Opportunities (Commercial and Efficiency Upside)
- **Detection Logic:** Scans dialogue for unmonetised assets, adjacent customer segments mentioned in passing, cross-sell opportunities, or scalable IP.
- **Business Value:** Unlocks latent revenue upside from existing conversational interactions.
- **Output Placement:** Commercial Opportunity Assessment, Business Plan Innovation annex.

#### Channel 3: Weak Assumptions
- **Detection Logic:** Identifies numerical assertions, timelines, or customer conversion claims that lack cited evidence or historical benchmarking (e.g., asserting "sales will double" without pipeline data).
- **Business Value:** Protects leadership from pursuing plans built on speculative optimism.
- **Output Placement:** Financial Assumptions section, Investment Proposal, Risk Register.

#### Channel 4: Decision Gaps
- **Detection Logic:** Flags collaborative consensus where no single named individual was assigned decision accountability, financial boundaries were omitted, or discarded alternatives were unrecorded.
- **Business Value:** Enforces governance rigour and eliminates ambiguous authority lines.
- **Output Placement:** Decision Pack, Governance Oversight Report, Meeting Health Score.

#### Channel 5: Governance Issues
- **Detection Logic:** Detects commitments that exceed organisational delegation of authority limits, violate audit separation of duties, or bypass statutory approval protocols.
- **Business Value:** Safeguards directors and officers from fiduciary non-compliance.
- **Output Placement:** Fiduciary Governance Briefing, Board Pack, Audit Committee Dossier.

#### Channel 6: Delivery Risks (Execution and Resource Bottlenecks)
- **Detection Logic:** Compares proposed timelines and deliverables against historical sprint velocity, team capacity, and uncommitted external vendor dependencies.
- **Business Value:** Prevents project delivery failure before resources are committed.
- **Output Placement:** Programme Report, Action Tracker, Sprint Review.

#### Channel 7: Strategic Alignment Gaps
- **Detection Logic:** Cross-references meeting determinations against stored corporate strategy documents in `public.knowledge_nodes`. Flags tactical actions that divert capital from primary corporate pillars.
- **Business Value:** Maintains whole-of-enterprise focus and prevents strategic drift.
- **Output Placement:** Strategy Brief, CEO Briefing, Executive Follow-Up.

#### Channel 8: Capability Gaps
- **Detection Logic:** Flags technical architectures, go-to-market strategies, or regulatory filings planned without the required internal personnel, certifications, or technological tooling.
- **Business Value:** Triggers timely recruitment, training, or partner engagement.
- **Output Placement:** Target Operating Model, Resource Plan, Capability Maturity Curve.

#### Channel 9: Stakeholder Risks (Cultural Alignment and Key Attendee Absence)
- **Detection Logic:** Analyzes attendee participation balance, conversational sentiment shifts, unaddressed objections, and the conspicuous absence of critical decision-makers.
- **Business Value:** Preserves team psychological safety and prevents stakeholder sabotage.
- **Output Placement:** Meeting Health Report, Leadership Alignment Brief.

#### Channel 10: Data Gaps (Unvalidated Assumptions and Missing Metrics)
- **Detection Logic:** Identifies moments where executives stated "we don't have those numbers" or "we'll assume for now" regarding material operational drivers.
- **Business Value:** Establishes explicit discovery and data collection tasks before capital allocation.
- **Output Placement:** Business Case, Financial Plan, QBR.

#### Channel 11: Planning Weaknesses
- **Detection Logic:** Flags project schedules that feature zero contingency buffers, overlapping critical path tasks, or unrealistic turnaround times during holiday periods.
- **Business Value:** Establishes achievable delivery timelines and prevents team burnout.
- **Output Placement:** Operational Gantt Chart, Project Health Report, Action Plan.

### 10.2 Anti-Invention and Evidence Verification Controls

To preserve tier-one consulting credibility, the Concludo Insight Engine strictly obeys the **Anti-Invention Protocol**:
1. **Verbatim Text Anchoring:** Every insight must link to at least one specific transcript utterance or documented institutional memory record.
2. **Explicit Uncertainty Labelling:** Insights are framed with calibrated confidence (e.g., "Potential Strategic Gap: Attendees resolved to launch in Q3, but transcript analysis reveals no discussion of regional regulatory compliance").
3. **No Hallucinated Remedies:** The engine identifies the gap and recommends specific human-led remediation actions rather than inventing plausible answers.


## SECTION 11: CONCLUDO RECOMMENDATION ENGINE

The Concludo Recommendation Engine synthesises extracted business intelligence, identified strategic gaps, and organisational risk registers into prioritised, actionable executive guidance. Recommendations are never generic; they represent calibrated strategic interventions designed to accelerate decision velocity, protect enterprise value, and ensure operational completion.

```
====================================================================================================
                    CONCLUDO RECOMMENDATION ENGINE ARCHITECTURE
====================================================================================================
  [STRUCTURED INTELLIGENCE & INSIGHTS]
                 │
                 ▼
  [THE TEN RECOMMENDATION CATEGORIES]
    1. Next Operational Actions      6. Business Improvements
    2. Recommended Next Meetings     7. Strategic Opportunities
    3. Required Key Attendees        8. Operational Improvements
    4. Urgent Needed Decisions       9. Leadership & Cultural Actions
    5. Critical Risk Mitigations    10. Executive Follow-Up Protocols
                 │
                 ▼
  [THE FOUR RECOMMENDATION ATTRIBUTES]
    ├── Supporting Logic (Why this recommendation is necessary)
    ├── Confidence Level (0-100 Bayesian confidence score)
    ├── Priority Level   (Urgent / High / Medium / Low)
    └── Business Impact  (Quantified financial, operational, or governance effect)
                 │
                 ▼
  [EXECUTIVE RECOMMENDATIONS DOSSIER] ──> Embedded in Output Packages
====================================================================================================
```

### 11.1 The Ten Recommendation Categories

#### 1. Next Actions (Operational Commitments)
- **Focus:** High-priority, immediate tasks required to maintain delivery momentum over the subsequent 48 to 72 hours.
- **Attributes:** Enforces the Five-Field Delegation Standard (Task, Single Owner, Calendar Due Date, Definition of Done, Checkpoint Date).

#### 2. Recommended Next Meetings
- **Focus:** Prevents meeting proliferation by recommending only necessary, purposeful forward sessions (e.g., "Schedule a 45-minute Architecture Decision Gate before Friday").
- **Attributes:** Defines explicit meeting purpose, target agenda, required inputs, and expected deliverables.

#### 3. Required Attendees (Missing Critical Stakeholders)
- **Focus:** Pinpoints critical stakeholders who were conspicuously absent from the collaborative session and whose input is legally, financially, or technically indispensable.
- **Attributes:** Identifies individual names, titles, reason for inclusion, and the specific decision authority they possess.

#### 4. Urgent Needed Decisions
- **Focus:** Highlights critical forks in the road where consensus was avoided, discussions stalled, or authority was unclear.
- **Attributes:** Frames the decision question, outlines the trade-offs between options, identifies the accountable executive, and sets a deadline for closure.

#### 5. Critical Risk Mitigations
- **Focus:** Translates 5x5 Enterprise Risk Register entries into immediate proactive countermeasures.
- **Attributes:** Assigns mitigation owner, establishes implementation checkpoints, and defines escalation triggers.

#### 6. Business Improvements
- **Focus:** Identifies opportunities to enhance revenue generation, expand gross margins, improve pricing models, or streamline commercial go-to-market.
- **Attributes:** Quantifies estimated revenue upside or margin improvement, required capital investment, and time to value.

#### 7. Strategic Opportunities
- **Focus:** Highlights structural market openings, potential corporate partnerships, innovative product features, or IP protection steps.
- **Attributes:** Defines strategic alignment with multi-year corporate goals and competitive defensibility impact.

#### 8. Operational Improvements
- **Focus:** Eliminates process friction, handoff bottlenecks, manual duplicate effort, and workflow delays identified during the meeting.
- **Attributes:** Maps current state versus proposed future state workflow, estimated hours saved, and tooling requirements.

#### 9. Leadership Actions (Cultural and Alignment Interventions)
- **Focus:** Recommends executive interventions to improve team alignment, resolve interpersonal friction, address burnout, and reinforce psychological safety.
- **Attributes:** Prescribes communication approach, coaching cadences, and team recognition moments.

#### 10. Executive Follow-Up Protocols
- **Focus:** Establishes formal governance communication loops for executive sponsors, clients, board committees, and external regulators.
- **Attributes:** Specifies communication format (memorandum, board note, formal briefing), audience distribution list, and delivery deadline.

---

## SECTION 12: MEETING HEALTH REPORT ARCHITECTURE

The Concludo Meeting Health Report is a dedicated diagnostic deliverable (`OUT-10`) that audits the collaborative efficiency, governance discipline, and conversational dynamics of an organisation's meetings. It provides executive leadership with an objective scorecard evaluating whether collaborative time is creating enterprise value or destroying productivity.

```
====================================================================================================
                        MEETING HEALTH SCORING FRAMEWORK (0-100)
====================================================================================================
  [1. Purpose Clarity]       (Weight: 10%) ──> Was the objective stated, understood, and achieved?
  [2. Decision Quality]      (Weight: 15%) ──> Were decisions authoritative, documented, and bounded?
  [3. Action Quality]        (Weight: 15%) ──> Did commitments meet the Five-Field Standard?
  [4. Participation Quality] (Weight: 10%) ──> Was speaking time balanced across critical roles?
  [5. Strategic Value]       (Weight: 15%) ──> Did discussions advance core enterprise priorities?
  [6. Facilitation Quality]  (Weight: 10%) ──> Was agenda managed efficiently with minimal drift?
  [7. Risk Coverage]         (Weight: 10%) ──> Were downside threats proactively identified and owned?
  [8. Opportunity Coverage]  (Weight: 5%)  ──> Were commercial upsides explored and captured?
  [9. Stakeholder Alignment] (Weight: 5%)  ──> Did attendees reach genuine, uncoerced alignment?
  [10. Outcome Quality]      (Weight: 5%)  ──> Did the session produce clear, tangible deliverables?
====================================================================================================
```

### 12.1 Detailed Scoring Anchors for the Ten Dimensions

#### 1. Purpose Clarity (10% Weight)
- **90-100:** Explicit written agenda and target deliverables stated in opening 2 minutes; session achieved 100% of stated objectives.
- **70-89:** Purpose clearly understood by attendees; minor conversational drift resolved promptly.
- **50-69:** Vague purpose stated; meeting wandered across multiple unannounced topics before finding focus.
- **0-49:** No purpose stated; attendees spent first 15 minutes debating why the meeting was scheduled.

#### 2. Decision Quality (15% Weight)
- **90-100:** Major decisions formally resolved with single accountable owners, documented rationale, and defined boundaries.
- **70-89:** Core decisions agreed in principle; minor implementation details left for follow-up.
- **50-69:** Discussions deferred critical decisions to future meetings without clear justification.
- **0-49:** Zero decisions reached; meeting served as an unstructured conversational loop re-litigating settled matters.

#### 3. Action Quality (15% Weight)
- **90-100:** 100% of extracted actions strictly satisfy the Five-Field Delegation Standard with named owners and firm dates.
- **70-89:** Majority of actions well-defined; 1-2 items lack explicit checkpoint dates.
- **50-69:** Actions assigned to collective groups ("the team") or given relative timelines ("ASAP").
- **0-49:** Zero actionable commitments; attendees exited with no clarity on forward responsibility.

#### 4. Participation Quality (10% Weight)
- **90-100:** Balanced conversational distribution; key technical and operational experts contributed actively; psychological safety evident.
- **70-89:** Good engagement across primary stakeholders; 1-2 attendees remained quiet but affirmed consensus.
- **50-69:** One or two dominant voices monopolised over 75% of speaking time; dissenting views discouraged.
- **0-49:** Single executive monologue; meeting was effectively an email read aloud to a captive audience.

#### 5. Strategic Value (15% Weight)
- **90-100:** Direct alignment with top-tier corporate objectives, high capital impact, or critical enterprise risk mitigation.
- **70-89:** Substantive operational value advancing active programme deliverables.
- **50-69:** Low-altitude tactical discussion that could have been resolved asynchronously via Slack or email.
- **0-49:** Trivial, circular debates disconnected from organisational strategy and business priorities.

#### 6. Facilitation Quality (10% Weight)
- **90-100:** Masterful time management; started and concluded on schedule; efficient topic transitions; firm parking lot management.
- **70-89:** Professional facilitation; minor schedule overrun (under 5 minutes) justified by substantive decision-making.
- **50-69:** Weak facilitation; tangent discussions allowed to run unchecked for extended periods.
- **0-49:** Complete collapse of facilitation; session ran over by 20+ minutes with no agenda adherence.

#### 7. Risk Coverage (10% Weight)
- **90-100:** Rigorous, proactive examination of downside scenarios, regulatory exposures, and vendor failure points; owners assigned.
- **70-89:** Downside risks acknowledged and documented; basic mitigation strategies outlined.
- **50-69:** Risks mentioned casually in passing but dismissed without formal evaluation or ownership.
- **0-49:** Blind optimism; attendees ignored obvious structural risks or actively suppressed concerns.

#### 8. Opportunity Coverage (5% Weight)
- **90-100:** Systematic exploration of commercial upside, process synergies, and innovative alternatives.
- **70-89:** Identified at least one substantive commercial or operational opportunity.
- **50-69:** Surface-level consideration of upside; conversation remained purely defensive.
- **0-49:** Zero opportunity awareness; defensive, bureaucratic posture throughout.

#### 9. Stakeholder Alignment (5% Weight)
- **90-100:** Authentic, uncoerced consensus achieved; open objections debated respectfully and resolved constructively.
- **70-89:** Broad alignment reached; minor reservations recorded for future review.
- **50-69:** Superficial head-nodding masking deep unresolved underlying philosophical disagreements.
- **0-49:** Open hostility, defensive siloing, or complete breakdown of cross-functional trust.

#### 10. Outcome Quality (5% Weight)
- **90-100:** Tangible, high-value deliverables generated (approved business plan, signed roadmap, resolved charter).
- **70-89:** Clear operational next steps and documented agreements produced.
- **50-69:** Vague agreements to continue discussing in subsequent forums.
- **0-49:** Net negative outcome; session generated confusion, duplicated work, and decreased morale.

### 12.2 The Overall Value Composite Calculation

The Overall Meeting Health Score is computed as a mathematically rigorous weighted composite index:

$$	ext{Health Score} = \sum_{i=1}^{10} (S_i 	imes W_i)$$

Where $S_i$ represents the score (0-100) of dimension $i$, and $W_i$ represents the assigned percentage weight.

### 12.3 The Six Classification Bands

| Band | Composite Score | Executive Meaning & Recommended Action |
| :--- | :--- | :--- |
| **Exceptional** | **90 - 100** | Elite collaborative execution. Serves as an organisational benchmark. Archive as a best-practice model in organisational learning. |
| **Excellent** | **80 - 89** | Highly effective session. Generated clear decisions, verified actions, and strong commercial value. Continue current operating cadence. |
| **Good** | **70 - 79** | Productive business meeting. Achieved core outcomes, but displays minor opportunities for improved timekeeping or risk rigour. |
| **Average** | **60 - 69** | Mediocre collaboration. Significant conversational drift, incomplete action definitions, or delayed decisions. Review facilitation. |
| **Poor** | **40 - 59** | Inefficient use of corporate capital. High time cost, weak decisions, diffused accountability. Coaching or format overhaul required. |
| **Waste of Time** | **0 - 39** | Destructive meeting failure. Zero decisions, no accountability, severe cognitive drain. Recommend immediate cancellation of recurring series. |

### 12.4 Psychological Safety and Governance Guardrails

Meeting Health scoring is an organisational improvement diagnostic, not a punitive surveillance tool:
1. **Aggregated Organisational Insights:** Individual participant speaking metrics are anonymised in company-wide reports to protect psychological safety.
2. **Coaching Focus:** Low scores trigger constructive facilitation recommendations rather than disciplinary flags.
3. **Executive Discretion:** Meeting health scores are private to meeting organizers and authorized workspace administrators.

---

## SECTION 13: MEETING MASTERY ALIGNMENT

Concludo's intelligence architecture directly incorporates the operational principles, facilitation diagnostics, and meeting standards established in the **Concludo Meeting Mastery Framework**. This ensures that software execution reinforces proven management behaviours.

### 13.1 Meeting Mastery Standards and Evaluative Frameworks

Concludo embeds six core workbook frameworks into automated pipeline scoring and deliverable generation:
1. **Meeting Success Indicators:** Clear governing objective stated within 2 minutes, balanced participation across critical subject-matter experts, formal recorded decisions with named owners, and 100% of actions adhering to the Five-Field Standard.
2. **Meeting Failure Indicators:** Circular unmoderated debate, diffused responsibility ("the team will handle it"), premature closure of complex risks, dominant monologue (>75% speaking time by one person), and ambiguous timelines ("ASAP").
3. **Preparation Standards:** Pre-flight distribution of context materials at least 24 hours prior, explicit definition of the target business artefact before calendar scheduling, and mandatory pre-qualification of attendees.
4. **Facilitation Standards:** Punctual start and conclusion, strict parking-lot enforcement for conversational tangents, active solicitation of dissenting perspectives, and explicit consensus testing before advancing agenda items.
5. **Decision Standards:** Mandatory recording of single decision owner, explicit business rationale, evaluated alternatives, financial limits, and review milestones in Decision Memory.
6. **Action Standards:** Strict adherence to the Five-Field Delegation Standard (Task, Single Owner, Due Date, Definition of Done, Checkpoint Date).


```
====================================================================================================
                        CONCLUDO MEETING MASTERY ALIGNMENT
====================================================================================================
  CONCLUDO WORKBOOK STANDARDS          MEETING INTELLIGENCE PIPELINE & OUTPUTS
  - Clear Governing Purpose      ───> Purpose Clarity Scoring & Executive Summary Lead
  - Decisive Fiduciary Closure   ───> Decision Memory Lineage & Discarded Option Audits
  - The 5-Field Delegation Rule  ───> Mandatory Action Tracker Schema Validation
  - Proactive Downside Auditing  ───> 5x5 Enterprise Risk Register & Mitigation Owners
  - Unspoken Cognitive Analysis  ───> Concludo Insight Engine & Strategic Blind Spot Detection
====================================================================================================
```

### 13.1 Core Workbook Principles Embedded in Architecture

#### 1. The Meeting Pre-Flight Test
No meeting should occur without a defined target deliverable. If a meeting cannot name the business artefact it intends to produce (e.g., an Approved Business Plan, a Signed Risk Register, a Prioritised Sprint Backlog), the session is flagged as a high-risk time sink.

#### 2. The Five-Field Delegation Standard
The bedrock of Concludo execution intelligence. Every action item must strictly define:
- Field 1: **Task Description** (Clear, unambiguous verb-object commitment).
- Field 2: **Single Named Owner** (Exactly one individual accountable for delivery; no shared groups).
- Field 3: **Calendar Due Date** (Specific calendar date; relative terms like "next week" are rejected).
- Field 4: **Definition of Done (DoD)** (Verifiable physical, digital, or financial completion criteria).
- Field 5: **Checkpoint Date** (Interim milestone review date to verify trajectory before the deadline).

#### 3. The Decision Immutability Principle
A decision once reached and recorded in Concludo Decision Memory cannot be casually re-litigated in subsequent meetings without a formal Corporate Resolution Memorandum (`OUT-24`) citing new material evidence. This eliminates corporate churn and accelerates decision velocity.

### 13.2 The Ten Meeting Failure Patterns (FL-01 to FL-10)

Concludo automatically diagnoses and flags the ten classic meeting failure patterns identified in the Concludo Meeting Mastery Framework:

1. **FL-01: The Circular Debate:** Attendees debate the same topic across 20+ minutes without converging on a decision or recording actionable alternatives.
2. **FL-02: The Diffusion of Responsibility:** Actions assigned to "we," "the team," or multiple co-owners, ensuring zero individual accountability.
3. **FL-03: The Premature Closure:** High-risk decisions finalised without examining alternative options or consulting key subject-matter experts.
4. **FL-04: The Information Monologue:** A single presenter talks continuously for over 80% of the session with zero interactive dialogue.
5. **FL-05: The Ambiguous Horizon:** Deadlines stated as "ASAP," "by end of quarter," or "soon," creating scheduling paralysis.
6. **FL-06: The Vanishing Sponsor:** Major capital or strategic decisions attempted in the absence of the executive with budgetary authority.
7. **FL-07: The Tangent Hijack:** A participant derails the primary agenda to pursue a niche, unaligned technical grievance for more than 10 minutes.
8. **FL-08: The Phantom Consensus:** Attendees nod in passive agreement but express substantive reservations immediately upon meeting conclusion.
9. **FL-09: The Unfunded Mandate:** Actions approved that require substantive external software, capital, or cross-team labour without resource allocation.
10. **FL-10: The Zombie Recurring:** A weekly status meeting that continues on calendars out of inertia despite generating near-zero decisions or actions.

---

## SECTION 14: OUTPUT QUALITY SCORING ENGINE

To guarantee that every deliverable generated by Concludo Workspace meets the exacting standards of elite management consulting firms, Concludo implements an automated four-dimensional **Output Quality Scoring Engine**. Every deliverable must achieve an overall score of at least 85 out of 100 before publication or export.

```
====================================================================================================
                        OUTPUT QUALITY SCORING ENGINE (DQI)
====================================================================================================
  [1. Output Completeness Score (OCS)]    (Weight: 25%) ──> All structural template sections populated
  [2. Business Quality Score (BQS)]       (Weight: 25%) ──> Commercial depth, unit economics, clarity
  [3. Strategic Quality Score (SQS)]      (Weight: 25%) ──> Long-term alignment, blind spots, moats
  [4. Executive Readiness Score (ERS)]    (Weight: 25%) ──> Formatting polish, tone, zero hallucination
                                                │
                                                ▼
  [COMPOSITE DELIVERABLE QUALITY INDEX (DQI)] ──> Minimum Pass Threshold: 85 / 100
====================================================================================================
```

### 14.1 The Four Deliverable Quality Indices

#### 1. Output Completeness Score (OCS - 25% Weight)
- **Definition:** Measures whether all mandatory sections, tables, visual models, and metadata headers specified in the master template (T1 to T19) are present and fully articulated.
- **Evaluation Criteria:** Deducts points for empty sections, placeholder headings, truncated tables, or missing visual models. Strictly validates adherence to the Stated Omission Standard.

#### 2. Business Quality Score (BQS - 25% Weight)
- **Definition:** Evaluates the commercial depth, quantitative rigor, and operational feasibility of the deliverable.
- **Evaluation Criteria:** Validates presence of financial metrics, ROI horizons, realistic unit economics, clear customer value propositions, and unambiguous delegation parameters.

#### 3. Strategic Quality Score (SQS - 25% Weight)
- **Definition:** Measures whether the deliverable addresses macro-environmental forces, competitive defensibility moats, risk exposures, and long-term organisational trajectory.
- **Evaluation Criteria:** Audits inclusion of 5x5 Risk Registers, Concludo Insights, strategic trade-off evaluations, and multi-horizon roadmap planning.

#### 4. Executive Readiness Score (ERS - 25% Weight)
- **Definition:** Evaluates presentation polish, visual hierarchy, tone of voice, and zero hallucination compliance.
- **Evaluation Criteria:** Audits adherence to the Action Title Rule, 3-Second Executive Scan Test, Poppins/Inter typography pairing, Navy/Gold design tokens, 100% Australian English, and zero em/en dashes.

### 14.2 The Composite Deliverable Quality Index (DQI)

$$	ext{DQI} = (	ext{OCS} 	imes 0.25) + (	ext{BQS} 	imes 0.25) + (	ext{SQS} 	imes 0.25) + (	ext{ERS} 	imes 0.25)$$

- **DQI >= 90:** Gold Standard (Immediate Board, Client, and Executive release).
- **85 <= DQI < 89:** Silver Standard (Passes enterprise release gate; minor styling adjustments permissible).
- **DQI < 85:** Rejected (Deliverable blocked from export; re-enters generation pipeline with explicit remediation prompts).

---

## APPENDIX A: COMPREHENSIVE OUTPUT CATALOGUE REGISTRY

Authoritative specification of all fifty-eight master deliverables (`OUT-01` to `OUT-58`) recognised within Concludo Workspace SaaS:

### Universal Spine Deliverables (`OUT-01` to `OUT-10`)
- **`OUT-01` Universal Meeting Report:** Complete operational record of session discussions, attendee contributions, and contextual dynamics.
- **`OUT-02` Executive Summary Briefing:** High-density 1-2 page executive synthesis enabling instant commercial comprehension.
- **`OUT-03` Master Action Tracker:** Comprehensive execution schedule enforcing the Five-Field Delegation Standard.
- **`OUT-04` Comprehensive Decision Pack:** Authoritative governance record capturing choices, rationales, boundaries, and discarded alternatives.
- **`OUT-05` Enterprise Risk Register:** 5x5 probability vs severity threat assessment with assigned mitigation owners.
- **`OUT-06` Commercial Opportunity Assessment:** Systematic catalogue of commercial upside, efficiency gains, and market expansion avenues.
- **`OUT-07` Strategic Direction Brief:** Multi-horizon competitive positioning and strategic priorities document.
- **`OUT-08` Leadership Alignment Briefing:** Inter-departmental coordination memorandum detailing cross-functional commitments.
- **`OUT-09` Executive Follow-Up Memorandum:** Formal executive communication summarizing session outcomes for senior stakeholders.
- **`OUT-10` Meeting Performance Report:** Comprehensive 10-dimension meeting health audit with collaborative efficiency scorecards.

### Catalogue Deliverables (`OUT-11` to `OUT-58`)
- **`OUT-11` Full Commercial Business Plan:** 16-section bankable commercial blueprint for ventures and business units.
- **`OUT-12` Formal Board Pack:** Strategic governance dossier prepared for company directors and committees.
- **`OUT-13` Commercial Business Case:** Rigorous capital justification comparing expenditure against commercial ROI.
- **`OUT-14` CEO Executive Briefing:** High-altitude strategic synthesis tailored specifically for the Chief Executive Officer.
- **`OUT-15` Transformation Programme Roadmap:** Multi-horizon change blueprint guiding enterprise technology and process shifts.
- **`OUT-16` Product Specification Blueprint:** Comprehensive product requirement definition with user stories and release gates.
- **`OUT-17` Target Operating Model:** Architectural definition of organisational capabilities, governance lines, and tools.
- **`OUT-18` Quarterly Business Review Dossier:** Retrospective and forward-looking performance scorecard across enterprise OKRs.
- **`OUT-19` Vendor Evaluation & Selection Scorecard:** Weighted options trade-off matrix evaluating commercial software and service partners.
- **`OUT-20` Investor Pitch Deck & Capital Memorandum:** High-impact investment proposal articulating market traction and financial returns.
- **`OUT-21` Product-Market Fit & Customer Discovery Brief:** Qualitative and quantitative synthesis of client pain points and buying criteria.
- **`OUT-22` Go-To-Market Execution Plan:** Commercial launch schedule covering pricing, distribution channels, and sales enablement.
- **`OUT-23` Decision Lineage Register:** Historical audit trail tracking the evolution, amendment, and supersession of corporate decisions.
- **`OUT-24` Corporate Resolution Memorandum:** Formal governance document executing a binding statutory or fiduciary decision.
- **`OUT-25` Sprint Commitment Register:** Agile engineering commitment ledger tracking sprint scope and acceptance criteria.
- **`OUT-26` Critical Path Task Schedule:** Project management schedule highlighting sequence constraints and delivery blockers.
- **`OUT-27` Corporate Strategy Paper:** Comprehensive long-term vision document detailing corporate goals and market moats.
- **`OUT-28` Market Expansion Strategy:** Strategic roadmap for geographical, regulatory, or demographic market penetration.
- **`OUT-29` Competitive Positioning Blueprint:** Detailed white-space analysis benchmarking capabilities against market rivals.
- **`OUT-30` Financial Assumptions & Forecast Model:** Three-year commercial projection deconstructing revenue drivers, burn rate, and margins.
- **`OUT-31` Revenue Model Architecture:** Commercial pricing framework analysing recurring subscriptions, tiers, and unit margins.
- **`OUT-32` Organisational Change Readiness Plan:** Stakeholder impact analysis and communication strategy for corporate transitions.
- **`OUT-33` Fiduciary Governance Briefing:** Compliance memorandum assessing legal exposure and corporate director duties.
- **`OUT-34` Audit Committee Evidence Dossier:** Cryptographic evidence ledger verifying internal controls and financial authorizations.
- **`OUT-35` Regulatory Compliance Report:** Statutory alignment audit benchmarking operations against specific regulatory frameworks.
- **`OUT-36` 5x5 Risk Heatmap Assessment:** Visual exposure model plotting likelihood versus consequence across enterprise domains.
- **`OUT-37` Risk Mitigation Action Plan:** Tactical execution schedule assigning mitigation countermeasures to specific risk events.
- **`OUT-38` Vendor & Supply Chain Vulnerability Audit:** Exposure analysis evaluating third-party dependencies and single points of failure.
- **`OUT-39` Operational Efficiency Blueprint:** Process re-engineering report detailing workflow bottlenecks and automation gains.
- **`OUT-40` Strategic Partnership Evaluation Paper:** Commercial synergy assessment analysing joint ventures and distribution alliances.
- **`OUT-41` Innovation Pipeline Brief:** Concept evaluation memo filtering emerging technologies and product ideas.
- **`OUT-42` C-Suite Strategic Decision Pack:** Multi-stakeholder decision memorandum designed for executive leadership consensus.
- **`OUT-43` Portfolio Performance Scorecard:** PMO dashboard evaluating health, budget variance, and velocity across all active programmes.
- **`OUT-44` Board Strategic Committee Memorandum:** Targeted governance paper prepared for specialized board subcommittees.
- **`OUT-45` Quarterly Board Governance Pack:** Comprehensive quarterly governance dossier incorporating all statutory reporting pillars.
- **`OUT-46` Director Fiduciary Disclosure Document:** Formal statutory disclosure memo documenting potential conflicts and material interests.
- **`OUT-47` Enterprise Architecture Transition Plan:** Technical systems roadmap mapping legacy deprecation and target-state deployment.
- **`OUT-48` Post-Merger Integration Playbook:** Operational harmonisation schedule aligning cultures, technologies, and teams post-M&A.
- **`OUT-49` Incident Root Cause Retrospective:** Forensic post-mortem reconstructing technical outages or operational failures.
- **`OUT-50` PMO Stage-Gate Review Memorandum:** Formal checkpoint assessment evaluating project criteria before capital phase release.
- **`OUT-51` Executive Succession & Talent Architecture:** Leadership continuity plan mapping high-potential talent against critical roles.
- **`OUT-52` Customer Experience Journey Map:** Diagnostic blueprint tracing client touchpoints, friction points, and moments of delight.
- **`OUT-53` Brand Identity & Messaging Architecture:** Corporate positioning guide defining brand voice, core narratives, and audience messaging.
- **`OUT-54` Pricing Sensitivity & Packaging Strategy:** Quantitative analysis evaluating price elasticity, packaging tiers, and discounting.
- **`OUT-55` Cloud Infrastructure Cost Optimisation Plan:** Systems audit identifying cloud waste, reserved capacity, and hosting efficiency.
- **`OUT-56` Data Privacy & Security Governance Dossier:** Formal compliance audit evaluating adherence to the Australian Privacy Principles.
- **`OUT-57` Workplace Health & Safety (WHS) Hazard Audit:** Comprehensive physical and psychological workplace safety assessment.
- **`OUT-58` Business Continuity & Disaster Recovery Plan:** Operational resilience protocol detailing failover mechanisms and RTO/RPO targets.

---

## APPENDIX B: ENGINEERING BUILD SEQUENCING AND RELEASE GATES

Development of the Concludo Output Intelligence System follows a disciplined four-tier release gate architecture:

```
====================================================================================================
                        ENGINEERING BUILD SEQUENCING & RELEASE GATES
====================================================================================================
  GATE 1: UNIVERSAL SPINE FOUNDATION (Tasklets 1-10)
  - Core Spine Deliverables: OUT-01 to OUT-10 fully operational.
  - Core Visuals: VIS-01, VIS-02, VIS-03, VIS-04, VIS-13 active.
  - Strict RLS and Australian English enforcement verified.

  GATE 2: COMMERCIAL & STRATEGY SUITE (Tasklets 11-16)
  - Business Plans (OUT-11), Business Cases (OUT-13), Strategy Briefs (OUT-07).
  - Advanced Visuals: VIS-06 (Roadmap), VIS-07 (SWOT), VIS-08 (Canvas), VIS-15 (Waterfall).
  - Integration with Decision Memory and Action Tracker.

  GATE 3: EXECUTIVE & GOVERNANCE PLATFORM (Tasklets 17-21)
  - Board Packs (OUT-12), CEO Briefings (OUT-14), Transformation Roadmaps (OUT-15).
  - Advanced Visuals: VIS-09, VIS-10, VIS-11, VIS-12, VIS-19, VIS-23.
  - Concludo Insight Engine and Recommendation Engine active.

  GATE 4: AUTONOMOUS STRATEGIC OPERATIONS (Tasklets 22-23+)
  - Complete 58-deliverable catalogue and 28-visualisation model suite active.
  - Copilot and AI Agent autonomous output compilation with human approval gates.
  - Knowledge graph integration, digital twin simulations, and predictive health modeling.
====================================================================================================
```

---

## APPENDIX C: ARCHITECTURAL GOVERNANCE AND OPEN DECISION LOG

### Decision Record 1: Strict Zero Em Dash and Zero En Dash Enforcement
- **Status:** Approved and permanently locked.
- **Context:** To ensure clean typographical elegance, eliminate rendering inconsistencies across platforms, and adhere strictly to executive consulting styling, all em dashes (` - `) and en dashes (` - `) are banned from Concludo codebase, documentation, and deliverable outputs.
- **Enforcement:** Automated regex assertions in CI/CD pipeline and GitHub Actions pre-commit hooks.

### Decision Record 2: Precedence of A0 Pipeline Over Direct Transcript Generation
- **Status:** Approved and permanently locked.
- **Context:** Resolves architectural debate regarding whether lightweight summaries can bypass the Meeting Intelligence Pipeline.
- **Determination:** Direct transcript generation is strictly prohibited. Every deliverable must query structured relational database entities and knowledge graph nodes populated by Tasklet A0. This ensures auditable provenance, data consistency, and tier-one consulting quality.

### Decision Record 3: Mandatory Five-Field Delegation Standard
- **Status:** Approved and permanently locked.
- **Context:** Generic task bullet points diffuse organisational accountability and create execution failure.
- **Determination:** Every action item emitted in any Concludo deliverable must specify Task Description, Single Named Owner, Explicit Due Date, Definition of Done, and Checkpoint Date. Records failing this standard are quarantined for human resolution.


## SECTION 15: OPERATING MODEL AND ENGINEERING RUNTIME SPECIFICATION

### 15.1 Architectural Components and Pipeline Integration

Concludo Workspace executes the Output Intelligence System through five decoupled runtime components operating under the Node.js/Vite middleware layer (`app/src/server/`):

```
====================================================================================================
                        ENGINEERING RUNTIME COMPONENT TOPOLOGY
====================================================================================================
  [Tasklet A0 Pipeline Engine]
               │
               ▼
  [Intelligence Database Records (PostgreSQL / Supabase)]
               │
               ▼
  [Output Selection Switchboard (outputSelectionEngine.ts)]
    ├── Evaluates Meeting Classification (M-01 to M-50) & Context Variables (CV-1 to CV-8)
    ├── Validates Data Sufficiency Gates
    └── Emits Deliverable Generation Manifest (JSON)
               │
               ▼
  [Template Compilation Engine (documentTemplateEngine.ts)]
    ├── Hydrates Master Templates (T1 to T19)
    ├── Embeds 28 Visual Models (VIS-01 to VIS-28 via visualisationEngine.ts)
    └── Executes Concludo Insight Engine & Recommendation Engine
               │
               ▼
  [Deliverable Quality Scoring Engine (qualityScoringEngine.ts)]
    ├── Computes OCS, BQS, SQS, ERS, and Composite DQI
    └── Enforces Minimum 85/100 Release Gate
               │
               ▼
  [Rendering & Multi-Format Export Pipeline]
    ├── Interactive Tailwind React DOM (app.concludo.com)
    ├── Print-Optimised CSS / Headless Chromium Vector PDF
    └── Structured JSON API & Webhook Payload (Planner, Slack, CRM)
====================================================================================================
```

### 15.2 The 9 Processing Engines of Concludo Workspace

Concludo Workspace coordinates nine specialized computational engines to power the Output Intelligence System:

1. **Classification Engine:** Resolves meeting audio and diarisation to the 50-type taxonomy (`M-01` to `M-50`).
2. **Extraction Engine:** Populates structured relational tables for decisions, actions, risks, opportunities, and attendees.
3. **Meeting Health Engine:** Computes the 10-dimension meeting health score (0-100) and six classification bands.
4. **Output Selection Engine:** Determines the mandatory primary and secondary deliverable manifest.
5. **Template Engine:** Hydrates structured intelligence into the 19 consulting-grade document blueprints.
6. **Visualisation Engine:** Generates clean, accessible SVG/Canvas visual models adhering to the Four Visual Tests.
7. **Insight Engine:** Audits conversational dialogue to identify unstated assumptions, planning gaps, and governance issues.
8. **Recommendation Engine:** Emits prioritized, high-impact operational and strategic interventions.
9. **Quality Scoring Engine:** Enforces the Deliverable Quality Index (DQI >= 85) before deliverable publication.

## SECTION 16: STRATEGIC FUTURE STATE AND PLATFORM AUTHORITY

### 16.1 The Seven Strategic Horizons of Corporate Intelligence

This architecture positions Concludo not merely as an artificial intelligence transcription tool, but as the foundational **Executive Operating System** for modern enterprises. Concludo ascends through seven strategic horizons:

1. **Horizon 1: Meeting Intelligence:** Transforming ephemeral conversational speech into structured, factual data.
2. **Horizon 2: Decision Intelligence:** Preserving institutional memory, eliminated relitigation, and maintaining fiduciary governance.
3. **Horizon 3: Execution Intelligence:** Enforcing rigorous operational accountability through the Five-Field Delegation Standard.
4. **Horizon 4: Knowledge Graph Substrate:** Connecting disparate meetings, decisions, and risks into an enterprise neural network.
5. **Horizon 5: Governed Copilot Platform:** Delivering sub-150ms executive queries against verified business intelligence with zero transcript re-processing.
6. **Horizon 6: Strategic Intelligence:** Modeling organisational health, simulating scenarios, and predicting delivery friction.
7. **Horizon 7: The Executive Operating System:** The autonomous, proactive digital Chief of Staff powering enterprise leadership.
