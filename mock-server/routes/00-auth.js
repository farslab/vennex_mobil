/** Auth, hesap, legal, app meta — backend views/auth.py, legal.py, app.py sözleşmesine göre */
module.exports = [
  {
    method: "POST",
    path: "/auth/login/",
    handler: ({ body, state }) => {
      if (!body.username || !body.password) return [400, { detail: "Kullanıcı adı ve parola gerekli." }];
      const u = state.users[body.username];
      if (!u || u.password !== body.password) return [401, { detail: "Kullanıcı adı veya parola hatalı." }];
      if (u.twoFactor) {
        const session_token = state.token();
        state.pending2fa.set(session_token, { username: u.username, attempts: 0 });
        return [200, { requires_2fa: true, session_token }];
      }
      return [200, state.issueTokens(u.username)];
    },
  },
  {
    method: "POST",
    path: "/auth/2fa/verify/",
    handler: ({ body, state }) => {
      const s = state.pending2fa.get(body.session_token);
      if (!s) return [401, { detail: "Oturum süresi doldu, tekrar giriş yapın." }];
      if (body.otp !== "123456") {
        s.attempts += 1;
        const attempts_left = 5 - s.attempts;
        if (attempts_left <= 0) {
          state.pending2fa.delete(body.session_token);
          return [401, { detail: "Çok fazla hatalı deneme, tekrar giriş yapın." }];
        }
        return [400, { detail: "Geçersiz kod.", requires_2fa: true, session_token: body.session_token, attempts_left }];
      }
      state.pending2fa.delete(body.session_token);
      return [200, state.issueTokens(s.username)];
    },
  },
  {
    method: "POST",
    path: "/auth/refresh/",
    handler: ({ body, state }) => {
      const username = state.refreshTokens.get(body.refresh);
      if (!username) return [401, { detail: "Token geçersiz veya süresi dolmuş.", code: "token_not_valid" }];
      const access = state.token();
      state.sessions.set(access, { username });
      return [200, { access }];
    },
  },
  {
    method: "POST",
    path: "/auth/logout/",
    handler: ({ body, state, token }) => {
      state.refreshTokens.delete(body.refresh);
      state.sessions.delete(token);
      return [204, undefined];
    },
  },
  { method: "GET", path: "/auth/me/", handler: ({ user, state }) => [200, state.publicUser(user)] },
  {
    method: "PATCH",
    path: "/auth/me/",
    handler: ({ user, body, state }) => {
      for (const k of ["first_name", "last_name", "email", "phone"]) if (k in body) user[k] = body[k] ?? "";
      return [200, state.publicUser(user)];
    },
  },
  {
    method: "POST",
    path: "/auth/change-password/",
    handler: ({ user, body }) => {
      if (body.current_password !== user.password) return [400, { current_password: ["Mevcut parola hatalı."] }];
      if (!body.new_password || body.new_password.length < 8)
        return [400, { new_password: ["Bu alanın en az 8 karakter içerdiğinden emin olun."] }];
      if (body.new_password === body.current_password)
        return [400, { new_password: ["Yeni parola eskisinden farklı olmalı."] }];
      user.password = body.new_password;
      return [200, { detail: "Parola güncellendi." }];
    },
  },
  {
    method: "POST",
    path: "/auth/password-reset/",
    handler: () => [200, { detail: "Eğer e-posta sistemde kayıtlıysa, sıfırlama bağlantısı gönderildi." }],
  },
  { method: "GET", path: "/auth/2fa/status/", handler: ({ user }) => [200, { is_enabled: !!user.twoFactor }] },
  {
    method: "POST",
    path: "/auth/2fa/setup/",
    handler: ({ user }) =>
      user.twoFactor
        ? [400, { detail: "2FA zaten aktif.", is_enabled: true }]
        : [200, { device_id: 1, secret: "JBSWY3DPEHPK3PXP", otpauth_url: `otpauth://totp/Vennex:${user.username}?secret=JBSWY3DPEHPK3PXP&issuer=Vennex` }],
  },
  {
    method: "POST",
    path: "/auth/2fa/enable/",
    handler: ({ user, body }) => {
      if (body.otp !== "123456") return [400, { detail: "Geçersiz kod." }];
      user.twoFactor = true;
      return [200, { detail: "2FA aktifleştirildi.", is_enabled: true }];
    },
  },
  {
    method: "POST",
    path: "/auth/2fa/disable/",
    handler: ({ user, body }) => {
      if (body.password !== user.password) return [400, { detail: "Parola hatalı." }];
      user.twoFactor = false;
      return [200, { detail: "2FA devre dışı bırakıldı.", is_enabled: false }];
    },
  },
  {
    method: "POST",
    path: "/auth/deactivate/",
    handler: ({ user, body }) =>
      body.password !== user.password ? [400, { password: ["Parola hatalı."] }] : [200, { detail: "Hesap devre dışı bırakıldı." }],
  },
  {
    method: "POST",
    path: "/auth/delete/",
    handler: ({ user, body }) =>
      body.password !== user.password ? [400, { password: ["Parola hatalı."] }] : [200, { detail: "Hesap silme talebi alındı." }],
  },
  { method: "POST", path: "/device/register/", handler: () => [200, { detail: "ok" }] },
  { method: "POST", path: "/device/unregister/", handler: () => [200, { detail: "ok" }] },
  {
    method: "GET",
    path: "/me/notification-preferences/",
    handler: ({ state }) => {
      state.db.prefs ??= {
        device_offline: true,
        transaction_alerts: false,
        stock_low: true,
        card_pending: true,
        report_ready: true,
        cari_overdue: true,
        updated_at: new Date().toISOString(),
      };
      return [200, state.db.prefs];
    },
  },
  {
    method: "PATCH",
    path: "/me/notification-preferences/",
    handler: ({ state, body }) => {
      state.db.prefs = { ...(state.db.prefs ?? {}), ...body, updated_at: new Date().toISOString() };
      return [200, state.db.prefs];
    },
  },
  {
    method: "GET",
    path: "/legal/:slug/",
    handler: ({ params }) => {
      const titles = { kvkk: "KVKK Aydınlatma Metni", privacy: "Gizlilik Politikası", terms: "Kullanım Koşulları" };
      if (!titles[params.slug]) return [404, { detail: "Belge bulunamadı." }];
      return [
        200,
        {
          slug: params.slug,
          title: titles[params.slug],
          version: 3,
          updated_at: "2026-10-01T09:00:00+03:00",
          content_md: `# ${titles[params.slug]}\n\nBu metin **mock sunucu** tarafından üretilmiş örnek içeriktir.\n\n## 1. Kapsam\n\nÖrnek madde metni.\n\n- Madde bir\n- Madde iki\n`,
          web_url: null,
        },
      ];
    },
  },
  {
    method: "POST",
    path: "/legal/accept/",
    handler: ({ user, body, state }) => {
      user.pending_legal_docs = user.pending_legal_docs.filter((s) => s !== body.slug);
      return [200, state.publicUser(user)];
    },
  },
  { method: "GET", path: "/app/min-version/", handler: () => [200, { ios: "1.0.0", android: "1.0.0", force_update: false }] },
  { method: "GET", path: "/app/ping/", handler: () => [200, { ok: true }] },
];
