# Email Command Centre: privacy deletion workflow

Concludo Workspace. Final, Stage 7.

What happens when somebody asks Concludo to delete what it holds about their
mailbox, in the order it happens, with the sentence that has to be said at the
end.

The sentence is: **Concludo deleted the analysis, kept the audit trail, and
never had any of the mail.** Each of the three clauses is true and each one
matters.

---

## 1. What Concludo holds, so a request can be answered precisely

| Held | Not held |
|---|---|
| Thread metadata: subject, folder, participants, timestamps, read state | Message bodies |
| Message metadata: sender, recipients, subject, timestamps, attachment counts | Attachment contents |
| Analysis: summaries, status, priority and its eleven factors, extractions | A copy of the mailbox |
| Source references, each with a short verbatim quote | Anything beyond those quotes |
| Drafts prepared for review, and the reasons ones were withheld | Anything sent, because nothing is sent |
| Approvals, with the snapshot of what was approved | Access or refresh tokens, which live in the token store |
| Backlog sessions and the decisions recorded in them | A productivity record of any kind |
| Audit events describing what the system did | Message content in those events |

The short quotes are the one place message content persists, and they are there
because an extraction a person cannot check is worse than no extraction. They
are a sentence each, not a body.

## 2. The four requests, and what each one means

| Request | What it does | Where |
|---|---|---|
| **Disconnect the mailbox** | Stops synchronisation, clears the token handle and the cursor. Analysis stays | Settings, by the person |
| **Delete my analysis** | Everything in section 1's left column except the audit trail and the account row | `ecc_delete_account_data` |
| **Export everything you hold** | A JSON file, with an explicit list of what is not in it | `ecc_export_account` |
| **Delete my Concludo account** | The above for every connected account, plus the Workspace account itself | Workspace-level, outside this module |

People often say "delete my data" and mean the second. Ask which one before
acting, and say what each does, because a disconnection that looks like a
deletion is the kind of misunderstanding that surfaces months later.

## 3. The workflow

### Step 1. Verify who is asking

The request has to come from the signed-in person for that account, or be
verified out of band. "Delete the analysis for alex@practice.example" from an
address that is not Alex is a social engineering attempt with a privacy right
as the cover story.

### Step 2. Confirm the scope back to them

In writing, before anything is deleted:

> You have asked us to delete the analysis Concludo holds for
> alex@practice.example. That removes every summary, action, deadline,
> priority, draft and backlog decision for that mailbox. It does not touch any
> email: Concludo stores analysis, not mail, and has never held a copy of your
> messages. We keep a record that the deletion happened, which names no message
> content. Shall we go ahead?

Deletion is not reversible, and `ecc_delete_account_data` cannot be undone
without a restore, which `docs/BACKUP_AND_RECOVERY.md` explains re-creates a
problem of its own.

### Step 3. Offer the export first

Most people asking for deletion also want to know what was there. Offering the
export unprompted is both decent and useful: it is the document that shows the
deletion was complete.

```sql
select ecc_export_account('<account id>');
```

It carries a `not_included` list naming message bodies, attachment contents and
tokens. An export that quietly omits something is worse than one that says what
it omits.

### Step 4. Disconnect first

Stop the mailbox being read while the deletion runs. Otherwise the next
scheduled synchronisation re-creates rows behind the deletion, which looks
exactly like a deletion that did not work.

### Step 5. Delete

```sql
select ecc_delete_account_data('<account id>');
```

It returns both halves of the truth:

```json
{
  "account_id": "...",
  "removed": {
    "extractions": 418, "security_alerts": 3, "drafts": 12,
    "approvals": 2, "backlog_decisions": 25, "backlog_sessions": 2,
    "corrections": 4, "analyses": 142, "attachments": 31,
    "messages": 389, "threads": 142,
    "capability_grants": 1, "preferences": 1
  },
  "retains": [
    "412 audit events, which record what the system did and carry no message content.",
    "The ecc_account row itself, with its token handle and cursor cleared, so the same mailbox is not silently re-analysed later.",
    "Whatever the mail provider holds. Concludo cannot delete a message and has never had permission to.",
    "The stored token until the token store confirms its own destruction, which is a separate step outside this database."
  ],
  "mail_deleted": false,
  "mail_note": "No mail was deleted. Concludo stores analysis, not mail, and holds no capability that could delete a message."
}
```

