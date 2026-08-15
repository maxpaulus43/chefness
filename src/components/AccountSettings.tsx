import { useState, type SyntheticEvent } from "react";
import { AuthDialog } from "@/components/AuthDialog";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { colors, fonts, radii, shadows } from "@/theme";

export function AccountSettings() {
  const auth = useAuth();
  const toast = useToast();
  const [showAuth, setShowAuth] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const handleVerification = async () => {
    try {
      await auth.sendEmailVerification();
      toast.notify({ title: "Verification email sent", message: "Open the link in your email, then refresh your account status.", tone: "success" });
    } catch {
      toast.notify({ title: "Couldn't verify email", message: auth.error ?? "Please try again.", tone: "danger" });
    }
  };

  const handleRefreshVerification = async () => {
    try {
      await auth.refreshUser();
      toast.notify({ message: "Account status refreshed." });
    } catch {
      toast.notify({ message: auth.error ?? "Couldn't refresh account status.", tone: "danger" });
    }
  };

  const handleSignOut = async () => {
    const confirmed = await toast.ask({
      title: "Sign out?",
      message: "Cloud data will be removed from this device. Your local AI key will be kept for your next sign-in.",
      confirmLabel: "Sign out",
    });
    if (!confirmed) return;
    try {
      await auth.signOut();
      toast.notify({ message: "Signed out. You're now cooking as a guest." });
    } catch {
      toast.notify({ title: "Couldn't sign out", message: auth.error ?? "Please reconnect and try again.", tone: "danger" });
    }
  };

  const handleRemoveDeviceData = async () => {
    const confirmed = await toast.ask({
      title: "Remove account data from this device?",
      message: "This clears cached cloud data and this account's local AI credentials. Your cloud kitchen is not deleted.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await auth.removeAccountFromDevice();
      toast.notify({ message: "Account data was removed from this device.", tone: "success" });
    } catch {
      toast.notify({ message: auth.error ?? "Couldn't remove device data.", tone: "danger" });
    }
  };

  return (
    <section style={styles.section}>
      <div style={styles.headingRow}>
        <h2 style={styles.sectionTitle}>Account</h2>
        <span style={styles.previewBadge}>Firebase Auth</span>
      </div>

      {auth.user ? (
        <>
          <div style={styles.accountCard}>
            <div style={styles.avatar}>{initials(auth.user.displayName)}</div>
            <div style={styles.identity}>
              <strong style={styles.name}>{auth.user.displayName}</strong>
              <span style={styles.email}>{auth.user.email}</span>
              <span style={styles.providerLabel}>
                {auth.user.provider === "google" ? "Google account" : "Email account"}
              </span>
            </div>
            <span style={styles.syncStatus}>
              <Icon name={auth.isCloudSyncReady ? "cloud" : "check"} size={16} />
              {auth.isCloudSyncReady ? "Sync ready" : "Connected"}
            </span>
          </div>

          {!auth.user.emailVerified ? (
            <div style={styles.verificationCard}>
              <span style={styles.verificationIcon}><Icon name="mail" size={19} /></span>
              <div style={styles.verificationText}>
                <strong>Verify your email</strong>
                <span>Verification isn't required for sync, but helps protect your account.</span>
              </div>
              <div style={styles.verificationActions}>
                <button type="button" onClick={() => void handleVerification()} disabled={auth.isWorking} style={styles.verifyButton}>
                  {auth.isWorking ? "Sending…" : "Send link"}
                </button>
                <button type="button" onClick={() => void handleRefreshVerification()} disabled={auth.isWorking} style={styles.refreshButton}>
                  Refresh
                </button>
              </div>
            </div>
          ) : null}

          <div style={styles.privacyCard}>
            <Icon name="lock" size={20} />
            <div>
              <strong>AI credentials stay on this device</strong>
              <p>Provider and model choices sync. API and OAuth keys never do.</p>
            </div>
          </div>

          <div style={styles.accountActions}>
            <button type="button" onClick={() => void handleSignOut()} disabled={auth.isWorking} style={styles.actionButton}>
              <Icon name="logOut" size={17} />
              Sign out
            </button>
            <button type="button" onClick={() => void handleRemoveDeviceData()} disabled={!auth.isDeviceCleanupReady || auth.isWorking} style={styles.actionButton}>
              {auth.isDeviceCleanupReady ? "Remove account data from this device" : "Device cleanup setup pending"}
            </button>
          </div>

          <div style={styles.dangerZone}>
            <div>
              <strong>Delete account</strong>
              <p>Permanently removes your account and cloud kitchen.</p>
            </div>
            <button type="button" onClick={() => setShowDelete(true)} disabled={!auth.isAccountDeletionReady} style={styles.deleteAccountButton}>
              {auth.isAccountDeletionReady ? "Delete" : "Setup pending"}
            </button>
          </div>
        </>
      ) : (
        <div style={styles.guestCard}>
          <span style={styles.guestIcon}><Icon name="user" size={23} /></span>
          <div style={styles.guestCopy}>
            <strong>Cooking as a guest</strong>
            <p>Your recipes and conversations remain on this device. Sign in to back them up and sync across devices.</p>
          </div>
          <button type="button" onClick={() => setShowAuth(true)} style={styles.signInButton}>Sign in</button>
        </div>
      )}

      <p style={styles.previewNote}>
        {auth.user
          ? auth.isCloudSyncReady
            ? "Your private kitchen syncs with Firestore. AI credentials stay local."
            : "Firebase Authentication is connected. Firestore sync is not active yet."
          : "Guest data stays on this device until you sign in and import it."}
      </p>

      {showAuth ? <AuthDialog onClose={() => setShowAuth(false)} /> : null}
      {showDelete && auth.user ? <DeleteAccountDialog onClose={() => setShowDelete(false)} /> : null}
    </section>
  );
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const [step, setStep] = useState<"reauth" | "confirm">("reauth");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const handleReauthenticate = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (auth.user?.provider === "password" && !password) return;
    try {
      await auth.reauthenticate(auth.user?.provider === "google" ? "google" : password);
      setStep("confirm");
    } catch {
      // Sanitized error is rendered in the dialog.
    }
  };

  const handleDelete = async () => {
    if (confirmation !== "DELETE") return;
    try {
      await auth.deleteAccount();
      onClose();
    } catch {
      // Sanitized error is rendered in the dialog.
    }
  };

  return (
    <div style={styles.overlay}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" style={styles.deleteDialog}>
        <button type="button" onClick={onClose} aria-label="Close account deletion" style={styles.closeButton}><Icon name="x" size={18} /></button>
        <span style={styles.deleteIcon}><Icon name="trash" size={25} /></span>
        <p style={styles.dangerEyebrow}>Permanent action</p>
        <h3 id="delete-account-title" style={styles.deleteTitle}>
          {step === "reauth" ? "First, verify it's you." : "Delete your Chefness account?"}
        </h3>

        {step === "reauth" ? (
          <form onSubmit={(event) => void handleReauthenticate(event)}>
            <p style={styles.deleteDescription}>For your security, account deletion requires a recent sign-in.</p>
            {auth.user?.provider === "password" ? (
              <>
                <label htmlFor="delete-password" style={styles.label}>Password</label>
                <input id="delete-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required style={styles.input} />
              </>
            ) : (
              <div style={styles.googleReauth}><span style={{ color: colors.googleBlue, fontWeight: 850 }}>G</span> Continue with Google to verify</div>
            )}
            {auth.error ? <p role="alert" style={styles.error}>{auth.error}</p> : null}
            <button type="submit" disabled={auth.isWorking} style={styles.continueButton}>
              {auth.isWorking ? "Verifying…" : "Continue"}
            </button>
          </form>
        ) : (
          <div>
            <p style={styles.deleteDescription}>This permanently deletes your Firebase sign-in. Current local recipes, history, preferences, and conversations stay on this device.</p>
            <label htmlFor="delete-confirmation" style={styles.label}>Type <strong>DELETE</strong> to confirm</label>
            <input id="delete-confirmation" type="text" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" style={styles.input} />
            {auth.error ? <p role="alert" style={styles.error}>{auth.error}</p> : null}
            <button type="button" onClick={() => void handleDelete()} disabled={auth.isWorking || confirmation !== "DELETE"} style={styles.finalDeleteButton}>
              {auth.isWorking ? "Deleting…" : "Delete my account"}
            </button>
          </div>
        )}
        <button type="button" onClick={onClose} style={styles.cancelButton}>Cancel</button>
        <p style={styles.dialogMockNote}>This deletes the Firebase Auth account. Firestore is not connected yet.</p>
      </section>
    </div>
  );
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "C";
}

