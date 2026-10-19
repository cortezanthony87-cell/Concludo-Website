import React, { useState, useEffect } from 'react';
import * as Icons from 'lucide-react';
import { HUB_SEARCH_INDEX } from '../../../lib/crm/hub/data';
import { CommSearchResult } from '../../../lib/crm/hub/types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (result: CommSearchResult) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = ['All', 'Records', 'Record rooms', 'Timeline items'];

  const filteredResults = HUB_SEARCH_INDEX.filter((item) => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      q === '' ||
      item.title.toLowerCase().includes(q) ||
      item.snippet.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  return (
    <div className="hub-modal-overlay" onClick={onClose}>
      <div className="hub-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ background: 'var(--hub-navy)', color: '#FFFFFF', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icons.Search size={18} color="#C6D3E4" />
          <input
            type="text"
            autoFocus
            placeholder="Search records, record rooms, timeline items..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 0,
              color: '#FFFFFF',
              fontSize: '14px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 0, color: '#C6D3E4', cursor: 'pointer', padding: 4 }}
            aria-label="Close search"
          >
            <Icons.X size={18} />
          </button>
        </div>

        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--hub-hair)', display: 'flex', gap: '6px', background: '#FAFBFD' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`hub-chip ${selectedCategory === cat ? 'dark' : 'light'}`}
              style={{ border: '0', cursor: 'pointer' }}
            >
              {cat}
            </button>
          ))}
        </div>

        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px 10px' }}>
          {filteredResults.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--hub-slate)', fontSize: '13px' }}>
              No matching records, rooms, or items found.
            </div>
          ) : (
            filteredResults.map((result) => (
              <div
                key={result.id}
                onClick={() => {
                  onSelect(result);
                  onClose();
                }}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  marginBottom: '4px',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F4F9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--hub-open)', background: '#E7F0FA', padding: '1px 6px', borderRadius: '4px' }}>
                    {result.category}
                  </span>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--hub-ink)' }}>{result.title}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--hub-slate)', paddingLeft: '2px' }}>{result.snippet}</div>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '8px 18px', background: '#FAFBFD', borderTop: '1px solid var(--hub-hair)', fontSize: '11px', color: 'var(--hub-slate)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Screen S22: Instant search</span>
          <span>Synthetic demonstration index</span>
        </div>
      </div>
    </div>
  );
};
