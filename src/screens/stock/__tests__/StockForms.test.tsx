import React from "react";
import { Alert, type AlertButton } from "react-native";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { normalizeLocation, normalizeSku } from "@/api/stock";
import { useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import { SkuFormSheet, buildSkuPayload, type SkuFormState } from "@/screens/stock/components/SkuFormSheet";
import { LocationFormSheet } from "@/screens/stock/components/LocationFormSheet";
import { locations, skus } from "./fixtures";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

type Reply = [number, unknown];

/** Yanıtı test elle bırakana kadar bekleten istek (çift dokunma / yükleniyor durumları için) */
function deferred(reply: Reply) {
  let release: () => void = () => {};
  const promise = new Promise<Reply>((resolve) => {
    release = () => resolve(reply);
  });
  return { promise, release: () => release() };
}

/** AppSelect alanını açar ve etiketi eşleşen seçeneği seçer */
async function pickOption(testID: string, label: RegExp) {
  await fireEvent.press(screen.getByTestId(testID));
  const [option] = await screen.findAllByRole("radio", { name: label });
  await fireEvent.press(option);
}

/** Alert.alert ile açılan "kaydedilmemiş değişiklik" penceresinde bir butona basar */
function pressAlertButton(spy: jest.SpyInstance, text: string) {
  const buttons = (spy.mock.calls[0]?.[2] ?? []) as AlertButton[];
  buttons.find((b) => b.text === text)?.onPress?.();
}

const body = (data: unknown) => JSON.parse(String(data)) as Record<string, unknown>;

const water = normalizeSku(skus[0]);
const vehicle = normalizeLocation(locations[2]);

const baseForm: SkuFormState = {
  name: "Ayran",
  sku_code: "AYR-1",
  barcode: "",
  kind: "simple",
  base_unit: "piece",
  package_size: "1",
  package_label: "",
  unit_cost: "",
  sale_price: "",
  vat_rate: "20",
};

describe("buildSkuPayload (SKU formu doğrulama)", () => {
  it("Türkçe ondalık girişleri API string'ine çevirir", () => {
    const { payload, errors } = buildSkuPayload({ ...baseForm, unit_cost: "12,5", sale_price: "1.234,50", vat_rate: "10", package_label: " 6'lı " });
    expect(errors).toEqual({});
    expect(payload).toEqual({
      name: "Ayran",
      sku_code: "AYR-1",
      barcode: null,
      kind: "simple",
      base_unit: "piece",
      package_size: "1.000",
      package_label: "6'lı",
      unit_cost: "12.50",
      sale_price: "1234.50",
      vat_rate: "10.00",
    });
  });

  it("uzunluk ve aralık sınırlarını Türkçe mesajla reddeder", () => {
    const { payload, errors } = buildSkuPayload({
      ...baseForm,
      name: "a".repeat(101),
      sku_code: "b".repeat(51),
      barcode: "1".repeat(51),
      package_size: "0",
      package_label: "c".repeat(41),
      unit_cost: "-1",
      sale_price: "1.000.000",
      vat_rate: "101",
    });
    expect(payload).toBeNull();
    expect(errors).toEqual({
      name: "En fazla 100 karakter.",
      sku_code: "En fazla 50 karakter.",
      barcode: "En fazla 50 karakter.",
      package_size: "En az 0,001 olmalı.",
      package_label: "En fazla 40 karakter.",
      unit_cost: "Geçerli bir tutar girin.",
      sale_price: "Tutar çok büyük.",
      vat_rate: "0 ile 100 arasında olmalı.",
    });
  });

  it("alış tutarı 100 milyon ve üzerini reddeder; harfli tutar geçersizdir", () => {
    expect(buildSkuPayload({ ...baseForm, unit_cost: "100000000" }).errors.unit_cost).toBe("Tutar çok büyük.");
    expect(buildSkuPayload({ ...baseForm, sale_price: "abc" }).errors.sale_price).toBe("Geçerli bir tutar girin.");
  });

  it("adet bazlı üründe kesirli paket boyutunu reddeder, bileşende kabul eder", () => {
    expect(buildSkuPayload({ ...baseForm, package_size: "2,5" }).errors.package_size).toBe(
      "Adet bazlı üründe paket boyutu tam sayı olmalı."
    );
    const ing = buildSkuPayload({ ...baseForm, kind: "ingredient", base_unit: "gram", package_size: "2,5", sale_price: "99" });
    expect(ing.payload).toMatchObject({ base_unit: "gram", package_size: "2.500", sale_price: "0.00" });
  });

  it("satılabilir türde birimi adete zorlar; reçeteli üründe alış fiyatını 0 gönderir", () => {
    expect(buildSkuPayload({ ...baseForm, base_unit: "ml" }).payload?.base_unit).toBe("piece");
    expect(buildSkuPayload({ ...baseForm, kind: "composite", unit_cost: "abc", sale_price: "45" }).payload).toMatchObject({
      unit_cost: "0.00",
      sale_price: "45.00",
    });
  });
});

describe("SkuFormSheet", () => {
  let mock: MockAdapter;
  let alertSpy: jest.SpyInstance;
  const onClose = jest.fn();

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    onClose.mockReset();
    useToastStore.setState({ current: null });
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });
  afterEach(() => {
    mock.restore();
    alertSpy.mockRestore();
  });

  const renderSheet = (sku: ReturnType<typeof normalizeSku> | null = null) =>
    renderWithProviders(<SkuFormSheet visible sku={sku} onClose={onClose} />);

  const fillRequired = async () => {
    await fireEvent.changeText(screen.getByTestId("sku-name"), "Ayran");
    await fireEvent.changeText(screen.getByTestId("sku-code"), "AYR-1");
  };

  describe("yeni ürün", () => {
    it("varsayılanlarla açılır: paket 1, KDV %20, birim Adet ve kilitli, silme yok", async () => {
      await renderSheet();
      expect(screen.getByText("Yeni ürün")).toBeOnTheScreen();
      expect(screen.getByTestId("sku-package-size").props.value).toBe("1");
      expect(screen.getByTestId("sku-vat")).toHaveProp("accessibilityLabel", "KDV oranı: %20");
      expect(screen.getByTestId("sku-kind")).toHaveProp("accessibilityLabel", "Tür: Ürün");
      expect(screen.getByTestId("sku-unit")).toHaveProp("accessibilityLabel", "Birim: Adet");
      expect(screen.getByTestId("sku-unit")).toBeDisabled();
      expect(screen.getByText("Satılabilir ürünlerin birimi Adet'tir.")).toBeOnTheScreen();
      expect(screen.queryByTestId("sku-delete")).toBeNull();
    });

    it("zorunlu alanlar boşken istek atmaz; yazınca alan hatası temizlenir", async () => {
      await renderSheet();
      await fireEvent.press(screen.getByTestId("sku-save"));
      expect(screen.getByText("Ürün adı gerekli.")).toBeOnTheScreen();
      expect(screen.getByText("SKU kodu gerekli.")).toBeOnTheScreen();
      expect(mock.history.post).toHaveLength(0);

      await fireEvent.changeText(screen.getByTestId("sku-name"), "Ayran");
      expect(screen.queryByText("Ürün adı gerekli.")).toBeNull();
      expect(screen.getByText("SKU kodu gerekli.")).toBeOnTheScreen();
    });

    it("kesirli paket boyutu ve geçersiz tutarlar için istek atmaz", async () => {
      await renderSheet();
      await fillRequired();
      await fireEvent.changeText(screen.getByTestId("sku-package-size"), "2,5");
      await fireEvent.changeText(screen.getByTestId("sku-unit-cost"), "abc");
      await fireEvent.changeText(screen.getByTestId("sku-sale-price"), "1.000.000");
      await fireEvent.press(screen.getByTestId("sku-save"));

      expect(screen.getByText("Adet bazlı üründe paket boyutu tam sayı olmalı.")).toBeOnTheScreen();
      expect(screen.getByText("Geçerli bir tutar girin.")).toBeOnTheScreen();
      expect(screen.getByText("Tutar çok büyük.")).toBeOnTheScreen();
      expect(mock.history.post).toHaveLength(0);
    });

    it("bileşende birim seçilebilir, satış kilitlenir; 12,5 paket ve 0,35 alış doğru gövdeyle gider", async () => {
      mock.onPost("/stock/skus/").reply(201, { ...skus[1], id: 60 });
      await renderSheet();
      await fillRequired();
      await fireEvent.changeText(screen.getByTestId("sku-sale-price"), "15");

      await pickOption("sku-kind", /^Bileşen/);
      expect(screen.getByTestId("sku-unit")).not.toBeDisabled();
      expect(screen.getByTestId("sku-sale-price")).toBeDisabled();
      expect(screen.getByTestId("sku-sale-price").props.value).toBe("");
      await pickOption("sku-unit", /^Mililitre/);
      await pickOption("sku-vat", /^%10$/);
      await fireEvent.changeText(screen.getByTestId("sku-package-size"), "12,5");
      await fireEvent.changeText(screen.getByTestId("sku-unit-cost"), "0,35");
      await fireEvent.press(screen.getByTestId("sku-save"));

      await waitFor(() => expect(mock.history.post).toHaveLength(1));
      expect(body(mock.history.post[0].data)).toEqual({
        name: "Ayran",
        sku_code: "AYR-1",
        barcode: null,
        kind: "ingredient",
        base_unit: "ml",
        package_size: "12.500",
        package_label: "",
        unit_cost: "0.35",
        sale_price: "0.00",
        vat_rate: "10.00",
      });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(useToastStore.getState().current?.message).toBe("Ürün oluşturuldu.");
    });

    it("reçeteli üründe alış alanı kilitli ve 0 gönderilir; bileşenden dönünce birim adete döner", async () => {
      mock.onPost("/stock/skus/").reply(201, { ...skus[2], id: 61 });
      await renderSheet();
      await fillRequired();
      await pickOption("sku-kind", /^Bileşen/);
      await pickOption("sku-unit", /^Gram/);
      await fireEvent.changeText(screen.getByTestId("sku-unit-cost"), "12");
      await pickOption("sku-kind", /^Reçeteli Ürün/);

      expect(screen.getByTestId("sku-unit")).toHaveProp("accessibilityLabel", "Birim: Adet");
      expect(screen.getByTestId("sku-unit-cost")).toBeDisabled();
      expect(screen.getByTestId("sku-unit-cost").props.placeholder).toBe("Reçeteden");
      await fireEvent.changeText(screen.getByTestId("sku-sale-price"), "1.234,5");
      await fireEvent.press(screen.getByTestId("sku-save"));

      await waitFor(() => expect(mock.history.post).toHaveLength(1));
      expect(body(mock.history.post[0].data)).toMatchObject({ kind: "composite", base_unit: "piece", unit_cost: "0.00", sale_price: "1234.50" });
    });

    it("sunucu alan hatasını alanın altında ve üst bildirimde gösterir; form açık kalır", async () => {
      mock.onPost("/stock/skus/").reply(400, { sku_code: ['"AYR-1" SKU kodu zaten kayıtlı.'] });
      await renderSheet();
      await fillRequired();
      await fireEvent.press(screen.getByTestId("sku-save"));

      await waitFor(() => expect(screen.getAllByText('"AYR-1" SKU kodu zaten kayıtlı.')).toHaveLength(2));
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId("sku-name").props.value).toBe("Ayran");

      await fireEvent.changeText(screen.getByTestId("sku-code"), "AYR-2");
      expect(screen.getAllByText('"AYR-1" SKU kodu zaten kayıtlı.')).toHaveLength(1); // yalnız üst bildirim kalır
    });

    it("sunucu 500 hatasında genel mesajı gösterir", async () => {
      mock.onPost("/stock/skus/").reply(500, {});
      await renderSheet();
      await fillRequired();
      await fireEvent.press(screen.getByTestId("sku-save"));
      expect(await screen.findByText("Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin.")).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("çift basışta tek POST atar, istek sürerken Kaydet meşgul görünür", async () => {
      const d = deferred([201, { ...skus[0], id: 70 }]);
      mock.onPost("/stock/skus/").reply(() => d.promise);
      await renderSheet();
      await fillRequired();

      const save = screen.getByTestId("sku-save");
      await fireEvent.press(save);
      await fireEvent.press(save);
      await waitFor(() => expect(screen.getByTestId("sku-save")).toBeBusy());
      expect(mock.history.post).toHaveLength(1);

      d.release();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(mock.history.post).toHaveLength(1);
    });
  });

  describe("düzenleme", () => {
    it("mevcut değerleri Türkçe biçimde doldurur ve kayıtlı KDV dökümünü gösterir", async () => {
      await renderSheet(water);
      expect(screen.getByText("Ürünü düzenle")).toBeOnTheScreen();
      expect(screen.getByText("SU-500")).toBeOnTheScreen(); // alt başlık
      expect(screen.getByTestId("sku-name").props.value).toBe("Su 500 ml");
      expect(screen.getByTestId("sku-code").props.value).toBe("SU-500");
      expect(screen.getByTestId("sku-barcode").props.value).toBe("8690001");
      expect(screen.getByTestId("sku-package-size").props.value).toBe("24");
      expect(screen.getByTestId("sku-unit-cost").props.value).toBe("4,50");
      expect(screen.getByTestId("sku-sale-price").props.value).toBe("10,00");
      expect(screen.getByTestId("sku-vat")).toHaveProp("accessibilityLabel", "KDV oranı: %20");
      expect(screen.getByText("Kayıtlı satış: KDV hariç ₺8,33 · KDV ₺1,67")).toBeOnTheScreen();
      expect(screen.getByTestId("sku-delete")).toBeOnTheScreen();
    });

    it("ön tanımlı olmayan KDV oranını seçenek olarak ekler", async () => {
      await renderSheet(normalizeSku({ ...skus[0], vat_rate: "8.00" }));
      expect(screen.getByTestId("sku-vat")).toHaveProp("accessibilityLabel", "KDV oranı: %8");
    });

    it("değişiklik yoksa istek atmadan kapanır", async () => {
      await renderSheet(water);
      await fireEvent.press(screen.getByTestId("sku-save"));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(mock.history.patch).toHaveLength(0);
    });

    it("Türkçe ondalıklı fiyat ve barkod temizliği için yalnız değişen alanları PATCH eder", async () => {
      mock.onPatch("/stock/skus/1/").reply(200, { ...skus[0], sale_price: "12.50", barcode: null });
      await renderSheet(water);
      await fireEvent.changeText(screen.getByTestId("sku-sale-price"), "12,5");
      await fireEvent.changeText(screen.getByTestId("sku-barcode"), "  ");
      await fireEvent.press(screen.getByTestId("sku-save"));

      await waitFor(() => expect(mock.history.patch).toHaveLength(1));
      expect(mock.history.patch[0].url).toBe("/stock/skus/1/");
      expect(body(mock.history.patch[0].data)).toEqual({ sale_price: "12.50", barcode: null });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(useToastStore.getState().current?.message).toBe("Ürün güncellendi.");
    });

    it("silme onayında özet gösterir; sunucu hatasında sayfa açık kalır", async () => {
      mock.onDelete("/stock/skus/1/").reply(400, { detail: "Ürün bir reçetede kullanılıyor." });
      await renderSheet(water);
      await fireEvent.press(screen.getByTestId("sku-delete"));

      expect(screen.getByText("Stok hareket geçmişi olan ürün silinemez. Reçete veya rotada kullanılan ürün de silinemeyebilir.")).toBeOnTheScreen();
      expect(screen.queryByText(/hareket geçmişi de silinir/)).toBeNull();
      expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
      expect(screen.getAllByText("Su 500 ml").length).toBeGreaterThan(0);
      expect(mock.history.delete).toHaveLength(0);

      await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
      expect(await screen.findByText("Ürün bir reçetede kullanılıyor.")).toBeOnTheScreen();
      expect(screen.getByText("İşlem başarısız")).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("hareket geçmişi olan ürünü sunucu reddederse ret mesajını gösterir", async () => {
      mock.onDelete("/stock/skus/1/").reply(400, { detail: "Bu ürünün stok hareket geçmişi var; silinemez. Pasif yapabilirsiniz." });
      await renderSheet(water);
      await fireEvent.press(screen.getByTestId("sku-delete"));
      await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
      expect(await screen.findByText("Bu ürünün stok hareket geçmişi var; silinemez. Pasif yapabilirsiniz.")).toBeOnTheScreen();
      expect(onClose).not.toHaveBeenCalled();
      expect(useToastStore.getState().current).toBeNull();
    });

    it("silmede çift basış tek DELETE atar ve başarıda kapanır", async () => {
      const d = deferred([204, undefined]);
      mock.onDelete("/stock/skus/1/").reply(() => d.promise);
      await renderSheet(water);
      await fireEvent.press(screen.getByTestId("sku-delete"));
      const confirm = screen.getByTestId("confirm-sheet-confirm");
      await fireEvent.press(confirm);
      await fireEvent.press(confirm);
      await waitFor(() => expect(mock.history.delete).toHaveLength(1));

      d.release();
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
      expect(mock.history.delete.map((r) => r.url)).toEqual(["/stock/skus/1/"]);
      expect(useToastStore.getState().current?.message).toBe("Ürün silindi.");
    });
  });

  describe("kaydedilmemiş değişiklik", () => {
    it("değişiklik yokken Vazgeç doğrudan kapatır", async () => {
      await renderSheet(water);
      await fireEvent.press(screen.getByText("Vazgeç"));
      expect(alertSpy).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("değişiklik varken Vazgeç ve arka plan onay ister; 'Çık' ile kapanır", async () => {
      await renderSheet(water);
      await fireEvent.changeText(screen.getByTestId("sku-name"), "Su 1 L");

      await fireEvent.press(screen.getByText("Vazgeç"));
      expect(alertSpy).toHaveBeenCalledWith("Değişiklikler kaydedilmedi", "Çıkarsanız girdiğiniz bilgiler kaybolur.", expect.any(Array));
      expect(onClose).not.toHaveBeenCalled();

      // Arka plan, accessibilityViewIsModal gövdenin kardeşi olduğu için erişilebilirlik ağacında gizli
      await fireEvent.press(screen.getByTestId("sku-form-backdrop", { includeHiddenElements: true }));
      expect(alertSpy).toHaveBeenCalledTimes(2);
      expect(onClose).not.toHaveBeenCalled();

      pressAlertButton(alertSpy, "Çık");
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});

describe("LocationFormSheet", () => {
  let mock: MockAdapter;
  let alertSpy: jest.SpyInstance;
  const onClose = jest.fn();

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    onClose.mockReset();
    useToastStore.setState({ current: null });
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });
  afterEach(() => {
    mock.restore();
    alertSpy.mockRestore();
  });

  const renderSheet = (location: ReturnType<typeof normalizeLocation> | null = null) =>
    renderWithProviders(<LocationFormSheet visible location={location} onClose={onClose} />);

  it("yeni lokasyon varsayılanları: Ana Depo, aktif, silme yok", async () => {
    await renderSheet();
    expect(screen.getByText("Yeni lokasyon")).toBeOnTheScreen();
    expect(screen.getByTestId("location-type")).toHaveProp("accessibilityLabel", "Tip: Ana Depo");
    expect(screen.getByTestId("location-active").props.value).toBe(true);
    expect(screen.queryByTestId("location-delete")).toBeNull();
  });

  it("boş ve 100 karakterden uzun adı reddeder", async () => {
    await renderSheet();
    await fireEvent.changeText(screen.getByTestId("location-name"), "   ");
    await fireEvent.press(screen.getByTestId("location-save"));
    expect(screen.getByText("Lokasyon adı gerekli.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("location-name"), "x".repeat(101));
    expect(screen.queryByText("Lokasyon adı gerekli.")).toBeNull();
    await fireEvent.press(screen.getByTestId("location-save"));
    expect(screen.getByText("En fazla 100 karakter.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("seçilen tip ve pasif durumla doğru gövdeyi POST eder", async () => {
    mock.onPost("/stock/locations/").reply(201, { id: 9, name: "Servis 2", location_type: "vehicle", is_active: false });
    await renderSheet();
    await fireEvent.changeText(screen.getByTestId("location-name"), " Servis 2 ");
    await pickOption("location-type", /^Araç$/);
    expect(screen.getByTestId("location-type")).toHaveProp("accessibilityLabel", "Tip: Araç");
    await fireEvent(screen.getByTestId("location-active"), "valueChange", false);
    await fireEvent.press(screen.getByTestId("location-save"));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(mock.history.post[0].url).toBe("/stock/locations/");
    expect(body(mock.history.post[0].data)).toEqual({ name: "Servis 2", location_type: "vehicle", is_active: false });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(useToastStore.getState().current?.message).toBe("Lokasyon oluşturuldu.");
  });

  it("çift basışta tek POST atar", async () => {
    const d = deferred([201, { id: 9, name: "Depo B", location_type: "warehouse", is_active: true }]);
    mock.onPost("/stock/locations/").reply(() => d.promise);
    await renderSheet();
    await fireEvent.changeText(screen.getByTestId("location-name"), "Depo B");
    const save = screen.getByTestId("location-save");
    await fireEvent.press(save);
    await fireEvent.press(save);
    await waitFor(() => expect(screen.getByTestId("location-save")).toBeBusy());
    expect(mock.history.post).toHaveLength(1);
    d.release();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mock.history.post).toHaveLength(1);
  });

  it("sunucu alan hatasını gösterir, form açık kalır", async () => {
    mock.onPost("/stock/locations/").reply(400, { name: ["Bu alan boş bırakılamaz."] });
    await renderSheet();
    await fireEvent.changeText(screen.getByTestId("location-name"), "Depo");
    await fireEvent.press(screen.getByTestId("location-save"));
    await waitFor(() => expect(screen.getAllByText("Bu alan boş bırakılamaz.")).toHaveLength(2));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("düzenlemede mevcut değerlerle açılır ve PATCH eder", async () => {
    mock.onPatch("/stock/locations/3/").reply(200, { ...locations[2], name: "Servis Aracı 2" });
    await renderSheet(vehicle);
    expect(screen.getByText("Lokasyonu düzenle")).toBeOnTheScreen();
    expect(screen.getByTestId("location-name").props.value).toBe("Servis Aracı");
    expect(screen.getByTestId("location-type")).toHaveProp("accessibilityLabel", "Tip: Araç");

    await fireEvent.changeText(screen.getByTestId("location-name"), "Servis Aracı 2");
    await fireEvent.press(screen.getByTestId("location-save"));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(mock.history.patch[0].url).toBe("/stock/locations/3/");
    expect(body(mock.history.patch[0].data)).toEqual({ name: "Servis Aracı 2", location_type: "vehicle", is_active: true });
    await waitFor(() => expect(useToastStore.getState().current?.message).toBe("Lokasyon güncellendi."));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("silme onayı özet gösterir; hata sonrası tekrar deneyince DELETE edip kapanır", async () => {
    mock.onDelete("/stock/locations/3/").replyOnce(400, { detail: "Rotada kullanılan lokasyon silinemez." });
    mock.onDelete("/stock/locations/3/").reply(204);
    await renderSheet(vehicle);
    await fireEvent.press(screen.getByTestId("location-delete"));
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    expect(screen.getByText("Tip")).toBeOnTheScreen();
    expect(mock.history.delete).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("Rotada kullanılan lokasyon silinemez.")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mock.history.delete.map((r) => r.url)).toEqual(["/stock/locations/3/", "/stock/locations/3/"]);
    expect(useToastStore.getState().current?.message).toBe("Lokasyon silindi.");
  });

  it("silme uyarısı bakiyeli/hareketli lokasyonun silinemeyeceğini söyler; sunucu reddi (409) gösterilir", async () => {
    mock.onDelete("/stock/locations/3/").reply(409, { detail: "Bu lokasyonda stok bakiyesi var; silinemez. Pasif yapabilirsiniz." });
    await renderSheet(vehicle);
    await fireEvent.press(screen.getByTestId("location-delete"));
    expect(
      screen.getByText("Stok bakiyesi veya hareket geçmişi olan lokasyon silinemez; bunun yerine pasif yapabilirsiniz. Rotada kullanılan lokasyon da silinemeyebilir.")
    ).toBeOnTheScreen();
    expect(screen.queryByText(/bakiyeleri silinir/)).toBeNull();

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("Bu lokasyonda stok bakiyesi var; silinemez. Pasif yapabilirsiniz.")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    expect(useToastStore.getState().current).toBeNull();
  });

  it("değişiklik yoksa Vazgeç doğrudan kapatır; varsa onay ister", async () => {
    await renderSheet(vehicle);
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent(screen.getByTestId("location-active"), "valueChange", false);
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    pressAlertButton(alertSpy, "Düzenlemeye devam et");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
