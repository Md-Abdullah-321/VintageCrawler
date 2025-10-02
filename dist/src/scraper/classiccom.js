/**
 * Title: ClassicCom
 * Description: Scraper for Classic.com website with normalized output (reference schema).
 * Author: Md Abdullah
 * Date: 29/08/2025
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
import { clickElement, gotoPage, typeLikeHuman, } from "../helpers/navigation.js";
import dotenv from "dotenv";
import { wait } from "../helpers/utils.js";
dotenv.config();
/* ------------------------ Helpers (Node context) ------------------------ */
const parsePriceNumber = (priceString) => {
    if (!priceString)
        return null;
    const n = Number((priceString || "").replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(n) ? n : null;
};
const normalizeStatus = (desc) => {
    if (!desc)
        return "";
    const lower = desc.toLowerCase();
    if (lower.includes("not sold"))
        return "Not Sold";
    if (lower.includes("sold"))
        return "Sold";
    if (lower.includes("for sale"))
        return "For Sale";
    if (lower.includes("last asking"))
        return "Last Asking";
    if (lower.includes("price undisclosed"))
        return "Price Undisclosed";
    return "";
};
/** Derive price fields based on symbol in the text */
/** Derive price fields based on symbol in the text */
const derivePriceFields = (priceText) => {
    var _a, _b;
    let pt = priceText || "";
    // If text contains "(...)" and that part has a USD value, keep only that
    const matchUsdInBrackets = pt.match(/\(([^)]*\$[0-9,.\s]+)\)/);
    if (matchUsdInBrackets) {
        pt = matchUsdInBrackets[1].trim(); // keep USD inside brackets
    }
    // Otherwise keep as is
    const hasUSD = pt.includes("$");
    const num = parsePriceNumber(pt);
    return {
        price_usd_number: hasUSD ? (_a = num === null || num === void 0 ? void 0 : num.toString()) === null || _a === void 0 ? void 0 : _a.trim() : null,
        price_usd_string: hasUSD ? (_b = pt === null || pt === void 0 ? void 0 : pt.toString()) === null || _b === void 0 ? void 0 : _b.trim() : "",
        price_gbp_number: null, // we ignore GBP
        price_gbp_string: "",
        price_eur_number: null, // we ignore EUR
        price_eur_string: "",
    };
};
const transformClassicItem = (raw) => {
    var _a;
    const { price_usd_number, price_usd_string, price_gbp_number, price_gbp_string, price_eur_number, price_eur_string, } = derivePriceFields(raw.price_text);
    // Auction description in reference looks like "House • Year/Date"
    const auctionDesc = [raw.auction_house, raw.auction_date_long]
        .filter(Boolean)
        .join(" • ");
    // Event-ish name (fallback: first part of location)
    const auctionName = (raw.auction_location ? raw.auction_location.split(",")[0] : "") || "";
    return {
        // --- Reference schema fields ---
        auction_date_long: raw.auction_date_long.toString().trim() || "",
        auction_desc: auctionDesc.toString().trim() || "",
        auction_house: raw.auction_house.toString().trim() || "",
        auction_location: raw.auction_location.toString().trim() || "",
        auction_name: auctionName.toString().trim() || "",
        lot_description: raw.title.toString().trim() || "",
        chassis_number: "", // not scraped here
        reg_number: "", // not scraped here
        image: raw.image || "",
        link: raw.link || "",
        link_v2: raw.link_v2 || "",
        url: ((_a = raw.link) === null || _a === void 0 ? void 0 : _a.startsWith("http"))
            ? raw.link
            : `https://www.classic.com${raw.link || ""}`,
        price_usd_number: (price_usd_number === null || price_usd_number === void 0 ? void 0 : price_usd_number.toString().trim()) || null,
        price_usd_string: (price_usd_string === null || price_usd_string === void 0 ? void 0 : price_usd_string.toString().trim()) || "",
        price_gbp_number,
        price_gbp_string,
        price_eur_number,
        price_eur_string,
        status: normalizeStatus(raw.status_text),
        year: raw.year || "",
        sourceUrl: raw.sourceUrl || "",
    };
};
/* ---------------------------- Main Scraper ----------------------------- */
export const scrapClassicCom = (browser, page, make, model, transmission) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Navigate to Classic.com
        yield gotoPage(page, process.env.CLASSIC_COM_BASE_URL, 60000);
        console.log("📄 Page loaded:", yield page.title());
        yield wait(1500);
        // --- click on search bar ---
        yield clickElement(page, '[name="search"]');
        yield wait(1000);
        // --- Type make and model ---
        yield typeLikeHuman(page, '[name="search"]', `${make} ${model} ${transmission}`.trim());
        // --- Enter key to search ---
        yield page.keyboard.press("Enter");
        yield wait(5000);
        // --- capture number of total results ---
        const totalResultsText = yield page.$eval("#search_live > div > div:nth-of-type(4) .font-medium:nth-of-type(2)", (el) => { var _a; return ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.trim()) || ""; });
        if (!totalResultsText) {
            console.log("❌ No results found on Classic.com");
            return [];
        }
        const maxPages = Math.ceil(parseInt(totalResultsText, 10) / 24);
        let currentPage = 1;
        let results = [];
        while (currentPage <= maxPages) {
            yield page.$eval("#search_live > div > div:nth-child(6)", (el) => el.scrollIntoView({ behavior: "smooth", block: "start" }));
            yield wait(1000);
            // Get normalized items for this page (extraction in browser, transform in Node)
            const pageItems = yield extractAndTransformCarsFromPage(page);
            results = results.concat(pageItems);
            console.log(`✅ Page ${currentPage}/${maxPages} scraped, found ${pageItems.length} cars.`);
            const nextClicked = yield clickNextButton(page);
            if (!nextClicked)
                break;
            yield wait(3000);
            currentPage++;
        }
        return results;
    }
    catch (error) {
        console.error("❌ Error scraping Classic.com: ", error);
        return [];
    }
});
/* -------- Extract RAW in browser context, then transform in Node -------- */
const extractAndTransformCarsFromPage = (page) => __awaiter(void 0, void 0, void 0, function* () {
    const rawItems = yield page.$$eval("#search_live > div > div:nth-child(6) .group", (groups) => Array.from(groups).map((el) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const fullTitle = ((_b = (_a = el.querySelector("h3 a")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) || "";
        // Extract year (keep for output)
        const yearMatch = fullTitle.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? yearMatch[0] : "";
        const link = ((_c = el.querySelector("h3 a")) === null || _c === void 0 ? void 0 : _c.getAttribute("href")) || "";
        const link_v2 = link;
        const image = ((_d = el.querySelector("a img")) === null || _d === void 0 ? void 0 : _d.getAttribute("src")) || "";
        const auction_location = ((_f = (_e = el
            .querySelector(".flex.gap-2.items-center.text-white div, .table\\:block .flex.gap-2.items-center.text-gray-500 div")) === null || _e === void 0 ? void 0 : _e.textContent) === null || _f === void 0 ? void 0 : _f.trim()) || "";
        const auction_house = ((_h = (_g = el.querySelector("a.hover\\:underline")) === null || _g === void 0 ? void 0 : _g.textContent) === null || _h === void 0 ? void 0 : _h.trim()) || "";
        const statusEl = el.querySelector(".border.font-medium.uppercase");
        const status_text = statusEl ? statusEl.textContent.trim() : "";
        const price_text = ((_k = (_j = el
            .querySelector(`#vehicle-listing-${el.id}-price, #vehicle-listing-${el.id}-table-price`)) === null || _j === void 0 ? void 0 : _j.textContent) === null || _k === void 0 ? void 0 : _k.trim()) || "";
        const dateCandidates = Array.from(el.querySelectorAll(".text-gray-500")).map((n) => { var _a; return ((_a = n === null || n === void 0 ? void 0 : n.innerText) === null || _a === void 0 ? void 0 : _a.trim()) || ""; });
        const auction_date_long = dateCandidates[3] || dateCandidates[2] || dateCandidates[1] || "";
        const sourceUrl = window.location.href;
        // ✅ Transmission extraction (defensive)
        let transmission = "";
        try {
            transmission =
                ((_q = (_p = (_o = (_m = (_l = el
                    .querySelector("h3")) === null || _l === void 0 ? void 0 : _l.nextElementSibling) === null || _m === void 0 ? void 0 : _m.nextElementSibling) === null || _o === void 0 ? void 0 : _o.querySelectorAll(".items-center")[1]) === null || _p === void 0 ? void 0 : _p.innerText) === null || _q === void 0 ? void 0 : _q.trim()) || "";
        }
        catch (e) {
            transmission = "";
        }
        const raw = {
            auction_date_long,
            auction_house,
            auction_location,
            title: fullTitle.toLowerCase().includes(transmission.toLowerCase())
                ? fullTitle
                : `${fullTitle} ${transmission}`.trim(),
            link,
            link_v2,
            image,
            status_text,
            price_text,
            year,
            sourceUrl,
        };
        return raw;
    }));
    // Transform to reference format in Node context (helpers available here)
    return rawItems.map(transformClassicItem);
});
const clickNextButton = (page) => __awaiter(void 0, void 0, void 0, function* () {
    const clicked = yield page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("#search_live > div > div:nth-child(7) a"));
        for (const anchor of anchors) {
            if (anchor.innerText.trim() === "chevron_right") {
                anchor.scrollIntoView({ behavior: "smooth", block: "center" });
                anchor.click();
                return true;
            }
        }
        return false;
    });
    if (clicked) {
        yield wait(1500); // wait for page navigation to start
    }
    return clicked;
});
