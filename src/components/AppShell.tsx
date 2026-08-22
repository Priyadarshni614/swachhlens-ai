import { Link, useRouterState } from "@tanstack/react-router";
import { Camera, LayoutList, Map, Truck } from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Report", icon: Camera },
  { to: "/hotspots", label: "Hotspots", icon: Map },
  { to: "/reports", label: "Feed", icon: LayoutList },
  { to: "/dispatch", label: "Dispatch", icon: Truck },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background shadow-lift">
        <header className="sticky top-0 z-20 bg-gradient-ink px-5 pt-6 pb-5 text-primary-foreground">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-signal text-signal-foreground">
              <Camera className="size-4" />
            </span>
            <span className="text-eyebrow opacity-80">SwachhLens</span>
          </div>
          <h1 className="mt-3 text-2xl leading-tight">{title}</h1>
          <p className="mt-1 text-sm opacity-70">{subtitle}</p>
        </header>

        <main className="flex-1 px-4 pt-4 pb-28">{children}</main>

        <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur">
          <ul className="grid grid-cols-4">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <li key={to}>
                  <Link
                    to={to}
                    className={`flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`grid size-9 place-items-center rounded-xl transition-all ${
                        active ? "bg-gradient-signal text-signal-foreground shadow-glow" : ""
                      }`}
                    >
                      <Icon className="size-4" />
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
