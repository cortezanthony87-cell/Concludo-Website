/**
 * The guided importer.
 *
 * Six steps, in order, and the order is the product: choose what you are
 * importing, paste or choose the file, check the mapping, read the validation,
 * read the dry run, commit. Then, if it went wrong, roll it back.
 *
 * THREE THINGS THIS SCREEN WILL NOT DO.
 *
 * It will not map a column by itself. Every suggestion says why it was made and
 * every one can be rejected. A column left unmapped is named as ignored rather
 * than quietly dropped, because "where did the mobile numbers go" is the
 * question that follows an importer that guessed.
 *
 * It will not commit without a preview. The commit button is disabled until the
 * dry run has been read, and the write function refuses it anyway, and the
 * database refuses it a third time with a check constraint. Three refusals for
 * one rule, because this is the rule that stands between a bad mapping and
 * three thousand bad records.
 *
 * It will not merge anything. A row that matches an existing record waits for a
 * person. Not even an exact email match merges on its own.
 *
 * AND ONE THING IT INSISTS ON. An imported contact arrives with no basis to
 * contact them, recorded as such, which puts them on the consent-gap list and
 * blocks any draft addressed to them. Importing a list and emailing it the same
 * afternoon is the most common way a small business breaks the Spam Act, and
 * the product should not make it easy.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Upload } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { CrmImportModal } from '../../components/crm/CrmImportModal';
import { parseDocument } from '../../lib/crm/documentImporter';
import {
  RolePicker,
  WriteNotice,
  WriteResultLine,
  useCrmWrite,
} from '../../components/crm/Stage5Pieces';
import { ImportKind, ImportRow, ImportRun } from '../../lib/crm/domain';
import {
  IMPORT_FIELDS,
  IMPORT_KIND_LABELS,
  MappingProposal,
  ParsedFile,
  ValidationSummary,
  acceptSuggestions,
  commitImport,
  dryRun,
  errorFile,
  markDryRun,
  previewRows,
  readDelimited,
  rollbackImport,
  startImport,
  suggestMapping,
  validateImport,
} from '../../lib/crm/stage8/importer';

const KINDS: ImportKind[] = [
  'contacts',
  'organisations',
  'leads',
  'opportunities',
  'jobs',
  'activities',
  'custom_fields',
];

const SAMPLE: Record<string, string> = {
  contacts: [
    'Full name,Email,Mobile,Company,Role,Internal code',
    'Dev Raman,dev.raman@thornbury.example,0491 570 156,Thornbury Collective,Director,X1',
    '"Liu, Wen",wen.liu@merrivale.example,,Merrivale Group,Owner,X2',
    'Dev Raman,dev.raman@thornbury.example,,Thornbury Collective,Director,X3',
    ',not-an-address,0491 570 157,Nowhere Pty Ltd,,X4',
  ].join('\n'),
  organisations: [
    'Organisation name,ABN,Industry,Website,Parent',
    'Thornbury Collective,61 701 605 898,Professional services,www.thornbury.example,',
    'Merrivale Group,,Construction,,',
  ].join('\n'),
};

const ROW_STATE_WORDS: Record<ImportRow['state'], string> = {
  ready: 'Would be created',
  blocked: 'Stopped',
  needs_duplicate_review: 'Waiting on a decision',
  created: 'Created',
  updated: 'Updated',
  skipped: 'Skipped',
  rolled_back: 'Reversed',
};

export const CrmImportsPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const write = useCrmWrite();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [kind, setKind] = React.useState<ImportKind>('contacts');
  const [text, setText] = React.useState<string>(SAMPLE.contacts);
  const [parsed, setParsed] = React.useState<ParsedFile | null>(null);
  const [proposal, setProposal] = React.useState<MappingProposal | null>(null);
  const [rejected, setRejected] = React.useState<string[]>([]);
  const [summary, setSummary] = React.useState<ValidationSummary | null>(null);
  const [run, setRun] = React.useState<ImportRun | null>(null);
  const [previewed, setPreviewed] = React.useState(false);
  const [committedRows, setCommittedRows] = React.useState<ImportRow[] | null>(null);
  const [reversed, setReversed] = React.useState<string | null>(null);

  const mapping = React.useMemo(
    () => (proposal ? acceptSuggestions(proposal, rejected) : {}),
    [proposal, rejected]
  );

  const reset = () => {
    setParsed(null);
    setProposal(null);
    setRejected([]);
    setSummary(null);
    setRun(null);
    setPreviewed(false);
    setCommittedRows(null);
    setReversed(null);
  };

  const read = () => {
    const file = readDelimited(text);
    const newRun = startImport(write.context, kind, `pasted-${kind}.csv`);
    setParsed(file);
    setProposal(suggestMapping(file.headers, kind));
    setRun(newRun);
    setSummary(null);
    setPreviewed(false);
    setCommittedRows(null);
    setReversed(null);
  };

  const validate = () => {
    if (!parsed || !run) return;
    setSummary(validateImport(data, parsed, mapping, kind, run.id));
    setPreviewed(false);
  };

  const preview = () => {
    if (!run) return;
    markDryRun(run, now);
    setPreviewed(true);
  };

  const commit = () => {
    if (!run || !summary) return;
    const result = write.run('The import ran.', (context, workspace) =>
      commitImport(context, workspace, run, summary.rows, mapping)
    );
    if (result) setCommittedRows([...summary.rows]);
  };

  const rollback = () => {
    if (!run || !summary) return;
    const result = write.run('The import was reversed.', (context, workspace) =>
      rollbackImport(context, workspace, run, summary.rows, 'Reversed from the import screen.')
    );
    if (result) {
      setReversed(
        `${result.reversed.length} ${result.reversed.length === 1 ? 'record' : 'records'} reversed. ` +
          (result.kept.length > 0
            ? `${result.kept.length} left alone: ${result.kept.map((k) => k.because).join(' ')}`
            : 'Nothing had to be left alone.')
      );
      setCommittedRows([...summary.rows]);
    }
  };

  const dry = summary && run ? dryRun(summary, kind, run.id) : null;
  const errors = parsed && summary ? errorFile(parsed, summary.rows) : '';
  const rows = committedRows ?? summary?.rows ?? [];

  return (
    <Stage4Scaffold
      title="Imports"
      description="Bring contacts, organisations, leads, work and history in from a file. Preview first, every time, and reverse it if it went wrong."
      loadingLabel="the importer"
      emptyTitle="Nothing to import yet"
      emptyBody="Choose what you are importing and paste the file to begin."
      resultCount={1}
      totalCount={1}
      toolbar={<RolePicker />}
    >
      <WriteNotice />
      <WriteResultLine result={write.last} onClear={write.clearLast} />

      {/* Universal Document and Project Importer Banner */}
      <div className="rounded-xl border border-slate-700 bg-[#142036] p-5 my-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Download size={16} className="text-[#E2B53C]" />
            <span>Universal Document and Open Project Importer</span>
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Import Excel spreadsheets (.xlsx, .xls), PDF documents, Word briefs (.docx), or stored files and meeting notes directly from your open dashboard projects.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setImportModalOpen(true)}
          className="shrink-0 flex items-center gap-2 rounded-lg bg-[#E2B53C] hover:bg-[#d4a834] px-4 py-2.5 min-h-[44px] text-xs font-semibold text-[#0D1626] transition-colors"
        >
          <Upload size={14} />
          <span>Import from Device or Project</span>
        </button>
      </div>

      <p className="ccrm-policy" role="note">
        Nothing is merged by this importer. A row that looks like a record already here waits for a
        person to decide, including an exact match on an email address, because two people share a
        shared mailbox more often than a demonstration suggests.
      </p>

      {/* ---------------------------------------------------- step 1 */}
      <section className="ccrm-panel" aria-labelledby="imp-step1">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="imp-step1">
              1. What are you importing?
            </h3>
            <p className="ccrm-panel-description">
              Seven kinds. Each has its own fields, and only the ones a record genuinely needs are
              required.
            </p>
          </div>
        </div>

        <ul className="ccrm-card-rail">
          {KINDS.map((candidate) => (
            <li key={candidate}>
              <button
                type="button"
                className={`ccrm-card ccrm-card-button${kind === candidate ? ' ccrm-card-attention' : ''}`}
                aria-pressed={kind === candidate}
                onClick={() => {
                  setKind(candidate);
                  setText(SAMPLE[candidate] ?? '');
                  reset();
                }}
              >
                <span className="ccrm-card-label">{IMPORT_KIND_LABELS[candidate]}</span>
                <span className="ccrm-card-note">
                  Must have:{' '}
                  {IMPORT_FIELDS[candidate]
                    .filter((field) => field.required)
                    .map((field) => field.label.toLowerCase())
                    .join(', ') || 'nothing'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------------------------------------------- step 2 */}
      <section className="ccrm-panel" aria-labelledby="imp-step2">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="imp-step2">
              2. The file
            </h3>
            <p className="ccrm-panel-description">
              Paste it, with the headings on the first line. Quoted fields, commas inside values and
              doubled quotation marks are all read properly.
            </p>
          </div>
        </div>

        <label className="ccrm-field-label" htmlFor="imp-text">
          Delimited text
        </label>
        <div className="my-2">
          <input
            type="file"
            id="imp-file-picker"
            className="hidden"
            accept=".xlsx,.xls,.csv,.tsv,.docx,.doc,.pdf,.txt,.md"
            onChange={async (e) => {
              if (e.target.files && e.target.files[0]) {
                try {
                  const file = e.target.files[0];
                  const parsedResult = await parseDocument(file);
                  if (parsedResult.rawText) {
                    setText(parsedResult.rawText);
                  } else if (parsedResult.rows.length > 0) {
                    const csvLines = [
                      parsedResult.headers.join(','),
                      ...parsedResult.rows.map((r) =>
                        parsedResult.headers.map((h) => `"${(r[h] || '').replace(/"/g, '""')}"`).join(',')
                      ),
                    ].join('\n');
                    setText(csvLines);
                  }
                } catch (err) {
                  console.error('Failed to parse file for text view:', err);
                }
              }
            }}
          />
          <button
            type="button"
            className="btn btn-secondary ccrm-button min-h-[44px] flex items-center gap-2"
            onClick={() => document.getElementById('imp-file-picker')?.click()}
          >
            <Upload size={14} aria-hidden="true" />
            Upload file from device (Excel, PDF, Word, CSV)
          </button>
        </div>
        <textarea
          id="imp-text"
          className="form-control ccrm-textarea"
          rows={6}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <p className="ccrm-form-actions">
          <button type="button" className="btn btn-secondary ccrm-button" onClick={read}>
            Read the file
          </button>
        </p>

        {parsed ? (
          <>
            <p className="ccrm-item-context">
              {parsed.headers.length} columns, {parsed.rows.length}{' '}
              {parsed.rows.length === 1 ? 'row' : 'rows'}.
            </p>
            {parsed.problems.length > 0 ? (
              <ul className="ccrm-flag-list">
                {parsed.problems.map((problem, index) => (
                  <li className="ccrm-flag ccrm-flag-missing" key={index}>
                    <span className="ccrm-flag-detail">{problem}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </section>

      {/* ---------------------------------------------------- step 3 */}
      {proposal ? (
        <section className="ccrm-panel" aria-labelledby="imp-step3">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="imp-step3">
                3. The mapping
              </h3>
              <p className="ccrm-panel-description">{proposal.note}</p>
            </div>
          </div>

          <ul className="ccrm-item-list">
            {proposal.suggestions.map((suggestion) => {
              const off = rejected.includes(suggestion.header);
              return (
                <li key={suggestion.header}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">
                        {suggestion.header}
                        {' goes to '}
                        {suggestion.field === null || off
                          ? 'nothing, and is ignored'
                          : (IMPORT_FIELDS[kind].find((f) => f.name === suggestion.field)?.label ??
                            suggestion.field)}
                      </span>
                      <span className="ccrm-item-context">
                        {suggestion.because} Confidence: {suggestion.confidence}.
                      </span>
                    </span>
                    {suggestion.field !== null ? (
                      <button
                        type="button"
                        className="ccrm-text-link ccrm-disclosure-button"
                        onClick={() =>
                          setRejected((current) =>
                            off
                              ? current.filter((header) => header !== suggestion.header)
                              : [...current, suggestion.header]
                          )
                        }
                      >
                        {off ? 'Use this mapping' : 'Do not use this mapping'}
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>

          {proposal.missingRequired.length > 0 ? (
            <p className="ccrm-reason-text">
              Nothing is mapped to{' '}
              {proposal.missingRequired.map((field) => field.label.toLowerCase()).join(' or ')}, so
              no row can be imported yet.
            </p>
          ) : null}

          {parsed ? (
            <>
              <h4 className="ccrm-plan-section-title">The first rows, as Concludo would read them</h4>
              <ul className="ccrm-item-list">
                {previewRows(parsed, mapping, 4).map((row) => (
                  <li key={row.rowNumber}>
                    <span className="ccrm-item">
                      <span className="ccrm-item-main">
                        <span className="ccrm-item-title">Row {row.rowNumber}</span>
                        <span className="ccrm-item-context">
                          {Object.entries(row.read)
                            .map(([field, value]) => `${field}: ${value}`)
                            .join('. ') || 'Nothing readable in this row.'}
                        </span>
                        {row.ignored.length > 0 ? (
                          <span className="ccrm-cell-quiet">
                            Ignored: {row.ignored.join(', ')}.
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          <p className="ccrm-form-actions">
            <button type="button" className="btn btn-secondary ccrm-button" onClick={validate}>
              Check every row
            </button>
          </p>
        </section>
      ) : null}

      {/* ---------------------------------------------------- step 4 and 5 */}
      {summary && dry ? (
        <section className="ccrm-panel" aria-labelledby="imp-step4">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="imp-step4">
                4. What the file says
              </h3>
              <p className="ccrm-panel-description">
                Every row, with what stops it and what is merely worth knowing. The two are kept
                apart: an organisation name that matches nothing does not reject a contact.
              </p>
            </div>
          </div>

          <ul className="ccrm-card-rail">
            {dry.lines.map((line) => (
              <li key={line.label}>
                <span className="ccrm-card">
                  <span className="ccrm-card-count">{line.count}</span>
                  <span className="ccrm-card-label">{line.label}</span>
                  <span className="ccrm-card-note">{line.meaning}</span>
                </span>
              </li>
            ))}
          </ul>

          {summary.ignoredColumns.length > 0 ? (
            <p className="ccrm-cell-quiet">
              Columns in the file that this mapping ignores: {summary.ignoredColumns.join(', ')}.
            </p>
          ) : null}

          {dry.unmatchedOrganisations.length > 0 ? (
            <p className="ccrm-reason-text">
              {dry.unmatchedOrganisations.length} organisation{' '}
              {dry.unmatchedOrganisations.length === 1 ? 'name' : 'names'} in this file{' '}
              {dry.unmatchedOrganisations.length === 1 ? 'matches' : 'match'} nothing in Concludo:{' '}
              {dry.unmatchedOrganisations.join(', ')}. Concludo will not create them, because an
              organisation invented from a spelling in a spreadsheet is a duplicate waiting to
              happen. Import the organisations first if you want them linked.
            </p>
          ) : null}

          <ul className="ccrm-item-list">
            {rows.map((row) => (
              <li key={row.id}>
                <span className="ccrm-item">
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">
                      Row {row.rowNumber}: {ROW_STATE_WORDS[row.state]}
                    </span>
                    {row.issues.map((issue, index) => (
                      <span className="ccrm-item-context" key={`i-${index}`}>
                        {issue}
                      </span>
                    ))}
                    {row.warnings.map((warning, index) => (
                      <span className="ccrm-cell-quiet" key={`w-${index}`}>
                        {warning}
                      </span>
                    ))}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          {errors !== '' ? (
            <>
              <h4 className="ccrm-plan-section-title">The rows that stopped, as a file</h4>
              <p className="ccrm-panel-description">
                Every source column, exactly as it arrived, plus the row number and what stopped it.
                Fix it and import this file instead.
              </p>
              <pre className="ccrm-code-block">{errors}</pre>
            </>
          ) : null}

          <h4 className="ccrm-plan-section-title">5. The preview</h4>
          <p className="ccrm-panel-description">
            {previewed
              ? `Previewed. ${dry.note}`
              : 'Nothing can be committed until this has been run. It writes nothing.'}
          </p>
          {dry.consentNote ? <p className="ccrm-reason-text">{dry.consentNote}</p> : null}

          <p className="ccrm-form-actions">
            <button type="button" className="btn btn-secondary ccrm-button" onClick={preview}>
              Run the preview
            </button>
            <button
              type="button"
              className="btn btn-primary ccrm-button"
              disabled={!previewed || committedRows !== null || dry.willCreate === 0}
              onClick={commit}
            >
              Commit {dry.willCreate} {dry.willCreate === 1 ? 'row' : 'rows'}
            </button>
            {committedRows !== null && reversed === null ? (
              <button type="button" className="btn btn-secondary ccrm-button" onClick={rollback}>
                Reverse this import
              </button>
            ) : null}
          </p>

          {reversed ? <p className="ccrm-reason-text">{reversed}</p> : null}

          {committedRows !== null ? (
            <p className="ccrm-panel-footer">
              <Link className="ccrm-text-link" to={linkTo('/crm/data-quality')}>
                See what the import added to the data-quality list
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="ccrm-panel" aria-labelledby="imp-history">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="imp-history">
              Imports already run
            </h3>
            <p className="ccrm-panel-description">
              What was brought in, by whom, and whether it was reversed. An import with no record of
              itself is an import nobody can undo.
            </p>
          </div>
          <span className="ccrm-answer-count">{data.importRuns.length}</span>
        </div>

        {data.importRuns.length === 0 ? (
          <p className="ccrm-panel-empty">Nothing has been imported into this workspace.</p>
        ) : (
          <ul className="ccrm-item-list">
            {data.importRuns.map((previous) => {
              const theirRows = data.importRows.filter((row) => row.importRunId === previous.id);
              return (
                <li key={previous.id}>
                  <span className="ccrm-item">
                    <span className="ccrm-item-main">
                      <span className="ccrm-item-title">
                        {previous.fileName}, {IMPORT_KIND_LABELS[previous.kind].toLowerCase()}
                      </span>
                      <span className="ccrm-item-context">
                        {previous.state === 'rolled_back'
                          ? `Reversed. ${previous.rollbackReason ?? ''}`
                          : `Committed ${previous.committedAt?.slice(0, 10) ?? 'at an unrecorded time'}.`}{' '}
                        {theirRows.filter((row) => row.state === 'created').length} created,{' '}
                        {theirRows.filter((row) => row.state === 'needs_duplicate_review').length}{' '}
                        waiting on a decision,{' '}
                        {theirRows.filter((row) => row.state === 'blocked').length} stopped.
                      </span>
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CrmImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        workspaceId={data.workspace.id}
        onImportComplete={() => {
          window.dispatchEvent(
            new CustomEvent('concludo_crm_workspaces_changed', { detail: data.workspace.id })
          );
        }}
      />
    </Stage4Scaffold>
  );
};
