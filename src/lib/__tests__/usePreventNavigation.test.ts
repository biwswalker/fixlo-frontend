// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePreventNavigation } from "@/lib/usePreventNavigation";

describe("usePreventNavigation", () => {
  it("registers beforeunload handler when active=true", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => usePreventNavigation(true));
    expect(addSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("does not register when active=false", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => usePreventNavigation(false));
    expect(addSpy).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));
    addSpy.mockRestore();
  });

  it("unregisters handler when active switches false", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { rerender } = renderHook(({ active }) => usePreventNavigation(active), {
      initialProps: { active: true },
    });
    rerender({ active: false });
    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    removeSpy.mockRestore();
  });

  it("unregisters handler on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => usePreventNavigation(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    removeSpy.mockRestore();
  });
});
