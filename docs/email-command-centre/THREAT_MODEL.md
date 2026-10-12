# Email Command Centre: threat model

Concludo Workspace, Email Command Centre module. Stage 6. Concludo is an
independent product, not affiliated with or endorsed by Microsoft, Google or any
device maker.

Mailbox access is the most sensitive permission a professional services business
can grant. This document states what the module is defending against, how, and
where the defence is only partial.

---

## 1. Assets, in the order an attacker would want them

1. The mailbox itself, through a token that can read it.
2. The ability to send, forward or delete as the person.
3. The analysis store: summaries, contacts, commercial terms, client names.
4. The audit trail, as a way to hide activity.
5. The person's trust in what the module tells them.

## 2. Trust boundaries

| Boundary | Trusted side | Untrusted side |
|---|---|---|
| Provider API to Concludo | Concludo code | every byte of mail and metadata |
| Message content to model | the wrapper and the prompt | the content inside the wrapper |
| Browser to server | server state | anything a browser sends |
| Account to account | the account named by the token | every other account |
| Tenant to tenant | the signed-in person's mailbox | every other mailbox in the organisation |
| Audit writer to audit store | append-only writes | edits or deletions |

**Every email and every attachment is untrusted data.** Not untrusted in the
sense of "scan it for malware" but in the sense that nothing in it is ever an
instruction, a configuration value or a trusted assertion about anything.

## 3. The eight invariants

Declared in `src/lib/email/security/injection.ts` as `SECURITY_INVARIANTS`, each
naming the structural control and the file a reviewer can open. A test asserts
that each one describes a mechanism rather than an intention: the phrase "we try
to" fails the suite.

| Invariant | Enforced by |
|---|---|
| No instruction in content can override system behaviour | `security/injection.ts` `wrapUntrusted` |
| No cross-account read | `providers/mockProvider.ts` `datasetFor`, `providers/capabilities.ts` |
| No credential disclosure | `providers/types.ts` `TokenHandle`, `privacy.ts` `redact` |
| No send | `providers/types.ts`, `capabilities.ts` `send_message` |
| No forward | `providers/types.ts`, `capabilities.ts` `forward` |
| No execution of attachment content | `capabilities.ts` `execute_attachment`, `download_attachment_to_disk` |
| No change to a trust boundary at runtime | `capabilities.ts` `grant` |
| No change to an approved draft without re-approval | `draftReview.ts` `approvalStatus` |

## 4. Threats, by what they try

### T1. Prompt injection in message content

An email instructs the analyser to raise its own priority, suppress its warning,
describe itself as internal, and send the person's contacts and invoices to an
outside address. The synthetic dataset contains exactly this message.

*Control.* The capability layer is the lock: there is no send, no forward, no
label change and no execution to invoke, and `grant()` refuses to enable one.
The wrapper is the second control: content is placed inside a fenced block whose
markers are stripped from the content, with the data-not-instruction rule stated
after the block. The detector is the third, and it is only an alarm: nine rules
raise a visible flag and record the attempt verbatim for the person to read.

*Residual risk.* Detection will miss novel phrasings. That is accepted, because
a missed detection costs a warning, not an action. The exfiltration rule was
deliberately narrowed after it flagged "I will send the invoice through
tomorrow": a warning that is usually wrong stops being read, which costs more
than the attempts it catches.

### T2. Over-broad permission grant

*Control.* Read-only base scopes, written justification per scope, a
thirteen-entry forbidden list, and a guard that throws on a forbidden **or**
undeclared scope. Seventeen capabilities are denied and ungrantable.

*Residual risk.* `Mail.ReadWrite` is the narrowest Microsoft scope that can save
a draft. A person who turns on draft saving grants more than draft saving. This
is stated on the consent screen rather than minimised.

### T3. Cross-account leakage

A work reply quoting a personal thread, or an analysis of one client's mail
appearing under another.

*Control.* Dataset, cursor, ledger keys, grants and draft context are all
per-account. The runner throws when the dataset's account id differs from the
token's. `read_other_account` is a denied capability. The combined view is
opt-in and off by default.

*Residual risk.* An operational error (restoring the wrong backup) sits outside
the code. Mitigated only by the account id being recorded on every stored row.

### T4. Tenant-wide exposure

*Control.* No `.All` scope is ever requested, and five of them are on the
forbidden list. Delegation and send-as scopes are forbidden.

*Residual risk.* A tenant administrator can grant application-wide access
independently of this module. The module cannot prevent that; it can only avoid
asking for it, and the forbidden list is what a reviewer checks that against.

### T5. Token theft or disclosure

*Control.* `TokenHandle` carries no token value, so a log line cannot contain
one. `redact`/`redactDeep` strip anything resembling a token, key or
authorisation header from error text and audit lines. A test feeds the logger
objects containing fake secrets and asserts none survives.

*Residual risk.* The token store itself is not built here. Its encryption,
key rotation and access control are listed in `docs/SETUP.md` as prerequisites,
not as things this module has solved.

### T6. Replayed or forged change notifications

*Control.* A notification is acted on only if the subscription id is one this
system registered, the subscription belongs to the named account, and the event
id is new. Mismatched ownership is refused and flagged as worth investigating.

*Residual risk.* Signature verification of the notification payload belongs to
the server component, which is not built.

### T7. Silent data loss during sync

Arguably the most likely real incident, and the least dramatic.

*Control.* The cursor advances only on a run that completed every page. Expired
cursors trigger a documented full resynchronisation. The idempotency ledger
makes a retried page harmless. A partial run says so in the stage detail and
names the cursor as unchanged.

### T8. Confident wrong output

The module tells somebody a deadline is Friday when it is Thursday, or that a
thread is resolved when it is not.

*Control.* Every determination carries `basis`, `confidence` and `evidence`, and
every extracted value carries source references with quotes a person can locate
in the message. Deadlines are labelled `stated`, `inferred` or `calculated`.
Timestamps without a zone offset are rejected. Dates render in the mailbox time
zone, pinned to Australia/Melbourne in the current build, with a regression test
after a bug that rendered every deadline a day early.

*Residual risk.* Inherent. The mitigation is that the person can always see the
sentence the claim came from, and that an unanalysed thread says it is
unanalysed rather than appearing analysed and empty.

### T9. Attachment as an attack surface

*Control.* Metadata only by default. Content processing is opt-in, size-limited
and in memory. `download_attachment_to_disk` and `execute_attachment` are
denied. No document parser has been added: every parser is an attack surface,
and adding one belongs in its own stage with its own review.

### T10. An approved draft changed after approval

*Control.* Approval is recorded as a fingerprint over six fields plus a deep
snapshot. Any change to those fields invalidates the approval and names the
fields that changed. There is no path that edits an approved draft and keeps the
approval.

### T11. Audit trail as a second mailbox

*Control.* Audit events describe actions. A test asserts that no audit line
contains message body text, and the deletion plan names the audit trail in its
`retains` section rather than implying a clean erase.

## 5. Out of scope, stated plainly

- Account takeover at the provider. If the provider account is compromised,
  Concludo's read-only access is not the relevant problem.
- Malicious insider at Concludo with database access. Addressed by operational
  controls, not by this module.
- Device compromise on the person's own machine.
- Whatever the mail provider itself logs or retains. The model-training stance
  covers Concludo and says so; it does not make claims about third parties.

## 6. What would change this document

Three changes would require it to be rewritten rather than amended: adding any
send capability, adding a document parser for attachment contents, or making the
combined account view the default. None is planned.
