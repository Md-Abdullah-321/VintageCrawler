/**
 * Title: scrapeClassicCom.ts
 * Description: Scrapes car data from Classic.com using existing Puppeteer page.
 * Author: Md Abdullah
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
import { gotoPage } from "../helpers/navigation.js";
import { updateJob } from "../Services/scrap.service.js";
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
/**
 * Scrapes Classic.com for a given URL using an existing Puppeteer page.
 * @param targetUrl - The Classic.com URL to scrape.
 * @param page - Puppeteer Page instance (already opened).
 * @param jobId - Job ID for logging progress.
 * @returns Array of car data
 */
export const scrapeClassicComWithURL = (targetUrl, page, jobId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!targetUrl || !targetUrl.includes("classic.com")) {
        updateJob(jobId, {}, "Invalid URL. Must be a valid Classic.com URL.");
        throw new Error("❌ Invalid URL. Must be a valid Classic.com URL.");
    }
    console.log(`🚀 Starting scrape for: ${targetUrl}`);
    updateJob(jobId, {}, `Starting scrape for: ${targetUrl}`);
    const results = [];
    try {
        // Navigate to the target URL
        console.log("Navigating to", targetUrl);
        yield gotoPage(page, targetUrl, 60000).catch(err => {
            console.error("❌ Navigation failed:", err);
            updateJob(jobId, {}, `Failed to navigate to ${targetUrl}: ${err.message}`);
            throw new Error(`Failed to navigate to ${targetUrl}: ${err.message}`);
        });
        console.log("✅ Page loaded successfully");
        updateJob(jobId, {}, "Page loaded successfully");
        // Wait for the search form to ensure page is fully loaded
        yield page.waitForSelector("#search-form", { timeout: 30000 }).catch(err => {
            console.error("❌ Failed to find search form:", err);
            updateJob(jobId, {}, "Search form not found: " + err.message);
            throw new Error("Search form not found: " + err.message);
        });
        const count = yield page.evaluate(() => {
            var _a;
            const form = document.getElementById("search-form");
            const coachmark = form === null || form === void 0 ? void 0 : form.querySelector("#search-location-coachmark");
            const p = coachmark === null || coachmark === void 0 ? void 0 : coachmark.previousElementSibling;
            return p ? parseInt(((_a = p.querySelectorAll("span")[1]) === null || _a === void 0 ? void 0 : _a.textContent) || "0") : 0;
        }).catch(err => {
            console.error("❌ Failed to evaluate page count:", err);
            updateJob(jobId, {}, "Failed to evaluate page count: " + err.message);
            throw new Error("Failed to evaluate page count: " + err.message);
        });
        const totalPages = Math.ceil(count / 24) || 1;
        console.log(`📄 Total pages detected: ${totalPages}`);
        updateJob(jobId, { progress: 20 }, `Total pages detected: ${totalPages}`);
        const clickNextButton = () => __awaiter(void 0, void 0, void 0, function* () {
            const clicked = yield page.evaluate(() => {
                var _a;
                const anchors = Array.from(document.querySelectorAll("#search-form > div > div:nth-child(4) a"));
                for (const anchor of anchors) {
                    if (((_a = anchor.textContent) === null || _a === void 0 ? void 0 : _a.trim()) === "chevron_right") {
                        anchor.scrollIntoView({ behavior: "smooth", block: "center" });
                        anchor.click();
                        return true;
                    }
                }
                return false;
            }).catch(err => {
                console.error("❌ Failed to evaluate next button:", err);
                updateJob(jobId, {}, "Failed to evaluate next button: " + err.message);
                throw new Error("Failed to evaluate next button: " + err.message);
            });
            if (clicked) {
                console.log("⏳ Waiting for next page to load...");
                updateJob(jobId, {}, "Waiting for next page to load...");
                yield wait(5000);
                yield page.waitForSelector(".group", { timeout: 30000 }).catch(err => {
                    console.error("❌ Failed to load next page:", err);
                    updateJob(jobId, {}, "Next page failed to load: " + err.message);
                    throw new Error("Next page failed to load: " + err.message);
                });
            }
            return clicked;
        });
        for (let i = 1; i <= totalPages; i++) {
            console.log(`🔹 Scraping page ${i}/${totalPages}...`);
            updateJob(jobId, { progress: 20 + (i / totalPages) * 50 }, `Scraping page ${i}/${totalPages}...`);
            yield page.waitForSelector(".group", { timeout: 30000 }).catch(err => {
                console.error(`❌ Failed to find .group on page ${i}:`, err);
                updateJob(jobId, {}, `Failed to find .group on page ${i}: ${err.message}`);
                throw new Error(`Failed to find .group on page ${i}: ${err.message}`);
            });
            const carsData = yield page.evaluate(() => {
                const allGroups = Array.from(document.querySelectorAll(".group"));
                const selectedGroups = allGroups.slice(5);
                return selectedGroups.map((group) => {
                    var _a;
                    const getText = (sel) => { var _a, _b; return ((_b = (_a = group.querySelector(sel)) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || null; };
                    return {
                        title: getText("h3 a"),
                        mileage: getText("ul li:nth-child(1) span"),
                        location: getText(".flex.items-center img + div"),
                        originality: getText("ul li:nth-child(3) span span span"),
                        transmission: getText("ul li:nth-child(4) span span:nth-child(2)"),
                        gearbox: getText("ul li:nth-child(5) span span:nth-child(2)"),
                        status: getText('[data-testid="badge"]'),
                        date: getText(".hidden.table\\:block:nth-child(2)"),
                        auction: getText('a[href*="/lots/"]'),
                        price: getText('[id$="-price"] > div'),
                        link: ((_a = group.querySelector('a[href*="/veh/"]')) === null || _a === void 0 ? void 0 : _a.getAttribute("href")) || null,
                    };
                });
            }).catch(err => {
                console.error(`❌ Failed to evaluate cars on page ${i}:`, err);
                updateJob(jobId, {}, `Failed to evaluate cars on page ${i}: ${err.message}`);
                throw new Error(`Failed to evaluate cars on page ${i}: ${err.message}`);
            });
            results.push(...carsData);
            console.log(`✅ Page ${i} scraped (${carsData.length} cars)`);
            updateJob(jobId, {}, `Page ${i} scraped (${carsData.length} cars)`);
            if (i < totalPages) {
                const hasNext = yield clickNextButton();
                if (!hasNext) {
                    console.log("No more pages to scrape.");
                    updateJob(jobId, {}, "No more pages to scrape.");
                    break;
                }
            }
        }
        for (let i = 0; i < results.length; i++) {
            const car = results[i];
            if (!car.link) {
                console.warn(`⚠️ Skipping car with no link at index ${i}`);
                updateJob(jobId, {}, `Skipping car with no link at index ${i}`);
                continue;
            }
            console.log(`🔍 Scraping details for: ${car.title}`);
            updateJob(jobId, {}, `Scraping details for: ${car.title}`);
            try {
                const detailUrl = `https://www.classic.com${car.link}`;
                console.log(`Navigating to ${detailUrl}`);
                yield page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(err => {
                    console.error(`❌ Failed to navigate to ${detailUrl}:`, err);
                    updateJob(jobId, {}, `Failed to navigate to ${detailUrl}: ${err.message}`);
                    throw new Error(`Failed to navigate to ${detailUrl}: ${err.message}`);
                });
                const specsTab = yield page.$('[data-tab="specs"]').catch(err => {
                    console.error(`❌ Failed to find specs tab for ${car.title}:`, err);
                    updateJob(jobId, {}, `Failed to find specs tab for ${car.title}: ${err.message}`);
                    throw new Error(`Failed to find specs tab: ${err.message}`);
                });
                if (!specsTab) {
                    console.warn(`⚠️ No specs tab for ${car.title}`);
                    updateJob(jobId, {}, `No specs tab for ${car.title}`);
                    continue;
                }
                yield specsTab.click();
                yield wait(1000);
                const specs = yield page.evaluate(() => {
                    const rows = document.querySelectorAll('.tab-content [data-tab="specs"] .flex.flex-row');
                    const data = {};
                    rows.forEach((row) => {
                        var _a, _b, _c, _d;
                        const label = (_b = (_a = row.querySelector("div.text-gray-500")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim();
                        const value = (_d = (_c = row.querySelector("div.font-medium")) === null || _c === void 0 ? void 0 : _c.textContent) === null || _d === void 0 ? void 0 : _d.trim();
                        if (label && value)
                            data[label] = value;
                    });
                    return data;
                }).catch(err => {
                    console.error(`❌ Failed to evaluate specs for ${car.title}:`, err);
                    updateJob(jobId, {}, `Failed to evaluate specs for ${car.title}: ${err.message}`);
                    throw new Error(`Failed to evaluate specs: ${err.message}`);
                });
                results[i] = Object.assign(Object.assign({}, car), specs);
            }
            catch (err) {
                console.warn(`⚠️ Failed to scrape specs for ${car.title}: ${err.message}`);
                updateJob(jobId, {}, `Failed to scrape specs for ${car.title}: ${err.message}`);
            }
        }
        console.log(`📊 Scraped ${results.length} car listings.`);
        updateJob(jobId, { progress: 90 }, `Scraped ${results.length} car listings.`);
        return results;
    }
    catch (error) {
        console.error("❌ Scraping failed:", error);
        updateJob(jobId, { status: "failed", progress: 0 }, `Scraping failed: ${error.message}`);
        throw error;
    }
});
