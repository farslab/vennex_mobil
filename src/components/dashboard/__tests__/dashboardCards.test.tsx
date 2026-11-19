import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { PaymentBreakdownCard, FailureReasonsCard, paymentShare } from "@/components/dashboard/BreakdownCards";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { webBadgeColors } from "@/components/devices/webBadgeColors";
import type { DashboardData, PaymentBreakdownItem } from "@/types/overview";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const items: PaymentBreakdownItem[] = [
  { pt_type: 5, label: "Personel Kart", color: "#999", amount: 2000, count: 20 },
  { pt_type: 1, label: "Kredi Kartı", color: "#1E88E5", amount: 1000, count: 10 },
  { pt_type: 0, label: "Nakit", color: "gray", amount: 0, count: 0 },
];

const bg = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).backgroundColor;

describe("PaymentBreakdownCard", () => {
  it("web başlığı, tam sayı yüzde; tutarı 0 olan tip listelenmez", async () => {
    await render(<PaymentBreakdownCard items={items} />);
    expect(screen.getByText("Ödeme Türüne Göre")).toBeOnTheScreen();
    expect(screen.getByText("20 işlem")).toBeOnTheScreen();
    expect(screen.getByText("%67")).toBeOnTheScreen(); // 2000/3000 → round(66,67)
    expect(screen.getByText("%33")).toBeOnTheScreen();
    expect(screen.queryByText("Nakit")).toBeNull();
  });

  it("renk satır sırasına değil ödeme tipine bağlıdır (işlem rozetleriyle aynı)", async () => {
    const { rerender } = await render(<PaymentBreakdownCard items={items} />);
    const cardColor = bg("payment-swatch-1");
    expect(cardColor).toBe(webBadgeColors("blue", false).fg);
    // Sıra değişse de aynı renk
    await rerender(<PaymentBreakdownCard items={[items[1], items[0]]} />);
    expect(bg("payment-swatch-1")).toBe(cardColor);
    expect(bg("payment-swatch-5")).toBe(webBadgeColors("emerald", false).fg);
  });

  it("Personel Kart satırı yalnız onPersonelPress verilince bağlantıdır", async () => {
    const { rerender } = await render(<PaymentBreakdownCard items={items} />);
    expect(screen.queryByTestId("payment-personel")).toBeNull();
    const onPress = jest.fn();
    await rerender(<PaymentBreakdownCard items={items} onPersonelPress={onPress} />);
    await fireEvent.press(screen.getByTestId("payment-personel"));
    expect(onPress).toHaveBeenCalled();
  });

  it("paymentShare web pct_of gibi yuvarlar", () => {
    expect(paymentShare(1, 3)).toBe(33);
    expect(paymentShare(2, 3)).toBe(67);
    expect(paymentShare(5, 0)).toBe(0);
  });
});

describe("FailureReasonsCard", () => {
  it("teknik neden web gibi 'Teknik iptal' adıyla gösterilir", async () => {
    await render(<FailureReasonsCard failures={{ timeout: 1, bank: 0, technical: 2, other: 0 }} failed={3} onTechnicalPress={jest.fn()} />);
    expect(screen.getByText("Teknik iptal")).toBeOnTheScreen();
  });
});

describe("KpiGrid", () => {
  it("web etiketleri ve önceki dönem cirosu tam tutar", async () => {
    const data = {
      devices: { total: 3, online: 2, offline: 1 },
      sales: {
        revenue: 123456.78,
        previousRevenue: 98765.43,
        changePct: 25,
        comparisonLabel: "Dün",
        transactions: { total: 10, success: 9, failed: 1 },
        timeseries: { mode: "hourly", points: [{ label: "09:00", amount: 100 }, { label: "10:00", amount: 0 }] },
      },
      periodLabel: "Bugün",
    } as unknown as DashboardData;
    await render(<KpiGrid data={data} salesAllowed onDevicesPress={jest.fn()} />);
    expect(screen.getByText("POS Cihazları")).toBeOnTheScreen();
    expect(screen.getByText("Toplam Ciro")).toBeOnTheScreen();
    expect(screen.getByText("Toplam İşlem")).toBeOnTheScreen();
    expect(screen.getByText("Başarısız")).toBeOnTheScreen();
    expect(screen.getByText("Dün: ₺98.765,43")).toBeOnTheScreen();
    // Satış grafiği ciro kartının içinde
    expect(screen.getByTestId("revenue-chart")).toBeOnTheScreen();
  });

  it("dönemde satış yoksa grafik yerine bilgi", async () => {
    const data = {
      devices: { total: 1, online: 1, offline: 0 },
      sales: {
        revenue: 0,
        previousRevenue: null,
        changePct: null,
        transactions: { total: 0, success: 0, failed: 0 },
        timeseries: { mode: "daily", points: [{ label: "18.11", amount: 0 }] },
      },
    } as unknown as DashboardData;
    await render(<KpiGrid data={data} salesAllowed onDevicesPress={jest.fn()} />);
    expect(screen.getByText("Bu dönemde satış yok")).toBeOnTheScreen();
  });
});

describe("Ciro kartı grafiği", () => {
  it("çubuğa dokununca dilim tutarı görünür, tekrar dokununca kalkar", async () => {
    const data = {
      devices: { total: 1, online: 1, offline: 0 },
      sales: {
        revenue: 350,
        previousRevenue: null,
        changePct: null,
        transactions: { total: 3, success: 3, failed: 0 },
        timeseries: { mode: "daily", points: [{ label: "16.11", amount: 100 }, { label: "17.11", amount: 250 }] },
      },
    } as unknown as DashboardData;
    await render(<KpiGrid data={data} salesAllowed onDevicesPress={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("revenue-bar-1"));
    expect(screen.getByTestId("revenue-chart-readout")).toHaveTextContent(/17\.11.*₺250,00/);
    await fireEvent.press(screen.getByTestId("revenue-bar-1"));
    expect(screen.getByTestId("revenue-chart-readout")).not.toHaveTextContent(/₺/);
  });
});

describe("Ciro kartı grafiği — seçim", () => {
  it("kartın başka yerine dokununca seçim kalkar", async () => {
    const data = {
      devices: { total: 1, online: 1, offline: 0 },
      sales: {
        revenue: 350,
        previousRevenue: null,
        changePct: null,
        transactions: { total: 3, success: 3, failed: 0 },
        timeseries: { mode: "daily", points: [{ label: "16.11", amount: 100 }, { label: "17.11", amount: 250 }] },
      },
    } as unknown as DashboardData;
    await render(<KpiGrid data={data} salesAllowed onDevicesPress={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("revenue-bar-0"));
    expect(screen.getByTestId("revenue-chart-readout")).toHaveTextContent(/₺100,00/);
    await fireEvent.press(screen.getByTestId("revenue-hero"));
    expect(screen.getByTestId("revenue-chart-readout")).not.toHaveTextContent(/₺/);
  });
});
