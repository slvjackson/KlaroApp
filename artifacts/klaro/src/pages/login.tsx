import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { KlaroMark } from "@/components/KlaroMark";
import { AlertCircle, Eye, EyeOff, Shield, LayoutDashboard } from "lucide-react";

function AdminModal({ onGoApp, onGoAdmin }: { onGoApp: () => void; onGoAdmin: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-strong rounded-2xl p-7 w-full max-w-[340px] space-y-5">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-[rgba(106,248,47,0.1)] flex items-center justify-center">
            <Shield size={20} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-[17px] font-bold text-white">Bem-vindo, Admin</h2>
          <p className="text-[12.5px] text-[var(--muted)] text-center">Para onde você quer ir?</p>
        </div>
        <div className="space-y-2">
          <button
            onClick={onGoAdmin}
            className="w-full flex items-center justify-center gap-2 btn-primary py-2.5 rounded-xl text-[13.5px] font-semibold"
          >
            <Shield size={14} />
            Painel Admin
          </button>
          <button
            onClick={onGoApp}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13.5px] font-medium border border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:text-white hover:border-[rgba(255,255,255,0.25)] transition-colors"
          >
            <LayoutDashboard size={14} />
            Ir para o App
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setServerError(null);
    login.mutate(
      { data: { email: email.trim(), password } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          if ((data as any)?.user?.isAdmin) {
            setShowAdminModal(true);
          } else {
            setLocation("/dashboard");
          }
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? "";
          if (msg.toLowerCase().includes("bloqueada")) {
            setServerError(msg);
          } else if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("senha") || msg.toLowerCase().includes("email")) {
            setServerError("E-mail ou senha incorretos. Tente novamente.");
          } else {
            setServerError("Erro ao fazer login. Tente novamente em instantes.");
          }
        },
      }
    );
  }

  return (
    <>
    {showAdminModal && (
      <AdminModal
        onGoApp={() => { setShowAdminModal(false); setLocation("/dashboard"); }}
        onGoAdmin={() => { setShowAdminModal(false); setLocation("/admin"); }}
      />
    )}
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
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <KlaroMark size={44} />
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mt-2">gestão inteligente</div>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-7">
          <div className="mb-6">
            <h1 className="text-[20px] font-bold text-white">Entrar</h1>
            <p className="text-[12.5px] text-[var(--muted)] mt-0.5">Acesse sua conta para continuar</p>
          </div>

          {serverError && (
            <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl border border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)] text-[12.5px] text-[var(--expense)]">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{serverError}</span>
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

            <div>
              <label className="block text-[11.5px] font-medium text-[var(--muted)] mb-1.5">Senha</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className="field pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
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

            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-[12px] text-[var(--muted)] hover:text-white transition-colors">
                Esqueci minha senha
              </Link>
            </div>

            <button
              type="submit"
              disabled={login.isPending || !email.trim() || !password}
              className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold mt-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {login.isPending ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-5 text-center text-[12px] text-[var(--muted)]">
            Não tem conta?{" "}
            <Link href="/signup" className="text-[var(--accent)] hover:brightness-110 font-medium">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
