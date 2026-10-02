import React from 'react';

export interface IntegrationIconProps {
  slug?: string;
  providerId?: string;
  className?: string;
  size?: number | string;
}

/**
 * Standardised official vector logos for Concludo Integrations Hub.
 * Strictly adheres to official provider branding within a consistent framed viewport.
 */
export const IntegrationIcon: React.FC<IntegrationIconProps> = ({
  slug,
  providerId,
  className = '',
  size = 24,
}) => {
  const target = slug || providerId || '';
  const norm = target.toLowerCase().replace(/[\s\-_]/g, '');

  const renderVector = () => {
    switch (norm) {
      // MICROSOFT 365 / ENTRA ID
      case 'microsoft':
      case 'microsoft365':
      case 'entraid':
      case 'microsoftentraid':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="9.5" height="9.5" fill="#f25022" rx="0.5" />
            <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7fba00" rx="0.5" />
            <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00a4ef" rx="0.5" />
            <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#ffb900" rx="0.5" />
          </svg>
        );

      // OUTLOOK
      case 'microsoftoutlook':
      case 'outlook':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path d="M14 6H21C21.55 6 22 6.45 22 7V17C22 17.55 21.55 18 21 18H14V6Z" fill="#0078D4" />
            <path d="M14 6L21.5 11.5L14 17V6Z" fill="#106EBE" opacity="0.6" />
            <rect x="2" y="5" width="12" height="14" rx="2" fill="#0078D4" />
            <circle cx="8" cy="12" r="3.2" stroke="#FFFFFF" strokeWidth="2.2" fill="none" />
          </svg>
        );

      // TEAMS
      case 'microsoftteams':
      case 'teams':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="4" width="13" height="16" rx="2" fill="#5059C9" />
            <circle cx="18" cy="8" r="2.5" fill="#7B83EB" />
            <rect x="15" y="11" width="6" height="8" rx="1.5" fill="#7B83EB" />
            <path d="M6.5 9H12.5V11H10.5V16H8.5V11H6.5V9Z" fill="#FFFFFF" />
          </svg>
        );

      // ONEDRIVE
      case 'onedrive':
      case 'microsoftonedrive':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path d="M14.5 11C14.1 8.8 12.2 7 10 7C8.1 7 6.4 8.3 5.7 10.1C3.6 10.4 2 12.2 2 14.5C2 17 4 19 6.5 19H17C19.8 19 22 16.8 22 14C22 11.4 20 9.2 17.5 9C17 7.2 15.5 6 13.5 6C13.2 6 12.9 6.05 12.6 6.15C13.7 7.3 14.5 8.9 14.5 11Z" fill="#0078D4" />
          </svg>
        );

      // SHAREPOINT
      case 'sharepoint':
      case 'microsoftsharepoint':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="9" cy="9" r="6" fill="#038387" />
            <circle cx="15" cy="11" r="5" fill="#004E52" opacity="0.8" />
            <circle cx="14" cy="15" r="4.5" fill="#32B5B9" opacity="0.9" />
          </svg>
        );

      // EXCEL
      case 'microsoftexcel':
      case 'excel':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="10" y="5" width="12" height="14" rx="1" fill="#107C41" />
            <path d="M12 9H20M12 12H20M12 15H20M16 5V19" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
            <rect x="2" y="4" width="11" height="16" rx="1.5" fill="#185C37" />
            <path d="M5 8.5L9.5 15.5M9.5 8.5L5 15.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      // PLANNER
      case 'microsoftplanner':
      case 'planner':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="4" width="18" height="16" rx="2" fill="#31752F" />
            <path d="M6 8H18M6 12H14M6 16H11" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16.5" cy="14.5" r="2.5" fill="#81C784" />
          </svg>
        );

      // FORMS
      case 'microsoftforms':
      case 'forms':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="4" width="18" height="16" rx="2" fill="#008272" />
            <path d="M6 8H18M6 12H18M6 16H13" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <path d="M15 15.5L16.5 17L19.5 14" stroke="#81E6D9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      // DYNAMICS 365
      case 'dynamics365':
      case 'microsoftdynamics365':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path d="M4 5L12 3V12L4 15V5Z" fill="#002050" />
            <path d="M12 3L20 8V18L12 21V12L20 8" fill="#005FB8" />
            <path d="M4 15L12 12V21L4 18V15Z" fill="#0078D4" />
          </svg>
        );

      // POWER BI
      case 'powerbi':
      case 'microsoftpowerbi':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="13" width="4" height="7" rx="0.5" fill="#F2C811" />
            <rect x="8" y="9" width="4" height="11" rx="0.5" fill="#E8B20B" />
            <rect x="13" y="6" width="4" height="14" rx="0.5" fill="#D39B06" />
            <rect x="18" y="3" width="4" height="17" rx="0.5" fill="#B98200" />
          </svg>
        );

      // GOOGLE / WORKSPACE
      case 'google':
      case 'googleworkspace':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path d="M21.35 11.1H12V14.8H17.4C16.85 17.5 14.5 19.3 12 19.3C8.7 19.3 6 16.6 6 13.3C6 10 8.7 7.3 12 7.3C13.5 7.3 14.85 7.85 15.9 8.75L18.7 5.95C16.9 4.3 14.6 3.3 12 3.3C6.5 3.3 2 7.8 2 13.3C2 18.8 6.5 23.3 12 23.3C17.5 23.3 21.6 19.4 21.6 13.5C21.6 12.65 21.5 11.85 21.35 11.1Z" fill="#4285F4" />
          </svg>
        );

      // GMAIL
      case 'gmail':
      case 'googlemail':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path d="M4 6C2.9 6 2 6.9 2 8V18C2 19.1 2.9 20 4 20H5V9.8L12 14.5L19 9.8V20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H19L12 11.2L5 6H4Z" fill="#EA4335" />
            <path d="M19 6L12 11.2L5 6" stroke="#C5221F" strokeWidth="1" />
          </svg>
        );

      // GOOGLE CALENDAR
      case 'googlecalendar':
      case 'calendar':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="4" width="18" height="17" rx="2" fill="#4285F4" />
            <path d="M3 8H21" stroke="#FFFFFF" strokeWidth="1.5" />
            <rect x="7" y="2" width="2" height="4" rx="1" fill="#1A73E8" />
            <rect x="15" y="2" width="2" height="4" rx="1" fill="#1A73E8" />
            <text x="12" y="16.5" fill="#FFFFFF" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">31</text>
          </svg>
        );

      // GOOGLE DRIVE
      case 'googledrive':
      case 'drive':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path d="M8.2 3.8L2.5 13.7L5.5 18.9L11.2 9L8.2 3.8Z" fill="#0066DA" />
            <path d="M15.8 3.8H8.2L11.2 9H21.5L18.5 3.8H15.8Z" fill="#00AC47" />
            <path d="M11.2 9L5.5 18.9H17.8L23.5 9H11.2Z" fill="#EA4335" />
            <path d="M23.5 9L17.8 18.9H5.5L8.5 13.7L18.5 13.7L23.5 9Z" fill="#FFBA00" />
          </svg>
        );

      // GOOGLE SHEETS
      case 'googlesheets':
      case 'sheets':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#0F9D58" />
            <rect x="7" y="7" width="10" height="10" rx="1" fill="#FFFFFF" />
            <path d="M7 10.3H17M7 13.6H17M12 7V17" stroke="#0F9D58" strokeWidth="1" />
          </svg>
        );

      // GOOGLE DOCS
      case 'googledocs':
      case 'docs':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path d="M5 3C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V9L15 3H5Z" fill="#4285F4" />
            <path d="M15 3V9H21" fill="#A1C2FA" />
            <path d="M7 13H17M7 16H14" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );

      // GOOGLE FORMS
      case 'googleforms':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="4" y="3" width="16" height="18" rx="2" fill="#7248B9" />
            <path d="M8 8H16M8 12H16M8 16H13" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="6.5" cy="8" r="0.8" fill="#FFFFFF" />
            <circle cx="6.5" cy="12" r="0.8" fill="#FFFFFF" />
            <circle cx="6.5" cy="16" r="0.8" fill="#FFFFFF" />
          </svg>
        );

      // GOOGLE CONTACTS
      case 'googlecontacts':
      case 'contacts':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="4" width="18" height="16" rx="2" fill="#4285F4" />
            <circle cx="12" cy="10" r="3" fill="#FFFFFF" />
            <path d="M6 18C6 15 9 14 12 14C15 14 18 15 18 18" fill="#FFFFFF" />
          </svg>
        );

      // XERO
      case 'xero':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#13B5EA" />
            <path d="M7 8L11 12L7 16M17 8L13 12L17 16" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      // MYOB
      case 'myob':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#6100A5" />
            <path d="M6 14.5C6 11 8.5 8 12 8C15.5 8 18 10.5 18 13.5C18 16.5 15.5 17.5 12 17.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12.5" r="2.5" fill="#E8005A" />
          </svg>
        );

      // QUICKBOOKS
      case 'quickbooks':
      case 'quickbooksonline':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#2CA01C" />
            <path d="M8 8V16C8 16 9.5 16 10 15C10.5 14 10.5 10 10.5 10M16 16V8C16 8 14.5 8 14 9C13.5 10 13.5 14 13.5 14" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        );

      // STRIPE
      case 'stripe':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="4" width="20" height="16" rx="3" fill="#635BFF" />
            <path d="M12.5 9.5C11.5 9.2 10.8 8.8 10.8 8.1C10.8 7.3 11.6 6.8 12.7 6.8C13.8 6.8 14.7 7.2 15.1 7.6L15.8 5.7C14.9 5.3 13.8 5.1 12.7 5.1C10.1 5.1 8.3 6.4 8.3 8.5C8.3 11.2 12.1 10.8 12.1 12.4C12.1 13.4 11.1 13.8 9.9 13.8C8.6 13.8 7.4 13.2 6.8 12.7L6 14.7C6.9 15.3 8.3 15.7 9.8 15.7C12.6 15.7 14.6 14.4 14.6 12.2C14.6 9.3 12.5 9.5 12.5 9.5Z" fill="#FFFFFF" />
          </svg>
        );

      // PAYPAL
      case 'paypal':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#003087" />
            <path d="M7 6H13C15 6 16.5 7.2 16.2 9.2C15.8 11.5 14.2 12.8 12 12.8H9.5L8.5 19H6.5L7 6Z" fill="#0079C1" />
            <path d="M9 9H14C15.8 9 17 10 16.7 11.8C16.4 13.8 15 15 13 15H10.8L10 20H8L9 9Z" fill="#00457C" opacity="0.6" />
          </svg>
        );

      // SLACK
      case 'slack':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#4A154B" />
            <circle cx="7" cy="10" r="1.5" fill="#E01E5A" />
            <rect x="9.5" y="6" width="3" height="6" rx="1.5" fill="#36C5F0" />
            <circle cx="17" cy="14" r="1.5" fill="#2EB67D" />
            <rect x="11.5" y="12" width="3" height="6" rx="1.5" fill="#ECB22E" />
          </svg>
        );

      // ZOOM
      case 'zoom':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="4" width="20" height="16" rx="4" fill="#2D8CFF" />
            <rect x="6" y="8" width="8" height="8" rx="1.5" fill="#FFFFFF" />
            <path d="M14 10.5L18 8V16L14 13.5V10.5Z" fill="#FFFFFF" />
          </svg>
        );

      // DISCORD
      case 'discord':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#5865F2" />
            <path d="M17.5 7C16.3 6.4 15 6 15 6L14.7 6.6C16.2 7 16.9 7.7 16.9 7.7C15.5 7 14.1 6.6 12 6.6C9.9 6.6 8.5 7 7.1 7.7C7.1 7.7 7.8 7 9.3 6.6L9 6C9 6 7.7 6.4 6.5 7C5 9.3 4.6 11.5 4.8 13.7C6.3 14.8 7.8 14.8 7.8 14.8L8.4 14C7.4 13.7 6.9 13.1 6.9 13.1C6.9 13.1 7 13.2 7.2 13.3C8.6 14.1 10.2 14.4 12 14.4C13.8 14.4 15.4 14.1 16.8 13.3C17 13.2 17.1 13.1 17.1 13.1C17.1 13.1 16.6 13.7 15.6 14L16.2 14.8C16.2 14.8 17.7 14.8 19.2 13.7C19.5 11.2 18.8 9.1 17.5 7ZM9.5 12C8.7 12 8 11.3 8 10.5C8 9.7 8.7 9 9.5 9C10.3 9 11 9.7 11 10.5C11 11.3 10.3 12 9.5 12ZM14.5 12C13.7 12 13 11.3 13 10.5C13 9.7 13.7 9 14.5 9C15.3 9 16 9.7 16 10.5C16 11.3 15.3 12 14.5 12Z" fill="#FFFFFF" />
          </svg>
        );

      // TWILIO
      case 'twilio':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#F22F46" />
            <circle cx="9" cy="9" r="2" fill="#FFFFFF" />
            <circle cx="15" cy="9" r="2" fill="#FFFFFF" />
            <circle cx="9" cy="15" r="2" fill="#FFFFFF" />
            <circle cx="15" cy="15" r="2" fill="#FFFFFF" />
          </svg>
        );

      // HUBSPOT
      case 'hubspot':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#FF7A59" />
            <circle cx="15.5" cy="7.5" r="1.8" fill="#FFFFFF" />
            <circle cx="8" cy="12" r="2" fill="#FFFFFF" />
            <path d="M12 12V6M12 12H8M12 12V18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="1.5" fill="#2E3F50" />
          </svg>
        );

      // SALESFORCE
      case 'salesforce':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <path d="M10 6C11.2 4.8 12.9 4 14.8 4C17.9 4 20.5 6.2 21 9.2C22.2 9.8 23 11.1 23 12.5C23 14.4 21.4 16 19.5 16H6C3.8 16 2 14.2 2 12C2 10.1 3.4 8.5 5.2 8.1C5.7 6.3 7.4 5 9.4 5C9.6 5 9.8 5 10 5.1V6Z" fill="#00A1E0" />
          </svg>
        );

      // PIPEDRIVE
      case 'pipedrive':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#26292C" />
            <circle cx="12" cy="10" r="3.5" fill="#28A745" />
            <rect x="8.5" y="10" width="3.5" height="8" rx="1.5" fill="#28A745" />
          </svg>
        );

      // ZOHO CRM
      case 'zohocrm':
      case 'zoho':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="4" width="9" height="7" rx="1" fill="#E42528" />
            <rect x="13" y="4" width="9" height="7" rx="1" fill="#226AB4" />
            <rect x="2" y="13" width="9" height="7" rx="1" fill="#0CB863" />
            <rect x="13" y="13" width="9" height="7" rx="1" fill="#F8B122" />
          </svg>
        );

      // MONDAY.COM
      case 'monday':
      case 'mondaycom':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="3" width="20" height="18" rx="4" fill="#181B34" />
            <circle cx="6.5" cy="14" r="2.2" fill="#E2445C" />
            <rect x="10" y="8" width="4" height="8" rx="2" fill="#FFCC00" />
            <rect x="15.5" y="5" width="4" height="11" rx="2" fill="#00C875" />
          </svg>
        );

      // ASANA
      case 'asana':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#F06A6A" />
            <circle cx="12" cy="8" r="2.5" fill="#FFFFFF" />
            <circle cx="7.5" cy="15" r="2.5" fill="#FFFFFF" />
            <circle cx="16.5" cy="15" r="2.5" fill="#FFFFFF" />
          </svg>
        );

      // TRELLO
      case 'trello':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="3" fill="#0079BF" />
            <rect x="6" y="6" width="4.5" height="9" rx="1" fill="#FFFFFF" />
            <rect x="13.5" y="6" width="4.5" height="6" rx="1" fill="#FFFFFF" />
          </svg>
        );

      // CLICKUP
      case 'clickup':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#7B68EE" />
            <path d="M6 14.5L12 9.5L18 14.5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 16.5L12 14L15 16.5" stroke="#FF007F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      // JIRA
      case 'jira':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="3" fill="#0052CC" />
            <path d="M12 6L16 10L12 14L8 10L12 6Z" fill="#FFFFFF" />
            <path d="M12 11L16 15L12 19L8 15L12 11Z" fill="#2684FF" />
          </svg>
        );

      // NOTION
      case 'notion':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="3" fill="#000000" />
            <path d="M7 6H10.5L14.5 13.5V6H17V18H13.5L9.5 10.5V18H7V6Z" fill="#FFFFFF" />
          </svg>
        );

      // AIRTABLE
      case 'airtable':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="3" width="20" height="18" rx="3" fill="#18BFFF" />
            <path d="M12 5L4 9L12 13L20 9L12 5Z" fill="#FCB400" />
            <path d="M11 14.5L4 11V17L11 20.5V14.5Z" fill="#2D7FF9" />
            <path d="M13 14.5L20 11V17L13 20.5V14.5Z" fill="#18BFFF" />
          </svg>
        );

      // SMARTSHEET
      case 'smartsheet':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#002D72" />
            <path d="M7 9L11 6V18L7 15V9Z" fill="#00A3E0" />
            <path d="M13 6L17 9V15L13 18V6Z" fill="#2D68C4" />
          </svg>
        );

      // DROPBOX
      case 'dropbox':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#0061FF" />
            <path d="M7 6.5L12 9.8L7 13.2L2 9.8L7 6.5Z" fill="#FFFFFF" />
            <path d="M17 6.5L22 9.8L17 13.2L12 9.8L17 6.5Z" fill="#FFFFFF" />
            <path d="M7 13.2L12 16.5L17 13.2L12 9.8L7 13.2Z" fill="#FFFFFF" opacity="0.8" />
            <path d="M7 17.5L12 14.2L17 17.5L12 20.8L7 17.5Z" fill="#FFFFFF" />
          </svg>
        );

      // BOX
      case 'box':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="3" width="20" height="18" rx="3" fill="#0061D5" />
            <circle cx="9" cy="12" r="3.5" fill="#FFFFFF" />
            <circle cx="15" cy="12" r="3.5" fill="#FFFFFF" />
            <rect x="9" y="8.5" width="6" height="7" fill="#FFFFFF" />
            <circle cx="12" cy="12" r="1.5" fill="#0061D5" />
          </svg>
        );

      // MAILCHIMP
      case 'mailchimp':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#FFE01B" />
            <circle cx="12" cy="12" r="6" fill="#241C15" />
            <circle cx="10" cy="11" r="1" fill="#FFE01B" />
            <circle cx="14" cy="11" r="1" fill="#FFE01B" />
            <path d="M10 14C11 15 13 15 14 14" stroke="#FFE01B" strokeWidth="1" strokeLinecap="round" />
          </svg>
        );

      // ACTIVECAMPAIGN
      case 'activecampaign':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#356AE6" />
            <path d="M8 7L14 12L8 17V7Z" fill="#FFFFFF" />
            <circle cx="16" cy="12" r="2" fill="#00D290" />
          </svg>
        );

      // KLAVIYO
      case 'klaviyo':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="3" fill="#000000" />
            <path d="M6 7L13 12L6 17V7Z" fill="#FFFFFF" />
            <path d="M13 7L18 12L13 17V7Z" fill="#FFA487" />
          </svg>
        );

      // SHOPIFY
      case 'shopify':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#95BF47" />
            <path d="M13.5 6L8 8L6.5 17L12 19L17.5 17L16 8L13.5 6Z" fill="#5E8E3E" />
            <path d="M12 9.5C10.5 9.5 9.5 10.5 9.5 11.8C9.5 14.5 14.5 13.5 14.5 15.5C14.5 16.5 13.5 17 12 17C10.5 17 9.8 16.2 9.8 16.2L9.2 17.5C9.2 17.5 10.2 18.5 12 18.5C14.5 18.5 16 17.2 16 15.5C16 12.8 11 13.8 11 11.8C11 10.8 11.8 10.5 12.5 10.5C13.5 10.5 14.2 11 14.2 11L14.8 9.8C14.8 9.8 13.8 9.5 12 9.5Z" fill="#FFFFFF" />
          </svg>
        );

      // WOOCOMMERCE
      case 'woocommerce':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="4" width="20" height="16" rx="4" fill="#96588A" />
            <text x="12" y="15" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">WOO</text>
          </svg>
        );

      // ZENDESK
      case 'zendesk':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="3" width="20" height="18" rx="3" fill="#03363D" />
            <circle cx="8" cy="8" r="3" fill="#78A300" />
            <path d="M13 5H19V11H13V5Z" fill="#EB7044" />
            <path d="M5 13H11V19H5V13Z" fill="#EB7044" />
            <circle cx="16" cy="16" r="3" fill="#78A300" />
          </svg>
        );

      // FRESHDESK
      case 'freshdesk':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#25C974" />
            <path d="M8 12C8 9.8 9.8 8 12 8C14.2 8 16 9.8 16 12C16 14.2 14.2 16 12 16" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" />
          </svg>
        );

      // INTERCOM
      case 'intercom':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#1F8DED" />
            <rect x="6" y="8" width="2" height="8" rx="1" fill="#FFFFFF" />
            <rect x="9" y="6" width="2" height="12" rx="1" fill="#FFFFFF" />
            <rect x="12" y="6" width="2" height="12" rx="1" fill="#FFFFFF" />
            <rect x="15" y="8" width="2" height="8" rx="1" fill="#FFFFFF" />
          </svg>
        );

      // TYPEFORM
      case 'typeform':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="3" fill="#262627" />
            <path d="M7 8H17M12 8V17" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );

      // JOTFORM
      case 'jotform':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <circle cx="12" cy="12" r="10" fill="#FA8900" />
            <circle cx="12" cy="12" r="4" fill="#0A1551" />
            <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
          </svg>
        );

      // WEBHOOKS
      case 'webhook':
      case 'webhooks':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#16263F" />
            <circle cx="6.5" cy="12" r="3" stroke="#E2B53C" strokeWidth="1.8" fill="none" />
            <circle cx="17.5" cy="7" r="3" stroke="#E2B53C" strokeWidth="1.8" fill="none" />
            <circle cx="17.5" cy="17" r="3" stroke="#E2B53C" strokeWidth="1.8" fill="none" />
            <path d="M9.5 12H12.5M12.5 12L14.5 7M12.5 12L14.5 17" stroke="#E2B53C" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        );

      // HTTP / REST API
      case 'http':
      case 'api':
      case 'restapi':
      case 'generichttp':
      case 'httprequest':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#0B1320" />
            <text x="12" y="15" fill="#E2B53C" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">&lt;API/&gt;</text>
          </svg>
        );

      // JSON
      case 'json':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#1E293B" />
            <text x="12" y="15" fill="#38BDF8" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">{"{JSON}"}</text>
          </svg>
        );

      // EMAIL
      case 'email':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="4" width="18" height="16" rx="3" fill="#2563EB" />
            <path d="M4 6L12 12.5L20 6" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );

      // SFTP
      case 'sftp':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#334155" />
            <path d="M6 8H18M6 12H18M6 16H18" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
            <circle cx="10" cy="8" r="1" fill="#FFFFFF" />
            <circle cx="14" cy="12" r="1" fill="#FFFFFF" />
            <circle cx="8" cy="16" r="1" fill="#FFFFFF" />
          </svg>
        );

      // OPENAI
      case 'openai':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#10A37F" />
            <circle cx="12" cy="12" r="5" stroke="#FFFFFF" strokeWidth="2" fill="none" />
            <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
          </svg>
        );

      // ANTHROPIC CLAUDE
      case 'anthropic':
      case 'claude':
      case 'anthropicclaude':
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#D97706" />
            <path d="M7 17L12 7L17 17M9 13H15" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
            <rect x="3" y="3" width="18" height="18" rx="4" fill="#1E293B" />
            <circle cx="12" cy="12" r="4" stroke="#94A3B8" strokeWidth="2" fill="none" />
          </svg>
        );
    }
  };

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative flex items-center justify-center flex-shrink-0 rounded-lg p-0.5 overflow-hidden ${className}`}
      title={slug}
    >
      {renderVector()}
    </div>
  );
};
