/**
 * Title: Output Helpers
 * Description: Functions to save and manage output data.
 * Author: Md Abdullah
 * Date: 28/08/2025
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { stringify } from "csv-stringify/sync";
import fs from "fs/promises";
import path from "path";
/**
 * Save data to CSV
 */
export const saveToCSV = (data, filePath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!data || !data.length) {
            console.warn("No data to save.");
            return;
        }
        const dir = path.dirname(filePath);
        // Check if folder exists first
        try {
            yield fs.access(dir);
        }
        catch (_a) {
            yield fs.mkdir(dir, { recursive: true });
            console.log(`📁 Created folder: ${dir}`);
        }
        // Convert data to CSV string with headers
        const csv = stringify(data, { header: true });
        // Write CSV file
        yield fs.writeFile(filePath, csv, "utf-8");
        console.log(`✅ CSV saved: ${filePath}`);
    }
    catch (error) {
        console.error(`❌ Failed to save CSV: ${error}`);
    }
});
/**
 * Save data to JSON (unchanged, but not used in this case)
 */
export const saveToJSON = (data, filePath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    }
    catch (error) {
        console.error(`Failed to save JSON: ${error}`);
    }
});
/**
 * Append data to CSV (unchanged)
 */
export const appendToCSV = (data, filePath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const csv = stringify(data, { header: false });
        yield fs.appendFile(filePath, csv, "utf-8");
    }
    catch (error) {
        console.error(`Failed to append CSV: ${error}`);
    }
});
