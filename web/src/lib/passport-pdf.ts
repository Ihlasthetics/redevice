export type PassportPdfInput = {
  qrDataUrl: string;
  qrTarget: string;
  passportId: string;
  deviceName: string;
  brand: string;
  model: string;
  maskedSerial: string;
  registeredDate: string;
  explorerUrl: string;
};

export async function createPassportPdf(input: PassportPdfInput) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

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
  pdf.text(input.deviceName, 18, 52);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.text(`${input.brand} ${input.model}`, 18, 61);
  pdf.text(`Masked serial: ${input.maskedSerial}`, 18, 69);
  pdf.text(`Registered: ${input.registeredDate}`, 18, 77);

  pdf.addImage(input.qrDataUrl, "PNG", 118, 45, 72, 72);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Scan to open the public passport", 118, 124);

  pdf.setDrawColor(218, 224, 221);
  pdf.line(18, 135, 192, 135);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("STELLAR CONTRACT / DEVICE ID", 18, 147);
  pdf.setFont("courier", "normal");
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(input.passportId, 174), 18, 155);

  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(64, 91, 82);
  pdf.setFontSize(10);
  pdf.textWithLink("Open public passport", 18, 175, {
    url: input.qrTarget,
  });
  pdf.textWithLink("Inspect the contract on Stellar Expert", 18, 182, {
    url: input.explorerUrl,
  });
  pdf.text(
    "The QR contains only a public passport link. The full serial number is never included.",
    18,
    194,
    { maxWidth: 174 },
  );
  pdf.setFontSize(7);
  pdf.text(pdf.splitTextToSize(`QR target: ${input.qrTarget}`, 174), 18, 207);

  return pdf;
}
