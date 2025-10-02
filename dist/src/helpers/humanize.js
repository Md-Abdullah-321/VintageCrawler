/**
 * Title: Humanize Helpers
 * Description: Functions to make Puppeteer interactions more human-like.
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
 * Random mouse movements
 */
export const randomMouseMovements = (page_1, ...args_1) => __awaiter(void 0, [page_1, ...args_1], void 0, function* (page, steps = 10) {
    const { width, height } = page.viewport();
    for (let i = 0; i < steps; i++) {
        yield page.mouse.move(Math.random() * width, Math.random() * height, {
            steps: Math.floor(Math.random() * 10) + 5,
        });
        yield new Promise((r) => setTimeout(r, Math.random() * 200 + 50));
    }
});
/**
 * Random scroll
 */
export const randomScroll = (page) => __awaiter(void 0, void 0, void 0, function* () {
    yield page.evaluate(() => {
        window.scrollBy(0, Math.random() * 300 + 100);
    });
    yield new Promise((r) => setTimeout(r, Math.random() * 300 + 100));
});
/**
 * Slightly randomize viewport to reduce detection
 */
export const setRandomViewport = (page) => __awaiter(void 0, void 0, void 0, function* () {
    const width = 1200 + Math.floor(Math.random() * 400); // 1200–1600
    const height = 700 + Math.floor(Math.random() * 400); // 700–1100
    yield page.setViewport({ width, height, deviceScaleFactor: 1 });
});
