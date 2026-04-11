const navItems = ["Home", "Search", "Add", "Profile"] as const;

export function BottomNavBar() {
  return (
    <nav style={styles.nav}>
      {navItems.map((label) => (
        <button key={label} style={styles.item}>
          {label}
        </button>
      ))}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    width: "100%",
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-around",
    background: "#fff",
    borderTop: "1px solid #e5e7eb",
    zIndex: 1000,
  },
  item: {
    flex: 1,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontSize: "0.75rem",
    color: "#6b7280",
    fontWeight: 500,
  },
};
