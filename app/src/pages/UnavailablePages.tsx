import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, StatePanel } from '../components/intel/IntelKit';
import '../styles/intel-bright.css';

/**
 * Honest placeholders for surfaces whose old content was invented (defects D1 and D2).
 * They state what is missing and where the real records are today. They show no numbers.
 * Nothing is deleted: the old pages stay in the repository, unrouted, for rollback.
 */
interface Spec {
  title: string;
  crumbs: string[];
  purpose: string;
  why: string;
  needs: string[];
  today: Array<{ label: string; to: string }>;
}

const SPECS: Record<string, Spec> = {
  commandCentre: {
    title: 'Executive Command Centre',
    crumbs: ['Briefings', 'Command Centre'],
    purpose: 'A single view of delivery health across projects.',
    why: 'The earlier version showed a fixed health score, example alerts and a fixed recommendation list. None came from your records.',
    needs: [
      'Decision status and impact recorded on each decision (a database change that is planned and will not run without your approval).',
      'Actions with an owner and a due date, counted the same way on every page.',
      'At least 3 saved snapshots before any trend is drawn, and a denominator of at least 5 before any rate.',
    ],
    today: [{ label: 'Decision Memory', to: '/decision-memory' }, { label: 'Lessons', to: '/memory/lessons' }, { label: 'Projects', to: '/projects' }],
  },
  performance: {
    title: 'Enterprise Performance',
    crumbs: ['Insight', 'Performance'],
    purpose: 'How work is flowing across the business.',
    why: 'The earlier version showed letter grades per team from fixed constants. Concludo measures work, not people, so this page is paused until it can show work measures from real records.',
    needs: [
      'The shared definitions for open, overdue and blocked actions.',
      'Real history: at least 8 weeks before any projection is labelled a trend projection.',
    ],
    today: [{ label: 'Decision Memory', to: '/decision-memory' }, { label: 'Projects', to: '/projects' }],
  },
  briefingCentre: {
    title: 'Executive Briefing Centre',
    crumbs: ['Briefings', 'Briefing Centre'],
    purpose: 'Briefings drafted from your saved records, for a person to review and approve.',
    why: 'The earlier version filled a template with example statements and saved it as published. Generation is switched off until a briefing can be drafted from real records and approved by a person first.',
    needs: [
      'Drafting that reads real decisions, actions and lessons and cites each one.',
      'An approval step: every briefing is saved as a draft and nothing is published without a person approving it.',
    ],
    today: [{ label: 'Decision Memory', to: '/decision-memory' }, { label: 'Lessons', to: '/memory/lessons' }],
  },
  predictive: {
    title: 'Predictive Intelligence',
    crumbs: ['Forecasts', 'Predictive'],
    purpose: 'Risks and opportunities the records point to.',
    why: 'The earlier version produced fixed scores, fixed confidence labels and template wording, and saved a snapshot every time the page opened. None of it came from your records.',
    needs: [
      'Real history: at least 8 weeks before any projection is labelled a trend projection.',
      'At least 3 genuine saved snapshots before any trend is drawn. Snapshots made by the earlier version will not count.',
      'Every risk shown with the records it comes from.',
    ],
    today: [{ label: 'Decision Memory', to: '/decision-memory' }, { label: 'Lessons', to: '/memory/lessons' }],
  },
  forecasts: {
    title: 'Forecasts',
    crumbs: ['Forecasts', 'Forecasts'],
    purpose: 'Where delivery is heading, if the recent pattern holds.',
    why: 'The earlier version drew a rising line from fixed rules and called it improving. A line is only honest when it is drawn from real weekly history.',
    needs: [
      'At least 8 weeks of real weekly history, shown beside the line.',
      'A Trend projection label, a range and the history it is based on. Never a promise.',
    ],
    today: [{ label: 'Decision Memory', to: '/decision-memory' }, { label: 'Projects', to: '/projects' }],
  },
  executiveIntelligence: {
    title: 'Executive Intelligence',
    crumbs: ['Briefings', 'Executive Intelligence'],
    purpose: 'What matters at an executive level, from saved records.',
    why: 'The earlier version showed a momentum score and risk levels set by fixed rules, not by your records.',
    needs: [
      'The shared definitions for open, overdue and blocked actions.',
      'Decision status and impact recorded on decisions, so that a rate has something real behind it.',
    ],
    today: [{ label: 'Decision Memory', to: '/decision-memory' }, { label: 'Lessons', to: '/memory/lessons' }],
  },
  digitalTwin: {
    title: 'Digital Twin Organisation',
    crumbs: ['Forecasts', 'Digital Twin'],
    purpose: 'A model of how the organisation is structured and connected.',
    why: 'The earlier version drew a model from example data and fixed values, so it described an organisation that does not exist.',
    needs: ['Real structure data (teams, projects and links) that the Explore page can already show as saved records.'],
    today: [{ label: 'Explore', to: '/memory/explore' }],
  },
  scenarioModelling: {
    title: 'Scenario Modelling',
    crumbs: ['Forecasts', 'Scenarios'],
    purpose: 'Try a what-if and see its effect.',
    why: 'The earlier outputs came from fixed multipliers. They are paused until scenarios are built from numbers you enter, and labelled Scenario so they are never read as a forecast.',
    needs: ['Inputs entered by a person, shown beside every result, with the Scenario label.'],
    today: [{ label: 'Decision Memory', to: '/decision-memory' }],
  },
};

const Unavailable: React.FC<{ spec: Spec }> = ({ spec }) => (
  <div className="ib">
    <PageHeader title={spec.title} purpose={spec.purpose} crumbs={spec.crumbs.map((label) => ({ label }))} />
    <StatePanel kind="insufficient" title="Unavailable until it can use real data" body={spec.why} />
    <section className="ib-card" style={{ marginTop: 16 }} aria-label="What is needed">
      <h2 className="ib-card__title">What it needs</h2>
      <ul>{spec.needs.map((n) => <li key={n}>{n}</li>)}</ul>
    </section>
    <section className="ib-card" style={{ marginTop: 16 }} aria-label="Where the real records are today">
      <h2 className="ib-card__title">Real records today</h2>
      <p className="ib-card__body">
        {spec.today.map((t, i) => (
          <span key={t.to}>{i > 0 && ' | '}<Link className="ib-link" to={t.to}>{t.label}</Link></span>
        ))}
      </p>
    </section>
  </div>
);

export const ExecutiveCommandCentrePage: React.FC = () => <Unavailable spec={SPECS.commandCentre} />;
export const EnterprisePerformancePage: React.FC = () => <Unavailable spec={SPECS.performance} />;
export const ExecutiveBriefingCentrePage: React.FC = () => <Unavailable spec={SPECS.briefingCentre} />;
export const PredictiveUnavailablePage: React.FC = () => <Unavailable spec={SPECS.predictive} />;
export const ForecastsUnavailablePage: React.FC = () => <Unavailable spec={SPECS.forecasts} />;
export const ExecutiveIntelligenceUnavailablePage: React.FC = () => <Unavailable spec={SPECS.executiveIntelligence} />;
export const DigitalTwinUnavailablePage: React.FC = () => <Unavailable spec={SPECS.digitalTwin} />;
export const ScenarioModellingUnavailablePage: React.FC = () => <Unavailable spec={SPECS.scenarioModelling} />;
export const UNAVAILABLE_SPECS = SPECS;
