import { describe, it, expect } from 'bun:test';
import { timelineFileName } from '../src/lib/outputs/timeline/timelineDeck';
import { buildTimelineFileName } from '../src/lib/outputs/timeline/timelineData';

describe('Timeline file name generation', () => {
  it('handles empty or missing refDate without crashing or leaving trailing underscores', () => {
    const fn1 = timelineFileName({ source: 'meeting', title: 'Concludo Operations', refDate: '' });
    expect(fn1).toBe('Concludo_Timeline_Concludo_Operations.pptx');

    const fn2 = timelineFileName({ source: 'hub', title: 'Concludo Operations', refDate: '2026-11-13' });
    expect(fn2).toBe('Concludo_Timeline_Concludo_Operations_2026_11_13.pptx');

    const fn3 = buildTimelineFileName('Concludo Operations', '2026-11-13');
    expect(fn3).toBe('Concludo_Timeline_Concludo_Operations_2026_11_13.pptx');
  });

  it('contains no dashes or spaces in final filename', () => {
    const fn = timelineFileName({ source: 'meeting', title: 'Q4 - Ops & Planning', refDate: '2026-11-13' });
    expect(fn).not.toContain('-');
    expect(fn).not.toContain(' ');
    expect(fn).toMatch(/^Concludo_Timeline_[A-Za-z0-9_]+\.pptx$/);
  });
});
