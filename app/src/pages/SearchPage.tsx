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
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { searchMeetingHistory, SearchResultItem } from '../lib/search/searchClient';

export const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { supabase, user } = useAuth();

  const initialQuery = searchParams.get('q') || '';
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [executedQuery, setExecutedQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(
    async (queryText: string) => {
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

      const { data, error: searchErr } = await searchMeetingHistory(supabase, q);

      if (searchErr) {
        setError(searchErr.message || 'Search failed');
        setResults([]);
      } else {
        setResults(data || []);
      }
      setLoading(false);
    },
    [supabase]
  );

  // Sync with URL query on mount or param change
  useEffect(() => {
    const q = searchParams.get('q') || '';
    if (q !== searchTerm) {
      setSearchTerm(q);
    }
    if (q) {
      performSearch(q);
    }
  }, [searchParams, performSearch]);

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
            Search across your saved project titles, client names, transcripts, and generated outputs.
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleFormSubmit} style={{ marginBottom: '28px' }}>
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
            placeholder="Search by project title, client, transcript keywords, or output content..."
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
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Searching your meeting history and outputs...</p>
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
              <div style={{ fontWeight: 600, color: '#f87171', fontSize: '0.95rem' }}>
                Search failed
              </div>
              <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: '2px' }}>
                {error}
              </div>
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
            Enter client names, project names, or phrases from your transcripts and generated outputs.
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
            Try another search term.
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
              Found {results.length} matching {results.length === 1 ? 'item' : 'items'} for{' '}
              <strong style={{ color: '#f8fafc' }}>"{executedQuery}"</strong>
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {results.map((item) => (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(226, 181, 60, 0.15)',
                        color: '#e2b53c',
                        border: '1px solid rgba(226, 181, 60, 0.3)',
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
                  onClick={() => navigate(`/projects/${item.projectId}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '0.85rem',
                    flexShrink: 0,
                  }}
                  title="Open Project"
                >
                  <span>Open</span>
                  <ExternalLink size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
