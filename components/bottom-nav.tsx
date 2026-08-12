"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ellipsis,
  House,
  Presentation,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Start", icon: House },
  { href: "/poslowie", label: "Posłowie", icon: Users },
  { href: "/obrady", label: "Obrady", icon: Presentation },
  { href: "/glosowania", label: "Głosowania", icon: Vote },
  { href: "/wiecej", label: "Więcej", icon: Ellipsis },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
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
                  className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "text-sejm-green"
                      : "text-navy-900/45 hover:text-navy-900/70"
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
