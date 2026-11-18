/**
 * Şirketler ve cari (Paraşüt) — backend views/companies.py ve views/payments.py sözleşmesine göre.
 * Yalnız görüntüleme; ödeme ucu backend'de YOK. Veriler KURGUSALDIR.
 */
const DETAILS = {
  1: {
    address: "Örnek Mah. Deneme Cad. No: 1, Kadıköy / İstanbul",
    phone: "02160000000",
    email: "muhasebe@example.com",
    tax_number: "1234567890",
    uye_isyeri: "000000001",
    uye_isyeri_kisa_ad: "DEMO OTOMAT",
  },
  2: { address: "", phone: "", email: "", tax_number: "9876543210", uye_isyeri: "", uye_isyeri_kisa_ad: "" },
};

function fullCompany(c) {
  return {
    id: c.id,
    name: c.name,
    ...(DETAILS[c.id] ?? { address: "", phone: "", email: "", tax_number: "", uye_isyeri: "", uye_isyeri_kisa_ad: "" }),
    cari_state: c.cari_state,
    has_personnel_card_device: !!c.has_personnel_card_device,
    uses_stock_mode: !!c.uses_stock_mode,
  };
}

// Şirket başına ödenmemiş faturalar (DecimalField → string)
const INVOICES = {
  1: [],
  2: [
    {
      id: 71,
      parasut_invoice_id: 880011,
      issue_date: null,
      due_date: "2026-10-15",
      net_total: "4800.00",
      remaining_in_trl: "4800.00",
      payment_status: "overdue",
      e_document_type: "e_archives",
      e_document_id: 55001,
    },
    {
      id: 72,
      parasut_invoice_id: 880012,
      issue_date: null,
      due_date: "2026-12-01",
      net_total: "2350.50",
      remaining_in_trl: "1200.25",
      payment_status: "not_due",
      e_document_type: "",
      e_document_id: null,
    },
  ],
};

const forbidden = [403, { detail: "Bu işlemi yapmak için izniniz bulunmuyor." }];
const isOwner = (user) => user && user.role === "owner";
const sum = (rows, pred) => rows.filter(pred).reduce((acc, r) => acc + Number(r.remaining_in_trl), 0);

module.exports = [
  {
    method: "GET",
    path: "/companies/",
    handler: ({ user }) => [200, { results: user.companies.map(fullCompany) }],
  },
  {
    method: "GET",
    path: "/companies/:id/",
    handler: ({ user, params }) => {
      const c = user.companies.find((x) => x.id === Number(params.id));
      if (!c) return [403, { detail: "Bu şirkete erişiminiz yok." }];
      return [200, fullCompany(c)];
    },
  },
  {
    method: "GET",
    path: "/cari/summary/",
    handler: ({ user, companyId }) => {
      if (!isOwner(user)) return forbidden;
      const c = user.companies.find((x) => x.id === companyId);
      if (!c) return [400, { detail: "Şirket seçili değil." }];
      const rows = INVOICES[c.id] ?? [];
      return [
        200,
        {
          enabled: true,
          company_name: c.name,
          cari_state: c.cari_state,
          is_locked: c.cari_state === 4,
          overdue_total: sum(rows, (r) => r.payment_status === "overdue"),
          all_total: sum(rows, () => true),
          invoice_count: rows.length,
          balance_only: false,
          contact_id: rows.length ? 9000 + c.id : null,
        },
      ];
    },
  },
  {
    method: "GET",
    path: "/cari/invoices/",
    handler: ({ user, companyId }) => {
      if (!isOwner(user)) return forbidden;
      const rows = (INVOICES[companyId] ?? []).slice().sort((a, b) => (b.due_date || "").localeCompare(a.due_date || ""));
      return [200, { results: rows }];
    },
  },
  {
    method: "GET",
    path: "/cari/invoices/:id/pdf/",
    handler: ({ user, companyId, params }) => {
      if (!isOwner(user)) return forbidden;
      const inv = (INVOICES[companyId] ?? []).find((r) => r.id === Number(params.id));
      if (!inv) return [404, { detail: "Bulunamadı." }];
      if (!inv.e_document_id || !inv.e_document_type) return [404, { detail: "Bu faturanın e-belgesi bulunamadı." }];
      // Kurgusal, yerel bir adres — gerçek Paraşüt'e gitmez
      return [200, { pdf_url: `http://localhost:4010/mock-files/invoice-${inv.id}.pdf` }];
    },
  },
];
