"use client";

import { useSession, signIn } from "next-auth/react";
import type { ReactNode } from "react";

export default function RequireGoogle({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center text-gray-700">
        Checking your Google session…
      </div>
    );
  }

  if (!session) {
    const handleSignIn = () => {
      const back = window.location.href;
      signIn("google", { callbackUrl: back });
    };

    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-green-600 to-green-800 p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-6 text-center">
          <h1 className="text-2xl font-semibold mb-2">Sign in with Google</h1>
          <p className="text-gray-600 mb-6">
            Connect your Google account to add shifts to your calendar.
          </p>
          <button
            onClick={handleSignIn}
            className="px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
