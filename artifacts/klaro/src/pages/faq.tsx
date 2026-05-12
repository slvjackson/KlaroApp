import { useLocation } from "wouter";
import {
  ArrowRight, Check, Sparkles,
  FileSearch, LayoutDashboard, MessageSquare, Target, Layers, UploadCloud,
} from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

export default function faq() {
  return (
    <LandingShell>
{/* FAQ-ish */}
      <section className="border-t border-white/10 py-20 bg-[#09090b]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-10">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Perguntas comuns</p>
            <h2 className="font-bold tracking-tight text-white" style={{ fontSize: "clamp(26px,3vw,40px)", lineHeight: 1.06 }}>
              Antes de começar.
            </h2>
          </div>
          <div className="space-y-4">
            {[
              { q: "Posso usar gratuitamente?", a: "Sim. Você tem 7 dias grátis para testar a ferramenta e verificar se faz sentido para seu negócio." },
              { q: "Posso trocar de plano depois?", a: "Pode fazer a migração de mensal pra semestral ou anual a qualquer hora — o crédito proporcional é considerado." },
              { q: "E se cancelar antes do ciclo terminar?", a: "Cancele quando quiser. No semestral e anual, você usa até o fim do período já pago. Não cobramos taxa de saída." },
              { q: "Tem limite de transações ou de uploads?", a: "Não para o uso normal de pequenas e médias empresas. Se houver um volume muito fora do padrão da plataforma, conversamos antes de qualquer ajuste." },
              { q: "Preciso entender de finanças pra usar?", a: "Não. O Klaro foi criado justamente para empresários que não querem perder horas organizando planilhas ou aprendendo termos financeiros complexos." },
              { q: "O Klaro funciona mesmo com dados bagunçados?", a: "Sim. Você pode enviar planilha, PDF, extrato, CSV, OFX, foto ou até anotações. O Klaro organiza e interpreta automaticamente." },
              { q: "O Klaro é contador?", a: "Não. O Klaro não substitui contabilidade. Ele ajuda você a entender melhor seu negócio, caixa, lucro e operação no dia a dia." },
              { q: "O Klaro funciona para qualquer tipo de negócio?", a: "Sim. Hoje o Klaro ajuda desde quem vende no dia a dia até empresas com operação mais complexa." },
              { q: "Posso conversar com a IA sobre qualquer área do meu negócio?", a: "Sim. Você pode perguntar sobre caixa, metas, fornecedores, vendas, marketing, crescimento e operação — usando os próprios dados da sua empresa." },
              { q: "Preciso conectar banco ou ERP?", a: "Não obrigatoriamente. Você pode começar apenas enviando arquivos da forma como já organiza hoje." },
              { q: "O Klaro serve para empresa pequena?", a: "Sim. O Klaro foi pensado principalmente para pequenas e médias empresas que precisam de clareza sem complexidade." },
              { q: "Os insights são automáticos?", a: "Sim. O Klaro identifica padrões, oportunidades e alertas automaticamente com base nos seus dados." },
              { q: "Por que o Klaro é diferente de um sistema financeiro comum?", a: "Porque o Klaro não foi criado só para registrar números — foi criado para ajudar empresários a entender decisões, encontrar oportunidades e crescer com mais clareza." },
            ].map((it, i) => (
              <div key={i} className="glass rounded-xl p-5 border border-white/10">
                <div className="text-[14px] font-semibold text-white mb-1.5">{it.q}</div>
                <p className="text-[13px] text-white/60 leading-relaxed">{it.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </LandingShell>
      );
}