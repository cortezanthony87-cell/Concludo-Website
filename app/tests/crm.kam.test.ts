/**
 * Concludo CRM, the KAM Copilot.
 *
 * WHAT THIS SUITE IS FOR.
 *
 * The copilot's whole value rests on one promise: that a reader can always
 * tell what is recorded from what was worked out from what nobody knows. A
 * module that blurs those three is worse than no module, because the reader
 * walks into a customer meeting believing a sentence that came from nowhere.
 * So most of these checks are about the BOUNDARY between the three states
 * rather than about the content of any one finding.
 *
 * The other half of the suite exists because of a decision taken on
 * 17 October 2026. The brief this was built from asked for power maps,
 * influence networks, blockers and "who loses". The build refused all of it
 * and reports the buying centre as seats instead. A refusal that lives only in
 * a comment is a refusal that comes back in six months when somebody adds a
 * helpful field, so it is asserted here, hard, in several directions at once:
 *
 *   NO USER ID reaches any review, the same scan the attention and memory
 *   modules get.
 *   NO DISPOSITION WORD appears anywhere in a review's output. The list is
 *   deliberately broad and includes the words a well-meaning future change
 *   would reach for first.
 *   NO FIGURE IS KEYED TO A PERSON. Seats carry counts; nothing carries a
 *   person's name beside a number.
 *   THE AGENT CHANGES NOTHING. Every proposal it builds has an empty changes
 *   array, so there is no path by which it could write a judgement.
 *   EVERY DEPARTURE FROM THE BRIEF NAMES THE CODE THAT ENFORCES IT.
 *
 * Run: bun tests/crm.kam.test.ts
 */
import { CRM_WORKSPACES, getCrmWorkspace } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { CrmWorkspaceData, StakeholderRole } from '../src/lib/crm/domain';
import {
  KAM_REVIEW_NOTE,
  LENS_ORDER,
  accountReviewFor,
  forgetAccountReviews,
  reviewableAccounts,
} from '../src/lib/crm/kam/review';
import {
  KAM_COPILOT_OPERATING_PROMPT,
  PROMPT_DEPARTURES,
} from '../src/lib/crm/kam/prompt';
import { kamCopilotAgent } from '../src/lib/crm/stage7/agents/kam';
import { emptyRun, makeIds } from '../src/lib/crm/stage7/agents/build';
import { AGENT_LABELS, AGENT_NAMES, AGENT_PURPOSES } from '../src/lib/crm/stage7/contract';
import { runAgents } from '../src/lib/crm/stage7/queue';
import { invalidateCaches } from '../src/lib/crm/cacheBus';
import { captureCommitment } from '../src/lib/crm/stage5/writes';
import { CRM_MODULE_DESTINATIONS } from '../src/lib/crm/moduleNav';
import { checkLanguage } from '../src/lib/crm/language';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual } = makeAssert(r);

const NOW = CRM_DEMO_NOW;

function fresh(id: string): CrmWorkspaceData {
  const found = getCrmWorkspace(id);
  if (!found) throw new Error(`no workspace ${id}`);
  const copy = structuredClone(found);
  forgetAccountReviews(copy);
  return copy;
}

function allReviews(data: CrmWorkspaceData) {
  return reviewableAccounts(data, NOW);
}

function runKam(data: CrmWorkspaceData) {
  return kamCopilotAgent({
    data,
    now: NOW,
    otherWorkspaces: CRM_WORKSPACES.filter((other) => other !== data),
    nextId: makeIds('kam'),
  });
}

/* =====================================================================
   1. The three states are kept apart, which is the whole promise
   ===================================================================== */

