import { Icon } from "@/components/Icon";
import { useAuth } from "@/hooks/useAuth";
import { colors, fonts, radii, shadows } from "@/theme";

export function GuestImportDialog() {
  const auth = useAuth();
  const state = auth.guestImportState;
  if (state !== "prompting" && state !== "importing" && state !== "complete") return null;

  const items = [
    ["Recipes", auth.guestImportSummary.recipes],
    ["Cooking history", auth.guestImportSummary.cookingLog],
    ["AI preferences", auth.guestImportSummary.aiPreferences],
    ["Conversations", auth.guestImportSummary.chatSessions],
    ["Settings", auth.guestImportSummary.settings],
  ] as const;
  const visibleItems = items.filter(([, count]) => count > 0);

  return (
    <div style={styles.overlay}>
      <section role="dialog" aria-modal="true" aria-labelledby="guest-import-title" style={styles.card}>
        <div style={{ ...styles.iconWrap, ...(state === "complete" ? styles.successIcon : {}) }}>
          <Icon name={state === "complete" ? "check" : "cloud"} size={30} strokeWidth={2} />
        </div>

        {state === "prompting" ? (
          <>
            <p style={styles.eyebrow}>One-time import</p>
            <h2 id="guest-import-title" style={styles.title}>Bring your guest kitchen?</h2>
            <p style={styles.description}>
              We found data saved on this device. Import it to your account so it can follow you to other devices.
            </p>
            {visibleItems.length > 0 ? (
              <ul style={styles.summaryList}>
                {visibleItems.map(([label, count]) => (
                  <li key={label} style={styles.summaryItem}>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </li>
                ))}
              </ul>
            ) : null}
            <div style={styles.notice}>
              <Icon name="lock" size={17} />
              <span>API and OAuth keys stay only on this device.</span>
            </div>
            {auth.error ? <p role="alert" style={styles.error}>{auth.error}</p> : null}
            <button type="button" onClick={() => void auth.importGuestData().catch(() => undefined)} style={styles.primaryButton}>
              Import guest data
            </button>
            <button type="button" onClick={auth.declineGuestImport} style={styles.secondaryButton}>
              Not now
            </button>
            <p style={styles.finePrint}>A read-only recovery copy will be kept during the migration period.</p>
          </>
        ) : null}

        {state === "importing" ? (
          <div aria-live="polite" style={styles.centeredState}>
            <p style={styles.eyebrow}>Creating a safe recovery copy</p>
            <h2 id="guest-import-title" style={styles.title}>Importing your kitchen…</h2>
            <p style={styles.description}>Keep Chefness open while we verify every item.</p>
            <div style={styles.progressTrack}><span style={styles.progressFill} /></div>
            <div style={styles.steps}>
              <span><Icon name="check" size={15} /> Local backup ready</span>
              <span><Icon name="cloud" size={15} /> Preparing cloud sync</span>
            </div>
          </div>
        ) : null}

        {state === "complete" ? (
          <div aria-live="polite" style={styles.centeredState}>
            <p style={styles.eyebrow}>Import complete</p>
            <h2 id="guest-import-title" style={styles.title}>Your kitchen is ready.</h2>
            <p style={styles.description}>Your data is now associated with this account and ready for cross-device sync.</p>
            <div style={styles.notice}>
              <Icon name="lock" size={17} />
              <span>Your original data is retained in a read-only recovery snapshot.</span>
            </div>
            <button type="button" onClick={auth.dismissGuestImport} style={styles.primaryButton}>Start cooking</button>
          </div>
        ) : null}

        <p style={styles.mockNote}>Imports are verified before active guest data is cleared.</p>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 920,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    backgroundColor: "rgba(42, 31, 26, 0.38)",
    backdropFilter: "blur(9px)",
  },
  card: {
    width: "min(100%, 410px)",
    maxHeight: "calc(100dvh - 2rem)",
    overflowY: "auto",
    padding: "1.5rem 1.25rem 1.1rem",
    borderRadius: radii.xl,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glassStrong,
    boxShadow: shadows.glassXl,
    textAlign: "center",
  },
  iconWrap: {
    width: 58,
    height: 58,
    margin: "0 auto 0.85rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.lg,
    color: colors.saffronDeep,
    backgroundColor: colors.saffronTint,
    border: `1px solid ${colors.saffronTintBorder}`,
  },
  successIcon: {
    color: colors.success,
    backgroundColor: colors.successTint,
    borderColor: colors.successTintBorder,
  },
  eyebrow: {
    margin: "0 0 0.4rem",
    color: colors.saffronDeep,
    fontSize: "0.68rem",
    fontWeight: 850,
    letterSpacing: "0.11em",
    textTransform: "uppercase",
  },
  title: {
    margin: "0 0 0.6rem",
    fontFamily: fonts.serif,
    color: colors.espresso,
    fontSize: "1.7rem",
    lineHeight: 1.1,
  },
  description: {
    margin: "0 auto 1rem",
    maxWidth: 340,
    color: colors.stone600,
    fontSize: "0.88rem",
    lineHeight: 1.5,
  },
  summaryList: {
    margin: "0 0 0.85rem",
    padding: "0.25rem 0.85rem",
    listStyle: "none",
    borderRadius: radii.md,
    border: `1px solid ${colors.glassBorder}`,
    backgroundColor: colors.glass,
    textAlign: "left",
  },
  summaryItem: {
    minHeight: 38,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    color: colors.stone700,
    fontSize: "0.83rem",
    borderBottom: `1px solid ${colors.glassBorder}`,
  },
  notice: {
    margin: "0 0 1rem",
    padding: "0.7rem 0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.45rem",
    borderRadius: radii.md,
    color: colors.stone700,
    backgroundColor: colors.saffronTint,
    border: `1px solid ${colors.saffronTintBorder}`,
    fontSize: "0.78rem",
    lineHeight: 1.35,
  },
  primaryButton: {
    width: "100%",
    minHeight: 48,
    border: "none",
    borderRadius: radii.md,
    color: colors.white,
    backgroundColor: colors.saffron,
    boxShadow: shadows.glassLg,
    fontSize: "0.92rem",
    fontWeight: 750,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    minHeight: 42,
    marginTop: "0.35rem",
    border: "none",
    background: "none",
    color: colors.stone600,
    fontSize: "0.84rem",
    fontWeight: 700,
    cursor: "pointer",
  },
  finePrint: { margin: "0.25rem 0 0", color: colors.stone400, fontSize: "0.68rem", lineHeight: 1.4 },
  error: {
    margin: "0 0 0.75rem",
    padding: "0.6rem",
    color: colors.danger,
    backgroundColor: colors.dangerTint,
    borderRadius: radii.sm,
    fontSize: "0.78rem",
  },
  centeredState: { padding: "0.25rem 0 0.5rem" },
  progressTrack: {
    height: 8,
    margin: "1.2rem 0 0.85rem",
    overflow: "hidden",
    borderRadius: radii.pill,
    backgroundColor: colors.stone200,
  },
  progressFill: {
    display: "block",
    width: "72%",
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: colors.saffron,
  },
  steps: {
    marginBottom: "1rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "0.5rem",
    color: colors.stone600,
    fontSize: "0.78rem",
  },
  mockNote: {
    margin: "0.9rem 0 0",
    paddingTop: "0.7rem",
    borderTop: `1px solid ${colors.glassBorder}`,
    color: colors.stone400,
    fontSize: "0.66rem",
  },
};
