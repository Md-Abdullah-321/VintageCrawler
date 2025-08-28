/**
 * Title: Extract Data
 * Description: Functions to extract and process data from web pages.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import type { Page } from "puppeteer";

/**
 * Extract text content from a single element
 */
export const extractText = async (
  page: Page,
  selector: string
): Promise<string | null> => {
  const text = await page
    .$eval(selector, (el) => el.textContent?.trim() || null)
    .catch(() => null);
  return text;
};

/**
 * Extract a specific attribute from a single element
 */
export const extractAttribute = async (
  page: Page,
  selector: string,
  attribute: string
): Promise<string | null> => {
  const attr = await page
    .$eval(selector, (el, attr) => el.getAttribute(attr), attribute)
    .catch(() => null);
  return attr;
};

/**
 * Extract text content from multiple elements
 */
export const extractMultipleElements = async (
  page: Page,
  selector: string
): Promise<string[]> => {
  const items = await page.$$eval(selector, (els) =>
    els.map((el) => el.textContent?.trim() || "")
  );
  return items;
};
