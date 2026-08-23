import { useEffect, useState } from "react";
import logo from "@/assets/swachhlens-logo.jpg.asset.json";

const SEEN_KEY = "swachhlens.booted";

/** Branded boot screen shown while the app hydrates on first open. */
export function BootScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const seen = window.sessionStorage.getItem(SEEN_KEY) === "1";
    const hold = seen ? 300 : 1400;
    const fade = window.setTimeout(() => setFading(true), hold);
    const done = window.setTimeout(() => {
      window.sessionStorage.setItem(SEEN_KEY, "1");
      setVisible(false);
    }, hold + 420);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(done);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-100 grid place-items-center bg-gradient-ink transition-opacity duration-400 ${
        fading ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center px-8 text-center">
        <span className="grid size-24 animate-[boot-pop_600ms_ease-out] place-items-center overflow-hidden rounded-3xl bg-background shadow-glow">
          <img src={logo.url} alt="SwachhLens logo" className="size-24 object-contain" />
        </span>
        <h1 className="mt-6 text-2xl text-primary-foreground">SwachhLens</h1>
        <p className="mt-1 text-sm text-primary-foreground/70">
          AI-powered waste response for cleaner wards
        </p>
        <span className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-primary-foreground/20">
          <span className="boot-bar block h-full w-1/3 rounded-full bg-gradient-signal" />
        </span>
      </div>
    </div>
  );
}
