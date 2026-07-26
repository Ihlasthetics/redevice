import { Download } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { objectExplorerUrl } from "../constants";

type PassportQrDownloadProps = {
  passportId: string;
  deviceName: string;
  brand: string;
  model: string;
  maskedSerial: string;
  registeredAt: Date | string;
  className?: string;
};

function passportUrl(passportId: string) {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set("passport", passportId);
  url.hash = "passport-title";
  return url.toString();
}

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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const qrPayload = passportUrl(passportId);

  useEffect(() => {
    let active = true;

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
          setQrDataUrl(dataUrl);
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

    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const passportLink = objectExplorerUrl(passportId);
    const registeredDate =
      registeredAt instanceof Date
        ? registeredAt.toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })
        : registeredAt;

    pdf.setFillColor(21, 32, 29);
    pdf.rect(0, 0, 210, 35, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("ReDevice", 18, 17);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("VERIFIABLE DEVICE PASSPORT", 18, 25);

    pdf.setTextColor(21, 32, 29);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.text(deviceName, 18, 52);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`${brand} ${model}`, 18, 61);
    pdf.text(`Masked serial: ${maskedSerial}`, 18, 69);
    pdf.text(`Registered: ${registeredDate}`, 18, 77);

    pdf.addImage(qrDataUrl, "PNG", 118, 45, 72, 72);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("Scan to verify on Sui Testnet", 118, 124);

    pdf.setDrawColor(218, 224, 221);
    pdf.line(18, 135, 192, 135);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("PASSPORT OBJECT ID", 18, 147);
    pdf.setFont("courier", "normal");
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(passportId, 174), 18, 155);

    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(64, 91, 82);
    pdf.setFontSize(10);
    pdf.textWithLink("Open public passport in SuiVision", 18, 175, {
      url: passportLink,
    });
    pdf.text(
      "The QR contains a public passport link. The full device serial number is never included.",
      18,
      188,
      { maxWidth: 174 },
    );

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
