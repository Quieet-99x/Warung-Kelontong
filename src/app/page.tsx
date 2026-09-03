import WarungApp from "@/components/WarungApp";
import LoginScreen from "@/components/LoginScreen";
import { auth, googleAuthConfigured, signOut } from "@/auth";

export default async function Home() {
  const session = googleAuthConfigured ? await auth() : null;
  if (!session?.user?.id) return <LoginScreen configured={googleAuthConfigured}/>;
  async function logoutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }
  return <WarungApp accountId={session.user.id} user={session.user} logoutAction={logoutAction}/>;
}
