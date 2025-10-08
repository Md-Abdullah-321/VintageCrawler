/**
 * Title: scrapeClassicCom.ts
 * Description: Scrapes car data from Classic.com using existing Puppeteer page.
 * Author: Md Abdullah
 */

import { Page } from "puppeteer";
import { gotoPage } from "../helpers/navigation.js";
import { updateJob } from "../Services/scrap.service.js";

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface CarData {
  title: string | null;
  mileage: string | null;
  location: string | null;
  originality: string | null;
  transmission: string | null;
  gearbox: string | null;
  status: string | null;
  date: string | null;
  auction: string | null;
  price: string | null;
  link: string | null;
  [key: string]: string | null; // for additional specs
}

/**
 * Scrapes Classic.com for a given URL using an existing Puppeteer page.
 * @param targetUrl - The Classic.com URL to scrape.
 * @param page - Puppeteer Page instance (already opened).
 * @param jobId - Job ID for logging progress.
 * @returns Array of car data
 */
export const scrapeClassicComWithURL = async (
  targetUrl: string,
  page: Page,
  jobId: string
): Promise<CarData[]> => {
  if (!targetUrl || !targetUrl.includes("classic.com")) {
    updateJob(jobId, {}, "Invalid URL. Must be a valid Classic.com URL.");
    throw new Error("❌ Invalid URL. Must be a valid Classic.com URL.");
  }

  console.log(`🚀 Starting scrape for: ${targetUrl}`);
  updateJob(jobId, {}, `Starting scrape for: ${targetUrl}`);
  const results: CarData[] = [];

  try {
    // Navigate to the target URL
    console.log("Navigating to", targetUrl);
    await gotoPage(page, targetUrl, 60000).catch(err => {
      console.error("❌ Navigation failed:", err);
      updateJob(jobId, {}, `Failed to navigate to ${targetUrl}: ${err.message}`);
      throw new Error(`Failed to navigate to ${targetUrl}: ${err.message}`);
    });
    console.log("✅ Page loaded successfully");
    updateJob(jobId, {}, "Page loaded successfully");

    // Wait for the search form to ensure page is fully loaded
    await page.waitForSelector("#search-form", { timeout: 30000 }).catch(err => {
      console.error("❌ Failed to find search form:", err);
      updateJob(jobId, {}, "Search form not found: " + err.message);
      throw new Error("Search form not found: " + err.message);
    });

    const count: number = await page.evaluate(() => {
      const form = document.getElementById("search-form");
      const coachmark = form?.querySelector("#search-location-coachmark");
      const p = coachmark?.previousElementSibling;
      return p ? parseInt(p.querySelectorAll("span")[1]?.textContent || "0") : 0;
    }).catch(err => {
      console.error("❌ Failed to evaluate page count:", err);
      updateJob(jobId, {}, "Failed to evaluate page count: " + err.message);
      throw new Error("Failed to evaluate page count: " + err.message);
    });

    const totalPages = Math.ceil(count / 24) || 1;
    console.log(`📄 Total pages detected: ${totalPages}`);
    updateJob(jobId, { progress: 20 }, `Total pages detected: ${totalPages}`);

    const clickNextButton = async (): Promise<boolean> => {
      const clicked = await page.evaluate(() => {
        const anchors = Array.from(
          document.querySelectorAll("#search-form > div > div:nth-child(4) a")
        );
        for (const anchor of anchors) {
          if (anchor.textContent?.trim() === "chevron_right") {
            anchor.scrollIntoView({ behavior: "smooth", block: "center" });
            (anchor as HTMLAnchorElement).click();
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
        await wait(5000);
        await page.waitForSelector(".group", { timeout: 60000 }).catch(err => {
          console.error("❌ Failed to load next page:", err);
          updateJob(jobId, {}, "Next page failed to load: " + err.message);
          throw new Error("Next page failed to load: " + err.message);
        });
      }

      return clicked;
    };

    for (let i = 1; i <= totalPages; i++) {
      console.log(`🔹 Scraping page ${i}/${totalPages}...`);
      updateJob(jobId, { progress: 20 + (i / totalPages) * 50 }, `Scraping page ${i}/${totalPages}...`);

      await page.waitForSelector(".group", { timeout: 30000 }).catch(err => {
        console.error(`❌ Failed to find .group on page ${i}:`, err);
        updateJob(jobId, {}, `Failed to find .group on page ${i}: ${err.message}`);
        throw new Error(`Failed to find .group on page ${i}: ${err.message}`);
      });

      const carsData: CarData[] = await page.evaluate(() => {
        const allGroups = Array.from(document.querySelectorAll(".group"));
        const selectedGroups = allGroups.slice(5);
        return selectedGroups.map((group) => {
          const getText = (sel: string) => group.querySelector(sel)?.textContent?.trim() || null;
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
            link: group.querySelector('a[href*="/veh/"]')?.getAttribute("href") || null,
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
        const hasNext = await clickNextButton();
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
        await page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 30000 }).catch(err => {
          console.error(`❌ Failed to navigate to ${detailUrl}:`, err);
          updateJob(jobId, {}, `Failed to navigate to ${detailUrl}: ${err.message}`);
          throw new Error(`Failed to navigate to ${detailUrl}: ${err.message}`);
        });

        const specsTab = await page.$('[data-tab="specs"]').catch(err => {
          console.error(`❌ Failed to find specs tab for ${car.title}:`, err);
          updateJob(jobId, {}, `Failed to find specs tab for ${car.title}: ${err.message}`);
          throw new Error(`Failed to find specs tab: ${err.message}`);
        });
        if (!specsTab) {
          console.warn(`⚠️ No specs tab for ${car.title}`);
          updateJob(jobId, {}, `No specs tab for ${car.title}`);
          continue;
        }
        await specsTab.click();
        await wait(1000);

        const specs = await page.evaluate(() => {
          const rows = document.querySelectorAll(
            '.tab-content [data-tab="specs"] .flex.flex-row'
          );
          const data: Record<string, string> = {};
          rows.forEach((row) => {
            const label = row.querySelector("div.text-gray-500")?.textContent?.trim();
            const value = row.querySelector("div.font-medium")?.textContent?.trim();
            if (label && value) data[label] = value;
          });
          return data;
        }).catch(err => {
          console.error(`❌ Failed to evaluate specs for ${car.title}:`, err);
          updateJob(jobId, {}, `Failed to evaluate specs for ${car.title}: ${err.message}`);
          throw new Error(`Failed to evaluate specs: ${err.message}`);
        });

        results[i] = { ...car, ...specs };
      } catch (err: any) {
        console.warn(`⚠️ Failed to scrape specs for ${car.title}: ${err.message}`);
        updateJob(jobId, {}, `Failed to scrape specs for ${car.title}: ${err.message}`);
      }
    }

    console.log(`📊 Scraped ${results.length} car listings.`);
    updateJob(jobId, { progress: 90 }, `Scraped ${results.length} car listings.`);
    return results;
  } catch (error: any) {
    console.error("❌ Scraping failed:", error);
    updateJob(jobId, { status: "failed", progress: 0 }, `Scraping failed: ${error.message}`);
    throw error;
  }
};