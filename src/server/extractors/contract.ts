// Sale Contract
import { Type, ThinkingLevel } from '@google/genai';
import { callGeminiWithFallback } from '../gemini/client';
import { cleanAndParseJSON, sanitizeAIOutput } from '../gemini/json';
import { buildImageParts } from '../gemini/parts';

export async function extractContract(body: any) {
  const { imageParts, textContent } = body;
  const parts = buildImageParts(imageParts, textContent, 'Document raw text content');

  const prompt = `You are a highly precise export documentation auditor for Lahoti Overseas Ltd.
Extract all trade finance data strictly from the attached document into JSON format.

CRITICAL INSTRUCTIONS & RULES:
1. Extract data ONLY from the attached document. DO NOT use pre-existing memory, sample values, or assumptions.
2. Extract all fields, descriptions of goods, specifications, composition, yarn details, numbers, terms, and banking clauses character-for-character VERBATIM (preserving exact spelling, punctuation, capitalization, and formatting).
3. Do not summarize, rephrase, or correct grammar or typos.
4. If a field is not explicitly present in the uploaded document, return null or empty string. DO NOT guess, fabricate, or infer missing data.
5. Do not perform mathematical calculations. Only extract the raw numbers as written in the document.
6. Identify whether this document is a Sales Contract / Sales Confirmation (issued by seller) or a Purchase Contract / Purchase Order / PO (issued by buyer). Set 'documentType' to either 'sales' or 'purchase'.
7. Identify the exact document sections present in the uploaded document:
   - Header: Seller/Exporter info (Company name, Registered Office, Tel, Fax, Email, Internet, CIN, REX No if present).
   - Order Header: Order No / Contract No, Order Date, Order Currency, Shipment Validity, Ref. Correspondence.
   - Buyer section: Extract the COMPLETE verbatim multi-line Buyer Name and Address. Include company name, full factory/office address, area, postal code, city, country, and any VAT/BIN/TIN registration numbers (e.g. VAT REGISTRATION NO. (BIN): 000495263-0403), contact person, phone, and email. DO NOT truncate or omit any address lines.
   - Line items table: Item No / SI No, Description, Specification, Composition, Yarn Details, Quantity, Unit of Measure (UOM), Unit Price, Net Value.
     * CRITICAL GOODS & DESCRIPTION RULE: Capture full multi-line item description, fabric composition (e.g. 100% COTTON FEBRIC, COMPOSITION : 98% COTTON+2% SPANDEX, YARN: OE X KW, SELVEDGE LENO: 24 M), yarn details, and spec lines verbatim across all lines.
     * CRITICAL DESCRIPTION RULE: You MUST capture the FULL and COMPLETE description block for each item verbatim across ALL lines. Include the item code line, all multi-line composition/spec lines (e.g. "100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR KNITTING." or "100% COTTON CARDED COMPACT YARN ON CONE UNWAXED FOR WEAVING WITH 630 TPM & 625 CN TEX."), any brand names (e.g. "RAVALI BRAND"), and any narrative text appearing right above the amount in words. DO NOT truncate or shorten descriptions to just the first line.
     * TWO-LINE ITEM LAYOUT: in Lahoti's SALES ORDER CONFIRMATION each item has its short name ON THE SAME ROW as SI. No / Qty / UOM / Currency / Unit Price / Net Values
       (e.g. "1  NE 30/1 CARDED PHYSICAL BCI  63,957.60  KG  USD  2.720  173,964.67") and the full description on the NEXT line, under it
       (e.g. "100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR KNITTING."). Put BOTH lines, in that order, separated by a line break, in 'description':
       "NE 30/1 CARDED PHYSICAL BCI\\n100% PHYSICAL BCI COTTON CARDED GREY YARN ON CONE FOR KNITTING.". Never drop the first line because it shares a row with the numbers.
   - Value in words: Total value written in words.
   - Quantity/Package details: NO. OF FCL / container count, TOLERANCE, INSURANCE.
   - Terms & Conditions: PAYMENT TERMS, DELIVERY TERMS, PORT OF LOADING, PORT OF DELIVERY, SHIPMENT MODE, PACKING, TRANSHIPMENT, PARTIAL SHIPMENT.
   - Bank Details: PAY TO, SWIFT, BANK ADDRESS, BENEFICIARY, BENEFICIARY A/C NO., INTERMEDIARY BANK, SWIFT ADDRESS, INTERMEDIARY A/C NO., ABA NO.
   - Secondary / Page 2 sections: DOCUMENT REQUIREMENTS (extract every bullet point verbatim), TERMS AND CONDITIONS OF SALE (extract every numbered clause verbatim).`;

  parts.push({ text: prompt });

  const response = await callGeminiWithFallback({
    contents: { parts },
    config: {
      systemInstruction: 'Extract trade finance sales/purchase contract data into strict structured JSON format with verbatim descriptions and exact fields directly from the attached document only. If a field is not present, set it to null. Output only valid JSON without duplicate items.',
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentType: { type: Type.STRING },
          contractNo: { type: Type.STRING },
          contractDate: { type: Type.STRING },
          exporter: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              tel: { type: Type.STRING },
              fax: { type: Type.STRING },
              email: { type: Type.STRING },
              web: { type: Type.STRING },
              cin: { type: Type.STRING },
              rexNo: { type: Type.STRING }
            }
          },
          buyer: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              country: { type: Type.STRING },
              contactPerson: { type: Type.STRING }
            }
          },
          orderCurrency: { type: Type.STRING },
          shipmentValidity: { type: Type.STRING },
          refCorrespondence: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                itemNo: { type: Type.INTEGER },
                description: { type: Type.STRING },
                specification: { type: Type.STRING },
                composition: { type: Type.STRING },
                yarnDetails: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                uom: { type: Type.STRING },
                unitPrice: { type: Type.NUMBER },
                netValue: { type: Type.NUMBER }
              }
            }
          },
          totalValue: { type: Type.NUMBER },
          totalValueWords: { type: Type.STRING },
          tolerance: { type: Type.STRING },
          fclCount: { type: Type.STRING },
          insurance: { type: Type.STRING },
          paymentTerms: { type: Type.STRING },
          deliveryTerms: { type: Type.STRING },
          portOfLoading: { type: Type.STRING },
          portOfDelivery: { type: Type.STRING },
          shipmentMode: { type: Type.STRING },
          packingType: { type: Type.STRING },
          transhipment: { type: Type.STRING },
          partialShipment: { type: Type.STRING },
          bankDetails: {
            type: Type.OBJECT,
            properties: {
              payTo: { type: Type.STRING },
              swift: { type: Type.STRING },
              bankAddress: { type: Type.STRING },
              beneficiary: { type: Type.STRING },
              beneficiaryAccNo: { type: Type.STRING },
              intermediaryBank: { type: Type.STRING },
              intermediarySwift: { type: Type.STRING },
              intermediaryAccNo: { type: Type.STRING },
              abaNo: { type: Type.STRING }
            }
          },
          documentRequirements: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          termsAndConditions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ['contractNo', 'exporter', 'buyer', 'items', 'totalValue', 'orderCurrency']
      }
    }
  });

  return sanitizeAIOutput(cleanAndParseJSON(response.text));
}
