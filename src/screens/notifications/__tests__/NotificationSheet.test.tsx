import React from "react";
import { render, screen } from "@testing-library/react-native";
import { NotificationSheet } from "@/screens/notifications/NotificationSheet";
import type { NotificationItem } from "@/types/notifications";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
// RN Modal test mock'u kapalıyken hiçbir şey çizmez; kapanma animasyonundaki içeriği görmek için
// sayfayı her zaman çizen basit bir yer tutucu kullanılır
jest.mock("@/design-system", () => {
  const actual = jest.requireActual("@/design-system");
  const { Text, View } = jest.requireActual("react-native");
  return {
    ...actual,
    AppSheet: ({ visible, title, children }: { visible: boolean; title: string; children: React.ReactNode }) => (
      <View testID="sheet" accessibilityState={{ expanded: visible }}>
        <Text>{title}</Text>
        {children}
      </View>
    ),
  };
});

const item: NotificationItem = {
  id: 7,
  timestamp: "2026-11-18T10:30:00Z",
  verb: "Stok azaldı",
  description: "Lobi Otomat stoğu kritik seviyede.",
  unread: false,
  actor_str: null,
  target_str: null,
  data: null,
};

describe("NotificationSheet", () => {
  it("kapanırken (item=null) son bildirimin içeriği boşalmaz", async () => {
    const props = { target: null, link: null, onClose: jest.fn(), onOpenTarget: jest.fn() };
    const { rerender } = await render(<NotificationSheet item={item} {...props} />);
    expect(screen.getByText("Lobi Otomat stoğu kritik seviyede.")).toBeOnTheScreen();
    await rerender(<NotificationSheet item={null} {...props} />);
    // Sayfa kapanıyor ama kapanma animasyonu boyunca başlık/içerik boşalmaz
    expect(screen.getByTestId("sheet").props.accessibilityState).toEqual({ expanded: false });
    expect(screen.getByText("Stok azaldı")).toBeOnTheScreen();
    expect(screen.getByText("Lobi Otomat stoğu kritik seviyede.")).toBeOnTheScreen();
  });
});
