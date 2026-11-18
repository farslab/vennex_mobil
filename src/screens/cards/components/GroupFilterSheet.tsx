import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppErrorState,
  AppIcon,
  AppListSkeleton,
  AppSearchField,
  AppSheet,
  AppText,
  makeStyles,
} from "@/design-system";
import { cardsApi } from "@/api/cards";
import { errorMessage } from "@/api/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cardKeys } from "../hooks/cardKeys";

export interface GroupFilter {
  id: number;
  name: string;
}

/** Liste filtresi için grup seçimi — sunucu tarafı arama (`card-groups/?q=`), "Tüm gruplar" seçeneği */
export function GroupFilterSheet({
  visible,
  selectedId,
  onClose,
  onSelect,
}: {
  visible: boolean;
  selectedId: number | null;
  onClose: () => void;
  onSelect: (g: GroupFilter | null) => void;
}) {
  const styles = useStyles();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350).trim();
  const query = useQuery({
    queryKey: cardKeys.groupList(debounced),
    queryFn: ({ signal }) => cardsApi.groups.list({ q: debounced }, signal),
    enabled: visible,
  });
  const rows: (GroupFilter & { caption?: string })[] = [
    { id: -1, name: "Tüm gruplar" },
    ...(query.data ?? []).map((g) => ({ id: g.id, name: g.name, caption: `${g.active_cards_count} aktif kart` })),
  ];
  return (
    <AppSheet visible={visible} onClose={onClose} title="Grup filtresi" scrollable={false}>
      <AppSearchField value={q} onChangeText={setQ} placeholder="Grup adı ara" />
      {query.isLoading ? (
        <AppListSkeleton rows={4} />
      ) : query.isError ? (
        <AppErrorState compact message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          style={styles.sheetList}
          keyExtractor={(g) => String(g.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const active = item.id === -1 ? selectedId == null : item.id === selectedId;
            return (
              <Pressable
                onPress={() => onSelect(item.id === -1 ? null : { id: item.id, name: item.name })}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <View style={styles.flex}>
                  <AppText variant="body" weight={active ? "600" : "400"}>
                    {item.name}
                  </AppText>
                  {item.caption ? (
                    <AppText variant="caption" color="textTertiary">
                      {item.caption}
                    </AppText>
                  ) : null}
                </View>
                {active ? <AppIcon name="check" size={18} color="primary" /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    sheetList: { maxHeight: 420 },
    option: {
      minHeight: t.layout.minTouchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    optionPressed: { backgroundColor: t.colors.surfacePressed },
  })
);
