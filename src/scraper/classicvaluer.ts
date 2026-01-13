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
  typeLikeHuman
} from "../helpers/navigation.js";

// Dependencies
import dotenv from "dotenv";
import re from "re2";
import { wait } from "../helpers/utils.js";
import { updateJob } from "../Services/scrap.service.js";
dotenv.config();

type ClassicValuerRecord = Record<string, any> & {
  sourceUrl?: string;
  status?: string;
};

const API_REGEX = new re(
  "GetApiByV2ByAuctionResultsByCollectionByCollectionString\\.ajax",
  "i"
);
const NEXT_BUTTON_SELECTOR = 'a[data-testid="Pagination_NavButton_Next"]';
const CONTAINER_SELECTOR = "#comp-le47op7r";

const deriveStatus = (priceStr: string | undefined) => {
  const normalized = (priceStr || "").toLowerCase();
  if (!normalized.trim()) return "Not Sold";
  return normalized.includes("not sold") ? "Not Sold" : "Sold";
};

const waitForEvent = (emitter: EventEmitter, event: string, timeout: number) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeout);
    emitter.once(event, () => {
      clearTimeout(timer);
      resolve();
    });
  });

const parseApiPayload = (
  data: any,
  seenPayloadSignatures: Set<string>
): ClassicValuerRecord[] => {
  let records: any[] = [];

  if (typeof data === "object" && !Array.isArray(data)) {
    const count = data?.result?.count;
    if (count) {
      // track via outer scope where needed
    }
    records = data?.result?.records || data?.items || [];
  } else if (Array.isArray(data)) {
    records = data;
  }

  const sig = JSON.stringify(records).slice(0, 500);
  if (seenPayloadSignatures.has(sig)) return [];
  seenPayloadSignatures.add(sig);

  return records
    .filter((rec) => typeof rec === "object")
    .map((rec) => ({
      ...rec,
      sourceUrl: process.env.CLASSIC_VALUER_BASE_URL,
      status: deriveStatus(rec.price_usd_string),
    }));
};

const safeParseJson = async (response: any) => {
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Error parsing response JSON:", err);
    return null;
  }
};

const waitForContainer = async (page: any) => {
  try {
    const container = await page.waitForSelector(CONTAINER_SELECTOR, {
      timeout: 10000,
    });
    await container.scrollIntoViewIfNeeded();
    return true;
  } catch {
    console.log(`⚠️ Container ${CONTAINER_SELECTOR} not found.`);
    return false;
  }
};

