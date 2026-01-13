/**
 * Title: classicvaluer.ts
 * Description: Scrap data from theclassicvaluer.com
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
import { EventEmitter } from "events";
import { clickElement, gotoPage, typeLikeHuman } from "../helpers/navigation.js";
// Dependencies
import dotenv from "dotenv";
import re from "re2";
import { wait } from "../helpers/utils.js";
import { updateJob } from "../Services/scrap.service.js";
dotenv.config();
const API_REGEX = new re("GetApiByV2ByAuctionResultsByCollectionByCollectionString\\.ajax", "i");
const NEXT_BUTTON_SELECTOR = 'a[data-testid="Pagination_NavButton_Next"]';
const CONTAINER_SELECTOR = "#comp-le47op7r";
const deriveStatus = (priceStr) => {
    const normalized = (priceStr || "").toLowerCase();
    if (!normalized.trim())
        return "Not Sold";
    return normalized.includes("not sold") ? "Not Sold" : "Sold";
};
const waitForEvent = (emitter, event, timeout) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeout);
    emitter.once(event, () => {
        clearTimeout(timer);
        resolve();
    });
});
const parseApiPayload = (data, seenPayloadSignatures) => {
    var _a, _b;
    let records = [];
    if (typeof data === "object" && !Array.isArray(data)) {
        const count = (_a = data === null || data === void 0 ? void 0 : data.result) === null || _a === void 0 ? void 0 : _a.count;
        if (count) {
            // track via outer scope where needed
        }
        records = ((_b = data === null || data === void 0 ? void 0 : data.result) === null || _b === void 0 ? void 0 : _b.records) || (data === null || data === void 0 ? void 0 : data.items) || [];
    }
    else if (Array.isArray(data)) {
        records = data;
    }
    const sig = JSON.stringify(records).slice(0, 500);
    if (seenPayloadSignatures.has(sig))
        return [];
    seenPayloadSignatures.add(sig);
    return records
        .filter((rec) => typeof rec === "object")
        .map((rec) => (Object.assign(Object.assign({}, rec), { sourceUrl: process.env.CLASSIC_VALUER_BASE_URL, status: deriveStatus(rec.price_usd_string) })));
};
const safeParseJson = (response) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const text = yield response.text();
        return JSON.parse(text);
    }
    catch (err) {
        console.error("Error parsing response JSON:", err);
        return null;
    }
});
const waitForContainer = (page) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const container = yield page.waitForSelector(CONTAINER_SELECTOR, {
            timeout: 10000,
        });
        yield container.scrollIntoViewIfNeeded();
        return true;
    }
    catch (_a) {
        console.log(`⚠️ Container ${CONTAINER_SELECTOR} not found.`);
        return false;
    }
});
export const scrapClassicValuer = (method, page, make, model, transmission, url, jobId, job_progress_point, prev_job_progress_point) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const triggerSearch = () => __awaiter(void 0, void 0, void 0, function* () {
            if (method !== "make_model")
                return;
            yield clickElement(page, '#input_comp-m30drsaf');
            yield wait(1500);
            yield typeLikeHuman(page, '#input_comp-m30drsaf', `${make} ${model} ${transmission}`.trim());
            yield wait(1500);
            yield page.keyboard.press("Enter");
            yield wait(5000);
        });
        // Navigate to Classic Valuer
        if (method === "make_model") {
            yield gotoPage(page, process.env.CLASSIC_VALUER_BASE_URL || "");
            yield wait(5000);
            updateJob(jobId, {}, `Navigated to Classic Valuer homepage`);
        }
        else if (method === "url") {
            yield gotoPage(page, url);
            yield wait(5000);
            updateJob(jobId, {}, `Navigated to ${url}`);
        }
        // --- Perform search by make/model ---
        console.log("📄 Page loaded:", yield page.title());
        // --- Scraping setup ---
        let results = [];
        let seenPayloadSignatures = new Set();
        let maxPages = 0;
        let currentPage = 1;
        let firstApiReceived = false;
        let lastSeenPageEvent = 0;
        const firstApiEvent = new EventEmitter();
        const pageApiEvent = new EventEmitter();
        // --- Listen for API responses (BEFORE search) ---
        page.on("response", (response) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            try {
                const resUrl = response.url();
                if (!API_REGEX.test(resUrl))
                    return;
                const headers = response.headers();
                const contentType = headers["content-type"] || "";
                if (!contentType.includes("application/json") &&
                    !contentType.includes("text/plain"))
                    return;
                if (response.status() !== 200)
                    return;
                const data = yield safeParseJson(response);
                if (!data)
                    return;
                if (typeof data === "object" && !Array.isArray(data)) {
                    const count = (_a = data === null || data === void 0 ? void 0 : data.result) === null || _a === void 0 ? void 0 : _a.count;
                    if (count)
                        maxPages = Math.ceil(count / 12);
                }
                const parsedRecords = parseApiPayload(data, seenPayloadSignatures);
                results.push(...parsedRecords);
                // Signal events
                firstApiReceived = true;
                firstApiEvent.emit("first"); // only first matters once
                lastSeenPageEvent = currentPage;
                pageApiEvent.emit("page", currentPage);
                console.log(`✅ Captured ${parsedRecords.length} records from API.`);
            }
            catch (err) {
                console.error("Error parsing API response:", err);
            }
        }));
        // --- Perform search by make/model ---
        yield triggerSearch();
        // --- Wait for container ---
        const hasContainer = yield waitForContainer(page);
        if (!hasContainer)
            return [];
        // --- Wait for first API response (retry with reload/search if missing) ---
        const ensureFirstApi = () => __awaiter(void 0, void 0, void 0, function* () {
            const maxAttempts = 3;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    if (firstApiReceived)
                        return;
                    yield Promise.race([waitForEvent(firstApiEvent, "first", 60000)]);
                    return;
                }
                catch (_a) {
                    console.log(`⚠️ First API response attempt ${attempt} timed out.`);
                    if (attempt === maxAttempts)
                        break;
                    console.log("🔄 Reloading page to retry API capture...");
                    yield page.reload({ waitUntil: "networkidle2" });
                    yield wait(3000);
                    yield triggerSearch();
                    const containerReady = yield waitForContainer(page);
                    if (!containerReady) {
                        console.log("⚠️ Container missing after reload; skipping further retries.");
                        break;
                    }
                }
            }
        });
        yield ensureFirstApi();
        console.log(`📄 Maximum pages to scrape: ${maxPages || "unknown"}`);
        const pagesToScrape = Math.max(1, maxPages || 1);
        const statusPerPage = pagesToScrape
            ? Math.floor(job_progress_point / pagesToScrape)
            : 0;
        // --- Pagination loop ---
        while (currentPage < pagesToScrape) {
            try {
                // Scroll the main container into view before clicking
                const container = yield page.$("#comp-le47op7r");
                if (container) {
                    yield container.scrollIntoViewIfNeeded();
                    // Small wait after scrolling to ensure DOM updates
                    yield new Promise(resolve => setTimeout(resolve, 2000));
                }
                // Wait for Next button to be visible and enabled
                const nextBtn = yield page.waitForSelector(NEXT_BUTTON_SELECTOR, {
                    visible: true,
                    timeout: 30000
                });
                const isDisabled = yield nextBtn.evaluate((btn) => btn.getAttribute('aria-disabled') === 'true');
                if (isDisabled) {
                    console.log(`✅ Next button disabled after page ${currentPage}.`);
                    break;
                }
                currentPage++;
                console.log(`➡️ Going to page ${currentPage}...`);
                // Click Next in the page context
                yield nextBtn.click();
                // Wait for page/API to load
                yield new Promise(resolve => setTimeout(resolve, 30000));
                console.log(`⏱ Waited 30 seconds for page ${currentPage}`);
                const progressDelta = Math.min(job_progress_point, statusPerPage * (currentPage - 1));
                updateJob(jobId, { progress: prev_job_progress_point + progressDelta }, `Scraping page ${currentPage} of ${maxPages}`);
            }
            catch (err) {
                console.log(`⚠️ Pagination stopped at page ${currentPage}:`, err.message);
                updateJob(jobId, {}, `Pagination stopped at page ${currentPage}: ${err.message}`);
                break;
            }
        }
        // --- Wait for last API response (so last page is captured) ---
        if (lastSeenPageEvent < currentPage) {
            try {
                yield Promise.race([waitForEvent(pageApiEvent, "page", 60000)]);
            }
            catch (_a) {
                console.log("⚠️ Last API response did not arrive in time.");
            }
        }
        // Capture title before closing the page to avoid detached frame errors
        const pageTitle = yield page.title();
        console.log(`✅ Scraping completed for ${pageTitle}. Total records: ${results.length}`);
        return results;
    }
    catch (error) {
        console.error("❌ Error scraping Classic Valuer:", error);
        return [];
    }
});
