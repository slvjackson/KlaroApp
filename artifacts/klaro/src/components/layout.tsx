import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Upload, ArrowLeftRight, Lightbulb, Sparkles, User, LogOut, Trophy, Mail, X, Menu, ChevronDown } from "lucide-react";
import { KlaroMark } from "@/components/KlaroMark";
import { useOnboardingHighlight } from "@/contexts/onboarding-highlight-context";
import { useChatContext } from "@/contexts/chat-context";
import { MobileChatSheet } from "@/components/mobile-chat-sheet";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",  icon: LayoutDashboard },
  { href: "/upload",       label: "Upload",     icon: Upload },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/insights",     label: "Insights",   icon: Lightbulb },
  { href: "/missions",     label: "Missões",    icon: Trophy },
  { href: "/chat",         label: "Chat Klaro", icon: Sparkles, badge: "IA" },
];

// Mobile bottom nav: 5 items. IA → floating action button. Perfil → avatar dropdown
// on the top bar. Onboarding pulses on items not in this list (Chat Klaro, Perfil)
// are routed to the FAB / avatar; the hamburger fallback covers anything else.
const BOTTOM_NAV = [
  { href: "/dashboard",    label: "Dashboard",  icon: LayoutDashboard },
  { href: "/transactions", label: "Transações", icon: ArrowLeftRight },
  { href: "/upload",       label: "Upload",     icon: Upload },
  { href: "/insights",     label: "Insights",   icon: Lightbulb },
  { href: "/missions",     label: "Missões",    icon: Trophy },
];

const BOTTOM_NAV_HREFS = new Set(BOTTOM_NAV.map((i) => i.href));

