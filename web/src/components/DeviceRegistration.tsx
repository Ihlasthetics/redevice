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
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import {
  TESTNET_PACKAGE_ID,
  TESTNET_REGISTRAR_CAP_ID,
  TESTNET_REGISTRY_ID,
  objectExplorerUrl,
  transactionExplorerUrl,
} from "../constants";
import { useRegistrarAuthorization } from "../hooks/use-registrar-authorization";
import { findCreatedPassportId } from "../data/sui-passport";
import {
  createSubmissionGuard,
  isWalletCancellation,
} from "../lib/transaction-flow";
import PassportQrDownload from "./PassportQrDownload";

type RegistrationStatus =
  | "ready"
  | "preparing"
  | "awaiting-signature"
  | "confirming"
  | "confirmed"
  | "confirmed-readback-failed"
  | "cancelled"
  | "failed"
  | "unknown";

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

type RegistrationProof = {
  status: "confirmed" | "confirmed-readback-failed";
  digest: string;
  passportId: string | null;
  device: RegisteredDevice;
  error: string | null;
};

function formatAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function errorMessage(error: unknown, walletRequestStarted: boolean) {
  if (error instanceof Error) {
    if (
      /E_DEVICE_ALREADY_REGISTERED/i.test(error.message) ||
      /MoveAbort[\s\S]*(?:,\s*7\)|abort[_ ]?code[=:]\s*7)/i.test(error.message)
    ) {
      return "This device is already registered.";
    }

    if (isWalletCancellation(error)) {
      return "The wallet signature was cancelled. No device was registered.";
    }

    return walletRequestStarted
      ? "The wallet or network did not return a definitive result. Check wallet activity before submitting again."
      : error.message;
  }

  return walletRequestStarted
    ? "The transaction status is unknown. Check wallet activity before submitting again."
    : "The registration request could not be prepared.";
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
  const [localError, setLocalError] = useState<string | null>(null);
  const [digest, setDigest] = useState<string | null>(null);
  const [passportId, setPassportId] = useState<string | null>(null);
  const [registeredDevice, setRegisteredDevice] =
    useState<RegisteredDevice | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [activeSubmission, setActiveSubmission] = useState(false);
  const submissionGuard = useRef(createSubmissionGuard());
  const lookupGuard = useRef(createSubmissionGuard());
  const operationVersion = useRef(0);
  const proofByWallet = useRef(new Map<string, RegistrationProof>());
  const scopeKey = walletAddress?.toLowerCase() ?? "disconnected";
  const currentScope = useRef(scopeKey);
  currentScope.current = scopeKey;
  const previousProof = proofByWallet.current.get(scopeKey);

  const isBusy =
    activeSubmission || status === "preparing" || status === "confirming";

  useLayoutEffect(() => {
    currentScope.current = scopeKey;
    operationVersion.current += 1;
    const proof = proofByWallet.current.get(scopeKey);
    setStatus(proof?.status ?? "ready");
    setError(proof?.error ?? null);
    setLocalError(null);
    setReviewed(false);
    setDigest(proof?.digest ?? null);
    setPassportId(proof?.passportId ?? null);
    setRegisteredDevice(proof?.device ?? null);
    return () => {
      currentScope.current = "unmounted";
      operationVersion.current += 1;
    };
  }, [scopeKey]);
  const showAuthorizationError =
    Boolean(walletAddress) && authorizationQuery.isError;
  const showUnauthorized =
    Boolean(walletAddress) &&
    !authorizationQuery.isPending &&
    !authorizationQuery.isError &&
    !isIssuer;
  const showRegistrationForm =
    Boolean(walletAddress) &&
    !authorizationQuery.isPending &&
    !authorizationQuery.isError &&
    isIssuer;

  async function resolveCreatedPassport(
    transactionDigest: string,
    device: RegisteredDevice,
    submittedScope: string,
    operationId: number,
    previousProof?: RegistrationProof,
  ) {
    const isCurrentOperation = () =>
      currentScope.current === submittedScope &&
      operationVersion.current === operationId;

    if (isCurrentOperation()) {
      setStatus("confirming");
      setError(null);
    }

    try {
      const finalResult = await client.core.waitForTransaction({
        digest: transactionDigest,
        timeout: 60_000,
        include: { effects: true },
      });
      if (finalResult.FailedTransaction) {
        if (previousProof) {
          proofByWallet.current.set(submittedScope, previousProof);
        } else {
          proofByWallet.current.delete(submittedScope);
        }
        if (currentScope.current === submittedScope) {
          setDigest(transactionDigest);
          setPassportId(null);
          setStatus("failed");
          setError(
            finalResult.FailedTransaction.status.error?.message ??
              "Sui reported a failed registration transaction.",
          );
        }
        return;
      }
      const createdPassportId = await findCreatedPassportId(
        client,
        finalResult.Transaction?.effects?.changedObjects ?? [],
      );

      if (!createdPassportId) {
        throw new Error(
          "Sui confirmed the transaction, but its new DevicePassport could not be identified. Open the transaction in SuiVision before retrying.",
        );
      }

      proofByWallet.current.set(submittedScope, {
        status: "confirmed",
        digest: transactionDigest,
        passportId: createdPassportId,
        device,
        error: null,
      });
      if (isCurrentOperation()) {
        setPassportId(createdPassportId);
        setRegisteredDevice(device);
        setStatus("confirmed");
        setError(null);
        onPassportCreated(createdPassportId);
      } else if (currentScope.current === submittedScope) {
        setPassportId(createdPassportId);
        setRegisteredDevice(device);
        setStatus("confirmed");
        setError(null);
      }
    } catch (readbackError) {
      const message =
        readbackError instanceof Error
          ? readbackError.message
          : "The transaction was confirmed, but its created passport could not be read back.";
      proofByWallet.current.set(submittedScope, {
        status: "confirmed-readback-failed",
        digest: transactionDigest,
        passportId: null,
        device,
        error: message,
      });
      if (isCurrentOperation()) {
        setStatus("confirmed-readback-failed");
        setError(message);
      } else if (currentScope.current === submittedScope) {
        setStatus("confirmed-readback-failed");
        setError(message);
      }
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!walletAddress || !isIssuer) {
      setLocalError(
        "Connect an authorized issuer wallet with an active RegistrarCap.",
      );
      return;
    }

    const safeDeviceName = deviceName.trim();
    const safeBrand = brand.trim();
    const safeModel = model.trim();
    const normalizedSerial = normalizeSerial(serialNumber);

    if (!safeDeviceName || !safeBrand || !safeModel) {
      setLocalError("Add a device name, brand, and model.");
      return;
    }

    if (normalizedSerial.length < 6 || normalizedSerial.length > 64) {
      setLocalError("Enter a valid serial number between 6 and 64 characters.");
      return;
    }

    if (!reviewed) {
      setLocalError(
        "Review the device, normalized serial, and public fields before signing.",
      );
      return;
    }

    if (!submissionGuard.current.tryStart()) {
      return;
    }

    const previousProof = proofByWallet.current.get(scopeKey);
    setActiveSubmission(true);
    setStatus("preparing");
    setError(null);
    setLocalError(null);
    setDigest(null);
    setPassportId(null);
    setRegisteredDevice(null);
    const operationId = ++operationVersion.current;
    const submittedScope = scopeKey;
    const isCurrentOperation = () =>
      currentScope.current === submittedScope &&
      operationVersion.current === operationId;
    let walletRequestStarted = false;

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

      if (!isCurrentOperation()) {
        return;
      }

      if (simulation.FailedTransaction) {
        throw new Error(
          simulation.FailedTransaction.status.error?.message ??
            "Sui rejected the registration transaction.",
        );
      }

      const latestAuthorization = await authorizationQuery.refetch();
      if (!isCurrentOperation()) {
        return;
      }
      if (latestAuthorization.error || latestAuthorization.data !== true) {
        throw new Error(
          latestAuthorization.error instanceof Error
            ? latestAuthorization.error.message
            : "Registrar permission is no longer confirmed. Retry authorization before signing.",
        );
      }

      setStatus("awaiting-signature");
      walletRequestStarted = true;
      const transaction = createTransaction();
      const result = await dAppKit.signAndExecuteTransaction({ transaction });

      if (result.FailedTransaction) {
        if (isCurrentOperation()) {
          setDigest(result.FailedTransaction.digest);
          setStatus("failed");
          setError(
            result.FailedTransaction.status.error?.message ??
              "Sui reported a failed registration transaction.",
          );
        }
        return;
      }

      const transactionDigest = result.Transaction.digest;
      const device = {
        deviceName: safeDeviceName,
        brand: safeBrand,
        model: safeModel,
        maskedSerial: safeMaskedSerial,
        registeredAt,
      };
      proofByWallet.current.set(submittedScope, {
        status: "confirmed-readback-failed",
        digest: transactionDigest,
        passportId: null,
        device,
        error:
          "The transaction was confirmed. Retry passport lookup if the device ID is not shown.",
      });
      if (isCurrentOperation()) {
        setDigest(transactionDigest);
        setRegisteredDevice(device);
        setReviewed(false);
        await resolveCreatedPassport(
          transactionDigest,
          device,
          submittedScope,
          operationId,
          previousProof,
        );
      } else if (currentScope.current === submittedScope) {
        setDigest(transactionDigest);
        setRegisteredDevice(device);
        setStatus("confirmed-readback-failed");
        setError(
          "The transaction was confirmed after the wallet changed. Retry passport lookup to verify its device ID.",
        );
      }
    } catch (transactionError) {
      if (isCurrentOperation()) {
        if (walletRequestStarted) {
          setStatus(
            isWalletCancellation(transactionError) ? "cancelled" : "unknown",
          );
          setError(errorMessage(transactionError, true));
        } else {
          setStatus("ready");
          setLocalError(errorMessage(transactionError, false));
        }
      }
    } finally {
      submissionGuard.current.finish();
      setActiveSubmission(false);
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
              Sui Testnet
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

          {showAuthorizationError && (
            <div
              className="flex min-h-72 flex-col items-start justify-center"
              role="alert"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-800">
                <LockKeyhole aria-hidden="true" className="size-5" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">
                Registrar check unavailable
              </h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted">
                {authorizationQuery.error instanceof Error
                  ? authorizationQuery.error.message
                  : "Sui Testnet could not confirm this wallet's permission."}{" "}
                Signing remains disabled; this is not a permission denial.
              </p>
              <button
                className="mt-4 min-h-11 text-sm font-semibold text-brand"
                type="button"
                onClick={() => void authorizationQuery.refetch()}
              >
                Retry authorization check
              </button>
            </div>
          )}

          {showUnauthorized && (
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
                {formatAddress(walletAddress!)}
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

          {showRegistrationForm && (
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
                    title={walletAddress ?? undefined}
                  >
                    {formatAddress(walletAddress!)}
                  </p>
                </div>
              </div>

              <fieldset
                disabled={isBusy}
                className="mt-6 grid gap-5 sm:grid-cols-2"
              >
                <label className="block text-sm font-semibold">
                  Device name
                  <input
                    className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm font-medium text-ink"
                    value={deviceName}
                    onChange={(event) => {
                      setDeviceName(event.target.value);
                      setReviewed(false);
                    }}
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
                    onChange={(event) => {
                      setBrand(event.target.value);
                      setReviewed(false);
                    }}
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
                    onChange={(event) => {
                      setModel(event.target.value);
                      setReviewed(false);
                    }}
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
                      onChange={(event) => {
                        setSerialNumber(event.target.value);
                        setReviewed(false);
                      }}
                      maxLength={64}
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Enter the full serial"
                      required
                    />
                  </span>
                  <span className="mt-1.5 block text-xs font-normal leading-5 text-muted">
                    Uppercase letters and digits are kept; spaces and
                    punctuation are removed before hashing. Only a masked serial
                    and its SHA-256 hash are published.
                  </span>
                  {serialNumber && (
                    <span className="mt-1 block break-all font-mono text-xs font-normal text-muted">
                      Normalized serial:{" "}
                      {normalizeSerial(serialNumber) || "(empty)"}
                    </span>
                  )}
                </label>

                <label className="block text-sm font-semibold">
                  Initial condition
                  <select
                    className="mt-2 min-h-12 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm font-medium text-ink"
                    value={initialCondition}
                    onChange={(event) => {
                      setInitialCondition(event.target.value);
                      setReviewed(false);
                    }}
                  >
                    <option value="0">Used</option>
                    <option value="1">Repaired</option>
                    <option value="2">Refurbished</option>
                    <option value="3">Parts only</option>
                  </select>
                </label>
              </fieldset>

              <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-muted">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={reviewed}
                  disabled={isBusy}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I reviewed the target device, normalized serial, and all public
                registration fields.
              </label>

              {status === "preparing" && (
                <p className="mt-5 text-sm text-muted" role="status">
                  Preparing and simulating the registration transaction…
                </p>
              )}

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

              {previousProof && previousProof.digest !== digest && (
                <a
                  className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-brand"
                  href={transactionExplorerUrl(previousProof.digest)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View earlier confirmed registration transaction
                </a>
              )}

              {localError && (
                <p className="mt-5 text-sm text-red-800" role="alert">
                  {localError}
                </p>
              )}

              {status !== "confirmed" && error && (
                <div
                  className={`mt-5 rounded-2xl border p-4 text-sm ${
                    status === "confirmed-readback-failed"
                      ? "border-amber-700/20 bg-amber-50 text-amber-950"
                      : "border-red-700/20 bg-red-50 text-red-950"
                  }`}
                  role={
                    status === "confirmed-readback-failed" ? "status" : "alert"
                  }
                >
                  <p>{error}</p>
                  {digest && (
                    <a
                      className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold text-brand"
                      href={transactionExplorerUrl(digest)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View transaction
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  {status === "confirmed-readback-failed" &&
                    digest &&
                    registeredDevice && (
                      <button
                        className="ml-4 min-h-11 font-semibold text-brand"
                        type="button"
                        onClick={() => {
                          if (!lookupGuard.current.tryStart()) {
                            return;
                          }
                          const operationId = ++operationVersion.current;
                          void resolveCreatedPassport(
                            digest,
                            registeredDevice,
                            scopeKey,
                            operationId,
                          ).finally(() => lookupGuard.current.finish());
                        }}
                      >
                        Retry passport lookup
                      </button>
                    )}
                </div>
              )}

              <button
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-canvas transition-opacity disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                type="submit"
                disabled={isBusy || status === "confirmed-readback-failed"}
              >
                {status === "confirmed" ? (
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                ) : (
                  <CircleDashed
                    aria-hidden="true"
                    className={`size-4 ${isBusy ? "animate-spin" : ""}`}
                  />
                )}
                {status === "preparing"
                  ? "Preparing registration"
                  : status === "awaiting-signature"
                    ? "Approve in wallet"
                    : status === "confirming"
                      ? "Confirming on Sui"
                      : status === "confirmed"
                        ? "Register another device"
                        : status === "confirmed-readback-failed"
                          ? "Transaction confirmed — retry lookup"
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
