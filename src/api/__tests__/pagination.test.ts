import { nextPageParam, unwrapResults } from "@/api/pagination";

describe("nextPageParam", () => {
  it("son sayfada undefined döner", () => {
    expect(nextPageParam({ count: 50, page: 2, num_pages: 2, results: [1] })).toBeUndefined();
  });
  it("sonraki sayfayı döner", () => {
    expect(nextPageParam({ count: 50, page: 1, num_pages: 2, results: [1] })).toBe(2);
  });
  it("boş sonuçta durur", () => {
    expect(nextPageParam({ count: 0, page: 1, num_pages: 0, results: [] })).toBeUndefined();
  });
  it("num_pages yoksa sonuç geldikçe devam eder", () => {
    expect(nextPageParam({ count: 0, page: 1, results: [1] } as never)).toBe(2);
    expect(nextPageParam({ count: 0, page: 3, results: [] } as never)).toBeUndefined();
  });
  it("string sayfa numaralarını tolere eder", () => {
    expect(nextPageParam({ count: 9, page: "1", num_pages: "3", results: [1] } as never)).toBe(2);
  });
});

describe("unwrapResults", () => {
  it.each([
    [null, []],
    [undefined, []],
    [[1, 2], [1, 2]],
    [{ results: [3] }, [3]],
    [{ results: null }, []],
    [{}, []],
  ])("%p → %p", (input, expected) => {
    expect(unwrapResults(input as never)).toEqual(expected);
  });
});
