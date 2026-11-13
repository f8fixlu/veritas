"use client";

import { useEffect, useState } from "react";
import { IconArrowUp } from "./icons";

const SHOW_AFTER_PX = 400;

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-all duration-200 hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 print:hidden ${
        visible ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      <IconArrowUp size={20} />
    </button>
  );
}
