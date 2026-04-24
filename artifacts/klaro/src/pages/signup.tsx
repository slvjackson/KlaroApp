import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useSignup } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { KlaroMark } from "@/components/KlaroMark";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

export default function Signup() {
  const [, setLocation] = useLocation();
  const signup = useSignup();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) return;
    setServerError(null);
    signup.mutate(
      { data: { name: name.trim(), email: email.trim(), password } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? err?.message ?? "";
          if (msg.toLowerCase().includes("already") || msg.includes("409")) {
            setServerError("Este e-mail já está cadastrado. Tente fazer login.");
          } else {
            setServerError("Erro ao criar conta. Tente novamente em instantes.");
          }
        },
      }
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: `
          radial-gradient(1200px 600px at 80% -10%, rgba(124,92,255,0.12), transparent 60%),
          radial-gradient(800px 500px at -5% 110%, rgba(91,140,255,0.08), transparent 60%),
          #09090b
        `,
      }}
    >
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <KlaroMark size={44} />
          <div className="mt-3 text-[22px] font-bold tracking-tight text-white">
            klaro<span style={{ color: "var(--accent)" }}>.</span>
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] mt-0.5">finanças claras</div>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-7">
          <div className="mb-6">
            <h1 className="text-[20px] font-bold text-white">Criar conta</h1>
            <p className="text-[12.5px] text-[var(--muted)] mt-0.5">Comece a organizar suas finanças</p>
          </div>

          {serverError && (
            <div className="mb-4 flex items-start gap-2 px-3 py-2.5 rounded-xl border border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.08)] text-[12.5px] text-[var(--expense)]">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-medium text-[var(--muted)] mb-1.5">Nome</label>
              <input
                type="text"
                className="field"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

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

            <button
              type="submit"
              disabled={signup.isPending || !name.trim() || !email.trim() || !password}
              className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold text-white mt-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {signup.isPending ? "Criando conta…" : "Criar conta grátis"}
            </button>
          </form>

          <p className="mt-5 text-center text-[12px] text-[var(--muted)]">
            Já tem conta?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:brightness-110 font-medium">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
