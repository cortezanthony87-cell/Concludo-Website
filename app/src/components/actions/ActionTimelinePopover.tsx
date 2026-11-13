import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SupabaseClient } from '@supabase/supabase-js';
import { ActionRecord } from '../../lib/actions/types';
import {
  buildTimelinePayloadFromActions,
  buildTimelineFileName,
  formatTimelineDate,
  renderTimelinePptx,
  exportSanitizedPptxBlob,
  saveTimelineToProject,
  TimelineSaveResult,
  logTimelineExportEvent,
} from '../../lib/outputs/timeline';

export interface ActionTimelinePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  actions: ActionRecord[];
  viewName: string;
  filterDescription?: string;
  supabase: SupabaseClient;
  userId?: string;
  canExportTimeline: boolean;
  onOpenProject?: (projectId: string) => void;
  onShowToast: (toast: {
    message: string;
    actionText?: string;
    onAction?: () => void;
    secondaryActionText?: string;
    onSecondaryAction?: () => void;
  } | string) => void;
}

export const ActionTimelinePopover: React.FC<ActionTimelinePopoverProps> = ({
  isOpen,
  onClose,
  triggerRef,
  actions,
  viewName,
  filterDescription,
  supabase,
  userId,
  canExportTimeline,
  onOpenProject,
  onShowToast,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildingAction, setBuildingAction] = useState<'download' | 'save' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number;
    bottom?: number;
    right?: number;
    caretRight?: number;
    isAbove?: boolean;
    isMobile?: boolean;
  }>({});

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      setPopoverCoords({ isMobile: true });
      return;
    }

    const popoverWidth = 380;
    const popoverEstimatedHeight = 360;
    const spaceBelow = window.innerHeight - rect.bottom;
    const isAbove = spaceBelow < popoverEstimatedHeight && rect.top > popoverEstimatedHeight;

    const rightPos = Math.max(16, window.innerWidth - rect.right);
    const triggerCenter = rect.left + rect.width / 2;
    const caretRight = Math.max(20, Math.min(popoverWidth - 20, window.innerWidth - rightPos - triggerCenter));

    if (isAbove) {
      setPopoverCoords({
        bottom: window.innerHeight - rect.top + 8,
        right: rightPos,
        caretRight,
        isAbove: true,
        isMobile: false,
      });
    } else {
      setPopoverCoords({
        top: rect.bottom + 8,
        right: rightPos,
        caretRight,
        isAbove: false,
        isMobile: false,
      });
    }
  }, [triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen, updatePosition]);

  // Available projects for saving
  const [projectOptions, setProjectOptions] = useState<{ id: string; title: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Load user's projects when popover opens
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function loadProjects() {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('id, title, project_name')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (!error && data && isMounted) {
          const mapped = data.map((p: any) => ({
            id: p.id,
            title: p.title || p.project_name || 'Untitled project',
          }));
          setProjectOptions(mapped);

          // Default selected project to current view's project if all actions share one
          const actionProjectIds = Array.from(new Set(actions.map((a) => a.project_id).filter(Boolean)));
          if (actionProjectIds.length === 1 && actionProjectIds[0]) {
            setSelectedProjectId(actionProjectIds[0] as string);
          } else if (mapped.length > 0) {
            setSelectedProjectId(mapped[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to load projects for timeline popover:', err);
      }
    }

    loadProjects();
    return () => {
      isMounted = false;
    };
  }, [isOpen, supabase, actions]);

  // Date range computation
  const dateRangeStr = useMemo(() => {
    const datedActions = actions
      .filter((a) => a.due_date && !a.archived_at)
      .sort((x, y) => (x.due_date || '').localeCompare(y.due_date || ''));

    if (datedActions.length === 0) {
      return 'No dated actions in view';
    }
    const first = datedActions[0].due_date!.slice(0, 10);
    const last = datedActions[datedActions.length - 1].due_date!.slice(0, 10);
    const firstYear = first.slice(0, 4);
    const lastYear = last.slice(0, 4);
    if (first === last) {
      return `${formatTimelineDate(first, false)} ${firstYear}`;
    }
    if (firstYear === lastYear) {
      return `${formatTimelineDate(first, false)} to ${formatTimelineDate(last, false)} ${firstYear}`;
    }
    return `${formatTimelineDate(first, false)} ${firstYear} to ${formatTimelineDate(last, false)} ${lastYear}`;
  }, [actions]);

  // Resolved single project title or multiple
  const distinctProjectTitles = useMemo(() => {
    return Array.from(
      new Set(actions.map((a) => a.projects?.title || a.projects?.project_name).filter(Boolean))
    ) as string[];
  }, [actions]);

  // Single shared project title if exists
  const singleProjectTitle = distinctProjectTitles.length === 1 ? distinctProjectTitles[0] : null;

  // Keyboard handling (Escape to close, return focus to trigger)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        triggerRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const activeActionCount = actions.filter((a) => !a.archived_at).length;

  const handleDownload = async () => {
    if (isBuilding || activeActionCount === 0) return;
    if (!canExportTimeline) {
      onShowToast('Timeline PowerPoint is included in Pro.');
      return;
    }

    setIsBuilding(true);
    setBuildingAction('download');
    setErrorMessage(null);

    try {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const payload = buildTimelinePayloadFromActions(actions, {
        viewName,
        filterDescription: filterDescription || 'all statuses',
        projectName: singleProjectTitle || 'Action Command Hub',
      });

      const { pptx, slideCount } = await renderTimelinePptx(PptxGenJS, payload);
      const fileName = buildTimelineFileName(payload.project, payload.exportedOn);

      // Generate sanitized blob in browser with strict OpenXML package validation
      const blobData = await exportSanitizedPptxBlob(pptx);
      const url = URL.createObjectURL(blobData);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (userId) {
        await logTimelineExportEvent(supabase, {
          userId,
          projectIdOrView: singleProjectTitle || viewName,
          actionCount: activeActionCount,
          slideCount,
          method: 'download',
          outcome: 'success',
        });
      }

      onShowToast(`Downloaded ${fileName}`);
      onClose();
      triggerRef.current?.focus();
    } catch (err: any) {
      console.error('Download timeline error:', err);
      const errText = err?.message || 'Failed to generate PowerPoint file';
      setErrorMessage(errText);
      if (userId) {
        await logTimelineExportEvent(supabase, {
          userId,
          projectIdOrView: singleProjectTitle || viewName,
          actionCount: activeActionCount,
          slideCount: 6,
          method: 'download',
          outcome: 'failure',
          errorMessage: errText,
        });
      }
    } finally {
      setIsBuilding(false);
      setBuildingAction(null);
    }
  };

  const handleSaveToProject = async () => {
    if (isBuilding || activeActionCount === 0) return;
    if (!canExportTimeline) {
      onShowToast('Timeline PowerPoint is included in Pro.');
      return;
    }

    const targetProjectId = selectedProjectId || projectOptions[0]?.id;
    if (!targetProjectId) {
      setErrorMessage('Please select a project to save the timeline to.');
      return;
    }

    const targetProjectTitle =
      projectOptions.find((p) => p.id === targetProjectId)?.title || singleProjectTitle || 'Project';

    setIsBuilding(true);
    setBuildingAction('save');
    setErrorMessage(null);

    try {
      const { default: PptxGenJS } = await import('pptxgenjs');
      const payload = buildTimelinePayloadFromActions(actions, {
        viewName,
        filterDescription: filterDescription || 'all statuses',
        projectName: targetProjectTitle,
      });

      const { pptx, slideCount } = await renderTimelinePptx(PptxGenJS, payload);
      const blobData = await exportSanitizedPptxBlob(pptx);

      const res: TimelineSaveResult = await saveTimelineToProject(
        supabase,
        targetProjectId,
        payload,
        blobData,
        slideCount
      );

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to save timeline to project.');
        return;
      }

      // Verified write succeeded - show toast with Open project and Download actions
      onShowToast({
        message: `Timeline saved to ${targetProjectTitle}`,
        actionText: 'Open project',
        onAction: () => {
          if (onOpenProject) {
            onOpenProject(targetProjectId);
          } else {
            window.location.href = `/projects/${targetProjectId}`;
          }
        },
        secondaryActionText: 'Download',
        onSecondaryAction: () => {
          const url = URL.createObjectURL(blobData);
          const a = document.createElement('a');
          a.href = url;
          a.download = res.fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        },
      });

      onClose();
      triggerRef.current?.focus();
    } catch (err: any) {
      console.error('Save timeline error:', err);
      setErrorMessage(err?.message || 'Failed to save timeline to project');
    } finally {
      setIsBuilding(false);
      setBuildingAction(null);
    }
  };

  const content = (
    <>
      {popoverCoords.isMobile && (
        <div
          className="ach-timeline-backdrop"
          onClick={onClose}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(22, 38, 63, 0.45)',
            zIndex: 9998,
          }}
        />
      )}
    <div
      ref={panelRef}
      className="ach-timeline-popover"
      role="dialog"
      aria-label="Timeline PowerPoint"
      tabIndex={-1}
      style={popoverCoords.isMobile ? {
        position: 'fixed',
        bottom: '20px',
        left: '12px',
        right: '12px',
        width: 'auto',
        maxWidth: 'calc(100vw - 24px)',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 20px 48px rgba(22, 38, 63, 0.28)',
        border: '1px solid #DCE2EC',
        padding: '20px 22px',
        zIndex: 10000,
        textAlign: 'left',
        fontFamily: 'Inter, system-ui, sans-serif',
      } : {
        position: 'fixed',
        top: popoverCoords.top !== undefined ? `${popoverCoords.top}px` : undefined,
        bottom: popoverCoords.bottom !== undefined ? `${popoverCoords.bottom}px` : undefined,
        right: popoverCoords.right !== undefined ? `${popoverCoords.right}px` : '16px',
        width: '380px',
        maxWidth: 'calc(100vw - 32px)',
        background: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 16px 40px rgba(22, 38, 63, 0.20), 0 2px 10px rgba(22, 38, 63, 0.08)',
        border: '1px solid #DCE2EC',
        padding: '20px 22px',
        zIndex: 10000,
        textAlign: 'left',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Caret pointing to button */}
      {!popoverCoords.isMobile && (
      <div
        style={{
          position: 'absolute',
          ...(popoverCoords.isAbove
            ? {
                bottom: '-6px',
                borderBottom: '1px solid #DCE2EC',
                borderRight: '1px solid #DCE2EC',
                borderTop: 'none',
                borderLeft: 'none',
              }
            : {
                top: '-6px',
                borderTop: '1px solid #DCE2EC',
                borderLeft: '1px solid #DCE2EC',
                borderBottom: 'none',
                borderRight: 'none',
              }),
          right: `${popoverCoords.caretRight ?? 48}px`,
          width: '12px',
          height: '12px',
          background: '#FFFFFF',
          transform: 'rotate(45deg)',
        }}
      />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#16263F' }}>
          Timeline PowerPoint
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          style={{
            background: 'none',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            color: '#8A98AD',
            padding: '2px 6px',
            lineHeight: 1,
          }}
        >
          &times;
        </button>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#5A6478', lineHeight: 1.45 }}>
        Builds a six-slide timeline from the actions in your current view and filters.
      </p>

      {errorMessage && (
        <div
          style={{
            background: '#FDF2F2',
            border: '1px solid #E04F5F',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '12px',
            color: '#B4303E',
            marginBottom: '14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#B4303E', cursor: 'pointer', fontWeight: 600 }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Info Rows */}
      <div style={{ borderTop: '1px solid #E4E8EF', borderBottom: '1px solid #E4E8EF', padding: '10px 0', fontSize: '12.5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <span style={{ color: '#5A6478' }}>Actions included</span>
          <span style={{ fontWeight: 600, color: '#16263F' }}>
            {activeActionCount} ({viewName}, {filterDescription || 'all statuses'})
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <span style={{ color: '#5A6478' }}>Date range</span>
          <span style={{ fontWeight: 600, color: '#16263F' }}>{dateRangeStr}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
          <span style={{ color: '#5A6478' }}>Project</span>
          {singleProjectTitle ? (
            <span
              style={{
                fontWeight: 600,
                color: '#16263F',
                maxWidth: '220px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={singleProjectTitle}
            >
              {singleProjectTitle}
            </span>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              aria-label="Select target project"
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: '6px',
                border: '1px solid #DCE2EC',
                background: '#FFFFFF',
                color: '#16263F',
                maxWidth: '220px',
                fontWeight: 500,
              }}
            >
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Buttons */}
      {!canExportTimeline && (
        <div
          style={{
            background: '#FBF3DC',
            border: '1px solid #E2B53C',
            borderRadius: '6px',
            padding: '8px 12px',
            marginTop: '12px',
            fontSize: '12px',
            color: '#8A610A',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 500,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Timeline PowerPoint is included in Pro.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button
          type="button"
          onClick={handleSaveToProject}
          disabled={isBuilding || activeActionCount === 0 || !canExportTimeline}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: isBuilding && buildingAction === 'save' ? '#D4A832' : '#E2B53C',
            color: '#16263F',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: isBuilding || activeActionCount === 0 || !canExportTimeline ? 'not-allowed' : 'pointer',
            opacity: !canExportTimeline ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background 0.15s ease',
          }}
        >
          {isBuilding && buildingAction === 'save' ? 'Saving...' : 'Save to project'}
        </button>

        <button
          type="button"
          onClick={handleDownload}
          disabled={isBuilding || activeActionCount === 0 || !canExportTimeline}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: '#FFFFFF',
            color: '#16263F',
            border: '1px solid #DCE2EC',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: isBuilding || activeActionCount === 0 || !canExportTimeline ? 'not-allowed' : 'pointer',
            opacity: !canExportTimeline ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'background 0.15s ease',
          }}
        >
          {isBuilding && buildingAction === 'download' ? 'Building...' : 'Download .pptx'}
        </button>
      </div>

      <div style={{ fontSize: '11px', color: '#8A98AD', marginTop: '12px' }}>
        Check owners and dates before you share it. Windows tip: if Protected View appears, right-click file, select Properties, and click Unblock.
      </div>
    </div>
    </>
  );

  return createPortal(content, document.body);
};
