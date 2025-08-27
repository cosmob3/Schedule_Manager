"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export default function ConnectGoogle() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  const here = () => window.location.href;

  const handleSignIn = () => {
    // ensure we persist right before redirect (belt & suspenders)
    window.dispatchEvent(new Event("sm:persist"));
    const back = here();
    sessionStorage.setItem("sm.returnTo", back);
    signIn("google", { callbackUrl: back });
  };

  const handleSignOut = () => {
    window.dispatchEvent(new Event("sm:persist"));
    const back = here();
    signOut({ callbackUrl: back });
  };

  if (loading) {
    return (
      <button className="px-4 py-2 rounded bg-gray-300 text-gray-600" disabled>
        Checking Google…
      </button>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-700">
          Connected as <strong>{session.user?.email}</strong>
        </span>
        <button
          onClick={handleSignOut}
          className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-gray-800"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
    >
      Connect Google
    </button>
  );
}
