import time
import json

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


LINK_FILE = "vinpearl_tour_links.txt"

options = Options()
options.add_argument("--start-maximized")
# options.add_argument("--headless=new")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 20)


def get_first_link(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            link = line.strip()
            if link:
                return link
    return None


try:
    # =========================
    # LẤY 1 LINK ĐẦU TIÊN
    # =========================
    url = get_first_link(LINK_FILE)

    if not url:
        raise ValueError("Không tìm thấy link trong file")

    print("OPEN:", url)

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

    # cuộn tới tab
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

    except Exception as e:
        print("ORIGINAL PRICE ERROR:", e)

    try:
        sale_price_el = driver.find_element(
            By.CSS_SELECTOR,
            "p.sale-price"
        )

        sale_price = sale_price_el.text.strip()

    except Exception as e:
        print("SALE PRICE ERROR:", e)

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

        # reload tabs tránh stale element
        tabs = driver.find_elements(
            By.CSS_SELECTOR,
            'div[role="tab"].ant-tabs-tab'
        )

        tab = tabs[i]

        tab_name = tab.text.strip()

        if not tab_name:
            tab_name = f"tab_{i + 1}"

        print(f"\nCLICK TAB {i + 1}: {tab_name}")

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

        # chờ render tab content
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
        # LẤY CONTENT
        # =========================
        panel_text = active_panel.text.strip()

        panel_html = active_panel.get_attribute("outerHTML")

        # =========================
        # LẤY IMAGES
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

        print("DONE")

    # =========================
    # SAVE JSON
    # =========================
    with open(
        "vinpearl_one_link_all_tabs.json",
        "w",
        encoding="utf-8"
    ) as f:
        json.dump(
            result,
            f,
            ensure_ascii=False,
            indent=2
        )

    print("\nDONE SAVE JSON")

finally:
    driver.quit()