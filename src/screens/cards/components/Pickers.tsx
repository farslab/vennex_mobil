import React from "react";
import { cardsApi } from "@/api/cards";
import type { CardGroup, PersonnelCard } from "@/types/cards";
import { cardKeys } from "../hooks/cardKeys";
import { cardDisplayName } from "./format";
import { SearchPicker } from "./SearchPicker";

export interface PickedRef {
  id: number;
  label: string;
}

/** Aktif kart seçici — sunucu tarafı arama (`cards/?q=`), isteğe bağlı grup filtresi */
export function CardPicker({
  value,
  onChange,
  groupId,
  label = "Kart",
  required,
  error,
  disabled,
  testID,
}: {
  value: PickedRef | null;
  onChange: (card: PickedRef) => void;
  groupId?: number | null;
  label?: string;
  required?: boolean;
  error?: string | null;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <SearchPicker<PersonnelCard>
      label={label}
      required={required}
      error={error}
      disabled={disabled}
      testID={testID}
      placeholder="Kart seçin"
      sheetTitle="Kart seç"
      searchPlaceholder="Ad, soyad veya UID ara"
      emptyText={groupId ? "Bu grupta eşleşen aktif kart yok" : "Eşleşen aktif kart yok"}
      valueLabel={value?.label ?? null}
      selectedId={value?.id ?? null}
      onSelect={(card) => onChange({ id: card.id, label: `${cardDisplayName(card)} · ${card.uid}` })}
      queryKey={(q) => cardKeys.picker("cards", { q, groupId: groupId ?? null })}
      fetchPage={(page, q, signal) => cardsApi.list({ status: "active", q, group_id: groupId ?? null, page }, signal)}
      getId={(c) => c.id}
      getLabel={cardDisplayName}
      getDescription={(c) => c.uid}
    />
  );
}

/** Kart grubu seçici — sunucu tarafı arama (`card-groups/?q=`, sayfasız tam liste) */
export function GroupPicker({
  value,
  onChange,
  label = "Kart grubu",
  required,
  error,
  disabled,
  testID,
}: {
  value: PickedRef | null;
  onChange: (group: PickedRef) => void;
  label?: string;
  required?: boolean;
  error?: string | null;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <SearchPicker<CardGroup>
      label={label}
      required={required}
      error={error}
      disabled={disabled}
      testID={testID}
      placeholder="Grup seçin"
      sheetTitle="Grup seç"
      searchPlaceholder="Grup adı ara"
      emptyText="Eşleşen grup yok"
      valueLabel={value?.label ?? null}
      selectedId={value?.id ?? null}
      onSelect={(g) => onChange({ id: g.id, label: g.name })}
      queryKey={(q) => cardKeys.picker("groups", { q })}
      fetchPage={async (_page, q, signal) => {
        const results = await cardsApi.groups.list({ q }, signal);
        return { count: results.length, page: 1, num_pages: 1, results };
      }}
      getId={(g) => g.id}
      getLabel={(g) => g.name}
      getDescription={(g) => `${g.active_cards_count} aktif kart · ${g.pos_device_count} cihaz`}
    />
  );
}
