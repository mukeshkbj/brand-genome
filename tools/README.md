# Custom tools used by the agents

Configured in Krifth (Build > Tools). No secrets are stored here.

| Tool | Method and URL | Reads back |
|---|---|---|
| Live GHS exchange rates | `GET https://open.er-api.com/v6/latest/GHS` | `rates` (ok when `result` = `success`) |
| Accra 7-day weather | `GET https://api.open-meteo.com/v1/forecast?latitude=5.6037&longitude=-0.1870&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=Africa%2FAccra&forecast_days=7` | `daily` |
| Owner phone alert (ntfy) | `POST https://ntfy.sh/` with JSON body `{topic, title, message}` | message id |
| Ghana public holidays | `GET https://date.nager.at/api/v3/NextPublicHolidays/GH` | first holiday |

What we learned building them on Krifth (sent to Krifth as feature requests):
- In agent runs a tool needs a `result_path` that points at one field, or the agent gets `null`.
- Replies that are a bare JSON list can't be read by agents yet, so the holidays tool works in the editor test but not in runs. The task goal carries the dates instead.
- Query parameters for GET tools go in the URL; static fields aren't sent in agent runs.
