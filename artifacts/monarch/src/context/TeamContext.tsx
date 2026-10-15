import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/apiBase";

export type Role = "owner" | "admin" | "user";
export type MemberStatus = "active" | "pending" | "invited";

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: MemberStatus;
  avatarUrl?: string | null;
  joinedAt: string;
}

interface TeamContextValue {
  members: TeamMember[];
  loading: boolean;
  currentUserId: string;
  currentUserRole: Role;
  refetch: () => Promise<void>;
  inviteMember: (email: string, role: "admin" | "user") => void;
  removeMember: (id: string) => Promise<void>;
  changeMemberRole: (id: string, role: "admin" | "user") => Promise<void>;
}

const TeamContext = createContext<TeamContextValue>({
  members: [],
  loading: true,
  currentUserId: "",
  currentUserRole: "user",
  refetch: async () => {},
  inviteMember: () => {},
  removeMember: async () => {},
  changeMemberRole: async () => {},
});

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    if (!user) {
      setMembers([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json() as { users: TeamMember[] };
        setMembers(data.users);
      }
    } catch {
      // silently ignore — members stays as whatever it was
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMembers();
    const refresh = () => { void fetchMembers(); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [fetchMembers]);

  // Optimistically add a pending member to the list right after invite API
  // succeeds, so the UI updates instantly without a full refetch.
  const inviteMember = useCallback((email: string, role: "admin" | "user") => {
    setMembers((prev) => {
      if (prev.some((m) => m.email.toLowerCase() === email.toLowerCase())) {
        return prev;
      }
      return [
        ...prev,
        {
          id: `optimistic_${Date.now()}`,
          name: null,
          email,
          role,
          status: "invited" as MemberStatus,
          joinedAt: new Date().toISOString(),
        },
      ];
    });
  }, []);

  const removeMember = useCallback(async (id: string) => {
    await fetch(`${API_BASE}/api/auth/users/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const currentUserId   = user?.id   ?? "";
  const changeMemberRole = useCallback(async (id: string, role: "admin" | "user") => {
    const res = await fetch(`${API_BASE}/api/auth/users/${encodeURIComponent(id)}/role`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "Failed to update role.");
    setMembers(prev => prev.map(member =>
      member.id === body.user.id ? { ...member, role: body.user.role } : member,
    ));
  }, []);

  const currentUserRole = (user?.role ?? "user") as Role;

  return (
    <TeamContext.Provider
      value={{
        members,
        loading,
        currentUserId,
        currentUserRole,
        refetch: fetchMembers,
        inviteMember,
        removeMember,
        changeMemberRole,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