export const scrapClassicValuer = async (
  method: string,
  page: any,
  make: string,
  model: string,
  transmission: string,
  url: string,
  jobId: string,
  job_progress_point: number,
  prev_job_progress_point: number
) => {
  try {
    const triggerSearch = async () => {
      if (method !== "make_model") return;
      await clickElement(page, '#input_comp-m30drsaf');
      await wait(1500);

      await typeLikeHuman(
        page,
        '#input_comp-m30drsaf',
        `${make} ${model} ${transmission}`.trim()
      );

      await wait(1500);
      await page.keyboard.press("Enter");
      await wait(5000);
    };

    // Navigate to Classic Valuer
    if (method === "make_model") {
      await gotoPage(page, process.env.CLASSIC_VALUER_BASE_URL || "");
      await wait(5000);
      updateJob(jobId, {}, `Navigated to Classic Valuer homepage`);
    } else if (method === "url") {
      await gotoPage(page, url);
      await wait(5000);
      updateJob(jobId, {}, `Navigated to ${url}`);
    }

    // --- Perform search by make/model ---

    console.log("📄 Page loaded:", await page.title());

    // --- Scraping setup ---
    let results: ClassicValuerRecord[] = [];
    let seenPayloadSignatures = new Set<string>();
    let maxPages = 0;
    let currentPage = 1;
    let firstApiReceived = false;
    let lastSeenPageEvent = 0;

    const firstApiEvent = new EventEmitter();
    const pageApiEvent = new EventEmitter();

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

        const data = await safeParseJson(response);
        if (!data) return;
        if (typeof data === "object" && !Array.isArray(data)) {
          const count = data?.result?.count;
          if (count) maxPages = Math.ceil(count / 12);
        }

        const parsedRecords = parseApiPayload(data, seenPayloadSignatures);
        results.push(...parsedRecords);

        // Signal events
        firstApiReceived = true;
        firstApiEvent.emit("first"); // only first matters once
        lastSeenPageEvent = currentPage;
        pageApiEvent.emit("page", currentPage);

        console.log(`✅ Captured ${parsedRecords.length} records from API.`);
      } catch (err) {
        console.error("Error parsing API response:", err);
      }
    });

    // --- Perform search by make/model ---
    await triggerSearch();


    // --- Wait for container ---
    const hasContainer = await waitForContainer(page);
    if (!hasContainer) return [];

    // --- Wait for first API response (retry with reload/search if missing) ---
    const ensureFirstApi = async () => {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (firstApiReceived) return;
          await Promise.race([waitForEvent(firstApiEvent, "first", 60000)]);
          return;
        } catch {
          console.log(`⚠️ First API response attempt ${attempt} timed out.`);
          if (attempt === maxAttempts) break;
          console.log("🔄 Reloading page to retry API capture...");
          await page.reload({ waitUntil: "networkidle2" });
          await wait(3000);
          await triggerSearch();
          const containerReady = await waitForContainer(page);
          if (!containerReady) {
            console.log("⚠️ Container missing after reload; skipping further retries.");
            break;
          }
        }
      }
    };

    await ensureFirstApi();

    console.log(`📄 Maximum pages to scrape: ${maxPages || "unknown"}`);

    const pagesToScrape = Math.max(1, maxPages || 1);
    const statusPerPage = pagesToScrape
      ? Math.floor(job_progress_point / pagesToScrape)
      : 0;

    // --- Pagination loop ---
    while (currentPage < pagesToScrape) {
      try {
        // Scroll the main container into view before clicking
        const container = await page.$("#comp-le47op7r");
        if (container) {
          await container.scrollIntoViewIfNeeded();
          // Small wait after scrolling to ensure DOM updates
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Wait for Next button to be visible and enabled
        const nextBtn = await page.waitForSelector(NEXT_BUTTON_SELECTOR, {
          visible: true,
          timeout: 30000
        });

        const isDisabled = await nextBtn.evaluate((btn: any) => btn.getAttribute('aria-disabled') === 'true');
        if (isDisabled) {
          console.log(`✅ Next button disabled after page ${currentPage}.`);
          break;
        }

        currentPage++;
        console.log(`➡️ Going to page ${currentPage}...`);

        // Click Next in the page context
        await nextBtn.click();

        // Wait for page/API to load
        await new Promise(resolve => setTimeout(resolve, 30000));
        console.log(`⏱ Waited 30 seconds for page ${currentPage}`);

        const progressDelta = Math.min(
          job_progress_point,
          statusPerPage * (currentPage - 1)
        );
        updateJob(
          jobId,
          { progress: prev_job_progress_point + progressDelta },
          `Scraping page ${currentPage} of ${maxPages}`
        );
      } catch (err: any) {
        console.log(`⚠️ Pagination stopped at page ${currentPage}:`, err.message);
        updateJob(
          jobId,
          {},
          `Pagination stopped at page ${currentPage}: ${err.message}`
        );
        break;
      }
    }

    // --- Wait for last API response (so last page is captured) ---
    if (lastSeenPageEvent < currentPage) {
      try {
        await Promise.race([waitForEvent(pageApiEvent, "page", 60000)]);
      } catch {
        console.log("⚠️ Last API response did not arrive in time.");
      }
    }

    // Capture title before closing the page to avoid detached frame errors
    const pageTitle = await page.title();

    console.log(`✅ Scraping completed for ${pageTitle}. Total records: ${results.length}`);
    return results;
  } catch (error) {
    console.error("❌ Error scraping Classic Valuer:", error);
    return [];
  }
};
