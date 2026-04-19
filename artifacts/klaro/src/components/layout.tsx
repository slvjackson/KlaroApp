import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useLogout, useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Home, Upload, List, Lightbulb, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", icon: Home, label: "Dashboard" },
  { href: "/upload", icon: Upload, label: "Upload" },
  { href: "/transactions", icon: List, label: "Transações" },
  { href: "/insights", icon: Lightbulb, label: "Insights" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/");
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-56 bg-card border-r border-border flex flex-col md:h-screen md:sticky top-0 shrink-0">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-border">
          <Link href="/dashboard">
            <span className="text-xl font-bold tracking-tight select-none cursor-pointer">
              klaro<span className="text-primary">.</span>
            </span>
          </Link>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const isActive = location === href || location.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
                style={{ borderRadius: "6px" }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer: profile + logout */}
        <div className="p-3 border-t border-border space-y-0.5">
          <Link
            href="/profile"
            className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-colors w-full ${
              location === "/profile"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            style={{ borderRadius: "6px" }}
          >
            <User className="w-4 h-4 shrink-0" />
            <span className="truncate">{user?.name ?? "Perfil"}</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            style={{ borderRadius: "6px" }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-x-hidden min-h-screen p-6 md:p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
