// Ekran testleri için kurgusal, sözleşmeye uygun stok verisi
export const locations = [
  { id: 1, name: "Merkez Depo", location_type: "warehouse", location_type_display: "Ana Depo", is_active: true, pos_device: null, pos_device_sn: null },
  { id: 2, name: "Ara Depo", location_type: "depot", location_type_display: "Ara Depo", is_active: true, pos_device: null, pos_device_sn: null },
  { id: 3, name: "Servis Aracı", location_type: "vehicle", location_type_display: "Araç", is_active: true, pos_device: null, pos_device_sn: null },
  { id: 4, name: "Otomat Kampüs", location_type: "vending_machine", location_type_display: "Otomat", is_active: true, pos_device: 101, pos_device_sn: "VX-T-1" },
];

export const skus = [
  { id: 1, name: "Su 500 ml", sku_code: "SU-500", barcode: "8690001", unit_cost: "4.50", kind: "simple", kind_display: "Ürün", base_unit: "piece", unit_short: "adet", package_size: 24, package_label: "24'lü koli", sale_price: "10.00", vat_rate: "20.00", sale_price_excl_vat: "8.33", vat_amount: "1.67" },
  { id: 2, name: "Çekirdek Kahve", sku_code: "BIL-KHV", barcode: null, unit_cost: "0.62", kind: "ingredient", kind_display: "Bileşen", base_unit: "gram", unit_short: "g", package_size: 1000, package_label: "1 kg", sale_price: "0.00", vat_rate: "10.00", sale_price_excl_vat: "0.00", vat_amount: "0.00" },
  { id: 3, name: "Latte", sku_code: "SC-LTE", barcode: null, unit_cost: "0.00", kind: "composite", kind_display: "Reçeteli Ürün", base_unit: "piece", unit_short: "adet", package_size: 1, package_label: "", sale_price: "45.00", vat_rate: "10.00", sale_price_excl_vat: "40.91", vat_amount: "4.09" },
];

export const inventory = (locationId: number) => ({
  location: locations.find((l) => l.id === locationId),
  results:
    locationId === 1
      ? [
          { id: 11, sku: 1, sku_name: "Su 500 ml", sku_code: "SU-500", location: 1, location_type: "warehouse", quantity: 120, updated_at: "2026-11-18T09:00:00Z" },
          { id: 12, sku: 2, sku_name: "Çekirdek Kahve", sku_code: "BIL-KHV", location: 1, location_type: "warehouse", quantity: 2500.5, updated_at: "2026-11-18T09:00:00Z" },
        ]
      : locationId === 3
        ? [{ id: 31, sku: 1, sku_name: "Su 500 ml", sku_code: "SU-500", location: 3, location_type: "vehicle", quantity: -2, updated_at: "2026-11-18T09:00:00Z" }]
        : [],
});

export const movement = (over: Record<string, unknown>) => ({
  id: 1,
  movement_type: "transfer",
  movement_type_display: "Transfer",
  sku: 1,
  sku_name: "Su 500 ml",
  from_location: 1,
  from_location_name: "Merkez Depo",
  to_location: 3,
  to_location_name: "Servis Aracı",
  quantity: 10,
  reason: null,
  created_at: "2026-11-18T10:30:00Z",
  created_by_username: "demo",
  ...over,
});
