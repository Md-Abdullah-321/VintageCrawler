/**
 * Title: Navigation
 * Description: Manages navigation and page interactions using Puppeteer.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import type { Page } from "puppeteer";

/**
 * Navigate to a URL with optional timeout and retry logic
 */
export const gotoPage = async (
  page: Page,
  url: string,
  timeout: number = 60000
) => {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout });
  } catch (error) {
    console.error(`Failed to navigate to ${url}:`, error);
    throw error;
  }
};

/**
 * Wait for a selector to appear on the page
 */
export const waitForSelector = async (
  page: Page,
  selector: string,
  timeout: number = 10000
) => {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch (error) {
    console.error(`Selector not found: ${selector}`, error);
    throw error;
  }
};

/**
 * Scroll to the bottom of the page gradually
 * Useful for infinite scroll pages
 */
export const scrollToBottom = async (
  page: Page,
  step: number = 100,
  delay: number = 100
) => {
  await page.evaluate(
    async (step, delay) => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = step;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, delay);
      });
    },
    step,
    delay
  );
};

export const clickElement = async (
  page: Page,
  selector: string,
  timeout = 10000
): Promise<void> => {
  try {
    await page.waitForSelector(selector, { timeout });
    await page.click(selector);
    console.log(`✅ Clicked element: ${selector}`);
  } catch (error) {
    console.error(`❌ Failed to click element: ${selector}`, error);
  }
};

export const typeLikeHuman = async (
  page: Page,
  selector: string,
  text: string,
  delay = 100
): Promise<void> => {
  try {
    await page.waitForSelector(selector, { timeout: 10000 });

    const inputElement = await page.$(selector);
    if (!inputElement) throw new Error(`Input field not found: ${selector}`);

    // Clear the field before typing
    await page.click(selector, { clickCount: 3 });
    await page.keyboard.press("Backspace");

    // Type the text with a delay to simulate human typing
    await page.type(selector, text, { delay });

    console.log(`✅ Typed "${text}" into ${selector}`);
  } catch (error) {
    console.error(`❌ Failed to type into ${selector}`, error);
  }
};
