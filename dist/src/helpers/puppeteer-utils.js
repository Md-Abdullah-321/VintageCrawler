/**
 * Title: CreateBrowserInstance.ts
 * Description: This function creates and returns a new browser instance.
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
import puppeteer from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { wait } from "./utils.js";
puppeteerExtra.use(StealthPlugin());
export const launchBrowser = (headless) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log(`Attempting to launch browser in ${headless ? "headless" : "headful"} mode...`);
        const browser = yield puppeteerExtra.launch({
            headless: headless, // always headless in VPS Docker
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--disable-gpu",
                "--no-zygote",
                "--single-process",
                "--disable-blink-features=AutomationControlled",
                "--window-size=1920,1080",
            ],
            defaultViewport: { width: 1920, height: 1080 },
            timeout: 0,
            executablePath: puppeteer.executablePath(),
        });
        console.log("Browser launched successfully.");
        return browser;
    }
    catch (error) {
        console.error("❌ Failed to launch browser:", error.message, error.stack);
        throw new Error(`Failed to launch browser: ${error.message}`);
    }
});
export const createPage = (browser) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log("Creating new page...");
        const page = yield browser.newPage();
        yield page.setCacheEnabled(false);
        yield page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        yield page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
        console.log("New page created successfully.");
        return page;
    }
    catch (error) {
        console.error("❌ Failed to create page:", error.message, error.stack);
        throw new Error(`Failed to create page: ${error.message}`);
    }
});
export const closeBrowser = (browser) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (browser) {
            yield browser.close();
            console.log("Browser closed successfully.");
        }
    }
    catch (error) {
        console.error("❌ Failed to close browser:", error.message, error.stack);
    }
});
export const closePage = (page) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (page && !page.isClosed()) {
            yield page.close({ runBeforeUnload: true });
            console.log("Page closed successfully.");
        }
    }
    catch (err) {
        console.warn("⚠️ Page close failed:", err.message);
    }
});
// Safe close function to close page and browser
export const safeClose = (page, browser) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (page) {
            yield page.close({ runBeforeUnload: true });
            console.log("Page closed successfully.");
        }
    }
    catch (err) {
        console.warn("⚠️ Page close failed:", err.message);
    }
    try {
        if (browser) {
            yield wait(500).then(() => browser.close());
            console.log("Browser closed successfully.");
        }
    }
    catch (err) {
        console.warn("⚠️ Browser close failed:", err.message);
    }
});
