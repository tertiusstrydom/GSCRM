"use client";

import "./globals.css";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { getUserRole, canManageUsers, type Role } from "@/lib/permissions";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/companies", label: "Companies" },
  { href: "/contacts", label: "Contacts" },
  { href: "/deals", label: "Deals" },
  { href: "/tasks", label: "Tasks" }
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    const supabase = createSupabaseClient();

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const role = await getUserRole();
        setUserRole(role);
      }
      setLoading(false);

      // Redirect logic
      if (!session && !isLoginPage) {
        router.push("/login");
      } else if (session && isLoginPage) {
        router.push("/");
      }
    });

    // Listen for auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const role = await getUserRole();
        setUserRole(role);
      } else {
        setUserRole(null);
      }
      if (!session && !isLoginPage) {
        router.push("/login");
      } else if (session && isLoginPage) {
        router.push("/");
      }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, isLoginPage]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  // Show login page without sidebar
  if (isLoginPage) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-slate-50 text-slate-900">
          {children}
        </body>
      </html>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <html lang="en">
        <body className="min-h-screen bg-slate-50 text-slate-900">
          <div className="flex min-h-screen items-center justify-center">
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        </body>
      </html>
    );
  }

  // Show app with sidebar
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
              {userRole && canManageUsers(userRole) && (
                <Link
                  href="/users"
                  className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    pathname.startsWith("/users")
                      ? "bg-primary text-white"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Users
                </Link>
              )}
            </nav>
            <div className="mt-auto pt-4">
              {user && (
                <div className="mb-2 space-y-1 px-3">
                  <div className="text-xs text-slate-500">{user.email}</div>
                  {userRole && (
                    <div className="text-xs font-medium text-slate-700 capitalize">
                      Role: {userRole}
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </aside>
          <main className="flex-1 max-md:ml-0 max-md:pt-4 md:ml-64">
            <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}



