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
export const launchBrowser = (headless) => __awaiter(void 0, void 0, void 0, function* () {
    const browser = yield puppeteerExtra.launch({
        headless,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-blink-features=AutomationControlled",
            "--window-size=1920,1080",
        ],
        defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
    });
    console.info("Browser launched successfully.");
    return browser;
});
export const createPage = (browser) => __awaiter(void 0, void 0, void 0, function* () {
    const page = yield browser.newPage();
    yield page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    yield page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    console.info("New page created successfully.");
    return page;
});
export const closeBrowser = (browser) => __awaiter(void 0, void 0, void 0, function* () {
    if (browser)
        yield browser.close();
    console.info("Browser closed successfully.");
    return;
});
