import { useState } from "react";
import { Crown, Shield, User, Mail, ChevronDown, X, Check, Clock, UserPlus } from "lucide-react";
import { useTeam, Role, TeamMember } from "@/context/TeamContext";

const ROLE_META: Record<Role, { label: string; icon: React.ElementType; color: string; bg: string; desc: string }> = {
  owner: {
    label: "Owner",
    icon: Crown,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100/70 dark:bg-amber-900/30",
    desc: "Master admin. Can transfer ownership.",
  },
  admin: {
    label: "Admin",
    icon: Shield,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100/70 dark:bg-blue-900/30",
    desc: "Can view and edit all settings.",
  },
  user: {
    label: "User",
    icon: User,
    color: "text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50",
    bg: "bg-[#FFBC80]/15 dark:bg-[#FFBC80]/10",
    desc: "Can view settings but cannot make changes.",
  },
};

function RoleBadge({ role }: { role: Role }) {
  const meta = ROLE_META[role];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color} ${meta.bg}`}>
      <Icon size={11} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

function InitialsAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const dim = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${dim} rounded-full flex items-center justify-center font-bold text-[#3A3A3A] shrink-0`}
      style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
      {initials}
    </div>
  );
}

function RoleDropdown({
  current,
  onChange,
  exclude,
}: {
  current: Role;
  onChange: (r: Role) => void;
  exclude?: Role[];
}) {
  const [open, setOpen] = useState(false);
  const options = (["admin", "user"] as Role[]).filter((r) => !exclude?.includes(r));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#FFBC80]/40 bg-white dark:bg-[#231a0e] text-[#3A3A3A] dark:text-[#FFF9F2] hover:border-[#FFBC80] transition-colors"
      >
        <RoleBadge role={current} />
        <ChevronDown size={12} className="text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 ml-0.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-[#FFBC80]/30 bg-white dark:bg-[#231a0e] shadow-lg overflow-hidden">
          {options.map((role) => {
            const meta = ROLE_META[role];
            const Icon = meta.icon;
            return (
              <button
                key={role}
                onClick={() => { onChange(role); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#FFBC80]/10 transition-colors ${current === role ? "bg-[#FFBC80]/10" : ""}`}
              >
                <Icon size={13} className={meta.color} strokeWidth={2} />
                <div>
                  <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{meta.label}</p>
                  <p className="text-[10px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 leading-tight">{meta.desc}</p>
                </div>
                {current === role && <Check size={11} className="ml-auto text-[#FFBC80]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MemberRow({ member, isCurrentUser, canManage }: {
  member: TeamMember;
  isCurrentUser: boolean;
  canManage: boolean;
}) {
  const { updateRole, removeMember, transferOwnership } = useTeam();
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/20">
      <InitialsAvatar name={member.name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">
            {member.name}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFBC80]/20 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/40 font-medium">
              You
            </span>
          )}
          {member.status === "pending" && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100/60 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-medium">
              <Clock size={9} />
              Pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 truncate">{member.email}</span>
          <span className="text-[10px] text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 font-mono shrink-0">{member.id}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Role control */}
        {canManage && !isCurrentUser && member.role !== "owner" ? (
          <RoleDropdown
            current={member.role}
            onChange={(r) => updateRole(member.id, r)}
          />
        ) : (
          <RoleBadge role={member.role} />
        )}

        {/* Transfer ownership (owner only, to active non-owner members) */}
        {canManage && !isCurrentUser && member.role !== "owner" && member.status === "active" && (
          confirmTransfer ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { transferOwnership(member.id); setConfirmTransfer(false); }}
                className="px-2 py-1 rounded-lg text-[10px] font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmTransfer(false)}
                className="px-2 py-1 rounded-lg text-[10px] font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:bg-[#FFBC80]/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmTransfer(true)}
              title="Transfer ownership"
              className="p-1.5 rounded-lg text-amber-500/60 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <Crown size={13} />
            </button>
          )
        )}

        {/* Remove */}
        {canManage && !isCurrentUser && (
          <button
            onClick={() => removeMember(member.id)}
            title="Remove member"
            className="p-1.5 rounded-lg text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function TeamSettings() {
  const { members, currentUserId, currentUserRole, inviteMember } = useTeam();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  const handleInvite = () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    const exists = members.some((m) => m.email.toLowerCase() === trimmed);
    if (exists) {
      setError("This email is already on the team.");
      return;
    }
    inviteMember(trimmed, role);
    setEmail("");
    setError("");
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Team</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
          Manage your team members and their access levels.
        </p>
      </div>

      {/* Role legend */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-3">Access Levels</p>
        <div className="space-y-2">
          {(["owner", "admin", "user"] as Role[]).map((role) => {
            const meta = ROLE_META[role];
            const Icon = meta.icon;
            return (
              <div key={role} className="flex items-start gap-2.5">
                <div className={`mt-0.5 p-1 rounded-md ${meta.bg}`}>
                  <Icon size={12} className={meta.color} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{meta.label}</span>
                  <span className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 ml-1.5">{meta.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite form */}
      {canManage && (
        <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
          <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-4">
            Invite Member
          </p>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[180px] relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#3A3A3A]/35 dark:text-[#FFF9F2]/30" />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                placeholder="teammate@company.com"
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none transition-colors"
              />
            </div>

            {/* Role selector */}
            <div className="flex rounded-lg border border-[#FFBC80]/50 overflow-hidden text-xs font-semibold shrink-0">
              {(["admin", "user"] as const).map((r) => {
                const meta = ROLE_META[r];
                const Icon = meta.icon;
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                      role === r
                        ? "text-[#3A3A3A]"
                        : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 bg-[#FFF9F2] dark:bg-[#1a1208] hover:bg-[#FFBC80]/10"
                    }`}
                    style={role === r ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
                  >
                    <Icon size={12} strokeWidth={2.5} />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleInvite}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all shrink-0"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
            >
              {sent ? <Check size={14} /> : <UserPlus size={14} />}
              {sent ? "Invited!" : "Send Invite"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          <p className="mt-2 text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
            An invitation email will be sent. They'll appear as <span className="font-medium">Pending</span> until they accept.
          </p>
        </div>
      )}

      {/* Active members */}
      <div>
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-2">
          Members · {activeMembers.length}
        </p>
        <div className="space-y-2">
          {activeMembers.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isCurrentUser={m.id === currentUserId}
              canManage={canManage && currentUserRole === "owner"}
            />
          ))}
        </div>
      </div>

      {/* Pending invites */}
      {pendingMembers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-2">
            Pending Invites · {pendingMembers.length}
          </p>
          <div className="space-y-2">
            {pendingMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isCurrentUser={m.id === currentUserId}
                canManage={canManage}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
