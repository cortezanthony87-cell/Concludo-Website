/**
 * Quick capture: the things that come up mid-conversation, with as few fields
 * as each can carry.
 *
 * THE ONE RULE THAT DECIDES WHETHER THIS GETS USED.
 *
 * Required fields. A capture form that demands an email address gets a fake
 * one, and a CRM full of fake addresses is worse than one with blanks, because
 * a blank says "we do not know" and nobody can tell that from a wrong answer.
 *
 * So: a person needs a name. An organisation needs a name. A note needs a body.
 * A commitment needs to say what was promised and by whom, because without
 * those two it is not a commitment. Everything else, on every kind, is optional,
 * and every field says which it is rather than leaving somebody to guess from
 * an asterisk.
 *
 * The forms are one page rather than one per kind, because the thing somebody is
 * capturing is usually not the thing they opened the page for: they came to
 * write a note and realised the person is not here yet.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import {
  Field,
  RolePicker,
  WriteNotice,
  WriteResultLine,
  useCrmWrite,
} from '../../components/crm/Stage5Pieces';
import {
  captureCommitment,
  captureInteraction,
  captureLead,
  captureNote,
  captureOrganisation,
  capturePerson,
  captureTask,
  captureServiceCase,
  captureWorkItem,
} from '../../lib/crm/stage5/writes';
import { LEAD_SOURCES, LEAD_SOURCE_LABELS, LeadSource } from '../../lib/crm/stage5/leadIntake';
import { pipelinesIn } from '../../lib/crm/stage5/pipeline';

/**
 * `work:<pipelineId>` is a kind per pipeline.
 *
 * The brief names opportunity and job as separate things to create, and they
 * are: one is a sale that might happen, the other is work that has been agreed.
 * They are the same row in the database with a different noun, so collapsing
 * them into one button was defensible and still wrong, because the person
 * capturing a job mid-conversation does not want to choose a pipeline from a
 * list afterwards. One button per pipeline, each labelled with the word that
 * workspace actually uses for it.
 */
type Kind =
  | 'person'
  | 'organisation'
  | 'lead'
  | `work:${string}`
  | 'task'
  | 'commitment'
  | 'note'
  | 'interaction'
  | 'case';

const WORK_TYPE_WORDS: Record<string, string> = {
  opportunity: 'Opportunity',
  deal: 'Deal',
  job: 'Job',
  case: 'Case',
  application: 'Application',
};

interface KindInfo {
  key: Kind;
  label: string;
  /** What this creates, said plainly. */
  what: string;
  /** The fields that cannot be left out, named. */
  required: string;
}

