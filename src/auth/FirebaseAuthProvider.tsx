import { FirebaseError } from "firebase/app";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  reload,
  sendEmailVerification as sendFirebaseEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { waitForPendingWrites } from "firebase/firestore";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AuthContext,
  type AuthContextValue,
  type AuthUser,
  type GuestImportState,
  type GuestImportSummary,
} from "@/auth/auth-context";
import { firebaseAuth, firebaseDb, initializeFirebaseAuth } from "@/lib/firebase";
import {
  declineGuestImport as persistDeclinedGuestImport,
  getGuestImportSummary,
  importGuestData as persistGuestImport,
} from "@/storage/guest-import";

const ONBOARDING_KEY = "chefness:auth:onboarding";
const LEGACY_MOCK_ONBOARDING_KEY = "chefness:mock-auth:onboarding";
const EMPTY_IMPORT_SUMMARY: GuestImportSummary = {
  recipes: 0,
  cookingLog: 0,
  aiPreferences: 0,
  chatSessions: 0,
  settings: 0,
};

function readOnboardingChoice(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) !== null ||
    localStorage.getItem(LEGACY_MOCK_ONBOARDING_KEY) === "guest";
}

function toAuthUser(user: User): AuthUser {
  const provider = user.providerData.some((profile) => profile.providerId === "google.com")
    ? "google"
    : "password";
  const email = user.email ?? "";
  const emailName = email.split("@")[0] ?? "Chefness cook";

  return {
    uid: user.uid,
    email,
    displayName: user.displayName ?? emailName,
    photoUrl: user.photoURL ?? "",
    emailVerified: user.emailVerified,
    provider,
  };
}

