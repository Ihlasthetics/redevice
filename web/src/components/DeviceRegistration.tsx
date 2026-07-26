import {
  useCurrentAccount,
  useCurrentClient,
  useDAppKit,
} from "@mysten/dapp-kit-react";
import { ConnectButton } from "@mysten/dapp-kit-react/ui";
import { Transaction } from "@mysten/sui/transactions";
import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Fingerprint,
  Info,
  LockKeyhole,
  PackagePlus,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  TESTNET_PACKAGE_ID,
  TESTNET_REGISTRAR_CAP_ID,
  TESTNET_REGISTRY_ID,
  objectExplorerUrl,
  transactionExplorerUrl,
} from "../constants";
import { useRegistrarAuthorization } from "../hooks/use-registrar-authorization";
import PassportQrDownload from "./PassportQrDownload";

type RegistrationStatus =
  "ready" | "awaiting-signature" | "confirming" | "confirmed" | "rejected";

type DeviceRegistrationProps = {
  onPassportCreated: (objectId: string) => void;
};

type RegisteredDevice = {
  deviceName: string;
  brand: string;
  model: string;
  maskedSerial: string;
  registeredAt: Date;
};

function formatAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    if (
      /E_DEVICE_ALREADY_REGISTERED/i.test(error.message) ||
      /MoveAbort[\s\S]*(?:,\s*7\)|abort[_ ]?code[=:]\s*7)/i.test(error.message)
    ) {
      return "This device is already registered.";
    }

    if (/rejected|denied|cancel/i.test(error.message)) {
      return "The wallet signature was cancelled. No device was registered.";
    }

    return error.message;
  }

  return "The transaction could not be completed. No device was registered.";
}