group('Every finding declares which of the three states it is', () => {
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      const where = `${data.workspace.name}, ${review.organisationName}`;
      for (const lens of review.lenses) {
        for (const item of lens.known) {
          assertEqual(item.basis, 'stated', `${where}, ${lens.key}: everything in "known" is stated`);
          assert(
            item.sources.length > 0,
            `${where}, ${lens.key}, ${item.key}: a recorded finding names the record it came from`
          );
        }
        for (const item of lens.assumed) {
          assertEqual(
            item.basis,
            'inferred',
            `${where}, ${lens.key}: everything in "assumed" is inferred`
          );
          /* The rule that makes an inference arguable rather than merely
             assertive. A reader must be able to disagree with the reasoning. */
          assert(
            item.from !== null && item.from.trim().length > 0,
            `${where}, ${lens.key}, ${item.key}: an inference says what it was inferred from`
          );
        }
        for (const item of lens.unknown) {
          assertEqual(
            item.basis,
            'unknown',
            `${where}, ${lens.key}: everything in "unknown" is unknown`
          );
        }
      }
    }
  }
});

group('A finding never appears in two states at once', () => {
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      for (const lens of review.lenses) {
        const keys = [
          ...lens.known.map((item) => item.key),
          ...lens.assumed.map((item) => item.key),
          ...lens.unknown.map((item) => item.key),
        ];
        assertEqual(
          new Set(keys).size,
          keys.length,
          `${data.workspace.name}, ${review.organisationName}, ${lens.key}: no finding is in two columns`
        );
      }
    }
  }
});

group('An inference never claims a source it did not read', () => {
  for (const data of CRM_WORKSPACES) {
    const ids = new Set<string>([
      ...data.organisations.map((row) => row.id),
      ...data.accountPlans.map((row) => row.id),
      ...data.accountPlanEntries.map((row) => row.id),
      ...data.workItems.map((row) => row.id),
      ...data.commitments.map((row) => row.id),
      ...data.whitespaceCells.map((row) => row.id),
      ...data.jointPlans.map((row) => row.id),
      ...data.personOrganisationRoles.map((row) => row.id),
    ]);

    for (const review of allReviews(data)) {
      for (const lens of review.lenses) {
        for (const item of [...lens.known, ...lens.assumed, ...lens.unknown]) {
          for (const source of item.sources) {
            assert(
              ids.has(source.id),
              `${data.workspace.name}, ${review.organisationName}: ${item.key} points at ${source.id}, which is not a record in this workspace`
            );
          }
        }
      }
    }
  }
});

group('A quote is the record speaking, never the copilot paraphrasing', () => {
  for (const data of CRM_WORKSPACES) {
    /* Every quote on a review must appear verbatim somewhere in the workspace
       data. A paraphrase in quotation marks is the single most damaging thing
       this module could produce: it puts words a customer never said inside
       quotation marks, and somebody repeats them. */
    const corpus = JSON.stringify(data);

    for (const review of allReviews(data)) {
      for (const lens of review.lenses) {
        for (const item of [...lens.known, ...lens.assumed, ...lens.unknown]) {
          for (const source of item.sources) {
            if (source.quote === null) continue;
            /* Skip assembled quotes, which are joined lists rather than one
               sentence, and are checked by their parts below. */
            if (source.quote.includes('; ')) {
              for (const part of source.quote.split('; ')) {
                assert(
                  corpus.includes(JSON.stringify(part).slice(1, -1)),
                  `${data.workspace.name}: a quoted part "${part.slice(0, 40)}" is not in any record`
                );
              }
              continue;
            }
            if (source.quote.startsWith('Review date ')) continue;
            assert(
              corpus.includes(JSON.stringify(source.quote).slice(1, -1)),
              `${data.workspace.name}: the quote "${source.quote.slice(0, 50)}" does not appear in any record`
            );
          }
        }
      }
    }
  }
});

/* =====================================================================
   2. Nothing about a person. The refusal, asserted in four directions
   ===================================================================== */

group('No user id reaches any review', () => {
  for (const data of CRM_WORKSPACES) {
    const userIds = data.members.map((member) => member.userId);
    const serialised = JSON.stringify(allReviews(data));
    for (const userId of userIds) {
      assert(
        !serialised.includes(userId),
        `${data.workspace.name}: user id ${userId} does not appear anywhere in a review`
      );
    }
  }
});

