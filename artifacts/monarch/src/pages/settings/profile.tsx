import { useState, useRef } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useProfile } from "@/context/ProfileContext";
import { useAuth } from "@/context/AuthContext";

export default function ProfileSettings() {
  const { profile, saveProfile, saveAvatar } = useProfile();
  const { user } = useAuth();

  const [name,       setName]       = useState(profile.name);
  const [title,      setTitle]      = useState(profile.title);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState("");
  const [uploading,  setUploading]  = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  const initials = (profile.name || user?.email || "?")
    .split(/[\s@]/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await saveProfile({ name, title });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        await saveAvatar(dataUrl);
      } catch {
        // silently ignore upload errors — user still sees local preview
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  };

  const handleRemoveAvatar = async () => {
    setUploading(true);
    try {
      await saveAvatar(null);
    } finally {
      setUploading(false);
    }
  };

  const cardStyle = {
    border: "1px solid transparent",
    backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
    backgroundOrigin: "border-box",
    backgroundClip: "padding-box, border-box",
  };

  const cardStyleDark = "dark:bg-[#231a0e]";

  return (
    <DashboardLayout title="Profile" description="Update your personal details, title, and profile picture.">
      <div className="max-w-lg space-y-6">

        {/* Avatar */}
        <div className={`rounded-xl p-6 bg-white ${cardStyleDark}`} style={cardStyle}>
          <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-5">Profile Picture</h2>
          <div className="flex items-center gap-6">
            <div className="relative group">
              {profile.picture ? (
                <img
                  src={profile.picture}
                  alt={profile.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-[#3A3A3A]"
                  style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
                >
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {uploading
                  ? <Loader2 size={20} className="text-white animate-spin" />
                  : <Camera size={20} className="text-white" />}
              </button>
            </div>

            <div>
              <button
                data-testid="upload-picture"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
              >
                {uploading ? "Saving…" : "Upload Photo"}
              </button>
              {profile.picture && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                  className="ml-3 px-4 py-2 rounded-lg text-sm font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#FFBC80]/10 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              )}
              <p className="mt-2 text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">
                JPG, PNG or GIF. Max 5MB.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>
          </div>
        </div>

        {/* Name & title */}
        <div className={`rounded-xl p-6 bg-white ${cardStyleDark}`} style={cardStyle}>
          <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-5">Personal Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1.5 uppercase tracking-wider">
                Full Name
              </label>
              <input
                data-testid="input-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-[#3A3A3A] dark:text-[#FFF9F2] bg-[#FFF9F2] dark:bg-[#1a1208] outline-none transition-colors placeholder-[#3A3A3A]/35 dark:placeholder-[#FFF9F2]/25 focus:ring-2 focus:ring-[#FFBC80]/50"
                style={{ border: "1px solid #FFBC80" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1.5 uppercase tracking-wider">
                Title / Role
              </label>
              <input
                data-testid="input-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Growth Analyst"
                className="w-full px-4 py-2.5 rounded-lg text-sm text-[#3A3A3A] dark:text-[#FFF9F2] bg-[#FFF9F2] dark:bg-[#1a1208] outline-none transition-colors placeholder-[#3A3A3A]/35 dark:placeholder-[#FFF9F2]/25 focus:ring-2 focus:ring-[#FFBC80]/50"
                style={{ border: "1px solid #FFBC80" }}
              />
            </div>
          </div>

          {saveError && (
            <p className="mt-3 text-xs text-red-500">{saveError}</p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              data-testid="save-profile"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#3A3A3A] transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
            >
              {saving
                ? <Loader2 size={14} className="animate-spin" />
                : saved
                  ? <Check size={14} />
                  : null}
              {saving ? "Saving…" : saved ? "Saved" : "Save Changes"}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className={`rounded-xl p-6 bg-white ${cardStyleDark}`} style={cardStyle}>
          <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-4">Sidebar Preview</h2>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#FFBC80]/8">
            {profile.picture ? (
              <img
                src={profile.picture}
                alt={profile.name}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#3A3A3A] shrink-0"
                style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
              >
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">
                {name || user?.email || "Your Name"}
              </div>
              <div className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 truncate">
                {title || "Your Title"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
