// MT707 Amendment
import { Type, ThinkingLevel } from '@google/genai';
import { callGeminiWithFallback } from '../gemini/client';
import { cleanAndParseJSON, sanitizeAIOutput } from '../gemini/json';
import { buildImageParts } from '../gemini/parts';

export async function extractAmendment(body: any) {
  const { imageParts, textContent, currentLC } = body;
  const parts = buildImageParts(imageParts, textContent, 'Amendment raw text');

  const prompt = `Extract SWIFT MT707 Letter of Credit Amendment details.
Identify changed fields (e.g. 31D Expiry Date, 44C Latest Shipment Date, 48 Presentation Period, 32B Amount increase/decrease, 45A/46A/47A clause modifications) and provide exact old and new values.
Do NOT invent placeholder values. If a field is not altered, do not list it.

Current LC Context:
LC Number: ${currentLC?.lcNumber || 'Unknown'}
Current Amount: ${currentLC?.amount}
Current Expiry: ${currentLC?.expiryDate}
Current Latest Shipment: ${currentLC?.latestShipmentDate}
Current Presentation Days: ${currentLC?.periodForPresentationDays || currentLC?.presentationPeriodDays}
Current 46A Clauses: ${JSON.stringify(currentLC?.field46AClauses || [])}
Current 47A Clauses: ${JSON.stringify(currentLC?.field47AClauses || [])}`;

  parts.push({ text: prompt });

  const response = await callGeminiWithFallback({
    contents: { parts },
    config: {
      systemInstruction: 'Extract MT707 SWIFT LC Amendment into structured JSON with clause-level diff tracking. Output valid compact JSON.',
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          amendmentNo: { type: Type.STRING },
          amendmentDate: { type: Type.STRING },
          narrative: { type: Type.STRING },
          changes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                field: { type: Type.STRING },
                oldValue: { type: Type.STRING },
                newValue: { type: Type.STRING },
                impact: { type: Type.STRING }
              },
              required: ['field', 'oldValue', 'newValue', 'impact']
            }
          },
          patchedClauses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                field: { type: Type.STRING },
                clauseNumber: { type: Type.NUMBER },
                verbatimText: { type: Type.STRING },
                plainEnglishSummary: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['bake_in_instruction', 'compliance_rule'] },
                affectedDocuments: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                targetField: { type: Type.STRING }
              }
            }
          }
        },
        required: ['amendmentNo', 'amendmentDate', 'narrative', 'changes']
      }
    }
  });

  return sanitizeAIOutput(cleanAndParseJSON(response.text));
}
