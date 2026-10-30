// Classify LC 46A / 47A clauses
import { Type, ThinkingLevel } from '@google/genai';
import { callGeminiWithFallback } from '../gemini/client';
import { cleanAndParseJSON, sanitizeAIOutput } from '../gemini/json';

export async function classifyClauses(body: any) {
  const { clauses } = body;
  const prompt = `You are a trade finance document auditor. Analyze each Letter of Credit clause extracted from Field 46A (Documents Required) or Field 47A (Additional Conditions).
For each clause:
1. 'category': classify into one of:
   - 'document_requirement': specifies a mandatory presentation document, copy count, or issuer.
   - 'declaration': specific verbatim wording, statement, or declaration to be printed on a document.
   - 'shipping_rule': transport, shipment method, containerization, or carrier notification instructions.
   - 'banking_condition': advising/confirming bank rules, presentation timelines, or payment mechanics.
   - 'special_instruction': buyer-specific labels, courier tracking, email notifications, or inspection protocols.
   - 'discrepancy_rule': discrepancy rejection policies, waiver terms, or deduction fees.
2. 'appliesToDocument': array containing one or more of: ['invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin', 'bill_of_exchange', 'beneficiary_certificate', 'all'].
3. 'instructionSummary': concise, crystal-clear explanation of what must be done or complied with.
4. 'isAutoAppliable': boolean (true if the text/declaration can be automatically baked into the generated export documents, e.g. invoice declarations, packing list quotes, B/L notify parties, REX statement; false if it requires physical external compliance like sending couriers or bank schedules).
5. 'type': 'bake_in_instruction' (if text needs to be printed onto documents) OR 'compliance_rule' (if it is a verification/timing rule).
6. 'targetField': suggested field or section in the target document (e.g. 'invoice.declarationText', 'packingList.shipperDeclaration', 'billOfLading.notifyParty2', 'invoice.rexNumber').

Clauses to classify:
${JSON.stringify(clauses, null, 2)}`;

  const response = await callGeminiWithFallback({
    contents: prompt,
    config: {
      systemInstruction: 'Classify trade finance Letter of Credit clauses into structured actionable instructions with exact document mappings.',
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            field: { type: Type.STRING },
            clauseNumber: { type: Type.NUMBER },
            verbatimText: { type: Type.STRING },
            category: {
              type: Type.STRING,
              enum: ['document_requirement', 'declaration', 'shipping_rule', 'banking_condition', 'special_instruction', 'discrepancy_rule']
            },
            appliesToDocument: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            instructionSummary: { type: Type.STRING },
            plainEnglishSummary: { type: Type.STRING },
            isAutoAppliable: { type: Type.BOOLEAN },
            type: { type: Type.STRING, enum: ['bake_in_instruction', 'compliance_rule'] },
            targetField: { type: Type.STRING }
          },
          required: ['id', 'field', 'clauseNumber', 'verbatimText', 'category', 'appliesToDocument', 'instructionSummary', 'isAutoAppliable', 'type']
        }
      }
    }
  });

  return sanitizeAIOutput(cleanAndParseJSON(response.text));
}
