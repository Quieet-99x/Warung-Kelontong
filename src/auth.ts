import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, profile }) {
      if (profile?.sub) token.accountId = profile.sub;
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = String(token.accountId ?? token.sub ?? "");
      return session;
    },
  },
});

export const googleAuthConfigured = Boolean(
  process.env.AUTH_SECRET && process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);
