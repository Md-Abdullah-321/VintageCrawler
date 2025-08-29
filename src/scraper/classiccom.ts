/**
 * Title: ClassicCom
 * Description: Scraper for Classic.com website.
 * Author: Md Abdullah
 * Date: 29/08/2025
 */

import {
  clickElement,
  gotoPage,
  typeLikeHuman,
} from "../helpers/navigation.js";

// Dependencies
import dotenv from "dotenv";
import { wait } from "../helpers/utils.js";
dotenv.config();

// Scrap Functions
export const scrapClassicCom = async (
  browser: any,
  page: any,
  make: string,
  model: string
) => {
  try {
    // Navigate to Classic.com
    await gotoPage(page, process.env.CLASSIC_COM_BASE_URL!, 60000);
    await wait(1500);

    // --- click on search bar ---
    await clickElement(page, '[name="search"]');
    await wait(1000);

    // --- Type make and model ---
    await typeLikeHuman(page, '[name="search"]', `${make} ${model}`);

    // --- Enter key to search ---
    await page.keyboard.press("Enter");
    await wait(5000);

    // --- capture number of total results ---
    const totalResultsText = await page.$eval(
      "#search_live > div > div:nth-of-type(4) .font-medium:nth-of-type(2)",
      (el: any) => el.textContent?.trim() || ""
    );

    // --- Calculate total pages ---
    if (!totalResultsText) {
      console.log("❌ No results found on Classic.com");
      return [];
    }

    const maxPages = Math.ceil(parseInt(totalResultsText) / 24);
    let currentPage = 1;
    let results: any[] = [];

    while (currentPage <= maxPages) {
      await page.$eval(
        "#search_live > div > div:nth-child(6)",
        (el: HTMLElement) =>
          el.scrollIntoView({ behavior: "smooth", block: "start" })
      );
      await wait(1000);

      const allResults = await extractCarsFromPage(page);
      results = results.concat(allResults);

      console.log(
        `✅ Page ${currentPage}/${maxPages} scraped, found ${allResults.length} cars.`
      );

      const nextClicked = await clickNextButton(page);
      if (!nextClicked) break;

      await wait(3000);
      currentPage++;
    }

    console.log(`✅ Scraped ${results.length} total cars from Classic.com.`);

    return results;
  } catch (error) {
    console.error("❌ Error scraping Classic.com: ", error);
    return [];
  }
};

// 🔹 Scraper function (fat arrow)
const extractCarsFromPage = async (page: any) => {
  return await page.$$eval(
    "#search_live > div > div:nth-child(6) .group",
    (groups: any) =>
      Array.from(groups).map((el: any) => {
        const fullTitle = el.querySelector("h3 a")?.textContent?.trim() || "";

        // Extract year, make, model
        const yearMatch = fullTitle.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : "";
        let make = "";
        let model = "";
        if (year) {
          const afterYear = fullTitle
            .slice(fullTitle.indexOf(year) + year.length)
            .trim();
          const parts = afterYear.split(/\s+/);
          make = parts[0] || "";
          model = parts.slice(1).join(" ") || "";
        }

        const auction_name = fullTitle || "";
        const link = el.querySelector("h3 a")?.getAttribute("href") || "";
        const link_v2 = link;
        const image = el.querySelector("a img")?.getAttribute("src") || "";

        const auction_location =
          el
            .querySelector(
              ".flex.gap-2.items-center.text-white div, .table\\:block .flex.gap-2.items-center.text-gray-500 div"
            )
            ?.textContent?.trim() || "";

        const auction_house =
          el.querySelector("a.hover\\:underline")?.textContent?.trim() || "";

        const statusEl = el.querySelector(".border.font-medium.uppercase");
        const auction_desc = statusEl ? statusEl.textContent.trim() : "";

        const price_usd_string =
          el
            .querySelector(
              `#vehicle-listing-${el.id}-price, #vehicle-listing-${el.id}-table-price`
            )
            ?.textContent?.trim() || "";

        const auction_date_long =
          el.querySelectorAll(".text-gray-500")[3]?.innerText?.trim() || "";

        const sourceUrl = window.location.href;

        // Build object only with keys that have values
        const carData: any = {};
        if (auction_date_long) carData.auction_date_long = auction_date_long;
        if (auction_desc) carData.auction_desc = auction_desc;
        if (auction_house) carData.auction_house = auction_house;
        if (auction_location) carData.auction_location = auction_location;
        if (auction_name) carData.auction_name = auction_name;
        if (image) carData.image = image;
        if (link) carData.link = link;
        if (link_v2) carData.link_v2 = link_v2;
        if (price_usd_string) carData.price_usd_string = price_usd_string;
        if (year) carData.year = year;
        if (sourceUrl) carData.sourceUrl = sourceUrl;

        return carData;
      })
  );
};

const clickNextButton = async (page: any) => {
  const clicked = await page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        "#search_live > div > div:nth-child(7) a"
      )
    );
    for (const anchor of anchors) {
      if (anchor.innerText.trim() === "chevron_right") {
        anchor.scrollIntoView({ behavior: "smooth", block: "center" });
        anchor.click();
        return true;
      }
    }
    return false;
  });

  if (clicked) {
    await wait(1500); // wait for page navigation to start
  }

  return clicked;
};
