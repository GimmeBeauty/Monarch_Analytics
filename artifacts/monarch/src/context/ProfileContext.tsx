import { createContext, useContext, useState } from "react";

export interface Profile {
  name: string;
  title: string;
  picture: string;
}

interface ProfileContextValue {
  profile: Profile;
  updateProfile: (updates: Partial<Profile>) => void;
}

const defaultProfile: Profile = {
  name: "Alex Morgan",
  title: "Growth Analyst",
  picture: "",
};

function loadProfile(): Profile {
  try {
    const stored = localStorage.getItem("monarch-profile");
    if (stored) return { ...defaultProfile, ...JSON.parse(stored) };
  } catch {}
  return defaultProfile;
}

const ProfileContext = createContext<ProfileContextValue>({
  profile: defaultProfile,
  updateProfile: () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(loadProfile);

  const updateProfile = (updates: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem("monarch-profile", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return (
    <ProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
