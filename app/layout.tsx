"use client";

import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/companies", label: "Companies" },
  { href: "/contacts", label: "Contacts" },
  { href: "/deals", label: "Deals" },
  { href: "/tasks", label: "Tasks" }
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="flex min-h-screen">
          <aside className="flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 max-md:fixed max-md:inset-y-0 max-md:z-20 max-md:w-60">
            <div className="mb-8 flex items-center justify-between">
              <span className="text-xl font-semibold tracking-tight">
                GrowthStack CRM
              </span>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="flex-1 max-md:ml-0 max-md:pt-4 md:ml-64">
            <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}



