/**
 * Title: validate-cars
 * Description: Validate car data using JS, supporting case-insensitive and camelCase titles.
 * Author: Md Abdullah
 * Date: 09/09/2025
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
const validateCars = (results, make, model, transmission) => __awaiter(void 0, void 0, void 0, function* () {
    const validatedResults = [];
    for (const item of results) {
        if (!(item === null || item === void 0 ? void 0 : item.lot_description))
            continue;
        const title = item.lot_description.toLowerCase();
        const makeLower = make.toLowerCase();
        const modelLower = model.toLowerCase();
        const res = yield fetch(`${process.env.N8N_WEBHOOK_URL}/validate-car`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title,
                make: makeLower,
                model: modelLower,
            }),
        });
        const data = yield res.json();
        if (data === null || data === void 0 ? void 0 : data.match) {
            validatedResults.push(item);
        }
    }
    return validatedResults;
});
export default validateCars;
