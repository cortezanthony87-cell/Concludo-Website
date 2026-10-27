import React from 'react';
import { AutomationPage } from '../../components/automation/AutomationPage';

export interface WorkflowBuilderPageProps {
  isNew?: boolean;
}

export const WorkflowBuilderPage: React.FC<WorkflowBuilderPageProps> = ({ isNew }) => {
  return <AutomationPage view="builder" paramId={isNew ? 'new' : undefined} />;
};

export default WorkflowBuilderPage;
