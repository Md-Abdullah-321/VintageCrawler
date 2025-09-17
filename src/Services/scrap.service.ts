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
import validateCars from "../helpers/validate-cars.js";
import { scrapClassicCom } from "../scraper/classiccom.js";
import { scrapClassicValuer } from "../scraper/classicvaluer.js";

// Dependencies

// Scrap Services
export const startScraping = async (
  make: string,
  model: string,
  transmission: string,
  site: string,
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
  let allResults: any[] = [];
  console.log(
    `🚀 Starting scraping job for ${make} ${model} with keepDuplicates=${keepDuplicates} and debugMode=${debugMode}`
  );

  if (site === "theclassicvaluer.com" || site === "both") {
    const classicvaluerResults = await scrapClassicValuer(
      browser,
      page,
      make,
      model,
      transmission
    );

    allResults = allResults.concat(classicvaluerResults);
  }

  // Scrap car data from classic.com
  if (site === "classic.com" || site === "both") {
    const classicComResults = await scrapClassicCom(
      browser,
      page,
      make,
      model,
      transmission
    );

    // Validate results to remove non-matching cars
    console.log("🔍 Validating classicCom results...");
    const validatedClassicComResults = await validateCars(
      classicComResults,
      make,
      model,
      transmission
    );

    allResults = allResults.concat(validatedClassicComResults);
  }

  console.log("✅ Validation complete. Valid entries:", allResults.length);

  //TODO: If keepDuplicates is false, remove duplicates based on lot_description

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
      // results: classicComResults,
    },
  };
};
