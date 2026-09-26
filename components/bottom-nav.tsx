"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ellipsis,
  House,
  Presentation,
  ScrollText,
  Users,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Start", icon: House },
  { href: "/ustawy", label: "Ustawy", icon: ScrollText },
  { href: "/poslowie", label: "Posłowie", icon: Users },
  { href: "/obrady", label: "Obrady", icon: Presentation },
  { href: "/wiecej", label: "Więcej", icon: Ellipsis },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/onboarding") {
    return null;
  }

  return (
    <nav aria-label="Główna nawigacja" className="fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto w-full max-w-md border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);

            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors ${
                    isActive
                      ? "font-bold text-green-700"
                      : "font-medium text-slate-600 hover:text-navy-900"
                  }`}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    aria-hidden
                  />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