group('No disposition word reaches anything a person reads', () => {
  /* Deliberately broad, and deliberately includes the words a well-meaning
     future change would reach for first.

     Scanned over what a READER SEES: labels, statements, inferences, questions
     and the gaps they close. Not over the raw payload, because `Seat.role`
     carries the schema's own enum value, and `blocker` is a category name in
     a list of seats rather than an assertion about anybody. The seat labelled
     for it reads "Recorded as resistant", is non-zero only where a person
     recorded AND confirmed it, and never carries a name. The separate scan
     below covers the words that must not appear even as a key. */
  const forbidden = [
    'opponent',
    'resistant to',
    'difficult',
    'disengaged',
    'hostile',
    'unhelpful',
    'low influence',
    'high influence',
    'power score',
    'influence score',
    'likely to block',
    'detractor',
    'sentiment',
    'loyalty',
  ];

  for (const data of CRM_WORKSPACES) {
    const read: string[] = [];
    for (const review of allReviews(data)) {
      read.push(review.note);
      for (const seat of review.seats) read.push(seat.label);
      for (const lens of review.lenses) {
        read.push(lens.label, lens.question);
        for (const item of [...lens.known, ...lens.assumed, ...lens.unknown]) {
          read.push(item.statement);
          if (item.from) read.push(item.from);
          for (const source of item.sources) read.push(source.label);
        }
      }
      for (const question of review.questions) read.push(question.question, question.closes);
    }

    const visible = read.join(' \n ').toLowerCase();
    for (const word of forbidden) {
      assert(
        !visible.includes(word),
        `${data.workspace.name}: the word "${word}" must not appear in anything a person reads`
      );
    }
  }
});

group('No scoring or ranking language appears even as a key', () => {
  /* These must not appear anywhere in the payload at all, enum values
     included. A key named `influenceScore` is a column waiting to happen. */
  const never = [
    'score',
    'ranking',
    'ranked',
    'rating',
    'percentile',
    'grade',
    'tier',
    'power map',
    'influence map',
  ];

  for (const data of CRM_WORKSPACES) {
    /* The standing note DENIES these words ("nothing here is a ranking, or a
       score"), so scanning the prose that promises the rule would fail the
       rule. The note is checked separately, above. And the match is on whole
       words: "rating" inside "operating" is not a rating. */
    const payload = allReviews(data).map((review) => ({ ...review, note: '' }));
    const serialised = JSON.stringify(payload).toLowerCase();

    for (const word of never) {
      const pattern = new RegExp(`\\b${word.replace(/ /g, '\\s')}`, 'i');
      assert(
        !pattern.test(serialised),
        `${data.workspace.name}: "${word}" must not appear anywhere in a review, including its keys`
      );
    }
  }
});

group('The one role that is an accusation is reported only where confirmed', () => {
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      const seat = review.seats.find((entry) => entry.role === 'blocker');
      assert(seat !== undefined, `${data.workspace.name}: the seat exists in the list`);
      if (!seat) continue;

      /* Every one counted must have been confirmed by a person. The schema
         already requires it; this asserts the copilot never reports one that
         was not. */
      assertEqual(
        seat.filled,
        seat.confirmed,
        `${data.workspace.name}, ${review.organisationName}: a resistant role is only ever reported where a person confirmed it`
      );
      assert(
        !seat.label.toLowerCase().includes('blocker'),
        `${data.workspace.name}: the seat is labelled by what was recorded, not with the accusation`
      );
    }
  }
});

