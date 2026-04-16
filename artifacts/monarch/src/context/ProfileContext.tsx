import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth, type AuthUser } from "@/context/AuthContext";
import { API_BASE } from "@/lib/apiBase";

export interface Profile {
  name:      string;
  title:     string;
  picture:   string;
}

interface ProfileContextValue {
  profile:       Profile;
  saveProfile:   (updates: { name?: string; title?: string }) => Promise<void>;
  saveAvatar:    (dataUrl: string | null) => Promise<void>;
}

function authToProfile(user: AuthUser | null): Profile {
  return {
    name:    user?.name    ?? "",
    title:   user?.title   ?? "",
    picture: user?.avatarUrl ?? "",
  };
}

const ProfileContext = createContext<ProfileContextValue>({
  profile:     { name: "", title: "", picture: "" },
  saveProfile: async () => {},
  saveAvatar:  async () => {},
});

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, refetch } = useAuth();

  const profile = authToProfile(user);

  const patchProfile = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/api/auth/profile`, {
      method:      "PATCH",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? "Failed to save profile");
    }
    await refetch();
  }, [refetch]);

  const saveProfile = useCallback(async (updates: { name?: string; title?: string }) => {
    await patchProfile(updates);
  }, [patchProfile]);

  const saveAvatar = useCallback(async (dataUrl: string | null) => {
    await patchProfile({ avatarUrl: dataUrl ?? "" });
  }, [patchProfile]);

  return (
    <ProfileContext.Provider value={{ profile, saveProfile, saveAvatar }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
