import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  APPROVED_CUE_CARDS,
  evaluateCueOnDemand,
  type CueCard,
  type CueCategory,
  type CueDemandResult
} from '../../lib/video/salesCopilotLibrary';
import { getVideoOwnerDetails, subscribeToVideoOwnerDetails, type VideoOwnerDetails } from '../../lib/video/videoMeetingCentreOwnerClient';
import { isVideoMeetingCentreEnabled } from '../../lib/video/videoMeetingCentreFeatureFlag';

const QUICK_PROMPTS = [
  'The price is too high',
  'Will a bot join our calls?',
  'Where do commitments live today?',
  'Can you connect with HubSpot?',
  'Do you guarantee a custom SLA?',
  'How many paying customers do you have?'
];

interface WordToken {
  t: string;
  sent: number;
}

export const VideoCompanionPanelPage: React.FC = () => {
  const [ownerDetails, setOwnerDetails] = useState<VideoOwnerDetails | null>(null);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('light');
  const [selectedCategory, setSelectedCategory] = useState<CueCategory | 'all'>('all');
  const [queryText, setQueryText] = useState('');
  const [activeCardForReading, setActiveCardForReading] = useState<CueCard | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Bright Reading Mode State (lives only in memory, never saved to storage)
  const [readingIdx, setReadingIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(130);
  const [textSize, setTextSize] = useState(30);
  const [readingMode, setReadingMode] = useState<'ball' | 'highlight'>('ball');

  // Scrubbing & hold timers (all in memory)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHeldRef = useRef(false);

  // Verify owner status on mount via real RPC and keep synced with auth changes
  useEffect(() => {
    let mounted = true;
    getVideoOwnerDetails().then((details) => {
      if (mounted) {
        setOwnerDetails(details);
      }
    });

    const unsubscribe = subscribeToVideoOwnerDetails((details) => {
      if (mounted) {
        setOwnerDetails(details);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  // Real-time evaluation of cue on demand
  const demandResult: CueDemandResult = useMemo(() => {
    return evaluateCueOnDemand(queryText);
  }, [queryText]);

  // Tokenize text into words and sentences for the active reading draft
  const activeReadingText = useMemo(() => {
    // If a specific card is tapped, read that card's speaking draft
    if (activeCardForReading) {
      return activeCardForReading.speakingDraft;
    }
    // Otherwise read the approved speaking draft of the current demand result
    if (demandResult.draftedAnswer) {
      return demandResult.draftedAnswer;
    }
    return '';
  }, [activeCardForReading, demandResult.draftedAnswer]);

  const tokens: WordToken[] = useMemo(() => {
    if (!activeReadingText) return [];
    const parts = activeReadingText.split(/\s+/).filter(Boolean);
    let sent = 0;
    return parts.map((t) => {
      const o: WordToken = { t, sent };
      // Sentence boundary check: ending with . ! ? or : except currency/abbreviations
      if (/[.?!:]$/.test(t) && !/^(AU\$|No\.)/.test(t) || t === 'No.') {
        sent += 1;
      }
      return o;
    });
  }, [activeReadingText]);

  // Reset reading index whenever active card or demand result text changes
  useEffect(() => {
    setReadingIdx(0);
    setIsPlaying(false);
  }, [activeReadingText]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      return;
    }

    const intervalMs = Math.round(60000 / wpm);
    playTimerRef.current = setTimeout(() => {
      setReadingIdx((prev) => {
        if (prev < tokens.length - 1) {
          return prev + 1;
        } else {
          setIsPlaying(false);
          return prev;
        }
      });
    }, intervalMs);

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, readingIdx, wpm, tokens.length]);

  // Step function for Back and Next
  const step = useCallback((dir: number) => {
    setReadingIdx((prev) => Math.max(0, Math.min(tokens.length - 1, prev + dir)));
    setIsPlaying(false);
  }, [tokens.length]);

  // Stop hold scrubbing
  const holdStop = useCallback(() => {
    isHeldRef.current = false;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  // Start hold scrubbing with acceleration up to 40 words/sec (25ms)
  const holdStart = useCallback((dir: number) => {
    holdStop();
    step(dir);
    isHeldRef.current = true;
    let currentDelay = 160;

    const tick = () => {
      if (!isHeldRef.current) return;
      step(dir);
      currentDelay = Math.max(25, currentDelay * 0.88);
      holdTimerRef.current = setTimeout(tick, currentDelay);
    };

    holdTimerRef.current = setTimeout(tick, 380);
  }, [holdStop, step]);

  // Double-click jumps
  const toTop = useCallback(() => {
    holdStop();
    setReadingIdx(0);
    setIsPlaying(false);
  }, [holdStop]);

  const toEnd = useCallback(() => {
    holdStop();
    setReadingIdx(Math.max(0, tokens.length - 1));
    setIsPlaying(false);
  }, [holdStop, tokens.length]);

  // Filter cards by category
  const filteredCards = useMemo(() => {
    if (selectedCategory === 'all') return APPROVED_CUE_CARDS;
    return APPROVED_CUE_CARDS.filter((c) => c.category === selectedCategory);
  }, [selectedCategory]);

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  // Check feature flag
  const featureEnabled = isVideoMeetingCentreEnabled();

  // Clean, bright design tokens matching Concludo_Bright_Reading_Panel_Template_v1.dc.html
  const isDark = themeMode === 'dark';
  const theme = {
    bg: isDark ? '#0a192f' : '#F4F6FA',
    text: isDark ? '#f8fafc' : '#16263F',
    textSecondary: isDark ? '#cbd5e1' : '#21395C',
    textMuted: isDark ? '#94a3b8' : '#5A6478',
    cardBg: isDark ? 'rgba(15, 23, 42, 0.95)' : '#FFFFFF',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : '#D5DBE6',
    headerBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : '#D5DBE6',
    gold: '#E2B53C',
    navy: '#16263F',
    slate: '#5A6478',
    paleGold: '#FBF0CC',
    inputBg: isDark ? 'rgba(30, 41, 59, 0.9)' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.2)' : '#D5DBE6',
    inputText: isDark ? '#f8fafc' : '#16263F',
    chipBg: isDark ? 'rgba(51, 65, 85, 0.7)' : '#FFFFFF',
    chipText: isDark ? '#cbd5e1' : '#16263F',
    itemBg: isDark ? 'rgba(30, 41, 59, 0.7)' : '#FFFFFF'
  };

  // Authorization & Feature Flag Guards: unauthenticated / non-owner sees nothing
  if (!featureEnabled || (ownerDetails && !ownerDetails.isOwner)) {
    return (
      <div style={{ padding: '40px 24px', maxWidth: '600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '24px' }}>
          <h2 style={{ color: '#991b1b', margin: '0 0 8px 0', fontSize: '18px', fontFamily: 'Poppins, sans-serif' }}>
            Page Not Found (404)
          </h2>
          <p style={{ color: '#7f1d1d', margin: 0, fontSize: '16px', lineHeight: '1.5' }}>
            The requested page could not be located.
          </p>
        </div>
      </div>
    );
  }

  // Loading state while checking owner
  if (!ownerDetails) {
    return (
      <div style={{ minHeight: '100vh', background: theme.bg, padding: '24px', fontFamily: 'Inter, sans-serif' }} />
    );
  }

  const curToken = tokens[Math.min(readingIdx, Math.max(0, tokens.length - 1))];
  const isLastWord = readingIdx >= tokens.length - 1;
  const playLabel = isPlaying ? 'Pause' : isLastWord ? 'Start again' : 'Start';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: theme.bg,
        color: theme.text,
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: '16px',
        boxSizing: 'border-box',
        transition: 'background 0.2s, color 0.2s'
      }}
    >
      <style>{`
        button { font-family: 'Inter', Arial, sans-serif; cursor: pointer; }
        button:focus-visible { outline: 3px solid #16263F; outline-offset: 2px; }
        .bouncing-ball {
          position: absolute;
          left: 50%;
          top: -26px;
          width: 18px;
          height: 18px;
          margin-left: -9px;
          border-radius: 50%;
          background: #E2B53C;
          border: 3px solid #16263F;
          box-sizing: border-box;
          animation: cbounce 0.55s ease-in-out infinite alternate;
        }
        @keyframes cbounce {
          from { transform: translateY(0); }
          to { transform: translateY(-10px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bouncing-ball { animation: none; }
        }
      `}</style>

      {/* Header bar */}
      <header
        style={{
          borderBottom: `2px solid ${theme.headerBorder}`,
          paddingBottom: '14px',
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ margin: 0, fontFamily: "'Poppins', Arial, sans-serif", fontWeight: 700, fontSize: '22px', color: theme.text }}>
            Sales Co-pilot
          </h1>
          <span style={{ background: theme.navy, color: theme.gold, fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px' }}>
            Bright mode
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
            style={{
              background: theme.cardBg,
              border: `2px solid ${theme.navy}`,
              color: theme.text,
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
          {ownerDetails.email && (
            <span style={{ fontSize: '13px', color: theme.textMuted }}>
              Owner: {ownerDetails.email}
            </span>
          )}
        </div>
      </header>

      {/* Tagline */}
      <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: '1.45', color: theme.textMuted }}>
        Keyword lookup of approved cards. Concludo proposes; you decide what to say.
      </p>

      {/* Prospect Just Said: Quick prompts & input */}
      <section
        style={{
          background: theme.cardBg,
          border: `2px solid ${theme.cardBorder}`,
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '16px'
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: theme.textSecondary, textTransform: 'uppercase', marginBottom: '10px', fontFamily: "'Poppins', sans-serif" }}>
          Prospect just said
        </div>

        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            type="text"
            value={queryText}
            onChange={(e) => {
              setQueryText(e.target.value);
              setActiveCardForReading(null); // Return to demand result text
            }}
            placeholder="Type what the prospect just said (e.g. price is too high)..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: theme.inputBg,
              border: `2px solid ${theme.inputBorder}`,
              borderRadius: '8px',
              padding: '12px 14px',
              color: theme.inputText,
              fontSize: '16px',
              outline: 'none',
              fontFamily: 'Inter, sans-serif'
            }}
          />
          {queryText && (
            <button
              onClick={() => {
                setQueryText('');
                setActiveCardForReading(null);
              }}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: theme.textMuted,
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              x
            </button>
          )}
        </div>

        {/* Quick select chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setQueryText(prompt);
                setActiveCardForReading(null);
              }}
              style={{
                minHeight: '44px',
                padding: '8px 14px',
                borderRadius: '999px',
                fontSize: '14px',
                fontWeight: 600,
                border: `2px solid ${theme.navy}`,
                background: queryText === prompt ? theme.navy : theme.chipBg,
                color: queryText === prompt ? '#FFFFFF' : theme.chipText
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      {/* Part B: Say This & Bright Reading Panel */}
      <section
        style={{
          background: theme.cardBg,
          border: `2px solid ${theme.navy}`,
          borderRadius: '14px',
          padding: '18px 18px 22px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', color: theme.textSecondary, textTransform: 'uppercase', fontFamily: "'Poppins', sans-serif" }}>
              Say this
            </span>
            <span
              style={{
                background: demandResult.status === 'APPROVED' ? theme.navy : '#991b1b',
                color: demandResult.status === 'APPROVED' ? theme.gold : '#FFFFFF',
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '999px'
              }}
            >
              {demandResult.status}
            </span>
            <span style={{ fontSize: '12px', color: theme.textMuted }}>
              Card: {activeCardForReading?.id || demandResult.matchedCard?.id || 'cue-demand-result'}
            </span>
          </div>

          <button
            onClick={() => handleCopy(activeReadingText)}
            style={{
              background: theme.cardBg,
              border: `2px solid ${theme.navy}`,
              color: theme.text,
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {copiedDraft ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Word-by-Word Reading Box */}
        <div
          style={{
            paddingTop: readingMode === 'ball' ? '30px' : '10px',
            minHeight: '260px',
            lineHeight: 1.25,
            borderBottom: `1px solid ${theme.cardBorder}`,
            paddingBottom: '20px'
          }}
        >
          {tokens.length === 0 ? (
            <p style={{ fontSize: '18px', color: theme.textMuted }}>Type or pick a prompt above to view reading draft.</p>
          ) : (
            tokens.map((w, i) => {
              const isCur = i === readingIdx;
              const isDone = i < readingIdx;
              const inSent = curToken ? w.sent === curToken.sent : false;

              let wordBg = 'transparent';
              let wordColor = theme.text;
              let wordWeight = 600;

              if (readingMode === 'highlight') {
                if (isCur) {
                  wordBg = theme.gold;
                  wordWeight = 700;
                } else if (inSent) {
                  wordBg = theme.paleGold;
                }
                if (isDone && !inSent) {
                  wordColor = theme.slate;
                }
              } else {
                // Ball mode
                if (isDone) {
                  wordColor = theme.slate;
                  wordWeight = 500;
                }
                if (isCur) {
                  wordWeight = 700;
                }
              }

              return (
                <span
                  key={i}
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    margin: '6px 8px 6px 0',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    background: wordBg,
                    color: wordColor,
                    fontWeight: wordWeight,
                    fontSize: `${textSize}px`,
                    lineHeight: 1.25,
                    textDecoration: readingMode === 'ball' && isCur ? 'underline' : 'none',
                    textDecorationThickness: readingMode === 'ball' && isCur ? '4px' : undefined,
                    textDecorationColor: readingMode === 'ball' && isCur ? theme.gold : undefined,
                    textUnderlineOffset: readingMode === 'ball' && isCur ? '6px' : undefined
                  }}
                >
                  {readingMode === 'ball' && isCur && <span className="bouncing-ball" aria-hidden="true" />}
                  {w.t}
                </span>
              );
            })
          )}
        </div>

        {/* Source citation */}
        <div style={{ fontSize: '12px', color: theme.textMuted, lineHeight: '1.4' }}>
          <strong>Source:</strong> {activeCardForReading?.sourceSection || demandResult.sourceAttribution}
        </div>
      </section>

      {/* Reading Controls Toolbar */}
      <section
        style={{
          background: theme.cardBg,
          border: `2px solid ${theme.cardBorder}`,
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}
      >
        {/* Row 1: Start/Pause, Back, Next */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => {
              if (!isPlaying && isLastWord) {
                setReadingIdx(0);
                setIsPlaying(true);
              } else {
                setIsPlaying(!isPlaying);
              }
            }}
            style={{
              flex: 1,
              minHeight: '52px',
              borderRadius: '10px',
              border: `2px solid ${theme.navy}`,
              background: theme.navy,
              color: '#FFFFFF',
              fontSize: '17px',
              fontWeight: 700
            }}
          >
            {playLabel}
          </button>

          <button
            onPointerDown={() => holdStart(-1)}
            onPointerUp={holdStop}
            onPointerLeave={holdStop}
            onPointerCancel={holdStop}
            onBlur={holdStop}
            onDoubleClick={toTop}
            onClick={(e) => {
              if (e.detail === 0) step(-1);
            }}
            aria-label="Back. Hold to scrub faster. Double-click to jump to the top."
            style={{
              minHeight: '52px',
              minWidth: '84px',
              borderRadius: '10px',
              border: `2px solid ${theme.navy}`,
              background: '#FFFFFF',
              color: theme.navy,
              fontSize: '16px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              userSelect: 'none',
              touchAction: 'manipulation'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16263F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Back
          </button>

          <button
            onPointerDown={() => holdStart(1)}
            onPointerUp={holdStop}
            onPointerLeave={holdStop}
            onPointerCancel={holdStop}
            onBlur={holdStop}
            onDoubleClick={toEnd}
            onClick={(e) => {
              if (e.detail === 0) step(1);
            }}
            aria-label="Next. Hold to scrub faster. Double-click to jump to the end."
            style={{
              minHeight: '52px',
              minWidth: '84px',
              borderRadius: '10px',
              border: `2px solid ${theme.navy}`,
              background: '#FFFFFF',
              color: theme.navy,
              fontSize: '16px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              userSelect: 'none',
              touchAction: 'manipulation'
            }}
          >
            Next
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16263F" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Row 2: Mode toggle */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setReadingMode('ball')}
            style={{
              flex: 1,
              minHeight: '48px',
              borderRadius: '10px',
              border: `2px solid ${theme.navy}`,
              fontSize: '16px',
              fontWeight: 700,
              background: readingMode === 'ball' ? theme.gold : '#FFFFFF',
              color: theme.navy
            }}
          >
            Bouncing ball
          </button>
          <button
            onClick={() => setReadingMode('highlight')}
            style={{
              flex: 1,
              minHeight: '48px',
              borderRadius: '10px',
              border: `2px solid ${theme.navy}`,
              fontSize: '16px',
              fontWeight: 700,
              background: readingMode === 'highlight' ? theme.gold : '#FFFFFF',
              color: theme.navy
            }}
          >
            Highlight
          </button>
        </div>

        {/* Row 3: Pace */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: theme.textSecondary }}>
            Pace: {wpm} words a minute
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setWpm((p) => Math.max(60, p - 10))}
              aria-label="Slower pace"
              style={{
                minHeight: '44px',
                minWidth: '64px',
                borderRadius: '10px',
                border: `2px solid ${theme.navy}`,
                background: '#FFFFFF',
                color: theme.navy,
                fontSize: '15px',
                fontWeight: 700
              }}
            >
              Slower
            </button>
            <button
              onClick={() => setWpm((p) => Math.min(220, p + 10))}
              aria-label="Faster pace"
              style={{
                minHeight: '44px',
                minWidth: '64px',
                borderRadius: '10px',
                border: `2px solid ${theme.navy}`,
                background: '#FFFFFF',
                color: theme.navy,
                fontSize: '15px',
                fontWeight: 700
              }}
            >
              Faster
            </button>
          </div>
        </div>

        {/* Row 4: Text size */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: theme.textSecondary }}>
            Text size: {textSize} px
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setTextSize((s) => Math.max(22, s - 2))}
              aria-label="Smaller text"
              style={{
                minHeight: '44px',
                minWidth: '56px',
                borderRadius: '10px',
                border: `2px solid ${theme.navy}`,
                background: '#FFFFFF',
                color: theme.navy,
                fontSize: '15px',
                fontWeight: 700
              }}
            >
              A-
            </button>
            <button
              onClick={() => setTextSize((s) => Math.min(44, s + 2))}
              aria-label="Larger text"
              style={{
                minHeight: '44px',
                minWidth: '56px',
                borderRadius: '10px',
                border: `2px solid ${theme.navy}`,
                background: '#FFFFFF',
                color: theme.navy,
                fontSize: '18px',
                fontWeight: 700
              }}
            >
              A+
            </button>
          </div>
        </div>

        {/* Instructions and Privacy Statement */}
        <div
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : '#F4F6FA',
            border: `1px solid ${theme.cardBorder}`,
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '13px',
            lineHeight: '1.5',
            color: theme.textSecondary
          }}
        >
          <strong>How to use it:</strong> press Start and read the word under the ball at your own pace. In Highlight mode the sentence you are on stays shaded and the current word is marked. Tap Back or Next to move one word. Hold either one to scrub faster and faster, then let go where you want the ball to land. Double-click Back to jump to the top, or Next to jump to the end. Nothing is recorded and nothing leaves this page.
        </div>
      </section>

      {/* Approved Cue Cards Section */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: theme.text, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Poppins', sans-serif" }}>
            Approved Cue Cards
          </h2>
          <span style={{ fontSize: '13px', color: theme.textMuted }}>
            Tap any card to load into reading mode
          </span>
        </div>

        {/* Category Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          {(['all', 'opening', 'discovery', 'value', 'objections', 'pricing', 'close', 'do_not_promise'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                minHeight: '44px',
                background: selectedCategory === cat ? theme.navy : theme.cardBg,
                color: selectedCategory === cat ? '#FFFFFF' : theme.text,
                fontWeight: selectedCategory === cat ? 700 : 500,
                border: `2px solid ${theme.navy}`,
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '13px',
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              {cat.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Cards list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredCards.map((card) => (
            <div
              key={card.id}
              onClick={() => {
                setActiveCardForReading(card);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                background: theme.itemBg,
                border: card.category === 'do_not_promise' ? '2px solid rgba(239, 68, 68, 0.4)' : `2px solid ${theme.cardBorder}`,
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'border-color 0.15s, transform 0.1s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: card.category === 'do_not_promise' ? '#dc2626' : theme.textSecondary,
                    letterSpacing: '0.5px'
                  }}
                >
                  {card.category.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: '12px', color: theme.textMuted }}>Tap to read</span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: theme.text, marginBottom: '6px', fontFamily: "'Poppins', sans-serif" }}>
                {card.title}
              </div>
              <div style={{ fontSize: '15px', color: theme.textMuted, lineHeight: '1.5' }}>
                {card.summary}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mandatory Independence Notice */}
      <footer
        style={{
          borderTop: `1px solid ${theme.cardBorder}`,
          paddingTop: '16px',
          marginTop: '24px',
          fontSize: '12px',
          lineHeight: '1.5',
          color: theme.textMuted
        }}
      >
        Concludo is an independent product and is not affiliated with, endorsed by, or partnered with any device maker, meeting platform or note-taking service.
      </footer>
    </div>
  );
};
