import React, { useState, useEffect } from 'react';
import { WORKFLOW_TEMPLATES, WorkflowTemplateMeta } from '../../lib/workflows/templates';
import { useAuth } from '../../lib/auth/AuthContext';
import { isAnthonyOrAuthorizedTeam, verifyUserIsAuthorized, fetchPermanentTemplates } from '../../lib/workflows/permanentTemplates';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkflowTemplateMeta) => void;
}

const BASE_CATEGORIES = [
  'All',
  'Meetings',
  'Sales',
  'Customer onboarding',
  'Projects',
  'Documents',
  'Finance',
  'Compliance',
  'Operations',
  'Approvals',
  'Reporting',
  'AI',
  'Webhooks',
] as const;

export const TemplatePickerModal: React.FC<TemplatePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  const { user, profile } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => isAnthonyOrAuthorizedTeam(user, profile));
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [permanentTemplates, setPermanentTemplates] = useState<WorkflowTemplateMeta[]>([]);

  useEffect(() => {
    let isMounted = true;
    if (user) {
      verifyUserIsAuthorized(user).then((auth) => {
        if (isMounted) setIsAuthorized(auth);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (isOpen && isAuthorized) {
      fetchPermanentTemplates(user).then((tpls) => {
        setPermanentTemplates(tpls);
      });
    }
  }, [isOpen, isAuthorized, user]);

  if (!isOpen) return null;

  const allTemplates = isAuthorized
    ? [...permanentTemplates, ...WORKFLOW_TEMPLATES]
    : WORKFLOW_TEMPLATES;

  const categories = isAuthorized
    ? ['All', 'Permanent Templates', ...BASE_CATEGORIES.slice(1)]
    : [...BASE_CATEGORIES];

  const filteredTemplates = allTemplates.filter(
    (t) => activeCategory === 'All' || t.category === activeCategory
  );

  return (
    <div
      className="wb-scrim"
      id="scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="wb-modal" role="dialog" aria-label="Start from a template">
        <div className="wb-modal-head">
          <div>
            <h2>Start from a template</h2>
            <p className="wb-lede">
              {isAuthorized
                ? 'Standard templates and executive permanent templates saved for your account and team.'
                : 'Twenty workflows that already follow the rules. Every one of them waits for a person before anything leaves Concludo.'}
            </p>
          </div>
          <button className="wb-btn" onClick={onClose} aria-label="Close template picker">
            Close
          </button>
        </div>

        <div className="wb-filters" role="tablist" aria-label="Template categories">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`wb-pill ${cat === activeCategory ? 'gold' : 'ghost'}`}
              role="tab"
              aria-selected={cat === activeCategory}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === 'Permanent Templates' ? '★ ' + cat : cat}
            </button>
          ))}
        </div>

        <div className="wb-grid">
          {filteredTemplates.map((t) => {
            const isPerm = t.category === 'Permanent Templates';
            const usesText = [
              ...(t.applicationsRequired || []),
              ...((t.concludoServicesRequired || []).map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ''))),
            ].join(' ');

            return (
              <article
                key={t.templateKey}
                className="wb-tcard"
                style={isPerm ? { borderColor: 'rgba(226, 181, 60, 0.6)', background: 'rgba(22, 38, 63, 0.95)' } : undefined}
              >
                <div className="wb-top">
                  <span className={`wb-pill ${isPerm ? 'gold' : 'gold'}`}>
                    {isPerm ? '★ Permanent Template' : t.category}
                  </span>
                  <span className="wb-mins">{t.setupTimeCategory}</span>
                </div>
                <h3>{t.name}</h3>
                <span className="wb-pill amber" style={{ alignSelf: 'flex-start' }}>
                  A person must approve
                </span>
                <div className="wb-row">
                  <span className="wb-rk">Uses</span>
                  <span className="wb-rv mono">{usesText || 'Concludo Workflows'}</span>
                </div>
                <div className="wb-row">
                  <span className="wb-rk">When</span>
                  <span className="wb-rv">{t.exampleTrigger}</span>
                </div>
                <div className="wb-row">
                  <span className="wb-rk">Then</span>
                  <span className="wb-rv sub">{t.exampleResult}</span>
                </div>
                <div className="wb-use">
                  <button onClick={() => onSelectTemplate(t)}>Use template</button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="wb-promise">
          <span className="wb-d" aria-hidden="true"></span>
          <span>
            <strong>Concludo proposes. A person disposes.</strong> Every template with an amber
            badge stops and waits for a named human before it changes anything or sends anything.
          </span>
        </div>

        <p className="wb-indep">
          Concludo is an independent product and is not affiliated with, endorsed by, or partnered
          with any device maker, meeting platform or note-taking service.
        </p>
      </div>
    </div>
  );
};
