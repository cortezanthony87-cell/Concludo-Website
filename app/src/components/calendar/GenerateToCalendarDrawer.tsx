import React, { useState } from 'react';
import { useAuth } from '../../lib/auth/AuthContext';
import { supabase } from '../../lib/supabase/client';
import { GenerateCalendarPayload, GenerateCalendarPayloadItem } from '../../lib/calendar/calendarTypes';
import { generateToCalendar, undoCalendarGeneration } from '../../lib/calendar/calendarClient';
import {
  Sparkles,
  Check,
  AlertCircle,
  Clock,
  User,
  RotateCcw,
  X,
} from 'lucide-react';

interface GenerateToCalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  outputTitle: string;
  projectId: string;
  outputId?: string;
  sourceReference?: string;
  occurredAt?: string;
  initialItems?: GenerateCalendarPayloadItem[];
  onSuccess?: () => void;
}

export const GenerateToCalendarDrawer: React.FC<GenerateToCalendarDrawerProps> = ({
  isOpen,
  onClose,
  outputTitle,
  projectId,
  outputId,
  sourceReference = 'TR-001',
  occurredAt = new Date().toISOString(),
  initialItems = [],
  onSuccess,
}) => {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<string>('everything');
  const [items, setItems] = useState<GenerateCalendarPayloadItem[]>(() => {
    if (initialItems.length > 0) return initialItems;
    return [
      {
        type: 'task',
        reference: 'ACT-001',
        title: 'Variation paperwork to Priya Raman',
        owner: { name: 'Liam Chen', user_id: null, stated: true },
        due_date: '2026-10-15',
        priority: 'high',
        status: 'open',
      },
      {
        type: 'task',
        reference: 'ACT-004',
        title: 'Night work options and timetable impact',
        owner: null,
        due_date: null,
        priority: 'medium',
        status: 'open',
      },
      {
        type: 'review',
        reference: 'DEC-004',
        title: 'Decision review DEC-004: Display enclosure supplier selection',
        owner: { name: 'Priya Raman', user_id: null, stated: true },
        due_date: '2026-10-13',
        priority: 'high',
        status: 'open',
        review: { review_type: 'decision', cadence: 'once' },
      },
      {
        type: 'review',
        reference: 'RSK-002',
        title: 'Risk review RSK-002: Liquidated damages clause',
        owner: null,
        due_date: '2026-10-02',
        priority: 'critical',
        status: 'open',
        review: { review_type: 'risk', cadence: 'quarterly' },
      },
      {
        type: 'milestone',
        reference: 'ACT-002',
        title: 'Crew numbers and method statement sign-off',
        owner: { name: 'Mark Taylor', user_id: null, stated: true },
        due_date: '2026-10-23',
        priority: 'high',
        status: 'open',
      },
    ];
  });

  const [generating, setGenerating] = useState(false);
  const [completedGeneration, setCompletedGeneration] = useState<boolean>(false);
  const [generationId, setGenerationId] = useState<string>('');
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConfirmGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setErrorMessage(null);

    const payload: GenerateCalendarPayload = {
      source: {
        type: 'meeting',
        id: outputId || projectId,
        title: outputTitle,
        occurred_at: occurredAt,
        record_reference: sourceReference,
      },
      options: [selectedOption as any],
      idempotency_key: `${projectId}_${Date.now()}`,
      items,
    };

    const res = await generateToCalendar(supabase.client, user.id, payload);
    setGenerating(false);

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    if (res.itemsCreated > 0) {
      setGenerationId(res.generationId);
      setCompletedGeneration(true);
      setUndoSecondsLeft(60);
      if (onSuccess) onSuccess();

      const interval = setInterval(() => {
        setUndoSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleUndo = async () => {
    if (!user || !generationId) return;
    await undoCalendarGeneration(supabase.client, user.id, generationId);
    setCompletedGeneration(false);
    setUndoSecondsLeft(0);
    if (onSuccess) onSuccess();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(22, 38, 63, 0.6)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1500,
      }}
    >
      <div
        style={{
          width: '540px',
          maxWidth: '92vw',
          height: '100vh',
          background: '#FFFFFF',
          boxShadow: '-6px 0 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            background: '#16263F',
            color: '#FFFFFF',
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#E2B53C" />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 750,
                  color: '#E2B53C',
                  letterSpacing: '0.08em',
                  fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                GENERATE TO CALENDAR
              </span>
            </div>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 700,
                margin: '4px 0 0 0',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              Transform Output into Owned Work
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ background: '#F4F6FA', padding: '10px 24px', borderBottom: '1px solid #D9DFE9', fontSize: '12px', color: '#5A6478' }}>
          <strong>Rule:</strong> Nothing is created until you confirm below. Private by default.
        </div>

        {errorMessage && (
          <div style={{ background: '#FEE2E2', borderBottom: '1px solid #EF4444', padding: '10px 24px', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
              CHOOSE EXTRACTION SCOPE
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {['EVERYTHING', 'TASK', 'EVENT', 'MILESTONE', 'REVIEW', 'TIMELINE'].map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSelectedOption(opt.toLowerCase())}
                  style={{
                    background: selectedOption === opt.toLowerCase() ? '#E2B53C' : '#F4F6FA',
                    color: '#16263F',
                    border: '1px solid #D9DFE9',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 650,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
                PROPOSED ITEMS ({items.length})
              </label>
              <span style={{ fontSize: '11px', color: '#BC8A1C', fontWeight: 600 }}>
                Gaps flagged in gold
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {items.map((it, idx) => {
                const isUndated = !it.due_date;
                const isUnowned = !it.owner?.name;
                return (
                  <div
                    key={idx}
                    style={{
                      background: '#FFFFFF',
                      border: `1px solid ${isUndated || isUnowned ? '#E2B53C' : '#D9DFE9'}`,
                      borderLeft: `4px solid ${isUndated || isUnowned ? '#E2B53C' : '#16263F'}`,
                      borderRadius: '4px',
                      padding: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#BC8A1C',
                          fontFamily: 'IBM Plex Mono, monospace',
                        }}
                      >
                        {it.reference} · {it.type.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '11px', color: '#5A6478', fontFamily: 'IBM Plex Mono, monospace' }}>
                        Source: {sourceReference}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#16263F', marginTop: '4px' }}>
                      {it.title}
                    </div>

                    <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={13} color={isUnowned ? '#BC8A1C' : '#5A6478'} />
                        <span style={{ color: isUnowned ? '#BC8A1C' : '#16263F', fontWeight: isUnowned ? 700 : 500 }}>
                          {it.owner?.name || 'NO OWNER'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} color={isUndated ? '#BC8A1C' : '#5A6478'} />
                        <span style={{ color: isUndated ? '#BC8A1C' : '#16263F', fontWeight: isUndated ? 700 : 500 }}>
                          {it.due_date || 'NO DATE'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #D9DFE9',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {completedGeneration ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16263F', fontSize: '13px', fontWeight: 600 }}>
                <Check size={18} color="#16a34a" />
                <span>Generated {items.length} items to your calendar.</span>
              </div>
              {undoSecondsLeft > 0 && (
                <button
                  onClick={handleUndo}
                  style={{
                    background: '#F4F6FA',
                    color: '#BC8A1C',
                    border: '1px solid #E2B53C',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 650,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <RotateCcw size={14} />
                  <span>Undo ({undoSecondsLeft}s)</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#F4F6FA',
                  border: '1px solid #D9DFE9',
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  color: '#16263F',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={handleConfirmGenerate}
                style={{
                  background: '#16263F',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 650,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={16} color="#E2B53C" />
                <span>{generating ? 'Generating...' : `Confirm & Create ${items.length} Items`}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
