import { useEffect, useState, type SyntheticEvent } from "react";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import { colors, fonts, radii, shadows } from "@/theme";

type AuthMode = "sign-in" | "create" | "reset";

interface AuthDialogProps {
  onClose: () => void;
  initialMode?: AuthMode;
  embedded?: boolean;
}

export function AuthDialog({ onClose, initialMode = "sign-in", embedded = false }: AuthDialogProps) {
  const auth = useAuth();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    auth.clearError();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps -- clear stale errors when changing forms

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setPassword("");
    setResetSent(false);
  };

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (mode === "sign-in") await auth.signInWithEmail(email, password);
      if (mode === "create") await auth.createAccount(email, password);
      if (mode === "reset") {
        await auth.sendPasswordReset(email);
        setResetSent(true);
        return;
      }
      onClose();
    } catch {
      // The provider exposes a sanitized error for the form.
    }
  };

  const handleGoogle = async () => {
    try {
      await auth.signInWithGoogle();
      onClose();
    } catch {
      // The provider exposes a sanitized error for the form.
    }
  };

  const title = mode === "create"
    ? "Create your account"
    : mode === "reset"
      ? "Reset your password"
      : "Welcome back";

  const description = mode === "create"
    ? "Save your kitchen and pick up on any device."
    : mode === "reset"
      ? "We'll send password reset instructions if an account exists."
      : "Sign in to your Chefness account.";

  const panel = (
    <div
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : "true"}
      aria-labelledby="auth-dialog-title"
      style={{ ...styles.panel, ...(embedded ? styles.embeddedPanel : {}) }}
    >
      {!embedded ? (
        <button type="button" aria-label="Close sign in" onClick={onClose} style={styles.closeButton}>
          <Icon name="x" size={19} />
        </button>
      ) : null}

      <div style={styles.brandMark}>
        <Icon name="chefHat" size={27} strokeWidth={1.8} />
      </div>
      <h2 id="auth-dialog-title" style={styles.title}>{title}</h2>
      <p style={styles.description}>{description}</p>

      {mode !== "reset" ? (
        <button type="button" onClick={() => void handleGoogle()} disabled={auth.isWorking} style={styles.googleButton}>
          <span aria-hidden="true" style={styles.googleMark}>G</span>
          Continue with Google
        </button>
      ) : null}

      {mode !== "reset" ? <div style={styles.separator}><span style={styles.separatorText}>or use email</span></div> : null}

      <form onSubmit={(event) => void handleSubmit(event)} style={styles.form}>
        <label htmlFor="auth-email" style={styles.label}>Email</label>
        <div style={styles.inputWrap}>
          <Icon name="mail" size={17} style={styles.inputIcon} />
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
            style={styles.input}
          />
        </div>

        {mode !== "reset" ? (
          <>
            <div style={styles.passwordLabelRow}>
              <label htmlFor="auth-password" style={styles.label}>Password</label>
              {mode === "sign-in" ? (
                <button type="button" onClick={() => changeMode("reset")} style={styles.textButton}>
                  Forgot password?
                </button>
              ) : null}
            </div>
            <div style={styles.inputWrap}>
              <Icon name="lock" size={17} style={styles.inputIcon} />
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                placeholder={mode === "create" ? "At least 8 characters" : "Your password"}
                minLength={mode === "create" ? 8 : undefined}
                required
                style={styles.input}
              />
            </div>
          </>
        ) : null}

        {auth.error ? <p role="alert" style={styles.error}>{auth.error}</p> : null}
        {resetSent ? (
          <p role="status" style={styles.success}>
            <Icon name="check" size={16} strokeWidth={3} />
            Check your inbox for reset instructions.
          </p>
        ) : null}

        <button type="submit" disabled={auth.isWorking || resetSent} style={styles.primaryButton}>
          {auth.isWorking
            ? "Please wait…"
            : mode === "create"
              ? "Create account"
              : mode === "reset"
                ? "Send reset link"
                : "Sign in"}
        </button>
      </form>

      <div style={styles.footer}>
        {mode === "sign-in" ? (
          <p>New to Chefness? <button type="button" onClick={() => changeMode("create")} style={styles.inlineButton}>Create an account</button></p>
        ) : mode === "create" ? (
          <p>Already have an account? <button type="button" onClick={() => changeMode("sign-in")} style={styles.inlineButton}>Sign in</button></p>
        ) : (
          <button type="button" onClick={() => changeMode("sign-in")} style={styles.inlineButton}>Back to sign in</button>
        )}
      </div>

    </div>
  );

  if (embedded) return panel;

  return (
    <div style={styles.overlay} onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      {panel}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    backgroundColor: "rgba(42, 31, 26, 0.34)",
    backdropFilter: "blur(8px)",
    overflowY: "auto",
  },
  panel: {
    position: "relative",
    width: "min(100%, 420px)",
    padding: "1.75rem 1.25rem 1.25rem",
    borderRadius: radii.xl,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glassStrong,
    boxShadow: shadows.glassXl,
    backdropFilter: "blur(24px)",
  },
  embeddedPanel: {
    width: "100%",
    padding: "1.5rem 1.25rem 1.25rem",
  },
  closeButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glass,
    color: colors.stone600,
    cursor: "pointer",
  },
  brandMark: {
    width: 52,
    height: 52,
    margin: "0 auto 0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: colors.saffron,
    backgroundColor: colors.saffronTint,
    border: `1px solid ${colors.saffronTintBorder}`,
    borderRadius: radii.lg,
  },
  title: {
    margin: "0 0 0.375rem",
    fontFamily: fonts.serif,
    fontSize: "1.65rem",
    lineHeight: 1.15,
    textAlign: "center",
    color: colors.espresso,
  },
  description: {
    margin: "0 auto 1.25rem",
    maxWidth: 320,
    color: colors.stone600,
    fontSize: "0.9rem",
    lineHeight: 1.5,
    textAlign: "center",
  },
  googleButton: {
    width: "100%",
    minHeight: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.65rem",
    borderRadius: radii.md,
    border: `1px solid ${colors.stone300}`,
    backgroundColor: colors.white,
    color: colors.espresso,
    fontSize: "0.95rem",
    fontWeight: 650,
    cursor: "pointer",
  },
  googleMark: {
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    color: colors.googleBlue,
    fontFamily: fonts.sans,
    fontWeight: 800,
    backgroundColor: colors.white,
  },
  separator: {
    position: "relative",
    height: 35,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  separatorText: {
    position: "relative",
    zIndex: 1,
    padding: "0 0.65rem",
    color: colors.stone400,
    backgroundColor: colors.glassStrong,
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  form: { display: "flex", flexDirection: "column", gap: "0.45rem" },
  label: { color: colors.stone700, fontSize: "0.82rem", fontWeight: 650 },
  passwordLabelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "0.55rem",
  },
  inputWrap: { position: "relative" },
  inputIcon: {
    position: "absolute",
    top: "50%",
    left: 12,
    transform: "translateY(-50%)",
    color: colors.stone400,
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    minHeight: 47,
    padding: "0.7rem 0.75rem 0.7rem 2.4rem",
    borderRadius: radii.md,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.white,
    color: colors.espresso,
    fontSize: "1rem",
    outlineColor: colors.saffron,
  },
  textButton: {
    border: "none",
    background: "none",
    color: colors.saffronDeep,
    fontSize: "0.78rem",
    fontWeight: 650,
    cursor: "pointer",
  },
  primaryButton: {
    width: "100%",
    minHeight: 48,
    marginTop: "0.8rem",
    border: "none",
    borderRadius: radii.md,
    backgroundColor: colors.saffron,
    color: colors.white,
    fontSize: "0.95rem",
    fontWeight: 750,
    boxShadow: shadows.glassLg,
    cursor: "pointer",
  },
  error: {
    margin: "0.4rem 0 0",
    padding: "0.65rem 0.75rem",
    borderRadius: radii.sm,
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    border: `1px solid ${colors.dangerTintBorder}`,
    fontSize: "0.82rem",
    lineHeight: 1.4,
  },
  success: {
    margin: "0.4rem 0 0",
    padding: "0.65rem 0.75rem",
    display: "flex",
    alignItems: "center",
    gap: "0.45rem",
    borderRadius: radii.sm,
    color: colors.success,
    backgroundColor: colors.successTint,
    border: `1px solid ${colors.successTintBorder}`,
    fontSize: "0.82rem",
  },
  footer: {
    marginTop: "1rem",
    color: colors.stone600,
    fontSize: "0.82rem",
    textAlign: "center",
  },
  inlineButton: {
    padding: 0,
    border: "none",
    background: "none",
    color: colors.saffronDeep,
    font: "inherit",
    fontWeight: 750,
    cursor: "pointer",
  },
};
