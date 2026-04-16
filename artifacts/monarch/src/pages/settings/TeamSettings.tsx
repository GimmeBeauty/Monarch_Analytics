import { useState } from "react";
import {
  Crown, Shield, User, Mail, Check, Clock, UserPlus, Loader2, RefreshCw, X, AlertTriangle,
} from "lucide-react";
import { useTeam, Role, TeamMember } from "@/context/TeamContext";
import { API_BASE } from "@/lib/apiBase";

// ─── Role metadata ────────────────────────────────────────────────────────────

const ROLE_META: Record<Role, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  desc: string;
}> = {
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

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function MemberAvatar({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl?: string | null }) {
  const display = name ?? email;
  const initials = display.split(/[\s@]/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={display}
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-[#3A3A3A] text-sm shrink-0"
      style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
    >
      {initials}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "active") return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-100/60 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-medium">
      <Clock size={9} />
      {status === "invited" ? "Invited" : "Pending"}
    </span>
  );
}

function MemberRow({
  member,
  isCurrentUser,
  canManage,
}: {
  member: TeamMember;
  isCurrentUser: boolean;
  canManage: boolean;
}) {
  const { removeMember } = useTeam();
  const display = member.name ?? member.email.split("@")[0];
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState("");

  const isDeletable = canManage && !isCurrentUser && member.role !== "owner";

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await removeMember(member.id);
    } catch {
      setError("Failed to remove member.");
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/20 overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 py-3 px-4">
        <MemberAvatar name={member.name} email={member.email} avatarUrl={member.avatarUrl} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">
              {display}
            </span>
            {isCurrentUser && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FFBC80]/20 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/40 font-medium">
                You
              </span>
            )}
            <StatusPill status={member.status} />
          </div>
          <span className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 truncate block mt-0.5">
            {member.email}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <RoleBadge role={member.role} />

          {isDeletable && !confirming && (
            <button
              onClick={() => setConfirming(true)}
              title="Remove member"
              className="p-1.5 rounded-lg text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Confirmation drawer */}
      {confirming && (
        <div className="px-4 py-3 border-t border-red-100 dark:border-red-900/30 bg-red-50/60 dark:bg-red-900/10">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                Remove {display}?
              </p>
              <p className="text-[11px] text-red-500/80 dark:text-red-400/70 mt-0.5">
                This permanently deletes their account. This cannot be undone.
              </p>
              {error && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{error}</p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? <Loader2 size={11} className="animate-spin" /> : null}
                {deleting ? "Removing…" : "Yes, remove"}
              </button>
              <button
                onClick={() => { setConfirming(false); setError(""); }}
                disabled={deleting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:bg-red-100/60 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                No, cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invite form (owners + admins only) ──────────────────────────────────────

function InviteForm({ onSuccess }: { onSuccess: (email: string, role: "admin" | "user") => void }) {
  const { members } = useTeam();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === trimmed)) {
      setError("This email is already on the team.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/auth/invite`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to send invitation.");
        return;
      }

      onSuccess(trimmed, role);
      setEmail("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
      <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-4">
        Invite Member
      </p>
      <div className="flex gap-2 flex-wrap">
        {/* Email input */}
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

        {/* Role toggle */}
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

        {/* Send button */}
        <button
          onClick={handleInvite}
          disabled={sending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
        >
          {sending
            ? <Loader2 size={14} className="animate-spin" />
            : sent
              ? <Check size={14} />
              : <UserPlus size={14} />}
          {sending ? "Sending…" : sent ? "Invited!" : "Send Invite"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <p className="mt-2 text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
        An invitation email will be sent. They'll appear as{" "}
        <span className="font-medium">Invited</span> until they accept.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamSettings() {
  const { members, loading, currentUserId, currentUserRole, inviteMember, refetch } = useTeam();

  const canInvite = currentUserRole === "owner" || currentUserRole === "admin";

  const activeMembers  = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status !== "active");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Team</h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
            Manage your team members and their access levels.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          title="Refresh team list"
          className="p-2 rounded-lg text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-[#FFBC80] hover:bg-[#FFBC80]/10 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Role legend */}
      <div className="p-4 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-3">
          Access Levels
        </p>
        <div className="space-y-2">
          {(["owner", "admin", "user"] as Role[]).map((r) => {
            const meta = ROLE_META[r];
            const Icon = meta.icon;
            return (
              <div key={r} className="flex items-start gap-2.5">
                <div className={`mt-0.5 p-1 rounded-md ${meta.bg}`}>
                  <Icon size={12} className={meta.color} strokeWidth={2.5} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
                    {meta.label}
                  </span>
                  <span className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 ml-1.5">
                    {meta.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invite form — owners and admins only */}
      {canInvite && (
        <InviteForm onSuccess={inviteMember} />
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-10 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
          <Loader2 size={18} className="animate-spin mr-2" />
          <span className="text-sm">Loading team…</span>
        </div>
      )}

      {/* Active members */}
      {!loading && activeMembers.length > 0 && (
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
                canManage={canInvite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Invited / pending */}
      {!loading && pendingMembers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-2">
            Awaiting Acceptance · {pendingMembers.length}
          </p>
          <div className="space-y-2">
            {pendingMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isCurrentUser={m.id === currentUserId}
                canManage={canInvite}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && members.length === 0 && (
        <p className="text-sm text-center text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 py-6">
          No team members found.
        </p>
      )}
    </div>
  );
}