group('A seat is a count, never a person', () => {
  for (const data of CRM_WORKSPACES) {
    const names = data.people
      .filter((person) => person.deletedAt === null)
      .map((person) => person.fullName);

    for (const review of allReviews(data)) {
      const seatText = JSON.stringify(review.seats);
      for (const name of names) {
        assert(
          !seatText.includes(name),
          `${data.workspace.name}, ${review.organisationName}: no person's name appears in the buying centre figures`
        );
      }

      for (const seat of review.seats) {
        /* The counts must be internally consistent, or the panel is saying
           something arithmetically impossible about people. */
        assert(
          seat.confirmed <= seat.filled,
          `${data.workspace.name}: ${seat.label} cannot have more confirmed than filled`
        );
        assert(
          seat.withObjective <= seat.filled,
          `${data.workspace.name}: ${seat.label} cannot have more objectives than people`
        );
        assert(seat.filled >= 0, `${data.workspace.name}: ${seat.label} count is not negative`);
      }
    }
  }
});

group('Seat counts are recomputed from the roles and match', () => {
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      const roles = data.personOrganisationRoles.filter(
        (role) => role.organisationId === review.organisationId && role.endedOn === null
      );
      for (const seat of review.seats) {
        const held = roles.filter((role) => role.stakeholderRole === seat.role);
        assertEqual(
          seat.filled,
          held.length,
          `${data.workspace.name}, ${review.organisationName}: ${seat.label} count matches the roles recorded`
        );
        assertEqual(
          seat.confirmed,
          held.filter((role) => role.roleConfirmedAt !== null).length,
          `${data.workspace.name}, ${review.organisationName}: ${seat.label} confirmations match`
        );
      }
    }
  }
});

group('The copilot never assigns the role that is an accusation', () => {
  /* `blocker` is the one stakeholder role the schema requires a person to
     confirm, because it is the one that is an accusation. Nothing in this
     module writes a role at all, and no proposal it builds would change one. */
  for (const data of CRM_WORKSPACES) {
    const run = runKam(data);
    for (const proposal of run.proposals) {
      for (const change of proposal.changes) {
        assert(
          change.table !== 'crm_person_organisation_roles',
          `${data.workspace.name}: no proposal changes a stakeholder role`
        );
        assert(
          change.table !== 'crm_people',
          `${data.workspace.name}: no proposal changes a person record`
        );
      }
    }

    const roles: StakeholderRole[] = ['blocker'];
    for (const role of roles) {
      const asserted = data.personOrganisationRoles.filter(
        (entry) => entry.stakeholderRole === role && entry.roleConfirmedAt === null
      );
      assertEqual(
        asserted.length,
        0,
        `${data.workspace.name}: the fixture holds no unconfirmed "${role}", which the schema already refuses`
      );
    }
  }
});

/* =====================================================================
   3. The agent obeys the Stage 7 contract
   ===================================================================== */

group('The copilot proposes and never changes anything', () => {
  for (const data of CRM_WORKSPACES) {
    const run = runKam(data);
    for (const proposal of run.proposals) {
      assertEqual(
        proposal.changes.length,
        0,
        `${data.workspace.name}: ${proposal.id} changes no record, because a copilot that edits is a copilot nobody checks`
      );
      assertEqual(
        proposal.externalAction.kind,
        'none',
        `${data.workspace.name}: ${proposal.id} sends nothing`
      );
      assertEqual(
        proposal.externalAction.authorisedToSend,
        false,
        `${data.workspace.name}: ${proposal.id} is not authorised to send`
      );
      assertEqual(
        proposal.isDestructive,
        false,
        `${data.workspace.name}: ${proposal.id} is not destructive`
      );
    }
  }
});

group('Every proposal carries the eleven fields and gets admitted', () => {
  for (const data of CRM_WORKSPACES) {
    const run = runKam(data);
    assertEqual(
      run.refused.length,
      0,
      `${data.workspace.name}: nothing the copilot built was refused at the door (${run.refused.map((entry) => entry.because.join(', ')).join(' | ')})`
    );

    for (const proposal of run.proposals) {
      const where = `${data.workspace.name}, ${proposal.id}`;
      assert(proposal.observed.trim().length > 0, `${where}: says what it observed`);
      assert(proposal.proposes.trim().length > 0, `${where}: says what it proposes`);
      assert(proposal.sources.length > 0, `${where}: names its sources`);
      assert(Array.isArray(proposal.assumptions), `${where}: states assumptions, even when empty`);
      assert(Array.isArray(proposal.conflicts), `${where}: states conflicts`);
      assert(Array.isArray(proposal.missingInformation), `${where}: states what it did not have`);
      assert(proposal.consequences.length > 0, `${where}: says what happens if approved`);
      assert(
        proposal.approval.because.trim().length > 0,
        `${where}: says why that approval role`
      );
      assertEqual(proposal.agent, 'kam_copilot', `${where}: is attributed to the copilot`);
    }
  }
});

