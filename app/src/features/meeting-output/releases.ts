/**
 * Written release switches for the full meeting report. Both stay false until the director's written release.
 *   TIMELINE_RELEASED: set to true only after Anthony writes "release the timeline".
 *   DECK_RELEASED:     set to true only after Anthony writes "release the deck".
 * Plan gating still applies on top: Pro, Pro trial, Team and Enterprise only (feature keys
 * action_timeline_export and deck_export). Starter never sees either section.
 */
export const TIMELINE_RELEASED = true;
export const DECK_RELEASED = false;
