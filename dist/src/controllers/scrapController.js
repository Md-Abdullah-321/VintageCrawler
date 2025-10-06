/**
 * Title: ScrapController.ts
 * Description: Manage scrap controller.
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
import { startScraping } from "../Services/scrap.service.js";
import { successResponse } from "./responseController.js";
// Start Scraping Job
export const startScrapingJob = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { method, make = "", model = "", transmission = "", site = "", keep_duplicates = false, debug_mode = false, url = "", } = req.body;
        // Validate required fields
        if ((method === "url" && !url) || (method === "make_model" && (!make || !model))) {
            res.status(400).json({
                status: "error",
                message: "Missing required fields",
            });
            return;
        }
        // Start a scraping job
        const response = yield startScraping(method, url, make, model, transmission, site, Boolean(keep_duplicates), Boolean(debug_mode));
        if (response) {
            successResponse(res, response);
        }
    }
    catch (error) {
        next(error);
    }
});
