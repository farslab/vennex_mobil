import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RemoteSaleSheet } from "@/screens/devices/detail/components/RemoteSaleSheet";
import type { ChannelState, VendEvent } from "@/realtime/posVendChannel";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

// Kanalı sahteleyip olayları testten tetikle
const mockApprove = jest.fn(() => true);
const mockClose = jest.fn();
let emit: (e: VendEvent) => void = () => {};
let setState: (s: ChannelState) => void = () => {};
jest.mock("@/realtime/posVendChannel", () => {
  const actual = jest.requireActual("@/realtime/posVendChannel");
  return {
    ...actual,
    PosVendChannel: jest.fn().mockImplementation((_sn: string, opts: { onEvent: typeof emit; onState: typeof setState }) => {
      emit = opts.onEvent;
      setState = opts.onState;
      return { connect: jest.fn(async () => opts.onState("open")), approve: mockApprove, close: mockClose };
    }),
  };
});

describe("RemoteSaleSheet", () => {
  beforeEach(() => {
    mockApprove.mockClear();
    mockClose.mockClear();
  });

  it("bekleme → ürün seçildi (kuruş → ₺) → onay → sonuç", async () => {
    await render(<RemoteSaleSheet visible onClose={jest.fn()} sn="PAV1" deviceName="Otomat 1" />);
    expect(screen.getByText(/ürün seçmesi bekleniyor/)).toBeOnTheScreen();
    expect(screen.getByText("Bağlı")).toBeOnTheScreen();

    await act(async () => emit({ type: "vend_pending", tx_id: "t1", amount: 1250, item: 7 }));
    expect(screen.getByTestId("remote-sale-amount")).toHaveTextContent(/12,50/);
    expect(screen.getByText(/Ürün no 7/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("remote-sale-approve"));
    expect(mockApprove).toHaveBeenCalledWith("t1");

    await act(async () => emit({ type: "remote_decision_ack", ok: true, tx_id: "t1" }));
    await act(async () => emit({ type: "vend_ended", tx_id: "t1", result: "success" }));
    expect(screen.getByText("Satış başarılı — ürün verildi.")).toBeOnTheScreen();
  });

  it("aynı istek tekrar gelirse (geç katılım) tek kez gösterir ve onay sürerken çift onay göndermez", async () => {
    await render(<RemoteSaleSheet visible onClose={jest.fn()} sn="PAV1" />);
    await act(async () => emit({ type: "vend_pending", tx_id: "t1", amount: 500, item: 1 }));
    await fireEvent.press(screen.getByTestId("remote-sale-approve"));
    await act(async () => emit({ type: "vend_pending", tx_id: "t1", amount: 500, item: 1 }));
    await fireEvent.press(screen.getByTestId("remote-sale-approve"));
    expect(mockApprove).toHaveBeenCalledTimes(1);
  });

  it("yetki yoksa açıklama gösterir", async () => {
    await render(<RemoteSaleSheet visible onClose={jest.fn()} sn="PAV1" />);
    await act(async () => setState("unauthorized"));
    expect(screen.getByText("Uzaktan satış yetkiniz yok")).toBeOnTheScreen();
  });

  it("kapanınca kanalı kapatır", async () => {
    const { rerender } = await render(<RemoteSaleSheet visible onClose={jest.fn()} sn="PAV1" />);
    await rerender(<RemoteSaleSheet visible={false} onClose={jest.fn()} sn="PAV1" />);
    expect(mockClose).toHaveBeenCalled();
  });
});
