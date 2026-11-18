import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient } from "@/test/utils";
import { fieldErrorsOf, generalErrorOf, useLockedMutation } from "../useLockedMutation";

describe("useLockedMutation", () => {
  it("aynı tick'te iki çağrıda mutationFn yalnız bir kez çalışır, bitince kilit açılır", async () => {
    const fn = jest.fn(() => new Promise<number>((r) => setTimeout(() => r(1), 10)));
    const client = createTestQueryClient();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = await renderHook(() => useLockedMutation<number, number>({ mutationFn: fn }), { wrapper });

    await act(async () => {
      result.current.run(1);
      result.current.run(2);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["cards"] });

    await act(async () => {
      result.current.run(3);
    });
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(2));
  });

  it("generalErrorOf ele alınan alan hatalarını genel mesaj saymaz", () => {
    const err = Object.assign(new Error("x"), { fieldErrors: { amount: "Hatalı" } });
    expect(fieldErrorsOf(err)).toEqual({ amount: "Hatalı" });
    expect(generalErrorOf(err, ["amount"])).toBeNull();
    expect(generalErrorOf(err)).toBe("Hatalı");
    expect(generalErrorOf(new Error("Ağ hatası"))).toBe("Ağ hatası");
    expect(generalErrorOf(null)).toBeNull();
  });
});
