import React, { useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { AppButton, AppInput, AppNotice, AppSegmented, AppSheet, AppText, makeStyles, toast } from "@/design-system";
import { templatesApi } from "@/api/templates";
import { errorMessage, type ApiError } from "@/api/client";
import type { ProductTemplateDetail, ProductTemplateSummary, TemplateMachineType } from "@/types/templates";

/** Yeni şablon / yeniden adlandır. Cihazlara eşli şablonun makine tipi değiştirilemez (backend 400). */
export function TemplateFormSheet({
  visible,
  template,
  onClose,
  onSaved,
}: {
  visible: boolean;
  /** null → yeni şablon */
  template: Pick<ProductTemplateSummary, "id" | "name" | "description" | "machine_type" | "assigned_device_count"> | null;
  onClose: () => void;
  onSaved: (t: ProductTemplateDetail) => void;
}) {
  const styles = useStyles();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [machineType, setMachineType] = useState<TemplateMachineType>(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useOnOpen(visible, () => {
      setName(template?.name ?? "");
      setDescription(template?.description ?? "");
      setMachineType(template?.machine_type ?? 0);
      setErrors({});
  });

  const typeLocked = !!template && (template.assigned_device_count ?? 0) > 0;

  const save = useMutation({
    mutationFn: () => {
      const payload = { name: name.trim(), description: description.trim() || null, machine_type: machineType };
      if (!template) return templatesApi.create(payload);
      return templatesApi.update(template.id, typeLocked ? { name: payload.name, description: payload.description } : payload);
    },
    onSuccess: (res) => {
      toast.success(template ? "Şablon güncellendi." : "Şablon oluşturuldu.");
      onSaved(res);
      onClose();
    },
    onError: (e) => {
      const fe = (e as ApiError).fieldErrors;
      if (fe) setErrors(fe);
    },
  });

  const submit = () => {
    const n = name.trim();
    if (!n) return setErrors({ name: "Şablon adı zorunlu." });
    if (n.length > 100) return setErrors({ name: "En fazla 100 karakter." });
    setErrors({});
    save.mutate();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={template ? "Şablonu düzenle" : "Yeni şablon"}
      dismissible={!save.isPending}
      testID="template-form"
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} disabled={save.isPending} style={styles.flex} />
          <AppButton title={template ? "Kaydet" : "Oluştur"} onPress={submit} loading={save.isPending} style={styles.flex} testID="template-form-submit" />
        </>
      }
    >
      {save.error && !(save.error as ApiError).fieldErrors ? <AppNotice tone="danger" message={errorMessage(save.error)} /> : null}
      <AppInput label="Şablon adı" required value={name} onChangeText={setName} maxLength={100} error={errors.name} testID="template-name" />
      <AppInput label="Açıklama" value={description} onChangeText={setDescription} multiline error={errors.description} />
      <View style={styles.field}>
        <AppText variant="label" color="textSecondary">
          Makine tipi
        </AppText>
        <AppSegmented<string>
          testID="template-machine-type"
          value={String(machineType)}
          onChange={(k) => !typeLocked && setMachineType(k === "1" ? 1 : 0)}
          items={[
            { key: "0", label: "Snack" },
            { key: "1", label: "Kahve" },
          ]}
        />
        <AppText variant="caption" color={typeLocked ? "warning" : "textTertiary"}>
          {typeLocked
            ? "Şablon cihazlara eşli olduğu için makine tipi değiştirilemez."
            : "Şablon yalnız aynı tipteki (Snack/Kahve) cihazlara atanabilir."}
        </AppText>
        {errors.machine_type ? (
          <AppText variant="caption" color="danger">
            {errors.machine_type}
          </AppText>
        ) : null}
      </View>
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    field: { gap: t.spacing.xs },
  })
);
