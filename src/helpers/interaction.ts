/**
 * Title: Interaction Helpers
 * Description: Utility functions for interacting with web pages using Puppeteer.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import type { Page } from "puppeteer";

/**
 * Click an element
 */
export const clickElement = async (page: Page, selector: string) => {
  try {
    await page.waitForSelector(selector, { visible: true });
    await page.click(selector);
  } catch (error) {
    console.error(`Failed to click ${selector}:`, error);
    throw error;
  }
};

/**
 * Type text into an input field
 */
export const typeText = async (
  page: Page,
  selector: string,
  text: string,
  delay: number = 50
) => {
  try {
    await page.waitForSelector(selector, { visible: true });
    await page.focus(selector);
    await page.keyboard.type(text, { delay });
  } catch (error) {
    console.error(`Failed to type into ${selector}:`, error);
    throw error;
  }
};

/**
 * Select a value from a dropdown
 */
export const selectOption = async (
  page: Page,
  selector: string,
  value: string
) => {
  try {
    await page.waitForSelector(selector, { visible: true });
    await page.select(selector, value);
  } catch (error) {
    console.error(`Failed to select ${value} from ${selector}:`, error);
    throw error;
  }
};

/**
 * Check or uncheck a checkbox
 */
export const checkCheckbox = async (
  page: Page,
  selector: string,
  checked: boolean = true
) => {
  try {
    await page.waitForSelector(selector);
    const isChecked = await page.$eval(
      selector,
      (el) => (el as HTMLInputElement).checked
    );
    if (isChecked !== checked) {
      await page.click(selector);
    }
  } catch (error) {
    console.error(`Failed to toggle checkbox ${selector}:`, error);
    throw error;
  }
};
