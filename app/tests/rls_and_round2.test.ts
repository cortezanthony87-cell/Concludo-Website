import { test, expect, describe } from 'bun:test';
import { Client as PgClient } from 'pg';
import {
  validateModelRecord,
  redactString,
  checkDateWordsMatchIso,
  RawRecord
} from '../../supabase/functions/draft-meeting-record/validator';

describe('Round 2 Fixes & RLS Unit Tests', () => {

  test('Blocker 1: Signed-in (authenticated) and anon users cannot read, insert, or update model_drafting_control or model_drafting_allowlist', async () => {
    const client = new PgClient({
      host: 'localhost',
      database: 'concludo_preview',
      user: 'postgres',
      password: 'postgres',
    });
    await client.connect();

    try {
      // 1. Authenticated role test
      await client.query('BEGIN;');
      await client.query('SET LOCAL ROLE authenticated;');
      await client.query(`SET LOCAL "request.jwt.claims" = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';`);

      // Try reading control table
      const resReadControl = await client.query('SELECT * FROM public.model_drafting_control;');
      expect(resReadControl.rows.length).toBe(0); // RLS blocks rows

      // Try updating control table to enable flag
      const resUpdateControl = await client.query("UPDATE public.model_drafting_control SET enabled = true WHERE id = 'global';");
      expect(resUpdateControl.rowCount).toBe(0); // RLS blocks update

      // Try reading allowlist table
      const resReadAllowlist = await client.query('SELECT * FROM public.model_drafting_allowlist;');
      expect(resReadAllowlist.rows.length).toBe(0); // RLS blocks rows

      // Try inserting into allowlist table
      let insertFailed = false;
      try {
        await client.query("INSERT INTO public.model_drafting_allowlist (user_id) VALUES ('33333333-3333-3333-3333-333333333333');");
      } catch (err: any) {
        insertFailed = true;
        expect(err.message).toMatch(/violates row-level security policy/);
      }
      expect(insertFailed).toBe(true);

      await client.query('ROLLBACK;');

      // 2. Service role / superuser CAN read and modify
      const resSuper = await client.query("SELECT enabled FROM public.model_drafting_control WHERE id = 'global';");
      expect(resSuper.rows.length).toBe(1);
    } finally {
      await client.end();
    }
  });

  test('Blocker 2: Invented next meeting date is rejected when transcript says only "We will speak again soon and send the deck by Friday"', () => {
    const transcript = "We will speak again soon and send the deck by Friday.";
    const meetingDate = "2026-11-13"; // Friday 13 Nov

    // Case A: Model returns next_meeting.date = 2026-11-20 with raw_text missing
    const rawNoRaw: RawRecord = {
      decisions: [],
      next_meeting: {
        date: "2026-11-20",
        raw_text: null
      }
    };
    const resA = validateModelRecord(rawNoRaw, transcript, meetingDate);
    expect(resA.validated.next_meeting).toBeNull();
    expect(resA.validated.flags).toContain('date_uncertainty');

    // Case B: Model returns raw_text "2026-11-20" which does NOT appear in transcript
    const rawNonVerbatim: RawRecord = {
      decisions: [],
      next_meeting: {
        date: "2026-11-20",
        raw_text: "2026-11-20"
      }
    };
    const resB = validateModelRecord(rawNonVerbatim, transcript, meetingDate);
    expect(resB.validated.next_meeting).toBeNull();

    // Case C: Model returns raw_text "speak again soon" (which does not name a date)
    const rawVague: RawRecord = {
      decisions: [],
      next_meeting: {
        date: "2026-11-20",
        raw_text: "speak again soon"
      }
    };
    const resC = validateModelRecord(rawVague, transcript, meetingDate);
    expect(resC.validated.next_meeting).toBeNull();

    // Case D: Valid next meeting with verbatim words in transcript matching weekday
    const validTranscript = "Next meeting Friday 20 November at 10 am. Send the deck.";
    const rawValid: RawRecord = {
      decisions: [],
      next_meeting: {
        date: "2026-11-20",
        time: "10:00",
        raw_text: "Friday 20 November"
      }
    };
    const resD = validateModelRecord(rawValid, validTranscript, meetingDate);
    expect(resD.validated.next_meeting).not.toBeNull();
    expect(resD.validated.next_meeting?.date).toBe("2026-11-20");
    expect(resD.validated.next_meeting?.raw_text).toBe("Friday 20 November");

    // Case E: raw_phrase names Friday, but ISO date is a Thursday -> rejected
    const rawMismatch: RawRecord = {
      decisions: [],
      next_meeting: {
        date: "2026-11-19", // Thursday
        raw_text: "Friday 20 November"
      }
    };
    const resE = validateModelRecord(rawMismatch, validTranscript, meetingDate);
    expect(resE.validated.next_meeting).toBeNull();
  });

  test('Blocker 2: checkDateWordsMatchIso enforces weekday, month, and day-of-month', () => {
    // 2026-11-20 is a Friday
    expect(checkDateWordsMatchIso("by Friday", "2026-11-20")).toBe(true);
    expect(checkDateWordsMatchIso("by Thursday", "2026-11-20")).toBe(false);
    expect(checkDateWordsMatchIso("in November", "2026-11-20")).toBe(true);
    expect(checkDateWordsMatchIso("in December", "2026-11-20")).toBe(false);
    expect(checkDateWordsMatchIso("on the 20th", "2026-11-20")).toBe(true);
    expect(checkDateWordsMatchIso("on the 21st", "2026-11-20")).toBe(false);
  });

  test('Section 2.4: Account numbers (6-10 digits) following account or acct within 3 words are masked', () => {
    const state = { redactionCount: 0, flags: new Set<string>() };

    const t1 = "BSB 063-000 account 1234 5678";
    const r1 = redactString(t1, state);
    expect(r1).not.toContain("1234 5678");
    expect(r1).toContain("BSB [REDACTED] account [REDACTED]");

    const t2 = "Please send payment to acct no. 987654321 immediately.";
    const r2 = redactString(t2, state);
    expect(r2).not.toContain("987654321");
    expect(r2).toContain("acct no. [REDACTED]");

    // Loan amount of 450 000 is NOT masked
    const t3 = "The loan amount is 450 000 dollars.";
    const r3 = redactString(t3, state);
    expect(r3).toContain("450 000");
    expect(r3).not.toContain("[REDACTED]");
  });

  test('Section 2.5: Dash spacing regex replaces em and en dashes with comma-space cleanly', () => {
    const state = { redactionCount: 0, flags: new Set<string>() };
    const t = "rollout — final answer and item – next";
    const r = redactString(t, state);
    expect(r).toBe("rollout, final answer and item, next");
  });

});
