"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export const faqList = [
  {
    question: "What makes Legal Arena different from a normal legal quiz?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Legal Arena is built around open-ended legal strategy. You interview
          AI clients in your own words, decide which facts matter, shape a fact
          sheet, negotiate when settlement makes sense, and argue before an AI
          judge.
        </p>
        <p>
          There is no multiple-choice answer key. Better questions, cleaner
          reasoning, sharper settlement choices, and stronger courtroom strategy
          give you the edge.
        </p>
      </div>
    ),
  },
  {
    question: "Do I need legal experience to play?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          No. Legal Arena is built for people interested in law, courtroom drama,
          legal shows, debate, and strategic argument.
        </p>
        <p>
          Law students and lawyers may enjoy it, but the game starts with the
          basics: ask the client good questions, find useful facts, and make the
          clearest argument you can.
        </p>
      </div>
    ),
  },
  {
    question: "What happens during a case?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          You start by interviewing your AI client and turning the useful answers
          into a working fact sheet. The file tracks the theory, timeline,
          supporting facts, risks, proof gaps, and the result you want.
        </p>
        <p>
          From there, you may test settlement, finalize the file, and argue in
          court. The other side pushes back, and the judge decides whether your
          facts and argument were strong enough.
        </p>
      </div>
    ),
  },
  {
    question: "Can I settle a case instead of going to court?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Yes. Some matters let you make settlement offers before the courtroom
          stage. You can read the other side&apos;s leverage, revise your position,
          and decide whether a deal is better than taking the risk of a verdict.
        </p>
        <p>
          Settlement is part of the strategy. A clean deal can be the smarter win
          when your facts, proof, or downside risk point that way.
        </p>
      </div>
    ),
  },
  {
    question: "Can I play against another player?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Yes. Legal Arena includes asynchronous PVP case challenges. You
          challenge another player, each side privately interviews their own AI
          client, and then both players meet in court through timed rounds.
        </p>
        <p>
          You do not both need to be online at the same time. Once each round is
          ready, the arguments are revealed and an AI judge evaluates the match.
        </p>
      </div>
    ),
  },
  {
    question: "Do I always represent the same side?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          No. New case sessions can assign you either side at random.
        </p>
        <p>
          The interface clearly shows whether you represent the plaintiff or the
          defendant for that run, so you can question your client and frame your
          theory from the correct angle.
        </p>
      </div>
    ),
  },
  {
    question: "Are the cases fixed or always the same?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Legal Arena is moving toward a larger stream of fresh legal matters.
          Cases can vary by client, facts, stakes, party assignment, and
          courtroom pressure, so the experience does not feel like replaying a
          single canned puzzle.
        </p>
        <p>
          Once a session starts, the matter is stored as stable state. That means
          the client interview can feel flexible while the case facts remain
          consistent enough to argue from.
        </p>
      </div>
    ),
  },
  {
    question: "Can I use voice input?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Yes. Supported intake flows include microphone input, with a waveform
          indicator so you can tell when your voice is being captured.
        </p>
        <p>
          You can still type your questions whenever you prefer. Voice input is
          there to make client interviews feel faster and more natural.
        </p>
      </div>
    ),
  },
  {
    question: "How do progression and leaderboards work?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Legal Arena tracks your record across wins, losses, draws,
          settlements, ratings, XP, specialty boards, and category progress.
        </p>
        <p>
          Solo cases and PVP challenges tell different parts of your lawyer
          profile, so you can improve against AI opponents and test yourself
          against other players.
        </p>
      </div>
    ),
  },
  {
    question: "What feedback do I get after a ruling?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Verdicts explain who prevailed, what helped your argument, what hurt
          your side, and how your courtroom strategy performed.
        </p>
        <p>
          Use that feedback as a study tool. It can show whether you relied on
          useful facts, answered the opposing argument, handled risks, and tied
          your theory to the rules in play.
        </p>
      </div>
    ),
  },
  {
    question: "What does lifetime access include?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Right now, Legal Arena offers lifetime access. If you buy now, you keep
          permanent access to the current product and future Legal Arena updates
          and changes.
        </p>
        <p>
          That includes improvements to the interface, case library, gameplay
          systems, progression, and other features we add over time.
        </p>
      </div>
    ),
  },
  {
    question: "Will there be other pricing plans later?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Possibly. We may introduce other pricing plans in the future as Legal
          Arena grows.
        </p>
        <p>
          The important part: buying lifetime access now means you keep permanent
          access through future updates and product changes as the game evolves.
        </p>
      </div>
    ),
  },
  {
    question: "Is Legal Arena legal advice?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          No. Legal Arena is a game. It is not a lawyer, law firm, legal advice
          service, or substitute for hiring an attorney.
        </p>
      </div>
    ),
  },
  {
    question: "What if I have a question before buying?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Send us a note and we will route it to the right place.
        </p>
        <p>
          Use the{" "}
          <Link href="/contact" className="text-amber-100 underline underline-offset-4">
            contact page
          </Link>{" "}
          and the team will route your request.
        </p>
      </div>
    ),
  },
];

const Item = ({ item }) => {
  const accordion = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li>
      <button
        className="relative flex w-full items-center gap-3 border-t border-white/10 py-5 text-left text-base font-semibold text-white/82 transition hover:text-white md:text-lg"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
      >
        <span
          className={`flex-1 ${isOpen ? "text-amber-100" : ""}`}
        >
          {item?.question}
        </span>
        {isOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="ml-auto h-5 w-5 shrink-0 text-amber-100/72"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="ml-auto h-5 w-5 shrink-0 text-white/42"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        )}
      </button>

      <div
        ref={accordion}
        className="overflow-hidden text-white/62 opacity-80 transition-all duration-300 ease-in-out"
        style={
          isOpen
            ? { maxHeight: accordion?.current?.scrollHeight, opacity: 1 }
            : { maxHeight: 0, opacity: 0 }
        }
      >
        <div className="pb-5 leading-relaxed">{item?.answer}</div>
      </div>
    </li>
  );
};

const FAQ = ({
  title = "Frequently Asked Questions",
  eyebrow = "FAQ",
  intro = "",
  showAllQuestionsLink = false,
}) => {
  return (
    <section className="bg-transparent" id="faq">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-5 py-16 md:flex-row md:px-8 md:py-20">
        <div className="basis-1/2 text-left">
          <p className="arena-kicker mb-4">{eyebrow}</p>
          <p className="arena-headline text-3xl uppercase leading-none text-white sm:text-5xl">
            {title}
          </p>
          {intro ? (
            <p className="mt-5 max-w-xl text-base leading-7 text-white/62">{intro}</p>
          ) : null}
          {showAllQuestionsLink ? (
            <div className="mt-6">
              <Link href="/faq" className="font-semibold text-amber-100 underline underline-offset-4">
                Open the full FAQ page
              </Link>
            </div>
          ) : null}
        </div>

        <ul className="arena-surface basis-1/2 p-5 md:p-7">
          {faqList.map((item, i) => (
            <Item key={i} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
};

export default FAQ;
