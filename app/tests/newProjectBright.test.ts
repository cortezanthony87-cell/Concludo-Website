import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('New Project Bright Transcript Template', () => {
  const studioPath = resolve(__dirname, '../src/features/meeting-output/studio.js');
  const studioCode = readFileSync(studioPath, 'utf8');
  const newProjectPagePath = resolve(__dirname, '../src/pages/NewProjectPage.tsx');
  const newProjectPageCode = readFileSync(newProjectPagePath, 'utf8');
  const meetingOutputPagePath = resolve(__dirname, '../src/pages/MeetingOutputPage.tsx');
  const meetingOutputPageCode = readFileSync(meetingOutputPagePath, 'utf8');

  it('supports custom step1Title in studio.js with default fallback to "Add the meeting"', () => {
    expect(studioCode).toContain('opts.step1Title || \'Add the meeting\'');
  });

  it('supports custom crumbTitle in studio.js with default fallback to "Meeting output"', () => {
    expect(studioCode).toContain('opts.crumbTitle || \'Meeting output\'');
  });

  it('NewProjectPage passes step1Title "Create New Project" and defaultSaveMode "new"', () => {
    expect(newProjectPageCode).toContain("step1Title: 'Create New Project'");
    expect(newProjectPageCode).toContain("crumbTitle: 'Create New Project'");
    expect(newProjectPageCode).toContain("defaultSaveMode: 'new'");
    expect(newProjectPageCode).toContain('mountMeetingStudio');
  });

  it('MeetingOutputPage does NOT pass step1Title, leaving "Add the meeting" intact', () => {
    expect(meetingOutputPageCode).not.toContain('step1Title');
    expect(meetingOutputPageCode).not.toContain('Create New Project');
  });

  it('contains zero em or en dashes in NewProjectPage', () => {
    expect(newProjectPageCode).not.toContain('\u2014');
    expect(newProjectPageCode).not.toContain('\u2013');
  });
});
