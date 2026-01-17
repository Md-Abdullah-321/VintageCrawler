/**
 * Title: CreateBrowserInstance.ts
 * Description: This function creates and returns a new browser instance.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { wait } from "./utils.js";

puppeteerExtra.use(StealthPlugin());

export const launchBrowser = async (headless: boolean): Promise<Browser> => {
  try {
    console.log(`Attempting to launch browser in ${headless ? "headless" : "headful"} mode...`);
    const browser = await puppeteerExtra.launch({
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
  } catch (error: any) {
    console.error("❌ Failed to launch browser:", error.message, error.stack);
    throw new Error(`Failed to launch browser: ${error.message}`);
  }
};

export const createPage = async (browser: Browser): Promise<Page> => {
  try {
    console.log("Creating new page...");
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    console.log("New page created successfully.");
    return page;
  } catch (error: any) {
    console.error("❌ Failed to create page:", error.message, error.stack);
    throw new Error(`Failed to create page: ${error.message}`);
  }
};

export const closeBrowser = async (browser: Browser) => {
  try {
    if (browser) {
      await browser.close();
      console.log("Browser closed successfully.");
    }
  } catch (error: any) {
    console.error("❌ Failed to close browser:", error.message, error.stack);
  }
};

export const closePage = async (page: Page | null) => {
  try {
    if (page && !page.isClosed()) {
      await page.close({ runBeforeUnload: true });
      console.log("Page closed successfully.");
    }
  } catch (err: any) {
    console.warn("⚠️ Page close failed:", err.message);
  }
};

// Safe close function to close page and browser
export const safeClose = async (page: Page | null, browser: Browser | null) => {
  try {
    if (page) {
      await page.close({ runBeforeUnload: true });
      console.log("Page closed successfully.");
    }
  } catch (err: any) {
    console.warn("⚠️ Page close failed:", err.message);
  }
  try {
    if (browser) {
      await wait(500).then(() => browser.close());
      console.log("Browser closed successfully.");
    }
  } catch (err: any) {
    console.warn("⚠️ Browser close failed:", err.message);
  }
};
