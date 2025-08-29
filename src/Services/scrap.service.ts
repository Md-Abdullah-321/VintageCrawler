/**
 * Title: scrap.service.ts
 * Description: Service to handle scraping logic.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import { v4 as uuid } from "uuid";
import { saveToCSV } from "../helpers/output.js";
import {
  closeBrowser,
  createPage,
  launchBrowser,
} from "../helpers/puppeteer-utils.js";
import { wait } from "../helpers/utils.js";
import { scrapClassicCom } from "../scraper/classiccom.js";
import { scrapClassicValuer } from "../scraper/classicvaluer.js";

// Dependencies

// Scrap Services
export const startScraping = async (
  make: string,
  model: string,
  keepDuplicates: boolean,
  debugMode: boolean
) => {
  // Implement the scraping logic here
  const browser = await launchBrowser(!debugMode);

  // Perform scraping tasks...
  const page = await createPage(browser);
  await wait(2000);

  // Scrap car data from theclassicvaluer.com
  const id = uuid();
  const classicvaluerResults = await scrapClassicValuer(
    browser,
    page,
    make,
    model
  );

  const classicComResults = await scrapClassicCom(browser, page, make, model);

  // concatenate results
  const allResults = [...classicvaluerResults, ...classicComResults];

  // Save results as CSV
  const filePath = `./output/${id}.csv`;
  await saveToCSV(allResults, filePath);

  // Close the page
  await page.close();

  // Close the browser after scraping
  await closeBrowser(browser);
  return {
    statusCode: 200,
    message: `Scraping job started for ${make} ${model} with keepDuplicates=${keepDuplicates} and debugMode=${debugMode}`,
    payload: {
      jobId: id,
      source: "theclassicvaluer.com",
      results: classicComResults,
    },
  };
};
