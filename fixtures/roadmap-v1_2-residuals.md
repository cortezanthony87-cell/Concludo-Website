# Residuals after patch v2, quoted verbatim from Implementation Roadmap v1.1 (second revision)

### Tasklet 3.1: Risk Detection
* **Objective**: Detect, classify, and rate operational, financial, legal, and delivery risks articulated or implied during meetings (Channel INS-A).

### Tasklet 3.2: Opportunity Detection
* **Objective**: Identify commercial, efficiency, innovation, and partnership opportunities surfaced in discussions (Channel INS-B).

### Tasklet 3.3: Strategic Gap Detection
* **Objective**: Uncover misalignments between stated corporate objectives, current project velocity, and resource allocations (Channel INS-C).

### Tasklet 3.4: Missing Stakeholder Detection
* **Objective**: Identify impacted teams, compliance officers, customers, or key individuals who should have been consulted but were absent from discussions (Channel INS-D).

### Tasklet 3.5: Weak Assumption Detection
* **Objective**: Pinpoint critical unverified assumptions, hand-waving assertions, and reliance on unvalidated data during decision-making (Channel INS-E).

### Tasklet 3.6: Governance Analysis
* **Objective**: Audit meeting compliance against statutory board rules, delegated authority limits, quorum requirements, and regulatory standards (Channel INS-F).

### Tasklet 6.5: Roadmap Renderer
* **Objective**: Render multi-horizon strategic and product roadmaps (VIS-05) across Now, Next, and Later horizons or calendar quarters.

### Tasklet 9.3
  * Individual participant talk times protected under privacy settings if configured.

### Tasklet 2.9 materialised view
      SUM(illustrative_cost_aud) FILTER (WHERE user_supplied_hourly_rates_used = true) AS illustrative_meeting_cost,
  FROM public.meeting_health_runs

### Section 13.4
* **Prerequisites**: Pro subscription capabilities (T2) complete.
* **Prerequisites**: Team subscription (T3) complete.