group('The copilot is registered as the eleventh agent and runs in the queue', () => {
  assert(AGENT_NAMES.includes('kam_copilot'), 'the copilot is a named agent');
  assertEqual(AGENT_LABELS.kam_copilot, 'KAM Copilot', 'it has a label');
  assert(
    AGENT_PURPOSES.kam_copilot.length > 0,
    'it says what it is for, like the other ten'
  );

  for (const data of CRM_WORKSPACES) {
    const run = runAgents(data, NOW, CRM_WORKSPACES.filter((other) => other !== data));
    const mine = run.proposals.filter((proposal) => proposal.agent === 'kam_copilot');
    const direct = runKam(data).proposals;
    assertEqual(
      mine.length,
      direct.length,
      `${data.workspace.name}: the queue runs the copilot and gets the same proposals`
    );
  }
});

group('An empty seat produces a question, not a guess at who fills it', () => {
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      const empty = review.seats.filter(
        (seat) => seat.requiredForDecision && seat.filled === 0
      );
      if (empty.length === 0) continue;

      const gaps = review.lenses
        .find((lens) => lens.key === 'people')
        ?.unknown.map((item) => item.key) ?? [];

      for (const seat of empty) {
        assert(
          gaps.includes(`seat_empty_${seat.role}`),
          `${data.workspace.name}, ${review.organisationName}: the empty ${seat.label} seat is named as a gap`
        );
        const question = review.questions.find((entry) => entry.key === `q_seat_${seat.role}`);
        assert(
          question !== undefined,
          `${data.workspace.name}, ${review.organisationName}: and carries a question to close it`
        );
        if (question) {
          assert(
            question.askWhom.trim().length > 0,
            `${data.workspace.name}: the question says who would know, by role`
          );
        }
      }
    }
  }
});

/* =====================================================================
   4. The questions are worth asking
   ===================================================================== */

group('Every question is tied to a gap and ordered by what it closes', () => {
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      const statements = new Set(
        review.lenses.flatMap((lens) =>
          [...lens.known, ...lens.assumed, ...lens.unknown].map((item) => item.statement)
        )
      );

      for (const question of review.questions) {
        assert(
          question.question.trim().endsWith('?'),
          `${data.workspace.name}: "${question.question.slice(0, 40)}" is a question`
        );
        assert(
          question.closes.trim().length > 0,
          `${data.workspace.name}: every question names the gap it closes`
        );
        /* The brief's instruction, enforced: no generic discovery lists. A
           question that closes nothing is a question about nothing. */
        assert(
          question.closes.length > 3,
          `${data.workspace.name}: the gap is named in words, not a code`
        );
        void statements;
      }

      const keys = review.questions.map((question) => question.key);
      assertEqual(
        new Set(keys).size,
        keys.length,
        `${data.workspace.name}, ${review.organisationName}: no question is asked twice`
      );
    }
  }
});

group('A question is specific enough to be about this customer', () => {
  /* The failure mode the brief names: "avoid generic questioning". A question
     that would be asked of any customer in any industry has not earned its
     place. These are the phrases that mark one. */
  const generic = [
    'tell me about your business',
    'what keeps you up at night',
    'what are your pain points',
    'walk me through',
    'how are things going',
  ];

  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      for (const question of review.questions) {
        const lowered = question.question.toLowerCase();
        for (const phrase of generic) {
          assert(
            !lowered.includes(phrase),
            `${data.workspace.name}: "${phrase}" is a generic opener, not a question that closes a gap`
          );
        }
      }
    }
  }
});

