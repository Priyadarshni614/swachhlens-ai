import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Citizen sign in — SwachhLens" },
      {
        name: "description",
        content:
          "Sign in to SwachhLens so your waste reports, priority scores and cleanup history sync across every device.",
      },
      { property: "og:title", content: "Citizen sign in — SwachhLens" },
      {
        property: "og:description",
        content: "Your reports and complaint history, synced to your citizen account.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/reports", replace: true });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      toast.success("Signed in — your reports will now sync.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    setBusy(false);
  };

  return (
    <AppShell
      title="Citizen account"
      subtitle="Sync your reports and history across every device."
    >
      <section className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-lift">
          <p className="flex items-center gap-2 text-eyebrow text-muted-foreground">
            <ShieldCheck className="size-3.5" /> Secure citizen login
          </p>

          {sent ? (
            <p className="mt-3 text-sm">
              We sent a confirmation link to <span className="font-medium">{email}</span>. Open it on
              any device to finish signing in.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-3 space-y-3">
              {mode === "signup" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya D."
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                {mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          )}

          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="secondary" className="mt-3 w-full" onClick={google} disabled={busy}>
            Continue with Google
          </Button>

          <button
            type="button"
            className="mt-4 w-full text-xs text-muted-foreground underline"
            onClick={() => {
              setSent(false);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
          >
            {mode === "signin"
              ? "New citizen? Create an account"
              : "Already registered? Sign in instead"}
          </button>
        </div>

        <p className="px-2 text-xs text-muted-foreground">
          Reports filed before signing in stay on this device. Once signed in, every new report is
          saved to your account and appears on any phone or desktop you use.
        </p>
      </section>
    </AppShell>
  );
}
