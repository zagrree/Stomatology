# Приём заявок (Cloudflare Worker + WhatsApp через Green API)

Фронтенд на GitHub Pages отправляет заявку сюда, Worker пересылает её в WhatsApp клиники.

```
Форма (github.io) → POST JSON → Worker (workers.dev) → Green API → WhatsApp
```

## 1. Green API
1. Зарегистрируйтесь на https://green-api.com и создайте инстанс.
2. В личном кабинете привяжите номер WhatsApp (сканирование QR в приложении WhatsApp).
3. Скопируйте **idInstance** и **apiTokenInstance**.
4. Определите, куда слать заявки — `LEAD_CHAT_ID`:
   - на личный номер: `996555003200@c.us` (номер без «+», в конце `@c.us`);
   - в группу: `<id группы>@g.us`.

> Инстанс отправляет сообщения от имени привязанного номера. Чтобы заявки
> приходили на телефон клиники — можно привязать отдельный номер-отправитель,
> а `LEAD_CHAT_ID` указать = номер клиники.

## 2. Деплой Worker
Нужен установленный Node.js. Из папки `cloudflare-worker`:

```bash
npx wrangler login                       # вход в аккаунт Cloudflare
npx wrangler secret put GREENAPI_TOKEN   # вставить apiTokenInstance (секрет)
npx wrangler deploy                      # публикация; выдаст URL вида
                                         # https://stom-lead.ВАШ-СУБДОМЕН.workers.dev
```

Публичные переменные задайте в дашборде **Workers → stom-lead → Settings → Variables**
(или раскомментируйте в `wrangler.toml`):

| Переменная             | Пример значения                    |
|------------------------|------------------------------------|
| `GREENAPI_ID_INSTANCE` | `1101000001`                       |
| `LEAD_CHAT_ID`         | `996555003200@c.us`                |
| `ALLOWED_ORIGIN`       | `https://USERNAME.github.io`       |

`ALLOWED_ORIGIN` — origin вашего сайта на GitHub Pages (для CORS). Если домен
кастомный — укажите его; можно перечислить несколько через запятую.

## 3. Подключение фронтенда
В `script.js` (в корне репозитория сайта) впишите выданный URL:

```js
var CONFIG = {
  ENDPOINT: "https://stom-lead.ВАШ-СУБДОМЕН.workers.dev",
  TIMEOUT: 12000
};
```

Закоммитьте и запушьте — GitHub Pages обновит сайт.

## 4. Проверка
- Отправьте тестовую заявку с сайта — сообщение должно прийти в WhatsApp.
- Быстрый тест из терминала:

```bash
curl -X POST https://stom-lead.ВАШ-СУБДОМЕН.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"name":"Тест","phone":"+996555003200","comment":"проверка"}'
# ожидаемый ответ: {"ok":true}
```

## Коды ответов
`200 {ok:true}` — принято · `422` — не прошло валидацию · `500 not_configured` —
не заданы переменные · `502 send_failed` — ошибка Green API (смотрите
`npx wrangler tail` для логов).
