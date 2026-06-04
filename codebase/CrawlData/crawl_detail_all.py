import os
import re
import time
import json

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


LINK_FILE = "vinpearl_tour_links.txt"
OUTPUT_DIR = "dataset"

os.makedirs(OUTPUT_DIR, exist_ok=True)

options = Options()
options.add_argument("--start-maximized")
# options.add_argument("--headless=new")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 20)


def sanitize_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = re.sub(r"\s+", "_", name)
    return name[:150]


def get_links(file_path):
    links = []

    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            link = line.strip()

            if link:
                links.append(link)

    return links


links = get_links(LINK_FILE)

print("TOTAL LINKS:", len(links))


try:
    for link_index, url in enumerate(links, start=1):

        print("\n" + "=" * 80)
        print(f"[{link_index}/{len(links)}] OPEN:", url)

        try:
            driver.get(url)

            # =========================
            # CHỜ THANH TAB
            # =========================
            tab_header = wait.until(
                EC.visibility_of_element_located(
                    (
                        By.CSS_SELECTOR,
                        ".tab-sticky-header.g-pos-sticky.g-top-0"
                    )
                )
            )

            # scroll tới tab
            driver.execute_script(
                "arguments[0].scrollIntoView({block:'center'});",
                tab_header
            )

            # chờ lazy load
            time.sleep(5)

            # =========================
            # LẤY TÊN
            # =========================
            title = ""

            try:
                title_el = wait.until(
                    EC.visibility_of_element_located(
                        (
                            By.CSS_SELECTOR,
                            "h4.w-100.g-font-size-24.g-font-weight-600.text-left"
                        )
                    )
                )

                title = title_el.text.strip()

            except Exception as e:
                print("TITLE ERROR:", e)

            # =========================
            # LẤY GIÁ
            # =========================
            original_price = ""
            sale_price = ""

            try:
                original_price_el = driver.find_element(
                    By.CSS_SELECTOR,
                    "del.origin-price"
                )

                original_price = original_price_el.text.strip()

            except Exception:
                pass

            try:
                sale_price_el = driver.find_element(
                    By.CSS_SELECTOR,
                    "p.sale-price"
                )

                sale_price = sale_price_el.text.strip()

            except Exception:
                pass

            # =========================
            # RESULT
            # =========================
            result = {
                "url": url,
                "title": title,
                "original_price": original_price,
                "sale_price": sale_price,
                "tabs": []
            }

            # =========================
            # LẤY TABS
            # =========================
            tabs = driver.find_elements(
                By.CSS_SELECTOR,
                'div[role="tab"].ant-tabs-tab'
            )

            total_tabs = len(tabs)

            print("TOTAL TABS:", total_tabs)

            for i in range(total_tabs):

                try:
                    # reload tabs tránh stale
                    tabs = driver.find_elements(
                        By.CSS_SELECTOR,
                        'div[role="tab"].ant-tabs-tab'
                    )

                    tab = tabs[i]

                    tab_name = tab.text.strip()

                    if not tab_name:
                        tab_name = f"tab_{i + 1}"

                    print(f"CLICK TAB {i + 1}: {tab_name}")

                    # scroll tới tab
                    driver.execute_script(
                        "arguments[0].scrollIntoView({block:'center'});",
                        tab
                    )

                    # click tab
                    driver.execute_script(
                        "arguments[0].click();",
                        tab
                    )

                    # chờ render
                    active_panel = wait.until(
                        EC.visibility_of_element_located(
                            (
                                By.CSS_SELECTOR,
                                'div[role="tabpanel"][aria-hidden="false"]'
                            )
                        )
                    )

                    time.sleep(1)

                    # =========================
                    # CONTENT
                    # =========================
                    panel_text = active_panel.text.strip()

                    panel_html = active_panel.get_attribute("outerHTML")

                    # =========================
                    # IMAGES
                    # =========================
                    images = []

                    imgs = active_panel.find_elements(By.TAG_NAME, "img")

                    for img in imgs:
                        src = img.get_attribute("src")
                        alt = img.get_attribute("alt")

                        if src:
                            images.append({
                                "src": src,
                                "alt": alt
                            })

                    result["tabs"].append({
                        "tab_name": tab_name,
                        "text": panel_text,
                        "html": panel_html,
                        "images": images
                    })

                    print("DONE TAB")

                except Exception as e:
                    print(f"TAB ERROR {i + 1}:", e)

            # =========================
            # SAVE JSON
            # =========================
            filename = sanitize_filename(title)

            if not filename:
                filename = f"item_{link_index}"

            output_path = os.path.join(
                OUTPUT_DIR,
                f"{filename}.json"
            )

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(
                    result,
                    f,
                    ensure_ascii=False,
                    indent=2
                )

            print("SAVED:", output_path)

        except Exception as e:
            print("PAGE ERROR:", e)

finally:
    driver.quit()