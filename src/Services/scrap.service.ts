/**
 * Title: scrap.service.ts
 * Description: Service to handle scraping logic.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import { createPage, launchBrowser } from "../helpers/puppeteer-utils.js";
import { wait } from "../helpers/utils.js";
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
  const classicvaluerResults = await scrapClassicValuer(
    browser,
    page,
    make,
    model
  );

  console.log(classicvaluerResults.length);

  // Scrap car data from classic.com

  // Close the browser after scraping
  // await closeBrowser(browser);
  return {
    statusCode: 200,
    message: `Scraping job started for ${make} ${model} with keepDuplicates=${keepDuplicates} and debugMode=${debugMode}`,
  };
};
