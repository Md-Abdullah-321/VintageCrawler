/**
 * Title: CreateBrowserInstance.ts
 * Description: This function creates and returns a new browser instance.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import type { Browser, Page } from "puppeteer";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteerExtra.use(StealthPlugin());

export const launchBrowser = async (
  headless: boolean = true
): Promise<Browser> => {
  const browser = await puppeteerExtra.launch({
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

  return browser;
};

export const createPage = async (browser: Browser): Promise<Page> => {
  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  return page;
};

export const closeBrowser = async (browser: Browser) => {
  if (browser) await browser.close();
};
