import React, { useEffect, useState } from 'react';
import { WorkflowBuildEvent } from '../../lib/workflows/schemas';
import { Check, Clock } from 'lucide-react';

export interface BuildProgressListProps {
  events: WorkflowBuildEvent[];
  brief: string;
  onFinish?: () => void;
}

interface ProgressLine {
  id: string;
  text: string;
  status: 'done' | 'current' | 'failed';
}

export const BuildProgressList: React.FC<BuildProgressListProps> = ({
  events,
  brief,
  onFinish,
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(1);

  // Map events to user-facing lines per 4.2 table
  const lines: ProgressLine[] = events.map((ev, i) => {
    let text = 'Processing request...';
    const type = ev.type;
    if (type === 'request.interpreted') {
      text = 'Understood what you want';
    } else if (type === 'trigger.selected') {
      text = 'Added the starting point';
    } else if (type === 'node.added') {
      text = `Added: ${ev.payload?.step?.displayName || ev.payload?.step?.name || 'workflow step'}`;
    } else if (type === 'approval.added') {
      text = 'Added a sign-off before anything leaves Concludo';
    } else if (type === 'connection.required') {
      const app = ev.payload?.application || 'App';
      text = `${app} needs connecting`;
    } else if (type === 'validation.started') {
      text = 'Checking it is safe to run';
    } else if (type === 'validation.completed') {
      text = 'Ready for your review';
    } else if (type === 'validation.failed') {
      text = 'Found something to fix';
    } else if (type === 'question.required') {
      text = ev.payload?.question || 'Clarification needed';
    }

    return {
      id: `${type}-${i}`,
      text,
      status: 'done',
    };
  });

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReducedMotion || lines.length <= 1) {
      setVisibleCount(lines.length);
      onFinish && onFinish();
      return;
    }

    const timer = setInterval(() => {
      setVisibleCount((prev) => {
        if (prev < lines.length) {
          return prev + 1;
        } else {
          clearInterval(timer);
          onFinish && onFinish();
          return prev;
        }
      });
    }, 250);

    return () => clearInterval(timer);
  }, [lines.length, prefersReducedMotion]);

  return (
    <div
      className="wb-build-progress-list"
      aria-live="polite"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Brief Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--navy2)',
          borderRadius: '8px',
          padding: '12px 14px',
        }}
      >
        <span
          style={{
            fontSize: '10.5px',
            fontFamily: 'var(--font-m)',
            color: 'var(--sub)',
            textTransform: 'uppercase',
            display: 'block',
            marginBottom: '4px',
          }}
        >
          Your Brief
        </span>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--light)', fontStyle: 'italic', lineHeight: 1.4 }}>
          &ldquo;{brief}&rdquo;
        </p>
      </div>

      {/* Progress Items */}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {lines.slice(0, visibleCount).map((line, idx) => {
          const isLatest = idx === visibleCount - 1 && visibleCount < lines.length;

          return (
            <li
              key={line.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '12.5px',
                color: 'var(--light)',
                fontFamily: 'var(--font-b)',
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: isLatest ? 'rgba(226, 181, 60, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {isLatest ? (
                  <Clock size={11} color="var(--gold)" />
                ) : (
                  <Check size={11} color="var(--ok)" />
                )}
              </div>
              <span>{line.text}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
