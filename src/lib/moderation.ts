import {
  RegExpMatcher,
  TextCensor,
  asteriskCensorStrategy,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

/**
 * Text moderation for comments, advice, group messages, bios and names.
 * Profanity and slurs are masked (leetspeak & look-alike characters are normalised first).
 * Everything else is handled by user reports + the admin queue.
 */
const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });
const censor = new TextCensor().setStrategy(asteriskCensorStrategy());

export function censorText(input: string): string {
  const matches = matcher.getAllMatches(input, true);
  return matches.length ? censor.applyTo(input, matches) : input;
}

export function containsBlockedLanguage(input: string): boolean {
  return matcher.hasMatch(input);
}

/** Collapse whitespace runs and strip control characters. */
export function normalizeText(input: string): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanUserText(input: string): string {
  return censorText(normalizeText(input));
}

/** Auto-hide comments/messages once this many distinct users report them, pending admin review. */
export const AUTO_HIDE_REPORT_THRESHOLD = 3;
