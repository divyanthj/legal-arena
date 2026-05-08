import Image from "next/image";
import authorImg from "@/public/images/profile.jpg";
import courtImg from "@/public/images/court.jpg";
import Link from "next/link";

const categorySlugs = {
  lawyerGame: "lawyer-game",
  courtroomStrategy: "courtroom-strategy",
};

export const categories = [
  {
    slug: categorySlugs.lawyerGame,
    title: "Lawyer Games",
    titleShort: "Lawyer Games",
    description:
      "Articles about online lawyer games, courtroom simulators, legal strategy games, and playable legal reasoning.",
    descriptionShort: "Online lawyer games and courtroom simulators.",
  },
  {
    slug: categorySlugs.courtroomStrategy,
    title: "Courtroom Strategy",
    titleShort: "Strategy",
    description:
      "Guides for building stronger case files, using facts well, and arguing more clearly in Legal Arena.",
    descriptionShort: "Case-building and argument strategy.",
  },
];

const authorSlugs = {
  legalArenaTeam: "legal-arena-team",
};

export const authors = [
  {
    slug: authorSlugs.legalArenaTeam,
    name: "Legal Arena Team",
    job: "Makers of Legal Arena",
    description:
      "The Legal Arena team builds playable AI courtroom cases for people interested in law, courtroom drama, debate, and legal reasoning.",
    avatar: authorImg,
    socials: [
      {
        name: "Instagram",
        icon: (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="3.5" />
            <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" />
          </svg>
        ),
        url: "https://instagram.com/legalarena.app",
      },
    ],
  },
];

const styles = {
  h2: "text-2xl lg:text-4xl font-bold tracking-tight mb-4 text-base-content",
  h3: "text-xl lg:text-2xl font-bold tracking-tight mb-2 text-base-content",
  p: "text-base-content/90 leading-relaxed",
  ul: "list-inside list-disc text-base-content/90 leading-relaxed",
  li: "list-item",
};

export const articles = [
  {
    slug: "what-is-a-lawyer-game",
    title: "What Is a Lawyer Game?",
    description:
      "A lawyer game lets you step into legal strategy: investigate facts, build a case, argue in court, and see whether your reasoning wins.",
    categories: [
      categories.find((category) => category.slug === categorySlugs.lawyerGame),
      categories.find(
        (category) => category.slug === categorySlugs.courtroomStrategy
      ),
    ],
    author: authors.find((author) => author.slug === authorSlugs.legalArenaTeam),
    publishedAt: "2026-05-08",
    image: {
      src: courtImg,
      urlRelative: "/images/court.jpg",
      alt: "A courtroom setting for an online lawyer game",
    },
    content: (
      <>
        <Image
          src={courtImg}
          alt="A courtroom setting for an online lawyer game"
          width={700}
          height={500}
          priority={true}
          className="rounded-box"
          placeholder="blur"
        />
        <section>
          <h2 className={styles.h2}>A lawyer game is about the argument</h2>
          <p className={styles.p}>
            A lawyer game is a courtroom or legal strategy game where the player
            takes on the work of building and presenting a case. The best versions
            are not only about choosing the right answer. They ask you to notice
            what matters, test facts, handle weak points, and persuade a judge or
            jury.
          </p>
        </section>

        <section>
          <h2 className={styles.h2}>How Legal Arena fits the category</h2>
          <p className={styles.p}>
            Legal Arena is an online lawyer game built around AI courtroom cases.
            You choose a dispute, interview your client, build a fact sheet, argue
            against AI opposing counsel, and receive a ruling based on your use of
            facts, law, and counterarguments.
          </p>
          <p className={styles.p}>
            That makes it different from a purely scripted courtroom story. Legal
            Arena gives you room to write your own arguments and improve across
            repeated cases.
          </p>
        </section>

        <section>
          <h3 className={styles.h3}>Who should play</h3>
          <ul className={styles.ul}>
            <li className={styles.li}>
              People who enjoy legal shows and want to feel the pressure of making
              the argument themselves.
            </li>
            <li className={styles.li}>
              Players looking for a browser-based courtroom game with AI
              opponents.
            </li>
            <li className={styles.li}>
              Debaters, writers, law students, and law-curious players who like
              structured reasoning.
            </li>
          </ul>
        </section>

        <section>
          <h2 className={styles.h2}>Start with a case</h2>
          <p className={styles.p}>
            The quickest way to understand Legal Arena is to play one matter from
            beginning to end: intake, fact sheet, courtroom, ruling. Start on the{" "}
            <Link href="/lawyer-game" className="link link-primary">
              lawyer game overview
            </Link>{" "}
            or open the dashboard and begin your first case.
          </p>
          <p className={styles.p}>
            Legal Arena is a game and training simulator. It is not legal advice
            and does not replace a lawyer for a real dispute.
          </p>
        </section>
      </>
    ),
  },
];
