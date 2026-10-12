# Email Command Centre: permissions requested, and why

Concludo Workspace, Email Command Centre module. Stage 6.

Concludo is an independent product. It is not affiliated with, endorsed by or
certified by Microsoft, Google, Zoom or any device maker. Where a platform is
named below, it is named only to describe which API the integration speaks to.

Status: the scope declarations, the justification for each one and the guard
that enforces them are built and tested. No OAuth application is registered
with either provider, no token has ever been issued, and no mailbox has ever
been connected. Everything in the module today runs on the synthetic dataset.

---

## 1. The rule the scope list follows

Every scope requested at connection time is read-only. The single write the
product will ever want, saving an approved draft into the person's own Drafts
folder, is requested later and only when that person turns it on. Somebody who
never turns it on never grants it.

Declared in `src/lib/email/providers/scopes.ts`. The guard is
`assertScopesPermitted()`, which throws on a forbidden scope **and** on a scope
that is merely undeclared. A scope cannot reach an authorisation URL without
appearing in this file with a written justification first.

## 2. Microsoft 365 (Microsoft Graph)

Incremental sync: delta token. Rate limit: per-mailbox throttling, `Retry-After`
on 429.

| Scope | Requested at connection | Read only | Backs | Why this one |
|---|---|---|---|---|
| `offline_access` | Yes | Yes | incremental synchronisation | Analysis runs on a schedule. Without a refresh token, every run needs an interactive sign-in, which in practice means people leave a browser tab signed in instead. |
| `User.Read` | Yes | Yes | `read_profile` | Deciding whether a thread is waiting on the person or on someone else requires knowing which addresses are theirs. This is the narrowest scope that provides it. |
| `Mail.Read` | Yes | Yes | `read_messages`, `read_threads`, `read_attachment_metadata` | Reading the conversation is the product. `Mail.ReadBasic` was considered and rejected: it withholds message bodies, and an analysis of subject lines alone would be guesswork presented as a summary. |
| `MailboxSettings.Read` | Yes | Yes | deadline interpretation | The mailbox time zone and working hours. Without the time zone, "by close of business Friday" is interpreted in the server's zone, which is how a deadline lands on the wrong day. |
| `Mail.ReadWrite` | **No** | No | `write_draft_to_mailbox` | Requested incrementally, only if the person turns on saving approved drafts to their own Drafts folder. Graph has no narrower draft-only scope, which is stated plainly on the consent screen rather than glossed over. |

## 3. Google Workspace (Gmail API)

Incremental sync: history id. Rate limit: per-user quota units per second; both
429 and 403 `rateLimitExceeded` mean back off.

| Scope | Requested at connection | Read only | Backs | Why this one |
|---|---|---|---|---|
| `gmail.readonly` | Yes | Yes | `read_messages`, `read_threads`, `read_labels`, `read_attachment_metadata` | The narrowest Gmail scope that returns message bodies and labels. `gmail.metadata` was considered and rejected for the same reason as `Mail.ReadBasic`. |
| `userinfo.email` | Yes | Yes | `read_profile` | The signed-in address, for the same waiting-on determination as above. |
| `gmail.compose` | **No** | No | `write_draft_to_mailbox` | Requested incrementally and only on opt-in. Narrower than `gmail.modify`, and much narrower than `https://mail.google.com/`. |

## 4. The scopes this product must never request

Thirteen scopes are listed in `FORBIDDEN_SCOPES`, each with the reason. The list
exists so a reviewer can check the request against what was deliberately left
out, not only against what was included. "Why is this scope here" is an easy
question. "What is missing that should be" is the one that catches an over-broad
grant, and it needs a list to answer.

| Forbidden scope | Why |
|---|---|
| `Mail.Send` | Sending is denied by design. There is no code path that sends. |
| `gmail.send` | As above. |
| `https://mail.google.com/` | Full mailbox control including permanent deletion. Never necessary to read a conversation. |
| `Mail.ReadWrite.All` | Every mailbox in the tenant, not the signed-in person's. A tenant-wide grant for a per-person product. |
| `Mail.Read.All` | The same reach, read-only. Still every mailbox in the organisation. |
| `gmail.settings.basic` | Filters, forwarding and vacation responders. All three are denied capabilities. |
| `gmail.settings.sharing` | Delegation and send-as. Would let the product act as another person. |
| `Directory.Read.All` | The organisation's whole directory, and the scope most often acquired by accident. |
| `.../auth/drive` | File storage. Attachment processing, where enabled, works in memory. |
| `Files.ReadWrite.All` | The same reach on the Microsoft side, with write access as well. |
| `Calendars.ReadWrite` | Creating an event from a date read out of an email is a denied capability. |
| `.../auth/calendar` | As above, on the Google side. |
| `Contacts.Read` | Not needed. Participants come from the messages themselves. |

## 5. Capabilities, which are separate from scopes

A scope is what the provider grants. A capability is what this module will do.
Twenty-five capabilities are declared in
`src/lib/email/providers/capabilities.ts`: five allowed, three opt-in and
seventeen denied.

**Allowed, at connection:** `read_messages`, `read_threads`, `read_labels`,
`read_profile`, `read_attachment_metadata`.

**Opt-in, off until the person turns them on:** `process_attachment_contents`,
`write_draft_to_mailbox`, `combined_account_view`.

**Denied, and ungrantable:** `send_message`, `reply`, `forward`,
`delete_message`, `trash_message`, `archive_message`, `modify_labels`,
`mark_read`, `mark_spam`, `unsubscribe`, `create_filter`, `set_vacation`,
`create_external_task`, `create_calendar_event`,
`download_attachment_to_disk`, `execute_attachment`, `read_other_account`.

A denied capability is not a setting at its default. `grant()` throws when asked
to enable one, and the capability has no implementation behind it to enable.
`assertCapability()` throws rather than returning false, so a stage that forgets
to check still fails closed.

## 6. What a person sees, and can revoke

Connection names each scope in plain words, with its justification, before the
provider's consent screen rather than after it. Disconnection removes the stored
token handle and stops all synchronisation. Revoking at the provider has the
same effect: the next run returns `credential_revoked`, which stops immediately
and does not retry, because retrying a revoked credential is how an account gets
locked.