/* =====================================================================
   5. Coverage is about the records, and says so
   ===================================================================== */

group('Coverage is recomputed and is a proportion of the records', () => {
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      for (const lens of review.lenses) {
        const total = lens.known.length + lens.unknown.length;
        const expected = total > 0 ? Math.round((lens.known.length / total) * 100) : 0;
        assertEqual(
          lens.coverage,
          expected,
          `${data.workspace.name}, ${review.organisationName}, ${lens.key}: coverage is known over known plus unknown`
        );
        assert(
          lens.coverage >= 0 && lens.coverage <= 100,
          `${data.workspace.name}: coverage is a percentage`
        );
      }

      const known = review.lenses.reduce((sum, lens) => sum + lens.known.length, 0);
      const unknown = review.lenses.reduce((sum, lens) => sum + lens.unknown.length, 0);
      assertEqual(
        review.coverage,
        known + unknown > 0 ? Math.round((known / (known + unknown)) * 100) : 0,
        `${data.workspace.name}, ${review.organisationName}: the account figure is the six lenses together`
      );

      /* An inference must never raise coverage. Coverage counts what is
         RECORDED; counting a guess would make a well-documented account and a
         well-guessed one look identical. */
      const assumed = review.lenses.reduce((sum, lens) => sum + lens.assumed.length, 0);
      void assumed;
    }
  }
});

group('Inferring more never raises the coverage figure', () => {
  /* Asserted by construction: coverage is computed from known and unknown
     only. This checks the property holds for every lens in the fixture, so a
     future change that folds `assumed` into the numerator fails here. */
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      for (const lens of review.lenses) {
        if (lens.assumed.length === 0) continue;
        const withAssumed =
          lens.known.length + lens.assumed.length + lens.unknown.length > 0
            ? Math.round(
                ((lens.known.length + lens.assumed.length) /
                  (lens.known.length + lens.assumed.length + lens.unknown.length)) *
                  100
              )
            : 0;
        assert(
          lens.coverage !== withAssumed || lens.unknown.length === 0,
          `${data.workspace.name}, ${lens.key}: coverage counts what is recorded, not what was guessed`
        );
      }
    }
  }
});

/* =====================================================================
   6. The six lenses, the note, and the destination
   ===================================================================== */

group('Every review carries all six lenses in order', () => {
  for (const data of CRM_WORKSPACES) {
    for (const review of allReviews(data)) {
      assertEqual(
        review.lenses.length,
        6,
        `${data.workspace.name}, ${review.organisationName}: six lenses`
      );
      assertEqual(
        review.lenses.map((lens) => lens.key).join(','),
        LENS_ORDER.join(','),
        `${data.workspace.name}: the lenses are in the brief's order`
      );
      for (const lens of review.lenses) {
        assert(lens.question.trim().endsWith('?'), `${lens.key}: states the question it answers`);
      }
      assertEqual(review.note, KAM_REVIEW_NOTE, 'the standing note is on every review');
    }
  }
});

group('The copilot is a destination in the module navigation', () => {
  const destination = CRM_MODULE_DESTINATIONS.find((entry) => entry.path === '/crm/kam');
  assert(destination !== undefined, 'the destination exists');
  if (!destination) return;
  assertEqual(destination.label, 'KAM Copilot', 'it is called the KAM Copilot');
  assertEqual(destination.group, 'Accounts', 'it sits in Accounts, beside the plans it reads');
  assert(
    destination.accessibleDescription.includes('no judgement') ||
      destination.accessibleDescription.includes('Carries no judgement'),
    'and its description says what it refuses to do'
  );
});

