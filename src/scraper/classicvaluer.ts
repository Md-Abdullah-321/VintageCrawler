/**
 * Title: classicvaluer.ts
 * Description: Scrape data from theclassicvaluer.com
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import dotenv from "dotenv";
import { EventEmitter } from "events";
import {
  clickElement,
  gotoPage,
  typeLikeHuman
} from "../helpers/navigation.js";
import { wait } from "../helpers/utils.js";
import { updateJob } from "../Services/scrap.service.js";

dotenv.config();

/* ------------------------------------------------------------------ */
/* Types */
/* ------------------------------------------------------------------ */

type ClassicValuerRecord = Record<string, any> & {
  price_usd_string?: string;
  year?: number;
  mileage?: number;
  sourceUrl: string;
  status: "Sold" | "Not Sold";
};

type ApiRequestSnapshot = {
  url: string;
  method: string;
  postData: string;
  headers: Record<string, string>;
};

/* ------------------------------------------------------------------ */
/* Constants */
/* ------------------------------------------------------------------ */

const API_REGEX = /AuctionResults/i;
const CONTAINER_SELECTOR = "#comp-le47op7r";
const FIRST_API_TIMEOUT = Number(
  process.env.CLASSIC_VALUER_FIRST_API_TIMEOUT || 20000
);
const MAX_API_RETRIES = 5;

/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */

const deriveStatus = (priceStr?: string): "Sold" | "Not Sold" => {
  const normalized = (priceStr || "").toLowerCase().trim();
  if (!normalized) return "Not Sold";
  return normalized.includes("not sold") ? "Not Sold" : "Sold";
};

const waitForEvent = (
  emitter: EventEmitter,
  event: string,
  timeout: number
) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timeout waiting for API")),
      timeout
    );
    emitter.once(event, () => {
      clearTimeout(timer);
      resolve();
    });
  });

const waitForContainer = async (page: any) => {
  try {
    const el = await page.waitForSelector(CONTAINER_SELECTOR, {
      timeout: 20000
    });
    await el.scrollIntoViewIfNeeded();
    return true;
  } catch {
    console.log("⚠️ Result container not found.");
    return false;
  }
};

const buildPaginatedRequest = (
  lastRequest: ApiRequestSnapshot,
  limit: number,
  offset: number
) => {
  let payload: any;

  try {
    payload = JSON.parse(lastRequest.postData);
  } catch {
    throw new Error("Failed to parse API payload");
  }

  if (!Array.isArray(payload)) {
    throw new Error("Unexpected API payload format");
  }

  const paginationObj = payload.find(
    (item: any) =>
      typeof item === "object" &&
      item !== null &&
      "limit" in item &&
      "offset" in item
  );

  if (!paginationObj) {
    throw new Error("Pagination object not found in API payload");
  }

  paginationObj.limit = limit;
  paginationObj.offset = offset;

  return {
    url: lastRequest.url,
    method: lastRequest.method,
    postData: JSON.stringify(payload),
    headers: {
      ...lastRequest.headers,
      "content-type": "application/json"
    }
  };
};

const fetchApiData = async (page: any, req: any) => {
  return await page.evaluate((r: any) => {
    return fetch(r.url, {
      method: r.method,
      body: r.postData,
      headers: r.headers,
      credentials: "include"
    }).then(res => {
      if (!res.ok) return null;
      return res.json();
    }).catch(() => null);
  }, req);
};

