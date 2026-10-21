import { useCurrentClient } from "@mysten/dapp-kit-react";
import {
  AlertCircle,
  Camera,
  CameraOff,
  CircleCheck,
  ClipboardPaste,
  QrCode,
  RotateCcw,
  ScanLine,
} from "lucide-react";
import jsQR from "jsqr";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  qrPassportAdapter,
  passportAdapter,
  type PassportQrResolution,
  type PublicDevicePassport,
} from "../data/passport-adapter";
import { loadTestnetPassport } from "../data/sui-passport";

type CameraStatus =
  "idle" | "requesting" | "scanning" | "resolved" | "error" | "loading";

type QrPassportScannerProps = {
  onLookupRequested?: (objectId: string) => void;
  onPassportResolved: (passport: PublicDevicePassport) => void;
  onDemoRequested: (passport: PublicDevicePassport) => void;
};

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Camera permission was denied. Allow camera access in the browser and try again.";
    }

    if (error.name === "NotFoundError") {
      return "No camera was found on this device.";
    }

    if (error.name === "NotReadableError") {
      return "The camera is already in use by another app or browser tab.";
    }
  }

  return "The camera could not be started. You can still paste the QR content below.";
}

function QrPassportScanner({
  onPassportResolved,
  onLookupRequested,
  onDemoRequested,
}: QrPassportScannerProps) {
  const client = useCurrentClient();
  const cameraRequest = useRef(0);
  const lookupRequest = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraMessage, setCameraMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<PassportQrResolution | null>(
    null,
  );
  const [pastedPayload, setPastedPayload] = useState("");

  const stopCamera = useCallback(() => {
    cameraRequest.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const resolvePayload = useCallback(
    async (payload: string) => {
      const request = ++lookupRequest.current;
      const deviceId = qrPassportAdapter.readDeviceId(payload);

      stopCamera();
      setCameraMessage(null);

      if (!deviceId) {
        setResolution({
          status: "invalid",
          message:
            "This QR code does not contain a supported Sui passport object ID.",
        });
        setCameraStatus("resolved");
        return;
      }

      setCameraStatus("loading");
      setResolution(null);
      if (onLookupRequested) {
        onLookupRequested(deviceId);
        return;
      }
      try {
        const resolvedPassport = await loadTestnetPassport(client, deviceId);
        if (request !== lookupRequest.current) return;
        const nextResolution: PassportQrResolution = {
          status: "matched",
          deviceId: resolvedPassport.id,
          passport: resolvedPassport,
        };

        setResolution(nextResolution);
        setCameraStatus("resolved");
        onPassportResolved(resolvedPassport);
      } catch (error) {
        if (request !== lookupRequest.current) return;
        setResolution({
          status: "not-found",
          deviceId,
          message:
            error instanceof Error
              ? error.message
              : "No compatible ReDevice passport was found for this object ID on Sui Testnet.",
        });
        setCameraStatus("resolved");
      }
    },
    [client, onPassportResolved, onLookupRequested, stopCamera],
  );

  const openDemo = useCallback(() => {
    lookupRequest.current += 1;
    const demoPassport = passportAdapter.getPublicPassport();

    stopCamera();
    setCameraMessage(null);
    setResolution({
      status: "matched",
      deviceId: demoPassport.id,
      passport: demoPassport,
    });
    setCameraStatus("resolved");
    onDemoRequested(demoPassport);
  }, [onDemoRequested, stopCamera]);

  const startCamera = useCallback(async () => {
    lookupRequest.current += 1;
    stopCamera();
    const request = cameraRequest.current;
    setResolution(null);
    setCameraMessage(null);

    if (!window.isSecureContext) {
      setCameraStatus("error");
      setCameraMessage(
        "Camera access requires HTTPS or localhost. Open the site securely and try again.",
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraMessage(
        "This browser does not support camera access. Paste the QR content instead.",
      );
      return;
    }

    setCameraStatus("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (request !== cameraRequest.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview is unavailable.");
      }

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (request !== cameraRequest.current) return;
      setCameraStatus("scanning");
    } catch (error) {
      if (request !== cameraRequest.current) return;
      stopCamera();
      setCameraStatus("error");
      setCameraMessage(cameraErrorMessage(error));
    }
  }, [stopCamera]);

  useEffect(() => {
    if (cameraStatus !== "scanning") {
      return;
    }

    const request = cameraRequest.current;
    let animationFrame = 0;
    let lastScanAt = 0;

    const scanFrame = (timestamp: number) => {
      if (request !== cameraRequest.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        video &&
        canvas &&
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        timestamp - lastScanAt >= 120
      ) {
        lastScanAt = timestamp;

        const scale = Math.min(1, 720 / video.videoWidth);
        const width = Math.max(1, Math.round(video.videoWidth * scale));
        const height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d", {
          willReadFrequently: true,
        });

        canvas.width = width;
        canvas.height = height;
        context?.drawImage(video, 0, 0, width, height);

        if (context) {
          const imageData = context.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, width, height, {
            inversionAttempts: "attemptBoth",
          });

          if (code?.data) {
            void resolvePayload(code.data);
            return;
          }
        }
      }

      animationFrame = window.requestAnimationFrame(scanFrame);
    };

    animationFrame = window.requestAnimationFrame(scanFrame);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [cameraStatus, resolvePayload]);

  useEffect(
    () => () => {
      lookupRequest.current += 1;
      stopCamera();
    },
    [stopCamera],
  );

  const handlePasteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pastedPayload.trim()) {
      void resolvePayload(pastedPayload);
    }
  };

  return (
    <section
      id="qr-scanner"
      aria-labelledby="qr-scanner-title"
      className="public-experience mb-10 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_30px_80px_-58px_rgba(21,31,28,0.55)] sm:mb-14"
    >
      <div className="grid lg:grid-cols-[0.88fr_1.12fr]">
        <div className="p-5 sm:p-8 lg:p-9">
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
              Find a device
            </p>
            <span className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted">
              Public lookup
            </span>
          </div>

          <h2
            id="qr-scanner-title"
            className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl"
          >
            Scan the device QR
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted sm:text-base sm:leading-7">
            Point the camera at a ReDevice QR code. The code contains only a
            public passport link or device ID. All recorded blockchain
            information is public; no wallet is required to read it.
          </p>

          <form className="mt-6" onSubmit={handlePasteSubmit}>
            <label className="text-sm font-semibold" htmlFor="qr-payload-input">
              Or paste QR content
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <span className="relative min-w-0 flex-1">
                <ClipboardPaste
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                />
                <input
                  id="qr-payload-input"
                  className="min-h-12 w-full rounded-xl border border-line bg-surface py-2 pl-10 pr-3.5 text-sm text-ink"
                  value={pastedPayload}
                  onChange={(event) => setPastedPayload(event.target.value)}
                  placeholder="0xc1e9…46666"
                  maxLength={2048}
                  autoComplete="off"
                  spellCheck={false}
                />
              </span>
              <button
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={!pastedPayload.trim()}
              >
                <ScanLine aria-hidden="true" className="size-4" />
                Read code
              </button>
            </div>
          </form>

          <button
            className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-1 text-xs font-semibold text-brand transition-colors hover:text-ink"
            type="button"
            onClick={openDemo}
          >
            <QrCode aria-hidden="true" className="size-4" />
            Open demo data without a camera
          </button>
        </div>

        <div className="relative min-h-96 overflow-hidden bg-ink lg:min-h-full">
          <video
            ref={videoRef}
            className={`absolute inset-0 size-full object-cover transition-opacity ${
              cameraStatus === "scanning" ? "opacity-100" : "opacity-15"
            }`}
            muted
            playsInline
            aria-label="Camera preview for QR scanning"
          />
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(8,19,16,0.08)_48%,rgba(8,19,16,0.74)_100%)]" />

          {cameraStatus === "scanning" && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(64vw,15rem)] -translate-x-1/2 -translate-y-1/2 rounded-[1.5rem] border-2 border-white/90 shadow-[0_0_0_999px_rgba(8,19,16,0.18)]"
              aria-hidden="true"
            >
              <span className="absolute -left-0.5 -top-0.5 size-9 rounded-tl-[1.5rem] border-l-4 border-t-4 border-success-soft" />
              <span className="absolute -right-0.5 -top-0.5 size-9 rounded-tr-[1.5rem] border-r-4 border-t-4 border-success-soft" />
              <span className="absolute -bottom-0.5 -left-0.5 size-9 rounded-bl-[1.5rem] border-b-4 border-l-4 border-success-soft" />
              <span className="absolute -bottom-0.5 -right-0.5 size-9 rounded-br-[1.5rem] border-b-4 border-r-4 border-success-soft" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 z-10 p-5 sm:p-7">
            <div
              className="rounded-2xl border border-white/15 bg-ink/85 p-4 text-canvas backdrop-blur-sm"
              aria-live="polite"
            >
              {cameraStatus === "loading" && (
                <p role="status">
                  Loading passport… You can enter another code or choose demo
                  data.
                </p>
              )}
              {cameraStatus === "idle" && (
                <div className="flex items-start gap-3">
                  <Camera
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-success-soft"
                  />
                  <div>
                    <p className="text-sm font-semibold">Camera is off</p>
                    <p className="mt-1 text-xs leading-5 text-canvas/70">
                      Camera permission is requested only after you start
                      scanning.
                    </p>
                  </div>
                </div>
              )}

              {cameraStatus === "requesting" && (
                <div className="flex items-start gap-3">
                  <ScanLine
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 animate-pulse text-success-soft"
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      Waiting for camera permission
                    </p>
                    <p className="mt-1 text-xs leading-5 text-canvas/70">
                      Approve the browser prompt to continue.
                    </p>
                  </div>
                </div>
              )}

              {cameraStatus === "scanning" && (
                <div className="flex items-start gap-3">
                  <ScanLine
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-success-soft"
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      Looking for a QR code
                    </p>
                    <p className="mt-1 text-xs leading-5 text-canvas/70">
                      Hold the code steady inside the frame.
                    </p>
                  </div>
                </div>
              )}

              {cameraStatus === "resolved" && resolution && (
                <div className="flex items-start gap-3">
                  {resolution.status === "matched" ? (
                    <CircleCheck
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-success-soft"
                    />
                  ) : (
                    <AlertCircle
                      aria-hidden="true"
                      className="mt-0.5 size-5 shrink-0 text-amber-300"
                    />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {resolution.status === "matched"
                        ? resolution.passport.source.kind === "fixture"
                          ? "Demo passport opened"
                          : "Passport found"
                        : "Passport unavailable"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-canvas/70">
                      {resolution.status === "matched"
                        ? `${resolution.passport.model} · ${resolution.deviceId}`
                        : resolution.message}
                    </p>
                  </div>
                </div>
              )}

              {cameraStatus === "error" && cameraMessage && (
                <div className="flex items-start gap-3">
                  <CameraOff
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-amber-300"
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      Camera is unavailable
                    </p>
                    <p className="mt-1 text-xs leading-5 text-canvas/70">
                      {cameraMessage}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {cameraStatus !== "scanning" && cameraStatus !== "requesting" && (
                <button
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-success-soft px-4 text-sm font-semibold text-ink transition-colors hover:bg-white"
                  type="button"
                  onClick={() => void startCamera()}
                >
                  {cameraStatus === "idle" ? (
                    <Camera aria-hidden="true" className="size-4" />
                  ) : (
                    <RotateCcw aria-hidden="true" className="size-4" />
                  )}
                  {cameraStatus === "idle"
                    ? "Open camera"
                    : "Scan another code"}
                </button>
              )}

              {(cameraStatus === "scanning" ||
                cameraStatus === "requesting") && (
                <button
                  className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-canvas transition-colors hover:bg-white/15"
                  type="button"
                  onClick={() => {
                    stopCamera();
                    setCameraStatus("idle");
                  }}
                >
                  <CameraOff aria-hidden="true" className="size-4" />
                  Stop camera
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default QrPassportScanner;
