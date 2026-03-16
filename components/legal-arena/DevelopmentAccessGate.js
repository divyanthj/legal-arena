export default function DevelopmentAccessGate({ email = "" }) {
  return (
    <main className="min-h-screen bg-base-200 px-4 py-6 md:px-8 md:py-10">
      <section className="mx-auto max-w-3xl">
        <div className="card border border-base-300 bg-base-100 shadow-2xl">
          <div className="card-body p-6 md:p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-base-content/45">
              Early Access
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">
              Legal Arena is still in development
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-base-content/75">
              We are still building Legal Arena. Keep an eye out for the full
              release. In the meantime, if you would like to try it out early,
              send an email to{" "}
              <a className="link link-primary" href="mailto:divyanthj@gmail.com">
                divyanthj@gmail.com
              </a>
              .
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-base-content/60">
              Since you are already signed in, we already have your email on file.
              If you want access before the full release, just email me directly and
              I can add you to the early-access allowlist.
            </p>
            {email ? (
              <div className="mt-6 rounded-box bg-base-200 p-5">
                <p className="text-sm font-semibold text-base-content">
                  Signed in as
                </p>
                <p className="mt-1 text-sm text-base-content/70">{email}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
