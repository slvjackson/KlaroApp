import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Upload, ArrowLeftRight, Lightbulb, Sparkles, User, LogOut, Trophy, Mail, X } from "lucide-react";
import { KlaroMark } from "@/components/KlaroMark";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",  icon: LayoutDashboard },
  { href: "/upload",       label: "Upload",     icon: Upload },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/insights",     label: "Insights",   icon: Lightbulb },
  { href: "/missions",     label: "Missões",    icon: Trophy },
  { href: "/chat",         label: "Chat Klaro", icon: Sparkles, badge: "IA" },
];

export function Layout({ children, title = "Dashboard" }: { children: ReactNode; title?: string }) {
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const showVerifyBanner = user && !user.emailVerifiedAt && !bannerDismissed;

  async function handleResend() {
    setResending(true);
    try {
      await fetch("/api/auth/resend-verification", { method: "POST", credentials: "include" });
      setResendDone(true);
    } finally {
      setResending(false);
    }
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
      },
    });
  };

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
    : "??";

  return (
    <div className="flex min-h-screen bg-ambient">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-[232px] shrink-0 h-screen sticky top-0 px-4 py-5 border-r border-[var(--border)] bg-[rgba(12,12,15,0.7)] backdrop-blur-xl">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-3 px-1.5 mb-7">
          <KlaroMark size={22} />
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">gestão inteligente</div>
        </Link>

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]/70 px-2 mb-1.5">Geral</div>
          {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
            const isActive = location === href || location.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isActive
                    ? "text-white bg-[rgba(106,248,47,0.12)] active"
                    : "text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-br from-[#6af82f] to-[#4de020] text-[#09090b]">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Secondary nav */}
        <div className="mt-auto pt-4 flex flex-col gap-0.5">
          <Link
            href="/profile"
            className={`nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              location === "/profile"
                ? "text-white bg-[rgba(106,248,47,0.12)] active"
                : "text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"
            }`}
          >
            <User size={16} />
            <span>Perfil</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)] transition-colors"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>

        {/* User chip */}
        <div className="mt-3 flex items-center gap-2.5 px-1 py-1 border-t border-[var(--border)] pt-3">
          <div className="w-8 h-8 rounded-full bg-[#1c2018] border border-[rgba(106,248,47,0.3)] grid place-items-center text-[11px] font-bold text-[#6af82f] shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[12.5px] font-semibold text-white truncate">{user?.name ?? "—"}</div>
            <div className="text-[11px] text-[var(--muted)] truncate">{user?.email ?? ""}</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 md:px-8 py-4 border-b border-[var(--border)] bg-[rgba(9,9,11,0.5)] backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            <span>Klaro</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
            <span className="text-white">{title}</span>
          </div>
          <div className="flex-1" />
          {/* Mobile logo */}
          <Link href="/dashboard" className="md:hidden">
            <KlaroMark size={24} />
          </Link>
        </div>

        {showVerifyBanner && (
          <div className="flex items-center gap-3 px-6 md:px-8 py-2.5 bg-[rgba(106,248,47,0.08)] border-b border-[rgba(106,248,47,0.2)] text-[12.5px]">
            <Mail size={14} className="shrink-0 text-[var(--accent)]" />
            <span className="flex-1 text-[var(--muted)]">
              Confirme seu e-mail para garantir acesso à sua conta.{" "}
              {resendDone ? (
                <span className="text-[var(--accent)]">Link enviado! Verifique sua caixa de entrada.</span>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-[var(--accent)] hover:brightness-110 font-medium underline underline-offset-2 disabled:opacity-50"
                >
                  {resending ? "Enviando…" : "Reenviar e-mail"}
                </button>
              )}
            </span>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-[var(--muted)] hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <main className="flex-1 min-w-0 px-6 md:px-8 py-6 overflow-y-auto klaro-scroll">
          {children}
        </main>
      </div>
    </div>
  );
}
