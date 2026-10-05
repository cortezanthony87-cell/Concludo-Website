import React, { useState } from 'react';
import { WorkflowDefinition, WorkflowStep } from '../../lib/workflows/schemas';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RotateCcw, Check, MessageSquare } from 'lucide-react';

export interface WhatChangedItem {
  type: 'ADDED' | 'REMOVED' | 'MOVED' | 'CHANGED' | 'RENAMED';
  description: string;
}

export interface ReviewCardProps {
  definition: WorkflowDefinition;
  plainLanguageExplanation?: string[];
  riskSentence?: string;
  missingConnections: Array<{ stepKey: string; appName: string }>;
  validationErrors: Array<{ code: string; message: string }>;
  changes?: WhatChangedItem[];
  onKeepChanges?: () => void;
  onUndoChanges?: () => void;
  onConnectApp: (appName: string) => void;
  onSelectStep: (stepKey: string) => void;
  messages: Array<{ id: string; role: 'user' | 'architect'; content: string; timestamp?: string }>;
  onSendMessage: (text: string) => void;
  isBuilding: boolean;
  suggestions?: string[];
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  definition,
  plainLanguageExplanation = [],
  riskSentence,
  missingConnections,
  validationErrors,
  changes,
  onKeepChanges,
  onUndoChanges,
  onConnectApp,
  onSelectStep,
  messages,
  onSendMessage,
  isBuilding,
  suggestions = ['Add a reminder the day before', 'Explain this to me'],
}) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [composerText, setComposerText] = useState('');

  // Count checklist blocking items
  const blockingItemsCount = missingConnections.length + validationErrors.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (composerText.trim() && !isBuilding) {
      onSendMessage(composerText.trim());
      setComposerText('');
    }
  };

  return (
    <div
      className="wb-review-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--navy)',
        borderRight: '1px solid var(--navy2)',
      }}
    >
      {/* Scrollable upper section */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* 1. "Ready for your review" */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--navy2)',
            borderRadius: '8px',
            padding: '16px',
          }}
        >
          <h2
            tabIndex={-1}
            style={{
              fontFamily: 'var(--font-h)',
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--light)',
              margin: '0 0 8px 0',
            }}
          >
            Ready for your review
          </h2>

          <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--light)', lineHeight: 1.5 }}>
            {plainLanguageExplanation.length > 0
              ? plainLanguageExplanation.join(' ')
              : 'Workflow synthesised. Review the steps and human sign-off gates before activating.'}
          </p>

          {riskSentence && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                fontSize: '11.5px',
                color: 'var(--warn)',
                fontFamily: 'var(--font-m)',
              }}
            >
              {riskSentence}
            </div>
          )}
        </div>

        {/* 2. "Before you can test (n)" */}
        {blockingItemsCount > 0 && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid var(--warn)',
              borderRadius: '8px',
              padding: '14px',
            }}
          >
            <div
              style={{
                fontSize: '12.5px',
                fontFamily: 'var(--font-h)',
                fontWeight: 600,
                color: 'var(--warn)',
                marginBottom: '10px',
              }}
            >
              Before you can test ({blockingItemsCount})
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {missingConnections.map((conn, idx) => (
                <li
                  key={`conn-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--light)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={13} color="var(--warn)" />
                    Connect {conn.appName}
                  </span>
                  <button
                    type="button"
                    onClick={() => onConnectApp(conn.appName)}
                    style={{
                      background: 'var(--gold)',
                      color: 'var(--navy)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      fontFamily: 'var(--font-m)',
                      cursor: 'pointer',
                    }}
                  >
                    Connect
                  </button>
                </li>
              ))}

              {validationErrors.map((err, idx) => (
                <li
                  key={`err-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--light)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={13} color="var(--bad)" />
                    {err.message}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. "What changed" (only after an edit) */}
        {changes && changes.length > 0 && (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--navy2)',
              borderRadius: '8px',
              padding: '14px',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-m)',
                color: 'var(--sub)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '8px',
              }}
            >
              What changed
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {changes.map((c, idx) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    color: 'var(--light)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-m)',
                      fontSize: '10px',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      background:
                        c.type === 'ADDED'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : c.type === 'REMOVED'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : 'rgba(226, 181, 60, 0.15)',
                      color:
                        c.type === 'ADDED'
                          ? 'var(--ok)'
                          : c.type === 'REMOVED'
                          ? 'var(--bad)'
                          : 'var(--gold)',
                      fontWeight: 700,
                    }}
                  >
                    {c.type}
                  </span>
                  <span>{c.description}</span>
                </li>
              ))}
            </ul>

            <div style={{ display: 'flex', gap: '8px' }}>
              {onKeepChanges && (
                <button
                  type="button"
                  onClick={onKeepChanges}
                  style={{
                    flex: 1,
                    background: 'var(--gold)',
                    color: 'var(--navy)',
                    border: 'none',
                    borderRadius: '5px',
                    padding: '6px 10px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-m)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <Check size={12} />
                  <span>Keep</span>
                </button>
              )}
              {onUndoChanges && (
                <button
                  type="button"
                  onClick={onUndoChanges}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: '1px solid var(--navy2)',
                    borderRadius: '5px',
                    color: 'var(--light)',
                    padding: '6px 10px',
                    fontSize: '11.5px',
                    fontFamily: 'var(--font-m)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Undo</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 4. "Show conversation" collapsible */}
        <div style={{ borderTop: '1px solid var(--navy2)', paddingTop: '12px' }}>
          <button
            type="button"
            onClick={() => setIsChatOpen(!isChatOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--sub)',
              fontSize: '11.5px',
              fontFamily: 'var(--font-m)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={13} />
              <span>Show conversation ({messages.length})</span>
            </span>
            {isChatOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {isChatOpen && (
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '200px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: m.role === 'architect' ? 'var(--surface)' : 'rgba(226, 181, 60, 0.08)',
                    border: `1px solid ${m.role === 'architect' ? 'var(--navy2)' : 'rgba(226, 181, 60, 0.2)'}`,
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: 'var(--light)',
                    lineHeight: 1.4,
                  }}
                >
                  <div style={{ fontSize: '9.5px', fontFamily: 'var(--font-m)', color: 'var(--sub)', marginBottom: '3px' }}>
                    {m.role === 'architect' ? 'CONCLUDO ARCHITECT' : 'YOU'}
                  </div>
                  <div>{m.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pinned Bottom Composer */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: '1px solid var(--navy2)',
          background: 'var(--surface)',
        }}
      >
        {/* Suggestion Chips */}
        {suggestions && suggestions.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {suggestions.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSendMessage(sug)}
                disabled={isBuilding}
                style={{
                  background: 'var(--navy)',
                  border: '1px solid var(--navy2)',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  fontSize: '11px',
                  color: 'var(--sub)',
                  cursor: isBuilding ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-b)',
                  transition: 'border-color 0.15s ease',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--gold)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--navy2)')}
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            disabled={isBuilding}
            placeholder="Change anything, in words"
            aria-label="Change anything, in words"
            style={{
              flex: 1,
              background: 'var(--navy)',
              border: '1px solid var(--navy2)',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '12.5px',
              color: 'var(--light)',
              outline: 'none',
              fontFamily: 'var(--font-b)',
            }}
          />
          <button
            type="submit"
            disabled={!composerText.trim() || isBuilding}
            style={{
              background: 'var(--gold)',
              color: 'var(--navy)',
              border: 'none',
              borderRadius: '6px',
              padding: '0 14px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: !composerText.trim() || isBuilding ? 'not-allowed' : 'pointer',
              opacity: !composerText.trim() || isBuilding ? 0.6 : 1,
            }}
          >
            &rsaquo;
          </button>
        </form>
      </div>
    </div>
  );
};
