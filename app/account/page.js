import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import * as HeroIcons from "@heroicons/react/24/outline";
import { authOptions } from "@/libs/next-auth";
import AccountDeletionPanel from "@/components/AccountDeletionPanel";

export const metadata = {
  title: "Account settings | Legal Arena",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin?callbackUrl=/account");

  return (
    <main className="arena-app-shell min-h-screen px-5 py-10 text-white md:px-8 md:py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="arena-pill inline-flex items-center gap-2 px-4 py-2 text-sm">
          <HeroIcons.ArrowLeftIcon className="h-4 w-4" />
          Dashboard
        </Link>
        <p className="arena-kicker mt-10">Account</p>
        <h1 className="arena-headline mt-4 text-5xl uppercase md:text-7xl">Your Legal Arena identity</h1>
        <section className="arena-surface my-8 p-5 md:p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Signed in as</p>
          <p className="mt-2 text-lg font-bold">{session.user.email || session.user.name}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/community-guidelines" className="arena-btn-dark px-4 py-2 text-sm">
              Community Rules
            </Link>
            <Link href="/privacy-policy" className="arena-btn-dark px-4 py-2 text-sm">
              Privacy policy
            </Link>
          </div>
        </section>
        <AccountDeletionPanel />
      </div>
    </main>
  );
}

