import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Search,
  Plus,
  Trash2,
  Edit2,
  Bookmark,
  BookmarkPlus,
  BrainCircuit,
  FolderKanban,
  CheckSquare,
  AlertTriangle,
  Compass,
  Database,
  Shield,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Archive,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowRight,
  SlidersHorizontal,
  Bot,
  Layers,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  AssistantType,
  CopilotConfidenceLevel,
  CopilotConversation,
  CopilotMessage,
  CopilotPrompt,
  CopilotResponse,
  PromptCategory,
  PromptScope,
} from '../../lib/copilot/types';
import { CopilotClient } from '../../lib/copilot/copilotClient';
import { Link } from 'react-router-dom';

const ASSISTANT_OPTIONS: Array<{
  id: AssistantType;
  label: string;
  icon: any;
  description: string;
}> = [
  { id: 'copilot', label: 'All Assistants', icon: Sparkles, description: 'Unified intelligence query across all organizational domains.' },
  { id: 'decision_assistant', label: 'Decision Assistant', icon: BrainCircuit, description: 'Trace decision lineage, approvals, rationale, and impact.' },
  { id: 'project_assistant', label: 'Project Assistant', icon: FolderKanban, description: 'Monitor deliverables, milestones, and connected initiatives.' },
  { id: 'action_assistant', label: 'Action Assistant', icon: CheckSquare, description: 'Track overdue actions, blockers, workloads, and accountability.' },
  { id: 'risk_assistant', label: 'Risk Assistant', icon: AlertTriangle, description: 'Detect recurring risks, delivery bottlenecks, and project drift.' },
  { id: 'executive_assistant', label: 'Executive Assistant', icon: Compass, description: 'Strategic overview, board briefings, and organizational health.' },
  { id: 'knowledge_assistant', label: 'Knowledge Assistant', icon: Database, description: 'Explore organizational memory, lessons learned, and knowledge graph.' },
];

const SUGGESTED_QUESTIONS = [
  {
    category: 'Decisions',
    query: 'What decisions did we make about Project Atlas and who approved them?',
    assistant: 'decision_assistant' as AssistantType,
  },
  {
    category: 'Actions',
    query: 'What actions are overdue across the workspace and who owns them?',
    assistant: 'action_assistant' as AssistantType,
  },
  {
    category: 'Risks',
    query: 'Which projects have recurring delivery risks and timeline bottlenecks?',
    assistant: 'risk_assistant' as AssistantType,
  },
  {
    category: 'Strategy',
    query: 'Summarize organizational health and key leadership focus areas.',
    assistant: 'executive_assistant' as AssistantType,
  },
  {
    category: 'Memory',
    query: 'What lessons have we learned from past transformation initiatives?',
    assistant: 'knowledge_assistant' as AssistantType,
  },
  {
    category: 'Timeline',
    query: 'What chronological progression of events occurred between January and March?',
    assistant: 'copilot' as AssistantType,
  },
];

