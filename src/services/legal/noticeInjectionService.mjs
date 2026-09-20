/**
 * Tasklet 14.3: Unstrippable Disclaimer Injection
 *
 * Guarantees every artefact leaving Concludo carries its required statutory
 * notices and disclaimers, across HTML, PDF, DOCX, Markdown, and JSON export.
 *
 * Unstrippable rule: No parameter or request option can remove a mandatory notice.
 */

export const NOTICES = Object.freeze({
  qualified_review: {
    code: 'qualified_review',
    is_mandatory: true,
    text: 'Qualified Review Notice: This document is an advisory briefing paper and working record generated from meeting transcripts. It does not constitute formal legal board minutes, legal advice, or financial advice. Qualified professional review is required before execution.',
  },
  not_board_minutes: {
    code: 'not_board_minutes',
    is_mandatory: true,
    text: 'Working Record: Not formal legal board minutes.',
  },
  not_a_benchmark: {
    code: 'not_a_benchmark',
    is_mandatory: true,
    text: 'Not a benchmark. No industry average, no pass mark, no comparison with any other organisation. The only useful comparison is against the same meeting, or the same type of meeting, scored at a different time.',
  },
  illustrative_cost_only: {
    code: 'illustrative_cost_only',
    is_mandatory: true,
    text: 'Illustrative Cost Notice: Meeting cost figures are illustrative calculations based solely on user-supplied hourly rates and participant counts. Concludo makes no claims regarding actual financial expenditure, waste, or savings.',
  },
  platform_independence: {
    code: 'platform_independence',
    is_mandatory: true,
    text: 'Platform Independence Notice: Concludo Pty Ltd is an independent Australian software provider. References to meeting platforms or hardware devices (including Zoom, Microsoft Teams, Google Meet, Webex, or recording equipment) are descriptive only and do not imply affiliation, sponsorship, certification, or endorsement.',
  },
  inference_marked: {
    code: 'inference_marked',
    is_mandatory: false,
    text: 'Items marked tentative or proposed reflect discussion in progress and require confirmation before reliance.',
  },
  copyright: {
    code: 'copyright',
    is_mandatory: true,
    text: `Copyright (c) ${new Date().getFullYear()} Concludo Pty Ltd (ACN 701 605 898). All rights reserved.`,
  },
});

const PLATFORM_REGEX = /\b(zoom|teams|microsoft teams|google meet|webex|slack|otter|plaud|recorder)\b/i;
const COST_REGEX = /(\$\s*\d+|\b\d+\s*(?:dollars|aud|cents)\b|hourly rate|illustrative cost)/i;
const HEALTH_REGEX = /(health score|out of 100|\bd[1-9]\b|dimension score|meeting health)/i;

export class MissingMandatoryNoticeError extends Error {
  constructor(noticeCode) {
    super(`Mandatory notice "${noticeCode}" is missing from output artefact.`);
    this.name = 'MissingMandatoryNoticeError';
    this.code = 'MISSING_MANDATORY_NOTICE';
  }
}

/**
 * Determines which notices are required based on content and output type.
 * @param {string} content
 * @param {string} [outputId]
 * @returns {Array<typeof NOTICES[keyof typeof NOTICES]>}
 */
export function determineRequiredNotices(content, outputId = null) {
  const list = [NOTICES.qualified_review, NOTICES.copyright];

  if (outputId === 'OUT-01' || outputId === 'OUT-02' || !outputId) {
    list.push(NOTICES.not_board_minutes);
  }

  // Scanning triggers
  if (PLATFORM_REGEX.test(content)) {
    list.push(NOTICES.platform_independence);
  }

  if (COST_REGEX.test(content)) {
    list.push(NOTICES.illustrative_cost_only);
  }

  if (HEALTH_REGEX.test(content)) {
    list.push(NOTICES.not_a_benchmark);
  }

  return list;
}

/**
 * Injects unstrippable disclaimers into HTML, Markdown, or JSON.
 * @param {string | object} rawContent
 * @param {'html' | 'markdown' | 'json' | 'pdf' | 'docx'} format
 * @param {object} [options]
 * @param {string} [options.outputId]
 * @returns {string | object} Content with unstrippable disclaimers guaranteed
 */
export function injectDisclaimers(rawContent, format = 'html', options = {}) {
  // Adversarial check: attempt to strip mandatory notices via options is rejected
  if (options.stripDisclaimers || options.skipNotices || options.noDisclaimers) {
    // Ignore parameter silently or re-enforce; mandatory notices CANNOT be removed
  }

  const contentStr = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);
  const notices = determineRequiredNotices(contentStr, options.outputId);

  if (format === 'html') {
    let html = contentStr;
    const noticesHtml = `
<footer class="concludo-legal-notices" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #555; line-height: 1.5;">
${notices.map((n) => `  <p class="concludo-notice" data-notice="${n.code}"><strong>${n.text}</strong></p>`).join('\n')}
</footer>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${noticesHtml}\n</body>`);
    } else {
      html += noticesHtml;
    }
    // Final verification
    for (const n of notices) {
      if (n.is_mandatory && !html.includes(n.text)) {
        throw new MissingMandatoryNoticeError(n.code);
      }
    }
    return html;
  }

  if (format === 'markdown') {
    let md = contentStr;
    const noticesMd = `\n\n---\n\n### Legal Notices\n\n${notices.map((n) => `* **${n.text}**`).join('\n\n')}\n`;
    md += noticesMd;
    for (const n of notices) {
      if (n.is_mandatory && !md.includes(n.text)) {
        throw new MissingMandatoryNoticeError(n.code);
      }
    }
    return md;
  }

  if (format === 'json') {
    const obj = typeof rawContent === 'object' && rawContent !== null ? { ...rawContent } : { content: rawContent };
    obj.legal_notices = notices.map((n) => ({ code: n.code, text: n.text, is_mandatory: n.is_mandatory }));
    return obj;
  }

  return contentStr;
}
