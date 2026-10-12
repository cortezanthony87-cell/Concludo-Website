# Email Command Centre: navigation map

Concludo Workspace. Final, Stage 7.

---

## 1. Where it lives in the application

```
Concludo Workspace
└── Sidebar
    └── Email Command Centre          ->  /email        (ONE sidebar entry)
```

One sidebar entry, settled in Stage 1. The sidebar already carries forty links;
eleven more would make fifty-one. The module's own destinations are tabs inside
it, which is how `/workflows` and `/agents` already behave.

## 2. The eleven tabs

| # | Tab | Route | What it answers |
|---|---|---|---|
| 1 | Overview | `/email` | What should I do first? |
| 2 | Needs Attention | `/email/needs-attention` | What has the highest consequence? |
| 3 | Reply Queue | `/email/reply-queue` | Who is waiting on me? |
| 4 | Actions & Deadlines | `/email/actions-deadlines` | What has a date on it? |
| 5 | Waiting | `/email/waiting` | What am I waiting on from someone else? |
| 6 | Quick Wins | `/email/quick-wins` | What can I close in two minutes? |
| 7 | Clear Backlog | `/email/clear-backlog` | Work through a chosen set, one at a time |
| 8 | All Email | `/email/all` | Everything, sortable and paginated |
| 9 | Outputs | `/email/outputs` | Turn this conversation into finished work |
| 10 | Security Review | `/email/security-review` | What looks unsafe? |
| 11 | Email Settings | `/email/settings` | Accounts, permissions, what is switched off |

The tab row is a `nav` with links and `aria-current` on the active one, not an
ARIA tablist. Each one changes the URL, so a tablist would promise arrow-key
behaviour a router cannot sensibly provide and would tell a screen reader the
wrong thing about what pressing it does. The eight in-page panes on a thread
*are* a tablist, with roving tabindex and arrow keys, because they do not change
the URL.

Stage 1 settled on ten tabs. Stage 7 added the eleventh, Clear Backlog, so a
paused backlog session can be reopened from a URL, a bookmark or a second
device rather than only from inside a mode on the Overview page.

Stage 8 **replaced** Drafts with Outputs rather than adding a twelfth tab. A
reply draft is an output, and two tabs for one idea is how an interface grows
to fourteen tabs nobody can hold in their head. Outputs carries both: finished
documents built from a thread, and the prepared replies, switched with an
in-page tablist at `?mode=documents` or `?mode=drafts`. Eleven tabs, and the
limitation this document recorded about resisting a twelfth is honoured.

## 3. Routes that are not tabs

| Route | What it is |
|---|---|
| `/email/thread/:threadId` | The thread workspace: three columns, eight analysis panes |
| `/email/thread/:threadId?tab=<pane>` | A deep link to one pane |

A tab row that grew a "currently open thread" entry would change shape as a
person works, and the eleven tabs are a fixed map of the module.

## 4. How the tabs and the routes stay in step

`EMAIL_ROUTES` in `src/pages/email/emailRouteTable.ts` is **derived** from
`EMAIL_MODULE_DESTINATIONS` through `Record<EmailModulePath, ComponentType>`.
Adding a tab without a route, or a route without a tab, is a compile error.

This exists because of a Stage 2 defect: the destination list and the route
patch were two hand-maintained lists of the same ten paths, three of them
disagreed, and three tabs would have fallen through to the login page. The
tests did not catch it because they compared the tab list with itself.

## 5. State carried in the URL

Everything the person has chosen is in the query string, so a reload, a back
navigation and a shared link all show the same thing:

| Parameter | Meaning |
|---|---|
| `account` | Which connected account |
| `range` | Date range preset |
| `folder` | Folder or label |
| `q` | Search text |
| `view` | Saved view key |
| `filters` | Active filter keys |
| `sort`, `dir` | All Email sorting |
| `page` | All Email page index |
| `tab` | Which analysis pane on a thread |
| `mode` | Which half of Outputs: `documents` or `drafts` |
| `demo` | Forces `loading`, `empty` or `error`, for review and testing |

The backlog session is the exception: the selection and the decisions live in
this browser's local storage under `concludo.ecc.backlog.session.v1`, because a
URL cannot carry a hundred decisions. The route is still bookmarkable, and
opening it offers the paused session rather than resuming it silently.

## 6. Metrics and where they lead

Every number on the Overview page is a link. The eight metrics and their
destinations:

| Metric | Goes to |
|---|---|
| Needs attention | `/email/needs-attention` |
| Replies due | `/email/reply-queue` |
| Actions required | `/email/actions-deadlines` |
| Deadlines | `/email/actions-deadlines` |
| Waiting on others | `/email/waiting` |
| Quick wins | `/email/quick-wins` |
| Security review | `/email/security-review` |
| Unprocessed | `/email/all` |

## 6a. The Overview, rebuilt in Stage 8

The dashboard is no longer eight equal metric cards above seven equal panels.
It is a decision surface, read top to bottom:

1. **The security band**, when anything is flagged. Separate from everything
   else and before it, so nothing routine sits beside it.
2. **One lead thread.** The highest-consequence thread that is not flagged,
   alone, with why it matters, the recommended next step, the confidence in
   that step, and three ways forward.
3. **The rail.** The same eight counts, as one quiet row. Each is still the way
   into its view; none of them competes with the lead.
4. **Up to four short sections**, each capped at four rows.
5. **A line per empty section**, rather than an empty panel the height of a
   full one.

**Every thread appears exactly once.** A thread is claimed by the
highest-consequence section it qualifies for and is not repeated below. Each
section reports its own true total and says how many it did not draw, so
nothing is hidden by being deduplicated.

The old page showed one invoice-redirection attempt four times across four
panels and ran to 4,265 pixels. The rebuilt one runs to 2,256.

The seven dashboard panels each carry a "View all in …" link to the same
destinations. A panel shows at most ten rows and says how many matched, which
is the Stage 7 fix for a dashboard that would otherwise have rendered several
thousand rows on a real mailbox.

## 7. Entitlement

| Tier | Access |
|---|---|
| Starter | The full module, capped at **3 threads analysed per week**, resetting Monday 5:30am Melbourne time |
| Pro | Unlimited |
| Team | Unlimited, per seat |

Prices are indicative until validated with real buyers. The Email Command
Centre is an add-on inside the Concludo Workspace application; there is no
separate tier for it.

## 8. Keyboard route

```
Skip link  ->  "Skip to the dashboard"
Header     ->  account, date range, folder, search, saved view, filter, refresh, personalise
Tab row    ->  the eleven tabs, in order, by Tab alone
Main       ->  the view's own controls, then its rows
```

Every control carries an accessible name, every focused control shows a focus
ring immediately, and nothing visible is removed from the tab order. Verified
across all eleven views at three widths in
`app/tests/browser/emailCommandCentre.accessibility.test.mjs`.
