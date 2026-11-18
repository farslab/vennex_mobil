/**
 * Geri bildirim — backend views/feedback.py sözleşmesine göre (yalnız kendi kayıtları). Veriler KURGUSALDIR.
 */
const state = require("../state");

const CATEGORY = { suggestion: "Öneri", bug: "Hata bildirimi", question: "Soru / destek", other: "Diğer" };
const STATUS = { new: "Yeni", read: "Okundu", in_progress: "İnceleniyor", resolved: "Çözüldü", spam: "Spam" };

function db() {
  state.db.feedback ??= { seq: 100, items: [] };
  return state.db.feedback;
}
const serialize = (f) => ({
  id: f.id,
  category: f.category,
  category_display: CATEGORY[f.category],
  message: f.message,
  status: f.status,
  status_display: STATUS[f.status],
  created_at: f.created_at,
});

module.exports = [
  {
    method: "GET",
    path: "/feedback/",
    handler: ({ user }) => [200, { results: db().items.filter((f) => f.user_id === user.id).map(serialize) }],
  },
  {
    method: "POST",
    path: "/feedback/",
    handler: ({ user, body }) => {
      const message = String(body.message ?? "").trim();
      if (!(body.category in CATEGORY)) return [400, { category: ["Geçerli bir seçim yapın."] }];
      if (message.length < 10) return [400, { message: ["Bu alanın en az 10 karakter içerdiğinden emin olun."] }];
      if (message.length > 2000) return [400, { message: ["Bu alanın 2000 karakterden fazla karakter içermediğinden emin olun."] }];
      const f = { id: ++db().seq, user_id: user.id, category: body.category, message, status: "new", created_at: new Date().toISOString() };
      db().items.unshift(f);
      return [201, serialize(f)];
    },
  },
];
