import React, { useState } from "react";
import { Alert, Text, TextInput } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AppSheet, useFormDirty, useGuardedClose } from "@/design-system";
import { useOnOpen } from "@/components/devices/useOnOpen";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

/** Açılışta değerini render sırasında sıfırlayan tipik bir form sayfası */
function DemoSheet({ visible, initial, onClose }: { visible: boolean; initial: string; onClose: () => void }) {
  const [name, setName] = useState("eski-değer");
  useOnOpen(visible, () => setName(initial));
  const dirty = useFormDirty(visible, { name });
  const guardedClose = useGuardedClose(dirty, onClose);
  return (
    <AppSheet visible={visible} onClose={onClose} dirty={dirty} title="Form" testID="demo">
      <TextInput testID="name" value={name} onChangeText={setName} />
      <Text testID="dirty">{dirty ? "kirli" : "temiz"}</Text>
      <Text testID="cancel" onPress={guardedClose}>
        Vazgeç
      </Text>
    </AppSheet>
  );
}

describe("kaydedilmemiş değişiklik koruması", () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });
  afterEach(() => alertSpy.mockRestore());

  it("açılışta formun kendi sıfırlaması 'değişiklik' sayılmaz", async () => {
    const onClose = jest.fn();
    const { rerender } = await render(<DemoSheet visible={false} initial="Ayşe" onClose={onClose} />);
    await rerender(<DemoSheet visible initial="Ayşe" onClose={onClose} />);
    expect(screen.getByTestId("name").props.value).toBe("Ayşe");
    expect(screen.getByTestId("dirty")).toHaveTextContent("temiz");

    // Değişiklik yoksa Vazgeç doğrudan kapatır
    await fireEvent.press(screen.getByTestId("cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("değişiklik varken Vazgeç onay ister; 'Çık' seçilince kapanır", async () => {
    const onClose = jest.fn();
    await render(<DemoSheet visible initial="Ayşe" onClose={onClose} />);
    await fireEvent.changeText(screen.getByTestId("name"), "Ayşe Yılmaz");
    expect(screen.getByTestId("dirty")).toHaveTextContent("kirli");

    await fireEvent.press(screen.getByTestId("cancel"));
    expect(onClose).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith("Değişiklikler kaydedilmedi", expect.any(String), expect.any(Array));

    const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Çık")?.onPress?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("değeri eski haline getirince yeniden temiz sayılır", async () => {
    const onClose = jest.fn();
    const { rerender } = await render(<DemoSheet visible={false} initial="Ayşe" onClose={onClose} />);
    await rerender(<DemoSheet visible initial="Ayşe" onClose={onClose} />);
    await fireEvent.changeText(screen.getByTestId("name"), "X");
    expect(screen.getByTestId("dirty")).toHaveTextContent("kirli");
    await fireEvent.changeText(screen.getByTestId("name"), "Ayşe");
    expect(screen.getByTestId("dirty")).toHaveTextContent("temiz");
  });

  it("arka plana dokunmak da (sayfanın kendi kapatması) onaya bağlıdır", async () => {
    const onClose = jest.fn();
    await render(<DemoSheet visible initial="Ayşe" onClose={onClose} />);
    await fireEvent.changeText(screen.getByTestId("name"), "Başka");
    await fireEvent.press(screen.getByTestId("demo-backdrop", { includeHiddenElements: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
