/**
 * Title: ScrapController.ts
 * Description: Manage scrap controller.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import archiver from "archiver";
import * as fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { closeBrowser, closePage, createPage, launchBrowser } from "../helpers/puppeteer-utils.js";
import { getDateStr, wait } from "../helpers/utils.js";
import { saveToCSV } from "../helpers/output.js";
import { getJobStatus, jobs, startScraping, updateJob, } from "../Services/scrap.service.js";
import { successResponse } from "./responseController.js";
import { scrapeClassicComWithURL } from "../scraper/classic-url.js";
import { scrapClassicValuer } from "../scraper/classicvaluer.js";
const appendJobLog = (job, message) => {
    if (!job)
        return;
    job.logs = job.logs || [];
    job.logs.push({ message, timestamp: new Date().toISOString() });
};
/**
 * Start Scraping Job
 */
const parseBoolean = (val) => {
    if (typeof val === "boolean")
        return val;
    if (typeof val === "string")
        return ["true", "1", "on", "yes"].includes(val.toLowerCase());
    return false;
};
export const startScrapingJob = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { method = "", make = "", model = "", transmission = "", site = "", keep_duplicates = false, debug_mode = false, url = "", } = req.body;
        let excelFile;
        let excelFileName = "excel_file";
        const debugModeBool = parseBoolean(debug_mode);
        const keepDuplicatesBool = parseBoolean(keep_duplicates);
        if (method === "bulk_excel" && req.file) {
            excelFile = req.file.buffer;
            excelFileName = req.file.originalname || excelFileName;
        }
        if (!method) {
            return res.status(400).json({
                status: "error",
                message: "Method is required",
            });
        }
        // Validation
        if (method === "url" && !url) {
            return res.status(400).json({
                status: "error",
                message: "URL is required for url method",
            });
        }
        if (method === "make_model" && (!make || !model)) {
            return res.status(400).json({
                status: "error",
                message: "Make and model are required for make_model method",
            });
        }
        if (method === "bulk_excel" && !excelFile) {
            return res.status(400).json({
                status: "error",
                message: "Excel file is required for bulk_excel method",
            });
        }
        /**
         * BULK EXCEL MODE
         */
        if (method === "bulk_excel") {
            const workbook = XLSX.read(excelFile, { type: "buffer" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils
                .sheet_to_json(worksheet, {
                header: ["Car", "Brand", "Era", "Notes / Why It’s Useful", "URL"],
            })
                .slice(1);
            const jobId = `bulk_${Date.now()}`;
            jobs.set(jobId, {
                method,
                status: "in progress",
                progress: 0,
                startedAt: new Date().toISOString(),
                logs: [],
                totalItems: rows.length,
                completedItems: 0,
                message: "Bulk scraping job started",
            });
            processBulkScraping(jobId, rows, keepDuplicatesBool, debugModeBool, excelFileName).catch((err) => {
                console.error("Bulk scraping error:", err);
                const job = jobs.get(jobId);
                if (job) {
                    job.status = "failed";
                    appendJobLog(job, `Error: ${err.message}`);
                }
            });
            return successResponse(res, {
                statusCode: 200,
                message: "Bulk scraping job started",
                payload: { jobId },
            });
        }
        /**
         * START SCRAPING
         */
        const browser = yield launchBrowser(!debugModeBool);
        const response = yield startScraping(method, url, make, model, transmission, site, keepDuplicatesBool, browser);
        return successResponse(res, response);
    }
    catch (error) {
        return res.status(500).json({
            status: "error",
            message: `Controller error: ${error.message}`,
        });
    }
});
/**
 * BULK SCRAPING HELPER
 */