function authErrorMessage(cause: unknown): string {
  if (!(cause instanceof FirebaseError)) {
    return cause instanceof Error ? cause.message : "Something went wrong. Please try again.";
  }

  if (!cause.code.startsWith("auth/")) {
    if (cause.code === "permission-denied") return "Cloud access was denied. Check Firestore security rules.";
    if (cause.code === "unavailable") return "Cloud storage is unavailable. Check your connection and try again.";
    return import.meta.env.DEV
      ? `Cloud storage failed (${cause.code}): ${cause.message}`
      : `Cloud storage failed (${cause.code}). Please try again.`;
  }

  switch (cause.code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "The email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account already exists for this email.";
    case "auth/weak-password":
      return "Use a stronger password with at least 8 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Check your internet connection and try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorized for Chefness sign-in.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled yet.";
    case "auth/popup-closed-by-user":
      return "Verification was cancelled.";
    case "auth/popup-blocked":
      return "Allow the sign-in popup, then try again.";
    case "auth/requires-recent-login":
      return "Verify your identity again before continuing.";
    default:
      return "Authentication failed. Please try again.";
  }
}

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const activeScopeRef = useRef<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(readOnboardingChoice);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestImportState, setGuestImportState] = useState<GuestImportState>("idle");
  const [guestImportSummary, setGuestImportSummary] = useState(EMPTY_IMPORT_SUMMARY);

  const applyUser = useCallback((nextUser: User | null) => {
    const nextScope = nextUser?.uid ?? null;
    if (activeScopeRef.current !== nextScope) {
      queryClient.clear();
      activeScopeRef.current = nextScope;
    }
    setUser(nextUser ? toAuthUser(nextUser) : null);
    if (nextUser) {
      localStorage.setItem(ONBOARDING_KEY, "account");
      setOnboardingComplete(true);
    }
  }, [queryClient]);

  useEffect(() => {
    if (!user) {
      setGuestImportState("idle");
      setGuestImportSummary(EMPTY_IMPORT_SUMMARY);
      return;
    }

    setGuestImportState("idle");
    setGuestImportSummary(EMPTY_IMPORT_SUMMARY);
    let isActive = true;
    void getGuestImportSummary(user.uid).then((summary) => {
      if (!isActive || !summary) return;
      setGuestImportSummary(summary);
      setGuestImportState("prompting");
    }).catch((cause: unknown) => {
      if (isActive) setError(cause instanceof Error ? cause.message : "Could not inspect guest data.");
    });
    return () => {
      isActive = false;
    };
  }, [user]);

  useEffect(() => {
    let isActive = true;
    let unsubscribe = () => undefined;

    void initializeFirebaseAuth()
      .then(() => {
        if (!isActive) return;
        unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
          if (!isActive) return;
          applyUser(nextUser);
          setIsRestoring(false);
        });
        return getRedirectResult(firebaseAuth);
      })
      .catch((cause: unknown) => {
        if (!isActive) return;
        setError(authErrorMessage(cause));
        setIsRestoring(false);
      });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [applyUser]);

  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    setIsWorking(true);
    try {
      await action();
    } catch (cause) {
      const message = authErrorMessage(cause);
      setError(message);
      throw cause;
    } finally {
      setIsWorking(false);
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "guest");
    setOnboardingComplete(true);
    setError(null);
  }, []);

  const signInWithGoogle = useCallback(() => run(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithRedirect(firebaseAuth, provider);
  }), [run]);

  const signInWithEmail = useCallback((email: string, password: string) => run(async () => {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    applyUser(credential.user);
  }), [applyUser, run]);

  const createAccount = useCallback((email: string, password: string) => run(async () => {
    if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
    const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
    await sendFirebaseEmailVerification(credential.user);
    applyUser(credential.user);
  }), [applyUser, run]);

  const sendPasswordReset = useCallback((email: string) => run(async () => {
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
    } catch (cause) {
      if (cause instanceof FirebaseError && cause.code === "auth/user-not-found") return;
      throw cause;
    }
  }), [run]);

  const sendEmailVerification = useCallback(() => run(async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) throw new Error("Sign in before verifying your email.");
    await sendFirebaseEmailVerification(currentUser);
  }), [run]);

  const refreshUser = useCallback(() => run(async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) throw new Error("Sign in before refreshing your account.");
    await reload(currentUser);
    applyUser(currentUser);
  }), [applyUser, run]);

  const signOut = useCallback(() => run(async () => {
    if (!navigator.onLine) throw new Error("Reconnect before signing out.");
    await waitForPendingWrites(firebaseDb);
    await firebaseSignOut(firebaseAuth);
    localStorage.setItem(ONBOARDING_KEY, "guest");
    setUser(null);
  }), [run]);

  const removeAccountFromDevice = useCallback(() => run(() =>
    Promise.reject(new Error("Device cache cleanup will be available after Firestore sync is connected.")),
  ), [run]);

  const reauthenticate = useCallback((credential: string) => run(async () => {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser?.email) throw new Error("Sign in again before deleting your account.");

    const usesGoogle = currentUser.providerData.some((profile) => profile.providerId === "google.com");
    if (usesGoogle) {
      await reauthenticateWithPopup(currentUser, new GoogleAuthProvider());
      return;
    }

    await reauthenticateWithCredential(
      currentUser,
      EmailAuthProvider.credential(currentUser.email, credential),
    );
  }), [run]);

  const deleteAccount = useCallback(() => run(() =>
    Promise.reject(new Error("Account deletion setup is not complete yet.")),
  ), [run]);

  const importGuestData = useCallback(() => run(async () => {
    if (!user) throw new Error("Sign in before importing guest data.");
    setGuestImportState("importing");
    try {
      await persistGuestImport(user.uid);
      queryClient.clear();
      setGuestImportState("complete");
    } catch (cause) {
      setGuestImportState("prompting");
      throw cause;
    }
  }), [queryClient, run, user]);

  const declineGuestImport = useCallback(() => {
    if (!user) return;
    setGuestImportState("declined");
    void persistDeclinedGuestImport(user.uid).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "Could not save import choice.");
      setGuestImportState("prompting");
    });
  }, [user]);

  const dismissGuestImport = useCallback(() => {
    setGuestImportState("idle");
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    hasCompletedOnboarding: onboardingComplete,
    isRestoring,
    isWorking,
    isCloudSyncReady: true,
    isDeviceCleanupReady: false,
    isAccountDeletionReady: false,
    error,
    guestImportState,
    guestImportSummary,
    continueAsGuest,
    signInWithGoogle,
    signInWithEmail,
    createAccount,
    sendPasswordReset,
    sendEmailVerification,
    refreshUser,
    signOut,
    removeAccountFromDevice,
    reauthenticate,
    deleteAccount,
    importGuestData,
    declineGuestImport,
    dismissGuestImport,
    clearError: () => setError(null),
  }), [
    user,
    onboardingComplete,
    isRestoring,
    isWorking,
    error,
    guestImportState,
    guestImportSummary,
    continueAsGuest,
    signInWithGoogle,
    signInWithEmail,
    createAccount,
    sendPasswordReset,
    sendEmailVerification,
    refreshUser,
    signOut,
    removeAccountFromDevice,
    reauthenticate,
    deleteAccount,
    importGuestData,
    declineGuestImport,
    dismissGuestImport,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
