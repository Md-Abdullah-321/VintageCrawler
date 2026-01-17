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
const NEXT_BUTTON_TIMEOUT = Number(process.env.CLASSIC_VALUER_NEXT_TIMEOUT || 60000);
const PAGE_API_TIMEOUT = Number(process.env.CLASSIC_VALUER_PAGE_API_TIMEOUT || 180000);
const FIRST_API_TIMEOUT = Number(process.env.CLASSIC_VALUER_FIRST_API_TIMEOUT || 90000);
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
const waitForPageEvent = (emitter, event, timeout, expectedPage) => new Promise((resolve, reject) => {
    const handler = (pageNum) => {
        if (pageNum >= expectedPage) {
            clearTimeout(timer);
            emitter.removeListener(event, handler);
            resolve();
        }
    };
    const timer = setTimeout(() => {
        emitter.removeListener(event, handler);
        reject(new Error("Timeout"));
    }, timeout);
    emitter.on(event, handler);
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
            timeout: 20000,
        });
        yield container.scrollIntoViewIfNeeded();
        return true;
    }
    catch (_a) {
        console.log(`⚠️ Container ${CONTAINER_SELECTOR} not found.`);
        return false;
    }
});
const buildNextRequest = (lastRequest, targetPage) => {
    if (!lastRequest)
        return null;
    const tryUpdateQuery = (urlStr) => {
        try {
            const url = new URL(urlStr);
            const params = url.searchParams;
            const pageKeys = [
                "page",
                "pageNumber",
                "pageNum",
                "page_index",
                "pageIndex",
                "p",
            ];
            const offsetKeys = ["offset", "skip", "start", "from"];
            const limitKeys = ["limit", "pageSize", "perPage", "count"];
            for (const key of pageKeys) {
                if (params.has(key)) {
                    params.set(key, String(targetPage));
                    url.search = params.toString();
                    return { url: url.toString(), method: "GET" };
                }
            }
            let limitValue = null;
            for (const key of limitKeys) {
                if (params.has(key)) {
                    const raw = Number(params.get(key));
                    if (!Number.isNaN(raw) && raw > 0)
                        limitValue = raw;
                }
            }
            for (const key of offsetKeys) {
                if (params.has(key)) {
                    const step = limitValue || 12;
                    const offset = (targetPage - 1) * step;
                    params.set(key, String(offset));
                    url.search = params.toString();
                    return { url: url.toString(), method: "GET" };
                }
            }
        }
        catch (_a) {
            return null;
        }
        return null;
    };
    if (lastRequest.method === "GET") {
        return tryUpdateQuery(lastRequest.url);
    }
    if (lastRequest.method === "POST" && lastRequest.postData) {
        const raw = lastRequest.postData.trim();
        if (raw.startsWith("{")) {
            try {
                const data = JSON.parse(raw);
                const pageKeys = [
                    "page",
                    "pageNumber",
                    "pageNum",
                    "page_index",
                    "pageIndex",
                ];
                const offsetKeys = ["offset", "skip", "start", "from"];
                const limitKeys = ["limit", "pageSize", "perPage", "count"];
                let updated = false;
                for (const key of pageKeys) {
                    if (key in data) {
                        data[key] = targetPage;
                        updated = true;
                        break;
                    }
                }
                if (!updated) {
                    let limitValue = null;
                    for (const key of limitKeys) {
                        if (key in data && typeof data[key] === "number" && data[key] > 0) {
                            limitValue = data[key];
                        }
                    }
                    for (const key of offsetKeys) {
                        if (key in data) {
                            const step = limitValue || 12;
                            data[key] = (targetPage - 1) * step;
                            updated = true;
                            break;
                        }
                    }
                }
                if (!updated)
                    return null;
                return {
                    url: lastRequest.url,
                    method: "POST",
                    postData: JSON.stringify(data),
                    headers: { "content-type": "application/json" },
                };
            }
            catch (_a) {
                return null;
            }
        }
        try {
            const params = new URLSearchParams(raw);
            const pageKeys = [
                "page",
                "pageNumber",
                "pageNum",
                "page_index",
                "pageIndex",
            ];
            const offsetKeys = ["offset", "skip", "start", "from"];
            const limitKeys = ["limit", "pageSize", "perPage", "count"];
            for (const key of pageKeys) {
                if (params.has(key)) {
                    params.set(key, String(targetPage));
                    return {
                        url: lastRequest.url,
                        method: "POST",
                        postData: params.toString(),
                        headers: { "content-type": "application/x-www-form-urlencoded" },
                    };
                }
            }
            let limitValue = null;
            for (const key of limitKeys) {
                if (params.has(key)) {
                    const rawVal = Number(params.get(key));
                    if (!Number.isNaN(rawVal) && rawVal > 0)
                        limitValue = rawVal;
                }
            }
            for (const key of offsetKeys) {
                if (params.has(key)) {
                    const step = limitValue || 12;
                    params.set(key, String((targetPage - 1) * step));
                    return {
                        url: lastRequest.url,
                        method: "POST",
                        postData: params.toString(),
                        headers: { "content-type": "application/x-www-form-urlencoded" },
                    };
                }
            }
        }
        catch (_b) {
            return null;
        }
    }
    return null;
};
const fetchApiData = (page, request) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield page.evaluate((req) => __awaiter(void 0, void 0, void 0, function* () {
            const options = {
                method: req.method,
                credentials: "include",
            };
            if (req.headers)
                options.headers = req.headers;
            if (req.postData)
                options.body = req.postData;
            const res = yield fetch(req.url, options);
            const text = yield res.text();
            return { status: res.status, text };
        }), request);
        if (!response || response.status < 200 || response.status >= 300) {
            return null;
        }
        return JSON.parse(response.text);
    }
    catch (err) {
        console.log("⚠️ Direct API fetch failed:", err.message);
        return null;
    }
});
const randomWait = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (minMs = 800, maxMs = 2200) {
    const envMin = Number(process.env.CLASSIC_VALUER_ACTION_WAIT_MIN_MS);
    const envMax = Number(process.env.CLASSIC_VALUER_ACTION_WAIT_MAX_MS);
    const finalMin = Number.isNaN(envMin) ? minMs : envMin;
    const finalMax = Number.isNaN(envMax) ? maxMs : envMax;
    const jitter = Math.floor(Math.random() * (finalMax - finalMin + 1)) + finalMin;
    yield wait(jitter);
});
const waitAfterNextClick = () => __awaiter(void 0, void 0, void 0, function* () {
    const delay = Number(process.env.CLASSIC_VALUER_WAIT_AFTER_NEXT_MS || 30000);
    yield wait(delay);
});
export const scrapClassicValuer = (method, page, make, model, transmission, url, jobId, job_progress_point, prev_job_progress_point) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const triggerSearch = () => __awaiter(void 0, void 0, void 0, function* () {
            if (method !== "make_model")
                return;
            yield randomWait();
            yield clickElement(page, '#input_comp-m30drsaf');
            yield wait(1500);
            yield randomWait();
            yield typeLikeHuman(page, '#input_comp-m30drsaf', `${make} ${model} ${transmission}`.trim());
            yield wait(1500);
            yield randomWait();
            yield page.keyboard.press("Enter");
            yield wait(5000);
        });
        // Navigate to Classic Valuer
        if (method === "make_model") {
            yield randomWait();
            yield gotoPage(page, process.env.CLASSIC_VALUER_BASE_URL || "");
            yield wait(5000);
            updateJob(jobId, {}, `Navigated to Classic Valuer homepage`);
        }
        else if (method === "url") {
            yield randomWait();
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
        let lastApiRequest = null;
        const firstApiEvent = new EventEmitter();
        const pageApiEvent = new EventEmitter();
        // --- Listen for API responses (BEFORE search) ---
        page.on("response", (response) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            try {
                const resUrl = response.url();
                if (!API_REGEX.test(resUrl))
                    return;
                const req = response.request();
                lastApiRequest = {
                    url: resUrl,
                    method: req.method(),
                    postData: req.postData() || null,
                };
                if (response.status() < 200 || response.status() >= 300) {
                    console.log(`⚠️ API response status ${response.status()} for ${resUrl}`);
                    return;
                }
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
            const maxAttempts = 5;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    if (firstApiReceived)
                        return;
                    yield Promise.race([
                        waitForEvent(firstApiEvent, "first", FIRST_API_TIMEOUT),
                    ]);
                    return;
                }
                catch (_a) {
                    console.log(`⚠️ First API response attempt ${attempt} timed out.`);
                    if (attempt === maxAttempts)
                        break;
                    console.log("🔄 Reloading page to retry API capture...");
                    yield randomWait();
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
        const waitForNextButton = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (attempts = 3) {
            for (let attempt = 1; attempt <= attempts; attempt++) {
                try {
                    const container = yield page.$(CONTAINER_SELECTOR);
                    if (container) {
                        yield container.scrollIntoViewIfNeeded();
                        yield new Promise((resolve) => setTimeout(resolve, 1500));
                    }
                    yield wait(1500);
                    const nextBtn = yield page.waitForSelector(NEXT_BUTTON_SELECTOR, {
                        visible: true,
                        timeout: NEXT_BUTTON_TIMEOUT,
                    });
                    const isDisabled = yield nextBtn.evaluate((btn) => btn.getAttribute("aria-disabled") === "true");
                    if (isDisabled)
                        return null;
                    return nextBtn;
                }
                catch (err) {
                    console.log(`⚠️ Next button attempt ${attempt} failed: ${err.message}`);
                    yield new Promise((resolve) => setTimeout(resolve, 2000));
                }
            }
            return null;
        });
        const waitForPageApi = (expectedPage_1, ...args_1) => __awaiter(void 0, [expectedPage_1, ...args_1], void 0, function* (expectedPage, attempts = 2) {
            for (let attempt = 1; attempt <= attempts; attempt++) {
                try {
                    if (lastSeenPageEvent >= expectedPage)
                        return true;
                    yield Promise.race([
                        waitForPageEvent(pageApiEvent, "page", PAGE_API_TIMEOUT, expectedPage),
                        page.waitForResponse((res) => API_REGEX.test(res.url()) &&
                            res.status() >= 200 &&
                            res.status() < 300, { timeout: PAGE_API_TIMEOUT }),
                    ]);
                    return true;
                }
                catch (_a) {
                    console.log(`⚠️ Page API response attempt ${attempt} timed out.`);
                    yield new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
            return false;
        });
        while (currentPage < pagesToScrape) {
            try {
                const nextBtn = yield waitForNextButton(4);
                if (!nextBtn) {
                    console.log(`✅ Next button disabled after page ${currentPage}.`);
                    break;
                }
                currentPage++;
                console.log(`➡️ Going to page ${currentPage}...`);
                // Click Next in the page context
                yield randomWait();
                yield nextBtn.click();
                yield waitAfterNextClick();
                const gotApi = yield waitForPageApi(currentPage, 3);
                if (!gotApi) {
                    console.log(`⚠️ No API response after navigating to page ${currentPage}. Retrying click...`);
                    const retryBtn = yield waitForNextButton(2);
                    if (retryBtn) {
                        yield randomWait();
                        yield retryBtn.click();
                        yield wait(2000);
                        yield waitForPageApi(currentPage, 2);
                    }
                }
                if (lastSeenPageEvent < currentPage && lastApiRequest) {
                    const fallbackRequest = buildNextRequest(lastApiRequest, currentPage);
                    if (fallbackRequest) {
                        console.log(`⚠️ Using direct API fetch fallback for page ${currentPage}...`);
                        const data = yield fetchApiData(page, fallbackRequest);
                        if (data) {
                            const parsedRecords = parseApiPayload(data, seenPayloadSignatures);
                            if (parsedRecords.length) {
                                results.push(...parsedRecords);
                                lastSeenPageEvent = currentPage;
                                pageApiEvent.emit("page", currentPage);
                                console.log(`✅ Fallback captured ${parsedRecords.length} records for page ${currentPage}.`);
                            }
                        }
                    }
                }
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
