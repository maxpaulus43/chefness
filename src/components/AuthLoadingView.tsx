import { Icon } from "@/components/Icon";
import { colors, fonts, radii, shadows } from "@/theme";

export function AuthLoadingView() {
  return (
    <main aria-busy="true" aria-label="Restoring your Chefness session" style={styles.root}>
      <div style={styles.mark}><Icon name="chefHat" size={34} strokeWidth={1.8} /></div>
      <h1 style={styles.title}>Chefness</h1>
      <p style={styles.message}>Opening your kitchen…</p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
    color: colors.espresso,
  },
  mark: {
    width: 66,
    height: 66,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: colors.saffron,
    borderRadius: radii.xl,
    border: `1px solid ${colors.saffronTintBorder}`,
    backgroundColor: colors.saffronTint,
    boxShadow: shadows.glass,
  },
  title: {
    margin: "0.8rem 0 0.2rem",
    fontFamily: fonts.serif,
    fontSize: "1.8rem",
  },
  message: {
    margin: 0,
    color: colors.stone500,
    fontSize: "0.82rem",
  },
};
