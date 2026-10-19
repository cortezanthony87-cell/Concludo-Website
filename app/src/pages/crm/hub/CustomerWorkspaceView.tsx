import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import { HUB_CUSTOMER_ORG, HUB_MESSAGES } from '../../../lib/crm/hub/data';
import { getRecordTimeline, verifyTimelineOrder } from '../../../lib/crm/hub/timeline';
import { CommTimelineItem, CommTimelineItemType } from '../../../lib/crm/hub/types';

interface CustomerWorkspaceViewProps {
  onOpenRoom: (roomId: string) => void;
}

export const CustomerWorkspaceView: React.FC<CustomerWorkspaceViewProps> = ({ onOpenRoom }) => {
  const [activeTab, setActiveTab] = useState<string>('Timeline');
  const [timelineFilter, setTimelineFilter] = useState<CommTimelineItemType | 'all'>('all');

  const tabs = [
    'Overview',
    'Timeline',
    'Email',
    'Messages',
    'Meetings',
    'Files',
    'Projects',
    'Tasks',
    'People',
    'Opportunities',
    'Service',
  ];

  // Unified timeline items strictly ordered newest first by event time
  const timelineItems: CommTimelineItem[] = getRecordTimeline(HUB_CUSTOMER_ORG.id, timelineFilter);
  const isOrderValid = verifyTimelineOrder(timelineItems);

  return (
    <div className="hub-centre">
      {/* Workspace Top Header */}
      <div style={{ background: 'var(--hub-white)', borderBottom: '1px solid var(--hub-hair)', padding: '16px 22px 0' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
          <div className="hub-tlitem-icon" style={{ width: '42px', height: '42px', fontSize: '18px', background: '#E8EDF5' }}>
            <Icons.Building2 size={22} color="var(--hub-navy2)" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--hub-ink)' }}>
                {HUB_CUSTOMER_ORG.name}
              </h2>
              <span className="hub-demo-badge" style={{ fontSize: '10px', padding: '1px 6px' }}>
                Screen S09
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--hub-slate)', marginTop: '2px' }}>
              {HUB_CUSTOMER_ORG.industry} · {HUB_CUSTOMER_ORG.location} · Record owner {HUB_CUSTOMER_ORG.recordOwner} · Customer since {HUB_CUSTOMER_ORG.customerSince}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button
              className="hub-btn-out"
              onClick={() => setActiveTab('Email')}
              aria-label="Email Northbridge"
            >
              <Icons.Mail size={14} />
              Email
            </button>
            <button
              className="hub-btn-out"
              onClick={() => onOpenRoom('room-northbridge-account')}
              aria-label="Open record room"
            >
              <Icons.MessageSquare size={14} />
              Message
            </button>
            <button
              className="hub-btn-out"
              onClick={() => setActiveTab('Files')}
              aria-label="Documents"
            >
              <Icons.FileText size={14} />
              Documents
            </button>
          </div>
        </div>

        {/* 11 Tabs Navigation */}
        <div className="hub-tabs-row" style={{ marginTop: '14px', padding: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`hub-tab-btn ${activeTab === tab ? 'active' : ''}`}
            >
              {tab}
              {tab === 'Files' && <span style={{ marginLeft: '4px', fontSize: '10.5px', color: 'var(--hub-slate)' }}>3</span>}
              {tab === 'Tasks' && <span style={{ marginLeft: '4px', fontSize: '10.5px', color: 'var(--hub-slate)' }}>1</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content Areas */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* 1. Overview Tab */}
        {activeTab === 'Overview' && (
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="hub-card">
              <h4>About Northbridge Industrial</h4>
              <p style={{ fontSize: '13px', color: '#22324B', margin: 0, lineHeight: 1.5 }}>
                {HUB_CUSTOMER_ORG.description}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--hub-hair)' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--hub-slate)', textTransform: 'uppercase', fontWeight: 600 }}>Active proposal</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>Operations review, phase 2 ($94,000)</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--hub-slate)', textTransform: 'uppercase', fontWeight: 600 }}>Account team</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>Maya Chen, Tom Reyes</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--hub-slate)', textTransform: 'uppercase', fontWeight: 600 }}>Next board date</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>6 November 2026</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Timeline Tab (Screen S10) */}
        {activeTab === 'Timeline' && (
          <div className="hub-feed">
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
              <button
                onClick={() => setTimelineFilter('all')}
                className={`hub-chip ${timelineFilter === 'all' ? 'gold' : 'light'}`}
              >
                All
              </button>
              <button
                onClick={() => setTimelineFilter('email')}
                className={`hub-chip ${timelineFilter === 'email' ? 'gold' : 'light'}`}
              >
                Emails
              </button>
              <button
                onClick={() => setTimelineFilter('message')}
                className={`hub-chip ${timelineFilter === 'message' ? 'gold' : 'light'}`}
              >
                Messages
              </button>
              <button
                onClick={() => setTimelineFilter('meeting')}
                className={`hub-chip ${timelineFilter === 'meeting' ? 'gold' : 'light'}`}
              >
                Meetings
              </button>
              <button
                onClick={() => setTimelineFilter('file_shared')}
                className={`hub-chip ${timelineFilter === 'file_shared' ? 'gold' : 'light'}`}
              >
                Files
              </button>
              <button
                onClick={() => setTimelineFilter('task')}
                className={`hub-chip ${timelineFilter === 'task' ? 'gold' : 'light'}`}
              >
                Tasks and commitments
              </button>
              <button
                onClick={() => setTimelineFilter('ai_proposal')}
                className={`hub-chip ${timelineFilter === 'ai_proposal' ? 'gold' : 'light'}`}
              >
                AI proposals
              </button>
              <span style={{ marginLeft: 'auto', fontSize: '11.5px', color: 'var(--hub-slate)' }}>
                Screen S10: {timelineItems.length} items · Newest first {isOrderValid ? '(verified)' : ''}
              </span>
            </div>

            {/* Timeline Items grouped by date */}
            <div className="hub-daysep">Today</div>
            {timelineItems
              .filter((item) => item.dateGroup === 'Today')
              .map((item) => (
                <div key={item.id} className="hub-tlitem">
                  <div className="hub-tlitem-time">{item.timeLabel}</div>
                  <div className="hub-tlitem-icon">
                    {item.itemType === 'email' && <Icons.Mail size={14} />}
                    {item.itemType === 'file_shared' && <Icons.FileText size={14} />}
                    {item.itemType === 'task' && <Icons.CheckSquare size={14} />}
                    {item.itemType === 'meeting' && <Icons.Calendar size={14} />}
                    {item.itemType === 'ai_proposal' && <Icons.Sparkles size={14} />}
                  </div>
                  <div className={`hub-tlitem-card ${item.hasLeftGoldRule ? 'has-gold-rule' : ''}`}>
                    <div className="hub-tlitem-header">
                      <span>{item.title}</span>
                      {item.stateTag && (
                        <span className={`hub-state ${item.stateTag.tone === 'open' ? 'hub-st-open' : 'hub-st-stated'}`}>
                          {item.stateTag.label}
                        </span>
                      )}
                      <span className="hub-tlitem-src">{item.sourceLabel}</span>
                    </div>
                    {item.summary && <div className="hub-tlitem-desc">{item.summary}</div>}
                  </div>
                </div>
              ))}

            <div className="hub-daysep">Earlier this month</div>
            {timelineItems
              .filter((item) => item.dateGroup === 'Earlier this month')
              .map((item) => (
                <div key={item.id} className="hub-tlitem">
                  <div className="hub-tlitem-time">{item.timeLabel}</div>
                  <div className="hub-tlitem-icon">
                    {item.itemType === 'email' && <Icons.Mail size={14} />}
                    {item.itemType === 'file_shared' && <Icons.FileText size={14} />}
                    {item.itemType === 'task' && <Icons.CheckSquare size={14} />}
                    {item.itemType === 'meeting' && <Icons.Calendar size={14} />}
                    {item.itemType === 'ai_proposal' && <Icons.Sparkles size={14} />}
                  </div>
                  <div className="hub-tlitem-card">
                    <div className="hub-tlitem-header">
                      <span>{item.title}</span>
                      {item.stateTag && (
                        <span className={`hub-state ${item.stateTag.tone === 'open' ? 'hub-st-open' : 'hub-st-stated'}`}>
                          {item.stateTag.label}
                        </span>
                      )}
                      <span className="hub-tlitem-src">{item.sourceLabel}</span>
                    </div>
                    {item.summary && <div className="hub-tlitem-desc">{item.summary}</div>}
                  </div>
                </div>
              ))}

            <div className="hub-daysep">Last month</div>
            {timelineItems
              .filter((item) => item.dateGroup === 'Last month')
              .map((item) => (
                <div key={item.id} className="hub-tlitem">
                  <div className="hub-tlitem-time">{item.timeLabel}</div>
                  <div className="hub-tlitem-icon">
                    <Icons.Calendar size={14} />
                  </div>
                  <div className="hub-tlitem-card">
                    <div className="hub-tlitem-header">
                      <span>{item.title}</span>
                      <span className="hub-tlitem-src">{item.sourceLabel}</span>
                    </div>
                    {item.summary && <div className="hub-tlitem-desc">{item.summary}</div>}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* 3. Email Tab (Honest R0 Empty State) */}
        {activeTab === 'Email' && (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <div className="hub-card" style={{ maxWidth: '520px', margin: '20px auto', textAlign: 'left' }}>
              <h4>Email integration</h4>
              <p style={{ fontSize: '13px', color: '#33435C', lineHeight: 1.5 }}>
                Direct mailbox connection ships in Release 2 following Microsoft publisher verification.
              </p>
              <div style={{ background: '#FAFBFD', border: '1px solid var(--hub-hair)', borderRadius: '6px', padding: '10px 12px', marginTop: '10px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--hub-slate)', textTransform: 'uppercase' }}>Recorded reference</div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, marginTop: '2px' }}>Email received from Daniel Okafor (21 Oct 11:48 am)</div>
                <div style={{ fontSize: '12px', color: '#33435C', marginTop: '2px' }}>Subject: Revised scope query regarding procurement timeline and payment terms.</div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Messages Tab */}
        {activeTab === 'Messages' && (
          <div style={{ padding: '20px 22px' }}>
            <div className="hub-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>Northbridge account room</h4>
                  <div style={{ fontSize: '12px', color: 'var(--hub-slate)', marginTop: '2px' }}>
                    Internal collaboration between Maya Chen and Tom Reyes
                  </div>
                </div>
                <button
                  className="hub-btn-navy"
                  onClick={() => onOpenRoom('room-northbridge-account')}
                >
                  Open record room
                </button>
              </div>
              <div style={{ marginTop: '12px', borderTop: '1px solid var(--hub-hair)', paddingTop: '10px' }}>
                <div style={{ fontSize: '12px', color: '#22324B' }}>
                  Latest: {HUB_MESSAGES[HUB_MESSAGES.length - 1]?.body}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. Meetings Tab */}
        {activeTab === 'Meetings' && (
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="hub-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Operating model session</span>
                <span style={{ fontSize: '11px', color: 'var(--hub-slate)' }}>14 Oct 2026 (52 min)</span>
              </div>
              <div style={{ fontSize: '12px', color: '#33435C', marginTop: '4px' }}>
                3 decisions recorded, 5 actions assigned, 1 open question on payment terms. Decision log produced and approved.
              </div>
            </div>
            <div className="hub-card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Preliminary diagnostic debrief</span>
                <span style={{ fontSize: '11px', color: 'var(--hub-slate)' }}>28 Sep 2026 (35 min)</span>
              </div>
              <div style={{ fontSize: '12px', color: '#33435C', marginTop: '4px' }}>
                Reviewed plant floor bottlenecks and agreed scope for site walk-through.
              </div>
            </div>
          </div>
        )}

        {/* 6. Files Tab */}
        {activeTab === 'Files' && (
          <div style={{ padding: '20px 22px' }}>
            <div className="hub-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#FAFBFD', borderBottom: '1px solid var(--hub-hair)', textAlign: 'left', color: 'var(--hub-slate)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 14px' }}>Document name</th>
                    <th style={{ padding: '10px 14px' }}>Linked to</th>
                    <th style={{ padding: '10px 14px' }}>Access</th>
                    <th style={{ padding: '10px 14px' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #EEF1F6' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>Decision log, operating model session.pdf</td>
                    <td style={{ padding: '10px 14px' }}>Phase 2 review</td>
                    <td style={{ padding: '10px 14px' }}><span className="hub-state hub-st-open">Internal review</span></td>
                    <td style={{ padding: '10px 14px', color: 'var(--hub-slate)' }}>21 Oct</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #EEF1F6' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>Revised scope draft.docx</td>
                    <td style={{ padding: '10px 14px' }}>Phase 2 review</td>
                    <td style={{ padding: '10px 14px' }}><span className="hub-state hub-st-mut">Drafting</span></td>
                    <td style={{ padding: '10px 14px', color: 'var(--hub-slate)' }}>Today</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>Site data, two sites.xlsx</td>
                    <td style={{ padding: '10px 14px' }}>Phase 2 review</td>
                    <td style={{ padding: '10px 14px' }}><span className="hub-state hub-st-open">Verified</span></td>
                    <td style={{ padding: '10px 14px', color: 'var(--hub-slate)' }}>17 Oct</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. Projects Tab (Honest Empty State) */}
        {activeTab === 'Projects' && (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--hub-slate)' }}>
            <Icons.FolderGit2 size={32} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--hub-ink)' }}>No delivery projects linked</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>Delivery projects commence once the Phase 2 proposal is formally accepted.</div>
          </div>
        )}

        {/* 8. Tasks Tab */}
        {activeTab === 'Tasks' && (
          <div style={{ padding: '20px 22px' }}>
            <div className="hub-card rule">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>Draft revised scope for Northbridge Industrial</span>
                <span className="hub-state hub-st-open">Due 30 Oct</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--hub-slate)', marginTop: '4px' }}>
                Assigned to Tom Reyes. Includes two sites, procurement timeline, and decision log summary.
              </div>
            </div>
          </div>
        )}

        {/* 9. People Tab */}
        {activeTab === 'People' && (
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="hub-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="hub-avatar x">PN</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Priya Nair</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--hub-slate)' }}>Head of Operations, Northbridge Industrial (Primary contact)</div>
                </div>
              </div>
            </div>
            <div className="hub-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="hub-avatar x">DO</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>Daniel Okafor</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--hub-slate)' }}>Procurement Lead, Northbridge Industrial (Stakeholder)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 10. Opportunities Tab */}
        {activeTab === 'Opportunities' && (
          <div style={{ padding: '20px 22px' }}>
            <div className="hub-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '13.5px' }}>Operations review, phase 2</span>
                <span className="hub-state hub-st-open">Proposal</span>
              </div>
              <div style={{ fontSize: '12px', color: '#33435C', marginTop: '6px' }}>
                Scope covers process modernisation and bottleneck elimination across two plant facilities.
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '12px', color: 'var(--hub-slate)' }}>
                <span>Value: $94,000 AUD</span>
                <span>Probability: 65%</span>
                <span>Target close: November 2026</span>
              </div>
            </div>
          </div>
        )}

        {/* 11. Service Tab (Honest Empty State) */}
        {activeTab === 'Service' && (
          <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--hub-slate)' }}>
            <Icons.LifeBuoy size={32} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--hub-ink)' }}>No service cases recorded</div>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>Service request logging is available for ongoing maintenance accounts.</div>
          </div>
        )}
      </div>
    </div>
  );
};
