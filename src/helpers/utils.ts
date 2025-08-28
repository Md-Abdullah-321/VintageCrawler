/**
 * Title: Utility Functions
 * Description: General utility functions for various tasks.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import fs from "fs/promises";
import type { Page } from "puppeteer";

/**
 * Take a screenshot of the page
 */

export const takeScreenshot = async (page: Page, path: string) => {
  try {
    // Ensure the path has a valid extension
    const filePath: `${string}.png` | `${string}.jpeg` | `${string}.webp` =
      path.match(/\.(png|jpeg|webp)$/i)
        ? (path as `${string}.png` | `${string}.jpeg` | `${string}.webp`)
        : (`${path}.png` as `${string}.png`);

    await page.screenshot({ path: filePath, fullPage: true });
  } catch (error) {
    console.error("Failed to take screenshot:", error);
  }
};

/**
 * Save the HTML content of the page
 */
export const saveHTML = async (page: Page, path: string) => {
  try {
    const html = await page.content();
    await fs.writeFile(path, html, "utf-8");
  } catch (error) {
    console.error(`Failed to save HTML: ${error}`);
  }
};

/**
 * Wait for a given number of milliseconds
 */
export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry a function a number of times
 */
export const retryOperation = async <T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      await wait(delay);
    }
  }
  throw new Error("Retry operation failed");
};
