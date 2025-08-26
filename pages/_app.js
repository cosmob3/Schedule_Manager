import { SessionProvider } from "next-auth/react";
import { useEffect } from "react";
import "../app/globals.css";

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}) {
  useEffect(() => {
    // Register service worker and set up offline sync
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }

    // Listen for online/offline events
    const handleOnline = () => {
      console.log("App is online - syncing pending operations");
      // Trigger sync of pending operations
      if (window.syncPendingOperations) {
        window.syncPendingOperations();
      }
    };

    const handleOffline = () => {
      console.log("App is offline - operations will be queued");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
