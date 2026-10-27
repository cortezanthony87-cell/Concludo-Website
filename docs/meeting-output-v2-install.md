# Meeting Output v2 installation, 27 October 2026

Authorised: Anthony requested installation/deployment and explicitly approved fixing the baseline test failure first.

## Changes
- Installed the supplied v2 engine, scoped studio/styles/fonts, samples, saved-record viewer and persistence adapter.
- Replaced MeetingOutputPage and wrapped OutputDocumentRenderer, preserving the legacy renderer for non-v2 records.
- Repaired Phase 9's expired September fixture using relative dates; added stale-record and cross-tenant exclusion assertions. No production retrieval policy changed.
- Integration correction: use the bundled matching PDF worker for this page's existing file parser rather than an unavailable CDN version.
- Integration correction: print from a temporary document-only container outside the fixed-height Workspace shell. Remove the container after printing/unmount. Without this correction, the real shell printed only one of seven pages despite passing standalone tests.
- Persistence guardrails: fail closed when project ownership cannot be read; surface source-file write failures with partial-save disclosure instead of silently claiming success.

## Observed validation
- TypeScript and build passed. Existing fontkit export/large-chunk warnings remain.
- App unit tests: 71 passed, 0 failed; 1,000 assertions.
- Declared repository release suite: 489/489. Its deliberately invalid-region test logs a critical warning; that output is not a live-region inspection.
- Supplied engine suite: 9 passed.
- Supplied browser suite: 28 passed, 0 failed.
- Actual WorkspaceLayout and MeetingOutputPage, with explicitly synthetic local auth/notification stand-ins and external requests blocked: sample counts 4 decisions, 9 actions, 4 risks, 4 open items; Board briefing 7 pages; Executive summary 1 page; no document/content sideways overflow at 390/834/1440px; no page exceptions. Actual rendered desktop/mobile screenshots inspected against supplied references.
- Real DOCX and PDF fixtures imported through the Workspace parser without external requests. Chromium PDF output contains seven A4 sheets, document-only.
- Read-only production schema inspection confirms nullable action_tracker.owner_name and decision_memory.decision_reasoning and outputs.json_content availability. Current outputs_output_type_check requires nonempty text rather than the package's assumed enumeration; v2 still uses only existing standard types.

## Limits and unchanged systems
Save mapping is verified with recording mocks, not an authenticated production round trip. No available Workspace browser session or saved login was present. Real account save/reopen and live RLS-denial tests remain unverified; no test project was created/deleted in production. Historical v1 text remains unchanged.

No migration, runtime dependency, payment change, mailbox/calendar connection, global stylesheet change, CRM/Email change or logo alteration. No external actions are enabled. Signal colours supplied by the design are retained.

## Rollback
Restore pre-install main 5d562bccf1abe46bcaf9a395445e8d4073d2b2f6 and gh-pages 3d86a8139405b0d980faf8f880bda71e8fd99319 through normal reviewed release steps. Do not rewrite/delete saved records or alter schema. v2 records use existing output types.