/* ------------------------------------------------------------------ */
/* Main Scraper */
/* ------------------------------------------------------------------ */

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
): Promise<ClassicValuerRecord[]> => {
  try {
    /* -------------------------------------------------------------- */
    /* Navigation */
    /* -------------------------------------------------------------- */

    const triggerSearch = async () => {
      if (method !== "make_model") return;
      await clickElement(page, "#input_comp-m30drsaf");
      await wait(1200);
      await typeLikeHuman(
        page,
        "#input_comp-m30drsaf",
        `${make} ${model} ${transmission}`.trim()
      );
      await wait(800);
      await page.keyboard.press("Enter");
    };

    if (method === "make_model") {
      await gotoPage(page, process.env.CLASSIC_VALUER_BASE_URL!);
    } else {
      await gotoPage(page, url);
    }

    await wait(4000);

    /* -------------------------------------------------------------- */
    /* State */
    /* -------------------------------------------------------------- */

    let results: ClassicValuerRecord[] = [];
    let lastApiRequest: ApiRequestSnapshot | null = null;
    let totalCount = 0;
    let apiCaptured = false;

    const apiEvent = new EventEmitter();

    /* -------------------------------------------------------------- */
    /* API Listener (clean + deterministic) */
    /* -------------------------------------------------------------- */

    page.removeAllListeners("response");

    const responseHandler = async (response: any) => {
      const resUrl = response.url();
      if (!API_REGEX.test(resUrl)) return;

      try {
        const data = await response.json();
        const records = data?.result?.records;

        if (!Array.isArray(records) || records.length === 0) return;

        const req = response.request();
        const postData = req.postData();

        if (!postData) return;

        lastApiRequest = {
          url: resUrl,
          method: req.method(),
          postData,
          headers: req.headers()
        };

        totalCount = data?.result?.count ?? records.length;

        results = records.map((r: any) => ({
          ...r,
          sourceUrl: process.env.CLASSIC_VALUER_BASE_URL!,
          status: deriveStatus(r.price_usd_string)
        }));

        apiCaptured = true;
        apiEvent.emit("hit");

        console.log(
          `✅ API captured (${records.length} / ${totalCount})`
        );
      } catch {
        /* ignore non-JSON / noise responses */
      }
    };

    page.on("response", responseHandler);

    /* -------------------------------------------------------------- */
    /* Capture Phase */
    /* -------------------------------------------------------------- */

    let attempt = 0;
    while (attempt < MAX_API_RETRIES && !apiCaptured) {
      attempt++;
      console.log(`🔄 API attempt ${attempt}/${MAX_API_RETRIES}`);

      await triggerSearch();

      const containerReady = await waitForContainer(page);
      if (!containerReady) {
        console.log("⚠️ Container not ready, reloading...");
        await page.reload({ waitUntil: "networkidle2" });
        await wait(3000);
        attempt--; // retry this attempt
        continue;
      }

      try {
        await waitForEvent(apiEvent, "hit", FIRST_API_TIMEOUT);
      } catch {
        console.log("⚠️ API not detected, reloading...");
        await page.reload({ waitUntil: "networkidle2" });
        await wait(3000);
      }
    }

    page.off("response", responseHandler);

    if (!apiCaptured || !lastApiRequest) {
      console.log("❌ Failed to capture valid API request.");
      return [];
    }

    /* -------------------------------------------------------------- */
    /* Fetch All Records with Pagination if Necessary */
    /* -------------------------------------------------------------- */

    console.log("➡️ Fetching all records...");
    results = []; // Reset results to collect all

    let offset = 0;
    let maxLimit = 100; // Assumed max limit based on observation; can adjust if needed

    while (offset < totalCount) {
      const limit = Math.min(maxLimit, totalCount - offset);
      console.log(`Fetching batch: offset=${offset}, limit=${limit}`);

      const pagReq = buildPaginatedRequest(lastApiRequest, limit, offset);
      const pagData = await fetchApiData(page, pagReq);

      if (pagData && Array.isArray(pagData?.result?.records)) {
        const batch = pagData.result.records.map((r: any) => ({
          ...r,
          sourceUrl: process.env.CLASSIC_VALUER_BASE_URL!,
          status: deriveStatus(r.price_usd_string)
        }));
        results.push(...batch);

        if (batch.length < limit) {
          console.log(`⚠️ Received fewer records than requested (${batch.length}/${limit}). Stopping.`);
          break;
        }
      } else {
        console.log(`⚠️ Failed to fetch batch at offset ${offset}.`);
        break;
      }

      offset += limit;
    }

    /* -------------------------------------------------------------- */
    /* Job Update */
    /* -------------------------------------------------------------- */

    await updateJob(
      jobId,
      { progress: prev_job_progress_point + job_progress_point },
      "Classic Valuer scraping completed"
    );

    console.log(`✅ Total records scraped: ${results.length}`);
    return results;

  } catch (err) {
    console.error("❌ Error scraping Classic Valuer:", err);
    return [];
  }
};