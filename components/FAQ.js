"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export const faqList = [
  {
    question: "How does Legal Arena actually work?",
    answer: (
      <div className="space-y-2 leading-relaxed">
        <p>
          You start by interviewing one side of a case, build a fact sheet from
          what you learn, then argue the matter in court against AI-powered opposing
          counsel.
        </p>
        <p>
          The judge tracks how well you use corroborated facts, answer live disputes,
          and tie your theory to the lawbook.
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
        <svg
          className={`flex-shrink-0 w-4 h-4 ml-auto fill-current`}
          viewBox="0 0 16 16"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            y="7"
            width="16"
            height="2"
            rx="1"
            className={`transform origin-center transition duration-200 ease-out ${
              isOpen && "rotate-180"
            }`}
          />
          <rect
            y="7"
            width="16"
            height="2"
            rx="1"
            className={`transform origin-center rotate-90 transition duration-200 ease-out ${
              isOpen && "rotate-180 hidden"
            }`}
          />
        </svg>
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
