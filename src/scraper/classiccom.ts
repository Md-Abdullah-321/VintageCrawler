/**
 * Title: ClassicCom
 * Description: Scraper for Classic.com website with normalized output (reference schema).
 * Author: Md Abdullah
 * Date: 29/08/2025
 */

import {
  clickElement,
  gotoPage,
  typeLikeHuman,
} from "../helpers/navigation.js";

import dotenv from "dotenv";
import { wait } from "../helpers/utils.js";
dotenv.config();

/* ------------------------ Helpers (Node context) ------------------------ */

const parsePriceNumber = (priceString: string | null | undefined) => {
  if (!priceString) return null;
  const n = Number((priceString || "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(n) ? n : null;
};

const normalizeStatus = (desc: string | null | undefined) => {
  if (!desc) return "";
  const lower = desc.toLowerCase();
  if (lower.includes("not sold")) return "Not Sold";
  if (lower.includes("sold")) return "Sold";
  if (lower.includes("for sale")) return "For Sale";
  if (lower.includes("last asking")) return "Last Asking";
  if (lower.includes("price undisclosed")) return "Price Undisclosed";
  return "";
};

/** Derive price fields based on symbol in the text */
/** Derive price fields based on symbol in the text */
const derivePriceFields = (priceText: string | null | undefined) => {
  let pt = priceText || "";

  // If text contains "(...)" and that part has a USD value, keep only that
  const matchUsdInBrackets = pt.match(/\(([^)]*\$[0-9,.\s]+)\)/);
  if (matchUsdInBrackets) {
    pt = matchUsdInBrackets[1].trim(); // keep USD inside brackets
  }

  // Otherwise keep as is
  const hasUSD = pt.includes("$");

  const num = parsePriceNumber(pt);

  return {
    price_usd_number: hasUSD ? num?.toString()?.trim() : null,
    price_usd_string: hasUSD ? pt?.toString()?.trim() : "",
    price_gbp_number: null, // we ignore GBP
    price_gbp_string: "",
    price_eur_number: null, // we ignore EUR
    price_eur_string: "",
  };
};

type RawClassicItem = {
  auction_date_long: string;
  auction_house: string;
  auction_location: string;
  title: string;
  link: string;
  link_v2: string;
  image: string;
  status_text: string; // "Sold" | "Not Sold" | "For Sale" | etc.
  price_text: string; // e.g. "$1,540,000" or "£1,179,070" or "€1,383,342"
  year: string;
  sourceUrl: string;
};

const transformClassicItem = (raw: RawClassicItem) => {
  const {
    price_usd_number,
    price_usd_string,
    price_gbp_number,
    price_gbp_string,
    price_eur_number,
    price_eur_string,
  } = derivePriceFields(raw.price_text);

  // Auction description in reference looks like "House • Year/Date"
  const auctionDesc = [raw.auction_house, raw.auction_date_long]
    .filter(Boolean)
    .join(" • ");

  // Event-ish name (fallback: first part of location)
  const auctionName =
    (raw.auction_location ? raw.auction_location.split(",")[0] : "") || "";

  return {
    // --- Reference schema fields ---
    auction_date_long: raw.auction_date_long.toString().trim() || "",
    auction_desc: auctionDesc.toString().trim() || "",
    auction_house: raw.auction_house.toString().trim() || "",
    auction_location: raw.auction_location.toString().trim() || "",
    auction_name: auctionName.toString().trim() || "",
    lot_description: raw.title.toString().trim() || "",

    chassis_number: "", // not scraped here
    reg_number: "", // not scraped here

    image: raw.image || "",

    link: raw.link || "",
    link_v2: raw.link_v2 || "",
    url: raw.link?.startsWith("http")
      ? raw.link
      : `https://www.classic.com${raw.link || ""}`,

    price_usd_number: price_usd_number?.toString().trim() || null,
    price_usd_string : price_usd_string?.toString().trim() || "",
    price_gbp_number,
    price_gbp_string,
    price_eur_number,
    price_eur_string,

    status: normalizeStatus(raw.status_text),
    year: raw.year || "",
    sourceUrl: raw.sourceUrl || "",
  };
};

/* ---------------------------- Main Scraper ----------------------------- */

export const scrapClassicCom = async (
  browser: any,
  page: any,
  make: string,
  model: string,
  transmission: string
) => {
  try {
    // Navigate to Classic.com
    await gotoPage(page, process.env.CLASSIC_COM_BASE_URL!, 60000);
    console.log("📄 Page loaded:", await page.title());
    await wait(1500);

    // --- click on search bar ---
    await clickElement(page, '[name="search"]');
    await wait(1000);

    // --- Type make and model ---
    await typeLikeHuman(
      page,
      '[name="search"]',
      `${make} ${model} ${transmission}`.trim()
    );

    // --- Enter key to search ---
    await page.keyboard.press("Enter");
    await wait(5000);

    // --- capture number of total results ---
    const totalResultsText = await page.$eval(
      "#search_live > div > div:nth-of-type(4) .font-medium:nth-of-type(2)",
      (el: any) => el.textContent?.trim() || ""
    );

    if (!totalResultsText) {
      console.log("❌ No results found on Classic.com");
      return [];
    }

    const maxPages = Math.ceil(parseInt(totalResultsText, 10) / 24);
    let currentPage = 1;
    let results: any[] = [];

    while (currentPage <= maxPages) {
      await page.$eval(
        "#search_live > div > div:nth-child(6)",
        (el: HTMLElement) =>
          el.scrollIntoView({ behavior: "smooth", block: "start" })
      );
      await wait(1000);

      // Get normalized items for this page (extraction in browser, transform in Node)
      const pageItems = await extractAndTransformCarsFromPage(page);
      results = results.concat(pageItems);

      console.log(
        `✅ Page ${currentPage}/${maxPages} scraped, found ${pageItems.length} cars.`
      );

      const nextClicked = await clickNextButton(page);
      if (!nextClicked) break;

      await wait(3000);
      currentPage++;
    }

    return results;
  } catch (error) {
    console.error("❌ Error scraping Classic.com: ", error);
    return [];
  }
};

/* -------- Extract RAW in browser context, then transform in Node -------- */

const extractAndTransformCarsFromPage = async (page: any) => {
  const rawItems: RawClassicItem[] = await page.$$eval(
    "#search_live > div > div:nth-child(6) .group",
    (groups: any) =>
      Array.from(groups).map((el: any) => {
        const fullTitle = el.querySelector("h3 a")?.textContent?.trim() || "";

        // Extract year (keep for output)
        const yearMatch = fullTitle.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : "";

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
        const status_text = statusEl ? statusEl.textContent.trim() : "";

        const price_text =
          el
            .querySelector(
              `#vehicle-listing-${el.id}-price, #vehicle-listing-${el.id}-table-price`
            )
            ?.textContent?.trim() || "";

        const dateCandidates = Array.from(
          el.querySelectorAll(".text-gray-500")
        ).map((n: any) => n?.innerText?.trim() || "");

        const auction_date_long =
          dateCandidates[3] || dateCandidates[2] || dateCandidates[1] || "";

        const sourceUrl = window.location.href;

        // ✅ Transmission extraction (defensive)
        let transmission = "";
        try {
          transmission =
            el
              .querySelector("h3")
              ?.nextElementSibling?.nextElementSibling?.querySelectorAll(
                ".items-center"
              )[1]
              ?.innerText?.trim() || "";
        } catch (e) {
          transmission = "";
        }

        const raw: RawClassicItem = {
          auction_date_long,
          auction_house,
          auction_location,
          title: fullTitle.toLowerCase().includes(transmission.toLowerCase())
            ? fullTitle
            : `${fullTitle} ${transmission}`.trim(),
          link,
          link_v2,
          image,
          status_text,
          price_text,
          year,
          sourceUrl,
        };

        return raw;
      })
  );

  // Transform to reference format in Node context (helpers available here)
  return rawItems.map(transformClassicItem);
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
