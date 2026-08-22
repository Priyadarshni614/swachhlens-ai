import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CitizenProfile = {
  id: string;
  display_name: string | null;
  ward: string | null;
  avatar_url: string | null;
};

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useProfile(user: User | null) {
  const [profile, setProfile] = useState<CitizenProfile | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let alive = true;
    supabase
      .from("profiles")
      .select("id, display_name, ward, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setProfile((data as CitizenProfile | null) ?? null);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const save = async (patch: { display_name?: string; ward?: string }) => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .upsert({ id: user.id, ...patch })
      .select("id, display_name, ward, avatar_url")
      .maybeSingle();
    setProfile((data as CitizenProfile | null) ?? null);
  };

  return { profile, save };
}
