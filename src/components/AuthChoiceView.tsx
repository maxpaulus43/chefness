import { useState } from "react";
import { AuthDialog } from "@/components/AuthDialog";
import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import { colors, fonts, radii, shadows } from "@/theme";

export function AuthChoiceView() {
  const auth = useAuth();
  const [showEmail, setShowEmail] = useState(false);

  if (showEmail) {
    return (
      <main style={styles.root}>
        <div style={styles.emailWrap}>
          <button type="button" onClick={() => setShowEmail(false)} style={styles.backButton}>
            <Icon name="arrowLeft" size={17} />
            Back
          </button>
          <AuthDialog embedded onClose={() => setShowEmail(false)} />
        </div>
      </main>
    );
  }

  const handleGoogle = async () => {
    try {
      await auth.signInWithGoogle();
    } catch {
      // Sanitized provider error is rendered below.
    }
  };

  return (
    <main style={styles.root}>
      <section style={styles.hero}>
        <div style={styles.logo}>
          <Icon name="chefHat" size={38} strokeWidth={1.7} />
        </div>
        <p style={styles.eyebrow}>Your personal sous-chef</p>
        <h1 style={styles.title}>Your kitchen,<br />wherever you cook.</h1>
        <p style={styles.subtitle}>
          Sign in to keep recipes, cooking memories, and conversations with you across devices.
        </p>

        <div style={styles.benefits}>
          <Benefit icon="cloud" title="Sync your kitchen" text="Pick up recipes and chats on another device." />
          <Benefit icon="lock" title="Your AI keys stay local" text="Private credentials never leave this device." />
        </div>
      </section>

      <section style={styles.actionsCard} aria-label="Choose how to continue">
        <button type="button" onClick={() => void handleGoogle()} disabled={auth.isWorking} style={styles.googleButton}>
          <span aria-hidden="true" style={styles.googleMark}>G</span>
          {auth.isWorking ? "Signing in…" : "Continue with Google"}
        </button>
        <button type="button" onClick={() => setShowEmail(true)} disabled={auth.isWorking} style={styles.emailButton}>
          <Icon name="mail" size={18} />
          Continue with email
        </button>
        {auth.error ? <p role="alert" style={styles.error}>{auth.error}</p> : null}
        <button type="button" onClick={auth.continueAsGuest} style={styles.guestButton}>
          Continue as guest
        </button>
        <p style={styles.guestNote}>Guest data stays only on this device.</p>
      </section>

    </main>
  );
}

function Benefit({ icon, title, text }: { icon: "cloud" | "lock"; title: string; text: string }) {
  return (
    <div style={styles.benefit}>
      <span style={styles.benefitIcon}><Icon name={icon} size={20} /></span>
      <span>
        <strong style={styles.benefitTitle}>{title}</strong>
        <span style={styles.benefitText}>{text}</span>
      </span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    width: "100%",
    maxWidth: 480,
    margin: "0 auto",
    padding: "max(2rem, env(safe-area-inset-top)) 1.25rem max(1.25rem, env(safe-area-inset-bottom))",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    color: colors.espresso,
  },
  hero: { textAlign: "center" },
  logo: {
    width: 72,
    height: 72,
    margin: "0 auto 1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: colors.saffron,
    borderRadius: radii.xl,
    border: `1px solid ${colors.saffronTintBorder}`,
    backgroundColor: colors.saffronTint,
    boxShadow: shadows.glass,
  },
  eyebrow: {
    margin: "0 0 0.5rem",
    color: colors.saffronDeep,
    fontSize: "0.72rem",
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
    fontFamily: fonts.serif,
    fontSize: "clamp(2.25rem, 10vw, 3.15rem)",
    lineHeight: 0.98,
    letterSpacing: "-0.035em",
    color: colors.espresso,
  },
  subtitle: {
    maxWidth: 390,
    margin: "1rem auto 1.35rem",
    color: colors.stone600,
    fontSize: "0.93rem",
    lineHeight: 1.55,
  },
  benefits: {
    display: "grid",
    gap: "0.65rem",
    marginBottom: "1.35rem",
    textAlign: "left",
  },
  benefit: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "0.75rem 0.85rem",
    borderRadius: radii.md,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glass,
    boxShadow: shadows.glass,
  },
  benefitIcon: {
    width: 38,
    height: 38,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: colors.saffronDeep,
    borderRadius: radii.md,
    backgroundColor: colors.saffronTint,
  },
  benefitTitle: { display: "block", fontSize: "0.84rem", color: colors.espresso },
  benefitText: { display: "block", marginTop: 2, fontSize: "0.75rem", color: colors.stone600, lineHeight: 1.35 },
  actionsCard: {
    padding: "1rem",
    borderRadius: radii.xl,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glassStrong,
    boxShadow: shadows.glassXl,
    backdropFilter: "blur(18px)",
  },
  googleButton: {
    width: "100%",
    minHeight: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.65rem",
    borderRadius: radii.md,
    border: `1px solid ${colors.stone300}`,
    backgroundColor: colors.white,
    color: colors.espresso,
    fontSize: "0.95rem",
    fontWeight: 700,
    cursor: "pointer",
  },
  googleMark: {
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: colors.googleBlue,
    fontWeight: 850,
  },
  emailButton: {
    width: "100%",
    minHeight: 50,
    marginTop: "0.65rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.55rem",
    borderRadius: radii.md,
    border: "none",
    backgroundColor: colors.saffron,
    color: colors.white,
    fontSize: "0.95rem",
    fontWeight: 750,
    boxShadow: shadows.glassLg,
    cursor: "pointer",
  },
  guestButton: {
    width: "100%",
    marginTop: "0.85rem",
    padding: "0.35rem",
    border: "none",
    background: "none",
    color: colors.stone700,
    fontSize: "0.88rem",
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationColor: colors.stone300,
    textUnderlineOffset: 4,
  },
  guestNote: { margin: "0.25rem 0 0", textAlign: "center", color: colors.stone400, fontSize: "0.7rem" },
  error: {
    margin: "0.65rem 0 0",
    padding: "0.6rem 0.7rem",
    borderRadius: radii.sm,
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    fontSize: "0.8rem",
  },
  emailWrap: { width: "100%", margin: "auto 0" },
  backButton: {
    minHeight: 42,
    marginBottom: "0.75rem",
    padding: "0 0.7rem",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    border: "none",
    background: "none",
    color: colors.stone700,
    fontWeight: 700,
    cursor: "pointer",
  },
};
