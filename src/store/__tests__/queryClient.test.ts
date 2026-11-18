import { shouldRetry } from "@/store/queryClient";

const err = (status?: number) => Object.assign(new Error("x"), { status });

describe("shouldRetry", () => {
  it.each([400, 401, 403, 404, 422])("%i durumunda tekrar denemez", (status) => {
    expect(shouldRetry(0, err(status))).toBe(false);
  });

  it.each([408, 429, 500, 502, 503])("%i durumunda tekrar dener", (status) => {
    expect(shouldRetry(0, err(status))).toBe(true);
  });

  it("ağ hatasında (status yok) tekrar dener", () => {
    expect(shouldRetry(0, err())).toBe(true);
  });

  it("en fazla 2 kez tekrar dener", () => {
    expect(shouldRetry(1, err(500))).toBe(true);
    expect(shouldRetry(2, err(500))).toBe(false);
  });
});
