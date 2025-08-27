"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export default function ConnectGoogle() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  if (loading) {
    return (
      <button
        disabled
        className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md cursor-not-allowed"
      >
        Checking Google connection…
      </button>
    );
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
      >
        Connect Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-green-700 font-medium">✅ Connected to Google</span>
      <button
        onClick={() => signOut()}
        className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-md"
      >
        Sign out
      </button>
    </div>
  );
}