export function Layout({ children, title = "Dashboard" }: { children: ReactNode; title?: string }) {
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const { highlight } = useOnboardingHighlight();
  const { unreadCount } = useChatContext();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // For mobile: when the onboarding pulses a nav item that's NOT in the bottom nav
  // (e.g. Insights, Chat Klaro, Perfil), route the highlight to the matching
  // surfacing element on the mobile top bar — hamburger for drawer-only items, FAB
  // for chat, avatar for profile.
  const highlightFAB = highlight === "/chat";
  const highlightAvatar = highlight === "/profile";
  const highlightHamburger = !!highlight && !BOTTOM_NAV_HREFS.has(highlight) && !highlightFAB && !highlightAvatar;

  // Close avatar menu on outside click / route change.
  useEffect(() => {
    if (!avatarMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [avatarMenuOpen]);

  useEffect(() => {
    setAvatarMenuOpen(false);
  }, [location]);

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
      {/* ── Sidebar (desktop) ── */}
      <aside className="hidden md:flex flex-col w-[232px] shrink-0 h-screen sticky top-0 px-4 py-5 border-r border-[var(--border)] bg-[rgba(12,12,15,0.7)] backdrop-blur-xl">
        <Link href="/dashboard" className="flex items-center gap-3 px-1.5 mb-7">
          <KlaroMark size={22} />
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">gestão inteligente</div>
        </Link>

        <nav className="flex flex-col gap-0.5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]/70 px-2 mb-1.5">Geral</div>
          {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
            const isActive = location === href || location.startsWith(href + "/");
            const isHighlighted = highlight === href;
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  isHighlighted
                    ? "nav-highlight"
                    : isActive
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

        <div className="mt-auto pt-4 flex flex-col gap-0.5">
          <Link
            href="/profile"
            className={`nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              highlight === "/profile"
                ? "nav-highlight"
                : location === "/profile"
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

      {/* ── Mobile drawer overlay ── */}
      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col px-4 py-5 bg-[rgba(12,12,15,0.97)] border-r border-[var(--border)] md:hidden">
            <div className="flex items-center justify-between mb-7 px-1.5">
              <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
                <KlaroMark size={22} />
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">gestão inteligente</div>
              </Link>
              <button onClick={() => setMobileMenuOpen(false)} className="text-[var(--muted)] hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]/70 px-2 mb-1.5">Geral</div>
              {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
                const isActive = location === href || location.startsWith(href + "/");
                const isHighlighted = highlight === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-lg text-[14px] font-medium transition-colors ${
                      isHighlighted
                        ? "nav-highlight"
                        : isActive
                        ? "text-white bg-[rgba(106,248,47,0.12)]"
                        : "text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"
                    }`}
                  >
                    <Icon size={17} className="shrink-0" />
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

            <div className="mt-auto pt-4 flex flex-col gap-0.5">
              <Link
                href="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-3 rounded-lg text-[14px] font-medium transition-colors ${
                  highlight === "/profile"
                    ? "nav-highlight"
                    : location === "/profile"
                    ? "text-white bg-[rgba(106,248,47,0.12)]"
                    : "text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                <User size={17} />
                <span>Perfil</span>
              </Link>
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-2.5 px-3 py-3 rounded-lg text-[14px] font-medium text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)] transition-colors"
              >
                <LogOut size={17} />
                <span>Sair</span>
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2.5 px-1 border-t border-[var(--border)] pt-3">
              <div className="w-8 h-8 rounded-full bg-[#1c2018] border border-[rgba(106,248,47,0.3)] grid place-items-center text-[11px] font-bold text-[#6af82f] shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-[13px] font-semibold text-white truncate">{user?.name ?? "—"}</div>
                <div className="text-[11px] text-[var(--muted)] truncate">{user?.email ?? ""}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Main ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 md:px-8 py-4 border-b border-[var(--border)] bg-[rgba(9,9,11,0.5)] backdrop-blur-xl sticky top-0 z-20">
          {/* Hamburger (mobile only) — pulses when the onboarding points at a nav
              item that lives in the drawer (Insights). */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`md:hidden p-1 -ml-1 transition-colors rounded-md ${
              highlightHamburger ? "nav-highlight" : "text-[var(--muted)] hover:text-white"
            }`}
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            <span className="hidden sm:inline">Klaro</span>
            <svg className="hidden sm:block" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
            <span className="text-white font-medium">{title}</span>
          </div>
          <div className="flex-1" />
          <Link href="/dashboard" className="md:hidden">
            <KlaroMark size={22} />
          </Link>

          {/* Avatar dropdown (mobile only) */}
          <div ref={avatarMenuRef} className="md:hidden relative">
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((v) => !v)}
              className={`flex items-center gap-1 rounded-full p-0.5 pr-1.5 border border-[var(--border)] transition-colors ${
                highlightAvatar ? "nav-highlight" : "hover:border-[var(--border-2)]"
              }`}
              aria-expanded={avatarMenuOpen}
              aria-label="Abrir menu de perfil"
            >
              <span className="w-7 h-7 rounded-full bg-[#1c2018] border border-[rgba(106,248,47,0.3)] grid place-items-center text-[10.5px] font-bold text-[#6af82f]">
                {initials}
              </span>
              <ChevronDown
                size={12}
                className="text-[var(--muted)] transition-transform"
                style={{ transform: avatarMenuOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>
            {avatarMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-white/15 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden" style={{ background: "rgba(16,16,20,0.97)" }}>
                <div className="px-3.5 py-3 border-b border-white/10">
                  <div className="text-[12.5px] font-semibold text-white truncate">{user?.name ?? "—"}</div>
                  <div className="text-[10.5px] text-[var(--muted)] truncate">{user?.email ?? ""}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setAvatarMenuOpen(false); setLocation("/profile"); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-white/85 hover:bg-white/5 transition-colors"
                >
                  <User size={14} className="text-[var(--muted)]" />
                  Perfil
                </button>
                <button
                  type="button"
                  onClick={() => { setAvatarMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] text-white/85 hover:bg-white/5 transition-colors border-t border-white/10"
                >
                  <LogOut size={14} className="text-[var(--muted)]" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Email verification banner */}
        {showVerifyBanner && (
          <div className="flex items-center gap-3 px-4 md:px-8 py-2.5 bg-[rgba(106,248,47,0.08)] border-b border-[rgba(106,248,47,0.2)] text-[12.5px]">
            <Mail size={14} className="shrink-0 text-[var(--accent)]" />
            <span className="flex-1 text-[var(--muted)] text-[12px]">
              Confirme seu e-mail.{" "}
              {resendDone ? (
                <span className="text-[var(--accent)]">Link enviado!</span>
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
            <button onClick={() => setBannerDismissed(true)} className="text-[var(--muted)] hover:text-white transition-colors">
              <X size={14} />
            </button>
          </div>
        )}

        <main className="flex-1 min-w-0 px-4 md:px-8 py-5 md:py-6 overflow-y-auto klaro-scroll pb-24 md:pb-6">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch border-t border-[var(--border)] bg-[rgba(9,9,11,0.92)] backdrop-blur-xl">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const isActive = location === href || location.startsWith(href + "/");
          const isHighlighted = highlight === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isHighlighted ? "nav-highlight rounded-none" : isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Mobile IA floating action button ── */}
      {location !== "/chat" && (
        <button
          type="button"
          onClick={() => setChatSheetOpen(true)}
          aria-label="Abrir chat com a IA"
          className={`md:hidden fixed right-4 z-40 grid h-14 w-14 place-items-center rounded-full text-[#09090b] shadow-[0_12px_32px_-10px_rgba(106,248,47,0.7)] transition-transform active:scale-95 ${
            highlightFAB ? "nav-highlight" : ""
          }`}
          style={{
            // Sits just above the bottom nav (bottom-nav has py-2.5 + ~30px content = ~56px).
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 72px)",
            background: highlightFAB ? undefined : "linear-gradient(180deg, #6af82f, #4de020)",
          }}
        >
          <Sparkles size={22} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-[#f43f5e] border-2 border-[#09090b] grid place-items-center text-[10px] font-bold text-white tnum">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      )}

      <MobileChatSheet open={chatSheetOpen} onClose={() => setChatSheetOpen(false)} />
    </div>
  );
}
