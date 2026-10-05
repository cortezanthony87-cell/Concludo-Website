import React, { useState } from 'react';
import { Sparkles, Layers, Sliders } from 'lucide-react';
import { IntegrationConnection } from '../../lib/integrations/hubRegistry';
import { ConnectedAppsStrip } from './ConnectedAppsStrip';

export interface WorkflowEmptyStateProps {
  connections: IntegrationConnection[];
  onBuild: (brief: string) => void;
  onOpenTemplates: () => void;
  onBuildManually: () => void;
  onConnectAnotherApp: () => void;
  isBuilding?: boolean;
}

export const WorkflowEmptyState: React.FC<WorkflowEmptyStateProps> = ({
  connections,
  onBuild,
  onOpenTemplates,
  onBuildManually,
  onConnectAnotherApp,
  isBuilding = false,
}) => {
  const [briefText, setBriefText] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (briefText.trim() && !isBuilding) {
        onBuild(briefText.trim());
      }
    }
  };

  const handleExampleClick = (text: string) => {
    setBriefText(text);
  };

  return (
    <div
      className="wb-empty-stage"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 16px',
        maxWidth: '760px',
        margin: '0 auto',
        width: '100%',
        minHeight: '80vh',
      }}
    >
      {/* 1. Gold spark, heading, and subheading */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(226, 181, 60, 0.12)',
            marginBottom: '16px',
          }}
        >
          <Sparkles size={24} color="var(--gold)" />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-h)',
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--light)',
            margin: '0 0 10px 0',
            letterSpacing: '-0.02em',
          }}
        >
          What do you want Concludo to automate?
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-b)',
            fontSize: '14px',
            color: 'var(--sub)',
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Describe the outcome in your own words. You approve it before it ever runs.
        </p>
      </div>

      {/* 2. Large input with gold border + Build workflow button */}
      <div
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: '2px solid var(--gold)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          marginBottom: '24px',
        }}
      >
        <textarea
          autoFocus
          rows={3}
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="For example: when a HubSpot deal is won, create the onboarding project and tell the project owner."
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: 'var(--light)',
            fontSize: '14px',
            fontFamily: 'var(--font-b)',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--navy2)',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--sub)', fontFamily: 'var(--font-m)' }}>
            Press Enter to build &bull; Shift+Enter for new line
          </span>

          <button
            type="button"
            onClick={() => briefText.trim() && onBuild(briefText.trim())}
            disabled={!briefText.trim() || isBuilding}
            style={{
              background: 'var(--gold)',
              color: 'var(--navy)',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'var(--font-m)',
              cursor: !briefText.trim() || isBuilding ? 'not-allowed' : 'pointer',
              opacity: !briefText.trim() || isBuilding ? 0.6 : 1,
              transition: 'all 0.15s ease',
            }}
          >
            {isBuilding ? 'Building...' : 'Build workflow'}
          </button>
        </div>
      </div>

      {/* 3. Concludo can use: Connected Apps strip */}
      <div style={{ width: '100%', marginBottom: '24px' }}>
        <ConnectedAppsStrip
          connections={connections}
          onConnectAnotherApp={onConnectAnotherApp}
        />
      </div>

      {/* 4. Or start from: Templates & Manual */}
      <div style={{ width: '100%', marginBottom: '28px' }}>
        <div
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-m)',
            color: 'var(--sub)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '10px',
          }}
        >
          Or start from
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <button
            type="button"
            onClick={onOpenTemplates}
            style={startOptionStyle}
          >
            <Layers size={18} color="var(--gold)" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--light)', fontFamily: 'var(--font-h)' }}>
                A template
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sub)' }}>20 ready to adapt</div>
            </div>
          </button>

          <button
            type="button"
            onClick={onBuildManually}
            style={startOptionStyle}
          >
            <Sliders size={18} color="var(--sub)" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--light)', fontFamily: 'var(--font-h)' }}>
                Build it manually
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sub)' }}>For experienced users</div>
            </div>
          </button>
        </div>
      </div>

      {/* 5. Examples */}
      <div style={{ width: '100%' }}>
        <div
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-m)',
            color: 'var(--sub)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '10px',
          }}
        >
          Examples
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            'After every client meeting, create the follow-up tasks',
            'When a HubSpot deal is won, set up client onboarding',
            'When a Stripe payment fails, follow up with the customer',
            'Every 15 minutes, turn approved Google Sheet rows into project tasks',
          ].map((exampleText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleExampleClick(exampleText)}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--navy2)',
                borderRadius: '8px',
                padding: '10px 14px',
                color: 'var(--light)',
                fontSize: '12.5px',
                fontFamily: 'var(--font-b)',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--navy2)')}
            >
              &ldquo;{exampleText}&rdquo;
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const startOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '14px 16px',
  background: 'var(--surface)',
  border: '1px solid var(--navy2)',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
};