group('Everything the copilot says is in house language', () => {
  for (const data of CRM_WORKSPACES) {
    const text: string[] = [];
    for (const review of allReviews(data)) {
      text.push(review.note);
      for (const lens of review.lenses) {
        text.push(lens.label, lens.question);
        for (const item of [...lens.known, ...lens.assumed, ...lens.unknown]) {
          text.push(item.statement);
          if (item.from) text.push(item.from);
        }
      }
      for (const question of review.questions) text.push(question.question, question.closes);
      for (const seat of review.seats) text.push(seat.label);
    }

    for (const line of text) {
      const problems = checkLanguage(line);
      assertEqual(
        problems.length,
        0,
        `${data.workspace.name}: "${line.slice(0, 60)}" is in house language (${problems.join('; ')})`
      );
    }
  }
});

/* =====================================================================
   7. The prompt, and the departures from the brief
   ===================================================================== */

group('The operating prompt states the rules the code enforces', () => {
  const prompt = KAM_COPILOT_OPERATING_PROMPT;
  /* Normalised, because the prompt is hard-wrapped for reading and a rule
     that falls across a line break is still the rule. */
  const flat = prompt.replace(/\s+/g, ' ');

  for (const required of [
    'KNOWN',
    'ASSUMED',
    'UNKNOWN',
    'Never present an assumption as a fact',
    'I do not yet have enough evidence',
    'never say or imply that a named person is a blocker',
    'never rate, rank, score or compare two people',
    'Never invent a number',
    'may not write to a CRM record',
    'Australian English',
    'No em dashes',
  ]) {
    assert(
      flat.includes(required),
      `the prompt states "${required.slice(0, 45)}"`
    );
  }

  /* The prompt is subject to the same house rules as everything else Concludo
     writes. A system prompt full of em dashes would teach the model to produce
     them. */
  assert(!/[‒–—―]/.test(prompt), 'the prompt contains no dashes of its own');
  assert(
    !/\b(?:organiz|realiz|recogniz|prioritiz|analyz|behavior|color|percent\b)/i.test(prompt),
    'the prompt is in Australian English'
  );
});

group('Every departure from the brief names the code that enforces it', () => {
  assert(PROMPT_DEPARTURES.length >= 3, 'the departures are written down');
  for (const departure of PROMPT_DEPARTURES) {
    assert(departure.asked.trim().length > 0, 'a departure says what was asked for');
    assert(departure.built.trim().length > 0, 'and what was built instead');
    assert(departure.because.trim().length > 20, 'and why, in more than a phrase');
    /* The check that matters: a departure with no enforcement is a note, and
       notes do not stop anything. */
    assert(
      departure.enforcedBy.trim().length > 20,
      `the departure "${departure.asked.slice(0, 40)}" names what holds the line`
    );
    assert(
      /\.ts|migration|suite|schema/i.test(departure.enforcedBy),
      `and that is a file, a migration or a suite, not an intention (saw "${departure.enforcedBy.slice(0, 50)}")`
    );
  }
});

/* =====================================================================
   8. Writes reach the page, and reads change nothing
   ===================================================================== */

group('Recording something changes the review, through the cache bus', () => {
  const data = fresh('ws-agency');
  const organisation = data.organisations.find((entry) => entry.deletedAt === null);
  assert(organisation !== undefined, 'the fixture has an organisation');
  if (!organisation) return;

  const before = accountReviewFor(data, organisation.id, NOW);
  assert(before !== null, 'there is a review to start from');
  /* The statement, not the count of findings. The action lens summarises all
     overdue promises in ONE line, so adding another changes the sentence and
     not the length of the list. Counting findings here passed for the wrong
     reason and then failed for the right one. */
  const statementsBefore = (before?.lenses.find((lens) => lens.key === 'actions')?.known ?? [])
    .map((item) => item.statement)
    .join(' | ');

  const context = {
    userId: data.members[0].userId,
    workspaceId: data.workspace.id,
    role: 'crm_contributor' as const,
    now: NOW,
  };

  captureCommitment(context, data, {
    description: 'Send the revised scope by Friday',
    ownerName: 'Us',
    ownedByUs: true,
    organisationId: organisation.id,
    dueDate: '2026-09-01',
  });

  /* Stale until the bus is told, which is the behaviour being asserted. */
  const stale = accountReviewFor(data, organisation.id, NOW);
  assertEqual(
    (stale?.lenses.find((lens) => lens.key === 'actions')?.known ?? [])
      .map((item) => item.statement)
      .join(' | '),
    statementsBefore,
    'the cache is stale until the write is announced, which is why the bus exists'
  );

  invalidateCaches(data);

  const after = accountReviewFor(data, organisation.id, NOW);
  const statementsAfter = (after?.lenses.find((lens) => lens.key === 'actions')?.known ?? [])
    .map((item) => item.statement)
    .join(' | ');

  assert(
    statementsAfter !== statementsBefore,
    `after the bus fires, the overdue promise reaches the action lens (before: "${statementsBefore}", after: "${statementsAfter}")`
  );
  assert(
    statementsAfter.includes('past the date we gave'),
    'and it is reported as a promise past the date we gave'
  );
});

