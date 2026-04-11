import { BottomNavBar, type Tab } from "@/components/BottomNavBar";
import { useState } from "react";

export function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");

  return (
    <div style={{ paddingBottom: 56 }}>
      <BottomNavBar activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
