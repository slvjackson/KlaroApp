import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
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
            <h1 className="text-[22px] font-bold text-white">TERMOS DE USO – KLARO</h1>
            <p className="text-[12.5px] mt-1">Última atualização: 04 de maio de 2026</p>
          </header>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">1. Sobre o Klaro</h2>
            <p>
              O Klaro é uma plataforma digital que permite ao usuário organizar dados financeiros,
              analisar informações e gerar insights para melhor gestão do seu negócio.
            </p>
            <p className="mt-2">Ao utilizar o Klaro, você concorda com estes Termos de Uso.</p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">2. Cadastro e uso da plataforma</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>O usuário é responsável pela veracidade das informações fornecidas.</li>
              <li>O acesso é pessoal e intransferível.</li>
              <li>O usuário é responsável por manter suas credenciais seguras.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">3. Propriedade dos dados</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Todos os dados inseridos no Klaro são <strong className="text-white">de propriedade exclusiva do usuário</strong>.</li>
              <li>O Klaro <strong className="text-white">não reivindica qualquer direito sobre os dados enviados</strong>.</li>
              <li>O usuário pode solicitar a exclusão de seus dados a qualquer momento.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">4. Uso das informações</h2>
            <p>O Klaro utiliza os dados inseridos exclusivamente para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Organizar informações financeiras</li>
              <li>Gerar análises e insights</li>
              <li>Melhorar a experiência do usuário na plataforma</li>
            </ul>
            <p className="mt-2">
              O Klaro <strong className="text-white">não vende, aluga ou compartilha dados com terceiros para fins comerciais.</strong>
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">5. Confidencialidade</h2>
            <p>O Klaro se compromete a:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Tratar os dados do usuário como confidenciais</li>
              <li>Não acessar informações sem necessidade operacional</li>
              <li>Utilizar medidas de segurança para proteção dos dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-white mt-6 mb-2">6. Segurança da informação</h2>
            <p>Adotamos boas práticas de mercado para proteção dos dados, incluindo:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Criptografia de dados</li>
              <li>Controle de acesso</li>
              <li>Monitoramento de segurança</li>
            </ul>
            <p className="mt-2">
              Apesar disso, nenhum sistema é 100% imune a falhas, e o usuário declara estar ciente desse risco.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
