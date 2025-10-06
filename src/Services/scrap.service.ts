/**
 * Title: scrap.service.ts
 * Description: Service to handle scraping logic.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import fs from "fs/promises";
import path from "path";
import { Browser, Page } from "puppeteer";
import { v4 as uuid } from "uuid";
import { saveToCSV } from "../helpers/output.js";
import { createPage } from "../helpers/puppeteer-utils.js";
import { wait } from "../helpers/utils.js";
import { scrapeClassicComWithURL } from "../scraper/classic-url.js";
import { scrapClassicCom } from "../scraper/classiccom.js";
import { scrapClassicValuer } from "../scraper/classicvaluer.js";

// In-memory store for job status
export const jobs = new Map<string, any>();
const jobsFile = path.join(process.cwd(), "output", "jobs.json");

// Debounce utility to batch saveJobs calls
let saveJobsTimeout: NodeJS.Timeout | null = null;
const debounceSaveJobs = (ms: number) => {
  if (saveJobsTimeout) clearTimeout(saveJobsTimeout);
  saveJobsTimeout = setTimeout(saveJobs, ms);
};

// Load jobs from file on startup
const loadJobs = async () => {
  try {
    if (await fs.access(jobsFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(jobsFile, "utf-8");
      const parsed = JSON.parse(data);
      for (const [id, job] of Object.entries(parsed)) {
        jobs.set(id, job);
      }
      console.log("Loaded jobs from", jobsFile);
    }
  } catch (err) {
    console.error("Failed to load jobs:", err);
  }
};

// Save jobs to file
const saveJobs = async () => {
  try {
    const currentJobs = Object.fromEntries(jobs);
    const existingData = await fs.access(jobsFile).then(() => fs.readFile(jobsFile, "utf-8")).catch(() => "{}");
    if (JSON.stringify(currentJobs) !== existingData) {
      await fs.writeFile(jobsFile, JSON.stringify(currentJobs, null, 2));
      console.log("Jobs saved to", jobsFile);
    }
  } catch (err) {
    console.error("Failed to save jobs:", err);
  }
};

// Initialize jobs on startup
loadJobs();

/** Safely closes Puppeteer instances */
const safeClose = async (page: Page, browser: Browser) => {
  try {
    await page.close({ runBeforeUnload: true });
  } catch (err: any) {
    console.warn("⚠️ Page close failed:", err.message);
  }
  try {
    await wait(500).then(() => browser.close());
  } catch (err: any) {
    console.warn("⚠️ Browser close failed:", err.message);
  }
};

/** Updates job progress/status and logs */
export const updateJob = (id: string, data: object, logMessage?: string) => {
  const job = jobs.get(id) || {};
  const logs = job.logs || [];
  if (logMessage) logs.push({ message: logMessage, timestamp: new Date().toISOString() });
  jobs.set(id, { ...job, ...data, logs });
  debounceSaveJobs(10000);
};

/**
 * Run scraping job
 */
export const startScraping = async (
  method: "make_model" | "url",
  url: string,
  make: string,
  model: string,
  transmission: string,
  site: string,
  keep_duplicates: boolean,
  browser: Browser
) => {
  const id = uuid();

  // INITIAL progress = 10%
  updateJob(id, {
    status: "in progress",
    progress: 10,
    fileName: `${id}.csv`,
    startedAt: new Date().toISOString(),
    url,
    make,
    model,
    transmission,
    site,
    logs: []
  }, `Job ${id} started for method: ${method}`);

  // Validate browser
  if (!browser || typeof browser.newPage !== "function") {
    throw new Error("Invalid browser instance provided.");
  }

  let page: Page;
  try {
    page = await createPage(browser);
    updateJob(id, {}, "Browser page created successfully.");
  } catch (err: any) {
    updateJob(id, { status: "failed", progress: 0 }, `Failed to create page: ${err.message}`);
    throw err;
  }

  let allResults: any[] = [];

  const handleResults = async (results: any[]) => {
    try {
      if (!keep_duplicates) {
        const uniqueResults = Array.from(new Map(results.map(item => [item.url || item.id, item])).values());
        allResults = allResults.concat(uniqueResults);
      } else {
        allResults = allResults.concat(results);
      }
      const filePath = `./output/${id}.csv`;
      updateJob(id, {}, `Saving results to ${filePath}`);
      await saveToCSV(allResults, filePath);
      updateJob(id, { progress: 100, status: "completed" }, `Job ${id} completed successfully`);
    } catch (err: any) {
      updateJob(id, { status: "failed", progress: 0 }, `Error in handleResults: ${err.message}`);
      throw err;
    }
  };

  try {
    if (method === "make_model") {
      if (!make || !model || !site) throw new Error("Make, model, and site required.");

      if (site === "theclassicvaluer.com" || site === "both") {
        updateJob(id, { progress: 20 }, `Starting scrapClassicValuer for ${make} ${model}`);
        const results = await scrapClassicValuer(method, browser, page, make, model, transmission, url);
        updateJob(id, {}, `scrapClassicValuer returned ${results.length} results`);
        await handleResults(results);
      }

      if (site === "classic.com" || site === "both") {
        updateJob(id, { progress: 50 }, `Starting scrapClassicCom for ${make} ${model}`);
        const results = await scrapClassicCom(browser, page, make, model, transmission);
        updateJob(id, {}, `scrapClassicCom returned ${results.length} results`);
        await handleResults(results);
      }

      await safeClose(page, browser);

      return { statusCode: 200, message: `Scraping job ${id} completed for ${make} ${model}`, payload: { jobId: id, source: site } };
    }

    if (method === "url") {
      if (!url) throw new Error("URL is required.");

      let results: any[] = [];
      let source = "";

      if (url.includes("theclassicvaluer.com")) {
        updateJob(id, { progress: 20 }, `Starting scrapClassicValuer for URL: ${url}`);
        results = await scrapClassicValuer(method, browser, page, make, model, transmission, url);
        updateJob(id, {}, `scrapClassicValuer returned ${results.length} results`);
        source = "theclassicvaluer.com";
      } else if (url.includes("classic.com")) {
        updateJob(id, { progress: 50 }, `Starting scrapeClassicComWithURL for URL: ${url}`);
        results = await scrapeClassicComWithURL(url, page, id);
        updateJob(id, {}, `scrapeClassicComWithURL returned ${results.length} results`);
        source = "classic.com";
      } else {
        return { statusCode: 200, message: `URL scraping not implemented for ${url}`, payload: { jobId: id, source: url } };
      }

      await handleResults(results);
      await safeClose(page, browser);

      return { statusCode: 200, message: `Scraping job ${id} completed from provided URL`, payload: { jobId: id, source } };
    }

    throw new Error(`Unknown method: ${method}`);
  } catch (error: any) {
    updateJob(id, { status: "failed", progress: 0 }, `Scraping error: ${error.message}`);
    await safeClose(page, browser);
    throw error;
  }
};

/** Get scraping job status */
export const getJobStatus = (jobId: string) => {
  const job = jobs.get(jobId) || { status: "not found", progress: 0, logs: [] };
  return { ...job, logs: job.logs || [] };
};
