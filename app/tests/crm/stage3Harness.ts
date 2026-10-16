/**
 * Shared assertions for the Concludo CRM Stage 3 suites.
 *
 * House style, matching the rest of the tests directory: plain assertions, no
 * framework, exit code 1 on any failure, nothing treated as a warning. Stage 2
 * repeated these helpers in each file; three suites is the point at which that
 * stops being clearer than sharing them.
 */

export interface Recorder {
  checks: number;
  failures: string[];
}

export function recorder(): Recorder {
  return { checks: 0, failures: [] };
}

export function makeAssert(r: Recorder) {
  function assert(condition: boolean, description: string): void {
    r.checks += 1;
    if (condition) return;
    r.failures.push(description);
    console.error(`  FAIL  ${description}`);
  }

  function assertEqual<T>(actual: T, expected: T, description: string): void {
    assert(
      actual === expected,
      `${description}  (expected ${String(expected)}, got ${String(actual)})`
    );
  }

  /** Asserts the call throws, and that the thrown thing matches the predicate. */
  function assertRefused(
    body: () => unknown,
    matches: (error: unknown) => boolean,
    description: string
  ): void {
    r.checks += 1;
    try {
      const out = body();
      // An async body returns a promise, which would swallow the throw and
      // pass this test silently. Refuse to be that test.
      if (out instanceof Promise) {
        r.failures.push(`${description}  (body returned a promise; use assertRefusedAsync)`);
        console.error(`  FAIL  ${description}  (body returned a promise)`);
        return;
      }
      r.failures.push(`${description}  (nothing was thrown)`);
      console.error(`  FAIL  ${description}  (nothing was thrown)`);
    } catch (error) {
      if (matches(error)) return;
      r.failures.push(`${description}  (wrong refusal: ${String(error)})`);
      console.error(`  FAIL  ${description}  (wrong refusal: ${String(error)})`);
    }
  }

  async function assertRefusedAsync(
    body: () => Promise<unknown>,
    matches: (error: unknown) => boolean,
    description: string
  ): Promise<void> {
    r.checks += 1;
    try {
      await body();
      r.failures.push(`${description}  (nothing was thrown)`);
      console.error(`  FAIL  ${description}  (nothing was thrown)`);
    } catch (error) {
      if (matches(error)) return;
      r.failures.push(`${description}  (wrong refusal: ${String(error)})`);
      console.error(`  FAIL  ${description}  (wrong refusal: ${String(error)})`);
    }
  }

  return { assert, assertEqual, assertRefused, assertRefusedAsync };
}

export function group(name: string, body: () => void): void {
  console.log(`\n${name}`);
  body();
}

export async function groupAsync(name: string, body: () => Promise<void>): Promise<void> {
  console.log(`\n${name}`);
  await body();
}

export function report(suite: string, r: Recorder): void {
  console.log(`\n${suite}: ${r.checks - r.failures.length} of ${r.checks} checks passed.`);
  if (r.failures.length === 0) {
    console.log('');
    return;
  }
  console.log('\nFAILURES, build blocked:\n');
  for (const f of r.failures) console.log('  ' + f);
  console.log('');
  process.exit(1);
}
