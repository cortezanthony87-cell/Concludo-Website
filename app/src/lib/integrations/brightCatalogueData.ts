// Bright Connectivity Catalogue Data (76 enterprise apps & 16 categories)
export interface BrightApp {
  id: string;
  n: string;
  c: string;
  g: string;
  d: string;
  auth: string;
  svg: string | null;
  s: "ok" | "multi" | "reauth" | "perm" | "idle" | "soon";
}

export const BRIGHT_CATS: string[] = [
  "All apps",
  "Connected",
  "Social Media",
  "Productivity",
  "Communication",
  "CRM & Sales",
  "Accounting & Finance",
  "Project Management",
  "File Storage",
  "Forms & Data Collection",
  "E-commerce",
  "Marketing",
  "Customer Support",
  "HR & People",
  "Developer / API",
  "AI"
];

export const BRIGHT_APPS: BrightApp[] = [
  {
    "id": "microsoft_365",
    "n": "Microsoft 365",
    "c": "Productivity",
    "g": "Microsoft 365",
    "d": "Unified Microsoft 365 organisation directory, user profile, and enterprise cloud capabilities.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"9.5\" height=\"9.5\" fill=\"#f25022\" rx=\"0.5\" />\n            <rect x=\"12.5\" y=\"2\" width=\"9.5\" height=\"9.5\" fill=\"#7fba00\" rx=\"0.5\" />\n            <rect x=\"2\" y=\"12.5\" width=\"9.5\" height=\"9.5\" fill=\"#00a4ef\" rx=\"0.5\" />\n            <rect x=\"12.5\" y=\"12.5\" width=\"9.5\" height=\"9.5\" fill=\"#ffb900\" rx=\"0.5\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "microsoft_outlook",
    "n": "Microsoft Outlook",
    "c": "Communication",
    "g": "Microsoft 365",
    "d": "Send and receive executive emails, meeting invites, and attachments with Microsoft 365 Outlook.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M14 6H21C21.55 6 22 6.45 22 7V17C22 17.55 21.55 18 21 18H14V6Z\" fill=\"#0078D4\" />\n            <path d=\"M14 6L21.5 11.5L14 17V6Z\" fill=\"#106EBE\" opacity=\"0.6\" />\n            <rect x=\"2\" y=\"5\" width=\"12\" height=\"14\" rx=\"2\" fill=\"#0078D4\" />\n            <circle cx=\"8\" cy=\"12\" r=\"3.2\" stroke=\"#FFFFFF\" stroke-width=\"2.2\" fill=\"none\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "microsoft_teams",
    "n": "Microsoft Teams",
    "c": "Communication",
    "g": "Microsoft 365",
    "d": "Post structured meeting summaries, action cards, and announcements into Microsoft Teams channels.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"4\" width=\"13\" height=\"16\" rx=\"2\" fill=\"#5059C9\" />\n            <circle cx=\"18\" cy=\"8\" r=\"2.5\" fill=\"#7B83EB\" />\n            <rect x=\"15\" y=\"11\" width=\"6\" height=\"8\" rx=\"1.5\" fill=\"#7B83EB\" />\n            <path d=\"M6.5 9H12.5V11H10.5V16H8.5V11H6.5V9Z\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "microsoft_excel",
    "n": "Microsoft Excel",
    "c": "Productivity",
    "g": "Microsoft 365",
    "d": "Read and append rows into Excel Online spreadsheets stored in OneDrive or SharePoint.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"10\" y=\"5\" width=\"12\" height=\"14\" rx=\"1\" fill=\"#107C41\" />\n            <path d=\"M12 9H20M12 12H20M12 15H20M16 5V19\" stroke=\"#FFFFFF\" stroke-width=\"1\" opacity=\"0.6\" />\n            <rect x=\"2\" y=\"4\" width=\"11\" height=\"16\" rx=\"1.5\" fill=\"#185C37\" />\n            <path d=\"M5 8.5L9.5 15.5M9.5 8.5L5 15.5\" stroke=\"#FFFFFF\" stroke-width=\"2\" stroke-linecap=\"round\" />\n          </svg>",
    "s": "ok"
  },
  {
    "id": "microsoft_forms",
    "n": "Microsoft Forms",
    "c": "Forms & Data Collection",
    "g": "Microsoft 365",
    "d": "Capture responses and surveys submitted via Microsoft Forms to trigger automated workflows.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\" fill=\"#008272\" />\n            <path d=\"M6 8H18M6 12H18M6 16H13\" stroke=\"#FFFFFF\" stroke-width=\"2\" stroke-linecap=\"round\" />\n            <path d=\"M15 15.5L16.5 17L19.5 14\" stroke=\"#81E6D9\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "microsoft_todo",
    "n": "Microsoft To Do",
    "c": "Productivity",
    "g": "Microsoft 365",
    "d": "Create and synchronize personal tasks and follow-up checklists in Microsoft To Do.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\" fill=\"#2564CF\" />\n            <path d=\"M7 12.5L10.5 16L17 8.5\" stroke=\"#FFFFFF\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />\n          </svg>",
    "s": "ok"
  },
  {
    "id": "microsoft_planner",
    "n": "Microsoft Planner",
    "c": "Project Management",
    "g": "Microsoft 365",
    "d": "Create and assign accountability tasks in Microsoft 365 Planner buckets.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\" fill=\"#31752F\" />\n            <path d=\"M6 8H18M6 12H14M6 16H11\" stroke=\"#FFFFFF\" stroke-width=\"2\" stroke-linecap=\"round\" />\n            <circle cx=\"16.5\" cy=\"14.5\" r=\"2.5\" fill=\"#81C784\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "dynamics_365",
    "n": "Microsoft Dynamics 365",
    "c": "CRM & Sales",
    "g": "CRM & Sales",
    "d": "Enterprise CRM for managing customer relationships, leads, and sales pipelines.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M4 5L12 3V12L4 15V5Z\" fill=\"#002050\" />\n            <path d=\"M12 3L20 8V18L12 21V12L20 8\" fill=\"#005FB8\" />\n            <path d=\"M4 15L12 12V21L4 18V15Z\" fill=\"#0078D4\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "power_bi",
    "n": "Power BI",
    "c": "Productivity",
    "g": "Microsoft 365",
    "d": "Refresh business intelligence datasets and push real-time telemetry to Power BI.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"13\" width=\"4\" height=\"7\" rx=\"0.5\" fill=\"#F2C811\" />\n            <rect x=\"8\" y=\"9\" width=\"4\" height=\"11\" rx=\"0.5\" fill=\"#E8B20B\" />\n            <rect x=\"13\" y=\"6\" width=\"4\" height=\"14\" rx=\"0.5\" fill=\"#D39B06\" />\n            <rect x=\"18\" y=\"3\" width=\"4\" height=\"17\" rx=\"0.5\" fill=\"#B98200\" />\n          </svg>",
    "s": "soon"
  },
  {
    "id": "microsoft_entra_id",
    "n": "Microsoft Entra ID",
    "c": "HR & People",
    "g": "Microsoft 365",
    "d": "Identity and access management for corporate directories and role verification.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"9.5\" height=\"9.5\" fill=\"#f25022\" rx=\"0.5\" />\n            <rect x=\"12.5\" y=\"2\" width=\"9.5\" height=\"9.5\" fill=\"#7fba00\" rx=\"0.5\" />\n            <rect x=\"2\" y=\"12.5\" width=\"9.5\" height=\"9.5\" fill=\"#00a4ef\" rx=\"0.5\" />\n            <rect x=\"12.5\" y=\"12.5\" width=\"9.5\" height=\"9.5\" fill=\"#ffb900\" rx=\"0.5\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "google_workspace",
    "n": "Google Workspace",
    "c": "Productivity",
    "g": "Google Workspace",
    "d": "Google enterprise suite covering user directory, documents, and admin management.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M21.35 11.1H12V14.8H17.4C16.85 17.5 14.5 19.3 12 19.3C8.7 19.3 6 16.6 6 13.3C6 10 8.7 7.3 12 7.3C13.5 7.3 14.85 7.85 15.9 8.75L18.7 5.95C16.9 4.3 14.6 3.3 12 3.3C6.5 3.3 2 7.8 2 13.3C2 18.8 6.5 23.3 12 23.3C17.5 23.3 21.6 19.4 21.6 13.5C21.6 12.65 21.5 11.85 21.35 11.1Z\" fill=\"#4285F4\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "gmail",
    "n": "Gmail",
    "c": "Communication",
    "g": "Google Workspace",
    "d": "Send emails, draft recaps, and trigger workflows on incoming Gmail messages.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M4 6C2.9 6 2 6.9 2 8V18C2 19.1 2.9 20 4 20H5V9.8L12 14.5L19 9.8V20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H19L12 11.2L5 6H4Z\" fill=\"#EA4335\" />\n            <path d=\"M19 6L12 11.2L5 6\" stroke=\"#C5221F\" stroke-width=\"1\" />\n          </svg>",
    "s": "multi"
  },
  {
    "id": "google_calendar",
    "n": "Google Calendar",
    "c": "Productivity",
    "g": "Google Workspace",
    "d": "Schedule, update, and manage Google Calendar events and client meetings.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"4\" width=\"18\" height=\"17\" rx=\"2\" fill=\"#4285F4\" />\n            <path d=\"M3 8H21\" stroke=\"#FFFFFF\" stroke-width=\"1.5\" />\n            <rect x=\"7\" y=\"2\" width=\"2\" height=\"4\" rx=\"1\" fill=\"#1A73E8\" />\n            <rect x=\"15\" y=\"2\" width=\"2\" height=\"4\" rx=\"1\" fill=\"#1A73E8\" />\n            <text x=\"12\" y=\"16.5\" fill=\"#FFFFFF\" fontSize=\"8\" fontWeight=\"bold\" textAnchor=\"middle\" fontFamily=\"sans-serif\">31</text>\n          </svg>",
    "s": "reauth"
  },
  {
    "id": "google_drive",
    "n": "Google Drive",
    "c": "File Storage",
    "g": "Google Workspace",
    "d": "Store, organize, and find documents, spreadsheets, and PDFs in Google Drive.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M8.2 3.8L2.5 13.7L5.5 18.9L11.2 9L8.2 3.8Z\" fill=\"#0066DA\" />\n            <path d=\"M15.8 3.8H8.2L11.2 9H21.5L18.5 3.8H15.8Z\" fill=\"#00AC47\" />\n            <path d=\"M11.2 9L5.5 18.9H17.8L23.5 9H11.2Z\" fill=\"#EA4335\" />\n            <path d=\"M23.5 9L17.8 18.9H5.5L8.5 13.7L18.5 13.7L23.5 9Z\" fill=\"#FFBA00\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "google_sheets",
    "n": "Google Sheets",
    "c": "Productivity",
    "g": "Google Workspace",
    "d": "Append rows, update cells, and query Google Sheets spreadsheets.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" fill=\"#0F9D58\" />\n            <rect x=\"7\" y=\"7\" width=\"10\" height=\"10\" rx=\"1\" fill=\"#FFFFFF\" />\n            <path d=\"M7 10.3H17M7 13.6H17M12 7V17\" stroke=\"#0F9D58\" stroke-width=\"1\" />\n          </svg>",
    "s": "ok"
  },
  {
    "id": "google_docs",
    "n": "Google Docs",
    "c": "Productivity",
    "g": "Google Workspace",
    "d": "Generate, append to, and manage Google Docs from structured meeting notes.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M5 3C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V9L15 3H5Z\" fill=\"#4285F4\" />\n            <path d=\"M15 3V9H21\" fill=\"#A1C2FA\" />\n            <path d=\"M7 13H17M7 16H14\" stroke=\"#FFFFFF\" stroke-width=\"1.5\" stroke-linecap=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "google_forms",
    "n": "Google Forms",
    "c": "Forms & Data Collection",
    "g": "Google Workspace",
    "d": "Trigger automated actions from incoming Google Forms survey responses.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"4\" y=\"3\" width=\"16\" height=\"18\" rx=\"2\" fill=\"#7248B9\" />\n            <path d=\"M8 8H16M8 12H16M8 16H13\" stroke=\"#FFFFFF\" stroke-width=\"1.5\" stroke-linecap=\"round\" />\n            <circle cx=\"6.5\" cy=\"8\" r=\"0.8\" fill=\"#FFFFFF\" />\n            <circle cx=\"6.5\" cy=\"12\" r=\"0.8\" fill=\"#FFFFFF\" />\n            <circle cx=\"6.5\" cy=\"16\" r=\"0.8\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "google_contacts",
    "n": "Google Contacts",
    "c": "CRM & Sales",
    "g": "Google Workspace",
    "d": "Keep contact phone numbers, emails, and corporate addresses synchronized.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\" fill=\"#4285F4\" />\n            <circle cx=\"12\" cy=\"10\" r=\"3\" fill=\"#FFFFFF\" />\n            <path d=\"M6 18C6 15 9 14 12 14C15 14 18 15 18 18\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "google_ads",
    "n": "Google Ads",
    "c": "Marketing",
    "g": "Google Workspace",
    "d": "Automate ad group management, pause campaigns, track conversions, and apply approved keyword adjustments.",
    "auth": "Google sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path\n              d=\"M4.2 14.8L9.8 5.1C10.6 3.7 12.4 3.2 13.8 4L15.5 5C16.9 5.8 17.4 7.6 16.6 9L11 18.7C10.2 20.1 8.4 20.6 7 19.8L5.3 18.8C3.9 18 3.4 16.2 4.2 14.8Z\"\n              fill=\"#FBBC04\"\n            />\n            <path\n              d=\"M19.8 14.8C20.6 16.2 20.1 18 18.7 18.8C17.3 19.6 15.5 19.1 14.7 17.7L9.1 8C8.3 6.6 8.8 4.8 10.2 4C11.6 3.2 13.4 3.7 14.2 5.1L19.8 14.8Z\"\n              fill=\"#4285F4\"\n            />\n            <circle cx=\"5.8\" cy=\"17\" r=\"3\" fill=\"#34A853\" />\n          </svg>",
    "s": "soon"
  },
  {
    "id": "xero",
    "n": "Xero",
    "c": "Accounting & Finance",
    "g": "Accounting & Finance",
    "d": "Leading Australian cloud accounting: create contacts, send sales invoices, and reconcile records.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#13B5EA\" />\n            <path d=\"M7 8L11 12L7 16M17 8L13 12L17 16\" stroke=\"#FFFFFF\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "myob",
    "n": "MYOB",
    "c": "Accounting & Finance",
    "g": "Accounting & Finance",
    "d": "Australian and New Zealand business management and accounting platform.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#6100A5\" />\n            <path d=\"M6 14.5C6 11 8.5 8 12 8C15.5 8 18 10.5 18 13.5C18 16.5 15.5 17.5 12 17.5\" stroke=\"#FFFFFF\" stroke-width=\"2\" stroke-linecap=\"round\" />\n            <circle cx=\"12\" cy=\"12.5\" r=\"2.5\" fill=\"#E8005A\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "quickbooks",
    "n": "QuickBooks Online",
    "c": "Accounting & Finance",
    "g": "Accounting & Finance",
    "d": "Small business accounting, invoicing, cashflow tracking, and bill management.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#2CA01C\" />\n            <path d=\"M8 8V16C8 16 9.5 16 10 15C10.5 14 10.5 10 10.5 10M16 16V8C16 8 14.5 8 14 9C13.5 10 13.5 14 13.5 14\" stroke=\"#FFFFFF\" stroke-width=\"2.2\" stroke-linecap=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "stripe",
    "n": "Stripe",
    "c": "Accounting & Finance",
    "g": "Accounting & Finance",
    "d": "Online payment infrastructure: charges, subscriptions, customer balances, and webhooks.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"3\" fill=\"#635BFF\" />\n            <path d=\"M12.5 9.5C11.5 9.2 10.8 8.8 10.8 8.1C10.8 7.3 11.6 6.8 12.7 6.8C13.8 6.8 14.7 7.2 15.1 7.6L15.8 5.7C14.9 5.3 13.8 5.1 12.7 5.1C10.1 5.1 8.3 6.4 8.3 8.5C8.3 11.2 12.1 10.8 12.1 12.4C12.1 13.4 11.1 13.8 9.9 13.8C8.6 13.8 7.4 13.2 6.8 12.7L6 14.7C6.9 15.3 8.3 15.7 9.8 15.7C12.6 15.7 14.6 14.4 14.6 12.2C14.6 9.3 12.5 9.5 12.5 9.5Z\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "paypal",
    "n": "PayPal",
    "c": "Accounting & Finance",
    "g": "Accounting & Finance",
    "d": "Global digital payment processing and merchant invoicing.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"4\" fill=\"#003087\" />\n            <path d=\"M7 6H13C15 6 16.5 7.2 16.2 9.2C15.8 11.5 14.2 12.8 12 12.8H9.5L8.5 19H6.5L7 6Z\" fill=\"#0079C1\" />\n            <path d=\"M9 9H14C15.8 9 17 10 16.7 11.8C16.4 13.8 15 15 13 15H10.8L10 20H8L9 9Z\" fill=\"#00457C\" opacity=\"0.6\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "slack",
    "n": "Slack",
    "c": "Communication",
    "g": "Communication",
    "d": "Send direct messages, post channel notifications, and respond to mentions in Slack workspaces.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#4A154B\" />\n            <circle cx=\"7\" cy=\"10\" r=\"1.5\" fill=\"#E01E5A\" />\n            <rect x=\"9.5\" y=\"6\" width=\"3\" height=\"6\" rx=\"1.5\" fill=\"#36C5F0\" />\n            <circle cx=\"17\" cy=\"14\" r=\"1.5\" fill=\"#2EB67D\" />\n            <rect x=\"11.5\" y=\"12\" width=\"3\" height=\"6\" rx=\"1.5\" fill=\"#ECB22E\" />\n          </svg>",
    "s": "perm"
  },
  {
    "id": "zoom",
    "n": "Zoom",
    "c": "Communication",
    "g": "Communication",
    "d": "Schedule video conferences, manage webinars, and trigger workflows on meeting recordings.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"4\" fill=\"#2D8CFF\" />\n            <rect x=\"6\" y=\"8\" width=\"8\" height=\"8\" rx=\"1.5\" fill=\"#FFFFFF\" />\n            <path d=\"M14 10.5L18 8V16L14 13.5V10.5Z\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "discord",
    "n": "Discord",
    "c": "Communication",
    "g": "Communication",
    "d": "Post community announcements and alerts to Discord servers and channels.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#5865F2\" />\n            <path d=\"M17.5 7C16.3 6.4 15 6 15 6L14.7 6.6C16.2 7 16.9 7.7 16.9 7.7C15.5 7 14.1 6.6 12 6.6C9.9 6.6 8.5 7 7.1 7.7C7.1 7.7 7.8 7 9.3 6.6L9 6C9 6 7.7 6.4 6.5 7C5 9.3 4.6 11.5 4.8 13.7C6.3 14.8 7.8 14.8 7.8 14.8L8.4 14C7.4 13.7 6.9 13.1 6.9 13.1C6.9 13.1 7 13.2 7.2 13.3C8.6 14.1 10.2 14.4 12 14.4C13.8 14.4 15.4 14.1 16.8 13.3C17 13.2 17.1 13.1 17.1 13.1C17.1 13.1 16.6 13.7 15.6 14L16.2 14.8C16.2 14.8 17.7 14.8 19.2 13.7C19.5 11.2 18.8 9.1 17.5 7ZM9.5 12C8.7 12 8 11.3 8 10.5C8 9.7 8.7 9 9.5 9C10.3 9 11 9.7 11 10.5C11 11.3 10.3 12 9.5 12ZM14.5 12C13.7 12 13 11.3 13 10.5C13 9.7 13.7 9 14.5 9C15.3 9 16 9.7 16 10.5C16 11.3 15.3 12 14.5 12Z\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "twilio",
    "n": "Twilio",
    "c": "Communication",
    "g": "Communication",
    "d": "Programmable SMS notifications, alerts, and verification messages.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#F22F46\" />\n            <circle cx=\"9\" cy=\"9\" r=\"2\" fill=\"#FFFFFF\" />\n            <circle cx=\"15\" cy=\"9\" r=\"2\" fill=\"#FFFFFF\" />\n            <circle cx=\"9\" cy=\"15\" r=\"2\" fill=\"#FFFFFF\" />\n            <circle cx=\"15\" cy=\"15\" r=\"2\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "hubspot",
    "n": "HubSpot",
    "c": "CRM & Sales",
    "g": "CRM & Sales",
    "d": "Inbound marketing, sales deals, contacts, company records, and customer ticketing.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#FF7A59\" />\n            <circle cx=\"15.5\" cy=\"7.5\" r=\"1.8\" fill=\"#FFFFFF\" />\n            <circle cx=\"8\" cy=\"12\" r=\"2\" fill=\"#FFFFFF\" />\n            <path d=\"M12 12V6M12 12H8M12 12V18\" stroke=\"#FFFFFF\" stroke-width=\"2\" stroke-linecap=\"round\" />\n            <circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"#2E3F50\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "salesforce",
    "n": "Salesforce",
    "c": "CRM & Sales",
    "g": "CRM & Sales",
    "d": "Enterprise CRM for managing accounts, contacts, opportunities, and enterprise pipelines.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M10 6C11.2 4.8 12.9 4 14.8 4C17.9 4 20.5 6.2 21 9.2C22.2 9.8 23 11.1 23 12.5C23 14.4 21.4 16 19.5 16H6C3.8 16 2 14.2 2 12C2 10.1 3.4 8.5 5.2 8.1C5.7 6.3 7.4 5 9.4 5C9.6 5 9.8 5 10 5.1V6Z\" fill=\"#00A1E0\" />\n          </svg>",
    "s": "soon"
  },
  {
    "id": "pipedrive",
    "n": "Pipedrive",
    "c": "CRM & Sales",
    "g": "CRM & Sales",
    "d": "Pipeline-first sales CRM for closing deals and managing client communication.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#26292C\" />\n            <circle cx=\"12\" cy=\"10\" r=\"3.5\" fill=\"#28A745\" />\n            <rect x=\"8.5\" y=\"10\" width=\"3.5\" height=\"8\" rx=\"1.5\" fill=\"#28A745\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "zoho_crm",
    "n": "Zoho CRM",
    "c": "CRM & Sales",
    "g": "CRM & Sales",
    "d": "Global cloud CRM for lead management, customer touchpoints, and analytics.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"4\" width=\"9\" height=\"7\" rx=\"1\" fill=\"#E42528\" />\n            <rect x=\"13\" y=\"4\" width=\"9\" height=\"7\" rx=\"1\" fill=\"#226AB4\" />\n            <rect x=\"2\" y=\"13\" width=\"9\" height=\"7\" rx=\"1\" fill=\"#0CB863\" />\n            <rect x=\"13\" y=\"13\" width=\"9\" height=\"7\" rx=\"1\" fill=\"#F8B122\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "monday",
    "n": "Monday.com",
    "c": "Project Management",
    "g": "Project Management",
    "d": "Visual work operating system for managing workflows, projects, and daily tasks.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"3\" width=\"20\" height=\"18\" rx=\"4\" fill=\"#181B34\" />\n            <circle cx=\"6.5\" cy=\"14\" r=\"2.2\" fill=\"#E2445C\" />\n            <rect x=\"10\" y=\"8\" width=\"4\" height=\"8\" rx=\"2\" fill=\"#FFCC00\" />\n            <rect x=\"15.5\" y=\"5\" width=\"4\" height=\"11\" rx=\"2\" fill=\"#00C875\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "asana",
    "n": "Asana",
    "c": "Project Management",
    "g": "Project Management",
    "d": "Team work management platform: assign accountability tasks, set milestones, and track deadlines.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#F06A6A\" />\n            <circle cx=\"12\" cy=\"8\" r=\"2.5\" fill=\"#FFFFFF\" />\n            <circle cx=\"7.5\" cy=\"15\" r=\"2.5\" fill=\"#FFFFFF\" />\n            <circle cx=\"16.5\" cy=\"15\" r=\"2.5\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "trello",
    "n": "Trello",
    "c": "Project Management",
    "g": "Project Management",
    "d": "Kanban boards, lists, and cards for agile workflows and visual progress tracking.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\" fill=\"#0079BF\" />\n            <rect x=\"6\" y=\"6\" width=\"4.5\" height=\"9\" rx=\"1\" fill=\"#FFFFFF\" />\n            <rect x=\"13.5\" y=\"6\" width=\"4.5\" height=\"6\" rx=\"1\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "clickup",
    "n": "ClickUp",
    "c": "Project Management",
    "g": "Project Management",
    "d": "All-in-one productivity platform for tasks, docs, chat, and sprint planning.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#7B68EE\" />\n            <path d=\"M6 14.5L12 9.5L18 14.5\" stroke=\"#FFFFFF\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />\n            <path d=\"M9 16.5L12 14L15 16.5\" stroke=\"#FF007F\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "jira",
    "n": "Jira",
    "c": "Project Management",
    "g": "Project Management",
    "d": "Software issue and project tracking tool for agile engineering and operational sprints.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\" fill=\"#0052CC\" />\n            <path d=\"M12 6L16 10L12 14L8 10L12 6Z\" fill=\"#FFFFFF\" />\n            <path d=\"M12 11L16 15L12 19L8 15L12 11Z\" fill=\"#2684FF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "notion",
    "n": "Notion",
    "c": "Project Management",
    "g": "Project Management",
    "d": "Connected workspace for wiki documentation, project notes, and database records.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\" fill=\"#000000\" />\n            <path d=\"M7 6H10.5L14.5 13.5V6H17V18H13.5L9.5 10.5V18H7V6Z\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "ok"
  },
  {
    "id": "airtable",
    "n": "Airtable",
    "c": "Project Management",
    "g": "Project Management",
    "d": "Relational database and spreadsheet hybrid for custom operational databases.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"3\" width=\"20\" height=\"18\" rx=\"3\" fill=\"#18BFFF\" />\n            <path d=\"M12 5L4 9L12 13L20 9L12 5Z\" fill=\"#FCB400\" />\n            <path d=\"M11 14.5L4 11V17L11 20.5V14.5Z\" fill=\"#2D7FF9\" />\n            <path d=\"M13 14.5L20 11V17L13 20.5V14.5Z\" fill=\"#18BFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "smartsheet",
    "n": "Smartsheet",
    "c": "Project Management",
    "g": "Project Management",
    "d": "Enterprise platform for work management and process automation.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#002D72\" />\n            <path d=\"M7 9L11 6V18L7 15V9Z\" fill=\"#00A3E0\" />\n            <path d=\"M13 6L17 9V15L13 18V6Z\" fill=\"#2D68C4\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "dropbox",
    "n": "Dropbox",
    "c": "File Storage",
    "g": "File Storage",
    "d": "Cloud file storage, backup, and document collaboration.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#0061FF\" />\n            <path d=\"M7 6.5L12 9.8L7 13.2L2 9.8L7 6.5Z\" fill=\"#FFFFFF\" />\n            <path d=\"M17 6.5L22 9.8L17 13.2L12 9.8L17 6.5Z\" fill=\"#FFFFFF\" />\n            <path d=\"M7 13.2L12 16.5L17 13.2L12 9.8L7 13.2Z\" fill=\"#FFFFFF\" opacity=\"0.8\" />\n            <path d=\"M7 17.5L12 14.2L17 17.5L12 20.8L7 17.5Z\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "box",
    "n": "Box",
    "c": "File Storage",
    "g": "File Storage",
    "d": "Secure enterprise content management and file sharing.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"3\" width=\"20\" height=\"18\" rx=\"3\" fill=\"#0061D5\" />\n            <circle cx=\"9\" cy=\"12\" r=\"3.5\" fill=\"#FFFFFF\" />\n            <circle cx=\"15\" cy=\"12\" r=\"3.5\" fill=\"#FFFFFF\" />\n            <rect x=\"9\" y=\"8.5\" width=\"6\" height=\"7\" fill=\"#FFFFFF\" />\n            <circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"#0061D5\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "linkedin",
    "n": "LinkedIn",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Publish company updates, schedule personal posts, track organic reach, and automate marketing communications.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#0A66C2\" />\n            <path\n              d=\"M7.05 9.8H4.6V18.2H7.05V9.8ZM5.82 5.8C5.03 5.8 4.4 6.44 4.4 7.22C4.4 8 5.03 8.64 5.82 8.64C6.61 8.64 7.24 8 7.24 7.22C7.24 6.44 6.61 5.8 5.82 5.8ZM19.4 13.8V18.2H16.95V14.16C16.95 13.1 16.57 12.38 15.62 12.38C14.89 12.38 14.45 12.87 14.26 13.34C14.19 13.51 14.17 13.76 14.17 14V18.2H11.72C11.72 18.2 11.75 10.74 11.72 9.8H14.17V10.99C14.49 10.5 15.05 9.8 16.32 9.8C17.92 9.8 19.4 10.84 19.4 13.8Z\"\n              fill=\"#FFFFFF\"\n            />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "youtube",
    "n": "YouTube",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Publish videos, manage channel updates, and monitor analytics and audience engagement.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path\n              d=\"M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z\"\n              fill=\"#FF0000\"\n            />\n            <path d=\"M9.545 15.568V8.432L15.818 12l-6.273 3.568z\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "facebook",
    "n": "Facebook",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Publish posts, schedule updates, and monitor comments and page insights across Facebook Pages.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"11\" fill=\"#1877F2\" />\n            <path\n              d=\"M13.5 8H15V5.5H13C10.79 5.5 9.5 6.79 9.5 9.2V11H7V13.5H9.5V19.5H12.5V13.5H14.8L15.2 11H12.5V9.5C12.5 8.7 12.8 8 13.5 8Z\"\n              fill=\"#FFFFFF\"\n            />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "instagram",
    "n": "Instagram",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Publish photos, reels, and stories, and track engagement and direct interactions on Instagram.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <defs>\n              <linearGradient id=\"ig-grad\" x1=\"0%\" y1=\"100%\" x2=\"100%\" y2=\"0%\">\n                <stop offset=\"0%\" stop-color=\"#FD5949\" />\n                <stop offset=\"25%\" stop-color=\"#D6249F\" />\n                <stop offset=\"60%\" stop-color=\"#833AB4\" />\n                <stop offset=\"100%\" stop-color=\"#285AEB\" />\n              </linearGradient>\n            </defs>\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"5.5\" fill=\"url(#ig-grad)\" />\n            <rect x=\"5.5\" y=\"5.5\" width=\"13\" height=\"13\" rx=\"3.5\" stroke=\"#FFFFFF\" stroke-width=\"1.8\" fill=\"none\" />\n            <circle cx=\"12\" cy=\"12\" r=\"3.2\" stroke=\"#FFFFFF\" stroke-width=\"1.8\" fill=\"none\" />\n            <circle cx=\"15.8\" cy=\"8.2\" r=\"0.9\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "twitter",
    "n": "X (Twitter)",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Publish posts, threads, monitor brand mentions, and engage with your audience on X.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4.5\" fill=\"#000000\" />\n            <path\n              d=\"M14.534 5.5h2.158l-4.715 5.39L17.525 18.5H13.18l-3.398-4.448L5.89 18.5H3.73l5.043-5.765L3.475 5.5h4.455l3.07 4.062L14.534 5.5zm-.758 11.71h1.196L7.29 6.726H6.006L13.776 17.21z\"\n              fill=\"#FFFFFF\"\n            />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "tiktok",
    "n": "TikTok",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Publish short-form video content, track creator analytics, and manage TikTok Business marketing.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4.5\" fill=\"#010101\" />\n            <path\n              d=\"M16.6 8.2c-.8-.5-1.4-1.2-1.6-2.2H12.5v9.8c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2c0-1.2 1-2.2 2.2-2.2.3 0 .5 0 .7.1v-2.6c-.2 0-.5-.1-.7-.1-2.6 0-4.8 2.1-4.8 4.8s2.1 4.8 4.8 4.8 4.8-2.1 4.8-4.8V9.7c1 .7 2.2 1.1 3.5 1.1v-2.6h-2z\"\n              fill=\"#FFFFFF\"\n            />\n            <path\n              d=\"M16.6 8.2c-.8-.5-1.4-1.2-1.6-2.2H14c.2 1 .8 1.7 1.6 2.2v-.0z\"\n              fill=\"#FE2C55\"\n              opacity=\"0.8\"\n            />\n            <path\n              d=\"M12.5 15.8c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2c0-1.2 1-2.2 2.2-2.2.3 0 .5 0 .7.1v-1c-.2 0-.5-.1-.7-.1-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6c2 0 3.6-1.6 3.6-3.6v-2.8h-1.6v2.4z\"\n              fill=\"#25F4EE\"\n              opacity=\"0.8\"\n            />\n          </svg>",
    "s": "soon"
  },
  {
    "id": "threads",
    "n": "Threads",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Publish text conversations, media posts, and reply to community discussions on Meta Threads.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4.5\" fill=\"#000000\" />\n            <path\n              d=\"M12 4.5c4.1 0 7.5 3.4 7.5 7.5s-3.4 7.5-7.5 7.5c-4.1 0-7.5-3.4-7.5-7.5 0-2.3 1.1-4.4 2.8-5.8l1.3 1.3C7.4 8.7 6.6 10.3 6.6 12c0 3 2.4 5.4 5.4 5.4s5.4-2.4 5.4-5.4-2.4-5.4-5.4-5.4c-1.8 0-3.3.9-4.3 2.2l-1.3-1.3C7.7 5.7 9.7 4.5 12 4.5zm0 5.4c1.8 0 3.3 1.5 3.3 3.3 0 1-.5 1.9-1.3 2.5l-1.2-1.2c.4-.3.6-.8.6-1.3 0-.8-.7-1.5-1.5-1.5s-1.5.7-1.5 1.5c0 .4.2.8.5 1.1l-1.2 1.2c-.8-.6-1.3-1.5-1.3-2.5 0-1.8 1.5-3.3 3.3-3.3z\"\n              fill=\"#FFFFFF\"\n            />\n          </svg>",
    "s": "soon"
  },
  {
    "id": "pinterest",
    "n": "Pinterest",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Create pins, organise visual boards, and drive qualified discovery traffic with Pinterest.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10.5\" fill=\"#E60023\" />\n            <path\n              d=\"M12 5.5C8.4 5.5 5.5 8.4 5.5 12c0 2.7 1.7 5.1 4.1 6-.1-.5-.1-1.3 0-1.9l1-4.2s-.3-.5-.3-1.3c0-1.2.7-2.1 1.6-2.1.8 0 1.1.6 1.1 1.3 0 .8-.5 1.9-.8 3-.2.9.5 1.6 1.4 1.6 1.7 0 3-1.8 3-4.3 0-2.3-1.6-3.8-4-3.8-2.7 0-4.3 2-4.3 4.1 0 .8.3 1.7.7 2.2.1.1.1.2.1.3l-.3 1.1c0 .2-.2.2-.3.1-1.3-.6-2.1-2.5-2.1-4 0-3.3 2.4-6.3 6.9-6.3 3.6 0 6.5 2.6 6.5 6.1 0 3.6-2.3 6.5-5.4 6.5-1.1 0-2.1-.6-2.4-1.2l-.7 2.5c-.2.9-.9 2-1.3 2.7 1 .3 2.1.5 3.2.5 3.6 0 6.5-2.9 6.5-6.5S15.6 5.5 12 5.5z\"\n              fill=\"#FFFFFF\"\n            />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "reddit",
    "n": "Reddit",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Share community discussions, track subreddit mentions, and publish approved announcements on Reddit.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10.5\" fill=\"#FF4500\" />\n            <path\n              d=\"M19 12.3c0-.8-.7-1.5-1.5-1.5-.4 0-.8.2-1 .5-1.1-.8-2.6-1.3-4.2-1.4l.7-3.4 2.3.5c0 .6.6 1.1 1.2 1.1.7 0 1.2-.6 1.2-1.2s-.6-1.2-1.2-1.2c-.5 0-.9.3-1.1.7l-2.6-.6c-.2 0-.3.1-.4.3l-.8 3.9c-1.7.1-3.2.6-4.3 1.4-.3-.3-.6-.5-1.1-.5-.8 0-1.5.7-1.5 1.5 0 .6.4 1.1.9 1.3-.1.3-.1.7-.1 1 0 2.6 3 4.7 6.8 4.7s6.8-2.1 6.8-4.7c0-.3 0-.7-.1-1 .6-.2.9-.7.9-1.3zM8.8 13.8c0-.6.5-1.1 1.1-1.1s1.1.5 1.1 1.1-.5 1.1-1.1 1.1-1.1-.5-1.1-1.1zm6.4 3c-.7.7-2 .8-3.2.8s-2.5-.1-3.2-.8c-.1-.1-.1-.3 0-.4.1-.1.3-.1.4 0 .5.5 1.6.6 2.8.6s2.3-.1 2.8-.6c.1-.1.3-.1.4 0 .1.1.1.3 0 .4zm-.2-1.9c-.6 0-1.1-.5-1.1-1.1s.5-1.1 1.1-1.1 1.1.5 1.1 1.1-.5 1.1-1.1 1.1z\"\n              fill=\"#FFFFFF\"\n            />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "buffer",
    "n": "Buffer",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Schedule, queue, and multi-channel publish social media updates across all your brand profiles.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M4 7.5L12 4l8 3.5-8 3.5-8-3.5z\" fill=\"#231F20\" />\n            <path d=\"M4 12l8 3.5 8-3.5-2.2-1L12 13.7 6.2 11 4 12z\" fill=\"#231F20\" />\n            <path d=\"M4 16.5l8 3.5 8-3.5-2.2-1-5.8 2.7-5.8-2.7-2.2 1z\" fill=\"#231F20\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "snapchat",
    "n": "Snapchat",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Create visual ad campaigns, track conversions, and connect with audiences on Snapchat.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4.5\" fill=\"#FFFC00\" />\n            <path\n              d=\"M12 5.5c-2.3 0-3.9 1.8-3.9 4.1 0 .7.2 1.6.4 2-.5.1-1 .3-1.3.7-.3.4-.3.9-.1 1.3.3.6 1.1.8 1.8.6.1.4.3 1 .8 1.3-.7.2-1.8.6-2.4 1.4-.4.6-.3 1.3.3 1.5 1.2.4 2.8.1 3.5-.7.4.2.7.3 1 .3s.6-.1 1-.3c.7.8 2.3 1.1 3.5.7.6-.2.7-.9.3-1.5-.6-.8-1.7-1.2-2.4-1.4.5-.3.7-.9.8-1.3.7.2 1.5 0 1.8-.6.2-.4.2-.9-.1-1.3-.3-.4-.8-.6-1.3-.7.2-.4.4-1.3.4-2 0-2.3-1.6-4.1-3.9-4.1z\"\n              fill=\"#FFFFFF\"\n              stroke=\"#000000\"\n              stroke-width=\"0.8\"\n            />\n          </svg>",
    "s": "soon"
  },
  {
    "id": "whatsapp",
    "n": "WhatsApp Business",
    "c": "Social Media",
    "g": "Social Media",
    "d": "Send approved customer notifications, alerts, and transactional messages via WhatsApp Cloud API.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10.5\" fill=\"#25D366\" />\n            <path\n              d=\"M17.5 14.7c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.2-.3.2-.5.1-.2-.1-.9-.3-1.8-1.1-.7-.6-1.1-1.3-1.3-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.3-.4.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4-.1-.1-.5-1.2-.7-1.6-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.3c.1.2 1.6 2.5 4 3.5 2.3 1 2.3.7 2.7.6.4-.1 1.3-.5 1.5-1 .2-.5.2-1 .1-1.1-.1-.1-.3-.2-.5-.3z\"\n              fill=\"#FFFFFF\"\n            />\n          </svg>",
    "s": "soon"
  },
  {
    "id": "mailchimp",
    "n": "Mailchimp",
    "c": "Marketing",
    "g": "Marketing",
    "d": "Email newsletter marketing, subscriber lists, and automated campaigns.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#FFE01B\" />\n            <circle cx=\"12\" cy=\"12\" r=\"6\" fill=\"#241C15\" />\n            <circle cx=\"10\" cy=\"11\" r=\"1\" fill=\"#FFE01B\" />\n            <circle cx=\"14\" cy=\"11\" r=\"1\" fill=\"#FFE01B\" />\n            <path d=\"M10 14C11 15 13 15 14 14\" stroke=\"#FFE01B\" stroke-width=\"1\" stroke-linecap=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "activecampaign",
    "n": "ActiveCampaign",
    "c": "Marketing",
    "g": "Marketing",
    "d": "Customer experience automation, email marketing, and CRM.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#356AE6\" />\n            <path d=\"M8 7L14 12L8 17V7Z\" fill=\"#FFFFFF\" />\n            <circle cx=\"16\" cy=\"12\" r=\"2\" fill=\"#00D290\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "klaviyo",
    "n": "Klaviyo",
    "c": "Marketing",
    "g": "Marketing",
    "d": "Automated email and SMS marketing for retail and e-commerce.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\" fill=\"#000000\" />\n            <path d=\"M6 7L13 12L6 17V7Z\" fill=\"#FFFFFF\" />\n            <path d=\"M13 7L18 12L13 17V7Z\" fill=\"#FFA487\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "shopify",
    "n": "Shopify",
    "c": "E-commerce",
    "g": "E-commerce",
    "d": "Global commerce platform: products, orders, inventory, and customer purchases.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"4\" fill=\"#95BF47\" />\n            <path d=\"M13.5 6L8 8L6.5 17L12 19L17.5 17L16 8L13.5 6Z\" fill=\"#5E8E3E\" />\n            <path d=\"M12 9.5C10.5 9.5 9.5 10.5 9.5 11.8C9.5 14.5 14.5 13.5 14.5 15.5C14.5 16.5 13.5 17 12 17C10.5 17 9.8 16.2 9.8 16.2L9.2 17.5C9.2 17.5 10.2 18.5 12 18.5C14.5 18.5 16 17.2 16 15.5C16 12.8 11 13.8 11 11.8C11 10.8 11.8 10.5 12.5 10.5C13.5 10.5 14.2 11 14.2 11L14.8 9.8C14.8 9.8 13.8 9.5 12 9.5Z\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "woocommerce",
    "n": "WooCommerce",
    "c": "E-commerce",
    "g": "E-commerce",
    "d": "Open-source e-commerce platform built on WordPress.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"4\" fill=\"#96588A\" />\n            <text x=\"12\" y=\"15\" fill=\"#FFFFFF\" fontSize=\"9\" fontWeight=\"bold\" textAnchor=\"middle\" fontFamily=\"sans-serif\">WOO</text>\n          </svg>",
    "s": "idle"
  },
  {
    "id": "zendesk",
    "n": "Zendesk",
    "c": "Customer Support",
    "g": "Customer Support",
    "d": "Customer service platform, ticketing system, and knowledge base.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"3\" width=\"20\" height=\"18\" rx=\"3\" fill=\"#03363D\" />\n            <circle cx=\"8\" cy=\"8\" r=\"3\" fill=\"#78A300\" />\n            <path d=\"M13 5H19V11H13V5Z\" fill=\"#EB7044\" />\n            <path d=\"M5 13H11V19H5V13Z\" fill=\"#EB7044\" />\n            <circle cx=\"16\" cy=\"16\" r=\"3\" fill=\"#78A300\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "freshdesk",
    "n": "Freshdesk",
    "c": "Customer Support",
    "g": "Customer Support",
    "d": "Omnichannel customer support software and ticket dispatching.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#25C974\" />\n            <path d=\"M8 12C8 9.8 9.8 8 12 8C14.2 8 16 9.8 16 12C16 14.2 14.2 16 12 16\" stroke=\"#FFFFFF\" stroke-width=\"2.5\" stroke-linecap=\"round\" />\n            <circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "intercom",
    "n": "Intercom",
    "c": "Customer Support",
    "g": "Customer Support",
    "d": "Complete customer service solution with AI agent, live chat, and ticketing.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#1F8DED\" />\n            <rect x=\"6\" y=\"8\" width=\"2\" height=\"8\" rx=\"1\" fill=\"#FFFFFF\" />\n            <rect x=\"9\" y=\"6\" width=\"2\" height=\"12\" rx=\"1\" fill=\"#FFFFFF\" />\n            <rect x=\"12\" y=\"6\" width=\"2\" height=\"12\" rx=\"1\" fill=\"#FFFFFF\" />\n            <rect x=\"15\" y=\"8\" width=\"2\" height=\"8\" rx=\"1\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "typeform",
    "n": "Typeform",
    "c": "Forms & Data Collection",
    "g": "Forms & Data Collection",
    "d": "Interactive forms, surveys, and conversational user feedback.",
    "auth": "Secure sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"3\" fill=\"#262627\" />\n            <path d=\"M7 8H17M12 8V17\" stroke=\"#FFFFFF\" stroke-width=\"2.5\" stroke-linecap=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "jotform",
    "n": "Jotform",
    "c": "Forms & Data Collection",
    "g": "Forms & Data Collection",
    "d": "Online form builder and survey data collection.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"12\" cy=\"12\" r=\"10\" fill=\"#FA8900\" />\n            <circle cx=\"12\" cy=\"12\" r=\"4\" fill=\"#0A1551\" />\n            <circle cx=\"12\" cy=\"12\" r=\"2\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "webhooks",
    "n": "Webhooks",
    "c": "Developer / API",
    "g": "Developer / API",
    "d": "Trigger Concludo workflows from incoming webhooks or dispatch real-time outbound HTTP webhooks.",
    "auth": "Webhook secret",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#16263F\" />\n            <circle cx=\"6.5\" cy=\"12\" r=\"3\" stroke=\"#E2B53C\" stroke-width=\"1.8\" fill=\"none\" />\n            <circle cx=\"17.5\" cy=\"7\" r=\"3\" stroke=\"#E2B53C\" stroke-width=\"1.8\" fill=\"none\" />\n            <circle cx=\"17.5\" cy=\"17\" r=\"3\" stroke=\"#E2B53C\" stroke-width=\"1.8\" fill=\"none\" />\n            <path d=\"M9.5 12H12.5M12.5 12L14.5 7M12.5 12L14.5 17\" stroke=\"#E2B53C\" stroke-width=\"1.8\" stroke-linecap=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "generic_http",
    "n": "HTTP / API Request",
    "c": "Developer / API",
    "g": "Developer / API",
    "d": "Universal connector: execute GET, POST, PUT, PATCH, DELETE requests to any external REST API.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#0B1320\" />\n            <text x=\"12\" y=\"15\" fill=\"#E2B53C\" fontSize=\"8\" fontWeight=\"bold\" textAnchor=\"middle\" fontFamily=\"monospace\">&lt;API/&gt;</text>\n          </svg>",
    "s": "idle"
  },
  {
    "id": "json_tool",
    "n": "JSON Parser & Transformer",
    "c": "Developer / API",
    "g": "Developer / API",
    "d": "Transform, parse, and filter structured JSON payloads between workflow actions.",
    "auth": "No sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#1E293B\" />\n            <text x=\"12\" y=\"15\" fill=\"#38BDF8\" fontSize=\"8\" fontWeight=\"bold\" textAnchor=\"middle\" fontFamily=\"monospace\">{\"{JSON}\"}</text>\n          </svg>",
    "s": "idle"
  },
  {
    "id": "email_universal",
    "n": "Universal Email (SMTP / IMAP)",
    "c": "Developer / API",
    "g": "Developer / API",
    "d": "Send alerts or trigger workflows using standard corporate email servers.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"3\" fill=\"#2563EB\" />\n            <path d=\"M4 6L12 12.5L20 6\" stroke=\"#FFFFFF\" stroke-width=\"2\" stroke-linecap=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "sftp_universal",
    "n": "SFTP File Transfer",
    "c": "Developer / API",
    "g": "Developer / API",
    "d": "Secure enterprise file transfer for automated batch uploads and document storage.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#334155\" />\n            <path d=\"M6 8H18M6 12H18M6 16H18\" stroke=\"#38BDF8\" stroke-width=\"2\" stroke-linecap=\"round\" />\n            <circle cx=\"10\" cy=\"8\" r=\"1\" fill=\"#FFFFFF\" />\n            <circle cx=\"14\" cy=\"12\" r=\"1\" fill=\"#FFFFFF\" />\n            <circle cx=\"8\" cy=\"16\" r=\"1\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "openai",
    "n": "OpenAI",
    "c": "AI",
    "g": "AI",
    "d": "Connect enterprise OpenAI models (GPT-4o) for document synthesis, extraction, and drafting.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#10A37F\" />\n            <circle cx=\"12\" cy=\"12\" r=\"5\" stroke=\"#FFFFFF\" stroke-width=\"2\" fill=\"none\" />\n            <circle cx=\"12\" cy=\"12\" r=\"2\" fill=\"#FFFFFF\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "anthropic_claude",
    "n": "Anthropic Claude",
    "c": "AI",
    "g": "AI",
    "d": "Connect Anthropic Claude models for deep document reasoning, analysis, and nuanced reporting.",
    "auth": "API key",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"2\" y=\"2\" width=\"20\" height=\"20\" rx=\"4\" fill=\"#D97706\" />\n            <path d=\"M7 17L12 7L17 17M9 13H15\" stroke=\"#FFFFFF\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "microsoft_outlook_calendar",
    "n": "Outlook Calendar",
    "c": "Productivity",
    "g": "Microsoft 365",
    "d": "Add follow-up meetings and deadlines to your Outlook calendar after you approve them.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M14 6H21C21.55 6 22 6.45 22 7V17C22 17.55 21.55 18 21 18H14V6Z\" fill=\"#0078D4\" />\n            <path d=\"M14 6L21.5 11.5L14 17V6Z\" fill=\"#106EBE\" opacity=\"0.6\" />\n            <rect x=\"2\" y=\"5\" width=\"12\" height=\"14\" rx=\"2\" fill=\"#0078D4\" />\n            <circle cx=\"8\" cy=\"12\" r=\"3.2\" stroke=\"#FFFFFF\" stroke-width=\"2.2\" fill=\"none\" />\n          </svg>",
    "s": "reauth"
  },
  {
    "id": "microsoft_onedrive",
    "n": "OneDrive",
    "c": "File Storage",
    "g": "Microsoft 365",
    "d": "Save finished summaries and decision logs to a OneDrive folder you choose.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <path d=\"M14.5 11C14.1 8.8 12.2 7 10 7C8.1 7 6.4 8.3 5.7 10.1C3.6 10.4 2 12.2 2 14.5C2 17 4 19 6.5 19H17C19.8 19 22 16.8 22 14C22 11.4 20 9.2 17.5 9C17 7.2 15.5 6 13.5 6C13.2 6 12.9 6.05 12.6 6.15C13.7 7.3 14.5 8.9 14.5 11Z\" fill=\"#0078D4\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "microsoft_sharepoint",
    "n": "SharePoint",
    "c": "File Storage",
    "g": "Microsoft 365",
    "d": "Save documents to SharePoint sites you choose.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <circle cx=\"9\" cy=\"9\" r=\"6\" fill=\"#038387\" />\n            <circle cx=\"15\" cy=\"11\" r=\"5\" fill=\"#004E52\" opacity=\"0.8\" />\n            <circle cx=\"14\" cy=\"15\" r=\"4.5\" fill=\"#32B5B9\" opacity=\"0.9\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "microsoft_onenote",
    "n": "OneNote",
    "c": "Productivity",
    "g": "Microsoft 365",
    "d": "Save meeting summaries to a OneNote notebook.",
    "auth": "Microsoft sign-in",
    "svg": "<svg viewBox=\"0 0 24 24\" fill=\"none\" style=\"width:100%;height:100%\">\n            <rect x=\"10\" y=\"5\" width=\"12\" height=\"14\" rx=\"1\" fill=\"#7719AA\" />\n            <path d=\"M13 8H19M13 12H19M13 16H17\" stroke=\"#FFFFFF\" stroke-width=\"1.5\" stroke-linecap=\"round\" opacity=\"0.7\" />\n            <rect x=\"2\" y=\"4\" width=\"11\" height=\"16\" rx=\"1.5\" fill=\"#5C1387\" />\n            <path d=\"M5 16V8L9.5 16V8\" stroke=\"#FFFFFF\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" />\n          </svg>",
    "s": "idle"
  },
  {
    "id": "google_tasks",
    "n": "Google Tasks",
    "c": "Productivity",
    "g": "Google Workspace",
    "d": "Turn approved actions into Google Tasks.",
    "auth": "Google sign-in",
    "svg": null,
    "s": "idle"
  }
];
