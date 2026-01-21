/**
 * Title: classicvaluer.ts
 * Description: Scrape data from theclassicvaluer.com
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
import dotenv from "dotenv";
import { EventEmitter } from "events";
import { clickElement, gotoPage, typeLikeHuman } from "../helpers/navigation.js";
import { wait } from "../helpers/utils.js";
import { updateJob } from "../Services/scrap.service.js";
dotenv.config();
/* ------------------------------------------------------------------ */
/* Constants */
/* ------------------------------------------------------------------ */
const API_REGEX = /AuctionResults/i;
const CONTAINER_SELECTOR = "#comp-le47op7r";
const FIRST_API_TIMEOUT = Number(process.env.CLASSIC_VALUER_FIRST_API_TIMEOUT || 20000);
const MAX_API_RETRIES = 5;
/* ------------------------------------------------------------------ */
/* Helpers */
/* ------------------------------------------------------------------ */
const deriveStatus = (priceStr) => {
    const normalized = (priceStr || "").toLowerCase().trim();
    if (!normalized)
        return "Not Sold";
    return normalized.includes("not sold") ? "Not Sold" : "Sold";
};
const waitForEvent = (emitter, event, timeout) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for API")), timeout);
    emitter.once(event, () => {
        clearTimeout(timer);
        resolve();
    });
});
const waitForContainer = (page) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const el = yield page.waitForSelector(CONTAINER_SELECTOR, {
            timeout: 20000
        });
        yield el.scrollIntoViewIfNeeded();
        return true;
    }
    catch (_a) {
        console.log("⚠️ Result container not found.");
        return false;
    }
});
const buildPaginatedRequest = (lastRequest, limit, offset) => {
    let payload;
    try {
        payload = JSON.parse(lastRequest.postData);
    }
    catch (_a) {
        throw new Error("Failed to parse API payload");
    }
    if (!Array.isArray(payload)) {
        throw new Error("Unexpected API payload format");
    }
    const paginationObj = payload.find((item) => typeof item === "object" &&
        item !== null &&
        "limit" in item &&
        "offset" in item);
    if (!paginationObj) {
        throw new Error("Pagination object not found in API payload");
    }
    paginationObj.limit = limit;
    paginationObj.offset = offset;
    return {
        url: lastRequest.url,
        method: lastRequest.method,
        postData: JSON.stringify(payload),
        headers: Object.assign(Object.assign({}, lastRequest.headers), { "content-type": "application/json" })
    };
};
const fetchApiData = (page, req) => __awaiter(void 0, void 0, void 0, function* () {
    return yield page.evaluate((r) => {
        return fetch(r.url, {
            method: r.method,
            body: r.postData,
            headers: r.headers,
            credentials: "include"
        }).then(res => {
            if (!res.ok)
                return null;
            return res.json();
        }).catch(() => null);
    }, req);
});
/* ------------------------------------------------------------------ */
/* Main Scraper */
/* ------------------------------------------------------------------ */
export const scrapClassicValuer = (method, page, make, model, transmission, url, jobId, job_progress_point, prev_job_progress_point) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        /* -------------------------------------------------------------- */
        /* Navigation */
        /* -------------------------------------------------------------- */
        const triggerSearch = () => __awaiter(void 0, void 0, void 0, function* () {
            if (method !== "make_model")
                return;
            yield clickElement(page, "#input_comp-m30drsaf");
            yield wait(1200);
            yield typeLikeHuman(page, "#input_comp-m30drsaf", `${make} ${model} ${transmission}`.trim());
            yield wait(800);
            yield page.keyboard.press("Enter");
        });
        if (method === "make_model") {
            yield gotoPage(page, process.env.CLASSIC_VALUER_BASE_URL);
        }
        else {
            yield gotoPage(page, url);
        }
        yield wait(4000);
        /* -------------------------------------------------------------- */
        /* State */
        /* -------------------------------------------------------------- */
        let results = [];
        let lastApiRequest = null;
        let totalCount = 0;
        let apiCaptured = false;
        const apiEvent = new EventEmitter();
        /* -------------------------------------------------------------- */
        /* API Listener (clean + deterministic) */
        /* -------------------------------------------------------------- */
        page.removeAllListeners("response");
        const responseHandler = (response) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c;
            const resUrl = response.url();
            if (!API_REGEX.test(resUrl))
                return;
            try {
                const data = yield response.json();
                const records = (_a = data === null || data === void 0 ? void 0 : data.result) === null || _a === void 0 ? void 0 : _a.records;
                if (!Array.isArray(records) || records.length === 0)
                    return;
                const req = response.request();
                const postData = req.postData();
                if (!postData)
                    return;
                lastApiRequest = {
                    url: resUrl,
                    method: req.method(),
                    postData,
                    headers: req.headers()
                };
                totalCount = (_c = (_b = data === null || data === void 0 ? void 0 : data.result) === null || _b === void 0 ? void 0 : _b.count) !== null && _c !== void 0 ? _c : records.length;
                results = records.map((r) => (Object.assign(Object.assign({}, r), { sourceUrl: process.env.CLASSIC_VALUER_BASE_URL, status: deriveStatus(r.price_usd_string) })));
                apiCaptured = true;
                apiEvent.emit("hit");
                console.log(`✅ API captured (${records.length} / ${totalCount})`);
            }
            catch (_d) {
                /* ignore non-JSON / noise responses */
            }
        });
        page.on("response", responseHandler);
        /* -------------------------------------------------------------- */
        /* Capture Phase */
        /* -------------------------------------------------------------- */
        let attempt = 0;
        while (attempt < MAX_API_RETRIES && !apiCaptured) {
            attempt++;
            console.log(`🔄 API attempt ${attempt}/${MAX_API_RETRIES}`);
            yield triggerSearch();
            const containerReady = yield waitForContainer(page);
            if (!containerReady) {
                console.log("⚠️ Container not ready, reloading...");
                yield page.reload({ waitUntil: "networkidle2" });
                yield wait(3000);
                attempt--; // retry this attempt
                continue;
            }
            try {
                yield waitForEvent(apiEvent, "hit", FIRST_API_TIMEOUT);
            }
            catch (_b) {
                console.log("⚠️ API not detected, reloading...");
                yield page.reload({ waitUntil: "networkidle2" });
                yield wait(3000);
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
            const pagData = yield fetchApiData(page, pagReq);
            if (pagData && Array.isArray((_a = pagData === null || pagData === void 0 ? void 0 : pagData.result) === null || _a === void 0 ? void 0 : _a.records)) {
                const batch = pagData.result.records.map((r) => (Object.assign(Object.assign({}, r), { sourceUrl: process.env.CLASSIC_VALUER_BASE_URL, status: deriveStatus(r.price_usd_string) })));
                results.push(...batch);
                if (batch.length < limit) {
                    console.log(`⚠️ Received fewer records than requested (${batch.length}/${limit}). Stopping.`);
                    break;
                }
            }
            else {
                console.log(`⚠️ Failed to fetch batch at offset ${offset}.`);
                break;
            }
            offset += limit;
        }
        /* -------------------------------------------------------------- */
        /* Job Update */
        /* -------------------------------------------------------------- */
        yield updateJob(jobId, { progress: prev_job_progress_point + job_progress_point }, "Classic Valuer scraping completed");
        console.log(`✅ Total records scraped: ${results.length}`);
        return results;
    }
    catch (err) {
        console.error("❌ Error scraping Classic Valuer:", err);
        return [];
    }
});
