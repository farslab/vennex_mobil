import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { extractResultsList, overviewApi } from "@/api/overview";

describe("extractResultsList", () => {
  it("null/undefined için boş dizi döner", () => {
    expect(extractResultsList(null)).toEqual([]);
    expect(extractResultsList(undefined)).toEqual([]);
  });

  it("doğrudan dizi gelirse aynen döner", () => {
    expect(extractResultsList([1, 2])).toEqual([1, 2]);
  });

  it("{results} zarfını açar", () => {
    expect(extractResultsList({ results: ["a"] })).toEqual(["a"]);
  });
});

describe("overviewApi.dashboard", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/overview/dashboard/").reply(200, {});
  });
  afterEach(() => mock.restore());

  const lastParams = () => mock.history.get[mock.history.get.length - 1].params;

  it("varsayılan limitleri gönderir", async () => {
    await overviewApi.dashboard({ period: "today" });
    expect(lastParams()).toEqual({ period: "today", top_limit: 5, recent_limit: 5 });
  });

  it("start/end tarihlerini yalnızca custom dönemde gönderir", async () => {
    await overviewApi.dashboard({ period: "this_month", start_date: "2026-01-01", end_date: "2026-01-31" });
    expect(lastParams()).not.toHaveProperty("start_date");

    await overviewApi.dashboard({ period: "custom", start_date: "2026-01-01", end_date: "2026-01-31" });
    expect(lastParams()).toMatchObject({ start_date: "2026-01-01", end_date: "2026-01-31" });
  });

  it("nocache ve çoklu konum (sıralı, virgüllü) parametrelerini ekler", async () => {
    await overviewApi.dashboard({ period: "today", nocache: true, location_ids: [9, 7] });
    expect(lastParams()).toMatchObject({ nocache: 1, location_ids: "7,9" });
    await overviewApi.dashboard({ period: "today", location_ids: [] });
    expect(lastParams().location_ids).toBeUndefined();
  });
});
