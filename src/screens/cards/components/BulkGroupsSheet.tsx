import React, { useMemo, useState } from "react";
import { StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppButton, AppConfirmSheet, AppSegmented, AppSelect, AppSheet, makeStyles } from "@/design-system";
import { cardsApi } from "@/api/cards";
import type { BulkGroupsOperation } from "@/types/cards";
import { cardKeys } from "../hooks/cardKeys";
import { generalErrorOf, useLockedMutation } from "../hooks/useLockedMutation";
import { useOnOpen } from "../hooks/useOnOpen";

const OPERATIONS: { key: BulkGroupsOperation; label: string }[] = [
  { key: "add_groups", label: "Gruba ekle" },
  { key: "remove_groups", label: "Gruptan çıkar" },
];

/** Seçili kartlara toplu grup ekleme/çıkarma (`POST cards/bulk/groups/`) */
export function BulkGroupsSheet({
  visible,
  cardIds,
  onClose,
  onDone,
}: {
  visible: boolean;
  cardIds: number[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const styles = useStyles();
  const [operation, setOperation] = useState<BulkGroupsOperation>("add_groups");
  const [groupIds, setGroupIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useOnOpen(visible, () => {
    setOperation("add_groups");
    setGroupIds([]);
    setError(null);
    setConfirming(false);
  });

  const groupsQuery = useQuery({
    queryKey: cardKeys.groupList(""),
    queryFn: ({ signal }) => cardsApi.groups.list({}, signal),
    enabled: visible,
  });
  const options = useMemo(
    () => (groupsQuery.data ?? []).map((g) => ({ value: g.id, label: g.name, description: `${g.active_cards_count} aktif kart` })),
    [groupsQuery.data]
  );

  const mutation = useLockedMutation({
    mutationFn: () => cardsApi.bulkGroups(cardIds, groupIds, operation),
    successMessage: (res) => `${res.count} kartın grupları güncellendi.`,
    onSuccess: () => {
      setConfirming(false);
      onClose();
      onDone?.();
    },
  });

  const groupNames = options.filter((o) => groupIds.includes(o.value)).map((o) => o.label).join(", ");

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Toplu grup ataması"
      subtitle={`${cardIds.length} kart seçili`}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} style={styles.flex} />
          <AppButton
            title="Devam"
            testID="bulk-groups-continue"
            style={styles.flex}
            onPress={() => {
              if (groupIds.length === 0) {
                setError("En az bir grup seçin.");
                return;
              }
              mutation.reset();
              setConfirming(true);
            }}
          />
        </>
      }
    >
      <AppSegmented items={OPERATIONS} value={operation} onChange={setOperation} />
      <AppSelect<number>
        multiple
        label="Gruplar"
        required
        value={groupIds}
        onChange={(v) => {
          setGroupIds(v);
          setError(null);
        }}
        options={options}
        loading={groupsQuery.isLoading}
        error={error ?? (groupsQuery.isError ? "Gruplar yüklenemedi." : null)}
        searchable
        testID="bulk-groups-select"
      />
      <AppConfirmSheet
        visible={confirming}
        title="Grup atamasını onayla"
        summary={[
          { label: "Kart sayısı", value: `${cardIds.length} kart` },
          { label: "İşlem", value: operation === "add_groups" ? "Gruplara ekle" : "Gruplardan çıkar" },
          { label: "Gruplar", value: groupNames || "—" },
        ]}
        loading={mutation.isPending}
        error={generalErrorOf(mutation.error)}
        onCancel={() => setConfirming(false)}
        onConfirm={() => mutation.run()}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({ flex: { flex: 1 } }));
