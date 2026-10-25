import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

type Section =
  "passports" | "register" | "repairer" | "passkey" | "admin" | "deploy";

const links: { section: Section; label: string; href: string }[] = [
  { section: "passports", label: "Passports", href: "/" },
  { section: "register", label: "Register device", href: "/register" },
  { section: "repairer", label: "Repair workspace", href: "/repairer" },
  { section: "passkey", label: "Passkey repair", href: "/passkey-spike" },
  { section: "admin", label: "Access control", href: "/admin" },
];

export default function AppShell({
  active,
  action,
  children,
}: {
  active: Section;
  action?: ReactNode;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleLinks = links.filter(
    (link) =>
      link.section !== "passkey" ||
      import.meta.env.DEV ||
      import.meta.env.VITE_PASSKEY_TESTING === "true",
  );

  const navigation = (mobile = false) => (
    <nav
      aria-label="Main navigation"
      className={mobile ? "rd-mobile-nav" : "rd-nav"}
    >
      {visibleLinks.map((link) => (
        <a
          key={link.section}
          href={link.href}
          aria-current={active === link.section ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
        >
          {link.label}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="rd-app">
      <aside className="rd-sidebar">
        <a href="/" className="rd-brand" aria-label="ReDevice home">
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="4"
              y="2.5"
              width="18"
              height="22"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M9 8.5h8M9 13h10M9 17.5h6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path
              d="M22 7.5h2.5v18H9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <span>ReDevice</span>
        </a>
        <p className="rd-sidebar-caption">Device passport ledger</p>
        {navigation()}
        <div className="rd-sidebar-footer">
          <span className="rd-network-dot" aria-hidden="true" />
          <span>Stellar Testnet</span>
          <small>Public records · signed actions</small>
        </div>
      </aside>
      <div className="rd-workspace">
        <header className="rd-topbar">
          <button
            type="button"
            className="rd-menu-button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <a href="/" className="rd-mobile-brand">
            ReDevice
          </a>
          <span className="rd-topbar-scope">
            Stellar Testnet <span aria-hidden="true">/</span> Device records
          </span>
          {action && <div className="rd-topbar-action">{action}</div>}
        </header>
        {menuOpen && <div className="rd-mobile-menu">{navigation(true)}</div>}
        <main className="rd-sheet">{children}</main>
      </div>
    </div>
  );
}
