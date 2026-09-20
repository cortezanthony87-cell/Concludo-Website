/**
 * Tasklet 7.3: Board Styling Engine
 * Applies board paper styling, letterhead, motion typography,
 * recorded position boxes, and signature blocks.
 *
 * Mandatory rule: Produces working records and briefing papers, never board minutes.
 * Mandatory notice: "Requires qualified review: working record for briefing purposes, not formal board minutes."
 */

export class BoardStylingEngine {
  constructor(options = {}) {
    this.isDraft = options.isDraft ?? true;
    this.mandatoryNotice = 'Requires qualified review: working record for briefing purposes, not formal board minutes.';
  }

  formatBoardDocument(payload) {
    if (!payload) throw new Error('Board payload is required');

    // Strict prohibition check: title or document cannot be labelled "minutes"
    const title = (payload.title || '').toLowerCase();
    if (/\bboard\s+minutes\b/i.test(title) || /\bminutes\s+of\s+meeting\b/i.test(title)) {
      throw new Error('PROHIBITED CLAIM: Board documents produced by Concludo are working records and briefing papers, never board minutes.');
    }

    const motions = payload.motions || [];
    const positions = payload.recorded_positions || [];
    const signatories = payload.signatories || [];

    const motionsHtml = motions.map((m, idx) => `
      <div class="board-motion-box">
        <div class="motion-header"><strong>Motion ${idx + 1}:</strong> ${m.title || ''}</div>
        <div class="motion-text">${m.motion || m.text || ''}</div>
        <div class="motion-proposer">Proposed by: ${m.proposer || 'Unrecorded'} | Seconded by: ${m.seconder || 'Unrecorded'}</div>
        <div class="motion-outcome">Disposition: <strong>${m.outcome || 'CARRIED'}</strong></div>
      </div>
    `).join('');

    const positionsHtml = positions.map((p, idx) => `
      <div class="board-position-card">
        <span class="position-title">${p.matter || `Matter ${idx + 1}`}:</span>
        <span class="position-summary">${p.summary || ''}</span>
      </div>
    `).join('');

    // Signatory lines: if director names unassigned, provide placeholder lines
    const sigHtml = (signatories.length ? signatories : [
      { name: 'Chairperson / Director', title: 'Director' },
      { name: 'Company Secretary', title: 'Secretary' },
    ]).map(s => `
      <div class="sig-block">
        <div class="sig-line"></div>
        <div class="sig-name">${s.name}</div>
        <div class="sig-title">${s.title}</div>
      </div>
    `).join('');

    return `
    <div class="board-paper-wrapper ${this.isDraft ? 'watermark-draft' : ''}">
      <div class="board-letterhead">
        <div class="board-emblem">CONCLUDO BOARD REVIEW</div>
        <div class="board-advisory-notice">${this.mandatoryNotice}</div>
      </div>

      ${motions.length ? `<div class="board-motions-section"><h3>Board Motions</h3>${motionsHtml}</div>` : ''}
      ${positions.length ? `<div class="board-positions-section"><h3>Recorded Positions</h3>${positionsHtml}</div>` : ''}

      <div class="board-signatures-section">
        <h3>Attestation Placeholder</h3>
        <div class="signatures-grid">${sigHtml}</div>
      </div>
    </div>`;
  }

  getBoardCss() {
    return `
.board-paper-wrapper {
  position: relative;
  border-top: 3px double #16263F;
  margin-top: 20px;
  padding-top: 15px;
}

.watermark-draft::before {
  content: "CONFIDENTIAL DRAFT";
  position: absolute;
  top: 40%;
  left: 15%;
  transform: rotate(-30deg);
  font-size: 60px;
  font-weight: 800;
  color: rgba(22, 38, 63, 0.05);
  pointer-events: none;
  z-index: 0;
}

.board-letterhead {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #E2B53C;
  padding-bottom: 8px;
  margin-bottom: 16px;
}

.board-emblem {
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 1px;
  color: #16263F;
}

.board-advisory-notice {
  font-size: 11px;
  font-style: italic;
  color: #555555;
  max-width: 60%;
  text-align: right;
}

.board-motion-box {
  background: #FAFBFD;
  border-left: 3px solid #21395C;
  padding: 10px 14px;
  margin-bottom: 12px;
  font-size: 13px;
}

.motion-header {
  color: #16263F;
  margin-bottom: 4px;
}

.motion-proposer, .motion-outcome {
  font-size: 11px;
  color: #666666;
  margin-top: 4px;
}

.board-position-card {
  padding: 6px 0;
  border-bottom: 1px dashed #CCD4E0;
  font-size: 13px;
}

.position-title {
  font-weight: 600;
  color: #21395C;
}

.signatures-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 30px;
  margin-top: 30px;
}

.sig-block {
  text-align: left;
}

.sig-line {
  border-bottom: 1px solid #16263F;
  margin-bottom: 6px;
  height: 35px;
}

.sig-name {
  font-size: 12px;
  font-weight: 600;
  color: #16263F;
}

.sig-title {
  font-size: 11px;
  color: #666666;
}
    `.trim();
  }
}
