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
import { closePage, createPage, safeClose } from "../helpers/puppeteer-utils.js";
import { getDateStr } from "../helpers/utils.js";
import { scrapeClassicComWithURL } from "../scraper/classic-url.js";
import { scrapClassicCom } from "../scraper/classiccom.js";
import { scrapClassicValuer } from "../scraper/classicvaluer.js";

// In-memory store for job status
export type JobLog = { message: string; timestamp: string };
export type JobStatus = {
  status: "in progress" | "completed" | "failed" | "not found" | string;
  progress: number;
  fileName?: string;
  startedAt?: string;
  url?: string;
  make?: string;
  model?: string;
  transmission?: string;
  site?: string;
  method?: string;
  message?: string;
  totalItems?: number;
  completedItems?: number;
  logs: JobLog[];
};

export const jobs = new Map<string, JobStatus>();
const jobsFile = path.join(process.cwd(), "output", "jobs.json");

// Debounce utility to batch saveJobs calls
let saveJobsTimeout: NodeJS.Timeout | null = null;
const debounceSaveJobs = (ms: number) => {
  if (saveJobsTimeout) clearTimeout(saveJobsTimeout);
  saveJobsTimeout = setTimeout(saveJobs, ms);
};

const sanitizeFileName = (name: string) =>
  (name || "")
    .replace(/^\.\/output\//, "")
    .replace(/\/+/g, "")
    .replace(/\.csv\.csv$/i, ".csv");

// Load jobs from file on startup
const loadJobs = async () => {
  try {
    if (await fs.access(jobsFile).then(() => true).catch(() => false)) {
      const data = await fs.readFile(jobsFile, "utf-8");
      const parsed = JSON.parse(data) as Record<string, JobStatus>;
      for (const [id, job] of Object.entries(parsed)) {
        jobs.set(id, { ...job, logs: job.logs || [] });
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
    await fs.mkdir(path.dirname(jobsFile), { recursive: true });
    const existingData = await fs
      .access(jobsFile)
      .then(() => fs.readFile(jobsFile, "utf-8"))
      .catch(() => "{}");
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

/** Updates job progress/status and logs */
export const updateJob = (id: string, data: Partial<JobStatus>, logMessage?: string) => {
  const job = jobs.get(id) || { status: "not found", progress: 0, logs: [] };
  const logs = job.logs || [];
  if (logMessage) logs.push({ message: logMessage, timestamp: new Date().toISOString() });
  jobs.set(id, { ...job, ...data, logs });
  debounceSaveJobs(10000);
};

/**
 * Run scraping job
 */
export const startScraping = async (
  method: "make_model" | "url" | "bulk_excel",
  url: string,
  make: string,
  model: string,
  transmission: string,
  site: string,
  keep_duplicates: boolean,
  browser: Browser,
  reuseBrowser = false
) => {
  const id = uuid();

  const slug = (v: string) =>
    (v || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_.-]/g, "");

  const siteLabel = site === "classic.com" ? "classiccom" : site === "theclassicvaluer.com" ? "classicvaluer" : (site || "site");
  const baseFileName =
    method === "make_model"
      ? `${slug(make)}_${slug(model)}_${slug(siteLabel)}_${getDateStr()}.csv`
      : method === "url"
        ? `${slug(site || (url.includes("classic.com") ? "classic.com" : "theclassicvaluer.com"))}_url_${getDateStr()}.csv`
        : `${id}.csv`;

  const normalizeFileName = (name: string | undefined) => {
    if (!name) return baseFileName;
    const withoutDupCsv = sanitizeFileName(name);
    if (withoutDupCsv.toLowerCase().endsWith(".csv") || withoutDupCsv.toLowerCase().endsWith(".zip")) {
      return withoutDupCsv;
    }
    return `${withoutDupCsv}.csv`;
  };

  // INITIAL progress = 10%
  const setProgress = (progress: number, message?: string) => {
    updateJob(id, { progress, status: "in progress" }, message);
  };

  updateJob(id, {
    method,
    status: "in progress",
    progress: 2,
    fileName: baseFileName,
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

  let page: Page | null = null;
  try {
    page = await createPage(browser);
    setProgress(5, "Browser page created successfully.");
  } catch (err: any) {
    updateJob(id, { status: "failed", progress: 0 }, `Failed to create page: ${err.message}`);
    throw err;
  }

  let allResults: any[] = [];
  const closeResources = async () => {
    if (reuseBrowser) {
      await closePage(page);
    } else {
      await safeClose(page, browser);
    }
  };

  const handleResults = async (results: any[], fileName?: string) => {
    try {
      if (!keep_duplicates && method === "make_model") {
        const uniqueResults = Array.from(new Map(results.map(item => [item.url || item.id, item])).values());
        allResults = allResults.concat(uniqueResults);
      } else {
        allResults = allResults.concat(results);
      }
      const finalName = normalizeFileName(fileName || baseFileName);
      const filePath = path.join("./output", finalName);
      updateJob(id, { progress: Math.max(90, (jobs.get(id)?.progress ?? 0)), status: "in progress", fileName: finalName }, `Saving results to ${filePath}`);
      await saveToCSV(allResults, filePath);
      updateJob(id, { progress: 100, status: "completed", fileName: finalName }, `Job ${id} completed successfully`);
    } catch (err: any) {
      updateJob(id, { status: "failed", progress: 0 }, `Error in saving results: ${err.message}`);
      throw err;
    }
  };

  try {
    if (method === "make_model") {
      if (!make || !model || !site) throw new Error("Make, model, and site required.");

      const isBoth = site === "both";
      const perSiteProgress = isBoth ? 40 : 70; // how much to award after each site scrape
      let results: any[] = [];

      if (site === "theclassicvaluer.com" || site === "both") {
        setProgress(10, `Starting scrapClassicValuer for ${make} ${model}`);
        const classicValuerResults = await scrapClassicValuer(method, page, make, model, transmission, url, id, site === "both" ? 40 : 80, 20);
        results.push(...classicValuerResults);
        setProgress(Math.min(5 + perSiteProgress, 85), `scrapClassicValuer returned ${classicValuerResults.length} results`);
        if (site === "theclassicvaluer.com") {
          await handleResults(classicValuerResults, `${make}_${model}_classicvaluer_${getDateStr()}.csv`);
        }
      }

      if (site === "classic.com" || site === "both") {
        setProgress(isBoth ? 50 : 10, `Starting scrapeClassicCom for ${make} ${model}`);
        const classicComResults = await scrapClassicCom(browser, page, make, model, transmission);
        results.push(...classicComResults);
        setProgress(Math.min(5 + perSiteProgress * (isBoth ? 2 : 1), 90), `scrapClassicCom returned ${classicComResults.length} results`);
        if (site === "classic.com") {
          await handleResults(classicComResults, `${make}_${model}_classiccom_${getDateStr()}.csv`);
        }
      }

      if (site === "both") {
        await handleResults(results, `${make}_${model}_both_${getDateStr()}.csv`);
      }
      await closeResources();

      return { statusCode: 200, message: `Scraping job ${id} completed for ${make} ${model}`, payload: { jobId: id, source: site } };
    }

    if (method === "url") {
      if (!url) throw new Error("URL is required.");

      let results: any[] = [];
      let source = "";

      setProgress(10, `Starting URL scrape for ${url}`);
      if (url.includes("theclassicvaluer.com")) {
        results = await scrapClassicValuer(method, page, make, model, transmission, url, id, 70, 20);
        setProgress(85, `scrapClassicValuer returned ${results.length} results`);
        source = "theclassicvaluer.com";
      } else if (url.includes("classic.com")) {
        results = await scrapeClassicComWithURL(url, page, id);
        setProgress(85, `scrapeClassicComWithURL returned ${results.length} results`);
        source = "classic.com";
      } else {
        return { statusCode: 200, message: `URL scraping not implemented for ${url}`, payload: { jobId: id, source: url } };
      }

      await handleResults(results, `${source.replace(".", "_")}_url_${getDateStr()}.csv`);
      await closeResources();
      return { statusCode: 200, message: `Scraping job ${id} completed from provided URL`, payload: { jobId: id, source } };
    }

    throw new Error(`Unknown method: ${method}`);
  } catch (error: any) {
    updateJob(id, { status: "failed", progress: 0 }, `Scraping error: ${error.message}`);
    await closeResources();
    throw error;
  }
};

/** Get scraping job status */
const deriveFileNameFromLogs = (logs: JobLog[] | undefined) => {
  if (!logs || !logs.length) return null;
  for (let i = logs.length - 1; i >= 0; i--) {
    const msg = logs[i]?.message || "";
    const match = msg.match(/Saving results to (.+\/)?([^\/\s]+\.csv|\.zip)/i);
    if (match && match[2]) {
      return match[2];
    }
  }
  return null;
};

const normalizeJobFile = (id: string, job: JobStatus) => {
  if (job.fileName) return job.fileName;
  const derived = deriveFileNameFromLogs(job.logs);
  if (derived) {
    const updated = { ...job, fileName: derived };
    jobs.set(id, updated);
    debounceSaveJobs(5000);
    return derived;
  }
  return null;
};

export const getJobStatus = (jobId: string) => {
  const job = jobs.get(jobId) || { status: "not found", progress: 0, logs: [] };
  const fileName = normalizeJobFile(jobId, job) || job.fileName;
  return { ...job, fileName, logs: job.logs || [] };
};

/** Get snapshot of all jobs */
export const getAllJobs = () => {
  return Array.from(jobs.entries()).map(([id, job]) => {
    const fileName = normalizeJobFile(id, job) || job.fileName;
    return {
      jobId: id,
      ...job,
      fileName,
      logs: job.logs || [],
    };
  });
};

/** Remove job entry by filename (used when file is deleted) */
export const removeJobByFileName = async (fileName: string) => {
  const target = sanitizeFileName(fileName);
  let removed = false;
  for (const [id, job] of jobs.entries()) {
    const jobFile = sanitizeFileName(job.fileName || "");
    if (jobFile && jobFile === target) {
      jobs.delete(id);
      removed = true;
    }
  }
  if (removed) debounceSaveJobs(0);
  return removed;
};

/** Clear all jobs (memory + persisted file) */
export const clearAllJobs = async () => {
  jobs.clear();
  try {
    await fs.mkdir(path.dirname(jobsFile), { recursive: true });
    await fs.writeFile(jobsFile, "{}", "utf-8");
    // remove output files (CSV/ZIP) if folder exists
    const outDir = path.join(process.cwd(), "output");
    if (await fs.access(outDir).then(() => true).catch(() => false)) {
      const files = await fs.readdir(outDir);
      await Promise.all(
        files.map(async (f) => {
          const full = path.join(outDir, f);
          try {
            await fs.rm(full, { force: true, recursive: false });
          } catch (err) {
            console.warn("Failed to remove output file:", full, err);
          }
        })
      );
    }
    console.log("Jobs cleared and output/jobs.json reset");
  } catch (err) {
    console.error("Failed to clear jobs file:", err);
    throw err;
  }
};
