import {
  assignableGroups,
  buildCreatePayload,
  buildUpdatePatch,
  emptyUserForm,
  userToForm,
  validateUserForm,
} from "@/screens/users/form/userFormModel";
import type { StaffUser } from "@/types/users";

const staff: StaffUser = {
  id: 7,
  username: "ali.tek",
  first_name: "Ali",
  last_name: "Tek",
  email: "ali@example.com",
  phone: "05321234567",
  is_active: true,
  group_names: ["Satış Görüntüleme", "Admin Özel"],
  pos_devices: [{ id: 5, sn: "PAV1", pos_name: "Otomat 1" }],
  default_stock_locations: [],
  pos_device_ids: [5],
  pos_device_count: 1,
  default_stock_location_ids: [],
};

describe("userFormModel", () => {
  it("atanabilir grupları birleştirir ve tekrarları atar", () => {
    expect(assignableGroups({ available_groups: ["B", "A"], always_available_groups: ["A", "C"] })).toEqual(["A", "B", "C"]);
  });

  it("oluşturmada kullanıcı adı ve en az 8 karakterlik şifre zorunlu", () => {
    const errors = validateUserForm({ ...emptyUserForm(), password: "123456" }, "create");
    expect(errors.username).toBe("Kullanıcı adı gerekli.");
    expect(errors.password).toBe("Şifre en az 8 karakter olmalı.");
  });

  it("şifreyi sessizce kırpmaz — baştaki/sondaki boşluğu reddeder", () => {
    const errors = validateUserForm({ ...emptyUserForm(), username: "ali", password: " Guclu1234 " }, "create");
    expect(errors.password).toBe("Şifre başında veya sonunda boşluk olamaz.");
  });

  it("geçersiz kullanıcı adı, e-posta ve telefonu yakalar", () => {
    const errors = validateUserForm(
      { ...emptyUserForm(), username: "ali veli", password: "Guclu1234", email: "x@", phone: "123" },
      "create"
    );
    expect(errors).toMatchObject({
      username: expect.stringContaining("harf, rakam"),
      email: "Geçerli bir e-posta adresi girin.",
      phone: expect.stringContaining("cep telefonu"),
    });
  });

  it("düzenlemede kullanıcı adı/şifre doğrulanmaz", () => {
    expect(validateUserForm(userToForm(staff, ["Satış Görüntüleme"]), "edit")).toEqual({});
  });

  it("create payload: telefon normalize, boş e-posta gönderilmez, şifre olduğu gibi", () => {
    const payload = buildCreatePayload({
      ...emptyUserForm(),
      username: " ali.tek ",
      password: "Guclu1234",
      phone: "+90 532 123 45 67",
      pos_device_ids: [9, 5, 9],
    });
    expect(payload).toEqual({
      username: "ali.tek",
      password: "Guclu1234",
      first_name: "",
      last_name: "",
      phone: "05321234567",
      pos_device_ids: [5, 9],
      group_names: [],
      default_stock_location_ids: [],
    });
  });

  it("update patch yalnız değişen alanları içerir; yönetilemeyen grup formda yok", () => {
    const initial = userToForm(staff, ["Satış Görüntüleme", "Stok Yönetimi"]);
    expect(initial.group_names).toEqual(["Satış Görüntüleme"]);
    expect(buildUpdatePatch(initial, { ...initial })).toEqual({});
    // sıra değişikliği değişiklik sayılmaz
    expect(buildUpdatePatch(initial, { ...initial, pos_device_ids: [5] })).toEqual({});

    const patch = buildUpdatePatch(initial, {
      ...initial,
      first_name: "Ali ",
      last_name: "Yeni",
      phone: "",
      group_names: ["Stok Yönetimi", "Satış Görüntüleme"],
    });
    expect(patch).toEqual({ last_name: "Yeni", phone: null, group_names: ["Satış Görüntüleme", "Stok Yönetimi"] });
  });
});
