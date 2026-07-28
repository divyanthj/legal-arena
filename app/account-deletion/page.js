import Link from "next/link";
import * as HeroIcons from "@heroicons/react/24/outline";
import AccountDeletionRequestForm from "@/components/AccountDeletionRequestForm";

export const metadata = {
  title: "Delete a Legal Arena account",
  description: "Delete a Legal Arena account and its associated private data.",
};

export default function AccountDeletionRequestPage() {
  return (
    <main className="arena-landing min-h-screen bg-[#020202] px-5 py-12 text-white md:px-8 md:py-20">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="arena-pill inline-flex items-center gap-2 px-4 py-2 text-sm">
          <HeroIcons.ArrowLeftIcon className="h-4 w-4" />
          Legal Arena
        </Link>
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_0.78fr]">
          <section>
            <p className="arena-kicker">Privacy control</p>
            <h1 className="arena-headline mt-4 text-5xl uppercase md:text-7xl">Delete your account</h1>
            <p className="mt-5 text-base leading-8 text-white/65">
              If you can sign in, the fastest path is Account settings, where deletion
              is immediate after confirmation. If you cannot access the account, submit
              a request and we will verify ownership.
            </p>
            <Link href="/account" className="arena-btn-dark mt-6 inline-flex px-5 py-3 text-sm font-black">
              Open account settings
            </Link>
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm leading-7 text-white/58">
              Deletion removes sign-in data, profile details, solo gameplay, awards,
              usage events, API credentials, and account access. Shared PVP history is
              anonymized for the other participant, and published case reports involving
              the account are unpublished. Payment transaction records may remain with
              the payment provider where legally required.
            </div>
          </section>
          <section className="arena-surface p-5 md:p-7">
            <p className="arena-kicker">Cannot sign in?</p>
            <h2 className="mt-3 text-2xl font-black">Submit a verified request</h2>
            <div className="mt-6">
              <AccountDeletionRequestForm />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
