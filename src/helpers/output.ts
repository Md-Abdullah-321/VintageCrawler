/**
 * Title: Output Helpers
 * Description: Functions to save and manage output data.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import { stringify } from "csv-stringify/sync";
import fs from "fs/promises";
import path from "path";

/**
 * Save data to CSV
 */
export const saveToCSV = async (data: any[], filePath: string) => {
  try {
    if (!data || !data.length) {
      console.warn("No data to save.");
      return;
    }

    const dir = path.dirname(filePath);

    // Check if folder exists first
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Created folder: ${dir}`);
    }

    // Convert data to CSV string with headers
    const csv = stringify(data, { header: true });

    // Write file
    await fs.writeFile(filePath, csv, "utf-8");
    console.log(`✅ CSV saved: ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to save CSV: ${error}`);
  }
};

/**
 * Save data to JSON
 */
export const saveToJSON = async (data: any, filePath: string) => {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Failed to save JSON: ${error}`);
  }
};

/**
 * Append data to CSV
 */
export const appendToCSV = async (data: any[], filePath: string) => {
  try {
    const csv = stringify(data, { header: false });
    await fs.appendFile(filePath, csv, "utf-8");
  } catch (error) {
    console.error(`Failed to append CSV: ${error}`);
  }
};
