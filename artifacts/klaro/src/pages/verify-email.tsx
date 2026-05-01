import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { KlaroMark } from "@/components/KlaroMark";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setStatus("error");
      setMessage("Link inválido. Solicite um novo e-mail de verificação.");
      return;
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message ?? "E-mail confirmado com sucesso!");
        } else {
          setStatus("error");
          setMessage(data.error ?? "Link inválido ou expirado. Solicite um novo.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Erro de conexão. Tente novamente.");
      });
  }, []);

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

        <div className="glass-strong rounded-2xl p-7 text-center">
          {status === "loading" && (
            <>
              <Loader2 size={40} className="mx-auto mb-4 animate-spin text-[var(--accent)]" />
              <h1 className="text-[18px] font-bold text-white mb-2">Verificando e-mail…</h1>
              <p className="text-[13px] text-[var(--muted)]">Aguarde um momento.</p>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle size={40} className="mx-auto mb-4 text-[var(--accent)]" />
              <h1 className="text-[18px] font-bold text-white mb-2">E-mail confirmado!</h1>
              <p className="text-[13px] text-[var(--muted)] mb-6">{message}</p>
              <button
                onClick={() => setLocation("/dashboard")}
                className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold"
              >
                Ir para o Dashboard
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle size={40} className="mx-auto mb-4 text-[var(--expense)]" />
              <h1 className="text-[18px] font-bold text-white mb-2">Link inválido</h1>
              <p className="text-[13px] text-[var(--muted)] mb-6">{message}</p>
              <button
                onClick={() => setLocation("/dashboard")}
                className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold"
              >
                Voltar ao Dashboard
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
