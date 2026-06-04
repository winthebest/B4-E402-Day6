import time
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options


BASE_URL = "https://booking.vinpearl.com"
SEARCH_URL = (
    "https://booking.vinpearl.com/vi-VND/tours-and-experiences/search"
    "?pageIndex={page}&pageSize=8&totalCount=197"
)

options = Options()
# options.add_argument("--headless=new")  # bật nếu không muốn mở browser
options.add_argument("--start-maximized")

driver = webdriver.Chrome(options=options)

all_links = []

try:
    for page in range(1, 26):
        url = SEARCH_URL.format(page=page)
        print(f"Opening page {page}: {url}")

        driver.get(url)
        time.sleep(5)

        cards = driver.find_elements(
            By.CSS_SELECTOR,
            ".g-bg-white.product-info.g-mb-20.experience-search-list"
        )

        print(f"Found {len(cards)} cards")

        for card in cards:
            try:
                a_tag = card.find_element(By.TAG_NAME, "a")
                href = a_tag.get_attribute("href")

                if href:
                    href = urljoin(BASE_URL, href)
                    all_links.append(href)
                    print(href)

            except Exception:
                pass

finally:
    driver.quit()


# remove duplicate
all_links = list(dict.fromkeys(all_links))

print("\nTOTAL LINKS:", len(all_links))

with open("vinpearl_tour_links.txt", "w", encoding="utf-8") as f:
    for link in all_links:
        f.write(link + "\n")