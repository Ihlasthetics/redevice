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

function passportQr(passportId: string) {
  return (
    <PassportQrDownload
      passportId={passportId}
      deviceName="Test device"
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
