// Ortak test yardımcıları
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { AuthUser } from "@/types/auth";

/** Her test için izole, retry'sız QueryClient */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      // gcTime: Infinity → testten sonra zamanlayıcı kalmaz (jest süreci temiz kapanır)
      mutations: { retry: false, gcTime: Infinity },
    },
  });
}

/** React Query provider'ı ile render eder (RNTL v14: render async) */
export async function renderWithProviders(
  ui: React.ReactElement,
  { queryClient = createTestQueryClient(), ...options }: { queryClient?: QueryClient } & RenderOptions = {}
) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const result = await render(ui, { wrapper, ...options });
  return { queryClient, ...result };
}

/** jest.setup.ts'deki bellek içi SecureStore'u temizler */
export function resetSecureStore() {
  (SecureStore as unknown as { __reset: () => void }).__reset();
}

export function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    username: "test.user",
    first_name: "Test",
    last_name: "Kullanıcı",
    email: "test@example.com",
    phone: null,
    role: "owner",
    permissions: [],
    companies: [
      { id: 10, name: "Test Şirketi", cari_state: 0, has_personnel_card_device: true, uses_stock_mode: true },
    ],
    pending_legal_docs: [],
    ...overrides,
  };
}
