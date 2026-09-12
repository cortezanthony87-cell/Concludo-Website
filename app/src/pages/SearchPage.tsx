import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  FolderKanban,
  FileText,
  Calendar,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Loader2,
  Sparkles,
  Lock,
  Filter,
  BrainCircuit,
  CheckSquare,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { useFeatureAccess } from '../lib/permissions/usePermissions';
import {
  searchMeetingHistory,
  SearchResultItem,
  SearchFilterOptions,
  SearchRecordType,
} from '../lib/search/searchClient';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { supabase, profile } = useAuth();
  const featureAccess = useFeatureAccess('keyword_search');

  const initialQuery = searchParams.get('q') || '';
  const initialType = (searchParams.get('type') as any) || 'all';

  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [executedQuery, setExecutedQuery] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState<'all' | 'projects' | 'outputs' | 'decisions' | 'actions'>(initialType);

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false);
  const [clientFilter, setClientFilter] = useState(searchParams.get('client') || '');
  const [projectFilter, setProjectFilter] = useState(searchParams.get('project') || '');
  const [meetingTypeFilter, setMeetingTypeFilter] = useState(searchParams.get('meetingType') || '');
  const [startDateFilter, setStartDateFilter] = useState(searchParams.get('startDate') || '');
  const [endDateFilter, setEndDateFilter] = useState(searchParams.get('endDate') || '');

  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(
    async (queryText: string, customType = typeFilter) => {
      const q = queryText.trim();
      setExecutedQuery(q);

      if (!q) {
        setResults([]);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const filterOpts: SearchFilterOptions = {
        typeFilter: customType,
        clientName: clientFilter.trim() || undefined,
        projectName: projectFilter.trim() || undefined,
        meetingType: meetingTypeFilter.trim() || undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
      };

      const { data, error: searchErr } = await searchMeetingHistory(supabase, q, filterOpts);

      if (searchErr) {
        setError(searchErr.message || 'Failed to load search results');
        setResults([]);
      } else {
        setResults(data || []);
      }
      setLoading(false);
    },
    [supabase, typeFilter, clientFilter, projectFilter, meetingTypeFilter, startDateFilter, endDateFilter]
  );

  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q && featureAccess.isAllowed) {
      performSearch(q);
    }
  }, [searchParams, featureAccess.isAllowed, performSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearchParams(val.trim() ? { q: val.trim() } : {});
      performSearch(val);
    }, 350);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setSearchParams(searchTerm.trim() ? { q: searchTerm.trim() } : {});
    performSearch(searchTerm);
  };

  const handleTypeChange = (newType: 'all' | 'projects' | 'outputs' | 'decisions' | 'actions') => {
    setTypeFilter(newType);
    if (searchTerm.trim()) {
      performSearch(searchTerm, newType);
    }
  };

  const handleClearFilters = () => {
    setClientFilter('');
    setProjectFilter('');
    setMeetingTypeFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setTypeFilter('all');
    if (searchTerm.trim()) {
      performSearch(searchTerm, 'all');
    }
  };

  const handleRetry = () => {
    performSearch(searchTerm);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No date recorded';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getRecordBadge = (type: SearchRecordType) => {
    switch (type) {
      case 'Project':
        return {
          icon: <FolderKanban size={13} />,
          bg: 'rgba(33, 57, 92, 0.45)',
          color: '#93c5fd',
          border: 'rgba(147, 197, 253, 0.3)',
        };
      case 'Output':
        return {
          icon: <FileText size={13} />,
          bg: 'rgba(226, 181, 60, 0.15)',
          color: '#e2b53c',
          border: 'rgba(226, 181, 60, 0.3)',
        };
      case 'Decision':
        return {
          icon: <BrainCircuit size={13} />,
          bg: 'rgba(168, 85, 247, 0.15)',
          color: '#c084fc',
          border: 'rgba(192, 132, 252, 0.3)',
        };
      case 'Action':
        return {
          icon: <CheckSquare size={13} />,
          bg: 'rgba(34, 197, 94, 0.15)',
          color: '#4ade80',
          border: 'rgba(74, 222, 128, 0.3)',
        };
    }
  };

  // If user lacks permission: Show "Available on Pro" and prevent access
  if (!featureAccess.isAllowed) {
    return (
      <div className="workspace-page-container">
        <div className="page-header-row" style={{ marginBottom: '24px' }}>
          <div>
            <div className="page-breadcrumbs">
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-active">Search</span>
            </div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Search size={26} color="#e2b53c" />
              <span>Keyword Search</span>
            </h1>
            <p className="page-subtitle">Search across your projects, transcripts, decisions, and action items.</p>
          </div>
        </div>

        <div
          className="content-card"
          style={{
            textAlign: 'center',
            padding: '72px 32px',
            backgroundColor: '#16263f',
            borderRadius: '16px',
            border: '1px solid rgba(226, 181, 60, 0.25)',
          }}
        >
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '16px',
              backgroundColor: 'rgba(226, 181, 60, 0.12)',
              border: '1px solid rgba(226, 181, 60, 0.35)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              color: '#e2b53c',
            }}
          >
            <Lock size={32} />
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '20px',
              backgroundColor: 'rgba(226, 181, 60, 0.2)',
              color: '#f3c958',
              fontSize: '0.82rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '14px',
              border: '1px solid rgba(226, 181, 60, 0.4)',
            }}
          >
            Available on Pro
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 600, color: '#f8fafc', marginBottom: '10px' }}>
            Keyword Search is a Pro Feature
          </h2>
          <p
            style={{
              color: '#94a3b8',
              maxWidth: '520px',
              margin: '0 auto 24px',
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}
          >
            Upgrade your Concludo plan to search historical meeting transcripts, indexed decisions, and cross-meeting
            action trackers with relevance ranking.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/dashboard')}
            style={{ padding: '10px 24px', fontSize: '0.92rem' }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-page-container">
      {/* Page Header */}
      <div className="page-header-row" style={{ marginBottom: '24px' }}>
        <div>
          <div className="page-breadcrumbs">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-active">Search</span>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Search size={26} color="#e2b53c" />
            <span>Search Meeting History</span>
          </h1>
          <p className="page-subtitle">
            Search across your saved project titles, client names, transcripts, decisions, and action items.
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleFormSubmit} style={{ marginBottom: '16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#16263f',
            border: '1px solid rgba(226, 181, 60, 0.25)',
            borderRadius: '10px',
            padding: '8px 16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          }}
        >
          <Search size={20} color="#e2b53c" style={{ flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by keyword, client, transcript, decisions, or actions..."
            value={searchTerm}
            onChange={handleInputChange}
            aria-label="Search meeting history"
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '0.98rem',
              outline: 'none',
              padding: '8px 0',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSearchParams({});
                performSearch('');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.85rem',
                padding: '4px 8px',
              }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              fontSize: '0.85rem',
              backgroundColor: showFilters ? 'rgba(226, 181, 60, 0.15)' : undefined,
              borderColor: showFilters ? '#e2b53c' : undefined,
            }}
          >
            <Filter size={14} color={showFilters ? '#e2b53c' : undefined} />
            <span>Filters</span>
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{
              padding: '8px 18px',
              fontSize: '0.9rem',
              fontWeight: 600,
            }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Record Type Filter Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        {(
          [
            { key: 'all', label: 'All Records' },
            { key: 'projects', label: 'Projects' },
            { key: 'outputs', label: 'Outputs' },
            { key: 'decisions', label: 'Decisions' },
            { key: 'actions', label: 'Actions' },
          ] as const
        ).map((tab) => {
          const isActive = typeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTypeChange(tab.key)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: isActive ? '1px solid #e2b53c' : '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: isActive ? 'rgba(226, 181, 60, 0.18)' : '#16263f',
                color: isActive ? '#f3c958' : '#94a3b8',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Advanced Filter Drawer */}
      {showFilters && (
        <div
          style={{
            backgroundColor: '#16263f',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
              Client Name
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Corp"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
              Project Name
            </label>
            <input
              type="text"
              placeholder="e.g. Strategic Plan"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
              Meeting Type
            </label>
            <input
              type="text"
              placeholder="e.g. Discovery, Board"
              value={meetingTypeFilter}
              onChange={(e) => setMeetingTypeFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
              From Date
            </label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
              To Date
            </label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '6px 10px',
                color: '#f8fafc',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => performSearch(searchTerm)}
              style={{ padding: '6px 14px', fontSize: '0.85rem', flex: 1 }}
            >
              Apply Filters
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClearFilters}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
              title="Clear all filters"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div
          className="loading-container"
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#16263f',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Loader2 size={32} className="spin-animation" color="#e2b53c" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', marginBottom: '6px' }}>Loading search results</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Searching your meeting history, decisions, and action items...
          </p>
        </div>
      )}

      {/* Error State with required retry support */}
      {!loading && error && (
        <div
          className="error-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={22} color="#f87171" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#f87171', fontSize: '0.95rem' }}>Failed to load search results</div>
              <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '2px' }}>{error}</div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.85rem',
            }}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Initial state (no search executed yet) */}
      {!loading && !error && !executedQuery && (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            backgroundColor: '#16263f',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(226, 181, 60, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <Sparkles size={28} color="#e2b53c" />
          </div>
          <h2 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: 600, marginBottom: '8px' }}>
            Search your meeting archive
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '520px', margin: '0 auto 20px' }}>
            Enter client names, project names, transcript quotes, decisions, or tracked action items.
          </p>
        </div>
      )}

      {/* Empty State when search returns 0 results */}
      {!loading && !error && executedQuery && results.length === 0 && (
        <div
          style={{
            padding: '60px 24px',
            textAlign: 'center',
            backgroundColor: '#16263f',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Search size={36} color="#64748b" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ color: '#f8fafc', fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
            No results found
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto' }}>
            Try a different keyword or broader search.
          </p>
        </div>
      )}

      {/* Results List */}
      {!loading && !error && results.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              padding: '0 4px',
            }}
          >
            <span style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
              Found {results.length} matching {results.length === 1 ? 'result' : 'results'} for{' '}
              <strong style={{ color: '#f8fafc' }}>"{executedQuery}"</strong>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {results.map((item) => {
              const badge = getRecordBadge(item.recordType);

              const handleOpen = () => {
                if (item.recordType === 'Decision') {
                  navigate(`/decision-memory/${item.recordId}`);
                } else if (item.recordType === 'Action') {
                  navigate(`/actions/${item.recordId}`);
                } else {
                  navigate(`/projects/${item.projectId}`);
                }
              };

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: '#16263f',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '10px',
                    padding: '20px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '20px',
                    transition: 'border-color 0.15s ease',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.icon}
                        <span>{item.recordType}</span>
                      </span>

                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: '#cbd5e1',
                        }}
                      >
                        {item.matchField}
                      </span>

                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: '#94a3b8',
                          fontSize: '0.8rem',
                        }}
                      >
                        <Calendar size={13} />
                        {formatDate(item.date)}
                      </span>

                      <span
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: '#64748b',
                          fontSize: '0.78rem',
                        }}
                      >
                        <Clock size={12} />
                        Updated {formatDate(item.updatedAt)}
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        marginBottom: '8px',
                      }}
                    >
                      {item.projectTitle}
                    </h3>

                    <div
                      style={{
                        color: '#cbd5e1',
                        fontSize: '0.88rem',
                        lineHeight: '1.5',
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        borderLeft: '3px solid #e2b53c',
                        wordBreak: 'break-word',
                      }}
                    >
                      {item.preview}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleOpen}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      fontSize: '0.85rem',
                      flexShrink: 0,
                    }}
                    title="Open Record"
                  >
                    <span>Open</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
