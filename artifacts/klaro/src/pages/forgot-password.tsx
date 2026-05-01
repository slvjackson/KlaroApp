import { useState } from "react";
import { Link } from "wouter";
import { KlaroMark } from "@/components/KlaroMark";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
        credentials: "include",
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error ?? "Erro ao enviar. Tente novamente.");
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `
          radial-gradient(1200px 600px at 80% -10%, rgba(106,248,47,0.12), transparent 60%),
          radial-gradient(800px 500px at -5% 110%, rgba(106,248,47,0.08), transparent 60%),
          #09090b
        `,
      }}
    >
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <KlaroMark size={44} />
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mt-2">gestão inteligente</div>
        </div>

        <div className="glass-strong rounded-2xl p-7">
          {sent ? (
            <div className="text-center">
              <CheckCircle size={40} className="mx-auto mb-4 text-[var(--accent)]" />
              <h1 className="text-[18px] font-bold text-white mb-2">E-mail enviado!</h1>
              <p className="text-[13px] text-[var(--muted)] mb-6">
                Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha em breve.
                Verifique também a caixa de spam.
              </p>
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 text-[13px] text-[var(--muted)] hover:text-white transition-colors"
              >
                <ArrowLeft size={14} />
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-[20px] font-bold text-white">Recuperar senha</h1>
                <p className="text-[12.5px] text-[var(--muted)] mt-0.5">
                  Informe seu e-mail e enviaremos um link para criar uma nova senha.
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl border border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)] text-[12.5px] text-[var(--expense)]">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11.5px] font-medium text-[var(--muted)] mb-1.5">E-mail</label>
                  <input
                    type="email"
                    className="field"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold mt-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? "Enviando…" : "Enviar link"}
                </button>
              </form>

              <p className="mt-5 text-center text-[12px] text-[var(--muted)]">
                Lembrou a senha?{" "}
                <Link href="/login" className="text-[var(--accent)] hover:brightness-110 font-medium">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