Keep that output. It is the record of what was done.

### Step 6. Destroy the stored token

A separate system, and the one step that is easy to forget because the database
looks finished without it.

1. Revoke the grant at Microsoft or Google, so the token is dead at the source.
2. Delete the token store entry for that handle.
3. Confirm the entry is gone, and record the confirmation.

Until step 6 completes, the `retains` block above is telling the truth about a
token that still exists. Finish it the same day.

### Step 7. Confirm to the person

What was removed, with the counts. What survives, in plain words, and why. That
no email was affected. The date.

Do not write "all your data has been permanently erased" when an audit trail
survives. That sentence is the one that gets quoted back.

### Step 8. Record it

The deletion writes its own audit event. Also note the request, the
verification, the confirmation, and the token destruction in the customer
record, because the audit trail does not know a person asked.

## 4. Why the audit trail survives

It is the record of what the system did, including this deletion. It holds no
message content, which is asserted by test, and it is append-only at the grant
level: the application role has `SELECT` and `INSERT` on `ecc_audit_event` and
nothing else, and there is no update policy or delete policy on it at all.

Deleting it would remove the evidence that the deletion happened, which is the
one thing a person might later need to rely on. If somebody insists, that is a
conversation with legal advice, and it needs a direct database connection and
`ecc_delete_account_data(account_id, p_keep_audit => false)` run by an
administrator. The application cannot do it.

## 5. Automatic retention

Nothing has to be requested for most of this to go away on its own.

| Setting | Default | Range |
|---|---|---|
| `analysis_retention_days` | 365 | 7 to 2,555 |

A daily sweep at 03:00 Australia/Melbourne runs `ecc_retention_sweep`, which
deletes extractions, alerts, drafts, analyses and finished backlog sessions
older than the window, and writes an audit event saying what it did. It does not
delete mail, which is trivially true: there is no body column in the schema.

A sweep reporting zero rows removed every day on an account with old analysis is
a sweep that is not running. There is a ticket-level alert for that.

## 6. The part no technical control fixes

The person who connects a mailbox consents for themselves. **The people who
wrote to them did not.** Most of what this module analyses is correspondence
with third parties who have never dealt with Concludo and cannot ask Concludo
for anything, because they do not know it exists.

That is a real limitation and it is not solved by a deletion endpoint. What
reduces it:

- storing analysis rather than mail, so there is less to hold;
- storing a quoted sentence rather than a body, so the quotes are checkable
  rather than a second copy;
- defaulting to short retention, so it does not accumulate;
- excluding folders before analysis rather than filtering afterwards, so
  excluded mail is never read at all;
- a privacy policy that names mailbox access specifically, and the consent
  toolkit Concludo already ships for recordings, which applies here too.

What would make it worse: longer retention because storage is cheap, a
cross-account view on by default, or training a model on customer data. None of
those is done, and the last one is refused in writing.

## 7. No model training on customer data

Concludo does not use customer data to train or fine-tune any model. That is
Concludo's own commitment, stated in `MODEL_TRAINING_STANCE` in the code so it
is visible where the data is handled.

It binds Concludo and nobody else. What a model provider logs or retains is
governed by the agreement with that provider, and getting that agreement in
writing is a prerequisite in `docs/SETUP.md` before a single model call is made.
Saying "no training on your data" without that agreement would be a claim about
somebody else's behaviour.

## 8. Timing

| Request | Target | Hard limit |
|---|---|---|
| Export | 3 business days | 30 days |
| Delete analysis | 3 business days, including token destruction | 30 days |
| Disconnect | Immediate, by the person | — |
| Delete Concludo account | 7 business days | 30 days |

Backups are the honest footnote: a deleted row survives in point-in-time
recovery for 7 days and in the nightly dumps for 35. Any restore to a point
before a deletion must re-apply it, and the audit trail is how the restore
checklist finds which deletions to re-run. That is written into
`docs/BACKUP_AND_RECOVERY.md` section 6 rather than left to memory.
