import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { passportAdapter } from "../data/passport-adapter";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  client: {},
  detect: vi.fn(),
}));
vi.mock("@mysten/dapp-kit-react", () => ({
  useCurrentClient: () => mocks.client,
}));
vi.mock("../data/sui-passport", () => ({ loadTestnetPassport: mocks.load }));
vi.mock("jsqr", () => ({ default: mocks.detect }));
import QrPassportScanner from "./QrPassportScanner";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const media = vi.fn();
const resolved = vi.fn();
function mount() {
  return render(
    <QrPassportScanner
      onPassportResolved={resolved}
      onDemoRequested={vi.fn()}
    />,
  );
}
beforeEach(() => {
  mocks.load.mockReset();
  resolved.mockReset();
  media.mockReset();
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: media },
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each(["stop", "unmount", "demo"])(
  "releases a late camera stream after %s",
  async (action) => {
    const permission = deferred<MediaStream>();
    const stop = vi.fn();
    media.mockReturnValue(permission.promise);
    const view = mount();
    fireEvent.click(screen.getByText("Open camera"));
    if (action === "unmount") view.unmount();
    else
      fireEvent.click(
        screen.getByText(
          action === "stop" ? "Stop camera" : "Open demo data without a camera",
        ),
      );
    await act(async () => {
      permission.resolve({
        getTracks: () => [{ stop }],
      } as unknown as MediaStream);
    });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  },
);
it("allows retry after permission denial and stops the active stream", async () => {
  const stop = vi.fn();
  media
    .mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"))
    .mockResolvedValueOnce({ getTracks: () => [{ stop }] });
  const view = mount();
  fireEvent.click(screen.getByText("Open camera"));
  expect(await screen.findByText(/Camera permission was denied/)).toBeVisible();
  fireEvent.click(screen.getByText("Scan another code"));
  expect(await screen.findByText("Looking for a QR code")).toBeVisible();
  view.unmount();
  expect(stop).toHaveBeenCalledTimes(1);
});
it("reports unsupported camera access", () => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
  mount();
  fireEvent.click(screen.getByText("Open camera"));
  expect(screen.getByText(/does not support camera access/)).toBeVisible();
});
it("ignores out-of-order lookups and a lookup superseded by demo", async () => {
  const first =
    deferred<ReturnType<typeof passportAdapter.getPublicPassport>>();
  const second =
    deferred<ReturnType<typeof passportAdapter.getPublicPassport>>();
  mocks.load
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  mount();
  const input = screen.getByLabelText("Or paste QR content");
  fireEvent.change(input, { target: { value: `0x${"a".repeat(64)}` } });
  fireEvent.click(screen.getByText("Read code"));
  fireEvent.change(input, { target: { value: `0x${"b".repeat(64)}` } });
  fireEvent.click(screen.getByText("Read code"));
  const b = {
    ...passportAdapter.getPublicPassport(),
    id: `0x${"b".repeat(64)}`,
  };
  await act(async () => second.resolve(b));
  expect(resolved).toHaveBeenCalledWith(b);
  fireEvent.click(screen.getByText("Open demo data without a camera"));
  await act(async () => first.resolve(passportAdapter.getPublicPassport()));
  expect(resolved).toHaveBeenCalledTimes(1);
});

it("launches only one lookup for repeated camera detections", async () => {
  const stop = vi.fn();
  media.mockResolvedValue({ getTracks: () => [{ stop }] });
  mocks.load.mockReturnValue(new Promise(() => {}));
  mocks.detect.mockReturnValue({ data: `0x${"a".repeat(64)}` });
  let frame!: FrameRequestCallback;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frame = callback;
    return 1;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  } as unknown as CanvasRenderingContext2D);
  const view = mount();
  const video = view.container.querySelector("video")!;
  Object.defineProperties(video, {
    readyState: { value: 4 },
    videoWidth: { value: 1 },
    videoHeight: { value: 1 },
  });
  fireEvent.click(screen.getByText("Open camera"));
  await screen.findByText("Looking for a QR code");
  act(() => {
    frame(200);
    frame(400);
  });
  expect(mocks.load).toHaveBeenCalledTimes(1);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Loading passport/)).toBeVisible();
});
