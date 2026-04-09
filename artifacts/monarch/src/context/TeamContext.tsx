import { createContext, useContext, useState } from "react";

export type Role = "owner" | "admin" | "user";
export type MemberStatus = "active" | "pending";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  joinedAt: string;
}

interface TeamContextValue {
  members: TeamMember[];
  currentUserId: string;
  inviteMember: (email: string, role: "admin" | "user") => void;
  updateRole: (id: string, role: Role) => void;
  removeMember: (id: string) => void;
  transferOwnership: (id: string) => void;
  currentUserRole: Role;
}

function generateId(): string {
  return "usr_" + Math.random().toString(36).slice(2, 10);
}

function loadTeamState(): { members: TeamMember[]; currentUserId: string } {
  try {
    const stored = localStorage.getItem("monarch-team");
    if (stored) return JSON.parse(stored);
  } catch {}

  const ownerId = generateId();
  const defaultState = {
    currentUserId: ownerId,
    members: [
      {
        id: ownerId,
        name: "Nick Christensen",
        email: "nick@monarchdash.com",
        role: "owner" as Role,
        status: "active" as MemberStatus,
        joinedAt: new Date().toISOString(),
      },
    ],
  };
  return defaultState;
}

function saveTeamState(state: { members: TeamMember[]; currentUserId: string }) {
  try {
    localStorage.setItem("monarch-team", JSON.stringify(state));
  } catch {}
}

const TeamContext = createContext<TeamContextValue>({
  members: [],
  currentUserId: "",
  currentUserRole: "owner",
  inviteMember: () => {},
  updateRole: () => {},
  removeMember: () => {},
  transferOwnership: () => {},
});

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(loadTeamState);

  const update = (next: { members: TeamMember[]; currentUserId: string }) => {
    saveTeamState(next);
    setState(next);
  };

  const inviteMember = (email: string, role: "admin" | "user") => {
    const exists = state.members.some((m) => m.email.toLowerCase() === email.toLowerCase());
    if (exists) return;
    const newMember: TeamMember = {
      id: generateId(),
      name: email.split("@")[0],
      email,
      role,
      status: "pending",
      joinedAt: new Date().toISOString(),
    };
    update({ ...state, members: [...state.members, newMember] });
  };

  const updateRole = (id: string, role: Role) => {
    update({
      ...state,
      members: state.members.map((m) => (m.id === id ? { ...m, role } : m)),
    });
  };

  const removeMember = (id: string) => {
    update({ ...state, members: state.members.filter((m) => m.id !== id) });
  };

  const transferOwnership = (id: string) => {
    update({
      ...state,
      members: state.members.map((m) => {
        if (m.id === state.currentUserId) return { ...m, role: "admin" };
        if (m.id === id) return { ...m, role: "owner" };
        return m;
      }),
    });
  };

  const currentUserRole = state.members.find((m) => m.id === state.currentUserId)?.role ?? "user";

  return (
    <TeamContext.Provider
      value={{
        members: state.members,
        currentUserId: state.currentUserId,
        currentUserRole,
        inviteMember,
        updateRole,
        removeMember,
        transferOwnership,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
