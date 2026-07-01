"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export const faqList = [
  {
    question: "What makes Legal Arena different from a normal legal quiz?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Legal Arena is built around open-ended play. You interview AI clients
          in your own words, decide which facts matter, build a case file, and
          argue before an AI judge.
        </p>
        <p>
          There is no multiple-choice answer key. Better questions, cleaner
          reasoning, and sharper courtroom strategy give you the edge.
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
          You start by interviewing your AI client. You decide what to ask, turn
          the answers into a case file, then argue the case in court.
        </p>
        <p>
          The other side pushes back, and the judge decides whether your facts
          and argument were strong enough.
        </p>
      </div>
    ),
  },
  {
    question: "Can I play against another player?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Yes. Legal Arena includes PVP case challenges. You challenge another
          player, each side independently interviews their own AI client, and
          then both players fight it out in court.
        </p>
        <p>
          An AI judge evaluates the arguments and gives the ruling.
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
    question: "Are the cases fixed or generated on the fly?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Current cases come from a managed case library. Each case includes
          structured facts, evidence references, and competing claims for both
          sides.
        </p>
        <p>
          That structure lets the interview and courtroom stages feel open-ended
          without collapsing into random chat. In the future, we may also include
          dynamically generated cases alongside the curated library.
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
          access through future updates and product changes.
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
