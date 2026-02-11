from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo


BRASILIA_TZ = ZoneInfo("America/Sao_Paulo")


def _ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _format_ics_datetime(dt: datetime) -> str:
    return _ensure_utc(dt).strftime("%Y%m%dT%H%M%SZ")


def _escape_ics_text(value: str) -> str:
    # RFC 5545 escaping for text values.
    return (
        value.replace("\\", "\\\\")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def format_brasilia_date(dt: datetime) -> str:
    return dt.astimezone(BRASILIA_TZ).strftime("%d/%m/%Y")


def format_brasilia_time(dt: datetime) -> str:
    return dt.astimezone(BRASILIA_TZ).strftime("%H:%M")


def generate_ics(event: object, user: object, tenant: object) -> bytes:
    event_id = str(getattr(event, "id"))
    start_at: datetime = getattr(event, "inicio_em")
    end_at: datetime | None = getattr(event, "fim_em", None)
    if end_at is None:
        end_at = start_at + timedelta(hours=1)

    title = _escape_ics_text(str(getattr(event, "titulo", "Evento")))
    description_parts = []
    event_description = getattr(event, "descricao", None)
    if event_description:
        description_parts.append(str(event_description))
    description_parts.append("Criado no Elemento Juris")
    description = _escape_ics_text(" | ".join(description_parts))

    location = getattr(event, "location", None) or getattr(event, "local", None)
    location_line = f"LOCATION:{_escape_ics_text(str(location))}" if location else None

    uid = f"{event_id}@elementojuris.cloud"
    now_utc = datetime.now(UTC)
    organizer_name = str(getattr(tenant, "nome", "Elemento Juris"))
    organizer_email = str(getattr(user, "email", "noreply@elementojuris.cloud"))

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Elemento Juris//Agenda//PT-BR",
        "CALSCALE:GREGORIAN",
        "METHOD:REQUEST",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{_format_ics_datetime(now_utc)}",
        f"DTSTART:{_format_ics_datetime(start_at)}",
        f"DTEND:{_format_ics_datetime(end_at)}",
        f"SUMMARY:{title}",
        f"DESCRIPTION:{description}",
        f"ORGANIZER;CN={_escape_ics_text(organizer_name)}:MAILTO:{organizer_email}",
    ]
    if location_line:
        lines.append(location_line)
    lines.extend(["END:VEVENT", "END:VCALENDAR", ""])

    return "\r\n".join(lines).encode("utf-8")
