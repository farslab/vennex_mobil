import React from "react";
import { fireEvent, screen } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/utils";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

describe("ListLoadMoreFooter", () => {
  it("yüklenirken gösterge", async () => {
    await renderWithProviders(<ListLoadMoreFooter loading error={null} />);
    expect(screen.getByLabelText("Daha fazla yükleniyor")).toBeOnTheScreen();
  });

  it("hata yokken yalnız boşluk", async () => {
    await renderWithProviders(<ListLoadMoreFooter loading={false} error={null} />);
    expect(screen.queryByTestId("list-load-more-error")).toBeNull();
    expect(screen.queryByLabelText("Daha fazla yükleniyor")).toBeNull();
  });

  it("hata olursa sunucu mesajı ve Tekrar dene gösterir", async () => {
    const onRetry = jest.fn();
    await renderWithProviders(
      <ListLoadMoreFooter loading={false} error={Object.assign(new Error("Sunucu hatası"), { status: 500 })} onRetry={onRetry} />
    );
    expect(screen.getByTestId("list-load-more-error")).toHaveTextContent(/Devamı yüklenemedi/);
    await fireEvent.press(screen.getByTestId("list-load-more-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
