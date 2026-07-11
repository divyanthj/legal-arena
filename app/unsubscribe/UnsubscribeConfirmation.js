"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import apiClient from "@/libs/api";
import { trackGoal } from "@/libs/datafast";

export default function UnsubscribeConfirmation({ token = "" }) {
  const visitedRef = useRef(false);
  const [status, setStatus] = useState(token ? "confirm" : "invalid");

  useEffect(() => {
    if (visitedRef.current) return;
    visitedRef.current = true;
    trackGoal("unsubscribe_page_visited", { has_token: Boolean(token) });
  }, [token]);

  const confirm = async () => {
    setStatus("working");
    try {
      await apiClient.post("/unsubscribe", { token });
      setStatus("done");
      trackGoal("unsubscribe_confirmed", { source: "email_footer" });
    } catch (error) { setStatus("error"); }
  };

  return (
    <main className="arena-app-shell min-h-screen px-4 py-12 text-white">
      <section className="arena-surface mx-auto max-w-xl p-6 text-center md:p-9">
        <p className="arena-kicker">Email preferences</p>
        <h1 className="arena-headline mt-3 text-4xl uppercase">Unsubscribe from mailing?</h1>
        {status === "done" ? <p className="mt-5 leading-7 text-white/66">You have been removed from announcements, product updates, digests, and marketing emails. Essential account and gameplay messages may still be sent.</p> : null}
        {status === "invalid" ? <p className="mt-5 text-rose-200">This unsubscribe link is incomplete or invalid.</p> : null}
        {status === "error" ? <p className="mt-5 text-rose-200">We could not update your preference. Please try again.</p> : null}
        {["confirm", "working", "error"].includes(status) ? (
          <>
            <p className="mt-5 leading-7 text-white/66">Choose yes to stop receiving mailing-list emails from Legal Arena.</p>
            <div className="mt-7 flex justify-center gap-3">
              <button type="button" className="arena-btn-danger px-5 py-3" disabled={status === "working"} onClick={confirm}>{status === "working" ? "Unsubscribing…" : "Yes, unsubscribe"}</button>
              <Link href="/" className="arena-btn-dark px-5 py-3">No, keep emails</Link>
            </div>
          </>
        ) : <Link href="/" className="arena-btn-light mt-7 inline-flex px-5 py-3">Return to Legal Arena</Link>}
      </section>
    </main>
  );
}
