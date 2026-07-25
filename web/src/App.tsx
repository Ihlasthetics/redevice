import { useCurrentAccount } from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import {
  ArrowRight,
  Database,
  ScanLine,
  ShieldCheck,
  Wrench,
} from "lucide-react";

const pillars = [
  {
    icon: ShieldCheck,
    title: "Authorized attestations",
    description:
      "Move capabilities identify which repairers may append verified records.",
  },
  {
    icon: Database,
    title: "Tamper-evident evidence",
    description:
      "Repair records point to public, non-sensitive evidence stored on Walrus.",
  },
  {
    icon: ScanLine,
    title: "Buyer-first verification",
    description:
      "A public passport explains device history without requiring a wallet.",
  },
];

function App() {
  const currentAccount = useCurrentAccount();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line/80 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a
            className="flex items-center gap-2.5"
            href="/"
            aria-label="ReDevice"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-ink text-canvas">
              <Wrench className="size-4.5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              ReDevice
            </span>
          </a>

          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted sm:inline">
              Sui Testnet
            </span>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-28">
          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              Trust the repair, not the claim
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl">
              A verifiable service history for every refurbished device.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              ReDevice shows who repaired a device, when it happened, and what
              evidence supports the record—without asking buyers to understand
              blockchain.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <button className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-canvas transition hover:-translate-y-0.5">
                View sample passport
                <ArrowRight className="size-4" />
              </button>
              <button className="rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold transition hover:border-ink/30">
                Open repair workspace
              </button>
            </div>

            {currentAccount && (
              <p className="mt-4 text-xs text-muted">
                Wallet connected: {currentAccount.address.slice(0, 8)}…
                {currentAccount.address.slice(-6)}
              </p>
            )}
          </div>

          <div className="rounded-[2rem] border border-line bg-surface p-5 shadow-[0_30px_80px_-45px_rgba(21,31,28,0.35)] sm:p-7">
            <div className="flex items-start justify-between border-b border-line pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  Device passport
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  MacBook Pro 14
                </h2>
                <p className="mt-1 text-sm text-muted">Serial C02•••••92</p>
              </div>
              <span className="rounded-full bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
                Repairer verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-5">
              <div className="rounded-2xl bg-canvas p-4">
                <p className="text-xs text-muted">Current condition</p>
                <p className="mt-1.5 font-semibold">Refurbished</p>
              </div>
              <div className="rounded-2xl bg-canvas p-4">
                <p className="text-xs text-muted">Verified since</p>
                <p className="mt-1.5 font-semibold">25 Jul 2026</p>
              </div>
            </div>

            <div className="rounded-2xl border border-line p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Battery replaced</p>
                  <p className="mt-1 text-sm text-muted">
                    Health 96% · Lisbon Repair Center
                  </p>
                </div>
                <ShieldCheck className="size-5 text-success" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-px px-5 py-12 md:grid-cols-3">
            {pillars.map(({ icon: Icon, title, description }) => (
              <article key={title} className="py-5 md:px-6 first:pl-0">
                <Icon className="size-5 text-brand" />
                <h2 className="mt-4 font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