function processBulkScraping(jobId_1, rows_1, keep_duplicates_1, debug_mode_1) {
    return __awaiter(this, arguments, void 0, function* (jobId, rows, keep_duplicates, debug_mode, excelName = "excel_file") {
        var _a, _b, _c, _d, _e;
        const job = jobs.get(jobId);
        if (!job)
            return;
        job.completedItems = (_a = job.completedItems) !== null && _a !== void 0 ? _a : 0;
        job.totalItems = (_b = job.totalItems) !== null && _b !== void 0 ? _b : rows.length;
        let browser = yield launchBrowser(!debug_mode);
        const normalize = (v) => v
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "");
        const excelBaseName = normalize(path.parse(excelName).name || "excel_file") || "excel_file";
        job.fileName = `${excelBaseName}.zip`;
        const dateStr = getDateStr();
        const baseOutputDir = path.join(process.cwd(), "output", excelBaseName);
        fs.mkdirSync(baseOutputDir, { recursive: true });
        let successfulCsvCount = 0;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rawUrl = (row.URL || "").toString().trim();
            const targetUrl = rawUrl
                ? rawUrl.match(/^https?:\/\//i)
                    ? rawUrl
                    : `https://${rawUrl}`
                : "";
            if (!targetUrl) {
                appendJobLog(job, `Skipping row ${i + 1}: No URL`);
                job.completedItems = ((_c = job.completedItems) !== null && _c !== void 0 ? _c : 0) + 1;
                job.progress = Math.round((job.completedItems / job.totalItems) * 100);
                updateJob(jobId, {
                    completedItems: job.completedItems,
                    totalItems: job.totalItems,
                    progress: job.progress,
                }, undefined, { allowBulkProgress: true });
                continue;
            }
            const carName = normalize(row.Car || `item_${i}`);
            const finalCsvName = `${carName}_${dateStr}.csv`;
            const finalCsvPath = path.join(baseOutputDir, finalCsvName);
            let site = "";
            if (targetUrl.includes("theclassicvaluer.com"))
                site = "theclassicvaluer.com";
            if (targetUrl.includes("classic.com"))
                site = "classic.com";
            if (!site) {
                appendJobLog(job, `Skipping row ${i + 1}: Unknown site`);
                job.completedItems = ((_d = job.completedItems) !== null && _d !== void 0 ? _d : 0) + 1;
                job.progress = Math.round((job.completedItems / job.totalItems) * 100);
                updateJob(jobId, {
                    completedItems: job.completedItems,
                    totalItems: job.totalItems,
                    progress: job.progress,
                }, undefined, { allowBulkProgress: true });
                continue;
            }
            try {
                // Wait a good amount of time before starting a new job
                yield wait(5000);
                appendJobLog(job, `Row ${i + 1}: Starting scrape for ${targetUrl}`);
                // Relaunch browser every 10 items to avoid memory issues
                if (i > 0 && i % 10 === 0) {
                    yield closeBrowser(browser);
                    yield wait(5000);
                    browser = yield launchBrowser(!debug_mode);
                }
                const scrapedCount = yield scrapeUrlToCsv(jobId, targetUrl, browser, finalCsvPath);
                if (scrapedCount > 0 && fs.existsSync(finalCsvPath)) {
                    successfulCsvCount++;
                }
                else {
                    appendJobLog(job, `Row ${i + 1}: No data saved`);
                }
            }
            catch (err) {
                appendJobLog(job, `Row ${i + 1} failed: ${err.message}`);
            }
            job.completedItems = ((_e = job.completedItems) !== null && _e !== void 0 ? _e : 0) + 1;
            const totalItems = job.totalItems || rows.length || 1;
            job.progress = Math.round((job.completedItems / totalItems) * 100);
            updateJob(jobId, {
                completedItems: job.completedItems,
                totalItems,
                progress: job.progress,
            }, undefined, { allowBulkProgress: true });
        }
        try {
            yield browser.close();
        }
        catch (_f) {
            // ignore
        }
        if (successfulCsvCount === 0) {
            job.status = "failed";
            updateJob(jobId, { status: "failed", progress: job.progress }, "No CSV files were generated", { allowBulkStatus: true, allowBulkProgress: true });
            return;
        }
        /* ---------- ZIP FINAL FOLDER ---------- */
        const zipPath = path.join(process.cwd(), "output", job.fileName || `${excelBaseName}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.pipe(output);
        archive.directory(baseOutputDir, path.basename(baseOutputDir));
        yield archive.finalize();
        yield new Promise((resolve, reject) => {
            output.on("close", () => resolve());
            output.on("error", (err) => reject(err));
        });
        try {
            fs.rmSync(baseOutputDir, { recursive: true, force: true });
        }
        catch (err) {
            console.warn("⚠️ Failed to clean temp CSV folder:", err.message);
        }
        job.status = "completed";
        job.fileName = path.basename(zipPath);
        job.progress = 100;
        updateJob(jobId, {
            status: "completed",
            progress: 100,
            fileName: job.fileName,
            completedItems: job.totalItems,
            totalItems: job.totalItems,
        }, `Bulk scraping completed and zipped successfully: ${job.fileName}`, { allowBulkStatus: true, allowBulkProgress: true });
    });
}
function scrapeUrlToCsv(jobId, targetUrl, browser, outputPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const page = yield createPage(browser);
        try {
            if (targetUrl.includes("theclassicvaluer.com")) {
                const results = yield scrapClassicValuer("url", page, "", "", "", targetUrl, jobId, 70, 20);
                yield saveToCSV(results, outputPath);
                return results.length;
            }
            if (targetUrl.includes("classic.com")) {
                const results = yield scrapeClassicComWithURL(targetUrl, page, jobId);
                yield saveToCSV(results, outputPath);
                return results.length;
            }
            throw new Error(`Unknown site for URL: ${targetUrl}`);
        }
        finally {
            yield closePage(page);
        }
    });
}
/**
 * GET JOB LOGS
 */
export const getJobLogs = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { jobId } = req.params;
        if (!jobId) {
            return res.status(400).json({
                status: "error",
                message: "Job ID is required",
            });
        }
        const job = getJobStatus(jobId);
        return successResponse(res, {
            statusCode: 200,
            message: `Logs for job ${jobId}`,
            payload: {
                jobId,
                status: job.status,
                progress: job.progress,
                logs: (_a = job.logs) !== null && _a !== void 0 ? _a : [],
            },
        });
    }
    catch (error) {
        return res.status(500).json({
            status: "error",
            message: `Error fetching job logs: ${error.message}`,
        });
    }
});
