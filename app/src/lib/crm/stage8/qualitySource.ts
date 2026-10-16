/**
 * Where a report's data-quality figure comes from, and when it refuses to
 * compute one.
 *
 * THE PROBLEM, MEASURED. `workspaceFlags` walks every contact, organisation and
 * piece of work and builds the flags for each. Indexed, it runs in 21
 * milliseconds over a thousand records and 6.4 seconds over a hundred and ten
 * thousand. That is linear, not a bug, and it is still far too slow to do while
 * somebody waits for a page: nothing a person reads should take six seconds to
 * assemble, and a figure assembled from every record in the workspace is not a
 * page-time question.
 *
 * THE ANSWER IS NOT A FASTER SWEEP. It is to stop doing the sweep on the way to
 * a screen. Stage 3 already built the table for this: `crm_record_quality`
 * holds nine named measures per record with a `computed_at`, written by a job.
 * So above a threshold, a report reads what the job computed and says when it
 * ran. Where no job has run, the report says the figure is not available and
 * names what would make it available, which is the honest answer and the one
 * that gets the job scheduled.
 *
 * WHY A THRESHOLD AND NOT ALWAYS PRECOMPUTED. Most Concludo workspaces will
 * have a few hundred records. Making a sole trader wait for an overnight job to
 * find out that two of their contacts are duplicates would be absurd, and a
 * figure that is minutes old is worse than one that is current when computing
 * the current one costs twenty milliseconds. Below the threshold it is
 * computed live, and the page says that too.
 *
 * EITHER WAY THE READER IS TOLD WHICH. A figure whose age is unknown is a
 * figure somebody will act on at the wrong moment.
 */

import { CrmWorkspaceData } from '../domain';
import { FlaggedRecord, countByKind, workspaceFlags } from '../stage4/quality';
import { indexFor } from './paging';

/**
 * Above this many live records, the sweep is not run while somebody waits.
 *
 * Five thousand is where the measured cost crosses roughly a quarter of a
 * second on the hardware this was measured on, which is about as long as a page
 * can spend on one figure among several. It is a constant here rather than a
 * setting because it describes the software's cost, not the business.
 */
export const LIVE_SWEEP_LIMIT = 5_000;

export type QualityFigureSource = 'computed_now' | 'precomputed' | 'not_available';

export interface QualityFigure {
  source: QualityFigureSource;
  /** Records with something recorded against them, or null where unknown. */
  flaggedRecords: number | null;
  /** How many live records the figure covers. Always known. */
  liveRecords: number;
  /** Set only where the figure was computed live. */
  flags: FlaggedRecord[] | null;
  /** When the figure was computed, where that is known. */
  computedAt: string | null;
  /** What the page says under the number. Never blank, never vague. */
  note: string;
  /** Present where the figure is not available. */
  whatWouldFixIt: string | null;
}

export function qualityFigure(data: CrmWorkspaceData, now: string): QualityFigure {
  const index = indexFor(data);
  const liveRecords =
    index.livePeople.length + index.liveOrganisations.length + index.openWorkItems.length;

  if (liveRecords <= LIVE_SWEEP_LIMIT) {
    const flags = workspaceFlags(data, now);
    return {
      source: 'computed_now',
      flaggedRecords: flags.length,
      liveRecords,
      flags,
      computedAt: now,
      note: `Checked just now, across ${liveRecords.toLocaleString('en-AU')} live records.`,
      whatWouldFixIt: null,
    };
  }

  // Above the threshold: read what the job wrote.
  const rows = data.recordQuality;
  if (rows.length === 0) {
    return {
      source: 'not_available',
      flaggedRecords: null,
      liveRecords,
      flags: null,
      computedAt: null,
      note: `Not available. This workspace holds ${liveRecords.toLocaleString('en-AU')} live records, which is more than Concludo will check while you wait.`,
      whatWouldFixIt:
        'The nightly record-quality job writes these figures. It has not run against this workspace. Until it does, the data-quality page checks records as you open them, one at a time.',
    };
  }

  const flagged = rows.filter(
    (row) =>
      row.openConflicts > 0 ||
      row.openDuplicates > 0 ||
      row.completenessMissingFields.length > 0 ||
      row.reviewStatus === 'needs_review' ||
      (row.freshnessDays !== null && row.freshnessDays > 90)
  );

  const computedAt = rows
    .map((row) => row.computedAt)
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1) ?? null;

  const hoursOld =
    computedAt === null
      ? null
      : Math.floor((Date.parse(now) - Date.parse(computedAt)) / 3_600_000);

  return {
    source: 'precomputed',
    flaggedRecords: flagged.length,
    liveRecords,
    flags: null,
    computedAt,
    note:
      hoursOld === null
        ? `From the record-quality job. Covers ${rows.length.toLocaleString('en-AU')} of ${liveRecords.toLocaleString('en-AU')} live records.`
        : `As at ${hoursOld === 0 ? 'less than an hour ago' : `${hoursOld} ${hoursOld === 1 ? 'hour' : 'hours'} ago`}, covering ${rows.length.toLocaleString('en-AU')} of ${liveRecords.toLocaleString('en-AU')} live records. Anything changed since is not counted here.`,
    whatWouldFixIt:
      rows.length < liveRecords
        ? `The job has figures for ${rows.length.toLocaleString('en-AU')} records and this workspace has ${liveRecords.toLocaleString('en-AU')}. The rest have never been checked.`
        : null,
  };
}

/**
 * The per-kind counts, where they can be had.
 *
 * Returns null rather than zeroes above the threshold, because a row of zeroes
 * means "nothing is wrong" and the truth is "nobody has looked".
 */
export function qualityCounts(
  figure: QualityFigure
): ReturnType<typeof countByKind> | null {
  return figure.flags === null ? null : countByKind(figure.flags);
}
