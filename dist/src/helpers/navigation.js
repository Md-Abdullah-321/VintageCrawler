/**
 * Title: Navigation
 * Description: Manages navigation and page interactions using Puppeteer.
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
 * Navigate to a URL with optional timeout and retry logic
 */
export const gotoPage = (page_1, url_1, ...args_1) => __awaiter(void 0, [page_1, url_1, ...args_1], void 0, function* (page, url, timeout = 30000) {
    try {
        yield page.goto(url, { waitUntil: "networkidle2", timeout });
    }
    catch (error) {
        console.error(`Failed to navigate to ${url}:`, error);
        throw error;
    }
});
/**
 * Wait for a selector to appear on the page
 */
export const waitForSelector = (page_1, selector_1, ...args_1) => __awaiter(void 0, [page_1, selector_1, ...args_1], void 0, function* (page, selector, timeout = 10000) {
    try {
        yield page.waitForSelector(selector, { timeout });
    }
    catch (error) {
        console.error(`Selector not found: ${selector}`, error);
        throw error;
    }
});
/**
 * Scroll to the bottom of the page gradually
 * Useful for infinite scroll pages
 */
export const scrollToBottom = (page_1, ...args_1) => __awaiter(void 0, [page_1, ...args_1], void 0, function* (page, step = 100, delay = 100) {
    yield page.evaluate((step, delay) => __awaiter(void 0, void 0, void 0, function* () {
        yield new Promise((resolve) => {
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
    }), step, delay);
});
export const clickElement = (page_1, selector_1, ...args_1) => __awaiter(void 0, [page_1, selector_1, ...args_1], void 0, function* (page, selector, timeout = 5000) {
    try {
        yield page.waitForSelector(selector, { timeout });
        yield page.click(selector);
        console.log(`✅ Clicked element: ${selector}`);
    }
    catch (error) {
        console.error(`❌ Failed to click element: ${selector}`, error);
    }
});
export const typeLikeHuman = (page_1, selector_1, text_1, ...args_1) => __awaiter(void 0, [page_1, selector_1, text_1, ...args_1], void 0, function* (page, selector, text, delay = 100) {
    try {
        yield page.waitForSelector(selector, { timeout: 5000 });
        const inputElement = yield page.$(selector);
        if (!inputElement)
            throw new Error(`Input field not found: ${selector}`);
        // Clear the field before typing
        yield page.click(selector, { clickCount: 3 });
        yield page.keyboard.press("Backspace");
        // Type the text with a delay to simulate human typing
        yield page.type(selector, text, { delay });
        console.log(`✅ Typed "${text}" into ${selector}`);
    }
    catch (error) {
        console.error(`❌ Failed to type into ${selector}`, error);
    }
});
