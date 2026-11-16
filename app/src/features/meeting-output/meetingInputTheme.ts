/**
 * Concludo Meeting Input Bright Futuristic Theme Tokens
 * Source of truth: reference/tokens.json from Claude handover (16 Nov 2026)
 */
export const meetingInputTheme = {
  flag: 'meeting_input_futuristic_v1',
  colour: {
    navy: '#16263F',
    navy2: '#21395C',
    gold: '#E2B53C',
    goldDeep: '#BC8A1C',
    light: '#F4F6FA',
    slate: '#5A6478',
    glowCyan: '#7DD3FC',
    glowBlue: '#3D9BFF',
    line: '#D5E3F2',
    fieldBorder: '#CFE3F5',
    textareaBorder: '#BFE6FB',
  },
  glow: {
    tile: '0 0 0 1px rgba(125,211,252,.4),0 0 18px rgba(61,155,255,.32),inset 0 0 12px rgba(125,211,252,.14)',
    card: '0 0 0 1px rgba(125,211,252,.3),0 0 28px rgba(61,155,255,.22),0 14px 36px rgba(22,38,63,.07)',
    focus: '0 0 0 3px rgba(61,155,255,.18),0 0 18px rgba(61,155,255,.35)',
    ctaReady: '0 0 0 1px rgba(226,181,60,.5),0 0 26px rgba(226,181,60,.55),0 8px 20px rgba(188,138,28,.25)',
  },
  type: {
    heading: 'Poppins 600/700',
    body: 'Inter 400/500/600',
    h1: '44px (32px mobile)',
    bodySize: '16 to 18px',
  },
  rules: [
    'Gold is never text on white or light. Gold is for rules, borders, button fills with navy text.',
    'Minimum tap target 44px.',
    'Animation off under prefers-reduced-motion.',
  ],
} as const;
