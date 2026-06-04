import json
import os
import re


INPUT_DIR = "dataset"
OUTPUT_DIR = "dataset_markdown"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def clean_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = re.sub(r"\s+", "_", name)
    return name[:120]


def json_to_markdown(data):
    lines = []

    title = data.get("title", "").strip()
    url = data.get("url", "").strip()
    original_price = data.get("original_price", "").strip()
    sale_price = data.get("sale_price", "").strip()

    # =========================
    # HEADER
    # =========================
    lines.append(f"# {title}")
    lines.append("")

    lines.append(f"- URL: {url}")
    lines.append(f"- Giá gốc: {original_price}")
    lines.append(f"- Giá hiện tại: {sale_price}")
    lines.append("")

    # =========================
    # TABS
    # =========================
    tabs = data.get("tabs", [])

    for tab in tabs:

        tab_name = tab.get("tab_name", "").strip()
        text = tab.get("text", "").strip()
        images = tab.get("images", [])

        lines.append(f"## {tab_name}")
        lines.append("")

        # =========================
        # TEXT
        # =========================
        if text:
            lines.append(text)
            lines.append("")

        # =========================
        # IMAGES
        # =========================
        if images:

            lines.append("### Hình ảnh")
            lines.append("")

            for img in images:

                src = img.get("src", "").strip()
                alt = img.get("alt", "").strip()

                if not alt:
                    alt = "image"

                if src:
                    lines.append(f"![{alt}]({src})")

            lines.append("")

    return "\n".join(lines)


# =========================
# LOAD ALL JSON FILES
# =========================
json_files = [
    f for f in os.listdir(INPUT_DIR)
    if f.endswith(".json")
]

print("TOTAL JSON FILES:", len(json_files))


# =========================
# CONVERT
# =========================
for index, json_file in enumerate(json_files, start=1):

    try:
        print(f"\n[{index}/{len(json_files)}] PROCESS:", json_file)

        json_path = os.path.join(INPUT_DIR, json_file)

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        markdown = json_to_markdown(data)

        # =========================
        # OUTPUT NAME
        # =========================
        title = data.get("title", "").strip()

        if title:
            output_name = clean_filename(title)
        else:
            output_name = os.path.splitext(json_file)[0]

        output_path = os.path.join(
            OUTPUT_DIR,
            f"{output_name}.md"
        )

        # =========================
        # SAVE MD
        # =========================
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown)

        print("SAVED:", output_path)

    except Exception as e:
        print("ERROR:", json_file)
        print(e)


print("\nDONE")