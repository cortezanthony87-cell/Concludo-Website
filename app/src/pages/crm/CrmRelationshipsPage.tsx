/**
 * Relationships: eight questions, eight answers.
 *
 * The view is organised by QUESTION rather than by record type, because the
 * eight things the brief asks for are the eight things a person actually wants
 * to know and none of them map to a table. "Who is waiting for us" is a
 * question about commitments, "which relationships depend on one person" is a
 * question about organisations and people together, and a view organised by
 * table makes a person assemble both answers themselves.
 *
 * Each answer is a list with a stated reason on every row, and no answer is an
 * ordered league table of people. Where an order is needed, it is by a recorded
 * number which is shown beside the row, so a person can disagree with it.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RelationshipAnswer, relationshipAnswers } from '../../lib/crm/stage4/relationships';

const AnswerPanel: React.FC<{
  answer: RelationshipAnswer;
  linkTo: (path: string) => string;
}> = ({ answer, linkTo }) => (
  <section className="ccrm-panel ccrm-answer" aria-labelledby={`q-${slug(answer.question)}`}>
    <div className="ccrm-panel-head">
      <div>
        <h3 className="ccrm-panel-title" id={`q-${slug(answer.question)}`}>
          {answer.question}
        </h3>
        <p className="ccrm-panel-description">{answer.purpose}</p>
      </div>
      <span className="ccrm-answer-count">
        {answer.rows.length}
        <span className="ccrm-visually-hidden">
          {answer.rows.length === 1 ? ' item' : ' items'}
        </span>
      </span>
    </div>

    {answer.rows.length === 0 ? (
      <p className="ccrm-panel-empty">{answer.emptyMessage}</p>
    ) : (
      <ul className="ccrm-item-list">
        {answer.rows.slice(0, 6).map((row) => {
          const href = row.personId
            ? `/crm/people/${row.personId}`
            : row.organisationId
              ? `/crm/organisations/${row.organisationId}`
              : null;

          const body = (
            <>
              <span className="ccrm-item-main">
                <span className="ccrm-item-title">{row.name}</span>
                {row.context ? <span className="ccrm-item-context">{row.context}</span> : null}
                <span className="ccrm-reason">
                  {row.standing ? (
                    <span
                      className={
                        row.standing === 'Needs review'
                          ? 'ccrm-standing ccrm-standing-review'
                          : 'ccrm-standing'
                      }
                    >
                      {row.standing}
                    </span>
                  ) : null}
                  <span className="ccrm-reason-text">{row.reason}</span>
                </span>
              </span>
              {row.days !== null ? (
                <span className="ccrm-item-days">
                  {row.days}
                  <span className="ccrm-visually-hidden"> days</span>
                  <span aria-hidden="true"> d</span>
                </span>
              ) : null}
            </>
          );

          return (
            <li key={row.id}>
              {href ? (
                <Link className="ccrm-item" to={linkTo(href)}>
                  {body}
                </Link>
              ) : (
                <span className="ccrm-item">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    )}

    {answer.rows.length > 6 ? (
      <p className="ccrm-panel-more">
        {answer.rows.length - 6} more not shown here.
      </p>
    ) : null}
  </section>
);

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
}

export const CrmRelationshipsPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const answers = React.useMemo(() => relationshipAnswers(data, now), [data, now]);
  const total = answers.reduce((sum, answer) => sum + answer.rows.length, 0);

  return (
    <Stage4Scaffold
      title="Relationships"
      description="Eight questions about the people on record, each answered from what somebody wrote down."
      loadingLabel="the relationship questions"
      emptyTitle="No people are recorded in this workspace"
      emptyBody="Relationships appear here once people and the conversations with them are recorded."
      resultCount={total}
      totalCount={data.people.length}
    >
      <p className="ccrm-not-ranked ccrm-policy" role="note">
        Nobody is ranked or scored here. Every row says what was recorded and when, so a gap in the
        list is a gap in the record, which is not the same thing as a gap in the relationship.
      </p>

      <div className="ccrm-panel-grid">
        {answers.map((answer) => (
          <AnswerPanel key={answer.question} answer={answer} linkTo={linkTo} />
        ))}
      </div>
    </Stage4Scaffold>
  );
};
