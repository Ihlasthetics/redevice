import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import QRCode from "qrcode";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn() },
}));

vi.mock("../lib/passport-pdf", () => ({
  createPassportPdf: vi.fn(),
}));

import { createPassportPdf } from "../lib/passport-pdf";
import PassportQrDownload from "./PassportQrDownload";

const mockToDataUrl = QRCode.toDataURL as unknown as ReturnType<typeof vi.fn>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function passportQr(passportId: string, deviceName = "Test device") {
  return (
    <PassportQrDownload
      passportId={passportId}
      deviceName={deviceName}
      brand="Test"
      model="One"
      maskedSerial="***1234"
      registeredAt="17 Oct 2026"
    />
  );
}

beforeEach(() => {
  mockToDataUrl.mockReset();
  vi.mocked(createPassportPdf).mockReset();
});

it("does not show or export an old QR after the passport changes", async () => {
  const nextQr = deferred<string>();
  mockToDataUrl
    .mockResolvedValueOnce("data:image/png;base64,first")
    .mockReturnValueOnce(nextQr.promise);
  const firstId = `0x${"1".repeat(64)}`;
  const secondId = `0x${"2".repeat(64)}`;
  const view = render(passportQr(firstId));

  expect(
    await screen.findByRole("img", { name: /QR code for ReDevice passport/i }),
  ).toHaveAttribute("src", "data:image/png;base64,first");

  view.rerender(passportQr(secondId));
  const download = screen.getByRole("button", {
    name: /download passport PDF/i,
  });
  expect(download).toBeDisabled();
  expect(
    screen.queryByRole("img", { name: /QR code for ReDevice passport/i }),
  ).not.toBeInTheDocument();
  fireEvent.click(download);
  expect(createPassportPdf).not.toHaveBeenCalled();

  nextQr.resolve("data:image/png;base64,second");
  await waitFor(() => expect(download).toBeEnabled());
  expect(
    screen.getByRole("img", { name: /QR code for ReDevice passport/i }),
  ).toHaveAttribute("src", "data:image/png;base64,second");
});

it("offers QR and PDF retries and reports clipboard failure honestly", async () => {
  mockToDataUrl
    .mockRejectedValueOnce(new Error("QR failed"))
    .mockResolvedValueOnce("data:image/png;base64,ok");
  const save = vi
    .fn()
    .mockRejectedValueOnce(new Error("save failed"))
    .mockResolvedValue(undefined);
  vi.mocked(createPassportPdf).mockResolvedValue({ save } as unknown as Awaited<
    ReturnType<typeof createPassportPdf>
  >);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  render(passportQr(`0x${"a".repeat(64)}`));
  fireEvent.click(await screen.findByText("Retry QR generation"));
  await waitFor(() =>
    expect(screen.getByText("Download passport PDF")).toBeEnabled(),
  );
  fireEvent.click(screen.getByText("Download passport PDF"));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "PDF could not be saved",
  );
  fireEvent.click(screen.getByText("Retry passport PDF"));
  expect(await screen.findByText("PDF saved.")).toBeVisible();
  fireEvent.click(screen.getByText("Copy public link"));
  expect(await screen.findByText(/Could not copy the link/)).toBeVisible();
  expect(screen.queryByText("Public link copied.")).not.toBeInTheDocument();
});

it("cancels an old export before save and keeps each metadata snapshot consistent", async () => {
  const pdf = deferred<Awaited<ReturnType<typeof createPassportPdf>>>();
  const save = vi.fn();
  mockToDataUrl.mockImplementation((url: string) =>
    Promise.resolve(`qr:${url}`),
  );
  vi.mocked(createPassportPdf).mockReturnValueOnce(pdf.promise);
  const a = `0x${"a".repeat(64)}`;
  const b = `0x${"b".repeat(64)}`;
  const view = render(passportQr(a));
  await waitFor(() =>
    expect(screen.getByText("Download passport PDF")).toBeEnabled(),
  );
  fireEvent.click(screen.getByText("Download passport PDF"));
  expect(screen.getByText("Exporting PDF…")).toBeDisabled();
  fireEvent.click(screen.getByText("Exporting PDF…"));
  expect(createPassportPdf).toHaveBeenCalledTimes(1);
  const snapshot = vi.mocked(createPassportPdf).mock.calls[0][0];
  expect(snapshot.passportId).toBe(a);
  expect(snapshot.qrTarget).toContain(a);
  expect(snapshot.qrDataUrl).toBe(`qr:${snapshot.qrTarget}`);
  expect(snapshot.explorerUrl).toContain(a);
  view.rerender(passportQr(b, "New device"));
  pdf.resolve({ save } as unknown as Awaited<
    ReturnType<typeof createPassportPdf>
  >);
  await waitFor(() =>
    expect(screen.getByText("Download passport PDF")).toBeEnabled(),
  );
  expect(save).not.toHaveBeenCalled();
  expect(screen.queryByText("PDF saved.")).not.toBeInTheDocument();
  vi.mocked(createPassportPdf).mockResolvedValueOnce({
    save,
  } as unknown as Awaited<ReturnType<typeof createPassportPdf>>);
  fireEvent.click(screen.getByText("Download passport PDF"));
  await screen.findByText("PDF saved.");
  const next = vi.mocked(createPassportPdf).mock.calls[1][0];
  expect(next.deviceName).toBe("New device");
  expect(next.passportId).toBe(b);
  expect(next.qrTarget).toContain(b);
  expect(next.qrDataUrl).toBe(`qr:${next.qrTarget}`);
  expect(next.explorerUrl).toContain(b);
});

it("recovers from PDF generation failure and only confirms successful clipboard writes", async () => {
  mockToDataUrl.mockResolvedValue("data:image/png;base64,ok");
  vi.mocked(createPassportPdf).mockRejectedValueOnce(new Error("PDF failed"));
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(passportQr(`0x${"a".repeat(64)}`));
  await waitFor(() =>
    expect(screen.getByText("Download passport PDF")).toBeEnabled(),
  );
  fireEvent.click(screen.getByText("Download passport PDF"));
  expect(await screen.findByText("Retry passport PDF")).toBeEnabled();
  fireEvent.click(screen.getByText("Copy public link"));
  expect(await screen.findByText("Public link copied.")).toBeVisible();
  expect(writeText).toHaveBeenCalledWith(
    screen.getByLabelText("Public passport link").getAttribute("value"),
  );
});
