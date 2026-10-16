/**
 * CRM settings: terminology, connections, and the three registers.
 *
 * FOUR JOBS, AND THE LAST ONE IS THE POINT OF THE PAGE.
 *
 * It shows the configuration that makes one product read correctly for a sole
 * trader and for an agency, which is the terminology and the pipelines.
 *
 * It shows every connection this workspace has, in three honest states:
 * working, broken, and never set up. A page that shows only the working ones
 * teaches people that silence means success.
 *
 * It shows what each connector would ask for and what it deliberately would
 * not. The scope list is the thing nobody revisits: a connector shipped with
 * write access because it was easier keeps it for years.
 *
 * And it carries the three registers Australian privacy law will require, with
 * the dates. The automated-decision transparency obligation in APP 1.7 and 1.8
 * commences on 10 December 2026. A register written afterwards is written by
 * somebody reconstructing what was connected and why, and it is always
 * incomplete.
 *
 * WHAT IS SAID PLAINLY HERE. Nothing is connected in this release except the
 * file importer. No model is called anywhere in Concludo. Nothing sends. Those
 * are stated as current facts with dates rather than implied by absence.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { Facts } from '../../components/crm/viewPrimitives';
import {
  ADM_OBLIGATION_START,
  AI_MODEL_REGISTER,
  AUTOMATED_DECISION_REGISTER,
  INTEGRATION_REGISTER,
  INTEGRATION_TRUTH,
  privacyPolicyAdmSection,
} from '../../lib/crm/stage8/registers';
import { OFFBOARDING, RETENTION_RULES, retentionFindings } from '../../lib/crm/stage8/governance';
import { IntegrationConnection } from '../../lib/crm/domain';

const CONNECTION_WORDS: Record<IntegrationConnection['state'], string> = {
  never_connected: 'Never set up',
  connected: 'Connected',
  expired: 'Permission expired',
  revoked: 'Permission withdrawn',
  failed: 'Failing',
};

const SCOPE_WORD: Record<string, string> = {
  in_scope: 'In scope',
  out_of_scope: 'Out of scope',
  needs_legal_review: 'Needs legal review',
};

export const CrmSettingsPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const { workspace } = data;

  const [tab, setTab] = React.useState<'workspace' | 'connections' | 'governance'>('workspace');

  const findings = React.useMemo(() => retentionFindings(data, now), [data, now]);
  const policy = React.useMemo(() => privacyPolicyAdmSection(), []);

  return (
    <Stage4Scaffold
      title="CRM settings"
      description="Terminology, pipelines, connections, and the registers this product has to keep."
      loadingLabel="settings"
      emptyTitle="No settings recorded"
      emptyBody="A workspace always has settings, so this state should not be reachable."
      resultCount={1}
      totalCount={1}
      toolbar={
        <div className="ccrm-role-picker">
          <label className="ccrm-workspace-label" htmlFor="ccrm-settings-tab">
            Section
          </label>
          <select
            id="ccrm-settings-tab"
            className="form-select ccrm-workspace-select"
            value={tab}
            onChange={(event) =>
              setTab(event.target.value as 'workspace' | 'connections' | 'governance')
            }
          >
            <option value="workspace">This workspace</option>
            <option value="connections">Connections and permissions</option>
            <option value="governance">Registers and retention</option>
          </select>
        </div>
      }
    >
      {tab === 'workspace' ? (
        <>
          <h3 className="ccrm-group-title">This workspace</h3>
          <Facts
            items={[
              { term: 'Name', value: workspace.name },
              { term: 'Shape', value: workspace.depth.replace(/_/g, ' ') },
              {
                term: 'What this workspace calls a record',
                value: `${workspace.recordTerminology} (${workspace.recordTerminologyPlural})`,
              },
              {
                term: 'Account planning',
                value: workspace.accountPlanningEnabled
                  ? 'On. Plans still only exist for accounts somebody started one for.'
                  : 'Off, which is the default. A business with eleven customers does not need a SWOT.',
              },
            ]}
          />

          <h3 className="ccrm-group-title">Pipelines and stages</h3>
          {data.pipelines.map((pipeline) => (
            <section className="ccrm-settings-block" key={pipeline.id}>
              <h4 className="ccrm-settings-title">
                {pipeline.name}{' '}
                <span className="ccrm-cell-quiet">
                  calls a record a {pipeline.workItemType}
                  {pipeline.isDefault ? ', and is the default' : ''}
                </span>
              </h4>
              <ol className="ccrm-settings-stages">
                {data.stages
                  .filter((stage) => stage.pipelineId === pipeline.id)
                  .sort((a, b) => a.stageOrder - b.stageOrder)
                  .map((stage) => {
                    const criteria = data.stageCriteria.filter((c) => c.stageId === stage.id);
                    return (
                      <li key={stage.id}>
                        <span className="ccrm-cell-strong">{stage.name}</span>
                        <span className="ccrm-cell-quiet">
                          {stage.typicalDays} days is usual here.{' '}
                          {criteria.length > 0
                            ? `To leave: ${criteria.map((c) => c.description).join('. ')}.`
                            : 'No exit criteria are recorded, so anything can leave this stage without a named condition being met.'}
                        </span>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
        </>
      ) : null}

      {tab === 'connections' ? (
        <>
          <p className="ccrm-policy" role="note">
            {INTEGRATION_TRUTH}
          </p>

          <h3 className="ccrm-group-title">
            This workspace&rsquo;s connections
            <span className="ccrm-stage-count">{data.integrationConnections.length}</span>
          </h3>

          {data.integrationConnections.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing is connected to this workspace.</p>
          ) : (
            <ul className="ccrm-item-list">
              {data.integrationConnections.map((connection) => {
                const entry = INTEGRATION_REGISTER.find(
                  (candidate) => candidate.id === connection.integrationId
                );
                return (
                  <li key={connection.id}>
                    <span className="ccrm-item">
                      <span className="ccrm-item-main">
                        <span className="ccrm-item-title">
                          {entry?.name ?? connection.integrationId}:{' '}
                          {CONNECTION_WORDS[connection.state]}
                        </span>
                        <span className="ccrm-item-context">
                          {connection.failureDetail ??
                            (connection.state === 'connected'
                              ? `Last run ${connection.lastAttemptAt?.slice(0, 10) ?? 'never'}, outcome ${connection.lastOutcome}.`
                              : 'Nothing has ever been read through this connection.')}
                        </span>
                        <span className="ccrm-cell-quiet">
                          Sending is{' '}
                          {connection.sendingEnabled
                            ? 'on, switched on by a named person'
                            : 'off, which is the default and cannot be set at the moment a connection is created'}
                          .{' '}
                          {connection.grantedScopes.length > 0
                            ? `Granted: ${connection.grantedScopes.join(', ')}.`
                            : 'No permission has been granted.'}
                        </span>
                        {Object.entries(connection.importScope).length > 0 ? (
                          <span className="ccrm-cell-quiet">
                            What it may read:{' '}
                            {Object.entries(connection.importScope)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join('. ')}
                            .
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="ccrm-group-title">
            What each connector would ask for
            <span className="ccrm-stage-count">{INTEGRATION_REGISTER.length}</span>
          </h3>
          <p className="ccrm-section-description">
            Least privilege, stated before anything is built. The second list on each one is the
            more useful: what Concludo would not ask for, and why.
          </p>

          <div className="ccrm-panel-grid">
            {INTEGRATION_REGISTER.map((entry) => (
              <section className="ccrm-panel" key={entry.id} aria-labelledby={`int-${entry.id}`}>
                <div className="ccrm-panel-head">
                  <div>
                    <h4 className="ccrm-panel-title" id={`int-${entry.id}`}>
                      {entry.name}
                    </h4>
                    <p className="ccrm-panel-description">{entry.purpose}</p>
                  </div>
                  <span className="ccrm-mark">{entry.state.replace(/_/g, ' ')}</span>
                </div>

                {entry.scopes.length === 0 && entry.notRequested.length === 0 ? (
                  <p className="ccrm-panel-empty">
                    Not specified yet. This connector has no scope list, which means the question of
                    what it would be allowed to do has not been answered. It cannot be built until
                    it is.
                  </p>
                ) : null}

                {entry.scopes.length > 0 ? (
                  <h5 className="ccrm-plan-section-title">Would ask for</h5>
                ) : null}
                <ul className="ccrm-flag-list">
                  {entry.scopes.map((scope) => (
                    <li className="ccrm-flag" key={scope.scope}>
                      <span className="ccrm-flag-label">
                        {scope.scope}
                        {scope.writes ? ' (can write)' : ' (read only)'}
                      </span>
                      <span className="ccrm-flag-detail">{scope.allows}</span>
                      <span className="ccrm-flag-resolution">{scope.because}</span>
                    </li>
                  ))}
                </ul>

                {entry.notRequested.length > 0 ? (
                  <h5 className="ccrm-plan-section-title">Would not ask for</h5>
                ) : null}
                <ul className="ccrm-flag-list">
                  {entry.notRequested.map((scope) => (
                    <li className="ccrm-flag" key={scope.scope}>
                      <span className="ccrm-flag-label">{scope.scope}</span>
                      <span className="ccrm-flag-detail">{scope.because}</span>
                    </li>
                  ))}
                </ul>

                {entry.importControls.length > 0 ? (
                  <h5 className="ccrm-plan-section-title">Before anything is read</h5>
                ) : null}
                <ul className="ccrm-item-list">
                  {entry.importControls.map((control, index) => (
                    <li key={index}>
                      <span className="ccrm-item-context">{control}</span>
                    </li>
                  ))}
                </ul>

                <p className="ccrm-cell-quiet">
                  Sending: {entry.canSend ? 'possible, and off by default' : 'not possible at all'}.{' '}
                  When the permission expires: {entry.onPermissionExpiry}
                  {entry.residencyNote ? ` ${entry.residencyNote}` : ''}
                </p>
              </section>
            ))}
          </div>
        </>
      ) : null}

      {tab === 'governance' ? (
        <>
          <h3 className="ccrm-group-title">Automated decisions</h3>
          <p className="ccrm-section-description">
            The transparency obligation in Australian Privacy Principles 1.7 and 1.8 commences on{' '}
            {ADM_OBLIGATION_START}. This register is what the privacy policy is written from, and
            the most useful column is the last: what would change the answer.
          </p>
          <p className="ccrm-policy" role="note">
            This is Concludo&rsquo;s own assessment of its own software, not legal advice, and it has
            not been reviewed by a lawyer. Verify the applicable requirements with authoritative
            sources before representing the system as compliant.
          </p>

          <div className="ccrm-panel-grid">
            {AUTOMATED_DECISION_REGISTER.map((entry) => (
              <section className="ccrm-panel" key={entry.id} aria-labelledby={`adm-${entry.id}`}>
                <div className="ccrm-panel-head">
                  <div>
                    <h4 className="ccrm-panel-title" id={`adm-${entry.id}`}>
                      {entry.what}
                    </h4>
                    <p className="ccrm-panel-description">{entry.component}</p>
                  </div>
                  <span className="ccrm-mark">{SCOPE_WORD[entry.scope] ?? entry.scope}</span>
                </div>

                <Facts
                  items={[
                    {
                      term: 'Does a program decide, or assist?',
                      value: entry.automationLevel.replace(/_/g, ' '),
                    },
                    {
                      term: 'Could it significantly affect rights or interests?',
                      value: entry.significantEffect ? 'Yes' : 'No',
                    },
                    {
                      term: 'Personal information used',
                      value: entry.personalInformationUsed.join(', '),
                    },
                    { term: 'Assessment', value: entry.assessment },
                    { term: 'What would change the answer', value: entry.wouldChangeIf },
                    {
                      term: 'Last reviewed',
                      value: `${entry.lastReviewed}, by ${entry.reviewedBy}`,
                    },
                  ]}
                />
              </section>
            ))}
          </div>

          <h3 className="ccrm-group-title">What the privacy policy has to say</h3>
          <p className="ccrm-section-description">{policy.because}</p>
          <pre className="ccrm-code-block ccrm-code-wrap">{policy.text}</pre>

          <h3 className="ccrm-group-title">Models</h3>
          <p className="ccrm-section-description">
            Every model slot in the product, and what has to be true before one is turned on. All of
            them are empty: no model is called anywhere in Concludo today.
          </p>
          <div className="ccrm-panel-grid">
            {AI_MODEL_REGISTER.map((entry) => (
              <section className="ccrm-panel" key={entry.id} aria-labelledby={`mod-${entry.id}`}>
                <div className="ccrm-panel-head">
                  <div>
                    <h4 className="ccrm-panel-title" id={`mod-${entry.id}`}>
                      {entry.purpose}
                    </h4>
                    <p className="ccrm-panel-description">{entry.component}</p>
                  </div>
                  <span className="ccrm-mark">{entry.state.replace(/_/g, ' ')}</span>
                </div>
                <Facts
                  items={[
                    { term: 'Provider', value: entry.provider ?? 'None. Nothing is wired.' },
                    {
                      term: 'Would customer personal information reach it?',
                      value: entry.sendsPersonalInformation ? 'Yes' : 'No',
                    },
                    {
                      term: 'Where it would be processed',
                      value:
                        entry.processingLocation ??
                        'Not decided, and it has to be before this is enabled.',
                    },
                  ]}
                />
                <h5 className="ccrm-plan-section-title">Before this is enabled</h5>
                <ul className="ccrm-item-list">
                  {entry.beforeEnabling.map((step, index) => (
                    <li key={index}>
                      <span className="ccrm-item-context">{step}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <h3 className="ccrm-group-title">Retention</h3>
          <p className="ccrm-section-description">
            How long each kind of record is kept, and the review prompts. Nothing is deleted
            automatically. Destroying a customer record because nobody opened it is data loss with a
            schedule, not a retention policy.
          </p>
          <ul className="ccrm-flag-list">
            {RETENTION_RULES.map((rule) => (
              <li className="ccrm-flag" key={rule.table}>
                <span className="ccrm-flag-label">{rule.table.replace(/^crm_/, '').replace(/_/g, ' ')}</span>
                <span className="ccrm-flag-detail">{rule.because}</span>
                <span className="ccrm-flag-resolution">
                  Kept {rule.keepForDays} days. The clock starts {rule.clockStarts}
                </span>
              </li>
            ))}
          </ul>

          {findings.length > 0 ? (
            <>
              <h4 className="ccrm-plan-section-title">What is due for review in this workspace</h4>
              <ul className="ccrm-item-list">
                {findings.slice(0, 12).map((finding) => (
                  <li key={`${finding.table}-${finding.recordId}`}>
                    <span className="ccrm-item">
                      <span className="ccrm-item-main">
                        <span className="ccrm-item-title">{finding.label}</span>
                        <span className="ccrm-item-context">
                          {finding.overdueDays} days past the {finding.rule.keepForDays} day rule for{' '}
                          {finding.table.replace(/^crm_/, '').replace(/_/g, ' ')}.{' '}
                          {finding.rule.because} Nothing is deleted automatically, so this is a
                          prompt to decide rather than a decision.
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="ccrm-panel-empty">Nothing in this workspace is due for a retention review.</p>
          )}

          <h3 className="ccrm-group-title">If a customer leaves</h3>
          <p className="ccrm-section-description">
            The offboarding steps, in order. A product with no offboarding path is a product that
            holds somebody&rsquo;s data because leaving was never built.
          </p>
          <ol className="ccrm-settings-stages">
            {OFFBOARDING.map((step) => (
              <li key={step.order}>
                <span className="ccrm-cell-strong">{step.what}</span>
                <span className="ccrm-cell-quiet">
                  Done by {step.who === 'concludo' ? 'Concludo' : step.who}.{' '}
                  {step.reversible ? 'Can be undone.' : 'Cannot be undone once it runs.'}{' '}
                  {step.because}
                </span>
              </li>
            ))}
          </ol>

          <p className="ccrm-panel-footer">
            <Link className="ccrm-text-link" to={linkTo('/crm/data-quality')}>
              The data-quality page says what is recorded about these records
            </Link>
          </p>
        </>
      ) : null}

      {/* On every section, not only on the connections one. These are the two
          facts somebody evaluating Concludo most needs, and burying them under
          a tab is how a demonstration gets believed. */}
      <p className="ccrm-policy" role="note">
        No connector to an outside system is connected. Concludo holds no credential for any
        provider in this release, and no model is called anywhere in Concludo today. The one path
        for data in or out is a file you choose yourself.
      </p>

      <p className="ccrm-policy" role="note">
        Concludo is an independent product and is not affiliated with, endorsed by or certified by
        any mail provider, meeting platform, accounting system, telephony provider or device maker.
        Where one is named above, it is named as a system a customer may choose to connect with
        their own credentials. Concludo proposes; a person disposes. Prices referenced anywhere in
        Concludo remain indicative until validated with real buyers.
      </p>
    </Stage4Scaffold>
  );
};
