const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

/**
 * Helper to convert local file into the format Google Gen AI expects.
 */
function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType: mimeType || 'image/jpeg'
    },
  };
}

/**
 * Analyzes the issue image using Gemini API or falls back to an intelligent mock logic.
 * 
 * @param {string} imagePath Absolute/relative path to the uploaded image file.
 * @param {string} mimeType Mime type of the image (e.g. image/jpeg, image/png).
 * @param {string} subject Subject of the reported issue.
 * @param {string} issueType Type of the issue (e.g. Pothole, Damaged Streetlight).
 * @param {string} description Citizen's description.
 * @returns {Promise<{detectedIssue: string, severity: string, confidence: number, analysis: string}>}
 */
async function analyzeIssueImage(imagePath, mimeType, subject, issueType, description) {
  const apiKey = process.env.GEMINI_API_KEY;
  const isMock = !apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '';

  if (isMock) {
    console.log('Gemini API key not configured or using default. Running fallback AI evaluation...');
    return getFallbackAIAnalysis(subject, issueType, description);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // Use gemini-1.5-flash as the standard and fast multimodal model
    const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

    const imgPart = fileToGenerativePart(imagePath, mimeType);
    
    const prompt = `
      You are an urban infrastructure safety AI. Analyze this image of a community issue. 
      The citizen submitted the following report details:
      - Subject: ${subject}
      - Declared Category: ${issueType}
      - Description: ${description}

      Task:
      1. Inspect the image to confirm if it contains an infrastructure or community hazard (e.g. potholes, road damage, water leaks, broken streetlights, piled garbage, damaged public assets) and if it reasonably matches the report subject and description.
      2. If the image contains NO community/infrastructure hazard, is a random upload (like a video call screenshot, animal, selfie, face, food, meme, text document, or blank placeholder), or does not match the report details (e.g. subject says pothole but image shows a meeting screenshot), you MUST set "isValid" to false, and set "detectedIssue" to "None".
      3. If "isValid" is false, provide a clear explanation in "invalidReason" (e.g. "The uploaded image is a screenshot of a video call and does not show any infrastructure issues or community hazards.").
      4. Assess the severity level of the hazard using these strict definitions for potholes and street damage:
         - "Low": Small potholes/cracks (shallow, depth < 3cm, minor surface wear, no vehicle damage risk, only minor nuisance).
         - "Medium": Moderate potholes (depth 3-7cm, noticeable dip, slows vehicles down, moderate risk of tyres or rim damage but low immediate accident threat).
         - "High": Large/deep potholes (depth 8-12cm, substantial asphalt displacement, high risk of tyre blowouts, rim damage, or vehicle suspension damage).
         - "Critical": Massive hazards/potholes (depth > 12cm, extreme depth, immediate high risk of vehicle loss of control, skidding, or potential accident, particularly dangerous for two-wheelers/bikes).
         For other issue categories, scale the severity analogously based on immediate safety and accident threat.
      5. Provide a confidence score between 0.0 and 1.0.
      6. Describe what you see in a concise 1-2 sentences analysis.

      Return ONLY a raw JSON string matching the structure below. Do not wrap it in markdown formatting or code blocks:
      {
        "isValid": true | false,
        "invalidReason": "Detailed reason why the image does not match the report if isValid is false (otherwise empty string)",
        "detectedIssue": "Short name of the issue detected (e.g., Pothole, Damaged Streetlight)",
        "severity": "Low" | "Medium" | "High" | "Critical",
        "confidence": 0.85,
        "analysis": "A concise 1-2 sentence description of the visible hazard and potential safety risk."
      }
    `;

    const result = await model.generateContent([prompt, imgPart]);
    const responseText = result.response.text();
    
    // Clean potential markdown wrappers if the model returned them
    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.substring(7);
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.substring(3);
    }
    if (cleanJson.endsWith('```')) {
      cleanJson = cleanJson.substring(0, cleanJson.length - 3);
    }
    cleanJson = cleanJson.trim();

    try {
      const parsed = JSON.parse(cleanJson);
      return {
        isValid: parsed.isValid !== false,
        invalidReason: parsed.invalidReason || '',
        detectedIssue: parsed.detectedIssue || issueType,
        severity: ['Low', 'Medium', 'High', 'Critical'].includes(parsed.severity) ? parsed.severity : 'Medium',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.80,
        analysis: parsed.analysis || 'AI successfully analyzed the uploaded image.'
      };
    } catch (parseErr) {
      console.error('Failed to parse Gemini response as JSON. Response was:', responseText);
      // Fallback within Gemini failure
      return {
        isValid: true,
        invalidReason: '',
        detectedIssue: issueType,
        severity: 'Medium',
        confidence: 0.70,
        analysis: `AI Analysis completed but returned formatting errors. Summary: ${responseText.substring(0, 150)}...`
      };
    }

  } catch (error) {
    console.error('Error invoking Gemini API:', error.message);
    console.log('Gracefully falling back to intelligent rule-based AI evaluation...');
    return getFallbackAIAnalysis(subject, issueType, description);
  }
}

/**
 * Generates realistic AI metadata based on text heuristics when Gemini is unavailable.
 */
function getFallbackAIAnalysis(subject, issueType, description) {
  const combinedText = `${subject} ${description}`.toLowerCase();
  
  let severity = 'Low';
  let confidence = 0.85;
  let analysis = '';

  // Determine severity based on severity keywords matching new guidelines
  if (combinedText.includes('accident') || combinedText.includes('critical') || combinedText.includes('danger') || combinedText.includes('crash') || combinedText.includes('injury') || combinedText.includes('skid') || combinedText.includes('risk') || combinedText.includes('severe accident') || combinedText.includes('two-wheeler')) {
    severity = 'Critical';
    analysis = `[FALLBACK AI] Critical hazard! High risk of immediate accident or vehicle skidding (especially dangerous for two-wheelers).`;
    confidence = 0.94;
  } else if (combinedText.includes('deep') || combinedText.includes('major') || combinedText.includes('huge') || combinedText.includes('broken') || combinedText.includes('large') || combinedText.includes('blockage') || combinedText.includes('hazard')) {
    severity = 'High';
    analysis = `[FALLBACK AI] High severity hazard. Deep structure degradation indicates a high risk of tyre blowouts or suspension damage.`;
    confidence = 0.88;
  } else if (combinedText.includes('pothole') || combinedText.includes('light') || combinedText.includes('leakage') || combinedText.includes('waste')) {
    // Check if it describes a small/minor pothole
    if (combinedText.includes('small') || combinedText.includes('minor') || combinedText.includes('shallow') || combinedText.includes('wear')) {
      severity = 'Low';
      analysis = `[FALLBACK AI] Low severity issue. Small shallow wear detected with negligible risk to passing vehicles.`;
      confidence = 0.82;
    } else {
      severity = 'Medium';
      analysis = `[FALLBACK AI] Medium severity issue. Moderate damage slows down traffic, posing minor rim hazards.`;
      confidence = 0.85;
    }
  } else {
    severity = 'Low';
    analysis = `[FALLBACK AI] Low severity issue. Small shallow wear. No immediate safety threat or crash hazard is present.`;
    confidence = 0.78;
  }

  return {
    isValid: true,
    invalidReason: '',
    detectedIssue: issueType,
    severity,
    confidence,
    analysis
  };
}

module.exports = {
  analyzeIssueImage
};
