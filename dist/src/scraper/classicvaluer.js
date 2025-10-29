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
import { clickElement, gotoPage, typeLikeHuman, } from "../helpers/navigation.js";
// Dependencies
import dotenv from "dotenv";
import re from "re2";
import { wait } from "../helpers/utils.js";
dotenv.config();
export const scrapClassicValuer = (method, browser, page, make, model, transmission, url) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Navigate to Classic Valuer
        if (method === "make_model") {
            yield gotoPage(page, process.env.CLASSIC_VALUER_BASE_URL || "");
        }
        else if (method === "url") {
            yield gotoPage(page, url);
        }
        console.log("📄 Page loaded:", yield page.title());
        // --- Scraping setup ---
        let results = [];
        let seenPayloadSignatures = new Set();
        let maxPages = 0;
        let currentPage = 1;
        const firstApiEvent = new EventEmitter();
        const pageApiEvent = new EventEmitter();
        const API_REGEX = new re("GetApiByV2ByAuctionResultsByCollectionByCollectionString\\.ajax", "i");
        const NEXT_BUTTON_SELECTOR = 'a[data-testid="Pagination_NavButton_Next"]';
        const CONTAINER_SELECTOR = "#comp-le47op7r";
        // --- Listen for API responses (BEFORE search) ---
        page.on("response", (response) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
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
                const data = yield response.json();
                let records = [];
                if (typeof data === "object" && !Array.isArray(data)) {
                    const count = (_a = data === null || data === void 0 ? void 0 : data.result) === null || _a === void 0 ? void 0 : _a.count;
                    if (count)
                        maxPages = Math.ceil(count / 12);
                    records = ((_b = data === null || data === void 0 ? void 0 : data.result) === null || _b === void 0 ? void 0 : _b.records) || (data === null || data === void 0 ? void 0 : data.items) || [];
                }
                else if (Array.isArray(data)) {
                    records = data;
                }
                // Deduplicate
                const sig = JSON.stringify(records).slice(0, 500);
                if (!seenPayloadSignatures.has(sig)) {
                    seenPayloadSignatures.add(sig);
                    for (const rec of records) {
                        if (typeof rec === "object") {
                            rec.sourceUrl = process.env.CLASSIC_VALUER_BASE_URL;
                            // ✅ Add status based on price_usd_string
                            const priceStr = rec.price_usd_string || "";
                            rec.status =
                                priceStr.toLowerCase().includes("not sold") ||
                                    priceStr.trim() === ""
                                    ? "Not Sold"
                                    : "Sold";
                            results.push(rec);
                        }
                    }
                }
                // Signal events
                firstApiEvent.emit("first"); // only first matters once
                pageApiEvent.emit("page", currentPage);
                console.log(`✅ Captured ${records.length} records from API.`);
            }
            catch (err) {
                console.error("Error parsing API response:", err);
            }
        }));
        // --- Perform search by make/model ---
        if (method === "make_model") {
            yield clickElement(page, '[name="enter-a make and/or model"]');
            yield wait(1500);
            yield typeLikeHuman(page, '[placeholder="Enter a make and/or model"]', `${make} ${model} ${transmission}`.trim());
            yield wait(1500);
            yield page.keyboard.press("Enter");
        }
        // --- Wait for container ---
        try {
            const container = yield page.waitForSelector(CONTAINER_SELECTOR, {
                timeout: 10000,
            });
            yield container.scrollIntoViewIfNeeded();
        }
        catch (_a) {
            console.log(`⚠️ Container ${CONTAINER_SELECTOR} not found.`);
            return [];
        }
        // --- Wait for first API response (so first page is captured) ---
        try {
            yield Promise.race([
                new Promise((resolve) => firstApiEvent.once("first", resolve)),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout waiting for API")), 60000)),
            ]);
        }
        catch (_b) {
            console.log("⚠️ First API response did not arrive in time.");
        }
        console.log(`📄 Maximum pages to scrape: ${maxPages || "unknown"}`);
        // --- Pagination loop ---
        while (currentPage < maxPages) {
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
            }
            catch (err) {
                console.log(`⚠️ Pagination stopped at page ${currentPage}:`, err.message);
                break;
            }
        }
        return results;
    }
    catch (error) {
        console.error("❌ Error scraping Classic Valuer:", error);
        return [];
    }
});
