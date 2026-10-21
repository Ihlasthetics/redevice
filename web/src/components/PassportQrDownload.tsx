import { AlertTriangle, Download } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { objectExplorerUrl } from "../constants";
import { createPassportPdf } from "../lib/passport-pdf";
import { buildPassportUrl } from "../lib/passport-url";

type PassportQrDownloadProps = {
  passportId: string;
  deviceName: string;
  brand: string;
  model: string;
  maskedSerial: string;
  registeredAt: Date | string;
  className?: string;
};

function safeFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function PassportQrDownload({
  passportId,
  deviceName,
  brand,
  model,
  maskedSerial,
  registeredAt,
  className = "",
}: PassportQrDownloadProps) {
  const [qrImage, setQrImage] = useState<{
    payload: string;
    dataUrl: string;
  } | null>(null);
  const [qrError, setQrError] = useState(false);
  const passportLink = buildPassportUrl({
    passportId,
    currentHref: window.location.href,
    configuredOrigin: import.meta.env.VITE_PUBLIC_APP_ORIGIN,
  });
  const qrPayload = passportLink.url;
  const qrDataUrl = qrImage?.payload === qrPayload ? qrImage.dataUrl : null;

  useEffect(() => {
    let active = true;
    setQrError(false);

    void QRCode.toDataURL(qrPayload, {
      width: 720,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#15201d",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (active) {
          setQrImage({ payload: qrPayload, dataUrl });
          setQrError(false);
        }
      })
      .catch(() => {
        if (active) {
          setQrError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [qrPayload]);

  async function downloadPdf() {
    if (!qrDataUrl) {
      return;
    }

    const passportLink = objectExplorerUrl(passportId);
    const registeredDate =
      registeredAt instanceof Date
        ? registeredAt.toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : registeredAt;

    const pdf = await createPassportPdf({
      qrDataUrl,
      qrTarget: qrPayload,
      passportId,
      deviceName,
      brand,
      model,
      maskedSerial,
      registeredDate,
      explorerUrl: passportLink,
    });

    pdf.save(`ReDevice-${safeFileName(deviceName) || "passport"}.pdf`);
  }

  return (
    <div
      className={`grid gap-4 rounded-xl border border-line bg-white/75 p-4 sm:grid-cols-[9rem_1fr] sm:items-center ${className}`}
    >
      {qrDataUrl ? (
        <img
          className="aspect-square w-36 rounded-lg border border-line bg-white p-1"
          src={qrDataUrl}
          alt={`QR code for ReDevice passport ${passportId}`}
        />
      ) : (
        <div className="grid aspect-square w-36 place-items-center rounded-lg border border-line bg-white p-3 text-center text-xs text-muted">
          {qrError ? "QR could not be generated." : "Generating QR…"}
        </div>
      )}
      <div>
        <p className="font-semibold">Device passport QR</p>
        <p className="mt-1.5 text-xs leading-5 text-muted">
          Print or attach this QR to the device. Scanning it opens the public,
          on-chain passport.
        </p>
        {(passportLink.isLocalOnly || passportLink.configurationWarning) && (
          <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-950">
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <p>
              {passportLink.configurationWarning ??
                "This QR uses localhost and will not open this app on another device. Set VITE_PUBLIC_APP_ORIGIN to the deployed HTTPS origin before printing."}
            </p>
          </div>
        )}
        <button
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 text-xs font-semibold text-canvas disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          disabled={!qrDataUrl}
          onClick={() => void downloadPdf()}
        >
          <Download aria-hidden="true" className="size-4" />
          Download passport PDF
        </button>
      </div>
    </div>
  );
}

export default PassportQrDownload;
