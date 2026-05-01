import { useState } from "react";
import { useLocation } from "wouter";
import { KlaroMark } from "@/components/KlaroMark";
import { AlertCircle, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
      } else {
        setError(data.error ?? "Erro ao redefinir senha. Tente novamente.");
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "#09090b" }}>
        <div className="glass-strong rounded-2xl p-7 max-w-[380px] w-full text-center">
          <AlertCircle size={40} className="mx-auto mb-4 text-[var(--expense)]" />
          <h1 className="text-[18px] font-bold text-white mb-2">Link inválido</h1>
          <p className="text-[13px] text-[var(--muted)] mb-6">
            Este link de recuperação é inválido. Solicite um novo.
          </p>
          <button onClick={() => setLocation("/forgot-password")} className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold">
            Solicitar novo link
          </button>
        </div>
      </div>
    );
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
          {done ? (
            <div className="text-center">
              <CheckCircle size={40} className="mx-auto mb-4 text-[var(--accent)]" />
              <h1 className="text-[18px] font-bold text-white mb-2">Senha redefinida!</h1>
              <p className="text-[13px] text-[var(--muted)] mb-6">
                Sua senha foi alterada com sucesso. Faça login com a nova senha.
              </p>
              <button
                onClick={() => setLocation("/login")}
                className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold"
              >
                Ir para o login
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-[20px] font-bold text-white">Nova senha</h1>
                <p className="text-[12.5px] text-[var(--muted)] mt-0.5">
                  Escolha uma nova senha para sua conta.
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
                  <label className="block text-[11.5px] font-medium text-[var(--muted)] mb-1.5">Nova senha</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      className="field pr-10"
                      placeholder="Mín. 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white transition-colors"
                    >
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11.5px] font-medium text-[var(--muted)] mb-1.5">Confirmar senha</label>
                  <input
                    type={showPw ? "text" : "password"}
                    className="field"
                    placeholder="Repita a senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold mt-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {loading ? "Salvando…" : "Salvar nova senha"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
