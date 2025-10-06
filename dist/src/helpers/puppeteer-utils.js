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
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
puppeteerExtra.use(StealthPlugin());
export const launchBrowser = (...args_1) => __awaiter(void 0, [...args_1], void 0, function* (headless = true) {
    try {
        console.log(`Attempting to launch browser in ${headless ? "headless" : "headful"} mode...`);
        const browser = yield puppeteerExtra.launch({
            headless: headless,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--window-size=1920,1080",
            ],
            defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
            timeout: 30000,
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
