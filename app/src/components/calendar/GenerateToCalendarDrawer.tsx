import React, { useState, useEffect } from 'react';
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
  const [statusFilter, setStatusFilter] = useState<'all' | 'open_only' | 'completed_only'>('all');
  const [items, setItems] = useState<GenerateCalendarPayloadItem[]>(initialItems);

  const [existingItems, setExistingItems] = useState<Array<{ id: string; reference: string | null; title: string; status: string; type: string }>>([]);
  const [scanning, setScanning] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [completedGeneration, setCompletedGeneration] = useState<boolean>(false);
  const [generationSummary, setGenerationSummary] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [generationId, setGenerationId] = useState<string>('');
  const [undoSecondsLeft, setUndoSecondsLeft] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper function to normalise title for deduplication comparison
  const normalizeText = (t: string | null | undefined): string => {
    return (t || '')
      .toLowerCase()
      .replace(/^(?:act|dec|rsk|evt|task|action|decision|risk|event|meeting)[-:\s\d]+/i, '')
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Synchronise items and pre-scan existing project calendar items whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setItems(initialItems);
      setCompletedGeneration(false);
      setErrorMessage(null);

      // Pre-scan existing calendar records for this project
      if (user && projectId) {
        setScanning(true);
        Promise.resolve(
          supabase.client
            .from('calendar_items')
            .select('id, reference, title, status, type')
            .eq('creator_id', user.id)
            .eq('project_id', projectId)
            .is('deleted_at', null)
        )
          .then(({ data }) => {
            if (data) {
              setExistingItems(data);
            }
            setScanning(false);
          })
          .catch(() => setScanning(false));
      } else {
        setExistingItems([]);
      }
    }
  }, [isOpen, initialItems, user, projectId]);

  if (!isOpen) return null;

  // Filter items based on selected extraction scope & status filter
  const filteredItems = items.filter((item) => {
    // Check matched existing status if present
    const refKey = item.reference ? item.reference.trim().toUpperCase() : null;
    const normTitle = normalizeText(item.title);
    const matched = existingItems.find((ex) => {
      const exRef = ex.reference ? ex.reference.trim().toUpperCase() : null;
      const exNorm = normalizeText(ex.title);
      return (refKey && exRef === refKey) || (normTitle && exNorm === normTitle);
    });

    const effectiveStatus = matched ? matched.status : (item.status || 'open');

    // Status filter: allow filtering by open only (not yet ticked off) or completed only
    if (statusFilter === 'open_only' && effectiveStatus === 'completed') return false;
    if (statusFilter === 'completed_only' && effectiveStatus !== 'completed') return false;

    if (selectedOption === 'everything') return true;
    if (selectedOption === 'task') return item.type === 'task';
    if (selectedOption === 'event') return item.type === 'event' || item.type === 'meeting';
    if (selectedOption === 'milestone') return item.type === 'milestone';
    if (selectedOption === 'review') return item.type === 'review';
    if (selectedOption === 'timeline') return item.type === 'timeline_activity' || item.type === 'milestone';
    return true;
  });

  // Calculate smart scan metrics for the currently filtered items
  const newItemsCount = filteredItems.filter((it) => {
    const refKey = it.reference ? it.reference.trim().toUpperCase() : null;
    const normTitle = normalizeText(it.title);
    return !existingItems.some((ex) => {
      const exRef = ex.reference ? ex.reference.trim().toUpperCase() : null;
      const exNorm = normalizeText(ex.title);
      return (refKey && exRef === refKey) || (normTitle && exNorm === normTitle);
    });
  }).length;

  const untickedActionsCount = filteredItems.filter((it) => {
    const isEvent = it.type === 'event' || it.type === 'meeting';
    const refKey = it.reference ? it.reference.trim().toUpperCase() : null;
    const normTitle = normalizeText(it.title);
    const matched = existingItems.find((ex) => {
      const exRef = ex.reference ? ex.reference.trim().toUpperCase() : null;
      const exNorm = normalizeText(ex.title);
      return (refKey && exRef === refKey) || (normTitle && exNorm === normTitle);
    });
    return matched && !isEvent && matched.type !== 'event' && matched.type !== 'meeting' && matched.status !== 'completed';
  }).length;

  const handleConfirmGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    setErrorMessage(null);

    const payload: GenerateCalendarPayload = {
      source: {
        type: 'report',
        id: outputId || projectId,
        title: outputTitle,
        occurred_at: occurredAt,
        record_reference: sourceReference,
        project_id: projectId,
        output_id: outputId || null,
      },
      options: [selectedOption as any],
      idempotency_key: `${outputId || projectId}_${Date.now()}`,
      items: filteredItems,
    };

    const res = await generateToCalendar(supabase.client, user.id, payload);
    setGenerating(false);

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    if (res.itemsCreated > 0 || res.itemsUpdated > 0) {
      setGenerationId(res.generationId);
      setGenerationSummary({ created: res.itemsCreated, updated: res.itemsUpdated, skipped: res.itemsSkipped });
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
    } else if (res.itemsSkipped > 0) {
      setGenerationSummary({ created: 0, updated: 0, skipped: res.itemsSkipped });
      setCompletedGeneration(true);
    } else {
      setErrorMessage('No items were generated. All items may already be on the calendar or no items were selected.');
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

        <div style={{ background: '#F4F6FA', padding: '10px 24px', borderBottom: '1px solid #D9DFE9', fontSize: '12px', color: '#5A6478', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Smart Scan Active:</strong> Scans existing project calendar items. Only new items are added; past actions remain if unticked.
          </div>
          {scanning && (
            <span style={{ fontSize: '11px', color: '#BC8A1C', fontWeight: 600 }}>
              Scanning calendar...
            </span>
          )}
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
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
              EXECUTION STATUS FILTER
            </label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              {[
                { id: 'all', label: 'All Items' },
                { id: 'open_only', label: 'Open Actions (Unticked)' },
                { id: 'completed_only', label: 'Completed Only' },
              ].map((filterOpt) => (
                <button
                  key={filterOpt.id}
                  onClick={() => setStatusFilter(filterOpt.id as any)}
                  style={{
                    background: statusFilter === filterOpt.id ? '#16263F' : '#F4F6FA',
                    color: statusFilter === filterOpt.id ? '#FFFFFF' : '#16263F',
                    border: '1px solid #D9DFE9',
                    borderRadius: '4px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: 650,
                    cursor: 'pointer',
                  }}
                >
                  {filterOpt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#5A6478', letterSpacing: '0.04em' }}>
                PROPOSED ITEMS ({filteredItems.length})
              </label>
              <span style={{ fontSize: '11px', color: '#BC8A1C', fontWeight: 600 }}>
                Gaps flagged in gold
              </span>
            </div>

            {filteredItems.length === 0 ? (
              <div
                style={{
                  background: '#F4F6FA',
                  border: '1px dashed #D9DFE9',
                  borderRadius: '6px',
                  padding: '24px',
                  textAlign: 'center',
                  color: '#5A6478',
                  fontSize: '13px',
                }}
              >
                No items match the selected extraction scope for this output.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredItems.map((it, idx) => {
                  const isUndated = !it.due_date;
                  const isUnowned = !it.owner?.name;
                  const isEvent = it.type === 'event' || it.type === 'meeting';

                  // Scan comparison against existing project calendar items
                  const refKey = it.reference ? it.reference.trim().toUpperCase() : null;
                  const normTitle = normalizeText(it.title);
                  const matchedExisting = existingItems.find((ex) => {
                    const exRef = ex.reference ? ex.reference.trim().toUpperCase() : null;
                    const exNorm = normalizeText(ex.title);
                    return (refKey && exRef === refKey) || (normTitle && exNorm === normTitle);
                  });

                  const isExistingEvent = matchedExisting && (isEvent || matchedExisting.type === 'event' || matchedExisting.type === 'meeting');
                  const isExistingActionCompleted = matchedExisting && !isExistingEvent && matchedExisting.status === 'completed';
                  const isExistingActionUnticked = matchedExisting && !isExistingEvent && matchedExisting.status !== 'completed';
                  const isNewItem = !matchedExisting;

                  return (
                    <div
                      key={idx}
                      style={{
                        background: isExistingActionCompleted ? '#F0FDF4' : isExistingEvent ? '#F8FAFC' : isExistingActionUnticked ? '#F8FAFC' : '#FFFFFF',
                        border: `1px solid ${isExistingActionCompleted ? '#BBF7D0' : isExistingEvent ? '#CBD5E1' : isExistingActionUnticked ? '#BFDBFE' : isUndated || isUnowned ? '#E2B53C' : '#D9DFE9'}`,
                        borderLeft: `4px solid ${isExistingActionCompleted ? '#10B981' : isExistingEvent ? '#16263F' : isExistingActionUnticked ? '#3B82F6' : isUndated || isUnowned ? '#E2B53C' : '#16263F'}`,
                        borderRadius: '4px',
                        padding: '12px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        opacity: isExistingActionCompleted || isExistingEvent ? 0.8 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: isEvent ? '#16263F' : '#BC8A1C',
                              fontFamily: 'IBM Plex Mono, monospace',
                            }}
                          >
                            {it.reference} · {isEvent ? 'EVENT / SESSION' : it.type.toUpperCase()}
                          </span>

                          {/* Pre-scan status badge distinguishing events vs action tasks */}
                          {isExistingEvent ? (
                            <span style={{ fontSize: '10px', background: 'rgba(22, 38, 63, 0.08)', color: '#16263F', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                              EVENT RECORDED (KEPT AS RECORD)
                            </span>
                          ) : isExistingActionCompleted ? (
                            <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.12)', color: '#047857', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                              COMPLETED ACTION (TASK ALREADY FINISHED)
                            </span>
                          ) : isExistingActionUnticked ? (
                            <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.12)', color: '#1D4ED8', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                              UNTICKED ACTION (TASK PENDING COMPLETION)
                            </span>
                          ) : (
                            <span style={{ fontSize: '10px', background: 'rgba(226, 181, 60, 0.15)', color: '#16263F', padding: '1px 6px', borderRadius: '3px', fontWeight: 700 }}>
                              NEW {isEvent ? 'EVENT' : 'ACTION'} (TO ADD)
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: '#5A6478', fontFamily: 'IBM Plex Mono, monospace' }}>
                          Source: {sourceReference}
                        </span>
                      </div>

                      <div style={{ fontSize: '14px', fontWeight: 650, color: '#16263F', marginTop: '4px' }}>
                        {it.title}
                      </div>

                      {/* Explicit lineage explanation */}
                      {isExistingEvent && (
                        <div style={{ fontSize: '11px', color: '#5A6478', marginTop: '3px', fontStyle: 'italic' }}>
                          Meeting/event record already on calendar. Preserved for record-keeping (will not duplicate).
                        </div>
                      )}
                      {isExistingActionUnticked && (
                        <div style={{ fontSize: '11px', color: '#1D4ED8', marginTop: '3px', fontStyle: 'italic' }}>
                          Action task from past output is still on calendar awaiting completion. Current unticked status preserved.
                        </div>
                      )}
                      {isExistingActionCompleted && (
                        <div style={{ fontSize: '11px', color: '#047857', marginTop: '3px', fontStyle: 'italic' }}>
                          Action task was completed on calendar. Skipped to prevent duplicate task.
                        </div>
                      )}

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
            )}
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
                <span>
                  {generationSummary
                    ? `Calendar synchronized: ${generationSummary.created} new added, ${generationSummary.updated} unticked actions preserved, ${generationSummary.skipped} existing records kept.`
                    : `Generated ${filteredItems.length} items to your calendar.`}
                </span>
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
                disabled={generating || filteredItems.length === 0}
                onClick={handleConfirmGenerate}
                style={{
                  background: filteredItems.length === 0 ? '#94A3B8' : '#16263F',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 650,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: filteredItems.length === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                <Sparkles size={16} color="#E2B53C" />
                <span>
                  {generating
                    ? 'Generating...'
                    : newItemsCount > 0
                    ? `Confirm & Add ${newItemsCount} New ${newItemsCount === 1 ? 'Item' : 'Items'}${untickedActionsCount > 0 ? ` (${untickedActionsCount} unticked preserved)` : ''}`
                    : untickedActionsCount > 0
                    ? `Synchronize Project (${untickedActionsCount} Unticked Actions Preserved)`
                    : 'All Items Already on Calendar'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
