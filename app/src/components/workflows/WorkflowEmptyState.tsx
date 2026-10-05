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
  initialBrief?: string;
  clarificationQuestion?: string;
}

export const WorkflowEmptyState: React.FC<WorkflowEmptyStateProps> = ({
  connections,
  onBuild,
  onOpenTemplates,
  onBuildManually,
  onConnectAnotherApp,
  isBuilding = false,
  initialBrief = '',
  clarificationQuestion,
}) => {
  const [briefText, setBriefText] = useState(initialBrief);
  React.useEffect(() => {
    if (initialBrief) setBriefText(initialBrief);
  }, [initialBrief]);

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
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '36px 20px 64px 20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="wb-empty-stage-inner"
        style={{
          width: '100%',
          maxWidth: '760px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* 1. Gold spark, heading, and subheading */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(226, 181, 60, 0.12)',
              border: '1px solid rgba(226, 181, 60, 0.25)',
              marginBottom: '16px',
            }}
          >
            <Sparkles size={22} color="var(--gold)" />
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-h)',
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--light)',
              margin: '0 0 10px 0',
              lineHeight: 1.3,
              letterSpacing: '-0.02em',
            }}
          >
            What do you want Concludo to automate?
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-b)',
              fontSize: '14.5px',
              color: 'var(--sub)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Describe the outcome in your own words. You approve it before it ever runs.
          </p>
        </div>

        {/* Clarification question banner if needed */}
        {clarificationQuestion && (
          <div
            style={{
              width: '100%',
              background: 'rgba(226, 181, 60, 0.12)',
              border: '1px solid var(--gold)',
              borderRadius: '8px',
              padding: '14px 16px',
              marginBottom: '20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <Sparkles size={16} color="var(--gold)" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '11px', fontFamily: 'var(--font-m)', color: 'var(--gold)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                Clarification from Concludo Architect
              </div>
              <div style={{ fontSize: '13px', color: 'var(--light)', fontFamily: 'var(--font-b)', lineHeight: 1.45 }}>
                {clarificationQuestion}
              </div>
            </div>
          </div>
        )}

        {/* 2. Large input with gold border + Build workflow button */}
        <div
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1.5px solid var(--gold)',
            borderRadius: '12px',
            padding: '18px 20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            marginBottom: '26px',
            boxSizing: 'border-box',
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
              fontSize: '14.5px',
              fontFamily: 'var(--font-b)',
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
              minHeight: '72px',
              boxSizing: 'border-box',
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '14px',
              paddingTop: '12px',
              borderTop: '1px solid var(--navy2)',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '11.5px', color: 'var(--sub)', fontFamily: 'var(--font-m)' }}>
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
                padding: '9px 20px',
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
        <div style={{ width: '100%', marginBottom: '26px' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <button
              type="button"
              onClick={onOpenTemplates}
              style={startOptionStyle}
            >
              <Layers size={20} color="var(--gold)" style={{ flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--light)', fontFamily: 'var(--font-h)', lineHeight: 1.3 }}>
                  A template
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--sub)', marginTop: '4px', lineHeight: 1.4 }}>
                  20 ready to adapt
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={onBuildManually}
              style={startOptionStyle}
            >
              <Sliders size={20} color="var(--sub)" style={{ flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--light)', fontFamily: 'var(--font-h)', lineHeight: 1.3 }}>
                  Build it manually
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--sub)', marginTop: '4px', lineHeight: 1.4 }}>
                  For experienced users
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* 5. Examples */}
        <div style={{ width: '100%', marginBottom: '32px' }}>
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
                  padding: '11px 16px',
                  color: 'var(--light)',
                  fontSize: '13px',
                  fontFamily: 'var(--font-b)',
                  lineHeight: 1.45,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--gold)';
                  el.style.background = 'rgba(226, 181, 60, 0.05)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = 'var(--navy2)';
                  el.style.background = 'var(--surface)';
                }}
              >
                &ldquo;{exampleText}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const startOptionStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '14px 18px',
  background: 'var(--surface)',
  border: '1px solid var(--navy2)',
  borderRadius: '10px',
  cursor: 'pointer',
  transition: 'border-color 0.15s ease, background 0.15s ease',
};
