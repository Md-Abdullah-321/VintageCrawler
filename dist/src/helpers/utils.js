/**
 * Title: Utility Functions
 * Description: General utility functions for various tasks.
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
import fs from "fs/promises";
/**
 * Take a screenshot of the page
 */
export const takeScreenshot = (page, path) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Ensure the path has a valid extension
        const filePath = path.match(/\.(png|jpeg|webp)$/i)
            ? path
            : `${path}.png`;
        yield page.screenshot({ path: filePath, fullPage: true });
    }
    catch (error) {
        console.error("Failed to take screenshot:", error);
    }
});
/**
 * Save the HTML content of the page
 */
export const saveHTML = (page, path) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const html = yield page.content();
        yield fs.writeFile(path, html, "utf-8");
    }
    catch (error) {
        console.error(`Failed to save HTML: ${error}`);
    }
});
/**
 * Wait for a given number of milliseconds
 */
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/**
 * Retry a function a number of times
 */
export const retryOperation = (fn_1, ...args_1) => __awaiter(void 0, [fn_1, ...args_1], void 0, function* (fn, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return yield fn();
        }
        catch (err) {
            if (i === retries - 1)
                throw err;
            yield wait(delay);
        }
    }
    throw new Error("Retry operation failed");
});
export const getDateStr = () => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, "0")}_${String(d.getDate()).padStart(2, "0")}_${String(d.getFullYear()).slice(-2)}`;
};
