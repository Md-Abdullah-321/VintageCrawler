/**
 * Title: classicvaluer.ts
 * Description: Scrap data from theclassicvaluer.com
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import { EventEmitter } from "events";
import {
  clickElement,
  gotoPage,
  typeLikeHuman,
} from "../helpers/navigation.js";

// Dependencies
import dotenv from "dotenv";
import re from "re2";
import { wait } from "../helpers/utils.js";
dotenv.config();

export const scrapClassicValuer = async (
  browser: any,
  page: any,
  make: string,
  model: string
) => {
  try {
    // Navigate to Classic Valuer
    await gotoPage(page, process.env.CLASSIC_VALUER_BASE_URL!, 60000);

    // --- Scraping setup ---
    let results: any[] = [];
    let seenPayloadSignatures = new Set();
    let maxPages = 0;
    let currentPage = 1;

    const firstApiEvent = new EventEmitter();
    const pageApiEvent = new EventEmitter();

    const API_REGEX = new re(
      "GetApiByV2ByAuctionResultsByCollectionByCollectionString\\.ajax",
      "i"
    );
    const NEXT_BUTTON_SELECTOR =
      'a[data-testid="Pagination_NavButton_Next"][aria-disabled="false"]';
    const CONTAINER_SELECTOR = "#comp-le47op7r";

    // --- Listen for API responses (BEFORE search) ---
    page.on("response", async (response: any) => {
      try {
        const resUrl = response.url();
        if (!API_REGEX.test(resUrl)) return;

        const headers = response.headers();
        const contentType = headers["content-type"] || "";
        if (
          !contentType.includes("application/json") &&
          !contentType.includes("text/plain")
        )
          return;

        if (response.status() !== 200) return;

        const data = await response.json();
        let records: any[] = [];

        if (typeof data === "object" && !Array.isArray(data)) {
          const count = data?.result?.count;
          if (count) maxPages = Math.ceil(count / 12);
          records = data?.result?.records || data?.items || [];
        } else if (Array.isArray(data)) {
          records = data;
        }

        // Deduplicate
        const sig = JSON.stringify(records).slice(0, 500);
        if (!seenPayloadSignatures.has(sig)) {
          seenPayloadSignatures.add(sig);
          for (const rec of records) {
            if (typeof rec === "object") {
              rec.sourceUrl = process.env.CLASSIC_VALUER_BASE_URL;
              results.push(rec);
            }
          }
        }

        // Signal events
        firstApiEvent.emit("first"); // only first matters once
        pageApiEvent.emit("page", currentPage);

        console.log(`✅ Captured ${records.length} records from API.`);
      } catch (err) {
        console.error("Error parsing API response:", err);
      }
    });

    // --- Do the search ---
    await clickElement(page, '[name="enter-a make and/or model"]');
    await wait(1500);

    await typeLikeHuman(
      page,
      '[placeholder="Enter a make and/or model"]',
      `${make} ${model}`
    );

    await wait(1500);
    await page.keyboard.press("Enter");

    // --- Wait for container ---
    try {
      const container = await page.waitForSelector(CONTAINER_SELECTOR, {
        timeout: 10000,
      });
      await container.scrollIntoViewIfNeeded();
    } catch {
      console.log(`⚠️ Container ${CONTAINER_SELECTOR} not found.`);
      return [];
    }

    // --- Wait for first API response (so first page is captured) ---
    try {
      await Promise.race([
        new Promise((resolve) => firstApiEvent.once("first", resolve)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout waiting for API")), 60000)
        ),
      ]);
    } catch {
      console.log("⚠️ First API response did not arrive in time.");
    }

    console.log(`📄 Maximum pages to scrape: ${maxPages || "unknown"}`);

    // --- Pagination loop (wait for API instead of fixed 3s) ---
    while (currentPage < maxPages) {
      const nextBtn = await page.$(NEXT_BUTTON_SELECTOR);
      if (!nextBtn) {
        console.log(`✅ No more Next button after page ${currentPage}.`);
        break;
      }

      try {
        currentPage++;
        await nextBtn.scrollIntoViewIfNeeded();
        await nextBtn.click();

        // Wait for the API response corresponding to this page
        await Promise.race([
          new Promise((resolve) => pageApiEvent.once("page", resolve)),
          wait(10000), // fallback if API is slow
        ]);
      } catch (err: any) {
        console.log(
          `⚠️ Pagination stopped at page ${currentPage}:`,
          err.message
        );
        break;
      }
    }

    return results;
  } catch (error) {
    console.error("❌ Error scraping Classic Valuer:", error);
    return [];
  }
};
