/**
 * Title: Output Helpers
 * Description: Functions to save and manage output data.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */

import { stringify } from "csv-stringify/sync";
import fs from "fs/promises";

/**
 * Save data to CSV
 */
export const saveToCSV = async (data: any[], filePath: string) => {
  try {
    const csv = stringify(data, { header: true });
    await fs.writeFile(filePath, csv, "utf-8");
  } catch (error) {
    console.error(`Failed to save CSV: ${error}`);
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
