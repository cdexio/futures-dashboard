"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  History,
  LayoutDashboard,
  LogOut,
  Settings,
  Wallet,
} from "lucide-react";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trade", label: "Trade", icon: Activity },
  { href: "/history", label: "History", icon: History },
  { href: "/assets", label: "Assets", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
];

/**
 * The application shell: brand, navigation, and the page-transition boundary.
 *
 * THE NAV DOES NOT RE-MOUNT BETWEEN PAGES. Only the children animate, so the
 * active-item indicator can slide from one tab to the next with `layoutId`
 * instead of fading out and in. A shell that re-renders whole makes every
 * navigation feel like a page load, which is the thing a single-page app is
 * for avoiding.
 */
export function Shell({ children, email }: { children: React.ReactNode; email?: string | null }) {
  const pathname = usePathname();

  return (
    <div className="relative z-10 flex min-h-screen">
      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r p-6 lg:flex">
        <div>
          <Link href="/" className="group mb-10 flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 8, scale: 1.06 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              className="ring-solana grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-solana)] to-[var(--color-mint)]"
            >
              <BarChart3 className="h-5 w-5 text-black" strokeWidth={2.5} />
            </motion.div>
            <div>
              <div className="text-lg leading-none font-semibold tracking-tight">CDEXIO</div>
              <div className="text-[var(--color-ink-muted)] mt-1 text-[11px] tracking-[0.18em] uppercase">
                Futures Agent
              </div>
            </div>
          </Link>

          <nav className="space-y-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors",
                    active
                      ? "text-[var(--color-ink)]"
                      : "text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)]",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-xl border border-[var(--color-solana-dim)] bg-[var(--color-solana)]/12"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" strokeWidth={2} />
                  <span className="relative font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t pt-4">
          <div className="text-[var(--color-ink-muted)] truncate text-xs">{email}</div>
          <Link
            href="/api/auth/signout"
            className="text-[var(--color-ink-secondary)] mt-2 flex items-center gap-2 text-xs transition-colors hover:text-[var(--color-loss)]"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Link>
        </div>
      </aside>

      {/* Mobile nav. A trading dashboard gets opened on a phone at the worst
          possible moment, so the same five destinations are one tap away. */}
      <nav className="glass fixed inset-x-0 bottom-0 z-50 flex justify-around border-t px-2 py-2 lg:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[10px]",
                active ? "text-[var(--color-solana-bright)]" : "text-[var(--color-ink-muted)]",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <main className="min-w-0 flex-1 pb-24 lg:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-[1600px] px-5 py-8 lg:px-10"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
