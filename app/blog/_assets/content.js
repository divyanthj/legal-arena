import Image from "next/image";
import authorImg from "@/public/images/profile.jpg";
import courtImg from "@/public/images/court.jpg";

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
  h2: "text-3xl lg:text-5xl font-semibold tracking-tight mb-5 text-white",
  h3: "text-2xl lg:text-3xl font-semibold tracking-tight mb-4 text-white",
  p: "text-white/68 text-lg leading-8",
  ul: "list-disc pl-6 text-white/68 text-lg leading-8 space-y-3",
  li: "pl-1",
};

export const articles = [
  {
    slug: "how-to-build-a-strong-case-in-a-lawyer-game",
    title: "How to Build a Strong Case in a Lawyer Game",
    description:
      "Learn how to interview your AI client, separate useful facts from noise, and build stronger courtroom arguments in Legal Arena.",
    categories: [
      categories.find((category) => category.slug === categorySlugs.lawyerGame),
      categories.find(
        (category) => category.slug === categorySlugs.courtroomStrategy
      ),
    ],
    author: authors.find((author) => author.slug === authorSlugs.legalArenaTeam),
    publishedAt: "2026-05-26",
    image: {
      src: courtImg,
      urlRelative: "/images/court.jpg",
      alt: "A dark courtroom scene representing case-building in a lawyer game",
    },
    content: (
      <>
        <Image
          src={courtImg}
          alt="A dark courtroom scene representing case-building in a lawyer game"
          width={700}
          height={500}
          priority={true}
          className="w-full rounded-[1.75rem] border border-white/10 object-cover"
          placeholder="blur"
        />
        <section>
          <h2 className={styles.h2}>Start by finding the actual conflict</h2>
          <p className={styles.p}>
            A good lawyer game is not about guessing the correct answer. It is
            about learning how to turn a messy story into a usable argument. In
            Legal Arena, that starts before you ever enter court. You interview
            your AI client, decide which facts matter, build a case theory, and
            then test that theory against opposition.
          </p>
          <p className={styles.p}>
            Most weak cases begin with a vague version of the dispute. Your client
            might say they were treated unfairly, cheated, ignored, or blamed for
            something they did not do. That is useful emotionally, but it is not
            yet a case. Your first job is to find the concrete conflict underneath
            the complaint.
          </p>
        </section>

        <section>
          <h3 className={styles.h3}>Questions that clarify the case</h3>
          <ul className={styles.ul}>
            <li className={styles.li}>What exactly happened?</li>
            <li className={styles.li}>Who did what?</li>
            <li className={styles.li}>When did it happen?</li>
            <li className={styles.li}>What changed after that?</li>
            <li className={styles.li}>
              What does your client want the judge to do?
            </li>
          </ul>
        </section>

        <section>
          <h2 className={styles.h2}>Separate facts from feelings</h2>
          <p className={styles.p}>
            A client&apos;s frustration matters, but a courtroom argument needs
            facts. In a lawyer game, this is where players often rush. They hear a
            dramatic detail and immediately build the whole case around it.
            Sometimes that works. Often, it hides the boring fact that actually
            decides the outcome.
          </p>
          <ul className={styles.ul}>
            <li className={styles.li}>
              Confirmed facts: things the client directly knows or can support.
            </li>
            <li className={styles.li}>
              Claims: things the client believes but may need proof for.
            </li>
            <li className={styles.li}>
              Weak spots: facts that could help the other side.
            </li>
          </ul>
          <p className={styles.p}>
            A strong case is not one where you pretend the weak facts do not
            exist. It is one where you know how to handle them before the other
            side does.
          </p>
        </section>

        <section>
          <h2 className={styles.h2}>Build a simple case theory</h2>
          <p className={styles.p}>
            A case theory is your short answer to: why should this side win? It
            should be simple enough to remember during the courtroom phase. If
            your theory needs six paragraphs to explain, it probably is not ready
            yet.
          </p>
          <p className={styles.p}>
            A good theory connects facts to fairness. It tells the judge not only
            what happened, but why those facts should lead to your result.
          </p>
        </section>

        <section>
          <h2 className={styles.h2}>Do not overstuff the argument</h2>
          <p className={styles.p}>
            More facts do not automatically make a stronger argument. In Legal
            Arena, the stronger move is often choosing the best facts and using
            them clearly. If you mention every detail from the interview, the
            important points can disappear inside the pile.
          </p>
          <ul className={styles.ul}>
            <li className={styles.li}>Your strongest fact.</li>
            <li className={styles.li}>Your strongest proof point.</li>
            <li className={styles.li}>The other side&apos;s most likely attack.</li>
            <li className={styles.li}>Your answer to that attack.</li>
            <li className={styles.li}>The specific result you want.</li>
          </ul>
        </section>

        <section>
          <h2 className={styles.h2}>Listen for what the other side can use</h2>
          <p className={styles.p}>
            A good courtroom strategy includes the opponent&apos;s argument. If your
            client admits they missed a deadline, lost a record, changed their
            story, or acted emotionally, do not ignore it. That fact will probably
            come up later.
          </p>
          <p className={styles.p}>
            The point is not to magically erase bad facts. The point is to make
            them less damaging. Maybe the missed deadline did not cause the real
            harm. Maybe the missing record is less important because other facts
            still line up. Maybe the emotional reaction makes sense given what
            happened before it.
          </p>
        </section>

        <section>
          <h2 className={styles.h2}>Turn preparation into courtroom pressure</h2>
          <p className={styles.p}>
            Once you reach court, your job changes. You are no longer discovering
            the case. You are presenting it. Start with the core theory, use
            specific facts, explain why those facts matter, address the obvious
            weakness, and ask for a clear outcome.
          </p>
          <p className={styles.p}>
            The judge should not have to guess what you want or why you think you
            deserve it. The fun of Legal Arena is that each case teaches you the
            pattern: interview, prepare, argue, learn, repeat.
          </p>
          <p className={styles.p}>
            Legal Arena is a game and training simulator. It is not legal advice
            and does not replace a lawyer for a real dispute.
          </p>
        </section>
      </>
    ),
  },
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
          className="w-full rounded-[1.75rem] border border-white/10 object-cover"
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
            beginning to end: intake, fact sheet, courtroom, ruling. Open the
            dashboard and begin your first case.
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
