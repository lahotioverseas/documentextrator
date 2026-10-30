// Letter of Credit (MT700 / Bank Advice)
import { Type, ThinkingLevel } from '@google/genai';
import { callGeminiWithFallback } from '../gemini/client';
import { cleanAndParseJSON, sanitizeAIOutput } from '../gemini/json';
import { buildImageParts } from '../gemini/parts';

export async function extractLC(body: any) {
  const { imageParts, textContent } = body;
  const parts = buildImageParts(imageParts, textContent, 'Document raw text');

  const prompt = `You are a highly precise export documentation auditor for Lahoti Overseas Ltd.
Extract all data from the attached SWIFT MT700 Letter of Credit / Bank Advice document into JSON format.

CRITICAL INSTRUCTIONS & RULES:
1. Extract data ONLY from the attached document. DO NOT use pre-existing memory, sample values, or assumptions.
2. Extract all descriptions of goods and banking clauses character-for-character VERBATIM (preserving exact capitalization, punctuation, quotes, email addresses, and formatting).
3. Do not summarize, rephrase, or correct grammar or typos.
4. If a field is not explicitly present in the document, return null. Do not guess, fabricate, or infer missing data. NEVER output dummy placeholders like "XXXX", "TBD", "12345", etc.
5. Do not perform mathematical calculations. Extract raw numbers as written.

CRITICAL REQUIREMENT FOR FIELD 46A (Documents Required):
- You MUST split Field 46A into INDIVIDUAL clauses on their original numbering markers ('1.', '2.', '3.', etc.).
- DO NOT merge Field 46A into a single block of text.
- Each clause in raw46AClauses must have:
  * 'clauseNumber': integer
  * 'clauseMarker': string (e.g. '1.', '2.')
  * 'verbatimText': exact string of that clause including all sub-clauses, notify party addresses, quote markers, and email addresses.

CRITICAL REQUIREMENT FOR FIELD 47A (Additional Conditions):
- You MUST split Field 47A into INDIVIDUAL clauses on their original bullet markers ('+', '-', '*', or numbering '1.', '2.').
- DO NOT merge Field 47A into a single block of text.
- Each clause in raw47AClauses must have:
  * 'clauseNumber': integer
  * 'clauseMarker': string
  * 'verbatimText': exact string of that condition character-for-character.

TAG MAPPING:
- Advising Bank Ref: Bank's internal reference number
- Step Reference: Step / Advice reference if present
- :20: Documentary Credit Number
- :31C: Date of Issue — copy EXACTLY as printed (e.g. "260416"); do not reformat. Same for 31D expiry and 44C dates.
- :40A: Form of Documentary Credit
- :40E: Applicable Rules
- :31D: Date and Place of Expiry
- :50: Applicant Name and Address:
  * Extract the COMPLETE verbatim multi-line Applicant Name and Address.
  * In 'applicant.name', put the full company name.
  * In 'applicant.address', put the COMPLETE multi-line address including factory/office, street, area, postal code, city, country, and any tax/VAT/BIN/TIN registration numbers (e.g., VAT REGISTRATION NO. (BIN): 000495263-0403). DO NOT omit or truncate any lines.
  * In 'applicant.country', put the country.
  * In 'applicant.bin', put the BIN number / VAT Registration Number if present.
- IRN Number: Extract IRN NO. / Invoice Reference Number / e-Invoice IRN if present in LC text, bank advice, or clauses into 'irnNumber'.
- :59: Beneficiary Name and Address: Full company name and full multi-line address.
- :32B: Currency Code & Amount
- :39A: Percentage Credit Amount Tolerance (positive and negative tolerance)
- :41D: Available With ... By
- :42C: Drafts at ... -> 'tenor' verbatim (e.g. "90 DAYS FROM L/R DATE.")
- :42A / 42D: Drawee -> 'drawee' verbatim with line breaks (e.g. "BSONBDDHLOD\\nSONALI BANK PLC\\nLOCAL OFFICE\\nDHAKA BD")
- :42P: Negotiation / Deferred Payment Details / Tenor
- :43P: Partial Shipments
- :43T: Transhipment
- :44A: Place of Taking in Charge / Dispatch from / Place of Receipt -> 'placeOfReceipt' (only if the LC has 44A)
- :44E: Port of Loading / Departure
- :44F: Port of Discharge / Destination
- :44B: Place of Final Destination / For Transportation to / Place of Delivery -> 'placeOfFinalDestination' (only if the LC has 44B)
- :44C: Latest Date of Shipment
- :45A: Description of Goods and/or Services:
  * 'goodsDescriptionVerbatim' = the WHOLE of field 45A, every line from the "45A" label up to the "46A" label, copied character for character with its line breaks.
    45A often starts at the bottom of one page and continues on the next page: include the lines on the following page too.
    45A may list SEVERAL products (e.g. "NE 28/1, 100% PHYSICAL BCI COTTON ... QUANTITY: 63,957.60 KG, UNIT PRICE: 2.700 PER KGS" followed by
    "NE 30/1, 100% PHYSICAL BCI COTTON ... QUANTITY: 63,957.60 KG, UNIT PRICE: 2.720 PER KGS"): include EVERY product and every
    shared line after them (end use, "AS PER PROFORMA INVOICE NO. ...", every proforma number, HS CODE, TERMS OF DELIVERY). Never shorten or summarise.
  * Leave out only table column headers such as 'Pos. Sales contract Specification Quantity in kg Price/kg in USD total Amount in USD'.
  * 'goodsItems': one entry PER PRODUCT in 45A, in the order listed:
      description = that product's own lines verbatim (count, composition, end use of that product) WITHOUT its quantity/price line,
      quantity / uom / unitPrice / amount = that product's figures (write European numbers as numbers: "1.680,00" -> 1680, "2,85" -> 2.85),
      contractRef = the sales contract / proforma number on that product's row, if the row shows one.
  * 'goodsQuantity' / 'goodsQuantityUom': TOTAL quantity of all products (e.g. two products of 63,957.60 KG -> 127915.2, "KG").
  * 'unitPrice': the rate only when 45A has a single product (e.g. "RATE 1.0100/YARD" -> 1.01); null when there are several.
  * 'freightTotal': freight included in the LC amount (e.g. "INCLUDING FREIGHT CHARGE USD 7,000.00" -> 7000).
  * Extract the Sales Contract / proforma number (e.g. 'S/0467/25-26') into 'contractReference' (the first one if several).
- :51D: Applicant Bank -> 'applicantBank' verbatim with line breaks.
- 46A / 47A clause markers may be letters ("A)", "B)") or zero-padded numbers ("01.", "02."); split on them, number clauses 1,2,3... in order.
- Contract Reference: Sales contract number referenced in 45A or 46A if present
- :48: Period for Presentation in Days
- :49: Confirmation Instructions
- :71D: Charges Narrative
- :78: Instructions to the Paying/Accepting/Negotiating Bank (full verbatim narrative)`;

  parts.push({ text: prompt });

  const response = await callGeminiWithFallback({
    contents: { parts },
    config: {
      systemInstruction: 'Extract MT700 Letter of Credit data strictly from the attached document into JSON format with individual verbatim clause arrays for 46A and 47A. Extract each clause once. If a field is not present, set it to null. Ensure valid, concise JSON output without duplicate text.',
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          lcNumber: { type: Type.STRING },
          issueDate: { type: Type.STRING },
          advisingBankRef: { type: Type.STRING },
          stepReference: { type: Type.STRING },
          advisingBank: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              branch: { type: Type.STRING },
              swift: { type: Type.STRING },
              address: { type: Type.STRING }
            }
          },
          issuingBank: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              swift: { type: Type.STRING },
              city: { type: Type.STRING },
              country: { type: Type.STRING }
            }
          },
          formOfCredit: { type: Type.STRING },
          applicableRules: { type: Type.STRING },
          expiryDate: { type: Type.STRING },
          expiryPlace: { type: Type.STRING },
          applicant: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              country: { type: Type.STRING },
              bin: { type: Type.STRING },
              tin: { type: Type.STRING },
              vat: { type: Type.STRING }
            }
          },
          beneficiary: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING }
            }
          },
          irnNumber: { type: Type.STRING },
          currency: { type: Type.STRING },
          amount: { type: Type.NUMBER },
          tolerancePercentage: {
            type: Type.OBJECT,
            properties: {
              positive: { type: Type.NUMBER },
              negative: { type: Type.NUMBER }
            }
          },
          availableWith: { type: Type.STRING },
          availableBy: { type: Type.STRING },
          tenor: { type: Type.STRING },
          partialShipment: { type: Type.STRING },
          transhipment: { type: Type.STRING },
          portOfLoading: { type: Type.STRING },
          portOfDischarge: { type: Type.STRING },
          placeOfReceipt: { type: Type.STRING },
          placeOfFinalDestination: { type: Type.STRING },
          latestShipmentDate: { type: Type.STRING },
          goodsDescriptionVerbatim: { type: Type.STRING },
          contractReference: { type: Type.STRING },
          drawee: { type: Type.STRING },
          goodsQuantity: { type: Type.NUMBER },
          goodsQuantityUom: { type: Type.STRING },
          unitPrice: { type: Type.NUMBER },
          freightTotal: { type: Type.NUMBER },
          goodsItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                uom: { type: Type.STRING },
                unitPrice: { type: Type.NUMBER },
                amount: { type: Type.NUMBER },
                contractRef: { type: Type.STRING }
              },
              required: ['description', 'quantity']
            }
          },
          applicantBank: { type: Type.STRING },
          periodForPresentationDays: { type: Type.NUMBER },
          presentationPeriodDays: { type: Type.NUMBER },
          confirmationInstructions: { type: Type.STRING },
          chargesNarrative: { type: Type.STRING },
          instructionsToBank: { type: Type.STRING },
          raw46AClauses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clauseNumber: { type: Type.NUMBER },
                clauseMarker: { type: Type.STRING },
                verbatimText: { type: Type.STRING }
              },
              required: ['clauseNumber', 'verbatimText']
            }
          },
          raw47AClauses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clauseNumber: { type: Type.NUMBER },
                clauseMarker: { type: Type.STRING },
                verbatimText: { type: Type.STRING }
              },
              required: ['clauseNumber', 'verbatimText']
            }
          }
        },
        required: ['lcNumber', 'issuingBank', 'applicant', 'beneficiary', 'currency', 'amount', 'raw46AClauses', 'raw47AClauses']
      }
    }
  });

  return sanitizeAIOutput(cleanAndParseJSON(response.text));
}
