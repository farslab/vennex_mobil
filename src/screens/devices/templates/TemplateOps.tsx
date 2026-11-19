/**
 * Şablon dağıtım/silme işlemleri (liste ve editörde ortak):
 *  - assign: `POST product-templates/{id}/assign/ {device_sns[]}` — uyuşmayan tipler `type_mismatch[]`
 *  - send:   `POST product-templates/{id}/send/ {sn}` — cihaz ÜRÜNLERİ silinip yeniden yaratılır.
 *            Backend send yalnız normal mod `Product` yazar (stok modu slotlarına dokunmaz) → stok modunda gizli.
 *  - delete: `DELETE product-templates/{id}/`
 * Liste uçlarında `pos_odemetip` yok → cihaz seçici makine tipine göre süzemez (açıklama gösterilir).
 * Zaten eşli cihazlar tikli ve kilitli gösterilir (yeniden atama ürünleri baştan kurup stoğu sıfırlar →
 * yalnız YENİ seçilenler gönderilir). Liste ekranındaki özet eşli cihazları içermez → detaydan alınır.
 */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton, AppConfirmSheet, AppNotice, AppSheet, AppText, makeStyles, toast } from "@/design-system";
import { templatesApi } from "@/api/templates";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { DevicePickerSheet } from "@/components/devices/DevicePickerSheet";
import { machineTypeLabel } from "@/components/devices/deviceHelpers";
import { formatInteger } from "@/utils/number";
import type { TemplateAssignResult, TemplateMachineType } from "@/types/templates";

export type TemplateOp = "assign" | "send" | "delete" | null;

export interface TemplateOpTarget {
  id: number;
  name: string;
  machine_type: TemplateMachineType;
  item_count: number | null;
  assigned_device_count: number | null;
  assigned_sns?: string[];
}

const TYPE_NOTICE =
  "POS cihazı listesinde makine tipi (Snack/Kahve) bilgisi bulunmadığından liste süzülemiyor. Şablonla aynı tipte olmayan POS cihazları sunucu tarafından atlanır ve sonuçta gösterilir.";

export function TemplateOps({
  op,
  template,
  onClose,
  onDeleted,
}: {
  op: TemplateOp;
  template: TemplateOpTarget | null;
  onClose: () => void;
  onDeleted?: () => void;
}) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<TemplateAssignResult | null>(null);
  const [sendSn, setSendSn] = useState<string | null>(null);

  const afterWrite = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
  };

  const assign = useMutation({
    mutationFn: (sns: string[]) => templatesApi.assignDevices((template as TemplateOpTarget).id, sns),
    onSuccess: (res) => {
      afterWrite();
      onClose();
      setResult(res);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const send = useMutation({
    mutationFn: (sn: string) => templatesApi.send((template as TemplateOpTarget).id, sn),
    onSuccess: (res) => {
      toast.success(res.detail || `${res.created} ürün gönderildi.`);
      setSendSn(null);
      afterWrite();
      onClose();
    },
  });

  const remove = useMutation({
    mutationFn: () => templatesApi.remove((template as TemplateOpTarget).id),
    onSuccess: () => {
      toast.success("Şablon silindi.");
      afterWrite();
      onClose();
      onDeleted?.();
    },
  });

  const typeLabel = template ? machineTypeLabel(template.machine_type) : "";

  // Eşli cihazlar: editör hedefte verir; liste özetinde yok → atama açılınca detaydan çekilir
  const needsAssigned = op === "assign" && !!template && template.assigned_sns == null;
  const detailQuery = useQuery({
    queryKey: queryKeys.templates.detail(template?.id ?? 0),
    queryFn: ({ signal }) => templatesApi.detail((template as TemplateOpTarget).id, signal),
    enabled: needsAssigned,
  });
  const assignedSns = template?.assigned_sns ?? detailQuery.data?.assigned_devices.map((d) => d.sn) ?? [];

  return (
    <>
      <DevicePickerSheet
        visible={op === "assign" && !!template}
        multiple
        title="POS cihazlarına ata"
        subtitle={template ? `${template.name} · ${typeLabel}` : undefined}
        notice={TYPE_NOTICE}
        markedSns={assignedSns}
        markedLabel="Eşli"
        markedLocked
        confirmLabel="Ata"
        loading={assign.isPending}
        onClose={onClose}
        onConfirm={(sns) => assign.mutate(sns)}
      />

      <DevicePickerSheet
        visible={op === "send" && !!template && sendSn == null}
        title="POS cihazına gönder"
        subtitle={template ? `${template.name} · ${typeLabel}` : undefined}
        notice="Seçilen POS cihazının tüm ürünleri silinip şablondan yeniden oluşturulur. Makine tipi uyuşmazsa sunucu reddeder."
        confirmLabel="Devam"
        onClose={onClose}
        onConfirm={(sn) => setSendSn(sn)}
      />
      <AppConfirmSheet
        visible={op === "send" && sendSn != null}
        title="Şablonu POS cihazına gönder"
        message="POS cihazındaki mevcut ürünlerin tamamı silinir ve şablon kalemleriyle yeniden oluşturulur."
        summary={template && sendSn ? [
          { label: "Şablon", value: template.name },
          { label: "Kalem", value: template.item_count != null ? formatInteger(template.item_count) : "—" },
          { label: "POS cihazı", value: sendSn },
        ] : undefined}
        confirmLabel="Gönder"
        destructive
        irreversible
        loading={send.isPending}
        error={send.error ? errorMessage(send.error) : null}
        onConfirm={() => sendSn && send.mutate(sendSn)}
        onCancel={() => {
          setSendSn(null);
          send.reset();
          onClose();
        }}
      />

      <AppConfirmSheet
        visible={op === "delete" && !!template}
        title="Şablonu sil"
        message="Şablon ve tüm kalemleri silinir. Eşli POS cihazlarının ürünleri cihazda kalır ancak şablonla bağları kopar."
        summary={template ? [
          { label: "Şablon", value: template.name },
          { label: "Kalem", value: template.item_count != null ? formatInteger(template.item_count) : "—" },
          { label: "Eşli POS cihazı", value: template.assigned_device_count != null ? formatInteger(template.assigned_device_count) : "—" },
        ] : undefined}
        confirmLabel="Sil"
        destructive
        irreversible
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          remove.reset();
          onClose();
        }}
      />

      <AppSheet visible={result != null} onClose={() => setResult(null)} title="Atama sonucu" testID="assign-result" footer={<AppButton title="Tamam" onPress={() => setResult(null)} style={styles.flex} />}>
        {result ? (
          <View style={styles.gap}>
            <AppText variant="metricMd">{formatInteger(result.assigned_count)} POS cihazına eşlendi</AppText>
            {result.type_mismatch.length ? (
              <AppNotice
                tone="warning"
                title={`${result.type_mismatch.length} POS cihazı atlandı (makine tipi uyuşmuyor)`}
                message={result.type_mismatch.join(", ")}
              />
            ) : (
              <AppText variant="callout" color="textSecondary">
                Atlanan POS cihazı yok.
              </AppText>
            )}
          </View>
        ) : null}
      </AppSheet>
    </>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    gap: { gap: t.spacing.md },
  })
);
