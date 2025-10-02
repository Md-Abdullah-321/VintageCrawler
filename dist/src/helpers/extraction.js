/**
 * Title: Extract Data
 * Description: Functions to extract and process data from web pages.
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
 * Extract text content from a single element
 */
export const extractText = (page, selector) => __awaiter(void 0, void 0, void 0, function* () {
    const text = yield page
        .$eval(selector, (el) => { var _a; return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || null; })
        .catch(() => null);
    return text;
});
/**
 * Extract a specific attribute from a single element
 */
export const extractAttribute = (page, selector, attribute) => __awaiter(void 0, void 0, void 0, function* () {
    const attr = yield page
        .$eval(selector, (el, attr) => el.getAttribute(attr), attribute)
        .catch(() => null);
    return attr;
});
/**
 * Extract text content from multiple elements
 */
export const extractMultipleElements = (page, selector) => __awaiter(void 0, void 0, void 0, function* () {
    const items = yield page.$$eval(selector, (els) => els.map((el) => { var _a; return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || ""; }));
    return items;
});
