import { AuthChoiceView } from "@/components/AuthChoiceView";
import { AuthLoadingView } from "@/components/AuthLoadingView";
import { GuestImportDialog } from "@/components/GuestImportDialog";
import { HomePage } from "@/components/HomePage";
import { useAuth } from "@/hooks/useAuth";

function App() {
  const auth = useAuth();

  if (auth.isRestoring) {
    return <AuthLoadingView />;
  }

  if (!auth.hasCompletedOnboarding) {
    return <AuthChoiceView />;
  }

  return (
    <>
      <HomePage />
      <GuestImportDialog />
    </>
  );
}

export default App;
