import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { ScanLine } from "lucide-react";
import AppShell from "./components/AppShell";
import { createPassportPdf } from "./lib/passport-pdf";
import {
  attestRepair,
  CONTRACT_ID,
  deviceExplorerUrl,
  FIVE_DIGIT_IDS,
  getDevice,
  getRepairs,
  hasRole,
  parsePassportPath,
  passportPath,
  publicPassportUrl,
  registerDevice,
  requireContractId,
  transactionExplorerUrl,
  type Device,
  type Repair,
  type Status,
} from "./stellar/client";
import { useWallet } from "./stellar/useWallet";
import { allowedRepairStatuses } from "./stellar/repair-transitions";

const label = (status: Status) =>
  status === "PartsOnly" ? "Parts only" : status;
const message = (error: unknown) =>
  error instanceof Error ? error.message : "The operation failed.";
const date = (seconds: bigint) =>
  new Date(Number(seconds) * 1000).toLocaleString("en-GB");

function Scanner({ onScan }: { onScan: (id: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  function stop(updateState = true) {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    frame.current = null;
    if (updateState) setActive(false);
  }
  useEffect(() => () => stop(false), []);
  async function start() {
    setError("");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (!video.current) {
        stop();
        return;
      }
      video.current.srcObject = stream.current;
      setActive(true);
      await video.current.play();
      const canvas = document.createElement("canvas");
      const scan = () => {
        if (!video.current || !stream.current) return;
        if (video.current.videoWidth && video.current.videoHeight) {
          canvas.width = video.current.videoWidth;
          canvas.height = video.current.videoHeight;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (context) {
            context.drawImage(video.current, 0, 0);
            const pixels = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            const code = jsQR(pixels.data, pixels.width, pixels.height);
            if (code) {
              try {
                const url = new URL(code.data);
                const origin = new URL(
                  publicPassportUrl(
                    FIVE_DIGIT_IDS ? "10000" : "1",
                    import.meta.env.VITE_PUBLIC_APP_ORIGIN,
                  ),
                ).origin;
                const route = parsePassportPath(url.pathname);
                if (
                  url.origin !== origin ||
                  !route ||
                  route.contractId !== requireContractId()
                )
                  throw new Error("QR is not for this Stellar passport app.");
                stop();
                onScan(route.id);
                return;
              } catch (cause) {
                setError(message(cause));
                stop();
                return;
              }
            }
          }
        }
        frame.current = requestAnimationFrame(scan);
      };
      frame.current = requestAnimationFrame(scan);
    } catch (cause) {
      setError(message(cause));
      stop();
    }
  }
  return (
    <section className="rd-panel self-start p-5">
      <h2 className="rd-panel-heading">Scan passport QR</h2>
      <p className="mt-1 text-sm text-muted">
        Use a camera to open a printed or shared passport.
      </p>
      <div className="rd-scanner-view mt-4">
        {!active && (
          <div className="rd-scanner-standby">
            <ScanLine size={28} strokeWidth={1.4} aria-hidden="true" />
            <span>Camera preview starts here</span>
          </div>
        )}
        <video
          ref={video}
          muted
          playsInline
          className={active ? "max-h-64 w-full rounded-lg" : "sr-only"}
        />
      </div>
      <div className="mt-3 flex gap-2">
        {!active ? (
          <button
            className="rounded-lg border border-line px-4 py-2 font-semibold"
            onClick={() => void start()}
          >
            Open camera
          </button>
        ) : (
          <button
            className="rounded-lg border border-line px-4 py-2 font-semibold"
            onClick={() => stop()}
          >
            Stop camera
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          {error}
        </p>
      )}
    </section>
  );
}

function PassportQr({ id, device }: { id: string; device: Device }) {
  const [qr, setQr] = useState("");
  const url = publicPassportUrl(id, import.meta.env.VITE_PUBLIC_APP_ORIGIN);
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, { width: 512, margin: 2 }).then((value) => {
      if (active) setQr(value);
    });
    return () => {
      active = false;
    };
  }, [url]);
  async function download() {
    if (!qr) return;
    const pdf = await createPassportPdf({
      qrDataUrl: qr,
      qrTarget: url,
      passportId: `${CONTRACT_ID}/${id}`,
      deviceName: `${device.brand} ${device.model}`,
      brand: device.brand,
      model: device.model,
      maskedSerial: device.masked_serial,
      registeredDate: date(device.registered_at),
      explorerUrl: deviceExplorerUrl(id),
    });
    pdf.save(`ReDevice-${id}.pdf`);
  }
  return (
    <div className="rd-panel self-start p-5">
      <h3 className="rd-panel-heading">Share this passport</h3>
      <p className="mt-1 text-sm text-muted">
        Anyone with the link can read this public record.
      </p>
      {qr && (
        <img
          className="mt-4 w-44 rounded-lg border border-line p-2"
          src={qr}
          alt={`QR for device ${id}`}
        />
      )}
      <p className="mt-2 break-all text-xs text-muted">{url}</p>
      {new URL(url).hostname.match(/^(localhost|127\.0\.0\.1)$/) && (
        <p className="mt-2 text-xs text-amber-800">
          For phone scanning, set VITE_PUBLIC_APP_ORIGIN to a reachable HTTPS
          address.
        </p>
      )}
      <button
        className="mt-3 rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-50"
        disabled={!qr}
        onClick={() => void download()}
      >
        Download PDF
      </button>
    </div>
  );
}

