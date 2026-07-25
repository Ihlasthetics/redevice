import {
  CalendarDays,
  Check,
  CircleCheck,
  Eye,
  Laptop,
  ScanLine,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { passportAdapter } from "./data/passport-adapter";

function App() {
  const passport = passportAdapter.getPublicPassport();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#passport-content"
        className="sr-only z-50 rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-canvas focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to passport
      </a>

      <header className="border-b border-line/80 bg-canvas/95">
        <div className="mx-auto flex min-h-18 max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a
            className="flex min-h-11 items-center gap-2.5"
            href="/"
            aria-label="ReDevice home"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-ink text-canvas">
              <Wrench aria-hidden="true" className="size-4.5" />
            </span>
            <span>
              <span className="block text-lg font-semibold leading-none tracking-tight">
                ReDevice
              </span>
              <span className="mt-1 hidden text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted sm:block">
                Device passport
              </span>
            </span>
          </a>

          <p className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-xs font-semibold text-muted sm:text-sm">
            <Eye aria-hidden="true" className="size-4 text-brand" />
            No wallet needed
          </p>
        </div>
      </header>

      <main
        id="passport-content"
        className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14 lg:py-18"
      >
        <section aria-labelledby="passport-title">
          <div className="flex flex-col gap-8 border-b border-line pb-10 sm:pb-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2.5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
                  Public device passport
                </p>
                <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">
                  Sample data
                </span>
              </div>
              <h1
                id="passport-title"
                className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-6xl"
              >
                {passport.model}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
                A plain-language record of this device&apos;s identity,
                condition, and verified service coverage.
              </p>
            </div>

            <div className="flex w-full max-w-sm items-start gap-3 rounded-2xl border border-success/25 bg-success-soft/70 p-4 lg:w-auto">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-white">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-success">
                  {passport.verification.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink/70">
                  Authorization is checked before a verified record can be
                  added.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label="Device summary"
          className="grid gap-6 py-8 sm:py-10 lg:grid-cols-[0.82fr_1.18fr]"
        >
          <figure className="flex min-h-72 flex-col overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_28px_70px_-52px_rgba(21,31,28,0.45)] sm:min-h-96">
            <div className="grid flex-1 place-items-center bg-[radial-gradient(circle_at_center,#e3eee7_0%,#f4f2eb_66%)] p-8">
              <div className="grid size-36 place-items-center rounded-full border border-brand/15 bg-surface/75 text-brand shadow-sm sm:size-44">
                <Laptop
                  aria-hidden="true"
                  className="size-20 stroke-[1.15] sm:size-24"
                />
              </div>
            </div>
            <figcaption className="flex items-center gap-3 border-t border-line px-5 py-4 text-sm text-muted">
              <ScanLine
                aria-hidden="true"
                className="size-4 shrink-0 text-brand"
              />
              <div>
                Product image placeholder · compare the masked serial with the
                physical device.
              </div>
            </figcaption>
          </figure>

          <article className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-[0_28px_70px_-52px_rgba(21,31,28,0.45)] sm:p-8">
            <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                  Device identity
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">
                  {passport.manufacturer} {passport.model}
                </h2>
                <p className="mt-2 text-sm text-muted">{passport.category}</p>
              </div>
              <p className="self-start rounded-full bg-canvas px-3 py-1.5 font-mono text-xs font-semibold text-muted">
                {passport.id}
              </p>
            </div>

            <dl className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2">
              <div className="bg-surface p-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Masked serial
                </dt>
                <dd className="mt-2 font-mono text-lg font-semibold tracking-wide">
                  {passport.maskedSerial}
                </dd>
              </div>

              <div className="bg-surface p-5">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Current condition
                </dt>
                <dd className="mt-2 flex items-center gap-2 text-lg font-semibold">
                  <CircleCheck
                    aria-hidden="true"
                    className="size-5 text-success"
                  />
                  {passport.condition}
                </dd>
              </div>

              <div className="bg-surface p-5 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  Verified history begins
                </dt>
                <dd className="mt-2 flex items-center gap-2 text-lg font-semibold">
                  <CalendarDays
                    aria-hidden="true"
                    className="size-5 text-brand"
                  />
                  <time dateTime={passport.coverageStart.isoDate}>
                    {passport.coverageStart.displayDate}
                  </time>
                </dd>
              </div>
            </dl>

            <div className="mt-6 rounded-2xl bg-ink p-5 text-canvas sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand">
                  <Check aria-hidden="true" className="size-4" />
                </span>
                <div>
                  <h2 className="font-semibold">
                    What this verification means
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-canvas/75">
                    {passport.verification.explanation} It verifies the
                    repairer&apos;s attestation—not that the physical repair
                    itself occurred.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </section>

        <footer className="border-t border-line pt-6 text-xs leading-5 text-muted">
          This sample passport uses mock data for interface review. No record on
          this page is presented as an onchain transaction.
        </footer>
      </main>
    </div>
  );
}

export default App;
