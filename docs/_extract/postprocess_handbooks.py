"""Post-process converted handbooks: dedupe, front matter, repo-aligned addendum."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

MASTER_FRONT = """\
> **Dokumenttyp:** Langfristige Produkt- und Plattformreferenz (Master Handbook, Edition 2.4)  
> **Tagesaktuelle Informationen** (Entwicklungsstand, Backlog, Releases, KI-Einstieg): siehe `PROJECT_STATE.md`, `BACKLOG.md`, `RELEASE_PLAN.md`, `AI_CONTEXT.md` im Repository-Root.  
> **Technische Umsetzung:** siehe `docs/engineering/Engineering_Handbook.md`.

"""

ENGINEERING_FRONT = """\
> **Dokumenttyp:** Langfristige technische Referenz (Engineering Handbook, Edition 6.8)  
> **Tagesaktuelle Informationen** (Entwicklungsstand, Backlog, Releases, KI-Einstieg): siehe `PROJECT_STATE.md`, `BACKLOG.md`, `RELEASE_PLAN.md`, `AI_CONTEXT.md` im Repository-Root.  
> **Produktvision:** siehe `docs/master/Master_Handbook.md`.

"""

REPO_ADDENDUM = """

---

# Anhang – Referenzimplementierung im Repository (app-v2)

Dieser Anhang beschreibt ausschließlich den **nachweisbaren Implementierungsstand** im Repository `app-v2/`. Er ergänzt die zielarchitektonischen Kapitel dieses Handbuchs und ersetzt sie nicht. Für den aktuellen Tagesstand siehe `PROJECT_STATE.md`.

## Aktive Codebasis

| Bereich | Implementierung (Repository) |
|---------|------------------------------|
| App | Expo SDK 57, React Native 0.86, TypeScript, Expo Router |
| Web | React Native Web, statischer Export |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Datenzugriff | Repository-Pattern; Local- und Supabase-Datasources |
| Feature-Flag | `EXPO_PUBLIC_USE_SUPABASE` (Standard: lokaler Mock) |
| Tests | Vitest |
| Paketversion | `0.2.0` (`app-v2/package.json`) |

## Abweichungen zur Zielarchitektur in diesem Handbook

Die Kapitel zu Microservices, Java/Spring Boot, Flutter, Kafka und Kubernetes beschreiben die **langfristige Zielarchitektur**. Im Repository existiert derzeit eine **monolithische Expo-App** mit Supabase-Backend — keine separaten Microservices, kein Spring Boot, kein Flutter.

## Datenbank (implementiert)

Migrationen unter `app-v2/supabase/migrations/` (8 Dateien). Tabellen u. a.: `events`, `genres`, `cities`, `venues`, `artists`, `collections`, `sources`, `import_jobs`, `import_records`, `import_logs`, `import_audit_logs`. Primärschlüssel: `text` (nicht UUID wie in Ziel-DDLs). RLS aktiv; Hilfsfunktionen `is_admin()`, `admin_role()`, `has_admin_role()`.

## Authentifizierung (implementiert)

- Admin-Login unter `/admin/login` (Web-only Admin-Bereich)
- Supabase Auth; Rollen via JWT `app_metadata.role` (`viewer`, `editor`, `reviewer`, `source_manager`, `admin`, `owner`)
- Gemeinsamer Login für Consumer und Admin: **Ziel** (`BACKLOG.md` ER-001), noch nicht umgesetzt

## Import-Pipeline (implementiert)

Adapter (`json_ld`, `rss`, `atom`, `ical`, `csv`, `api_json`), Orchestrator, Matching, Review-Workflow. Manueller Import-Start; Scheduler/Webhook-Laufzeit im Datenmodell, nicht im Code.

## Verweise

- Architektur im Code: `app-v2/docs/ARCHITECTURE.md`, `app-v2/docs/backend.md`
- Import: `app-v2/docs/import-foundation.md` ff.
- Admin: `app-v2/docs/admin-web.md`
"""


def remove_zwischenstand(text: str) -> str:
    """Remove # Zwischenstand sections (heading + body until next # heading)."""
    pattern = re.compile(
        r"^# Zwischenstand[^\n]*\n(?:.(?!^# ))*\n?",
        re.MULTILINE | re.DOTALL,
    )
    return pattern.sub("", text)


def fix_glued_words(text: str) -> str:
    replacements = [
        ("Master Edition 0.1Diese", "Master Edition 0.1. Diese"),
        ("Version 3.1: Domain-Driven DesignVersion", "Version 3.1: Domain-Driven Design. Version"),
        ("DesignVersion 3.2", "Design. Version 3.2"),
        ("SQL-DDLsVersion 3.3", "SQL-DDLs. Version 3.3"),
        ("OpenAPIVersion 3.4", "OpenAPI. Version 3.4"),
        ("FrontendVersion 3.5", "Frontend. Version 3.5"),
        ("InfrastrukturVersion 3.6", "Infrastruktur. Version 3.6"),
        ("SecurityVersion 3.7", "Security. Version 3.7"),
        ("BetriebVersion", "Betrieb. Version"),
    ]
    for old, new in replacements:
        text = text.replace(old, new)
    return text


