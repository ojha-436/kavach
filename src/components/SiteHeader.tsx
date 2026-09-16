"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/analyze", label: "Your document" },
  { href: "/judgments", label: "Judgments" },
  { href: "/history", label: "History" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, error, signIn, signOut, dismissError } = useAuth();

  return (
    <header className="border-b border-rule bg-paper-raised">
      {error && (
        <div role="alert" className="border-b border-seal bg-seal-wash">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-2 text-sm text-seal">
            <span>{error}</span>
            <button
              onClick={dismissError}
              className="ml-auto underline-offset-4 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
        <Link href="/" className="font-display text-lg font-semibold tracking-tight text-ink">
          Kavach <span lang="hi" className="text-ink-faint">कवच</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-2.5 py-1.5 transition-colors ${
                  active
                    ? "bg-paper-sunk text-ink"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <ThemeToggle />
          {loading ? null : user ? (
            <>
              {user.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.photoURL}
                  alt=""
                  className="size-7 rounded-full border border-rule"
                />
              ) : null}
              <span className="hidden text-ink-soft sm:inline">
                {user.displayName ?? user.email}
              </span>
              <button
                onClick={signOut}
                className="text-ink-soft underline-offset-4 hover:text-ink hover:underline"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={signIn}
              className="rounded border border-ink px-3 py-1.5 font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              Sign in with Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
