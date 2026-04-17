/**
 * Prompt builder — single entry point for all AI prompt construction.
 * Combines the base templates with segment-specific profiles.
 */

export { buildOcrPrompt } from "./base/ocr";
export type { OcrPromptContext } from "./base/ocr";

export { buildInsightsPrompt } from "./base/insights";
export type { InsightsPromptContext } from "./base/insights";

export { getSegmentProfile } from "./segments/index";
export type { SegmentProfile } from "./types";