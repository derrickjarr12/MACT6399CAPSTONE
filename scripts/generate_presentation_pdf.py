#!/usr/bin/env python3
import os
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "TitleStyle",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=30,
            leading=34,
            alignment=TA_CENTER,
            spaceAfter=18,
            textColor=colors.HexColor("#0c1f3f"),
        ),
        "subtitle": ParagraphStyle(
            "SubtitleStyle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=14,
            leading=18,
            alignment=TA_CENTER,
            spaceAfter=8,
            textColor=colors.HexColor("#1d3557"),
        ),
        "h2": ParagraphStyle(
            "H2Style",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            spaceBefore=14,
            spaceAfter=10,
            textColor=colors.HexColor("#102a43"),
        ),
        "h3": ParagraphStyle(
            "H3Style",
            parent=base["Heading3"],
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            spaceBefore=10,
            spaceAfter=6,
            textColor=colors.HexColor("#243b53"),
        ),
        "body": ParagraphStyle(
            "BodyStyle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            alignment=TA_LEFT,
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "BulletStyle",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            leading=16,
            leftIndent=18,
            firstLineIndent=-12,
            spaceAfter=4,
        ),
        "meta": ParagraphStyle(
            "MetaStyle",
            parent=base["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#486581"),
            spaceAfter=8,
        ),
    }
    return styles


def sanitize(text):
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    text = text.replace("->", "&#8594;")
    return text


def parse_markdown(md_path):
    with md_path.open("r", encoding="utf-8") as f:
        return f.read().splitlines()


def image_path_from_md(md_dir, line):
    m = re.match(r"!\[[^\]]*\]\(([^)]+)\)", line.strip())
    if not m:
        return None
    raw = m.group(1)
    img_path = (md_dir / raw).resolve()
    return img_path if img_path.exists() else None


def build_table(rows):
    table = Table(rows, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#d9e2ec")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#102a43")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#bcccdc")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("LEADING", (0, 0), (-1, -1), 13),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def render(md_path, out_path):
    styles = build_styles()
    lines = parse_markdown(md_path)
    md_dir = md_path.parent

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=letter,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.85 * inch,
        bottomMargin=0.85 * inch,
        title="SAION V1 Combined Manual",
        author="SAION",
    )

    story = []
    first_h2_seen = False
    in_table = False
    table_rows = []

    for raw in lines:
        line = raw.rstrip("\n")
        stripped = line.strip()

        if in_table and (not stripped.startswith("|")):
            if table_rows:
                story.append(build_table(table_rows))
                story.append(Spacer(1, 8))
            table_rows = []
            in_table = False

        if not stripped:
            story.append(Spacer(1, 6))
            continue

        img_path = image_path_from_md(md_dir, stripped)
        if img_path:
            img = Image(str(img_path))
            img._restrictSize(3.2 * inch, 1.5 * inch)
            story.append(img)
            story.append(Spacer(1, 12))
            continue

        if stripped.startswith("# "):
            story.append(Paragraph(sanitize(stripped[2:].strip()), styles["title"]))
            continue

        if stripped.startswith("## "):
            heading = stripped[3:].strip()
            is_major_section = re.match(r"^\d+\.\s", heading) is not None
            if first_h2_seen and is_major_section:
                story.append(PageBreak())
            first_h2_seen = True
            story.append(Paragraph(sanitize(heading), styles["h2"]))
            continue

        if stripped.startswith("### "):
            story.append(Paragraph(sanitize(stripped[4:].strip()), styles["h3"]))
            continue

        if stripped == "---":
            story.append(Spacer(1, 10))
            continue

        if stripped.startswith("|"):
            in_table = True
            if re.match(r"^\|[-\s|:]+\|$", stripped):
                continue
            cells = [c.strip() for c in stripped.strip("|").split("|")]
            table_rows.append(cells)
            continue

        if stripped.lower().startswith("author voice:"):
            story.append(Paragraph(sanitize(stripped), styles["meta"]))
            continue

        num = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if num:
            story.append(Paragraph(sanitize(f"{num.group(1)}. {num.group(2)}"), styles["bullet"]))
            continue

        story.append(Paragraph(sanitize(stripped), styles["body"]))

    if in_table and table_rows:
        story.append(build_table(table_rows))

    doc.build(story)


def main():
    if len(sys.argv) != 3:
        print("Usage: generate_presentation_pdf.py <input.md> <output.pdf>")
        sys.exit(1)

    md_path = Path(sys.argv[1]).resolve()
    out_path = Path(sys.argv[2]).resolve()

    if not md_path.exists():
        print(f"Input file not found: {md_path}")
        sys.exit(1)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    render(md_path, out_path)
    print(f"Generated: {out_path}")


if __name__ == "__main__":
    main()
