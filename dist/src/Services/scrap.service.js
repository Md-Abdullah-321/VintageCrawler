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
export const startScraping = (make, model, transmission, site, keepDuplicates, debugMode) => __awaiter(void 0, void 0, void 0, function* () {
    const browser = yield launchBrowser(!debugMode);
    const page = yield createPage(browser);
    yield wait(2000);
    const id = uuid();
    let allResults = [];
    console.log(`🚀 Starting scraping job ${id} for ${make} ${model} at ${new Date().toISOString()}`);
    // Initialize job status with 10% immediately
    jobs.set(id, {
        status: "in progress",
        progress: 10, // Start at 10% after browser launch
        fileName: `${id}.csv`,
        startedAt: new Date().toISOString(),
    });
    try {
        if (site === "theclassicvaluer.com" || site === "both") {
            console.log(`Job ${id}: Scraping from theclassicvaluer.com...`);
            for (let i = 12; i <= 40; i += 2) { // Start from 12% after initial 10%
                yield wait(250);
                jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: i }));
                console.log(`Job ${id}: Progress ${i}% - Scraping classicvaluer...`);
            }
            const classicvaluerResults = yield scrapClassicValuer(browser, page, make, model, transmission);
            allResults = allResults.concat(classicvaluerResults);
            console.log(`Job ${id}: Progress 40% - theclassicvaluer.com done`);
            jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: 40 }));
        }
        if (site === "classic.com" || site === "both") {
            console.log(`Job ${id}: Scraping from classic.com...`);
            for (let i = 42; i <= 70; i += 2) {
                yield wait(250);
                jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: i }));
                console.log(`Job ${id}: Progress ${i}% - Scraping classic.com...`);
            }
            const classicComResults = yield scrapClassicCom(browser, page, make, model, transmission);
            // ... (rest of the validation logic)
            jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: 70 }));
        }
        // Save results as CSV
        const filePath = `./output/${id}.csv`;
        console.log(`Job ${id}: Saving CSV to ${filePath}...`);
        for (let i = 72; i <= 100; i += 2) {
            yield wait(250);
            jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: i }));
            console.log(`Job ${id}: Progress ${i}% - Saving CSV...`);
        }
        yield saveToCSV(allResults, filePath);
        console.log(`Job ${id}: Progress 100%, status completed`);
        jobs.set(id, Object.assign(Object.assign({}, jobs.get(id)), { progress: 100, status: "completed" }));
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
        throw error;
    }
});
export const getJobStatus = (jobId) => {
    const job = jobs.get(jobId);
    console.log(`Status request for job ${jobId}, current jobs Map:`, jobs);
    return job || { status: "not found", progress: 0 };
};
