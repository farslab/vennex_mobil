/**
 * TemplateFormSheet — yeni şablon / düzenleme. Templates.test.tsx yalnız "yeni şablon POST machine_type=1"
 * akışını kapsar; burada doğrulama, düzenleme (PATCH), tip kilidi, sunucu hataları, kaydedilmemiş
 * değişiklik onayı ve çift gönderim kapsanır.
 */
import React from "react";
import { Alert } from "react-native";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { DISCARD_MESSAGE, DISCARD_TITLE, useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import { TemplateFormSheet } from "@/screens/devices/templates/TemplateFormSheet";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

type Reply = [number, unknown];
type FormProps = React.ComponentProps<typeof TemplateFormSheet>;
type Tpl = NonNullable<FormProps["template"]>;

const assignedTpl: Tpl = { id: 1, name: "Ofis Snack", description: "Kat dizilimi", machine_type: 0, assigned_device_count: 4 };
const freeTpl: Tpl = { id: 2, name: "Kahve Menüsü", description: null, machine_type: 1, assigned_device_count: 0 };

function deferred() {
  let release: (r: Reply) => void = () => {};
  const promise = new Promise<Reply>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** Gerçek kullanım gibi: kapalı bağlanır, sonra açılır (useOnOpen alanları o anda doldurur) */
async function openSheet(template: Tpl | null, over: Partial<FormProps> = {}) {
  const props: FormProps = { visible: false, template, onClose: jest.fn(), onSaved: jest.fn(), ...over };
  const utils = await renderWithProviders(<TemplateFormSheet {...props} />);
  await utils.rerender(<TemplateFormSheet {...props} visible />);
  return {
    ...utils,
    props,
    close: () => utils.rerender(<TemplateFormSheet {...props} visible={false} />),
    reopen: () => utils.rerender(<TemplateFormSheet {...props} visible />),
  };
}

const selectedType = () => within(screen.getByTestId("template-machine-type")).getByRole("tab", { selected: true });
const toastMessage = () => useToastStore.getState().current?.message;

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  useToastStore.setState({ current: null });
});
afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe("TemplateFormSheet", () => {
  it("yeni: boş, yalnız boşluk ve 100 karakteri aşan ad gönderilmez; hata alanın altında", async () => {
    await openSheet(null);
    expect(screen.getByText("Yeni şablon")).toBeOnTheScreen();
    expect(screen.getByText("Oluştur")).toBeOnTheScreen();
    expect(selectedType()).toHaveTextContent("Snack");

    await fireEvent.press(screen.getByTestId("template-form-submit"));
    expect(await screen.findByText("Şablon adı zorunlu.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("template-name"), "    ");
    await fireEvent.press(screen.getByTestId("template-form-submit"));
    expect(screen.getByText("Şablon adı zorunlu.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("template-name"), "a".repeat(101));
    await fireEvent.press(screen.getByTestId("template-form-submit"));
    expect(await screen.findByText("En fazla 100 karakter.")).toBeOnTheScreen();

    expect(mock.history.post).toHaveLength(0);
  });

  it("yeni: ad ve açıklama kırpılır, boş açıklama null gider; başarıda toast, onSaved normalize detayla, onClose", async () => {
    mock.onPost("/product-templates/").reply(201, { id: 9, name: "Ofis", description: null, machine_type: 0, items: [], assigned_devices: [] });
    const { props } = await openSheet(null);

    await fireEvent.changeText(screen.getByTestId("template-name"), "  Ofis  ");
    // açıklama alanı (testID yok): ad dolunca boş değerli tek girdi
    await fireEvent.changeText(screen.getByDisplayValue(""), "   ");
    await fireEvent.press(screen.getByTestId("template-form-submit"));

    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: "Ofis", description: null, machine_type: 0 });
    expect(props.onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 9, name: "Ofis", machine_type: 0, items: [], assigned_devices: [] }));
    expect(toastMessage()).toBe("Şablon oluşturuldu.");
  });

  it("düzenle: alanlar mevcut şablonla dolar; cihaza eşli değilse tip dahil PATCH atılır", async () => {
    mock.onPatch("/product-templates/2/").reply(200, { id: 2, name: "Kahve Menüsü 2", description: "Sabah", machine_type: 0, items: [], assigned_devices: [] });
    const { props } = await openSheet(freeTpl);

    expect(screen.getByText("Şablonu düzenle")).toBeOnTheScreen();
    expect(screen.getByText("Kaydet")).toBeOnTheScreen();
    expect(screen.getByTestId("template-name").props.value).toBe("Kahve Menüsü");
    expect(selectedType()).toHaveTextContent("Kahve");
    expect(screen.getByText("Şablon yalnız aynı tipteki (Snack/Kahve) cihazlara atanabilir.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("template-name"), "Kahve Menüsü 2 ");
    await fireEvent.changeText(screen.getByDisplayValue(""), " Sabah ");
    await fireEvent.press(within(screen.getByTestId("template-machine-type")).getByText("Snack"));
    await fireEvent.press(screen.getByTestId("template-form-submit"));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(mock.history.patch[0].url).toBe("/product-templates/2/");
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ name: "Kahve Menüsü 2", description: "Sabah", machine_type: 0 });
    expect(mock.history.post).toHaveLength(0);
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(toastMessage()).toBe("Şablon güncellendi.");
  });

  it("düzenle: cihazlara eşliyse tip değiştirilemez, uyarı gösterilir ve PATCH machine_type içermez", async () => {
    mock.onPatch("/product-templates/1/").reply(200, { id: 1, name: "Ofis Snack v2", description: "Kat dizilimi", machine_type: 0 });
    await openSheet(assignedTpl);

    expect(screen.getByText("Şablon cihazlara eşli olduğu için makine tipi değiştirilemez.")).toBeOnTheScreen();
    await fireEvent.press(within(screen.getByTestId("template-machine-type")).getByText("Kahve"));
    expect(selectedType()).toHaveTextContent("Snack");

    await fireEvent.changeText(screen.getByTestId("template-name"), "Ofis Snack v2");
    await fireEvent.press(screen.getByTestId("template-form-submit"));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ name: "Ofis Snack v2", description: "Kat dizilimi" });
  });

  it("sunucu alan hataları ilgili alanın altında, genel bildirim tekrarlanmadan gösterilir; sayfa kapanmaz", async () => {
    mock.onPatch("/product-templates/2/").reply(400, { name: ["Bu alan boş bırakılamaz."], machine_type: ["0 veya 1 olmalı."] });
    const { props } = await openSheet(freeTpl);

    await fireEvent.press(screen.getByTestId("template-form-submit"));

    expect(await screen.findByText("0 veya 1 olmalı.")).toBeOnTheScreen();
    expect(screen.getAllByText("Bu alan boş bırakılamaz.")).toHaveLength(1);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it("alan dışı 400 (detail) bildirim olarak gösterilir", async () => {
    mock.onPatch("/product-templates/1/").reply(400, { detail: "Şablon cihazlara eşli; makine tipi değiştirilemez." });
    const { props } = await openSheet(assignedTpl);

    await fireEvent.press(screen.getByTestId("template-form-submit"));

    expect(await screen.findByText("Şablon cihazlara eşli; makine tipi değiştirilemez.")).toBeOnTheScreen();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  // OLASI HATA (TemplateFormSheet.tsx:53-54, :81): gösterilmeyen bir alan için gelen hata (ör. DRF
  // nesne düzeyi doğrulaması `non_field_errors`) fieldErrors'a girer → genel bildirim bastırılır, ama
  // bu anahtar formda hiçbir yerde çizilmez: kullanıcı kayıt başarısız olduğu halde hiçbir mesaj görmez.
  it("formda karşılığı olmayan alan hatası (non_field_errors) kullanıcıya gösterilmeli", async () => {
    mock.onPost("/product-templates/").reply(400, { non_field_errors: ["Bu adla bir şablon zaten var."] });
    await openSheet(null);

    await fireEvent.changeText(screen.getByTestId("template-name"), "Ofis");
    await fireEvent.press(screen.getByTestId("template-form-submit"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));

    expect(await screen.findByText("Bu adla bir şablon zaten var.")).toBeOnTheScreen();
  });

  it("değişiklik yoksa Vazgeç doğrudan kapatır; değişiklik varsa onay ister ve 'Çık' ile kapanır", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { props } = await openSheet(freeTpl);

    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId("template-name"), "Değişti");
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe(DISCARD_TITLE);
    expect(alert.mock.calls[0][1]).toBe(DISCARD_MESSAGE);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    // başlıktaki X de aynı korumayı kullanır
    await fireEvent.press(screen.getAllByLabelText("Kapat")[0]);
    expect(alert).toHaveBeenCalledTimes(2);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    const exit = alert.mock.calls[0][2]?.find((b) => b.text === "Çık");
    exit?.onPress?.();
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it("geri alınan değişiklik kaydedilmemiş sayılmaz", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { props } = await openSheet(freeTpl);

    await fireEvent.changeText(screen.getByTestId("template-name"), "Geçici");
    await fireEvent.changeText(screen.getByTestId("template-name"), "Kahve Menüsü");
    await fireEvent.press(screen.getByText("Vazgeç"));

    expect(alert).not.toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("kaydederken buton kilitlenir, sayfa kapatılamaz; tekrar basış ikinci istek atmaz", async () => {
    const d = deferred();
    mock.onPost("/product-templates/").reply(() => d.promise);
    const { props } = await openSheet(null);

    await fireEvent.changeText(screen.getByTestId("template-name"), "Yeni");
    await fireEvent.press(screen.getByTestId("template-form-submit"));
    await waitFor(() => expect(screen.getByTestId("template-form-submit")).toBeDisabled());
    expect(screen.getByText("Vazgeç")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("template-form-submit"));
    await fireEvent.press(screen.getAllByLabelText("Kapat")[0]);
    expect(mock.history.post).toHaveLength(1);
    expect(props.onClose).not.toHaveBeenCalled();

    d.release([201, { id: 3, name: "Yeni", machine_type: 0 }]);
    await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
    expect(mock.history.post).toHaveLength(1);
  });

  // React Query bildirim tiki (setTimeout 0) çalışmadan gelen ikinci dokunuş: submit içindeki
  // setErrors({}) yeniden çizimi tetiklediği için buton aynı turda kilitlenir (CashTab ve
  // DeviceOrderSheet aynı koruma için useSingleFlight kullanır). Bu davranış korunmalı.
  it("oluştur: yeniden çizim beklenmeden gelen art arda iki dokunuş tek şablon oluşturur", async () => {
    const d = deferred();
    mock.onPost("/product-templates/").reply(() => d.promise);
    const { props } = await openSheet(null);
    await fireEvent.changeText(screen.getByTestId("template-name"), "Yeni");
    const submit = screen.getByTestId("template-form-submit");

    jest.useFakeTimers();
    try {
      await fireEvent.press(submit);
      await fireEvent.press(submit);
      d.release([201, { id: 3, name: "Yeni", machine_type: 0 }]);
      await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    } finally {
      jest.useRealTimers();
    }
    expect(mock.history.post).toHaveLength(1);
  });

  it("yeniden açılınca önceki girdi ve doğrulama hatası sıfırlanır", async () => {
    const { close, reopen } = await openSheet(freeTpl);

    await fireEvent.changeText(screen.getByTestId("template-name"), "");
    await fireEvent.press(screen.getByTestId("template-form-submit"));
    expect(await screen.findByText("Şablon adı zorunlu.")).toBeOnTheScreen();

    await close();
    await reopen();

    expect(screen.getByTestId("template-name").props.value).toBe("Kahve Menüsü");
    expect(screen.queryByText("Şablon adı zorunlu.")).toBeNull();
    expect(selectedType()).toHaveTextContent("Kahve");
  });
});
