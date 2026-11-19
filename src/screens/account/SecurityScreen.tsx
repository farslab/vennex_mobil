import React from "react";
import { AppScreen, AppSection } from "@/design-system";
import { ChangePasswordCard } from "./security/ChangePasswordCard";
import { TwoFactorCard } from "./security/TwoFactorCard";
import { AccountDangerZone } from "./security/AccountDangerZone";

/** Güvenlik: şifre değişimi, iki adımlı doğrulama, hesap silme talebi */
export default function SecurityScreen() {
  return (
    <AppScreen testID="security-screen">
      <AppSection title="Şifre">
        <ChangePasswordCard />
      </AppSection>
      <AppSection title="İki adımlı doğrulama">
        <TwoFactorCard />
      </AppSection>
      <AppSection title="Hesap işlemleri">
        <AccountDangerZone />
      </AppSection>
    </AppScreen>
  );
}