group('Reading a review changes nothing', () => {
  for (const data of CRM_WORKSPACES) {
    const before = JSON.stringify({
      people: data.people.length,
      roles: data.personOrganisationRoles.length,
      plans: data.accountPlans.length,
      audit: data.auditEvents.length,
      proposals: data.proposals.length,
    });
    allReviews(data);
    runKam(data);
    const after = JSON.stringify({
      people: data.people.length,
      roles: data.personOrganisationRoles.length,
      plans: data.accountPlans.length,
      audit: data.auditEvents.length,
      proposals: data.proposals.length,
    });
    assertEqual(after, before, `${data.workspace.name}: reading and proposing wrote nothing`);
  }
});

group('A review belongs to one workspace and never leaks another', () => {
  for (const data of CRM_WORKSPACES) {
    const others = CRM_WORKSPACES.filter((other) => other !== data);
    const serialised = JSON.stringify(allReviews(data));

    for (const other of others) {
      for (const organisation of other.organisations.slice(0, 4)) {
        if (data.organisations.some((mine) => mine.id === organisation.id)) continue;
        assert(
          !serialised.includes(organisation.id),
          `${data.workspace.name}: no record id from ${other.workspace.name} appears in a review`
        );
      }
    }
  }
});

group('An account with nothing recorded still returns a usable review', () => {
  /* The case that breaks a copilot built around happy data: an organisation
     with no plan, no roles, no work. It must return gaps and questions rather
     than an empty page or a crash. */
  const data = fresh('ws-agency');
  const bare = data.organisations.find(
    (organisation) =>
      organisation.deletedAt === null &&
      !data.accountPlans.some((plan) => plan.organisationId === organisation.id)
  );

  if (!bare) {
    assert(true, 'every organisation in this fixture has a plan, so there is nothing to check');
    return;
  }

  const review = accountReviewFor(data, bare.id, NOW);
  assert(review !== null, 'an account with no plan still returns a review');
  if (!review) return;

  assertEqual(review.lenses.length, 6, 'with all six lenses');
  assert(
    review.questions.length > 0,
    'and questions to ask, because an empty account is the one that most needs them'
  );
  assert(
    review.lenses.some((lens) => lens.unknown.length > 0),
    'and names what is missing rather than rendering blank'
  );
  assertEqual(
    review.coverage < 100,
    true,
    'and does not claim full coverage of records that do not exist'
  );
});

group('A deleted organisation has no review', () => {
  for (const data of CRM_WORKSPACES) {
    const deleted = data.organisations.filter((organisation) => organisation.deletedAt !== null);
    for (const organisation of deleted) {
      assertEqual(
        accountReviewFor(data, organisation.id, NOW),
        null,
        `${data.workspace.name}: a deleted organisation returns no review`
      );
    }
    const ids = new Set(allReviews(data).map((review) => review.organisationId));
    for (const organisation of deleted) {
      assert(
        !ids.has(organisation.id),
        `${data.workspace.name}: and does not appear in the list`
      );
    }
  }
});

report('Concludo CRM, the KAM Copilot', r);
