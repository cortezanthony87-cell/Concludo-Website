export type ActionHubSummaryThemeKey = 'mix' | 'bright';

/**
 * Current code constant theme for the Action Command Hub summary.
 * Defaults to 'mix' (approved 16 Nov 2026).
 * Can be set to 'bright' to render the alternate with no other changes.
 */
export const CURRENT_SUMMARY_THEME: ActionHubSummaryThemeKey = 'mix';

export interface DonutPanelTokens {
  bg: string;
  border: string;
  glow: string;
  radialGlow: string;
  text: string;
  mutedText: string;
  track: string;
  core: [string, string];
  centerNumber: string;
  centerLabel: string;
  outerRingStroke: string;
  outerRingOpacity: string;
  innerRingStroke: string;
  innerRingOpacity: string;
  coreStrokeOpacity: string;
  coreDashStroke: string;
  coreDashOpacity: string;
  rowBorder: string;
}

export interface SegmentTokens {
  completed: string;
  overdue: string;
  dueToday: string;
  pending: string;
}

export interface TileTokens {
  bg: string;
  border: string;
  glow: string;
  number: string;
  label: string;
}

export interface TileDotTokens {
  overdue: string;
  dueToday: string;
  upcoming: string;
  unscheduled: string;
  inProgress: string;
  waiting: string;
  blocked: string;
  completed: string;
}

export interface SummaryThemeTokens {
  pageBg: string;
  donutPanel: DonutPanelTokens;
  segments: SegmentTokens;
  tiles: TileTokens;
  tileDots: TileDotTokens;
}

export const actionHubSummaryTheme: Record<ActionHubSummaryThemeKey, SummaryThemeTokens> = {
  mix: {
    pageBg: '#F4F6FA',
    donutPanel: {
      bg: 'linear-gradient(160deg, #16263F 0%, #1B3050 100%)',
      border: '1px solid rgba(125, 211, 252, 0.35)',
      glow: '0 0 0 1px rgba(125, 211, 252, 0.12), 0 0 28px rgba(80, 170, 255, 0.22), 0 18px 40px rgba(22, 38, 63, 0.25)',
      radialGlow: 'radial-gradient(circle at 25% 50%, rgba(80, 170, 255, 0.18), transparent 55%)',
      text: '#F4F6FA',
      mutedText: '#B9C7DD',
      track: '#21395C',
      core: ['#21395C', '#16263F'],
      centerNumber: '#FFFFFF',
      centerLabel: '#B9C7DD',
      outerRingStroke: '#7DD3FC',
      outerRingOpacity: '0.45',
      innerRingStroke: '#7DD3FC',
      innerRingOpacity: '0.25',
      coreStrokeOpacity: '0.5',
      coreDashStroke: '#7DD3FC',
      coreDashOpacity: '0.25',
      rowBorder: 'rgba(185, 199, 221, 0.22)',
    },
    segments: {
      completed: '#2EE6A6',
      overdue: '#FF5A6E',
      dueToday: '#FFC83D',
      pending: '#9DB4DC',
    },
    tiles: {
      bg: '#FFFFFF',
      border: '#7DD3FC',
      glow: '0 0 0 1px rgba(125, 211, 252, 0.4), 0 0 18px rgba(61, 155, 255, 0.4), inset 0 0 14px rgba(125, 211, 252, 0.16)',
      number: '#16263F',
      label: '#5A6478',
    },
    tileDots: {
      overdue: '#E04F5F',
      dueToday: '#E2B53C',
      upcoming: '#3D7BE0',
      unscheduled: '#8A94A6',
      inProgress: '#3D9BFF',
      waiting: '#8B6FE0',
      blocked: '#E8743B',
      completed: '#1F9D6B',
    },
  },
  bright: {
    pageBg: '#F4F6FA',
    donutPanel: {
      bg: '#FFFFFF',
      border: '1px solid #7DD3FC',
      glow: '0 0 0 1px rgba(125, 211, 252, 0.35), 0 0 26px rgba(61, 155, 255, 0.28), 0 10px 30px rgba(22, 38, 63, 0.08)',
      radialGlow: 'radial-gradient(circle at 25% 50%, rgba(125, 211, 252, 0.22), transparent 58%)',
      text: '#16263F',
      mutedText: '#5A6478',
      track: '#E6ECF5',
      core: ['#FFFFFF', '#EAF3FF'],
      centerNumber: '#16263F',
      centerLabel: '#5A6478',
      outerRingStroke: '#3D9BFF',
      outerRingOpacity: '0.5',
      innerRingStroke: '#3D9BFF',
      innerRingOpacity: '0.28',
      coreStrokeOpacity: '0.8',
      coreDashStroke: '#3D9BFF',
      coreDashOpacity: '0.3',
      rowBorder: '#E1E7F0',
    },
    segments: {
      completed: '#1F9D6B',
      overdue: '#E04F5F',
      dueToday: '#E2B53C',
      pending: '#8FA8D6',
    },
    tiles: {
      bg: '#FFFFFF',
      border: '#7DD3FC',
      glow: '0 0 0 1px rgba(125, 211, 252, 0.4), 0 0 18px rgba(61, 155, 255, 0.4), inset 0 0 14px rgba(125, 211, 252, 0.16)',
      number: '#16263F',
      label: '#5A6478',
    },
    tileDots: {
      overdue: '#E04F5F',
      dueToday: '#E2B53C',
      upcoming: '#3D7BE0',
      unscheduled: '#8A94A6',
      inProgress: '#3D9BFF',
      waiting: '#8B6FE0',
      blocked: '#E8743B',
      completed: '#1F9D6B',
    },
  },
};
