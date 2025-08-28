/**
 * Title: Humanize Helpers
 * Description: Functions to make Puppeteer interactions more human-like.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import type { Page } from "puppeteer";

/**
 * Random mouse movements
 */
export const randomMouseMovements = async (page: Page, steps: number = 10) => {
  const { width, height } = page.viewport()!;
  for (let i = 0; i < steps; i++) {
    await page.mouse.move(Math.random() * width, Math.random() * height, {
      steps: Math.floor(Math.random() * 10) + 5,
    });
    await new Promise((r) => setTimeout(r, Math.random() * 200 + 50));
  }
};

/**
 * Random scroll
 */
export const randomScroll = async (page: Page) => {
  await page.evaluate(() => {
    window.scrollBy(0, Math.random() * 300 + 100);
  });
  await new Promise((r) => setTimeout(r, Math.random() * 300 + 100));
};

/**
 * Slightly randomize viewport to reduce detection
 */
export const setRandomViewport = async (page: Page) => {
  const width = 1200 + Math.floor(Math.random() * 400); // 1200–1600
  const height = 700 + Math.floor(Math.random() * 400); // 700–1100
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
};
