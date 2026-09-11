/**
 * Cloudflare Worker — приём заявки с формы записи и отправка в WhatsApp.
 *
 * Фронтенд (GitHub Pages) шлёт сюда POST JSON, Worker пересылает заявку
 * в WhatsApp клиники через Green API. Т.к. сайт и Worker на разных доменах —
 * обязателен CORS (обрабатываем preflight OPTIONS + заголовки на ответе).
 *
 * Поток:  Форма (github.io) -> POST JSON -> этот Worker -> Green API -> WhatsApp
 *
 * Переменные окружения (задать через `wrangler secret put` или в дашборде):
 *   GREENAPI_ID_INSTANCE  — idInstance инстанса Green API           (Variable)
 *   GREENAPI_TOKEN        — apiTokenInstance                        (Secret!)
 *   LEAD_CHAT_ID          — куда слать: "996555003200@c.us"         (Variable)
 *                           (номер WhatsApp клиники без "+"; группа — "...@g.us")
 *   ALLOWED_ORIGIN        — разрешённый источник для CORS,          (Variable)
 *                           напр. "https://USERNAME.github.io"
 *                           можно список через запятую; "*" — любой
 *   GREENAPI_HOST         — необязательно, по умолчанию https://api.green-api.com
 */

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

// Вычисляем значение Access-Control-Allow-Origin по настройке ALLOWED_ORIGIN
function resolveOrigin(request, env) {
  const allow = (env.ALLOWED_ORIGIN || "*").trim();
  if (allow === "*") return "*";
  const origin = request.headers.get("Origin") || "";
  const list = allow.split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : list[0] || "*";
}

function corsHeaders(request, env) {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(request, env),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request, env) },
  });
}

export default {
  async fetch(request, env) {
    // 1. Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, request, env);
    }

    // 2. Разбираем тело (ограничение ~4 КБ)
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 4096) return json({ ok: false, error: "too_large" }, 413, request, env);
      body = JSON.parse(raw || "{}");
    } catch {
      return json({ ok: false, error: "bad_json" }, 400, request, env);
    }

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const comment = String(body.comment || "").trim();
    const honeypot = String(body.company || "").trim();

    // 3. Анти-спам: honeypot заполнен -> тихо "успех"
    if (honeypot) return json({ ok: true }, 200, request, env);

    // 4. Валидация (нельзя доверять только клиенту)
    if (name.length < 2) return json({ ok: false, error: "name" }, 422, request, env);
    if (phone.replace(/\D/g, "").length < 9) {
      return json({ ok: false, error: "phone" }, 422, request, env);
    }

    // 5. Проверка настройки бэкенда
    const { GREENAPI_ID_INSTANCE, GREENAPI_TOKEN, LEAD_CHAT_ID } = env;
    if (!GREENAPI_ID_INSTANCE || !GREENAPI_TOKEN || !LEAD_CHAT_ID) {
      return json({ ok: false, error: "not_configured" }, 500, request, env);
    }

    // 6. Текст сообщения
    const message =
      "🦷 Новая заявка с сайта\n\n" +
      "👤 Имя: " + name + "\n" +
      "📞 Телефон: " + phone + "\n" +
      (comment ? "💬 Комментарий: " + comment + "\n" : "") +
      "\n🕒 " + new Date().toLocaleString("ru-RU", { timeZone: "Asia/Bishkek" });

    // 7. Отправка через Green API
    const host = (env.GREENAPI_HOST || "https://api.green-api.com").replace(/\/+$/, "");
    const url = host + "/waInstance" + GREENAPI_ID_INSTANCE + "/sendMessage/" + GREENAPI_TOKEN;

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ chatId: LEAD_CHAT_ID, message }),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        console.error("Green API error", resp.status, detail);
        return json({ ok: false, error: "send_failed" }, 502, request, env);
      }
    } catch (e) {
      console.error("Green API fetch failed", e);
      return json({ ok: false, error: "send_failed" }, 502, request, env);
    }

    return json({ ok: true }, 200, request, env);
  },
};
