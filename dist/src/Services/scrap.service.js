/**
 * Title: scrap.service.ts
 * Description: Service to handle scraping logic.
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
import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { saveToCSV } from "../helpers/output.js";
import { closePage, createPage, safeClose } from "../helpers/puppeteer-utils.js";
import { getDateStr } from "../helpers/utils.js";
import { scrapeClassicComWithURL } from "../scraper/classic-url.js";
import { scrapClassicCom } from "../scraper/classiccom.js";
import { scrapClassicValuer } from "../scraper/classicvaluer.js";
export const jobs = new Map();
const jobsFile = path.join(process.cwd(), "output", "jobs.json");
// Debounce utility to batch saveJobs calls
let saveJobsTimeout = null;
const debounceSaveJobs = (ms) => {
    if (saveJobsTimeout)
        clearTimeout(saveJobsTimeout);
    saveJobsTimeout = setTimeout(saveJobs, ms);
};
const sanitizeFileName = (name) => (name || "")
    .replace(/^\.\/output\//, "")
    .replace(/\/+/g, "")
    .replace(/\.csv\.csv$/i, ".csv");
// Load jobs from file on startup
const loadJobs = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (yield fs.access(jobsFile).then(() => true).catch(() => false)) {
            const data = yield fs.readFile(jobsFile, "utf-8");
            const parsed = JSON.parse(data);
            for (const [id, job] of Object.entries(parsed)) {
                jobs.set(id, Object.assign(Object.assign({}, job), { logs: job.logs || [] }));
            }
            console.log("Loaded jobs from", jobsFile);
        }
    }
    catch (err) {
        console.error("Failed to load jobs:", err);
    }
});
// Save jobs to file
const saveJobs = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const currentJobs = Object.fromEntries(jobs);
        yield fs.mkdir(path.dirname(jobsFile), { recursive: true });
        const existingData = yield fs
            .access(jobsFile)
            .then(() => fs.readFile(jobsFile, "utf-8"))
            .catch(() => "{}");
        if (JSON.stringify(currentJobs) !== existingData) {
            yield fs.writeFile(jobsFile, JSON.stringify(currentJobs, null, 2));
            console.log("Jobs saved to", jobsFile);
        }
    }
    catch (err) {
        console.error("Failed to save jobs:", err);
    }
});
// Initialize jobs on startup
loadJobs();
/** Updates job progress/status and logs */
export const updateJob = (id, data, logMessage) => {
    const job = jobs.get(id) || { status: "not found", progress: 0, logs: [] };
    const logs = job.logs || [];
    if (logMessage)
        logs.push({ message: logMessage, timestamp: new Date().toISOString() });
    jobs.set(id, Object.assign(Object.assign(Object.assign({}, job), data), { logs }));
    debounceSaveJobs(10000);
};
/**
 * Run scraping job
 */