type View = "auto" | "register" | "repairer";

function App({ view = "auto" }: { view?: View }) {
  const { wallet, connect: connectFreighter } = useWallet();
  const [repairer, setRepairer] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);
  const [lookup, setLookup] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState(true);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [product, setProduct] = useState("");
  const [initialStatus, setInitialStatus] = useState<"Used" | "Refurbished">(
    "Used",
  );
  const [repairType, setRepairType] = useState("");
  const [notes, setNotes] = useState("");
  const [nextStatus, setNextStatus] = useState<Status>("Repaired");
  const [battery, setBattery] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const availableStatuses = device
    ? allowedRepairStatuses(device.status.tag)
    : [];
  const selectedStatus = availableStatuses.includes(nextStatus)
    ? nextStatus
    : undefined;

  async function load(nextId: string) {
    setBusy(true);
    setError("");
    setId(null);
    setDevice(null);
    setRepairs([]);
    try {
      const found = await getDevice(nextId);
      if (!found)
        throw new Error(`Device ${nextId} was not found on Stellar Testnet.`);
      const history = await getRepairs(nextId, found.repair_count);
      setId(nextId);
      setDevice(found);
      setRepairs(history);
      if (view === "auto")
        window.history.replaceState({}, "", passportPath(nextId));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    try {
      requireContractId();
    } catch {
      setConfigured(false);
      return;
    }
    try {
      if (["/", "/register", "/repairer"].includes(window.location.pathname))
        return;
      const route = parsePassportPath(window.location.pathname);
      if (!route || route.contractId !== CONTRACT_ID)
        throw new Error("Invalid Stellar passport link for this contract.");
      void load(route.id);
    } catch (cause) {
      setError(message(cause));
    }
    // Only the initial route is loaded here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!wallet) {
      setRepairer(false);
      setRoleChecked(false);
      return;
    }
    let active = true;
    let pending = false;
    setRepairer(false);
    setRoleChecked(false);
    async function refreshRole() {
      if (pending) return;
      pending = true;
      try {
        const role = await hasRole("Repairer", wallet!);
        if (active) {
          setRepairer(role);
          setRoleChecked(true);
        }
      } catch (cause) {
        if (active) {
          setRepairer(false);
          setRoleChecked(true);
          setError(
            `Repair authorization could not be checked: ${message(cause)}`,
          );
        }
      } finally {
        pending = false;
      }
    }
    void refreshRole();
    const interval = window.setInterval(() => void refreshRole(), 15000);
    window.addEventListener("focus", refreshRole);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshRole);
    };
  }, [wallet]);

  async function connect() {
    setError("");
    try {
      await connectFreighter();
    } catch (cause) {
      setError(message(cause));
    }
  }

  async function submitRegistration(event: FormEvent) {
    event.preventDefault();
    if (!wallet || busy) return;
    setBusy(true);
    setError("");
    setNotice("Simulating registration; approve in Freighter when prompted.");
    try {
      if (!brand.trim() || !model.trim())
        throw new Error("Brand and model are required.");
      const result = await registerDevice(wallet, {
        manufacturer,
        product,
        serial,
        brand,
        model,
        status: initialStatus,
      });
      const newId = result.result.toString();
      setNotice(
        `Registration confirmed: device ${newId}. Transaction ${result.hash}`,
      );
      window.location.assign(passportPath(newId));
    } catch (cause) {
      setNotice("");
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitRepair(event: FormEvent) {
    event.preventDefault();
    if (!wallet || !repairer || view === "register" || !id || !device || busy)
      return;
    setBusy(true);
    setError("");
    setNotice("Simulating repair; approve in Freighter when prompted.");
    try {
      if (!repairType.trim() || !notes.trim())
        throw new Error("Repair type and public notes are required.");
      if (!selectedStatus)
        throw new Error("This device cannot move to another condition.");
      const latestDevice = await getDevice(id);
      if (!latestDevice || latestDevice.status.tag !== device.status.tag) {
        if (latestDevice) setDevice(latestDevice);
        throw new Error(
          "Device condition changed. Review the new condition before attesting.",
        );
      }
      const health = battery === "" ? undefined : Number(battery);
      if (
        health !== undefined &&
        (!Number.isInteger(health) || health < 0 || health > 100)
      )
        throw new Error("Battery health must be 0–100.");
      const claimedTime = serviceDate
        ? BigInt(Math.floor(new Date(serviceDate).getTime() / 1000))
        : undefined;
      const result = await attestRepair(wallet, {
        deviceId: id,
        repairType,
        notes,
        status: selectedStatus,
        batteryHealth: health,
        claimedTime,
      });
      setNotice(
        `Repair ${result.result} confirmed. Transaction ${result.hash}`,
      );
      await load(id);
    } catch (cause) {
      setNotice("");
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  const showRepair = repairer && view === "repairer";
  const showLookup = view === "auto" || showRepair;
  const showRegistration = view === "register";
  const transactionHash = `${notice} ${error}`.match(/[0-9a-f]{64}/i)?.[0];
  return (
    <AppShell
      active={
        view === "register"
          ? "register"
          : view === "repairer"
            ? "repairer"
            : "passports"
      }
      action={
        <button
          className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={!configured || busy}
          onClick={() => void connect()}
        >
          {wallet
            ? `${wallet.slice(0, 6)}…${wallet.slice(-4)} · refresh wallet`
            : "Connect Freighter"}
        </button>
      }
    >
      <div className="rd-content">
        <div>
          <h1 className="rd-page-title">
            {device && showLookup
              ? "Device passport"
              : view === "register"
                ? "New device record"
                : view === "repairer"
                  ? "Repair workspace"
                  : "Device passports"}
          </h1>
          <p className="rd-page-summary">
            {device && showLookup
              ? `Record ${id} · service history and registration details from Stellar Testnet.`
              : view === "register"
                ? "Create a signed record for a device, then share its public passport."
                : view === "repairer"
                  ? "Choose a passkey or an authorized Freighter wallet to record a repair."
                  : "Look up a device and read its repair history without connecting a wallet."}
          </p>
        </div>
        {view === "repairer" &&
          import.meta.env.VITE_PASSKEY_TESTING === "true" && (
            <section className="rd-repair-entry">
              <div>
                <h2 className="rd-panel-heading">Repair with a passkey</h2>
                <p className="mt-1 text-sm text-muted">
                  Approve an attestation on this device. The test sponsor pays
                  the network fee.
                </p>
              </div>
              <a
                href="/passkey-spike"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-ink px-5 py-2 text-sm font-semibold text-white"
              >
                Continue with passkey
              </a>
            </section>
          )}
        {view === "repairer" && !showRepair && (
          <p
            role="status"
            className="rounded-xl border border-line bg-surface p-4 text-sm"
          >
            {wallet && !roleChecked
              ? "Checking Repairer authorization…"
              : "Repairer access is required for attestations. Use a passkey above or connect an authorized Freighter wallet."}
          </p>
        )}
        {!configured && (
          <div
            role="alert"
            className="rounded-xl border border-amber-700/30 bg-amber-50 p-4"
          >
            Set VITE_STELLAR_CONTRACT_ID to the deployed Testnet C-address for
            live testing. No live records are shown until then.
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-amber-700/30 bg-amber-50 p-4 text-amber-900"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="rounded-xl border border-line bg-surface p-4 break-all"
          >
            {notice}
          </p>
        )}
        {showLookup && (
          <section className="order-3 grid items-start gap-5 lg:grid-cols-2">
            <form
              className="rd-panel p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void load(lookup);
              }}
            >
              <h2 className="rd-panel-heading">Find a passport</h2>
              <p className="mt-1 text-sm text-muted">
                Anyone can read by device ID. No wallet needed.
              </p>
              <label className="rd-field mt-4">
                Device ID
                <input
                  className="w-full border p-3"
                  inputMode="numeric"
                  placeholder={FIVE_DIGIT_IDS ? "Five digit ID" : "ID, e.g. 1"}
                  maxLength={FIVE_DIGIT_IDS ? 5 : 20}
                  value={lookup}
                  onChange={(event) => setLookup(event.target.value)}
                />
              </label>
              <button
                disabled={!configured || busy}
                className="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Read from Testnet
              </button>
            </form>
            <Scanner onScan={(nextId) => void load(nextId)} />
          </section>
        )}
        {showLookup && device && id && (
          <section className="order-2 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
            <div className="rd-panel rd-passport-record p-6">
              <p className="text-sm font-semibold text-brand">
                Live Stellar Testnet · device {id}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {device.brand} {device.model}
              </h2>
              <dl className="rd-passport-facts mt-6 grid gap-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">Condition</dt>
                  <dd className="font-semibold">{label(device.status.tag)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Masked serial</dt>
                  <dd className="font-mono">{device.masked_serial}</dd>
                </div>
                <div>
                  <dt className="text-muted">Registered</dt>
                  <dd>{date(device.registered_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Registered by</dt>
                  <dd className="break-all font-mono text-xs">
                    {device.registrar}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Namespace</dt>
                  <dd>
                    {device.manufacturer_namespace}/{device.product_namespace}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">
                    Commitment v{device.commitment_version}
                  </dt>
                  <dd className="break-all font-mono text-xs">
                    {Array.from(device.serial_commitment, (byte) =>
                      byte.toString(16).padStart(2, "0"),
                    ).join("")}
                  </dd>
                </div>
              </dl>
              <a
                className="mt-4 inline-block text-sm font-semibold text-brand underline"
                href={deviceExplorerUrl(id)}
                target="_blank"
                rel="noreferrer"
              >
                Open contract in Stellar Expert
              </a>
              <h3 className="mt-8 border-t border-line pt-6 text-lg font-semibold">
                Repair history ({device.repair_count})
              </h3>
              {repairs.length === 0 && (
                <p className="mt-2 text-sm text-muted">
                  No attested repairs yet.
                </p>
              )}
              <ol className="rd-repair-history mt-4 grid gap-4">
                {[...repairs].reverse().map((record) => (
                  <li key={record.index} className="pl-5">
                    <p className="font-semibold">
                      {record.repair_type} · {label(record.previous_status.tag)}{" "}
                      → {label(record.next_status.tag)}
                    </p>
                    <p className="mt-1 text-sm">{record.notes}</p>
                    <p className="mt-2 text-xs text-muted">
                      Attested {date(record.attested_at)} by {record.repairer}
                      {record.claimed_service_time != null
                        ? ` · Claimed service ${date(record.claimed_service_time)}`
                        : ""}
                      {record.battery_health != null
                        ? ` · Battery ${record.battery_health}%`
                        : ""}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-xs text-muted">
                These are on-chain attestations by authorized accounts. They do
                not independently prove physical work.
              </p>
            </div>
            <PassportQr id={id} device={device} />
          </section>
        )}
        {(showRegistration || showRepair) && (
          <section
            className={`order-4 grid items-start gap-5 ${showRegistration ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.6fr)]" : "lg:grid-cols-2"}`}
          >
            {showRegistration && (
              <form
                onSubmit={(event) => void submitRegistration(event)}
                className="rd-panel grid content-start gap-4 p-6 sm:grid-cols-2"
              >
                <h2 className="rd-panel-heading sm:col-span-2">
                  Register a device
                </h2>
                <p className="text-sm text-muted sm:col-span-2">
                  Connect a Testnet wallet to register. The full serial stays in
                  this browser; its hash and an automatically masked serial are
                  sent on-chain. Registration is a wallet-signed claim, not
                  independent proof of ownership.
                </p>
                {!wallet && (
                  <p className="text-sm text-amber-800 sm:col-span-2">
                    Connect Freighter to register a device.
                  </p>
                )}
                <label className="rd-field">
                  Manufacturer namespace
                  <input
                    required
                    maxLength={64}
                    className="border p-3"
                    placeholder="e.g. apple"
                    value={manufacturer}
                    onChange={(event) => setManufacturer(event.target.value)}
                  />
                </label>
                <label className="rd-field">
                  Product namespace
                  <input
                    required
                    maxLength={64}
                    className="border p-3"
                    placeholder="e.g. macbook-air-m3"
                    value={product}
                    onChange={(event) => setProduct(event.target.value)}
                  />
                </label>
                <label className="rd-field sm:col-span-2">
                  Full serial{" "}
                  <span className="font-normal text-muted">
                    (never published)
                  </span>
                  <input
                    required
                    maxLength={128}
                    className="border p-3"
                    placeholder="Enter the serial on the device"
                    value={serial}
                    onChange={(event) => setSerial(event.target.value)}
                  />
                </label>
                <label className="rd-field">
                  Brand
                  <input
                    required
                    maxLength={64}
                    className="border p-3"
                    placeholder="e.g. Apple"
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                  />
                </label>
                <label className="rd-field">
                  Model
                  <input
                    required
                    maxLength={64}
                    className="border p-3"
                    placeholder="e.g. MacBook Air M3"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                  />
                </label>
                <label className="rd-field sm:col-span-2">
                  Initial condition
                  <select
                    className="border p-3"
                    value={initialStatus}
                    onChange={(event) =>
                      setInitialStatus(
                        event.target.value as "Used" | "Refurbished",
                      )
                    }
                  >
                    <option>Used</option>
                    <option>Refurbished</option>
                  </select>
                </label>
                <button
                  disabled={!configured || !wallet || busy}
                  className="w-fit rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
                >
                  Register on Stellar
                </button>
              </form>
            )}
            {showRegistration && (
              <aside className="rd-panel self-start p-6">
                <h2 className="rd-panel-heading">On the public record</h2>
                <p className="mt-2 text-sm text-muted">
                  A registration creates a permanent Testnet passport with:
                </p>
                <ul className="rd-fact-list mt-5 text-sm">
                  <li>A random five digit device ID</li>
                  <li>Brand, model and initial condition</li>
                  <li>A masked serial and serial commitment</li>
                  <li>The registering account and ledger time</li>
                </ul>
                <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
                  The full serial stays in this browser. Repair notes added
                  later are public.
                </p>
              </aside>
            )}
            {showRepair && (
              <form
                onSubmit={(event) => void submitRepair(event)}
                className="rd-panel grid content-start gap-4 p-6"
              >
                <h2 className="rd-panel-heading">Attest a repair</h2>
                <p className="text-sm text-muted">
                  Load a device passport, then add a signed service record.
                  Notes are public on-chain.
                </p>
                {wallet && !repairer && (
                  <p className="text-sm text-amber-800">
                    This account has no Repairer role.
                  </p>
                )}
                <label className="rd-field">
                  Repair type
                  <input
                    required
                    maxLength={64}
                    className="border p-3"
                    placeholder="e.g. Screen replacement"
                    value={repairType}
                    onChange={(event) => setRepairType(event.target.value)}
                  />
                </label>
                <label className="rd-field">
                  Public service notes
                  <textarea
                    required
                    maxLength={500}
                    className="min-h-28 border p-3"
                    placeholder="Describe the work performed"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />
                </label>
                <label className="rd-field">
                  New condition
                  <select
                    className="border p-3"
                    value={selectedStatus ?? ""}
                    onChange={(event) =>
                      setNextStatus(event.target.value as Status)
                    }
                  >
                    {!selectedStatus && (
                      <option value="" disabled>
                        Choose next condition
                      </option>
                    )}
                    {availableStatuses.map((condition) => (
                      <option key={condition} value={condition}>
                        {label(condition)}
                      </option>
                    ))}
                  </select>
                </label>
                {device && availableStatuses.length === 0 && (
                  <p className="text-sm text-amber-800">
                    Parts only is the final condition. No further repair
                    attestation is allowed.
                  </p>
                )}
                <label className="rd-field">
                  Battery health %{" "}
                  <span className="font-normal text-muted">(optional)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="border p-3"
                    placeholder="0–100"
                    value={battery}
                    onChange={(event) => setBattery(event.target.value)}
                  />
                </label>
                <label className="rd-field">
                  Claimed service time (optional)
                  <input
                    type="datetime-local"
                    className="border p-3"
                    value={serviceDate}
                    onChange={(event) => setServiceDate(event.target.value)}
                  />
                </label>
                <button
                  disabled={!configured || !repairer || !selectedStatus || busy}
                  className="w-fit rounded-lg bg-ink px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Attest on Stellar
                </button>
              </form>
            )}
          </section>
        )}
        {transactionHash && (
          <a
            className="text-sm text-brand underline"
            target="_blank"
            rel="noreferrer"
            href={transactionExplorerUrl(transactionHash)}
          >
            Open confirmed transaction
          </a>
        )}
      </div>
    </AppShell>
  );
}

export default App;
