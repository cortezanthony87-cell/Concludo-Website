import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';

export const NewProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [meetingType, setMeetingType] = useState('Strategy & Planning');
  const [clientOrProject, setClientOrProject] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Fields do not need to be saved to a database yet.
    // Navigate to project detail view with placeholder ID
    navigate('/projects/project-1');
  };

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.88rem', fontWeight: 500 }}>
          <ArrowLeft size={16} />
          <span>Back to Projects</span>
        </Link>
      </div>

      <div className="page-header">
        <h1 className="page-title">Create Project</h1>
        <p className="page-subtitle">Configure the meeting details to begin processing your transcript.</p>
      </div>

      <div className="content-card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="project-title">
              Project title
            </label>
            <input
              id="project-title"
              type="text"
              className="form-input"
              placeholder="e.g. Executive Strategy Review"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="meeting-type">
              Meeting type
            </label>
            <select
              id="meeting-type"
              className="form-select"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
            >
              <option value="Strategy & Planning">Strategy & Planning</option>
              <option value="Client Consultation">Client Consultation</option>
              <option value="Operational Sync">Operational Sync</option>
              <option value="Workshop Session">Workshop Session</option>
              <option value="Executive Review">Executive Review</option>
              <option value="One-on-One Check-in">One-on-One Check-in</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="client-project-name">
              Client or project name
            </label>
            <input
              id="client-project-name"
              type="text"
              className="form-input"
              placeholder="e.g. Concludo Operations or Client Acme Corp"
              value={clientOrProject}
              onChange={(e) => setClientOrProject(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="meeting-date">
              Meeting date
            </label>
            <input
              id="meeting-date"
              type="date"
              className="form-input"
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              required
            />
          </div>

          <div style={{
            background: '#f4f6fa',
            borderRadius: '8px',
            padding: '14px 16px',
            marginBottom: '24px',
            border: '1px solid #e2e8f0',
            fontSize: '0.85rem',
            color: '#64748b'
          }}>
            <strong style={{ color: '#16263f' }}>Note:</strong> For now, these fields do not need to be saved to a database. Database persistence will connect in an upcoming tasklet.
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            <button type="submit" className="btn-primary">
              <Check size={18} />
              <span>Create Project</span>
            </button>
            <Link to="/projects" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
