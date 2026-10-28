/**
 * The other working views, with how much is waiting in each.
 *
 * The tab row says where a view is. This says what is in it. The numbers come
 * from `viewCounts`, which calls the same functions the views call, so a count
 * here is the length of the list behind the link. A zero is shown as a zero:
 * "nothing is waiting" is an answer, not an absence.
 *
 * It sits on every working view except the Overview, which keeps its own
 * layout. Counts describe work. They never describe people.
 */
import React, { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { EmailModuleContext } from './EmailModuleLayout';
import { useViewData } from '../../lib/email/useViewData';
import { useLocalActions } from '../../lib/email/localActions';
import { COUNTED_VIEWS, viewCounts } from '../../lib/email/viewCounts';
import { EMAIL_MODULE_DESTINATIONS } from '../../lib/email/moduleNav';
import { EmailModulePath } from '../../lib/email/types';

const SHORT_LABEL: Partial<Record<EmailModulePath, string>> = {
  '/email/actions-deadlines': 'Actions & Deadlines',
};

export const RelatedViews: React.FC<{ current: EmailModulePath }> = ({ current }) => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { dataset, records, accountLabel, accountType, now, state } = useViewData(accountId);
  const { userDates } = useLocalActions();

  const counts = useMemo(
    () =>
      state === 'ready' && dataset
        ? viewCounts({
            records,
            drafts: dataset.drafts,
            accountId,
            accountLabel,
            accountType,
            now,
            userDates,
          })
        : null,
    [state, dataset, records, accountId, accountLabel, accountType, now, userDates]
  );

  if (!counts) return null;

  return (
    <nav className="ecc-related" aria-label="Related views">
      <p className="ecc-related-label">Elsewhere in your inbox</p>
      <ul className="ecc-related-list">
        {COUNTED_VIEWS.filter((path) => path !== current).map((path) => {
          const destination = EMAIL_MODULE_DESTINATIONS.find((d) => d.path === path);
          const label = SHORT_LABEL[path] ?? destination?.label ?? path;
          const count = counts[path];
          const alert = path === '/email/security-review' && count > 0;
          return (
            <li key={path}>
              <Link
                to={linkTo(path)}
                className={`ecc-related-link${alert ? ' ecc-related-alert' : ''}${count === 0 ? ' ecc-related-zero' : ''}`}
              >
                <span>{label}</span>
                <span className="ecc-related-count" aria-hidden="true">
                  {count}
                </span>
                <span className="ecc-visually-hidden">
                  , {count === 0 ? 'nothing waiting' : `${count} ${count === 1 ? 'item' : 'items'}`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
