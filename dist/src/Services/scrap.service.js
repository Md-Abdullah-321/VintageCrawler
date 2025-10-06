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
import { v4 as uuid } from "uuid";
import { saveToCSV } from "../helpers/output.js";
import { closeBrowser, createPage, launchBrowser, } from "../helpers/puppeteer-utils.js";
import { wait } from "../helpers/utils.js";
import { scrapClassicCom } from "../scraper/classiccom.js";
import { scrapClassicValuer } from "../scraper/classicvaluer.js";
// In-memory store for job status
const jobs = new Map();
export const startScraping = (method, url, make, model, transmission, site, keepDuplicates, debugMode) => __awaiter(void 0, void 0, void 0, function* () {
    const browser = yield launchBrowser(!debugMode);
    const page = yield createPage(browser);
    yield wait(2000);
    const id = uuid();
    let allResults = [];
    // Initialize job status
    jobs.set(id, {
        status: "in progress",
        progress: 10,
        fileName: `${id}.csv`,
        startedAt: new Date().toISOString(),
    });
    if (method === "make_model") {
        console.log(`🚀 Starting scraping job ${id} for ${make} ${model} at ${new Date().toISOString()}`);
        try {
            // ---- Scrape from TheClassicValuer ----
            if (site === "theclassicvaluer.com" || site === "both") {
                console.log(`Job ${id}: Scraping from theclassicvaluer.com...`);
                for (let i = 12; i <= 40; i += 2) {
                    yield wait(250);
                    jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: i }));
                }
                const classicvaluerResults = yield scrapClassicValuer(browser, page, make, model, transmission);
                allResults = allResults.concat(classicvaluerResults);
                jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: 40 }));
            }
            // ---- Scrape from Classic.com ----
            if (site === "classic.com" || site === "both") {
                console.log(`Job ${id}: Scraping from classic.com...`);
                for (let i = 42; i <= 70; i += 2) {
                    yield wait(250);
                    jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: i }));
                }
                const classicComResults = yield scrapClassicCom(browser, page, make, model, transmission);
                allResults = allResults.concat(classicComResults);
                jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: 70 }));
            }
            // ---- Save results to CSV ----
            const filePath = `./output/${id}.csv`;
            console.log(`Job ${id}: Saving CSV to ${filePath}...`);
            for (let i = 72; i <= 100; i += 2) {
                yield wait(250);
                jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: i }));
            }
            yield saveToCSV(allResults, filePath);
            jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: 100, status: "completed" }));
            console.log(`✅ Job ${id}: Completed successfully`);
            yield page.close();
            yield closeBrowser(browser);
            return {
                statusCode: 200,
                message: `Scraping job ${id} completed for ${make} ${model}`,
                payload: {
                    jobId: id,
                    source: site,
                },
            };
        }
        catch (error) {
            console.error(`❌ Job ${id}: Scraping error:`, error);
            jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { status: "failed", progress: 0 }));
            yield page.close();
            yield closeBrowser(browser);
            throw error;
        }
    }
    else if (method === "url") {
        try {
            console.log(`Job ${id}: Scraping from provided URL...`);
            // TODO: Implement URL-based scraping logic here
            console.log(`URL : ${url} `);
            yield page.close();
            yield closeBrowser(browser);
            return {
                statusCode: 200,
                message: `TODO: URL-based scraping not implemented yet for job ${id}`,
                payload: { jobId: id, source: url },
            };
        }
        catch (error) {
            console.error(`❌ Job ${id}: URL scraping error:`, error);
            jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { status: "failed", progress: 0 }));
            yield page.close();
            yield closeBrowser(browser);
            throw error;
        }
    }
});
export const getJobStatus = (jobId) => {
    const job = jobs.get(jobId);
    console.log(`Status request for job ${jobId}, current jobs Map:`, jobs);
    return job || { status: "not found", progress: 0 };
};
