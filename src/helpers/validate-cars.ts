/**
 * Title: validate-cars
 * Description: Validate car data using JS, supporting case-insensitive and camelCase titles.
 * Author: Md Abdullah
 * Date: 09/09/2025
 */

const validateCars = async (
  results: any[],
  make: string,
  model: string,
  transmission: string
): Promise<any[]> => {
  const validatedResults: any[] = [];

  for (const item of results) {
    if (!item?.lot_description) continue;

    const title = item.lot_description.toLowerCase();
    const makeLower = make.toLowerCase();
    const modelLower = model.toLowerCase();

    const res = await fetch(`${process.env.N8N_WEBHOOK_URL}/validate-car`, {
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

    const data = await res.json();


    if (data?.match) {
      validatedResults.push(item);
    }
  }

  return validatedResults;
};

export default validateCars;
