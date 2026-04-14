export default function DeleteButton(props: {
    onDelete: (e: React.MouseEvent) => void;
}) {
    return (
        <button
            style={styles.deleteBtn}
            role="button"
            tabIndex={0}
            aria-label="Delete entry"
            onClick={(e) => props.onDelete(e)}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onDelete(e as unknown as React.MouseEvent);
                }
            }}
        >
            ×
        </button>
    );
}

const styles: Record<string, React.CSSProperties> = {
    deleteBtn: {
        backgroundColor: "transparent",
        border: "none",
        color: "#ef4444",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 44,
        minHeight: 44,
        fontSize: "1.25rem",
        fontWeight: 700,
        cursor: "pointer",
        flexShrink: 0,
        userSelect: "none" as const,
    },
};