def condense_master_intro(text: str) -> str:
    """Replace duplicate executive-summary bullet blocks with chapter pointer."""
    marker_start = "## Leitbild"
    marker_end = "# Kapitel 0"
    start = text.find(marker_start)
    end = text.find(marker_end)
    if start == -1 or end == -1 or start >= end:
        return text

    replacement = """## Leitbild

Eternal Rave ist eine Community- und Social-Plattform für die elektronische Musikszene. Events stehen im Mittelpunkt, werden jedoch durch Artists, Venues, Festivals, Organizer, Creator und eine aktive Community ergänzt.

Die folgenden Kapitel (ab Kapitel 0) führen Vision, Strategie, Domänen, Datenmodell, Architektur und Roadmap ausführlich aus. Die ursprüngliche Kurzfassung (Leitbild, Vision, Produktstrategie, Kernobjekte, Rollenmodell, Technik, Business, Sicherheit, Roadmap) ist in den jeweiligen Kapiteln enthalten und wurde hier zusammengeführt, um Dopplungen zu vermeiden.

"""
    return text[:start] + replacement + text[end:]


def remove_duplicate_user_schema_chapter_48(text: str) -> str:
    """Remove Kapitel 48 (shorter User schema); Kapitel 54 is the expanded version."""
    pattern = re.compile(
        r"^# Kapitel 48 – Physisches Datenbankschema: User\n.*?(?=^# Kapitel 49)",
        re.MULTILINE | re.DOTALL,
    )
    note = (
        "> **Hinweis:** Das physische Datenbankschema für User wurde in Kapitel 54 "
        "(erweiterte Fassung) zusammengeführt. Kapitel 48 entfällt als Duplikat.\n\n"
    )
    if pattern.search(text):
        text = pattern.sub(note, text)
    return text


def dedupe_openapi_standards(text: str) -> str:
    """Shorten duplicate OpenAPI list in Kapitel 56 if Kapitel 49 exists."""
    old = """# Kapitel 56 – OpenAPI-Standards

Alle REST-Endpunkte werden mit OpenAPI 3.1 dokumentiert.

- Einheitliche Error-Responses (Problem Details RFC7807).
- JWT Bearer Authentication.
- Versionierung über /v1.
- Cursor Pagination.
- Idempotency-Key für kritische POST-Endpunkte.
- Rate-Limit Header.
"""
    new = """# Kapitel 56 – OpenAPI-Standards

Siehe Kapitel 49 (OpenAPI-Richtlinien) und Kapitel 43 (OpenAPI-Konventionen). Ergänzend gelten Rate-Limit-Header für öffentliche Endpunkte.
"""
    return text.replace(old, new)


def add_kapitel6_implementation_note(text: str) -> str:
    needle = """# Kapitel 7 – Domänenmodell"""
    insert = """

### Referenzimplementierung im Repository (app-v2)

Die folgende Tabelle beschreibt den **aktuell im Repository implementierten** Stack. Sie ergänzt die empfohlenen Technologien oben und widerspricht der Zielarchitektur nicht.

| Bereich | Implementiert (app-v2) |
|---------|------------------------|
| Client | React Native + Expo SDK 57, TypeScript, Expo Router |
| Web | React Native Web (statischer Export) |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Mobile | Android- und iOS-native Projekte via Expo (kein Flutter im Repository) |
| Datenbank | PostgreSQL via Supabase |
| CI/Qualität | `npm run release:check`, Vitest, ESLint, TypeScript strict |

Details und Tabellenstand: Anhang am Ende dieses Handbuchs sowie `PROJECT_STATE.md`.

"""
    if needle in text and "Referenzimplementierung im Repository" not in text:
        text = text.replace(needle, insert + needle)
    return text


def collapse_blank_lines(text: str, max_blank: int = 2) -> str:
    out: list[str] = []
    blank = 0
    for line in text.splitlines():
        if line.strip() == "":
            blank += 1
            if blank <= max_blank:
                out.append("")
        else:
            blank = 0
            out.append(line)
    return "\n".join(out).strip() + "\n"


def process_master(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith(">"):
        # insert after first title line
        lines = text.splitlines()
        lines.insert(1, "")
        lines.insert(2, MASTER_FRONT.strip())
        text = "\n".join(lines)
    text = fix_glued_words(text)
    text = condense_master_intro(text)
    text = remove_zwischenstand(text)
    text = remove_duplicate_user_schema_chapter_48(text)
    text = dedupe_openapi_standards(text)
    text = collapse_blank_lines(text)
    path.write_text(text, encoding="utf-8")


def process_engineering(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    if not text.startswith(">"):
        lines = text.splitlines()
        lines.insert(1, "")
        lines.insert(2, ENGINEERING_FRONT.strip())
        text = "\n".join(lines)
    text = fix_glued_words(text)
    text = remove_zwischenstand(text)
    text = add_kapitel6_implementation_note(text)
    if "Anhang – Referenzimplementierung im Repository" not in text:
        text = text.rstrip() + REPO_ADDENDUM
    text = collapse_blank_lines(text)
    path.write_text(text, encoding="utf-8")


def main() -> None:
    process_master(ROOT / "master" / "Master_Handbook.md")
    process_engineering(ROOT / "engineering" / "Engineering_Handbook.md")
    print("Post-processing complete.")


if __name__ == "__main__":
    main()
