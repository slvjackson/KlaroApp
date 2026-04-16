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
import { outro } from "./outro";

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

/** Returns the SegmentProfile for the given segment key, falling back to `outro`. */
export function getSegmentProfile(segment?: string | null): SegmentProfile {
  if (!segment) return outro;
  return SEGMENT_REGISTRY[segment.toLowerCase()] ?? outro;
}