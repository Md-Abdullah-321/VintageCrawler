/**
 * Title: Interaction Helpers
 * Description: Utility functions for interacting with web pages using Puppeteer.
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
/**
 * Click an element
 */
export const clickElement = (page, selector) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield page.waitForSelector(selector, { visible: true });
        yield page.click(selector);
    }
    catch (error) {
        console.error(`Failed to click ${selector}:`, error);
        throw error;
    }
});
/**
 * Type text into an input field
 */
export const typeText = (page_1, selector_1, text_1, ...args_1) => __awaiter(void 0, [page_1, selector_1, text_1, ...args_1], void 0, function* (page, selector, text, delay = 50) {
    try {
        yield page.waitForSelector(selector, { visible: true });
        yield page.focus(selector);
        yield page.keyboard.type(text, { delay });
    }
    catch (error) {
        console.error(`Failed to type into ${selector}:`, error);
        throw error;
    }
});
/**
 * Select a value from a dropdown
 */
export const selectOption = (page, selector, value) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield page.waitForSelector(selector, { visible: true });
        yield page.select(selector, value);
    }
    catch (error) {
        console.error(`Failed to select ${value} from ${selector}:`, error);
        throw error;
    }
});
/**
 * Check or uncheck a checkbox
 */
export const checkCheckbox = (page_1, selector_1, ...args_1) => __awaiter(void 0, [page_1, selector_1, ...args_1], void 0, function* (page, selector, checked = true) {
    try {
        yield page.waitForSelector(selector);
        const isChecked = yield page.$eval(selector, (el) => el.checked);
        if (isChecked !== checked) {
            yield page.click(selector);
        }
    }
    catch (error) {
        console.error(`Failed to toggle checkbox ${selector}:`, error);
        throw error;
    }
});
