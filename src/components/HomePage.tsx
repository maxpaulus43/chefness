import { BottomNavBar, type Tab } from "@/components/BottomNavBar";
import { ChatView } from "@/components/ChatView";
import { HistoryView } from "@/components/HistoryView";
import { SettingsView } from "@/components/SettingsView";
import { useOpenRouterOAuth } from "@/hooks/useOpenRouterOAuth";
import { useState, useCallback, type ReactNode } from "react";
import RecipeView from "./RecipeView";

// ---------------------------------------------------------------------------
// TabPanel — CSS display toggling to keep children mounted across tab switches
// ---------------------------------------------------------------------------

function TabPanel({
    active,
    children,
}: {
    active: boolean;
    children: ReactNode;
}) {
    return (
        <div
            style={{
                display: active ? "flex" : "none",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
            }}
        >
            {children}
        </div>
    );
}

export function HomePage() {
    console.log("Rendering HomePage");
    // Process OpenRouter OAuth callback (if redirected back with ?code=).
    // This must run inside TRPCProvider so useSettings() works.
    useOpenRouterOAuth();

    const [activeTab, setActiveTab] = useState<Tab>("chat");

    const navigateToSettings = useCallback(() => {
        setActiveTab("settings");
    }, []);

    return (
        <div style={styles.root}>
            <div style={styles.content}>
                <TabPanel active={activeTab === "chat"}>
                    <ChatView onNavigateToSettings={navigateToSettings} />
                </TabPanel>
                <TabPanel active={activeTab === "recipes"}>
                    <RecipeView />
                </TabPanel>
                <TabPanel active={activeTab === "history"}>
                    <HistoryView />
                </TabPanel>
                <TabPanel active={activeTab === "settings"}>
                    <SettingsView />
                </TabPanel>
            </div>
            <BottomNavBar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    root: {
        height: "100vh",
        display: "flex",
        flexDirection: "column",
    },
    content: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        paddingBottom: 56,
    },
};
