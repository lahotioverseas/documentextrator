// Pre-Shipment (GST / customs) Invoice — the facts of one shipment
import { Type, ThinkingLevel } from '@google/genai';
import { callGeminiWithFallback } from '../gemini/client';
import { cleanAndParseJSON, sanitizeAIOutput } from '../gemini/json';
import { buildImageParts } from '../gemini/parts';

export async function extractPreShipment(body: any) {
  const { imageParts, textContent } = body;
  const parts = buildImageParts(imageParts, textContent, 'Document raw text');

  const prompt = `You are a precise export documentation auditor for Lahoti Overseas Ltd.
The attached document is a PRE-SHIPMENT INVOICE ("SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX") for ONE shipment.
Extract the shipment facts into JSON. Use ONLY what is printed in the document; return null for anything not printed.
Copy text verbatim; do not compute values.

FIELDS:
- invoiceNo / invoiceDate: from "Invoice No. & Date" (keep the date exactly as printed, e.g. "11/06/2026").
- irnNo: the value after "IRN NO." (null if the box is blank).
- buyersOrderNo / buyersOrderDate: from "Buyer's Order No. & Date".
- otherReference: from "Other Reference" (e.g. "BL No.").
- exporter: name, full address (multi-line), cin ("CIN No."), gstin ("GST No."), pan ("PAN No.").
- consignee: the COMPLETE "Consignee" box verbatim with line breaks (e.g. "TO THE ORDER OF SONALI BANK PLC\\nMOJIJHEEL C/A DHAKA").
- buyer: the COMPLETE "Buyer (if other than consignee)" box verbatim with line breaks.
- preCarriageBy, placeOfReceipt ("Place of Receipt by Pre-carrier"), vesselFlightNo ("Vessel/Flight No."),
  portOfLoading, portOfDischarge, finalDestination, countryOfOrigin ("Country of Origin of Goods"),
  countryOfFinalDestination: each box exactly as printed; null when the box is blank.
- termsOfDeliveryAndPayment: the COMPLETE "Terms of Delivery and Payment" box verbatim with line breaks
  (e.g. "CPT BENAPOLE,BANGLADESH(INCOTERM 2020)\\nLC NO.033026020021-PP DT. 16.04.2026\\nAT 90 DAYS FROM LR DATE").
- marksAndNos: the COMPLETE "Marks & Nos./Container No" column verbatim, preserving line breaks
  (e.g. "COTTON FABRICS\\nROLL NOS :\\n1 - 76\\nTOTAL GROSS WT :\\n7,755.500 KGS\\nTOTAL NET WT :\\n7679.500 KGS\\nCONTAINER NO/SEAL NO :").
- packageCount / packageKind: from "No. & Kind of Pkg" (e.g. 76 and "ROLLS").
- goodsQuantity / goodsQuantityUom: the commercial quantity written in the description, e.g. "QNTY - 21210.570 YARDS" -> 21210.57 and "YARDS"
  (TOTAL of all product rows when the invoice has several).
- items: one entry PER PRODUCT ROW of the invoice table: description (the product lines of that row, e.g.
  "100 PERCENT PHYSICAL BCI COTTON CARDED GREY YARN ON CONES FOR KNITTING\nNE 30/1 KH-PHYSICAL BCI COTTON", without MFG./DBK/EPCG/IGST/HSN/bank lines),
  quantity, uom, rate, amount, and that row's marksAndNos / packageCount / packageKind / netWeightKg / grossWeightKg when shown per row.
- customsQuantity / customsQuantityUom / customsRate: the Quantity and Rate columns (e.g. 35962.2 "SQ MTR", 0.5957).
- totalAmount / currency: the invoice total in foreign currency (e.g. 21422.68 "USD").
- grossWeightKg / netWeightKg: TOTAL GROSS WT and TOTAL NET WT in KGS as numbers.
- freightAmount / insuranceAmount: FREIGHT and INSURANCE amounts in foreign currency (e.g. "FREIGHT 1,200.00 (USD)" -> 1200).
- exchangeRate: "EXCH. @ Rs. 94.90 USD = 1" -> 94.9.
- hsnCode: "HSN Code" (e.g. "52091290").
- customsDescription: the tariff description lines (e.g. "WOVEN FABRICS OF COTTON UNBLEACHED ...") verbatim.
- manufacturer ("MFG."), epcgLicence ("EPCG LICENCE NO."), drawbackSrNo ("DBK SR NO."), adCode ("AD Code"), bankName ("Bank Name").`;

  parts.push({ text: prompt });

  const response = await callGeminiWithFallback({
    contents: { parts },
    config: {
      systemInstruction: 'Extract pre-shipment export invoice data into strict JSON, verbatim, from the attached document only. Missing fields are null.',
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          invoiceNo: { type: Type.STRING },
          invoiceDate: { type: Type.STRING },
          irnNo: { type: Type.STRING },
          buyersOrderNo: { type: Type.STRING },
          buyersOrderDate: { type: Type.STRING },
          otherReference: { type: Type.STRING },
          consignee: { type: Type.STRING },
          buyer: { type: Type.STRING },
          preCarriageBy: { type: Type.STRING },
          placeOfReceipt: { type: Type.STRING },
          vesselFlightNo: { type: Type.STRING },
          portOfLoading: { type: Type.STRING },
          portOfDischarge: { type: Type.STRING },
          finalDestination: { type: Type.STRING },
          countryOfOrigin: { type: Type.STRING },
          countryOfFinalDestination: { type: Type.STRING },
          termsOfDeliveryAndPayment: { type: Type.STRING },
          exporter: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              cin: { type: Type.STRING },
              gstin: { type: Type.STRING },
              pan: { type: Type.STRING }
            }
          },
          marksAndNos: { type: Type.STRING },
          packageCount: { type: Type.NUMBER },
          packageKind: { type: Type.STRING },
          goodsQuantity: { type: Type.NUMBER },
          goodsQuantityUom: { type: Type.STRING },
          customsQuantity: { type: Type.NUMBER },
          customsQuantityUom: { type: Type.STRING },
          customsRate: { type: Type.NUMBER },
          totalAmount: { type: Type.NUMBER },
          currency: { type: Type.STRING },
          grossWeightKg: { type: Type.NUMBER },
          netWeightKg: { type: Type.NUMBER },
          freightAmount: { type: Type.NUMBER },
          insuranceAmount: { type: Type.NUMBER },
          exchangeRate: { type: Type.NUMBER },
          hsnCode: { type: Type.STRING },
          customsDescription: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                uom: { type: Type.STRING },
                rate: { type: Type.NUMBER },
                amount: { type: Type.NUMBER },
                marksAndNos: { type: Type.STRING },
                packageCount: { type: Type.NUMBER },
                packageKind: { type: Type.STRING },
                netWeightKg: { type: Type.NUMBER },
                grossWeightKg: { type: Type.NUMBER }
              },
              required: ['description', 'quantity']
            }
          },
          manufacturer: { type: Type.STRING },
          epcgLicence: { type: Type.STRING },
          drawbackSrNo: { type: Type.STRING },
          adCode: { type: Type.STRING },
          bankName: { type: Type.STRING }
        },
        required: ['invoiceNo', 'invoiceDate', 'packageCount', 'totalAmount']
      }
    }
  });

  return sanitizeAIOutput(cleanAndParseJSON(response.text));
}
