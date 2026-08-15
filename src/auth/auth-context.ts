import { createContext } from "react";

export type AuthProviderKind = "google" | "password";

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  emailVerified: boolean;
  provider: AuthProviderKind;
}

export interface GuestImportSummary {
  recipes: number;
  cookingLog: number;
  aiPreferences: number;
  chatSessions: number;
  settings: number;
}

export type GuestImportState =
  | "idle"
  | "prompting"
  | "importing"
  | "complete"
  | "declined";

export interface AuthContextValue {
  user: AuthUser | null;
  hasCompletedOnboarding: boolean;
  isRestoring: boolean;
  isWorking: boolean;
  isCloudSyncReady: boolean;
  isDeviceCleanupReady: boolean;
  isAccountDeletionReady: boolean;
  error: string | null;
  guestImportState: GuestImportState;
  guestImportSummary: GuestImportSummary;
  continueAsGuest: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  createAccount: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
  removeAccountFromDevice: () => Promise<void>;
  reauthenticate: (credential: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  importGuestData: () => Promise<void>;
  declineGuestImport: () => void;
  dismissGuestImport: () => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