function RegistrationPassport({
  passportId,
  digest,
  device,
}: {
  passportId: string;
  digest: string;
  device: RegisteredDevice;
}) {
  return (
    <div
      className="mt-5 rounded-2xl border border-success/25 bg-success-soft/70 p-4"
      role="status"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-success"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-success">
            Device registered on Sui Testnet
          </p>
          <p className="mt-2 break-all font-mono text-xs">{passportId}</p>

          <PassportQrDownload
            className="mt-4 border-success/20"
            passportId={passportId}
            deviceName={device.deviceName}
            brand={device.brand}
            model={device.model}
            maskedSerial={device.maskedSerial}
            registeredAt={device.registeredAt}
          />

          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
            <a
              className="inline-flex items-center gap-1.5 text-brand hover:text-ink"
              href={objectExplorerUrl(passportId)}
              target="_blank"
              rel="noreferrer"
            >
              View passport
              <ExternalLink className="size-3.5" />
            </a>
            <a
              className="inline-flex items-center gap-1.5 text-brand hover:text-ink"
              href={transactionExplorerUrl(digest)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeSerial(serial: string) {
  return serial.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function maskSerial(serial: string) {
  if (serial.length <= 7) {
    return `${serial.slice(0, 2)}***${serial.slice(-2)}`;
  }

  return `${serial.slice(0, 3)}${"*".repeat(
    Math.min(Math.max(serial.length - 7, 4), 12),
  )}${serial.slice(-4)}`;
}

async function sha256AsSuiAddress(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return `0x${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

function DeviceRegistration({ onPassportCreated }: DeviceRegistrationProps) {
  const dAppKit = useDAppKit();
  const client = useCurrentClient();
  const currentAccount = useCurrentAccount();
  const walletAddress = currentAccount?.address ?? null;
  const authorizationQuery = useRegistrarAuthorization(walletAddress);
  const isIssuer = authorizationQuery.data === true;
  const [deviceName, setDeviceName] = useState("My MacBook");
  const [brand, setBrand] = useState("Apple");
  const [model, setModel] = useState("MacBook Air M3");
  const [serialNumber, setSerialNumber] = useState("");
  const [initialCondition, setInitialCondition] = useState("0");
  const [status, setStatus] = useState<RegistrationStatus>("ready");
  const [error, setError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [passportId, setPassportId] = useState<string | null>(null);
  const [registeredDevice, setRegisteredDevice] =
    useState<RegisteredDevice | null>(null);

  const isBusy = status === "awaiting-signature" || status === "confirming";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setDigest(null);
    setPassportId(null);
    setRegisteredDevice(null);

    if (!walletAddress || !isIssuer) {
      setStatus("rejected");
      setError(
        "Connect an authorized issuer wallet with an active RegistrarCap.",
      );
      return;
    }

    const safeDeviceName = deviceName.trim();
    const safeBrand = brand.trim();
    const safeModel = model.trim();
    const normalizedSerial = normalizeSerial(serialNumber);

    if (!safeDeviceName || !safeBrand || !safeModel) {
      setStatus("rejected");
      setError("Add a device name, brand, and model.");
      return;
    }

    if (normalizedSerial.length < 6 || normalizedSerial.length > 64) {
      setStatus("rejected");
      setError("Enter a valid serial number between 6 and 64 characters.");
      return;
    }

    try {
      const serialHash = await sha256AsSuiAddress(normalizedSerial);
      const safeMaskedSerial = maskSerial(normalizedSerial);
      const registeredAt = new Date();

      const createTransaction = () => {
        const transaction = new Transaction();
        transaction.moveCall({
          target: `${TESTNET_PACKAGE_ID}::redevice::create_passport`,
          arguments: [
            transaction.object(TESTNET_REGISTRAR_CAP_ID),
            transaction.object(TESTNET_REGISTRY_ID),
            transaction.pure.string(safeDeviceName),
            transaction.pure.string(safeBrand),
            transaction.pure.string(safeModel),
            transaction.pure.string(safeMaskedSerial),
            transaction.pure.address(serialHash),
            transaction.pure.u8(Number(initialCondition)),
            transaction.pure.u64(BigInt(registeredAt.getTime())),
          ],
        });
        return transaction;
      };

      const simulationTransaction = createTransaction();
      simulationTransaction.setSender(walletAddress);
      const simulation = await client.core.simulateTransaction({
        transaction: simulationTransaction,
      });

      if (simulation.FailedTransaction) {
        throw new Error(
          simulation.FailedTransaction.status.error?.message ??
            "Sui rejected the registration transaction.",
        );
      }

      setStatus("awaiting-signature");
      const transaction = createTransaction();
      const result = await dAppKit.signAndExecuteTransaction({ transaction });

      if (result.FailedTransaction) {
        throw new Error(
          result.FailedTransaction.status.error?.message ??
            "Sui rejected the registration transaction.",
        );
      }

      const transactionDigest = result.Transaction.digest;
      setDigest(transactionDigest);
      setStatus("confirming");

      const finalResult = await client.core.waitForTransaction({
        digest: transactionDigest,
        timeout: 60_000,
        include: { effects: true },
      });
      const createdPassportId =
        finalResult.Transaction?.effects?.changedObjects.find(
          (object) => object.idOperation === "Created",
        )?.objectId ?? null;

      if (!createdPassportId) {
        throw new Error(
          "Sui confirmed the transaction, but the new passport ID was not returned. Open the transaction in SuiVision.",
        );
      }

      setPassportId(createdPassportId);
      setRegisteredDevice({
        deviceName: safeDeviceName,
        brand: safeBrand,
        model: safeModel,
        maskedSerial: safeMaskedSerial,
        registeredAt,
      });
      setStatus("confirmed");
      onPassportCreated(createdPassportId);
    } catch (transactionError) {
      setStatus("rejected");
      setError(errorMessage(transactionError));
    }
  }

  return (
    <section
      id="device-registration"
      aria-labelledby="device-registration-title"
      className="mb-10 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_30px_80px_-58px_rgba(21,31,28,0.55)] sm:mb-14"
    >
      <div className="grid lg:grid-cols-[0.78fr_1.22fr]">
        <div className="bg-ink p-5 text-canvas sm:p-8 lg:p-9">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-success-soft">
              Authorized issuers
            </p>
            <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-canvas/70">
              Sui Testnet live
            </span>
          </div>
          <h2
            id="device-registration-title"
            className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
          >
            Register a device
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-canvas/70 sm:text-base sm:leading-7">
            Create a unique shared DevicePassport on Sui. The serial is hashed
            locally and the on-chain registry rejects a second passport for the
            same physical device.
          </p>

          <div className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-success-soft"
              />
              <div>
                <p className="text-sm font-semibold">
                  Capability-gated issuance
                </p>
                <p className="mt-1.5 text-xs leading-5 text-canvas/65">
                  The Move contract verifies both the RegistrarCap and the
                  unique serial hash before issuing a passport.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8 lg:p-9">
          {!walletAddress && (
            <div className="flex min-h-72 flex-col items-start justify-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-canvas text-brand">
                <WalletCards aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">
                Connect the issuer wallet
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                Public visitors can scan passports without a wallet.
                Registration is available only to the authorized issuer.
              </p>
              <div className="wallet-button mt-5 min-h-11">
                <ConnectButton>
                  <span className="inline-flex items-center gap-2">
                    <WalletCards aria-hidden="true" className="size-4" />
                    Connect issuer wallet
                  </span>
                </ConnectButton>
              </div>
            </div>
          )}

          {walletAddress && authorizationQuery.isPending && (
            <div
              className="flex min-h-72 flex-col items-start justify-center"
              role="status"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-canvas text-brand">
                <CircleDashed
                  aria-hidden="true"
                  className="size-5 animate-spin"
                />
              </span>
              <h3 className="mt-5 text-xl font-semibold">
                Checking registrar permission
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                Reading the connected wallet&apos;s RegistrarCap from Sui
                Testnet.
              </p>
            </div>
          )}

          {walletAddress && !authorizationQuery.isPending && !isIssuer && (
            <div
              className="flex min-h-72 flex-col items-start justify-center"
              role="status"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-800">
                <LockKeyhole aria-hidden="true" className="size-5" />
              </span>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                Connected wallet
              </p>
              <p className="mt-2 font-mono text-sm font-semibold">
                {formatAddress(walletAddress)}
              </p>
              <h3 className="mt-5 text-xl font-semibold">
                Issuer permission required
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                This wallet does not match an active ReDevice RegistrarCap. The
                registration form stays hidden and no transaction can be
                submitted.
              </p>
              <div className="wallet-button mt-5 min-h-11">
                <ConnectButton />
              </div>
            </div>
          )}

          {walletAddress && !authorizationQuery.isPending && isIssuer && (
            <form onSubmit={handleSubmit}>
              <div className="flex items-start gap-3 border-b border-line pb-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success-soft text-success">
                  <PackagePlus aria-hidden="true" className="size-5" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-success">
                    Issuer authorized
                  </p>
                  <p
                    className="mt-1 font-mono text-xs text-muted"
                    title={walletAddress}
                  >
                    {formatAddress(walletAddress)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Device name
                  <input
                    className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm font-medium text-ink"
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                    maxLength={80}
                    placeholder="My MacBook"
                    required
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Brand
                  <input
                    className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm font-medium text-ink"
                    value={brand}
                    onChange={(event) => setBrand(event.target.value)}
                    maxLength={80}
                    placeholder="Apple"
                    required
                  />
                </label>

                <label className="block text-sm font-semibold sm:col-span-2">
                  Device model
                  <input
                    className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm font-medium text-ink"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    maxLength={80}
                    required
                  />
                </label>

                <label className="block text-sm font-semibold">
                  Serial number
                  <span className="relative mt-2 block">
                    <Fingerprint
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                    />
                    <input
                      className="min-h-12 w-full rounded-xl border border-line bg-canvas py-2 pl-10 pr-3.5 font-mono text-sm font-medium text-ink"
                      value={serialNumber}
                      onChange={(event) => setSerialNumber(event.target.value)}
                      maxLength={64}
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Enter the full serial"
                      required
                    />
                  </span>
                  <span className="mt-1.5 block text-xs font-normal leading-5 text-muted">
                    Hashed in your browser. Only a masked serial and its SHA-256
                    hash are published.
                  </span>
                </label>

                <label className="block text-sm font-semibold">
                  Initial condition
                  <select
                    className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm font-medium text-ink"
                    value={initialCondition}
                    onChange={(event) =>
                      setInitialCondition(event.target.value)
                    }
                  >
                    <option value="0">Inspected</option>
                    <option value="1">Refurbished</option>
                    <option value="2">In service</option>
                    <option value="3">Retired</option>
                  </select>
                </label>
              </div>

              <div className="mt-6 flex items-start gap-3 rounded-xl bg-amber-50 p-3.5 text-amber-950">
                <Info
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-amber-800"
                />
                <p className="text-xs leading-5">
                  Device name, brand, model, masked serial, hash, condition,
                  issuer address, and registration time become public on Sui
                  Testnet. The full serial never leaves this browser.
                </p>
              </div>

              {status === "confirmed" &&
                digest &&
                passportId &&
                registeredDevice && (
                  <RegistrationPassport
                    passportId={passportId}
                    digest={digest}
                    device={registeredDevice}
                  />
                )}

              {status === "rejected" && error && (
                <div
                  className="mt-5 rounded-2xl border border-red-700/20 bg-red-50 p-4 text-sm text-red-950"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-canvas transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                type="submit"
                disabled={isBusy}
              >
                {status === "confirmed" ? (
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                ) : (
                  <CircleDashed
                    aria-hidden="true"
                    className={`size-4 ${isBusy ? "animate-spin" : ""}`}
                  />
                )}
                {status === "awaiting-signature"
                  ? "Approve in wallet"
                  : status === "confirming"
                    ? "Confirming on Sui"
                    : status === "confirmed"
                      ? "Register another device"
                      : "Sign and register device"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export default DeviceRegistration;