export const startScraping = (method_1, url_1, make_1, model_1, transmission_1, site_1, keep_duplicates_1, browser_1, ...args_1) => __awaiter(void 0, [method_1, url_1, make_1, model_1, transmission_1, site_1, keep_duplicates_1, browser_1, ...args_1], void 0, function* (method, url, make, model, transmission, site, keep_duplicates, browser, reuseBrowser = false) {
    const id = uuid();
    const slug = (v) => (v || "")
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_.-]/g, "");
    const siteLabel = site === "classic.com" ? "classiccom" : site === "theclassicvaluer.com" ? "classicvaluer" : (site || "site");
    const baseFileName = method === "make_model"
        ? `${slug(make)}_${slug(model)}_${slug(siteLabel)}_${getDateStr()}.csv`
        : method === "url"
            ? `${slug(site || (url.includes("classic.com") ? "classic.com" : "theclassicvaluer.com"))}_url_${getDateStr()}.csv`
            : `${id}.csv`;
    const normalizeFileName = (name) => {
        if (!name)
            return baseFileName;
        const withoutDupCsv = sanitizeFileName(name);
        if (withoutDupCsv.toLowerCase().endsWith(".csv") || withoutDupCsv.toLowerCase().endsWith(".zip")) {
            return withoutDupCsv;
        }
        return `${withoutDupCsv}.csv`;
    };
    // INITIAL progress = 10%
    const setProgress = (progress, message) => {
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
    let page = null;
    try {
        page = yield createPage(browser);
        setProgress(5, "Browser page created successfully.");
    }
    catch (err) {
        updateJob(id, { status: "failed", progress: 0 }, `Failed to create page: ${err.message}`);
        throw err;
    }
    let allResults = [];
    const closeResources = () => __awaiter(void 0, void 0, void 0, function* () {
        if (reuseBrowser) {
            yield closePage(page);
        }
        else {
            yield safeClose(page, browser);
        }
    });
    const handleResults = (results, fileName) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        try {
            if (!keep_duplicates && method === "make_model") {
                const uniqueResults = Array.from(new Map(results.map(item => [item.url || item.id, item])).values());
                allResults = allResults.concat(uniqueResults);
            }
            else {
                allResults = allResults.concat(results);
            }
            const finalName = normalizeFileName(fileName || baseFileName);
            const filePath = path.join("./output", finalName);
            updateJob(id, { progress: Math.max(90, ((_b = (_a = jobs.get(id)) === null || _a === void 0 ? void 0 : _a.progress) !== null && _b !== void 0 ? _b : 0)), status: "in progress", fileName: finalName }, `Saving results to ${filePath}`);
            yield saveToCSV(allResults, filePath);
            updateJob(id, { progress: 100, status: "completed", fileName: finalName }, `Job ${id} completed successfully`);
        }
        catch (err) {
            updateJob(id, { status: "failed", progress: 0 }, `Error in saving results: ${err.message}`);
            throw err;
        }
    });
    try {
        if (method === "make_model") {
            if (!make || !model || !site)
                throw new Error("Make, model, and site required.");
            const isBoth = site === "both";
            const perSiteProgress = isBoth ? 40 : 70; // how much to award after each site scrape
            let results = [];
            if (site === "theclassicvaluer.com" || site === "both") {
                setProgress(10, `Starting scrapClassicValuer for ${make} ${model}`);
                const classicValuerResults = yield scrapClassicValuer(method, page, make, model, transmission, url, id, site === "both" ? 40 : 80, 20);
                results.push(...classicValuerResults);
                setProgress(Math.min(5 + perSiteProgress, 85), `scrapClassicValuer returned ${classicValuerResults.length} results`);
                if (site === "theclassicvaluer.com") {
                    yield handleResults(classicValuerResults, `${make}_${model}_classicvaluer_${getDateStr()}.csv`);
                }
            }
            if (site === "classic.com" || site === "both") {
                setProgress(isBoth ? 50 : 10, `Starting scrapeClassicCom for ${make} ${model}`);
                const classicComResults = yield scrapClassicCom(browser, page, make, model, transmission);
                results.push(...classicComResults);
                setProgress(Math.min(5 + perSiteProgress * (isBoth ? 2 : 1), 90), `scrapClassicCom returned ${classicComResults.length} results`);
                if (site === "classic.com") {
                    yield handleResults(classicComResults, `${make}_${model}_classiccom_${getDateStr()}.csv`);
                }
            }
            if (site === "both") {
                yield handleResults(results, `${make}_${model}_both_${getDateStr()}.csv`);
            }
            yield closeResources();
            return { statusCode: 200, message: `Scraping job ${id} completed for ${make} ${model}`, payload: { jobId: id, source: site } };
        }
        if (method === "url") {
            if (!url)
                throw new Error("URL is required.");
            let results = [];
            let source = "";
            setProgress(10, `Starting URL scrape for ${url}`);
            if (url.includes("theclassicvaluer.com")) {
                results = yield scrapClassicValuer(method, page, make, model, transmission, url, id, 70, 20);
                setProgress(85, `scrapClassicValuer returned ${results.length} results`);
                source = "theclassicvaluer.com";
            }
            else if (url.includes("classic.com")) {
                results = yield scrapeClassicComWithURL(url, page, id);
                setProgress(85, `scrapeClassicComWithURL returned ${results.length} results`);
                source = "classic.com";
            }
            else {
                return { statusCode: 200, message: `URL scraping not implemented for ${url}`, payload: { jobId: id, source: url } };
            }
            yield handleResults(results, `${source.replace(".", "_")}_url_${getDateStr()}.csv`);
            yield closeResources();
            return { statusCode: 200, message: `Scraping job ${id} completed from provided URL`, payload: { jobId: id, source } };
        }
        throw new Error(`Unknown method: ${method}`);
    }
    catch (error) {
        updateJob(id, { status: "failed", progress: 0 }, `Scraping error: ${error.message}`);
        yield closeResources();
        throw error;
    }
});
/** Get scraping job status */
const deriveFileNameFromLogs = (logs) => {
    var _a;
    if (!logs || !logs.length)
        return null;
    for (let i = logs.length - 1; i >= 0; i--) {
        const msg = ((_a = logs[i]) === null || _a === void 0 ? void 0 : _a.message) || "";
        const match = msg.match(/Saving results to (.+\/)?([^\/\s]+\.csv|\.zip)/i);
        if (match && match[2]) {
            return match[2];
        }
    }
    return null;
};
const normalizeJobFile = (id, job) => {
    if (job.fileName)
        return job.fileName;
    const derived = deriveFileNameFromLogs(job.logs);
    if (derived) {
        const updated = Object.assign(Object.assign({}, job), { fileName: derived });
        jobs.set(id, updated);
        debounceSaveJobs(5000);
        return derived;
    }
    return null;
};
export const getJobStatus = (jobId) => {
    const job = jobs.get(jobId) || { status: "not found", progress: 0, logs: [] };
    const fileName = normalizeJobFile(jobId, job) || job.fileName;
    return Object.assign(Object.assign({}, job), { fileName, logs: job.logs || [] });
};
/** Get snapshot of all jobs */
export const getAllJobs = () => {
    return Array.from(jobs.entries()).map(([id, job]) => {
        const fileName = normalizeJobFile(id, job) || job.fileName;
        return Object.assign(Object.assign({ jobId: id }, job), { fileName, logs: job.logs || [] });
    });
};
/** Remove job entry by filename (used when file is deleted) */
export const removeJobByFileName = (fileName) => __awaiter(void 0, void 0, void 0, function* () {
    const target = sanitizeFileName(fileName);
    let removed = false;
    for (const [id, job] of jobs.entries()) {
        const jobFile = sanitizeFileName(job.fileName || "");
        if (jobFile && jobFile === target) {
            jobs.delete(id);
            removed = true;
        }
    }
    if (removed)
        debounceSaveJobs(0);
    return removed;
});
/** Clear all jobs (memory + persisted file) */
export const clearAllJobs = () => __awaiter(void 0, void 0, void 0, function* () {
    jobs.clear();
    try {
        yield fs.mkdir(path.dirname(jobsFile), { recursive: true });
        yield fs.writeFile(jobsFile, "{}", "utf-8");
        // remove output files (CSV/ZIP) if folder exists
        const outDir = path.join(process.cwd(), "output");
        if (yield fs.access(outDir).then(() => true).catch(() => false)) {
            const files = yield fs.readdir(outDir);
            yield Promise.all(files.map((f) => __awaiter(void 0, void 0, void 0, function* () {
                const full = path.join(outDir, f);
                try {
                    yield fs.rm(full, { force: true, recursive: false });
                }
                catch (err) {
                    console.warn("Failed to remove output file:", full, err);
                }
            })));
        }
        console.log("Jobs cleared and output/jobs.json reset");
    }
    catch (err) {
        console.error("Failed to clear jobs file:", err);
        throw err;
    }
});
