import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  const [, setLocation] = useLocation();

  return (
    <div
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(1200px 600px at 80% -10%, rgba(106,248,47,0.08), transparent 60%),
          #09090b
        `,
      }}
    >
      <div className="max-w-2xl mx-auto px-5 py-10">
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}
          className="flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>

        <article className="prose-custom text-[var(--muted)] text-[14px] leading-relaxed space-y-6">
          <header>
            <h1 className="text-[22px] font-bold text-white">POLÍTICA DE PRIVACIDADE – KLARO</h1>
            <p className="text-[12.5px] mt-1">Última atualização: 04 de maio de 2026</p>
          </header>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">1. Dados coletados</h2>
            <p>Podemos coletar:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Dados cadastrais, como nome, email, cidade e informações relacionadas ao negócio.</li>
              <li>Dados financeiros enviados pelo usuário.</li>
              <li>Informações de uso da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">2. Como usamos os dados</h2>
            <p>Utilizamos os dados para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Operar a plataforma.</li>
              <li>Gerar insights financeiros e de negócio.</li>
              <li>Melhorar o produto e a experiência do usuário.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">3. Compartilhamento de dados</h2>
            <p>O Klaro:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Não vende dados.</li>
              <li>Não compartilha dados com terceiros para fins comerciais.</li>
            </ul>
            <p className="mt-2">Podemos compartilhar dados apenas quando necessário para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Cumprimento de obrigações legais.</li>
              <li>Funcionamento técnico da plataforma, como servidores, hospedagem e infraestrutura.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">4. Armazenamento e segurança</h2>
            <p>
              Os dados são armazenados em ambientes seguros, com medidas técnicas adequadas de proteção.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">5. Direitos do usuário</h2>
            <p>O usuário pode:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Solicitar acesso aos seus dados.</li>
              <li>Corrigir informações.</li>
              <li>Solicitar exclusão de dados.</li>
              <li>Revogar consentimento, quando aplicável.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">6. Retenção de dados</h2>
            <p>
              Os dados são mantidos enquanto a conta estiver ativa ou conforme exigido por lei.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">7. Consentimento</h2>
            <p>
              Ao utilizar o Klaro, o usuário concorda com esta Política de Privacidade.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}