const styles: Record<string, React.CSSProperties> = {
  section: { marginBottom: "2rem" },
  headingRow: { display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "1rem", paddingBottom: "0.5rem", borderBottom: `1px solid ${colors.glassBorder}` },
  sectionTitle: { margin: 0, fontFamily: fonts.serif, fontSize: "1.125rem", fontWeight: 600, color: colors.espresso },
  previewBadge: { padding: "0.18rem 0.45rem", borderRadius: radii.pill, color: colors.saffronDeep, backgroundColor: colors.saffronTint, fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase" },
  accountCard: { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.9rem", borderRadius: radii.lg, border: `1px solid ${colors.glassBorder}`, backgroundColor: colors.glass, boxShadow: shadows.glass },
  avatar: { width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: radii.pill, color: colors.white, backgroundColor: colors.saffron, fontFamily: fonts.serif, fontWeight: 750 },
  identity: { minWidth: 0, flex: 1, display: "flex", flexDirection: "column" },
  name: { color: colors.espresso, fontSize: "0.9rem" },
  email: { overflow: "hidden", textOverflow: "ellipsis", color: colors.stone600, fontSize: "0.76rem" },
  providerLabel: { marginTop: 2, color: colors.stone400, fontSize: "0.68rem" },
  syncStatus: { display: "inline-flex", alignItems: "center", gap: "0.25rem", flexShrink: 0, color: colors.success, fontSize: "0.68rem", fontWeight: 750 },
  verificationCard: { marginTop: "0.65rem", padding: "0.75rem", display: "flex", alignItems: "center", gap: "0.6rem", borderRadius: radii.md, border: `1px solid ${colors.saffronTintBorder}`, backgroundColor: colors.saffronTint },
  verificationIcon: { width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRadius: radii.pill, color: colors.saffronDeep, backgroundColor: colors.glassStrong },
  verificationText: { minWidth: 0, flex: 1, display: "flex", flexDirection: "column", color: colors.espresso, fontSize: "0.8rem" },
  verificationActions: { display: "flex", flexDirection: "column", gap: "0.3rem", flexShrink: 0 },
  verifyButton: { flexShrink: 0, padding: "0.45rem 0.6rem", border: "none", borderRadius: radii.sm, color: colors.white, backgroundColor: colors.saffron, fontSize: "0.7rem", fontWeight: 750, cursor: "pointer" },
  refreshButton: { flexShrink: 0, padding: "0.4rem 0.6rem", border: `1px solid ${colors.saffronTintBorder}`, borderRadius: radii.sm, color: colors.saffronDeep, backgroundColor: colors.white, fontSize: "0.68rem", fontWeight: 750, cursor: "pointer" },
  privacyCard: { marginTop: "0.65rem", padding: "0.8rem", display: "flex", alignItems: "flex-start", gap: "0.65rem", borderRadius: radii.md, color: colors.stone700, backgroundColor: colors.glass, border: `1px solid ${colors.glassBorder}`, fontSize: "0.8rem" },
  accountActions: { marginTop: "0.65rem", display: "grid", gap: "0.45rem" },
  actionButton: { minHeight: 43, padding: "0 0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem", borderRadius: radii.md, border: `1px solid ${colors.glassBorder}`, backgroundColor: colors.glass, color: colors.stone700, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" },
  dangerZone: { marginTop: "1rem", padding: "0.8rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", borderRadius: radii.md, border: `1px solid ${colors.dangerTintBorder}`, backgroundColor: colors.dangerTint, color: colors.danger, fontSize: "0.8rem" },
  deleteAccountButton: { flexShrink: 0, padding: "0.5rem 0.75rem", borderRadius: radii.sm, border: `1px solid ${colors.dangerTintBorder}`, backgroundColor: colors.white, color: colors.danger, fontWeight: 750, cursor: "pointer" },
  guestCard: { padding: "1rem", display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.75rem", borderRadius: radii.lg, border: `1px solid ${colors.glassBorder}`, backgroundColor: colors.glass, boxShadow: shadows.glass },
  guestIcon: { width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: radii.pill, color: colors.saffronDeep, backgroundColor: colors.saffronTint },
  guestCopy: { minWidth: 0, color: colors.espresso, fontSize: "0.87rem" },
  signInButton: { gridColumn: "1 / -1", minHeight: 44, border: "none", borderRadius: radii.md, color: colors.white, backgroundColor: colors.saffron, boxShadow: shadows.glass, fontWeight: 750, cursor: "pointer" },
  previewNote: { margin: "0.7rem 0 0", color: colors.stone400, fontSize: "0.68rem", textAlign: "center" },
  overlay: { position: "fixed", inset: 0, zIndex: 930, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", backgroundColor: "rgba(42, 31, 26, 0.42)", backdropFilter: "blur(8px)" },
  deleteDialog: { position: "relative", width: "min(100%, 400px)", padding: "1.4rem 1.2rem 1rem", borderRadius: radii.xl, border: `1px solid ${colors.dangerTintBorder}`, backgroundColor: colors.glassStrong, boxShadow: shadows.glassXl, textAlign: "center" },
  closeButton: { position: "absolute", top: 12, right: 12, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: radii.pill, border: `1px solid ${colors.glassBorder}`, backgroundColor: colors.glass, color: colors.stone600, cursor: "pointer" },
  deleteIcon: { width: 52, height: 52, margin: "0 auto 0.7rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: radii.lg, color: colors.danger, backgroundColor: colors.dangerTint },
  dangerEyebrow: { margin: "0 0 0.3rem", color: colors.danger, fontSize: "0.66rem", fontWeight: 850, letterSpacing: "0.1em", textTransform: "uppercase" },
  deleteTitle: { margin: "0 0 0.6rem", fontFamily: fonts.serif, color: colors.espresso, fontSize: "1.5rem" },
  deleteDescription: { margin: "0 0 1rem", color: colors.stone600, fontSize: "0.82rem", lineHeight: 1.5 },
  label: { display: "block", marginBottom: "0.35rem", color: colors.stone700, fontSize: "0.78rem", fontWeight: 650, textAlign: "left" },
  input: { width: "100%", minHeight: 46, padding: "0.65rem 0.75rem", borderRadius: radii.md, border: `1px solid ${colors.glassBorder}`, backgroundColor: colors.white, color: colors.espresso, fontSize: "1rem" },
  googleReauth: { minHeight: 48, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem", borderRadius: radii.md, border: `1px solid ${colors.stone300}`, backgroundColor: colors.white, fontSize: "0.85rem", fontWeight: 700 },
  continueButton: { width: "100%", minHeight: 46, marginTop: "0.7rem", border: "none", borderRadius: radii.md, color: colors.white, backgroundColor: colors.saffron, fontWeight: 750, cursor: "pointer" },
  finalDeleteButton: { width: "100%", minHeight: 46, marginTop: "0.7rem", border: "none", borderRadius: radii.md, color: colors.white, backgroundColor: colors.danger, fontWeight: 750, cursor: "pointer" },
  cancelButton: { width: "100%", minHeight: 40, marginTop: "0.4rem", border: "none", background: "none", color: colors.stone600, fontWeight: 700, cursor: "pointer" },
  error: { margin: "0.6rem 0 0", color: colors.danger, fontSize: "0.78rem" },
  dialogMockNote: { margin: "0.6rem 0 0", paddingTop: "0.6rem", borderTop: `1px solid ${colors.glassBorder}`, color: colors.stone400, fontSize: "0.65rem" },
};
