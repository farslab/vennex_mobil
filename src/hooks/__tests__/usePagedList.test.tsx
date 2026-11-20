import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mergePages, usePagedList } from "@/hooks/usePagedList";

const PAGES = 25;
const page = (n: number) => ({ count: PAGES * 2, page: n, num_pages: PAGES, results: [`p${n}a`, `p${n}b`] });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const fetchPage = jest.fn((n: number) => Promise.resolve(page(n)));
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { fetchPage, wrapper };
}

describe("usePagedList", () => {
  it("21. sayfadan sonra da ilk sayfa listede kalır (sayfa düşürülmez)", async () => {
    const { fetchPage, wrapper } = setup();
    const { result } = await renderHook(() => usePagedList<string>({ queryKey: ["t1"], fetchPage }), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    for (let i = 2; i <= PAGES; i++) {
      await act(async () => result.current.loadMore());
      await waitFor(() => expect(result.current.items).toHaveLength(i * 2));
    }
    expect(result.current.items[0]).toBe("p1a");
    expect(result.current.items).toHaveLength(PAGES * 2);
    expect(result.current.hasMore).toBe(false);
  });

  it("aşağı çekip yenilemede yalnız ilk sayfa istenir", async () => {
    const { fetchPage, wrapper } = setup();
    const { result } = await renderHook(() => usePagedList<string>({ queryKey: ["t2"], fetchPage }), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    for (let i = 2; i <= 5; i++) {
      await act(async () => result.current.loadMore());
      await waitFor(() => expect(result.current.items).toHaveLength(i * 2));
    }
    fetchPage.mockClear();
    await act(async () => result.current.refresh());
    expect(fetchPage.mock.calls.map((c) => c[0])).toEqual([1]);
    expect(result.current.items).toEqual(["p1a", "p1b"]);
  });

  it("sonraki sayfa hata verirse yüklenen liste kalır, loadMoreError dolar, kaydırma tekrar istemez; Tekrar dene ister", async () => {
    const { fetchPage, wrapper } = setup();
    let failPage3 = true;
    fetchPage.mockImplementation((n: number) =>
      n === 3 && failPage3 ? Promise.reject(Object.assign(new Error("Sunucu hatası"), { status: 500 })) : Promise.resolve(page(n))
    );
    const { result } = await renderHook(() => usePagedList<string>({ queryKey: ["t-err"], fetchPage }), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(4));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.loadMoreError).toBeTruthy());

    expect(result.current.items).toHaveLength(4);
    expect(result.current.isError).toBe(false); // ilk yükleme hatası değil: liste ekranı hata ekranına dönmez
    const calls = fetchPage.mock.calls.length;
    await act(async () => result.current.loadMore()); // onEndReached tekrar tetiklense de istek yok
    expect(fetchPage.mock.calls.length).toBe(calls);

    failPage3 = false;
    await act(async () => result.current.retryLoadMore());
    await waitFor(() => expect(result.current.items).toHaveLength(6));
    expect(result.current.loadMoreError).toBeNull();
  });

  it("sonsuz kaydırmada yeni kayıt araya girip sıra kayınca sonraki sayfanın tekrar getirdiği kayıt bir kez görünür", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    // 1. sayfa: 5,4 · araya yeni kayıt (6) girdi → 2. sayfa 4'ü tekrar getirir: 4,3
    const fetchPage = jest.fn((n: number) =>
      Promise.resolve(n === 1 ? { count: 5, page: 1, num_pages: 2, results: [{ id: 5 }, { id: 4 }] } : { count: 5, page: 2, num_pages: 2, results: [{ id: 4 }, { id: 3 }] })
    );
    const { result } = await renderHook(() => usePagedList<{ id: number }>({ queryKey: ["dup"], fetchPage }), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual([5, 4, 3]));
  });
});

describe("mergePages", () => {
  it("id yoksa sn ile, ikisi de yoksa ayıklamadan birleştirir", () => {
    expect(mergePages([{ results: [{ sn: "A" }, { sn: "B" }] }, { results: [{ sn: "B" }, { sn: "C" }] }]).map((d) => d.sn)).toEqual(["A", "B", "C"]);
    expect(mergePages([{ results: ["x", "x"] }, { results: ["x"] }])).toEqual(["x", "x", "x"]);
    expect(mergePages([{ results: [{ code: 1 }] }, { results: [{ code: 1 }] }], (i) => i.code)).toHaveLength(1);
  });
});
