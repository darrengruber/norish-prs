import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestQueryClient,
  createTestWrapper,
  fakePlatformAdapter,
} from "@norish/shared-react/platform/testing";
import { DevicePreferencesForVisit } from "@norish/shared-react/reader";
import {
  DEVICE_PREFERENCE_DEFAULTS,
  deviceBlocks,
} from "@norish/shared/contracts/zod/device-preferences";

import { keyOf, resetTRPCFake, serveTRPC } from "../../trpc/testing";
import { useReadableUnitsPreference } from "../use-readable-units-preference";

vi.mock("../../trpc", async () => (await import("../../trpc/testing")).mockTRPC());

const write = vi.fn();
let latest!: ReturnType<typeof useReadableUnitsPreference>;

function Probe() {
  latest = useReadableUnitsPreference();

  return <span data-testid="enabled">{String(latest.enabled)}</span>;
}

function renderProbe({
  readableUnits,
  forVisit = false,
}: { readableUnits?: boolean; forVisit?: boolean } = {}) {
  const queryClient = createTestQueryClient();
  const Wrapper = createTestWrapper(queryClient, fakePlatformAdapter("phone"));

  queryClient.setQueryData(
    keyOf("user.getDevicePreferences"),
    deviceBlocks({
      phone: {
        ...DEVICE_PREFERENCE_DEFAULTS,
        ...(readableUnits !== undefined && { readableUnits }),
      },
    })
  );

  return render(
    <Wrapper>
      {forVisit ? (
        <DevicePreferencesForVisit>
          <Probe />
        </DevicePreferencesForVisit>
      ) : (
        <Probe />
      )}
    </Wrapper>
  );
}

const shown = () => screen.getByTestId("enabled").textContent;

beforeEach(() => {
  resetTRPCFake();
  serveTRPC(async (path, input) => {
    if (path === "user.setDevicePreferences") return write(input);

    return Promise.reject(new Error("not served in this test"));
  });
  write.mockReset().mockReturnValue({ success: true });
});

describe("useReadableUnitsPreference", () => {
  it("tidies scaled units by default", () => {
    renderProbe();

    expect(shown()).toBe("true");
  });

  it("reads a reader's stored choice to keep units as written", () => {
    renderProbe({ readableUnits: false });

    expect(shown()).toBe("false");
  });

  it("toggles both ways and stores each choice for this device", async () => {
    renderProbe();

    act(() => latest.toggle());
    await waitFor(() => expect(shown()).toBe("false"));
    await waitFor(() =>
      expect(write).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: "phone", preferences: { readableUnits: false } })
      )
    );

    act(() => latest.toggle());
    await waitFor(() => expect(shown()).toBe("true"));
  });

  it("lets a signed-out reader of a shared recipe switch for the visit, storing nothing", async () => {
    renderProbe({ forVisit: true });

    act(() => latest.toggle());

    await waitFor(() => expect(shown()).toBe("false"));
    expect(write).not.toHaveBeenCalled();
  });
});
