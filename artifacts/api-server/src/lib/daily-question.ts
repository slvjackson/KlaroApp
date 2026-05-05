import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";
import { logTokenUsage } from "./token-logger";
import { getSegmentProfile } from "../prompts/builder";

const FALLBACK_QUESTIONS = [
  "Qual seu maior desafio financeiro nesta semana?",
  "Qual cliente ou produto trouxe mais retorno este mês?",
  "Onde você acha que está perdendo dinheiro sem perceber?",
  "Se sobrar caixa este mês, onde você investiria?",
  "Que decisão financeira você adiou por insegurança?",
];

export async function generateDailyQuestion(
  userId: number,
  ctx: {
    name?: string;
    segment?: string;
    segmentCustomLabel?: string;
    maiorDificuldade?: string;
    tempoMercado?: string;
  },
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)]!;
  }

  const profile = getSegmentProfile(ctx.segment, ctx.segmentCustomLabel);

  const prompt = `Gere UMA pergunta de auto-reflexão diária para um dono de pequeno negócio brasileiro.

Contexto:
- Segmento: ${profile.label}
- Tempo no mercado: ${ctx.tempoMercado ?? "não informado"}
- Maior dificuldade: ${ctx.maiorDificuldade ?? "não informada"}

A pergunta deve:
- Ter no máximo 18 palavras
- Provocar reflexão estratégica ou financeira
- Ser específica ao segmento ${profile.label}
- Não exigir consulta a dados externos
- Ser respondível em 1-2 frases

Retorne SOMENTE a pergunta, sem aspas, sem prefixos como "Pergunta:" ou similares.`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const MODEL = "claude-haiku-4-5-20251001";
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });
    logTokenUsage(userId, "daily_question", MODEL, response.usage.input_tokens, response.usage.output_tokens);

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    const cleaned = text.replace(/^["']|["']$/g, "").replace(/^Pergunta:\s*/i, "").trim();

    if (!cleaned || cleaned.length > 200) {
      return FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)]!;
    }
    return cleaned;
  } catch (err) {
    logger.warn({ err, userId }, "Failed to generate daily question, using fallback");
    return FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)]!;
  }
}
