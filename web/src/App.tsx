import { useEffect, useRef, useState, type FormEvent } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { createPassportPdf } from "./lib/passport-pdf";
import {
  attestRepair,
  CONTRACT_ID,
  deviceExplorerUrl,
  FIVE_DIGIT_IDS,
  getAdministrator,
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

const conditions: Status[] = ["Used", "Repaired", "Refurbished", "PartsOnly"];
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
  function stop() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    frame.current = null;
  }
  useEffect(() => stop, []);
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
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-xl font-semibold">Scan passport QR</h2>
      <video
        ref={video}
        muted
        playsInline
        className="mt-3 max-h-64 w-full rounded-xl bg-ink"
      />
      <div className="mt-3 flex gap-2">
        <button
          className="rounded-xl bg-ink px-4 py-2 text-white"
          onClick={() => void start()}
        >
          Open camera
        </button>
        <button
          className="rounded-xl border border-line px-4 py-2"
          onClick={stop}
        >
          Stop
        </button>
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
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="font-semibold">Public passport QR</h3>
      {qr && (
        <img
          className="mt-3 w-44 rounded-lg"
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
  const [administrator, setAdministrator] = useState("");
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
  const [maskedSerial, setMaskedSerial] = useState("");
  const [initialStatus, setInitialStatus] = useState<"Used" | "Refurbished">(
    "Used",
  );
  const [repairType, setRepairType] = useState("");
  const [notes, setNotes] = useState("");
  const [nextStatus, setNextStatus] = useState<Status>("Repaired");
  const [battery, setBattery] = useState("");
  const [serviceDate, setServiceDate] = useState("");

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
    let active = true;
    void getAdministrator()
      .then((admin) => {
        if (active) setAdministrator(admin);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
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
      if (!brand.trim() || !model.trim() || maskedSerial.trim().length < 4)
        throw new Error(
          "Brand, model, and a masked serial of at least 4 characters are required.",
        );
      const result = await registerDevice(wallet, {
        manufacturer,
        product,
        serial,
        brand,
        model,
        maskedSerial,
        status: initialStatus,
      });
      const newId = result.result.toString();
      setNotice(
        `Registration confirmed: device ${newId}. Transaction ${result.hash}`,
      );
      await load(newId);
    } catch (cause) {
      setNotice("");
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function submitRepair(event: FormEvent) {
    event.preventDefault();
    if (!wallet || !repairer || view === "register" || !id || busy) return;
    setBusy(true);
    setError("");
    setNotice("Simulating repair; approve in Freighter when prompted.");
    try {
      if (!repairType.trim() || !notes.trim())
        throw new Error("Repair type and public notes are required.");
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
        status: nextStatus,
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

  const showRepair = repairer && view !== "register";
  const transactionHash = `${notice} ${error}`.match(/[0-9a-f]{64}/i)?.[0];
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-5">
          <a href="/" className="text-2xl font-bold">
            ReDevice
          </a>
          <span className="text-xs font-semibold uppercase tracking-widest text-brand">
            Stellar Testnet
          </span>
          <nav className="flex items-center gap-3 text-sm font-semibold">
            <a
              href="/register"
              className={
                view === "register" ? "text-brand" : "text-muted hover:text-ink"
              }
            >
              Register
            </a>
            {repairer && (
              <a
                href="/repairer"
                className={
                  view === "repairer"
                    ? "text-brand"
                    : "text-muted hover:text-ink"
                }
              >
                Repairer
              </a>
            )}
          </nav>
          {wallet && wallet === administrator && (
            <a
              href="/admin"
              className="text-sm font-semibold text-brand underline"
            >
              Admin
            </a>
          )}
          <button
            className="rounded-xl bg-ink px-4 py-2 text-white"
            disabled={!configured || busy}
            onClick={() => void connect()}
          >
            {wallet
              ? `${wallet.slice(0, 6)}…${wallet.slice(-4)} · refresh wallet`
              : "Connect Freighter"}
          </button>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-6 p-5 py-8">
        <div>
          <h1 className="text-4xl font-semibold">
            Verifiable device passports
          </h1>
          <p className="mt-2 text-muted">
            Public records on Stellar Testnet. Registration needs a connected
            wallet; repairs require an authorized repairer.
          </p>
        </div>
        {view === "repairer" && !showRepair && (
          <p
            role="status"
            className="rounded-xl border border-line bg-surface p-4 text-sm"
          >
            {wallet && !roleChecked
              ? "Checking Repairer authorization…"
              : "Repairer access is required for attestations. You can still find passports and register devices here."}
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
        <section className="grid gap-5 md:grid-cols-2">
          <form
            className="rounded-2xl border border-line bg-surface p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void load(lookup);
            }}
          >
            <h2 className="text-xl font-semibold">Find a passport</h2>
            <p className="mt-1 text-sm text-muted">
              Anyone can read by device ID. No wallet needed.
            </p>
            <input
              className="mt-4 w-full rounded-xl border border-line p-3"
              inputMode="numeric"
              placeholder={
                FIVE_DIGIT_IDS ? "Five digit device ID" : "Device ID, e.g. 1"
              }
              maxLength={FIVE_DIGIT_IDS ? 5 : 20}
              value={lookup}
              onChange={(event) => setLookup(event.target.value)}
            />
            <button
              disabled={!configured || busy}
              className="mt-3 rounded-xl bg-ink px-4 py-2 text-white disabled:opacity-50"
            >
              Read from Testnet
            </button>
          </form>
          <Scanner onScan={(nextId) => void load(nextId)} />
        </section>
        {device && id && (
          <section className="grid gap-5 lg:grid-cols-[1fr_17rem]">
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-success">
                Live Stellar Testnet · device {id}
              </p>
              <h2 className="mt-2 text-3xl font-semibold">
                {device.brand} {device.model}
              </h2>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
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
              <h3 className="mt-7 text-xl font-semibold">
                Repair history ({device.repair_count})
              </h3>
              {repairs.length === 0 && (
                <p className="mt-2 text-sm text-muted">
                  No attested repairs yet.
                </p>
              )}
              <ol className="mt-3 grid gap-3">
                {[...repairs].reverse().map((record) => (
                  <li
                    key={record.index}
                    className="rounded-xl border border-line p-4"
                  >
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
        <section
          className={`grid gap-5 ${showRepair ? "lg:grid-cols-2" : "max-w-xl"}`}
        >
          <form
            onSubmit={(event) => void submitRegistration(event)}
            className="grid content-start gap-3 rounded-2xl border border-line bg-surface p-5"
          >
            <h2 className="text-xl font-semibold">Register a device</h2>
            <p className="text-sm text-muted">
              Connect a Testnet wallet to register. The full serial stays in
              this browser; only its hash is sent on-chain. Registration is a
              wallet-signed claim, not independent proof of ownership.
            </p>
            {!wallet && (
              <p className="text-sm text-amber-800">
                Connect Freighter to register a device.
              </p>
            )}
            <input
              required
              maxLength={64}
              className="rounded-xl border border-line p-3"
              placeholder="Manufacturer namespace, e.g. apple"
              value={manufacturer}
              onChange={(event) => setManufacturer(event.target.value)}
            />
            <input
              required
              maxLength={64}
              className="rounded-xl border border-line p-3"
              placeholder="Product namespace, e.g. macbook-air-m3"
              value={product}
              onChange={(event) => setProduct(event.target.value)}
            />
            <input
              required
              maxLength={128}
              className="rounded-xl border border-line p-3"
              placeholder="Full serial (never published)"
              value={serial}
              onChange={(event) => setSerial(event.target.value)}
            />
            <input
              required
              maxLength={32}
              className="rounded-xl border border-line p-3"
              placeholder="Masked serial, e.g. ABC***123"
              value={maskedSerial}
              onChange={(event) => setMaskedSerial(event.target.value)}
            />
            <input
              required
              maxLength={64}
              className="rounded-xl border border-line p-3"
              placeholder="Brand"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
            />
            <input
              required
              maxLength={64}
              className="rounded-xl border border-line p-3"
              placeholder="Model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            />
            <select
              className="rounded-xl border border-line p-3"
              value={initialStatus}
              onChange={(event) =>
                setInitialStatus(event.target.value as "Used" | "Refurbished")
              }
            >
              <option>Used</option>
              <option>Refurbished</option>
            </select>
            <button
              disabled={!configured || !wallet || busy}
              className="rounded-xl bg-ink px-4 py-3 text-white disabled:opacity-50"
            >
              Register on Stellar
            </button>
          </form>
          {showRepair && (
            <form
              onSubmit={(event) => void submitRepair(event)}
              className="grid content-start gap-3 rounded-2xl border border-line bg-surface p-5"
            >
              <h2 className="text-xl font-semibold">Attest a repair</h2>
              <p className="text-sm text-muted">
                Repairer role and a loaded live device required. Notes are
                public on-chain.
              </p>
              {wallet && !repairer && (
                <p className="text-sm text-amber-800">
                  This account has no Repairer role.
                </p>
              )}
              <input
                required
                maxLength={64}
                className="rounded-xl border border-line p-3"
                placeholder="Repair type"
                value={repairType}
                onChange={(event) => setRepairType(event.target.value)}
              />
              <textarea
                required
                maxLength={500}
                className="min-h-28 rounded-xl border border-line p-3"
                placeholder="Public service notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
              <select
                className="rounded-xl border border-line p-3"
                value={nextStatus}
                onChange={(event) =>
                  setNextStatus(event.target.value as Status)
                }
              >
                {conditions.map((condition) => (
                  <option key={condition} value={condition}>
                    {label(condition)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                max="100"
                className="rounded-xl border border-line p-3"
                placeholder="Battery health % (optional)"
                value={battery}
                onChange={(event) => setBattery(event.target.value)}
              />
              <label className="text-xs text-muted">
                Claimed service time (optional)
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-xl border border-line p-3"
                  value={serviceDate}
                  onChange={(event) => setServiceDate(event.target.value)}
                />
              </label>
              <button
                disabled={!configured || !repairer || !device || busy}
                className="rounded-xl bg-ink px-4 py-3 text-white disabled:opacity-50"
              >
                Attest on Stellar
              </button>
            </form>
          )}
        </section>
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
      </main>
    </div>
  );
}

export default App;
