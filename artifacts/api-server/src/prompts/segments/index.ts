import type { SegmentProfile } from "../types";
import { varejo } from "./varejo";
import { alimentacao } from "./alimentacao";
import { servicos } from "./servicos";
import { saude } from "./saude";
import { educacao } from "./educacao";
import { tecnologia } from "./tecnologia";
import { construcao } from "./construcao";
import { transporte } from "./transporte";
import { agro } from "./agro";
import { outro } from "./outros";

export { varejo, alimentacao, servicos, saude, educacao, tecnologia, construcao, transporte, agro, outro };

const SEGMENT_REGISTRY: Record<string, SegmentProfile> = {
  varejo,
  alimentacao,
  servicos,
  saude,
  educacao,
  tecnologia,
  construcao,
  transporte,
  agro,
  outro,
};

/**
 * Returns the SegmentProfile for the given segment key, falling back to `outro`.
 * When segment is "outro" and a customLabel is provided, injects the label
 * so prompts reference the user's actual business type.
 */
export function getSegmentProfile(segment?: string | null, customLabel?: string | null): SegmentProfile {
  if (!segment) return outro;
  const profile = SEGMENT_REGISTRY[segment.toLowerCase()] ?? outro;
  if (segment === "outro" && customLabel?.trim()) {
    return { ...profile, label: customLabel.trim() };
  }
  return profile;
}