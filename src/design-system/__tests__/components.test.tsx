import React, { useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import {
  AppBadge,
  AppButton,
  AppCheckbox,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppInput,
  AppKpi,
  AppSegmented,
  AppSelect,
  AppToastHost,
  getTheme,
  resolveScheme,
  toast,
  useThemePreference,
} from "@/design-system";
import { lightColors, darkColors } from "@/design-system/tokens/colors";

describe("AppButton", () => {
  it("basınca onPress çağırır", async () => {
    const onPress = jest.fn();
    await render(<AppButton title="Kaydet" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Kaydet" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("disabled iken basılamaz", async () => {
    const onPress = jest.fn();
    await render(<AppButton title="Kaydet" onPress={onPress} disabled />);
    const btn = screen.getByRole("button", { name: "Kaydet" });
    expect(btn).toBeDisabled();
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("loading iken kilitlenir ve meşgul durumu bildirir (çift gönderim engeli)", async () => {
    const onPress = jest.fn();
    await render(<AppButton title="Gönder" onPress={onPress} loading testID="b" />);
    const btn = screen.getByTestId("b");
    expect(btn).toBeDisabled();
    expect(btn).toBeBusy();
    await fireEvent.press(btn);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("AppIconButton", () => {
  it("erişilebilir etiket ve rozet sayısını bildirir", async () => {
    await render(<AppIconButton icon="bell" label="Bildirimler" badge={120} onPress={jest.fn()} />);
    expect(screen.getByLabelText("Bildirimler, 99+ okunmamış")).toBeOnTheScreen();
    expect(screen.getByText("99+")).toBeOnTheScreen();
  });
});

describe("AppInput", () => {
  it("hata mesajını gösterir", async () => {
    await render(<AppInput label="E-posta" value="" onChangeText={jest.fn()} error="Geçersiz e-posta" />);
    expect(screen.getByText("Geçersiz e-posta")).toBeOnTheScreen();
  });

  it("secure alanda göster/gizle", async () => {
    await render(<AppInput label="Şifre" value="x" onChangeText={jest.fn()} secure testID="pw" />);
    expect(screen.getByTestId("pw")).toHaveProp("secureTextEntry", true);
    await fireEvent.press(screen.getByLabelText("Şifreyi göster"));
    expect(screen.getByTestId("pw")).toHaveProp("secureTextEntry", false);
  });

  it("disabled iken düzenlenemez", async () => {
    await render(<AppInput label="Ad" value="x" onChangeText={jest.fn()} disabled testID="ad" />);
    expect(screen.getByTestId("ad")).toHaveProp("editable", false);
  });
});

describe("AppSelect", () => {
  const options = [
    { value: 1, label: "Depo" },
    { value: 2, label: "Araç" },
    { value: 3, label: "Otomat", disabled: true },
  ];

  it("tekli seçimde değeri bildirir ve sayfayı kapatır", async () => {
    const onChange = jest.fn();
    await render(<AppSelect label="Lokasyon" options={options} value={null} onChange={onChange} testID="sel" />);
    await fireEvent.press(screen.getByTestId("sel"));
    await fireEvent.press(screen.getByText("Araç"));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("devre dışı seçenek seçilemez", async () => {
    const onChange = jest.fn();
    await render(<AppSelect label="Lokasyon" options={options} value={null} onChange={onChange} testID="sel" />);
    await fireEvent.press(screen.getByTestId("sel"));
    await fireEvent.press(screen.getByText("Otomat"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("çoklu seçimde yalnızca Uygula ile değer bildirir", async () => {
    const onChange = jest.fn();
    await render(
      <AppSelect multiple label="Cihazlar" options={options} value={[]} onChange={onChange} testID="ms" />
    );
    await fireEvent.press(screen.getByTestId("ms"));
    await fireEvent.press(screen.getByText("Depo"));
    await fireEvent.press(screen.getByText("Araç"));
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText("Uygula (2)"));
    expect(onChange).toHaveBeenCalledWith([1, 2]);
  });

  it("Türkçe karakter duyarsız arama", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ value: i, label: i === 7 ? "Çay Makinesi" : `Cihaz ${i}` }));
    await render(<AppSelect label="Cihaz" options={many} value={null} onChange={jest.fn()} testID="s" />);
    await fireEvent.press(screen.getByTestId("s"));
    await fireEvent.changeText(screen.getByLabelText("Ara"), "cay");
    expect(screen.getByText("Çay Makinesi")).toBeOnTheScreen();
    expect(screen.queryByText("Cihaz 1")).toBeNull();
  });
});

describe("AppCheckbox / AppSegmented", () => {
  it("checkbox durumunu değiştirir", async () => {
    function Wrapper() {
      const [v, setV] = useState(false);
      return <AppCheckbox checked={v} onChange={setV} label="Wildcard" />;
    }
    await render(<Wrapper />);
    const cb = screen.getByRole("checkbox", { name: "Wildcard" });
    expect(cb).not.toBeChecked();
    await fireEvent.press(cb);
    expect(screen.getByRole("checkbox", { name: "Wildcard" })).toBeChecked();
  });

  it("segmented seçili sekmeyi bildirir", async () => {
    const onChange = jest.fn();
    await render(
      <AppSegmented
        items={[
          { key: "a", label: "Aktif", count: 3 },
          { key: "p", label: "Bekleyen" },
        ]}
        value="a"
        onChange={onChange}
      />
    );
    expect(screen.getByRole("tab", { name: "Aktif (3)" })).toBeSelected();
    await fireEvent.press(screen.getByText("Bekleyen"));
    expect(onChange).toHaveBeenCalledWith("p");
  });
});

describe("AppConfirmSheet", () => {
  it("özeti, geri alınamaz uyarısını ve hatayı gösterir; onaylar", async () => {
    const onConfirm = jest.fn();
    await render(
      <AppConfirmSheet
        visible
        title="Toplu bakiye yükle"
        summary={[
          { label: "Kart sayısı", value: "12" },
          { label: "Tutar", value: "₺50,00" },
        ]}
        irreversible
        error="Yetersiz yetki"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
        confirmLabel="Yükle"
      />
    );
    expect(screen.getByText("Kart sayısı")).toBeOnTheScreen();
    expect(screen.getByText("₺50,00")).toBeOnTheScreen();
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    expect(screen.getByText("Yetersiz yetki")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("işlem sürerken iptal ve onay kilitlenir", async () => {
    await render(<AppConfirmSheet visible title="Sil" loading onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByTestId("confirm-sheet-confirm")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Vazgeç" })).toBeDisabled();
  });
});

describe("durum bileşenleri", () => {
  it("boş durum aksiyonu çalışır", async () => {
    const onAction = jest.fn();
    await render(<AppEmptyState title="Cihaz yok" description="Filtreyi temizleyin" actionLabel="Temizle" onAction={onAction} />);
    await fireEvent.press(screen.getByText("Temizle"));
    expect(onAction).toHaveBeenCalled();
  });

  it("hata durumunda tekrar dene", async () => {
    const onRetry = jest.fn();
    await render(<AppErrorState message="Sunucuya ulaşılamadı" onRetry={onRetry} />);
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("rozet metinle bilgi taşır (yalnız renk değil)", async () => {
    await render(<AppBadge label="Çevrimdışı" tone="danger" dot />);
    expect(screen.getByLabelText("Çevrimdışı")).toBeOnTheScreen();
  });

  it("KPI erişilebilir özet ve delta", async () => {
    await render(<AppKpi label="Ciro" value="₺1.200,00" caption="12 işlem" delta={-12.5} />);
    expect(screen.getByLabelText("Ciro: ₺1.200,00, 12 işlem")).toBeOnTheScreen();
    expect(screen.getByText("▼ %12,5")).toBeOnTheScreen();
  });
});

describe("toast", () => {
  it("mesajı gösterir ve süre sonunda kapanır", async () => {
    jest.useFakeTimers();
    await render(<AppToastHost />);
    await act(async () => {
      toast.success("Kaydedildi");
    });
    expect(screen.getByText("Kaydedildi")).toBeOnTheScreen();
    await act(async () => {
      jest.advanceTimersByTime(3100);
    });
    expect(screen.queryByText("Kaydedildi")).toBeNull();
    jest.useRealTimers();
  });
});

describe("tema", () => {
  it("tercih sistem temasını izler veya zorlar", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", null)).toBe("light");
    expect(resolveScheme("light", "dark")).toBe("light");
    expect(resolveScheme("dark", "light")).toBe("dark");
  });

  it("açık ve koyu temada aynı semantik token kümesi var", () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(darkColors).sort());
    expect(getTheme("dark").colors.background).toBe(darkColors.background);
  });

  it("tercih kaydedilir", async () => {
    useThemePreference.getState().setPreference("dark");
    expect(useThemePreference.getState().preference).toBe("dark");
    useThemePreference.getState().setPreference("system");
  });
});

/** WCAG kontrast oranı (göreli parlaklık) */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("kontrast (WCAG AA)", () => {
  it.each([
    ["light", lightColors],
    ["dark", darkColors],
  ] as const)("%s: metin tonları yüzeylerde ≥ 4.5:1", (_, c) => {
    for (const fg of [c.text, c.textSecondary, c.textTertiary]) {
      for (const bg of [c.surface, c.background]) {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it.each([
    ["light", lightColors],
    ["dark", darkColors],
  ] as const)("%s: durum renkleri kendi zemininde ≥ 4.5:1", (_, c) => {
    expect(contrast(c.success, c.successSubtle)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.warning, c.warningSubtle)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.danger, c.dangerSubtle)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.primary, c.primarySubtle)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
