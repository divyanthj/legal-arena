"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export const faqList = [
  {
    question: "Is Legal Arena a lawyer game?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Yes. Legal Arena is an AI-powered lawyer game where you interview AI
          clients, build a case from what they tell you, argue in court, and get
          a ruling from the judge.
        </p>
        <p>
          If you want the game-focused overview, start with the{" "}
          <Link href="/lawyer-game" className="link link-primary">
            lawyer game page
          </Link>
          .
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
    question: "How does Legal Arena actually work?",
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
          The interface will clearly show whether you are representing the
          plaintiff or the defendant for that run.
        </p>
      </div>
    ),
  },
  {
    question: "Are the cases fixed or generated on the fly?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Cases come from a managed case library. Each case includes structured
          facts, evidence references, and competing claims for both sides.
        </p>
        <p>
          That structure lets the interview and courtroom stages feel open-ended
          without collapsing into random chat.
        </p>
      </div>
    ),
  },
  {
    question: "Can I replay a case?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Yes, but if you exit a case during intake, the same case is locked for
          24 hours before you can start it again.
        </p>
        <p>
          Finished matters stay in your history so you can review transcripts and
          verdicts.
        </p>
      </div>
    ),
  },
  {
    question: "How do I get access?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          Legal Arena is still in limited access. If you are not on the allowlist
          yet, reach out and we can add you.
        </p>
        <p>
          Contact:{" "}
          <a className="link link-primary" href="mailto:divyanthj@gmail.com">
            divyanthj@gmail.com
          </a>
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
        className="relative flex gap-2 items-center w-full py-5 text-base font-semibold text-left border-t md:text-lg border-base-content/10"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
      >
        <span
          className={`flex-1 text-base-content ${isOpen ? "text-primary" : ""}`}
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
            className="ml-auto h-5 w-5 shrink-0"
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
            className="ml-auto h-5 w-5 shrink-0"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        )}
      </button>

      <div
        ref={accordion}
        className={`transition-all duration-300 ease-in-out opacity-80 overflow-hidden`}
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
    <section className="bg-base-200" id="faq">
      <div className="py-24 px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-12">
        <div className="flex flex-col text-left basis-1/2">
          <p className="inline-block font-semibold text-primary mb-4">{eyebrow}</p>
          <p className="sm:text-4xl text-3xl font-extrabold text-base-content">
            {title}
          </p>
          {intro ? (
            <p className="mt-4 max-w-xl leading-7 text-base-content/75">{intro}</p>
          ) : null}
          {showAllQuestionsLink ? (
            <div className="mt-6">
              <Link href="/faq" className="link link-primary font-semibold">
                Open the full FAQ page
              </Link>
            </div>
          ) : null}
        </div>

        <ul className="basis-1/2">
          {faqList.map((item, i) => (
            <Item key={i} item={item} />
          ))}
        </ul>
      </div>
    </section>
  );
};

export default FAQ;
