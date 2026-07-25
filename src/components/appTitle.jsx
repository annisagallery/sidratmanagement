"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function AppTitle() {
  const pathname = usePathname();

  useEffect(() => {
    document.title = "Management";
  }, [pathname]);

  return null;
}
