import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { usersApi } from "@/api/users";

const rawStaff = {
  id: 7,
  username: "ali.tek",
  first_name: "Ali",
  last_name: "Tek",
  email: "",
  phone: "",
  is_active: true,
  group_names: ["Satış Görüntüleme", "Cihaz Ayarları"],
  pos_devices: [
    { id: 5, sn: "PAV1", pos_name: "Otomat 1" },
    { id: 6, sn: "PAV2", pos_name: "Otomat 2" },
  ],
  default_stock_locations: [{ id: 3, name: "Merkez Depo", location_type: "warehouse" }],
};

describe("usersApi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("backend Staff şemasından id/sayı alanlarını türetir (views/users.py:20-41)", async () => {
    mock.onGet("/users/").reply(200, { count: 1, page: 1, num_pages: 1, results: [rawStaff] });

    const res = await usersApi.list(1);

    expect(res).toMatchObject({ count: 1, page: 1, num_pages: 1 });
    expect(res.results[0]).toMatchObject({
      pos_device_ids: [5, 6],
      pos_device_count: 2,
      default_stock_location_ids: [3],
      group_names: ["Satış Görüntüleme", "Cihaz Ayarları"],
      is_active: true,
    });
  });

  it("uydurma sayaç anahtarlarını dikkate almaz; eksik alanlara güvenli varsayılan atar", async () => {
    mock.onGet("/users/9/").reply(200, { id: 9, device_count: 12, pos_device_count: 4 });

    expect(await usersApi.detail(9)).toEqual({
      id: 9,
      username: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      is_active: true,
      group_names: [],
      pos_devices: [],
      default_stock_locations: [],
      pos_device_ids: [],
      pos_device_count: 0,
      default_stock_location_ids: [],
    });
  });

  it("list yalnız page parametresi gönderir (page_size yok)", async () => {
    mock.onGet("/users/").reply(200, { count: 0, page: 3, num_pages: 3, results: [] });
    await usersApi.list(3);
    expect(mock.history.get[0].params).toEqual({ page: 3 });
  });

  it("create tam gövdeyi, update yalnız verilen alanları gönderir", async () => {
    mock.onPost("/users/").reply(201, rawStaff);
    mock.onPatch("/users/7/").reply(200, rawStaff);

    await usersApi.create({
      username: "ali.tek",
      password: "Guclu1234",
      pos_device_ids: [5],
      group_names: ["Satış Görüntüleme"],
      default_stock_location_ids: [],
    });
    await usersApi.update(7, { first_name: "Ali" });

    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      username: "ali.tek",
      password: "Guclu1234",
      pos_device_ids: [5],
      group_names: ["Satış Görüntüleme"],
      default_stock_location_ids: [],
    });
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ first_name: "Ali" });
  });

  it("reset-password ve delete doğru uçlara gider", async () => {
    mock.onPost("/users/7/reset-password/").reply(200, { detail: "Şifre güncellendi." });
    mock.onDelete("/users/7/").reply(204);

    await expect(usersApi.resetPassword(7, "YeniSifre12")).resolves.toEqual({ detail: "Şifre güncellendi." });
    await usersApi.remove(7);

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ new_password: "YeniSifre12" });
    expect(mock.history.delete).toHaveLength(1);
  });

  it("assignable-options eksik dizileri boş diziye çevirir", async () => {
    mock.onGet("/users/assignable-options/").reply(200, { available_groups: ["Stok Yönetimi"] });
    await expect(usersApi.assignableOptions()).resolves.toEqual({
      available_groups: ["Stok Yönetimi"],
      always_available_groups: [],
      pos_devices: [],
      stock_locations: [],
      regions: [],
    });
  });
});
