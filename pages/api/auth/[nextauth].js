// pages/api/auth/[...nextauth].js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

async function refreshAccessToken(token) {
  try {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const refreshed = await res.json();
    if (!res.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      // Only update if Google returned a new refresh token
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: null,
    };
  } catch (e) {
    console.error("Failed to refresh access token", e);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // Minimal scope for creating/editing events you create:
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.events",
          // Ensure we get a refresh_token on first consent
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: stash tokens
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token; // may be undefined on later logins
        token.expiresAt = Date.now() + account.expires_in * 1000; // ms
        return token;
      }

      // If token not expired, use it
      if (token.expiresAt && Date.now() < token.expiresAt - 60_000) {
        return token;
      }

      // Otherwise refresh
      if (token.refreshToken) {
        return await refreshAccessToken(token);
      }

      // No refresh token available
      return { ...token, error: "NoRefreshToken" };
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error ?? null;
      return session;
    },
  },
  pages: {
    // Optional: your sign-in page route if you have one
    // signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
