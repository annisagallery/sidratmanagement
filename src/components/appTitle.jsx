"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { navItemFor } from "src/layout/_admin/navConfig";

// "Stock · Management" — the browser tab says which screen it is, so several
// open tabs stay distinguishable.
export default function AppTitle() {
  const pathname = usePathname();

  useEffect(() => {
    const item = pathname?.startsWith("/auth") ? null : navItemFor(pathname || "/");
    const name = item?.tab || item?.title;
    document.title = name && item.key !== "dashboard" ? `${name} · Management` : "Management";
  }, [pathname]);

  return null;
}