export const CrmCapturePage: React.FC = () => {
  const { data, linkTo } = useStage4();
  const write = useCrmWrite();
  const pipelines = React.useMemo(() => pipelinesIn(data), [data]);

  const workWord = data.workspace.recordTerminology;
  const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

  const KINDS: KindInfo[] = [
    { key: 'person', label: 'Contact', what: 'A person.', required: 'A name.' },
    { key: 'organisation', label: 'Organisation', what: 'A company or a household.', required: 'A name.' },
    { key: 'lead', label: 'Lead', what: 'Something that arrived and needs reviewing.', required: 'Where it came from.' },
    ...pipelines.map((pipeline) => ({
      key: `work:${pipeline.id}` as Kind,
      label: WORK_TYPE_WORDS[pipeline.workItemType] ?? capitalise(workWord),
      what: `A piece of work in ${pipeline.name}.`,
      required: 'A title.',
    })),
    { key: 'task', label: 'Task', what: 'Something you have to do.', required: 'A title.' },
    {
      key: 'commitment',
      label: 'Commitment',
      what: 'Something somebody promised. Different from a task: a task is one you made for yourself.',
      required: 'What was promised, and who promised it.',
    },
    { key: 'note', label: 'Note', what: 'Something worth writing down.', required: 'The note.' },
    {
      key: 'interaction',
      label: 'Interaction',
      what: 'A meeting, a call or an email that happened.',
      required: 'What it was and what it was about.',
    },
    {
      key: 'case',
      label: 'Case',
      what: 'Something that went wrong for a customer.',
      required: 'A title, the organisation, and what it does to the relationship.',
    },
  ];

  const [kind, setKind] = React.useState<Kind>('person');
  const workPipelineId = kind.startsWith('work:') ? kind.slice('work:'.length) : null;
  const [fields, setFields] = React.useState<Record<string, string>>({});
  const [created, setCreated] = React.useState<{ what: string; path: string | null } | null>(null);

  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFields((current) => ({ ...current, [key]: event.target.value }));

  const value = (key: string): string => fields[key] ?? '';

  const clear = () => setFields({});

  const info = KINDS.find((k) => k.key === kind)!;

  const organisationOptions = data.organisations
    .filter((o) => o.deletedAt === null)
    .sort((a, b) => a.name.localeCompare(b.name));
  const personOptions = data.people
    .filter((p) => p.deletedAt === null && p.mergedIntoPersonId === null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  const submit = () => {
    setCreated(null);

    if (kind === 'person') {
      const person = write.run('The contact was created.', (c, d) =>
        capturePerson(c, d, {
          fullName: value('fullName'),
          organisationId: value('organisationId') || null,
          roleLabel: value('roleLabel') || null,
          primaryEmail: value('email') || null,
          phone: value('phone') || null,
        })
      );
      if (person) {
        setCreated({ what: person.fullName, path: `/crm/people/${person.id}` });
        clear();
      }
      return;
    }

    if (kind === 'organisation') {
      const organisation = write.run('The organisation was created.', (c, d) =>
        captureOrganisation(c, d, {
          name: value('name'),
          industry: value('industry') || null,
          parentOrganisationId: value('parentOrganisationId') || null,
        })
      );
      if (organisation) {
        setCreated({ what: organisation.name, path: `/crm/organisations/${organisation.id}` });
        clear();
      }
      return;
    }

    if (kind === 'lead') {
      const lead = write.run('The lead was recorded.', (c, d) =>
        captureLead(c, d, {
          source: value('source') || 'manual_entry',
          personName: value('personName') || null,
          organisationName: value('organisationName') || null,
          email: value('email') || null,
          summary: value('summary') || null,
        })
      );
      if (lead) {
        setCreated({ what: lead.personName ?? 'The lead', path: '/crm/leads' });
        clear();
      }
      return;
    }

    if (workPipelineId) {
      const item = write.run('The work was created.', (c, d) =>
        captureWorkItem(c, d, {
          title: value('title'),
          pipelineId: workPipelineId,
          organisationId: value('organisationId') || null,
          primaryPersonId: value('primaryPersonId') || null,
          valueAmount: value('amount') ? Number(value('amount')) : null,
          valueBasis: value('amount') ? 'stated' : 'unknown',
          expectedCloseDate: value('expectedCloseDate') || null,
          nextStep: value('nextStep') || null,
        })
      );
      if (item) {
        setCreated({ what: item.title, path: `/crm/work/${item.id}` });
        clear();
      }
      return;
    }

    if (kind === 'task') {
      const task = write.run('The task was created.', (c, d) =>
        captureTask(c, d, {
          title: value('title'),
          dueDate: value('dueDate') || null,
          organisationId: value('organisationId') || null,
          personId: value('personId') || null,
        })
      );
      if (task) {
        setCreated({ what: task.title, path: null });
        clear();
      }
      return;
    }

    if (kind === 'commitment') {
      const commitment = write.run('The commitment was recorded.', (c, d) =>
        captureCommitment(c, d, {
          description: value('description'),
          ownerName: value('ownerName'),
          ownedByUs: value('side') !== 'them',
          dueDate: value('dueDate') || null,
          organisationId: value('organisationId') || null,
        })
      );
      if (commitment) {
        setCreated({ what: commitment.description, path: '/crm/commitments' });
        clear();
      }
      return;
    }

    if (kind === 'note') {
      const note = write.run('The note was written.', (c, d) =>
        captureNote(c, d, {
          body: value('body'),
          organisationId: value('organisationId') || null,
          personId: value('personId') || null,
          isPrivate: value('isPrivate') === 'yes',
        })
      );
      if (note) {
        setCreated({ what: 'The note', path: null });
        clear();
      }
      return;
    }

    if (kind === 'case') {
      const raised = write.run('The case was recorded.', (c, d) =>
        captureServiceCase(c, d, {
          title: value('title'),
          organisationId: value('organisationId'),
          relationshipEffect: value('relationshipEffect'),
          detail: value('detail') || null,
          personId: value('personId') || null,
          severity: (value('severity') || 'moderate') as 'low' | 'moderate' | 'high',
        })
      );
      if (raised) {
        setCreated({ what: raised.title, path: '/crm/service' });
        clear();
      }
      return;
    }

    const activity = write.run('The interaction was recorded.', (c, d) =>
      captureInteraction(c, d, {
        activityType: (value('activityType') || 'meeting') as 'meeting' | 'call' | 'note' | 'email',
        title: value('title'),
        summary: value('summary') || null,
        organisationId: value('organisationId') || null,
        personIds: value('personId') ? [value('personId')] : [],
      })
    );
    if (activity) {
      setCreated({ what: activity.title, path: '/crm/activities' });
      clear();
    }
  };

  const OrganisationPicker = (
    <Field label="Organisation" id="cap-org">
      <select id="cap-org" className="form-select" value={value('organisationId')} onChange={set('organisationId')}>
        <option value="">Not recorded</option>
        {organisationOptions.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  );

  const PersonPicker = (label: string, key: string) => (
    <Field label={label} id={`cap-${key}`}>
      <select id={`cap-${key}`} className="form-select" value={value(key)} onChange={set(key)}>
        <option value="">Not recorded</option>
        {personOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <Stage4Scaffold
      title="Quick capture"
      description="Create the things that come up mid-conversation, with as few fields as each can carry. One button per kind of record, and one per pipeline this workspace runs."
      loadingLabel="quick capture"
      emptyTitle="This workspace is not set up yet"
      emptyBody="Capture needs at least a workspace to write into."
      resultCount={1}
      totalCount={1}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-policy ccrm-not-ranked" role="note">
        Required fields are kept to the ones without which the record means nothing. A form that
        demands an email address gets a fake one, and a fake address is worse than a blank: a blank
        says we do not know, and nobody can tell that from a wrong answer.
      </p>

      <div className="ccrm-kind-picker" role="group" aria-label="What to create">
        {KINDS.map((option) => (
          <button
            type="button"
            key={option.key}
            className={`ccrm-kind ${kind === option.key ? 'ccrm-kind-on' : ''}`}
            aria-pressed={kind === option.key}
            onClick={() => {
              setKind(option.key);
              clear();
              setCreated(null);
              write.clearLast();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="ccrm-panel" aria-labelledby="cap-head">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="cap-head">
              {info.label}
            </h3>
            <p className="ccrm-panel-description">{info.what}</p>
            <p className="ccrm-field-hint">Required: {info.required} Everything else is optional.</p>
          </div>
        </div>

        <div className="ccrm-capture-grid">
          {kind === 'person' ? (
            <>
              <Field label="Name" id="cap-fullName" required>
                <input id="cap-fullName" className="form-input" value={value('fullName')} onChange={set('fullName')} />
              </Field>
              {OrganisationPicker}
              <Field label="Role" id="cap-roleLabel">
                <input id="cap-roleLabel" className="form-input" value={value('roleLabel')} onChange={set('roleLabel')} />
              </Field>
              <Field label="Email" id="cap-email">
                <input id="cap-email" className="form-input" type="email" value={value('email')} onChange={set('email')} />
              </Field>
              <Field label="Phone" id="cap-phone">
                <input id="cap-phone" className="form-input" value={value('phone')} onChange={set('phone')} />
              </Field>
            </>
          ) : null}

          {kind === 'organisation' ? (
            <>
              <Field label="Name" id="cap-name" required>
                <input id="cap-name" className="form-input" value={value('name')} onChange={set('name')} />
              </Field>
              <Field label="Industry" id="cap-industry">
                <input id="cap-industry" className="form-input" value={value('industry')} onChange={set('industry')} />
              </Field>
              <Field label="Part of" id="cap-parent" hint="A parent organisation, where this is a subsidiary.">
                <select id="cap-parent" className="form-select" value={value('parentOrganisationId')} onChange={set('parentOrganisationId')}>
                  <option value="">Not part of another organisation</option>
                  {organisationOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : null}

          {kind === 'lead' ? (
            <>
              <Field label="Where it came from" id="cap-source" required>
                <select id="cap-source" className="form-select" value={value('source') || 'manual_entry'} onChange={set('source')}>
                  {LEAD_SOURCES.map((s: LeadSource) => (
                    <option key={s} value={s}>
                      {LEAD_SOURCE_LABELS[s]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name" id="cap-personName">
                <input id="cap-personName" className="form-input" value={value('personName')} onChange={set('personName')} />
              </Field>
              <Field label="Organisation" id="cap-organisationName">
                <input id="cap-organisationName" className="form-input" value={value('organisationName')} onChange={set('organisationName')} />
              </Field>
              <Field label="Email" id="cap-leadEmail">
                <input id="cap-leadEmail" className="form-input" type="email" value={value('email')} onChange={set('email')} />
              </Field>
              <Field label="What they want" id="cap-summary">
                <input id="cap-summary" className="form-input" value={value('summary')} onChange={set('summary')} />
              </Field>
            </>
          ) : null}

          {workPipelineId ? (
            <>
              <Field label="Title" id="cap-title" required>
                <input id="cap-title" className="form-input" value={value('title')} onChange={set('title')} />
              </Field>
              {OrganisationPicker}
              {PersonPicker('Main contact', 'primaryPersonId')}
              <Field label="Amount" id="cap-amount" hint="Only if they have said one. A guess recorded as a figure is a guess somebody quotes back.">
                <input id="cap-amount" className="form-input" type="number" value={value('amount')} onChange={set('amount')} />
              </Field>
              <Field label="Expected date" id="cap-expected">
                <input id="cap-expected" className="form-input" type="date" value={value('expectedCloseDate')} onChange={set('expectedCloseDate')} />
              </Field>
              <Field label="Next step" id="cap-next">
                <input id="cap-next" className="form-input" value={value('nextStep')} onChange={set('nextStep')} />
              </Field>
            </>
          ) : null}

          {kind === 'task' ? (
            <>
              <Field label="What has to be done" id="cap-taskTitle" required>
                <input id="cap-taskTitle" className="form-input" value={value('title')} onChange={set('title')} />
              </Field>
              <Field label="By when" id="cap-due">
                <input id="cap-due" className="form-input" type="date" value={value('dueDate')} onChange={set('dueDate')} />
              </Field>
              {OrganisationPicker}
              {PersonPicker('About', 'personId')}
            </>
          ) : null}

          {kind === 'commitment' ? (
            <>
              <Field label="What was promised" id="cap-description" required>
                <input id="cap-description" className="form-input" value={value('description')} onChange={set('description')} />
              </Field>
              <Field label="Who promised it" id="cap-ownerName" required>
                <input id="cap-ownerName" className="form-input" value={value('ownerName')} onChange={set('ownerName')} />
              </Field>
              <Field label="Which side" id="cap-side" required hint="A promise we made and a promise they made are different rows on a different list.">
                <select id="cap-side" className="form-select" value={value('side') || 'us'} onChange={set('side')}>
                  <option value="us">We promised it</option>
                  <option value="them">They promised it</option>
                </select>
              </Field>
              <Field label="By when" id="cap-comDue">
                <input id="cap-comDue" className="form-input" type="date" value={value('dueDate')} onChange={set('dueDate')} />
              </Field>
              {OrganisationPicker}
            </>
          ) : null}

          {kind === 'note' ? (
            <>
              <Field label="The note" id="cap-body" required>
                <input id="cap-body" className="form-input" value={value('body')} onChange={set('body')} />
              </Field>
              {OrganisationPicker}
              {PersonPicker('About', 'personId')}
              <Field label="Who can see it" id="cap-private">
                <select id="cap-private" className="form-select" value={value('isPrivate') || 'no'} onChange={set('isPrivate')}>
                  <option value="no">Everyone in this workspace</option>
                  <option value="yes">Just me and administrators</option>
                </select>
              </Field>
            </>
          ) : null}

          {kind === 'interaction' ? (
            <>
              <Field label="What it was" id="cap-activityType" required>
                <select id="cap-activityType" className="form-select" value={value('activityType') || 'meeting'} onChange={set('activityType')}>
                  <option value="meeting">Meeting</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="note">Something else</option>
                </select>
              </Field>
              <Field label="What it was about" id="cap-intTitle" required>
                <input id="cap-intTitle" className="form-input" value={value('title')} onChange={set('title')} />
              </Field>
              <Field label="What happened" id="cap-intSummary">
                <input id="cap-intSummary" className="form-input" value={value('summary')} onChange={set('summary')} />
              </Field>
              {OrganisationPicker}
              {PersonPicker('Who was there', 'personId')}
            </>
          ) : null}

          {kind === 'case' ? (
            <>
              <Field label="What went wrong" id="cap-caseTitle" required>
                <input id="cap-caseTitle" className="form-input" value={value('title')} onChange={set('title')} />
              </Field>
              <Field label="Organisation" id="cap-caseOrg" required hint="A case belongs to a customer, so this one is not optional.">
                <select id="cap-caseOrg" className="form-select" value={value('organisationId')} onChange={set('organisationId')}>
                  <option value="">Choose one</option>
                  {organisationOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="What it does to the relationship"
                id="cap-effect"
                required
                hint="The one thing a help desk would not record, and the only reason this belongs in a CRM."
              >
                <input id="cap-effect" className="form-input" value={value('relationshipEffect')} onChange={set('relationshipEffect')} />
              </Field>
              <Field label="How serious" id="cap-severity">
                <select id="cap-severity" className="form-select" value={value('severity') || 'moderate'} onChange={set('severity')}>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </Field>
              {PersonPicker('Who raised it', 'personId')}
              <Field label="Detail" id="cap-caseDetail">
                <input id="cap-caseDetail" className="form-input" value={value('detail')} onChange={set('detail')} />
              </Field>
            </>
          ) : null}

          <div className="ccrm-capture-actions">
            <button type="button" className="btn-secondary ccrm-button ccrm-button-primary" onClick={submit}>
              Create it
            </button>
            <button type="button" className="btn-secondary ccrm-button" onClick={clear}>
              Clear
            </button>
          </div>
        </div>

        <WriteResultLine result={write.last} onClear={write.clearLast} />

        {created ? (
          <p className="ccrm-created" role="status">
            {created.what} now exists.
            {created.path ? (
              <Link className="ccrm-text-link" to={linkTo(created.path)}>
                Open it
                <ArrowRight size={13} aria-hidden="true" />
              </Link>
            ) : null}
          </p>
        ) : null}
      </section>
    </Stage4Scaffold>
  );
};
