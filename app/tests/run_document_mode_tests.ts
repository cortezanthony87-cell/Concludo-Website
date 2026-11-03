import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { analyseMeeting, toDocumentModeRecord } from '../src/lib/intelligence/meetingEngine';

const fixtures = [
  {
    code: 'F0',
    src: '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/fixtures/F0_Concludo_Business_Plan_v6.2.txt',
    exp: '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/fixtures/F0_expected_actions.json',
  },
  {
    code: 'F1',
    src: '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/fixtures/F1_project_plan_checklist.md',
    exp: '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/fixtures/F1_expected.json',
  },
  {
    code: 'F2',
    src: '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/fixtures/F2_policy_no_actions.md',
    exp: '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/fixtures/F2_expected.json',
  },
  {
    code: 'F3',
    src: '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/fixtures/F3_action_table_and_prose.md',
    exp: '/tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/fixtures/F3_expected.json',
  },
];

let allPassed = true;

for (const fix of fixtures) {
  const text = readFileSync(fix.src, 'utf-8');
  const model = analyseMeeting([{ name: `${fix.code}.txt`, kind: 'document', text }], {});
  const record = toDocumentModeRecord(model);
  const outPath = `/tmp/ts_actual_${fix.code}.json`;
  writeFileSync(outPath, JSON.stringify(record, null, 2), 'utf-8');

  console.log(`\n======================================================`);
  console.log(`SCORING ${fix.code} with score_document_mode.py`);
  console.log(`======================================================`);
  try {
    const output = execSync(
      `python3 /tasklet/threads/a_e5kk9t0fcc800ek9y3n0/work/document_mode_handover/tests/score_document_mode.py "${fix.exp}" "${outPath}"`,
      { encoding: 'utf-8' }
    );
    console.log(output.trim());
  } catch (err: any) {
    console.error(err.stdout || err.message);
    allPassed = false;
  }
}

if (!allPassed) {
  console.error('\nOne or more fixtures FAILED!');
  process.exit(1);
} else {
  console.log('\nALL 4 FIXTURES (F0, F1, F2, F3) PASSED CLEANLY!');
}
