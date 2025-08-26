import Head from "next/head";
import { Wifi } from "lucide-react";

export default function Offline() {
  return (
    <>
      <Head>
        <title>Offline - Starbucks Scheduler</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <Wifi className="w-16 h-16 mx-auto mb-6 opacity-50" />
          <h1 className="text-3xl font-bold mb-4">You're offline</h1>
          <p className="text-lg mb-6">
            Don't worry! You can still upload images and create schedules.
            <br />
            Your changes will sync when you're back online.
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            className="bg-white text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors"
          >
            Continue Offline
          </button>
        </div>
      </div>
    </>
  );
}
