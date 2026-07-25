import json
from pathlib import Path


def to_md(items: list[dict]) -> str:
    lines: list[str] = []
    in_list = False

    for it in items:
        text = (
            it["text"]
            .replace("\u2013", "–")
            .replace("\u2014", "—")
            .replace("\u201c", '"')
            .replace("\u201d", '"')
            .replace("\u00a0", " ")
            .strip()
        )
        style = it.get("style")

        if style == "Title":
            if not lines:
                lines.extend([f"# {text}", ""])
            continue

        if style == "Heading1":
            if in_list:
                lines.append("")
                in_list = False
            lines.extend([f"# {text}", ""])
        elif style == "Heading2":
            if in_list:
                lines.append("")
                in_list = False
            lines.extend([f"## {text}", ""])
        elif style == "Heading3":
            if in_list:
                lines.append("")
                in_list = False
            lines.extend([f"### {text}", ""])
        elif style in ("ListBullet", "ListNumber"):
            in_list = True
            lines.append(f"- {text}")
        elif style == "IntenseQuote":
            if in_list:
                lines.append("")
                in_list = False
            lines.extend([f"> {text}", ""])
        else:
            if in_list:
                lines.append("")
                in_list = False
            if it.get("bold") and len(text) < 80 and not text.endswith("."):
                lines.extend([f"### {text}", ""])
            else:
                lines.extend([text, ""])

    out: list[str] = []
    blank = 0
    for line in lines:
        if line == "":
            blank += 1
            if blank <= 2:
                out.append(line)
        else:
            blank = 0
            out.append(line)
    return "\n".join(out).strip() + "\n"


def main() -> None:
    base = Path(__file__).parent
    mappings = [
        (
            "Eternal_Rave_Master_Handbook_2.4_Final(1).docx.json",
            base.parent / "master" / "Master_Handbook.md",
        ),
        (
            "Eternal_Rave_Engineering_Handbook_6.8(1).docx.json",
            base.parent / "engineering" / "Engineering_Handbook.md",
        ),
    ]
    for src_name, out_path in mappings:
        items = json.loads((base / src_name).read_text(encoding="utf-8"))
        md = to_md(items)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(md, encoding="utf-8")
        print(f"Wrote {out_path} ({len(md)} chars)")


if __name__ == "__main__":
    main()
