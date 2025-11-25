import { GoogleGenAI } from "@google/genai";

const getClient = () => {
    // Safety check: process might not be defined in browser environment
    // Note: The environment variable is expected to be injected by the build system or runtime.
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : undefined;
    
    if (!apiKey) {
      // Return a dummy client or throw a clear error depending on desired behavior.
      // Throwing ensures the UI catches it if called.
      throw new Error("API Key not found. Please ensure process.env.API_KEY is available.");
    }
    return new GoogleGenAI({ apiKey });
};

export const generateSqlFromPrompt = async (
  userPrompt: string, 
  schemaHint: string = "Oracle Fusion Cloud Tables (HZ_PARTIES, AP_INVOICES_ALL, etc.)"
): Promise<string> => {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert Oracle SQL Developer. Convert the following natural language request into a valid Oracle SQL query.
      
      Context/Schema Hint: ${schemaHint}
      
      User Request: "${userPrompt}"
      
      Return ONLY the SQL query. Do not include markdown formatting like \`\`\`sql. Do not include explanations.`,
    });
    
    return response.text.trim().replace(/^```sql/, '').replace(/```$/, '').trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const explainError = async (errorMessage: string, query: string): Promise<string> => {
    try {
        const ai = getClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `I ran this Oracle SQL query:
            ${query}
            
            And got this error:
            ${errorMessage}
            
            Explain briefly what went wrong and suggest a fix.`
        });
        return response.text;
    } catch (error) {
        return "Could not generate explanation.";
    }
}