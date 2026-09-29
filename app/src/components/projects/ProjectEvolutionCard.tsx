import React from 'react';
import { ProjectEvolutionMetrics } from '../../lib/intelligence/projectEvolution';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

interface ProjectEvolutionCardProps {
  metrics: ProjectEvolutionMetrics;
}

export const ProjectEvolutionCard: React.FC<ProjectEvolutionCardProps> = ({
  metrics,
}) => {
  const {
    currentStage,
    stages,
    scheduleStatus,
    statusLabel,
    statusColor,
    totalActions,
    completedActions,
    overdueActions,
    openActions,
    completionRate,
    nearestDeadline,
    summaryNarrative,
  } = metrics;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(22, 38, 63, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(226, 181, 60, 0.35)',
        padding: '22px 26px',
        marginBottom: '28px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative Gold Accent Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #E2B53C 0%, #BC8A1C 50%, #21395C 100%)',
        }}
      />

      {/* Header: Stage Badge, Schedule Status Pill, Quick Stats */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 750,
                color: '#E2B53C',
                letterSpacing: '0.08em',
                fontFamily: 'IBM Plex Mono, monospace',
                background: 'rgba(226, 181, 60, 0.12)',
                padding: '3px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(226, 181, 60, 0.3)',
              }}
            >
              PROJECT EVOLUTION & STAGES
            </span>

            {/* Schedule Status Tag: On Track vs Behind Deadline */}
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: statusColor,
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}44`,
                padding: '3px 10px',
                borderRadius: '12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {scheduleStatus === 'behind_deadline' ? (
                <AlertCircle size={12} color={statusColor} />
              ) : scheduleStatus === 'at_risk' ? (
                <AlertTriangle size={12} color={statusColor} />
              ) : (
                <CheckCircle2 size={12} color={statusColor} />
              )}
              <span>{statusLabel}</span>
            </span>
          </div>

          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#F8FAFC',
              margin: '4px 0 0 0',
              fontFamily: 'Poppins, sans-serif',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <span>{currentStage.name}</span>
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '0.86rem', margin: '6px 0 0 0', maxWidth: '780px' }}>
            {summaryNarrative}
          </p>
        </div>

        {/* Action Performance Badges */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'rgba(9, 14, 26, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 16px',
              textAlign: 'center',
              minWidth: '100px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>ACTION PROGRESS</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F8FAFC', marginTop: '2px' }}>
              {completedActions} / {totalActions}
            </div>
            <div style={{ fontSize: '10px', color: '#E2B53C', fontWeight: 600 }}>{completionRate}% Complete</div>
          </div>

          <div
            style={{
              background: 'rgba(9, 14, 26, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '10px 16px',
              textAlign: 'center',
              minWidth: '110px',
            }}
          >
            <div style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>NEXT DEADLINE</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: overdueActions > 0 ? '#EF4444' : '#F8FAFC', marginTop: '2px' }}>
              {nearestDeadline || (overdueActions > 0 ? `${overdueActions} Overdue` : 'All Completed')}
            </div>
            <div style={{ fontSize: '10px', color: overdueActions > 0 ? '#EF4444' : '#10B981', fontWeight: 600 }}>
              {overdueActions > 0 ? 'Behind Deadline' : openActions > 0 ? `${openActions} Open Actions` : 'Clear Schedule'}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive 6-Stage Timeline Stepper */}
      <div
        style={{
          background: 'rgba(9, 14, 26, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '8px',
          padding: '16px 20px',
          marginTop: '16px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '8px',
          }}
        >
          {stages.map((stage) => {
            const isCompleted = stage.status === 'completed';
            const isActive = stage.status === 'active';

            return (
              <div
                key={stage.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: isActive
                    ? 'rgba(226, 181, 60, 0.12)'
                    : isCompleted
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isActive
                    ? '1px solid #E2B53C'
                    : isCompleted
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 750,
                      color: isActive ? '#E2B53C' : isCompleted ? '#10B981' : '#64748B',
                      fontFamily: 'IBM Plex Mono, monospace',
                    }}
                  >
                    STAGE {stage.stageNumber}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 size={13} color="#10B981" />
                  ) : isActive ? (
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#E2B53C',
                        boxShadow: '0 0 6px #E2B53C',
                      }}
                    />
                  ) : (
                    <Clock size={12} color="#64748B" />
                  )}
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 650,
                    color: isActive ? '#F8FAFC' : isCompleted ? '#CBD5E1' : '#64748B',
                  }}
                >
                  {stage.shortLabel}
                </div>

                {/* Micro Progress Bar */}
                <div
                  style={{
                    height: '3px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: '2px',
                    marginTop: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${stage.completionPercentage}%`,
                      background: isCompleted ? '#10B981' : '#E2B53C',
                      borderRadius: '2px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