export const CopilotPage: React.FC = () => {
  const { user, profile, supabase } = useAuth();

  // State
  const [client, setClient] = useState<CopilotClient | null>(null);
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<CopilotConversation | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [prompts, setPrompts] = useState<CopilotPrompt[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<AssistantType>('copilot');

  // Input & search
  const [inputQuery, setInputQuery] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [selectedPromptCategory, setSelectedPromptCategory] = useState<string>('all');

  // Loading & error states
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [processingState, setProcessingState] = useState<string | null>(null); // 'Thinking', 'Searching Knowledge', etc.
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);

  // Modals & explainability toggles
  const [expandedExplainMap, setExpandedExplainMap] = useState<Record<string, boolean>>({});
  const [savePromptModalOpen, setSavePromptModalOpen] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptText, setPromptText] = useState('');
  const [promptCategory, setPromptCategory] = useState<PromptCategory>('general');
  const [promptScope, setPromptScope] = useState<PromptScope>('personal');
  const [renamingConvId, setRenamingConvId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Client
  useEffect(() => {
    if (!user || !supabase) return;
    const copilotClient = new CopilotClient({
      supabase,
      userId: user.id,
      organizationId: (profile as any)?.organization_id || null,
      teamId: (profile as any)?.team_id || null,
    });
    setClient(copilotClient);
  }, [user, profile, supabase]);

  // Load Conversations and Prompts
  useEffect(() => {
    if (!client) return;
    loadConversations();
    loadPrompts();
  }, [client]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, processingState]);

  const loadConversations = async () => {
    if (!client) return;
    try {
      setLoadingConversations(true);
      const data = await client.listConversations();
      setConversations(data);
      if (data.length > 0 && !activeConversation) {
        selectConversation(data[0]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load conversations');
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadPrompts = async () => {
    if (!client) return;
    try {
      const data = await client.listPrompts();
      setPrompts(data);
    } catch (err: any) {
      console.error('Failed to load prompts:', err);
    }
  };

  const selectConversation = async (conv: CopilotConversation) => {
    if (!client) return;
    try {
      setActiveConversation(conv);
      setLoadingMessages(true);
      setErrorMessage(null);
      const msgs = await client.getMessages(conv.id);
      setMessages(msgs);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load conversation messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleStartNewConversation = async () => {
    if (!client) return;
    try {
      setActiveConversation(null);
      setMessages([]);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start new conversation');
    }
  };

  const handleSendMessage = async (queryToSend?: string) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || !client || processingState) return;

    setInputQuery('');
    setErrorMessage(null);
    setLastFailedQuery(text);

    // Progressive loading states
    setProcessingState('Thinking...');
    const t1 = setTimeout(() => setProcessingState('Searching Knowledge...'), 600);
    const t2 = setTimeout(() => setProcessingState('Analyzing Decisions & Retrieving Evidence...'), 1200);
    const t3 = setTimeout(() => setProcessingState('Generating Grounded Answer...'), 1800);

    try {
      const result = await client.ask({
        query: text,
        conversationId: activeConversation?.id || null,
        assistantType: selectedAssistant !== 'copilot' ? selectedAssistant : undefined,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      if (!activeConversation) {
        setActiveConversation(result.conversation);
        setConversations((prev) => [result.conversation, ...prev]);
      }

      setMessages((prev) => [...prev, result.userMessage, result.assistantMessage]);
      setLastFailedQuery(null);
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setErrorMessage(err.message || 'Failed to generate answer. Please try again.');
    } finally {
      setProcessingState(null);
    }
  };

  const handleRetry = () => {
    if (lastFailedQuery) {
      handleSendMessage(lastFailedQuery);
    }
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    if (!confirm('Are you sure you want to delete this conversation? (Retained for 30 days under retention policy)')) {
      return;
    }
    try {
      await client.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete conversation');
    }
  };

  const handleSavePrompt = async () => {
    if (!client || !promptTitle.trim() || !promptText.trim()) return;
    try {
      setProcessingState('Saving Prompt...');
      const newPrompt = await client.savePrompt(promptTitle.trim(), promptText.trim(), promptCategory, promptScope);
      setPrompts((prev) => [newPrompt, ...prev]);
      setSavePromptModalOpen(false);
      setPromptTitle('');
      setPromptText('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save prompt');
    } finally {
      setProcessingState(null);
    }
  };

  const handleDeletePrompt = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!client) return;
    try {
      await client.deletePrompt(id);
      setPrompts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete prompt');
    }
  };

  const handleRenameConversation = async (id: string) => {
    if (!client || !renameTitle.trim()) return;
    try {
      const updated = await client.renameConversation(id, renameTitle.trim());
      setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
      if (activeConversation?.id === id) {
        setActiveConversation(updated);
      }
      setRenamingConvId(null);
      setRenameTitle('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to rename conversation');
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(conversationSearch.toLowerCase())
  );

  const filteredPrompts = prompts.filter((p) => {
    if (selectedPromptCategory !== 'all' && p.category !== selectedPromptCategory) return false;
    return true;
  });

  const getConfidenceBadgeColor = (level: CopilotConfidenceLevel) => {
    switch (level) {
      case 'very_high':
        return { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: '#22c55e' };
      case 'high':
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: '#3b82f6' };
      case 'moderate':
        return { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', border: '#eab308' };
      case 'low':
      default:
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '#ef4444' };
    }
  };

  const formatConfidenceLabel = (level: CopilotConfidenceLevel) => {
    switch (level) {
      case 'very_high':
        return 'Very High Confidence';
      case 'high':
        return 'High Confidence';
      case 'moderate':
        return 'Moderate Confidence';
      case 'low':
      default:
        return 'Low Confidence';
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)', background: '#0a0f1d', color: '#f8fafc', overflow: 'hidden' }}>
      {/* LEFT SIDEBAR: Conversations & Saved Prompts */}
      <div
        style={{
          width: '320px',
          background: '#0d1527',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1e293b' }}>
          <button
            onClick={handleStartNewConversation}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'linear-gradient(135deg, #e2b53c 0%, #bc8a1c 100%)',
              color: '#0f172a',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(226, 181, 60, 0.25)',
            }}
          >
            <Plus size={16} />
            <span>New Conversation</span>
          </button>

          {/* Search Conversations */}
          <div style={{ marginTop: '12px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search conversations..."
              value={conversationSearch}
              onChange={(e) => setConversationSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 32px',
                background: '#162238',
                border: '1px solid #27354f',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Conversations List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', padding: '0 8px 8px' }}>
            Recent Conversations
          </div>

          {loadingConversations ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
              <RotateCw size={16} className="spin-animation" style={{ marginBottom: '6px' }} />
              <div>Loading Conversations...</div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
              No conversations found.
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = activeConversation?.id === conv.id;
              const isRenaming = renamingConvId === conv.id;

              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    background: isActive ? '#1e293b' : 'transparent',
                    border: isActive ? '1px solid #334155' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isRenaming ? (
                    <div style={{ display: 'flex', width: '100%', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        autoFocus
                        style={{
                          flex: 1,
                          background: '#0f172a',
                          border: '1px solid #e2b53c',
                          color: '#fff',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '0.82rem',
                        }}
                      />
                      <button
                        onClick={() => handleRenameConversation(conv.id)}
                        style={{ background: '#e2b53c', color: '#000', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 500, color: isActive ? '#f8fafc' : '#cbd5e1' }}>
                          {conv.title}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                          {new Date(conv.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                        <button
                          title="Rename"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingConvId(conv.id);
                            setRenameTitle(conv.title);
                          }}
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          title="Delete"
                          onClick={(e) => handleDeleteConversation(conv.id, e)}
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}

          {/* Saved Prompts Section */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #1e293b', paddingTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 8px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                Saved Prompts
              </span>
              <button
                onClick={() => {
                  setPromptText(inputQuery);
                  setSavePromptModalOpen(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#e2b53c',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                <BookmarkPlus size={13} />
                <span>Save</span>
              </button>
            </div>

            {filteredPrompts.slice(0, 5).map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setInputQuery(p.prompt_text);
                }}
                style={{
                  padding: '8px 10px',
                  background: '#162238',
                  borderRadius: '6px',
                  marginBottom: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  border: '1px solid #23334f',
                }}
              >
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2b53c' }}>{p.title}</div>
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.prompt_text}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeletePrompt(p.id, e)}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #1e293b', fontSize: '0.72rem', color: '#64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2b53c', fontWeight: 600, marginBottom: '2px' }}>
            <Shield size={12} />
            <span>Governed AI Intelligence</span>
          </div>
          <div>Human approval required for executions. Australian English.</div>
        </div>
      </div>

      {/* MAIN COPILOT CHAT AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0f1d' }}>
        {/* Top Bar: Assistant Selector and Header */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid #1e293b',
            background: '#0d1527',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #16263F 0%, #21395C 100%)',
                border: '1px solid #e2b53c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e2b53c',
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Concludo Copilot
                <span
                  style={{
                    fontSize: '0.65rem',
                    background: 'rgba(226, 181, 60, 0.15)',
                    color: '#e2b53c',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(226, 181, 60, 0.3)',
                    fontWeight: 600,
                  }}
                >
                  ENTERPRISE
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Natural Language Intelligence & Enterprise Decision Assistant
              </div>
            </div>
          </div>

          {/* Assistant Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Mode:</span>
            <select
              value={selectedAssistant}
              onChange={(e) => setSelectedAssistant(e.target.value as AssistantType)}
              style={{
                padding: '6px 12px',
                background: '#162238',
                border: '1px solid #2a3c5d',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.82rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {ASSISTANT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Chat Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Welcome Screen when no messages */}
          {messages.length === 0 && !processingState && (
            <div style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '36px 20px',
                  background: 'linear-gradient(180deg, rgba(22, 38, 63, 0.4) 0%, rgba(13, 21, 39, 0.2) 100%)',
                  borderRadius: '12px',
                  border: '1px solid rgba(226, 181, 60, 0.2)',
                  marginBottom: '28px',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '12px',
                    background: '#16263F',
                    border: '2px solid #e2b53c',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: '#e2b53c',
                    boxShadow: '0 4px 16px rgba(226, 181, 60, 0.2)',
                  }}
                >
                  <Sparkles size={28} />
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px', color: '#f8fafc' }}>
                  Ask Concludo Anything About Your Organization
                </h2>
                <p style={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: '600px', margin: '0 auto', lineHeight: '1.5' }}>
                  Concludo Copilot answers questions with evidence-based facts drawn directly from your projects, decisions, action tracker, transcripts, and organizational memory graph.
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2b53c', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>
                  Suggested Questions & Insights
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                  {SUGGESTED_QUESTIONS.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedAssistant(item.assistant);
                        handleSendMessage(item.query);
                      }}
                      style={{
                        padding: '14px',
                        background: '#0d1527',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#e2b53c';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#1e293b';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#e2b53c', fontWeight: 600 }}>{item.category}</span>
                        <ArrowRight size={13} color="#64748b" />
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.4' }}>{item.query}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capability highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    <BrainCircuit size={16} />
                    <span>Decision Memory</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Trace why decisions were approved and what outcomes resulted.
                  </div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    <AlertTriangle size={16} />
                    <span>Risk Detection</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Analyze repeated project delays and delivery bottlenecks.
                  </div>
                </div>

                <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', border: '1px solid #1e293b' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7', fontWeight: 600, fontSize: '0.82rem', marginBottom: '4px' }}>
                    <Database size={16} />
                    <span>Knowledge Graph</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Explore relationships and learned lessons across initiatives.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Render Conversation Turn Items */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const resp = (msg.response || {}) as CopilotResponse;
            const isExplainExpanded = expandedExplainMap[msg.id] || false;

            if (isUser) {
              return (
                <div
                  key={msg.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    maxWidth: '850px',
                    margin: '0 auto',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #16263F 0%, #21395C 100%)',
                      border: '1px solid #334d75',
                      padding: '12px 18px',
                      borderRadius: '12px 12px 2px 12px',
                      color: '#f8fafc',
                      fontSize: '0.92rem',
                      maxWidth: '75%',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                  >
                    {msg.message}
                  </div>
                </div>
              );
            }

            // Assistant Response
            const badgeStyle = getConfidenceBadgeColor(resp.confidence || 'high');

            return (
              <div
                key={msg.id || idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxWidth: '850px',
                  margin: '0 auto',
                  width: '100%',
                }}
              >
                {/* Main Answer Bubble */}
                <div
                  style={{
                    background: '#0d1527',
                    border: '1px solid #1e293b',
                    borderRadius: '12px 12px 12px 2px',
                    padding: '20px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  }}
                >
                  {/* Assistant Header / Confidence Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #1a253a', paddingBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sparkles size={16} color="#e2b53c" />
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2b53c' }}>
                        {resp.assistantType ? resp.assistantType.replace(/_/g, ' ').toUpperCase() : 'CONCLUDO COPILOT'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          background: badgeStyle.bg,
                          color: badgeStyle.text,
                          border: `1px solid ${badgeStyle.border}`,
                        }}
                      >
                        {formatConfidenceLabel(resp.confidence || 'high')} ({resp.confidenceScore || 85}%)
                      </span>
                    </div>
                  </div>

                  {/* Grounded Answer Content */}
                  <div
                    style={{
                      fontSize: '0.92rem',
                      lineHeight: '1.65',
                      color: '#f8fafc',
                      whiteSpace: 'pre-line',
                      marginBottom: '16px',
                    }}
                  >
                    {msg.message || resp.answer}
                  </div>

                  {/* Supporting Evidence Pills */}
                  {resp.supportingEvidence && resp.supportingEvidence.length > 0 && (
                    <div style={{ background: '#121c32', borderRadius: '8px', padding: '12px', marginBottom: '16px', border: '1px solid #1e2b45' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Supporting Evidence
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {resp.supportingEvidence.map((ev, eIdx) => (
                          <div key={eIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.8rem', color: '#cbd5e1' }}>
                            <CheckCircle2 size={13} color="#22c55e" style={{ marginTop: '3px', flexShrink: 0 }} />
                            <span>{ev}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Source Records Attribution */}
                  {resp.sourceRecords && resp.sourceRecords.length > 0 && (
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                        Retrieved Sources ({resp.sourceRecords.length})
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {resp.sourceRecords.map((rec, rIdx) => (
                          <div
                            key={rIdx}
                            style={{
                              padding: '4px 10px',
                              background: '#162238',
                              border: '1px solid #233452',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                            title={rec.snippet}
                          >
                            <span style={{ color: '#e2b53c', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.65rem' }}>
                              {rec.type}
                            </span>
                            <span style={{ color: '#e2e8f0' }}>{rec.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Execution Draft Card (If Requested) */}
                  {resp.executionDraft && (
                    <div
                      style={{
                        padding: '14px',
                        background: 'rgba(226, 181, 60, 0.08)',
                        border: '1px solid #e2b53c',
                        borderRadius: '8px',
                        marginBottom: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#e2b53c', fontSize: '0.85rem' }}>
                          <Shield size={16} />
                          <span>Action Staged: {resp.executionDraft.title}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: '#e2b53c', color: '#000', borderRadius: '4px', fontWeight: 700 }}>
                          APPROVAL REQUIRED
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginBottom: '10px' }}>
                        Autonomous execution without human oversight is prohibited. This draft is staged under governance controls.
                      </div>
                      <Link
                        to="/approvals"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: '#e2b53c',
                          color: '#0f172a',
                          borderRadius: '6px',
                          fontWeight: 600,
                          fontSize: '0.78rem',
                          textDecoration: 'none',
                        }}
                      >
                        <span>Review in Approval Center (/approvals)</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  )}

                  {/* Answer Explainability Toggle ("Why This Answer?") */}
                  <div style={{ borderTop: '1px solid #1a253a', paddingTop: '10px', marginTop: '10px' }}>
                    <button
                      onClick={() =>
                        setExpandedExplainMap((prev) => ({
                          ...prev,
                          [msg.id]: !prev[msg.id],
                        }))
                      }
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <HelpCircle size={13} color="#e2b53c" />
                      <span>Why This Answer? (Explainability & Reasoning Path)</span>
                      {isExplainExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>

                    {isExplainExpanded && (
                      <div style={{ marginTop: '10px', padding: '12px', background: '#0a0f1d', borderRadius: '6px', border: '1px solid #1e293b' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2b53c', marginBottom: '6px' }}>
                          Reasoning Path:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                          {(resp.reasoningPath || []).map((step, sIdx) => (
                            <div key={sIdx} style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              • {step}
                            </div>
                          ))}
                        </div>

                        {resp.knowledgeGraphConnections && resp.knowledgeGraphConnections.length > 0 && (
                          <>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2b53c', marginBottom: '6px' }}>
                              Knowledge Graph Connections:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {resp.knowledgeGraphConnections.map((conn, cIdx) => (
                                <div key={cIdx} style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                  <span style={{ color: '#38bdf8' }}>{conn.from}</span>
                                  <span style={{ color: '#94a3b8', margin: '0 6px' }}>—[{conn.relationship}]→</span>
                                  <span style={{ color: '#38bdf8' }}>{conn.to}</span>
                                  <span style={{ color: '#64748b', marginLeft: '6px' }}>({conn.confidence}%)</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggested Follow-Ups Pills */}
                {resp.suggestedFollowUps && resp.suggestedFollowUps.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingLeft: '8px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>Suggested:</span>
                    {resp.suggestedFollowUps.map((followUp, fIdx) => (
                      <button
                        key={fIdx}
                        onClick={() => handleSendMessage(followUp)}
                        style={{
                          background: 'rgba(22, 34, 56, 0.7)',
                          border: '1px solid #233452',
                          borderRadius: '14px',
                          padding: '4px 12px',
                          fontSize: '0.75rem',
                          color: '#cbd5e1',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#e2b53c';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#233452';
                          e.currentTarget.style.color = '#cbd5e1';
                        }}
                      >
                        <span>{followUp}</span>
                        <ArrowRight size={10} color="#e2b53c" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Processing / Loading State */}
          {processingState && (
            <div
              style={{
                maxWidth: '850px',
                margin: '0 auto',
                width: '100%',
                padding: '16px',
                background: '#0d1527',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <RotateCw size={18} className="spin-animation" color="#e2b53c" />
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e2b53c' }}>{processingState}</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Auditing workspace records without fabrication.
                </div>
              </div>
            </div>
          )}

          {/* Error Banner with Retry */}
          {errorMessage && (
            <div
              style={{
                maxWidth: '850px',
                margin: '0 auto',
                width: '100%',
                padding: '14px 18px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fca5a5', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} color="#ef4444" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={handleRetry}
                style={{
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{ padding: '16px 24px', background: '#0d1527', borderTop: '1px solid #1e293b' }}>
          <div style={{ maxWidth: '850px', margin: '0 auto', width: '100%' }}>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: '#162238',
                border: '1px solid #2a3c5d',
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <input
                type="text"
                placeholder={
                  selectedAssistant === 'copilot'
                    ? 'Ask Concludo about decisions, projects, actions, or risks...'
                    : `Ask ${ASSISTANT_OPTIONS.find((a) => a.id === selectedAssistant)?.label}...`
                }
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={Boolean(processingState)}
                style={{
                  flex: 1,
                  padding: '14px 18px',
                  background: 'transparent',
                  border: 'none',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '12px' }}>
                {inputQuery.trim() && (
                  <button
                    type="button"
                    title="Bookmark this prompt"
                    onClick={() => {
                      setPromptText(inputQuery);
                      setSavePromptModalOpen(true);
                    }}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <Bookmark size={16} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={!inputQuery.trim() || Boolean(processingState)}
                  style={{
                    padding: '8px 14px',
                    background: inputQuery.trim() && !processingState ? '#e2b53c' : '#334155',
                    color: inputQuery.trim() && !processingState ? '#0f172a' : '#64748b',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: inputQuery.trim() && !processingState ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>Send</span>
                  <Send size={14} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.72rem', color: '#64748b' }}>
              <span>Strictly grounded in workspace archives. No hallucinated records.</span>
              <span>Press Enter to send</span>
            </div>
          </div>
        </div>
      </div>

      {/* SAVE PROMPT MODAL */}
      {savePromptModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setSavePromptModalOpen(false)}
        >
          <div
            style={{
              width: '450px',
              background: '#0d1527',
              border: '1px solid #27354f',
              borderRadius: '10px',
              padding: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc', marginBottom: '14px' }}>
              Save Custom Prompt
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Title</label>
              <input
                type="text"
                placeholder="e.g. Atlas Decision Lineage"
                value={promptTitle}
                onChange={(e) => setPromptTitle(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: '#162238', border: '1px solid #27354f', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Prompt Text</label>
              <textarea
                rows={3}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', background: '#162238', border: '1px solid #27354f', borderRadius: '6px', color: '#fff', fontSize: '0.85rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Category</label>
                <select
                  value={promptCategory}
                  onChange={(e) => setPromptCategory(e.target.value as PromptCategory)}
                  style={{ width: '100%', padding: '8px', background: '#162238', border: '1px solid #27354f', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="general">General</option>
                  <option value="decisions">Decisions</option>
                  <option value="projects">Projects</option>
                  <option value="actions">Actions</option>
                  <option value="risks">Risks</option>
                  <option value="executive">Executive</option>
                  <option value="reports">Reports</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Scope</label>
                <select
                  value={promptScope}
                  onChange={(e) => setPromptScope(e.target.value as PromptScope)}
                  style={{ width: '100%', padding: '8px', background: '#162238', border: '1px solid #27354f', borderRadius: '6px', color: '#fff', fontSize: '0.82rem' }}
                >
                  <option value="personal">Personal</option>
                  <option value="team">Team</option>
                  <option value="organization">Organization</option>
                  <option value="executive">Executive</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setSavePromptModalOpen(false)}
                style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSavePrompt}
                disabled={!promptTitle.trim() || !promptText.trim()}
                style={{ padding: '6px 14px', background: '#e2b53c', border: 'none', color: '#0f172a', fontWeight: 600, borderRadius: '6px', cursor: 'pointer' }}
              >
                Save Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CopilotPage;
