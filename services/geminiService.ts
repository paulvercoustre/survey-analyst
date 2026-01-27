import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { ResultRow, QuestionnaireRow, QualitativeAnalysisRow, TraceMetadata, ProgressCallback } from "../types";

const QUANT_TOOL_NAME = "query_survey_data";
const QUAL_TOOL_NAME = "query_qualitative_data";

// Qualitative Tool (static - doesn't need dynamic values)
const queryQualitativeDataTool: FunctionDeclaration = {
  name: QUAL_TOOL_NAME,
  description: "Queries the qualitative analysis findings. Use this for 'text' or 'open-ended' type questions to get themes, summaries, and quotes.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      question_name: {
        type: Type.STRING,
        description: "The unique variable name of the qualitative question (e.g., 'climate_change_mitigation').",
      }
    },
    required: ["question_name"],
  },
};

/**
 * Builds the quantitative survey tool dynamically based on available disaggregation values.
 */
const buildQuantSurveyTool = (disaggregationValues: string[]): FunctionDeclaration => {
  return {
    name: QUANT_TOOL_NAME,
    description: "Queries the aggregated quantitative survey results (numbers, percentages, means). Use this for 'select_one', 'select_multiple', or 'integer' type questions. Returns data for all groups within the chosen disaggregation level.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        question_name: {
          type: Type.STRING,
          description: "The unique variable name (e.g., 'electricity_outages').",
        },
        disaggregation: {
          type: Type.STRING,
          description: `The disaggregation level. Must be one of: ${disaggregationValues.map(v => `'${v}'`).join(', ')}. Use 'all' for overall totals, or a specific disaggregation to get breakdowns by group.`,
          enum: disaggregationValues
        }
      },
      required: ["question_name", "disaggregation"],
    },
  };
};

/**
 * Writing persona definitions - each persona has a unique writing style guide
 */
const WRITING_PERSONAS: Record<string, string> = {
  development_economist: `
      **1. The Analytical Arc (The "Funnel" Approach)**
      Construct your paragraphs using this four-step logic:
      
      - **The Aggregate Baseline (The "What")**: Start with the high-level quantitative finding for the whole sample (use disaggregation='all').
      - **The Disaggregation (The "Nuance")**: Pivot to heterogeneity. Query other disaggregation levels to reveal if trends hold across groups.
      - **The Qualitative Mechanism (The "Why")**: Integrate qualitative findings to explain *why* the numbers look this way. Use themes and quotes to reveal trust deficits, friction points, or behavioral drivers.
      - **The Economic Logic (The "So What")**: Conclude with the structural implication (e.g., market failure, rational survival strategy, information asymmetry, binding constraint).

      **2. Integrating Qualitative Data**
      
      - **Triangulation**: Use qualitative data to validate or complicate the statistics. Do not treat quotes as "flavor text"; treat them as evidence of mechanisms.
      - **Synthesis over Quotation**: Generally, synthesize qualitative themes (e.g., "Respondents frequently cited X..."). Use direct quotes only if they powerfully illustrate a structural barrier.
      - **Explaining Outliers**: If quantitative data shows an anomaly (e.g., high revenue but low investment), use qualitative data to explain the behavioral driver.

      **3. Writing Tone**
      
      - **Be Diagnostic**: Use data to diagnose systemic issues. Employ vocabulary like: binding constraints, asymmetry, fragmentation, compliance costs, rational choices, opportunity costs.
      - **Precise & Professional**: Avoid dramatic adjectives. Use "severe" or "acute" only if supported by data.
      - **Hypothesize Causality**: When linking stats and qualitative feedback, use connective phrasing like: "This qualitative evidence suggests that the statistical gap is driven by..."

      **4. Example Output Structure**
      
      [Step 1: The Baseline Stat]
      "Access to finance remains the primary binding constraint for the region, with 63% of surveyed firms citing it as a severe obstacle to operations.
      
      [Step 2: The Disaggregation/Nuance]
      However, the data reveals a sharp divergence by gender. While male-owned firms report a reliance on supplier credit (19%), female-owned enterprises are almost entirely excluded from external financing, relying on internal savings (87%) or family networks.
      
      [Step 3: The Qualitative Mechanism]
      Qualitative discussions reveal that this exclusion is not merely a lack of capital supply, but a collateral mismatch. Female respondents frequently noted that they lack title deeds for land—the primary collateral required by banks—due to customary inheritance laws. As one respondent noted, 'The banks ask for papers we are not allowed to hold.'
      
      [Step 4: The Economic Logic]
      Consequently, for women-led firms, the barrier to finance is structural rather than transactional. This forces them to operate at a suboptimal scale, trapped in a low-investment, low-return equilibrium despite high potential for growth."
  `,

  policy_briefing: `
      **1. Problem-Evidence-Recommendation Structure**
      Organize your response using clear sections:
      
      - **Problem Statement**: Lead with the challenge or issue (one concise paragraph)
      - **Evidence**: Present key quantitative findings and disaggregations (2-3 short paragraphs or bullet points)
      - **Insight**: Briefly integrate qualitative findings to explain drivers (1 paragraph)
      - **Implications**: State what this means for policy or action (1 paragraph, action-oriented)

      **2. Writing Style**
      
      - **Concise & Direct**: Use short paragraphs (3-4 sentences max). Get to the point quickly.
      - **Executive-Friendly Language**: Minimize jargon. When technical terms are necessary, briefly define them.
      - **Active Voice**: Prefer "The data shows" over "It is shown by the data"
      - **Scannable Format**: Use subheadings, bullet points, and bold text to highlight key findings
      - **Numbers Front and Center**: Lead sentences with statistics. Make percentages and figures prominent.

      **3. Qualitative Integration**
      
      - Use qualitative data to illustrate "why" but keep it brief
      - Limit direct quotes to one per section, and only if particularly compelling
      - Synthesize themes rather than listing multiple quotes
      - Connect qualitative insights directly to policy implications

      **4. Tone**
      
      - Professional but accessible
      - Solution-oriented and pragmatic
      - Emphasize actionable insights over theoretical frameworks
      - Use phrases like: "The data suggests that...", "Key finding:", "This indicates a need for..."

      **5. Example Output**
      
      **Problem**: Access to formal financing remains severely constrained, with 63% of surveyed firms reporting it as a major obstacle.
      
      **Evidence**: The constraint varies significantly by gender:
      - Male-owned firms: 19% rely on supplier credit
      - Female-owned firms: 87% rely on internal savings or family networks
      - Almost complete exclusion from formal banking for women entrepreneurs
      
      **Insight**: Qualitative data reveals the core issue is collateral mismatch. Women lack land title deeds required by banks due to customary inheritance laws, creating a structural barrier rather than a simple capital shortage.
      
      **Implication**: Expanding financial access requires reforms beyond credit supply—including land titling reforms and alternative collateral mechanisms for women entrepreneurs.
  `,

  data_extractor: `
      **1. Presentation Style**
      
      - **Factual Reporting Only**: Present statistics exactly as they appear in the data
      - **No Interpretation**: Do not explain "why" or offer causal analysis
      - **No Synthesis**: Report findings separately rather than weaving them together
      - **Simple Declarative Sentences**: Use straightforward sentence structures

      **2. Structure**
      
      - Start with overall statistics (disaggregation='all')
      - Then present disaggregated breakdowns if queried
      - List qualitative themes and quotes without interpretation
      - Use clear labels for each data point

      **3. Formatting**
      
      - Use bullet points or numbered lists for multiple data points
      - Clearly label the variable name being reported
      - Include sample sizes when available
      - Present percentages, counts, or means as provided
      - For qualitative data: list themes with prevalence, followed by quotes

      **4. Language Rules**
      
      - Use neutral reporting verbs: "shows", "indicates", "reports"
      - Avoid interpretive adjectives like "surprisingly", "significantly", "concerning"
      - Do not use causal language: no "because", "therefore", "as a result"
      - Do not compare or contrast findings unless explicitly asked
      - State what the data shows, not what it means

      **5. Example Output**
      
      **Variable: Access to Finance**
      
      Overall (all respondents):
      - 63% reported access to finance as a severe obstacle
      - Sample size: 450 respondents
      
      By gender:
      - Male-owned firms: 19% rely on supplier credit
      - Female-owned firms: 87% rely on internal savings or family networks
      
      **Qualitative findings:**
      
      Theme 1: Collateral requirements (mentioned by 45% of respondents)
      - "The banks ask for papers we are not allowed to hold."
      - "Without land title, they will not give us credit."
      
      Theme 2: Documentation barriers (mentioned by 32% of respondents)
      - "Too many forms and requirements."
      - "The process takes months and we need money now."
  `,
};

export { WRITING_PERSONAS };

export class SurveyAgent {
  private ai: GoogleGenAI;
  private results: ResultRow[];
  private questionnaire: QuestionnaireRow[];
  private qualitativeData: QualitativeAnalysisRow[];
  private chatSession: any;
  private questionContextString: string = "";
  private validQuestionNames: Set<string> = new Set();
  private disaggregationValues: string[] = [];
  private analysisTimeVariables: string[] = [];
  private mainModel: string;
  private selectorModel: string;
  private writingStyle: string;
  private customStyleGuide: string;

  constructor(
    apiKey: string, 
    results: ResultRow[], 
    questionnaire: QuestionnaireRow[], 
    qualitativeData: QualitativeAnalysisRow[],
    mainModel: string = "gemini-3-pro-preview",
    selectorModel: string = "gemini-3-flash-preview",
    writingStyle: string = "development_economist",
    customStyleGuide: string = "",
    onInitProgress?: ProgressCallback
  ) {
    this.ai = new GoogleGenAI({ apiKey });
    this.results = results;
    this.questionnaire = questionnaire;
    this.qualitativeData = qualitativeData;
    this.mainModel = mainModel;
    this.selectorModel = selectorModel;
    this.writingStyle = writingStyle;
    this.customStyleGuide = customStyleGuide;
    this.extractDisaggregationValues(onInitProgress);
    this.initAgents(onInitProgress);
  }

  /**
   * Extracts unique disaggregation values from the quantitative results data.
   */
  private extractDisaggregationValues(onProgress?: ProgressCallback) {
    const traceId = onProgress?.onStepStart("Identifying disaggregation levels...");
    
    const uniqueValues = new Set<string>();
    
    for (const row of this.results) {
      if (row.disaggregation) {
        uniqueValues.add(row.disaggregation.trim());
      }
    }
    
    this.disaggregationValues = Array.from(uniqueValues).sort();
    console.log("📊 Extracted disaggregation values:", this.disaggregationValues);
    
    if (traceId && onProgress) {
      onProgress.onStepComplete(traceId, {
        disaggregationLevels: this.disaggregationValues
      });
    }
  }

  /**
   * Returns the appropriate writing style guide based on the selected persona.
   */
  private getWritingStyleGuide(): string {
    if (this.writingStyle === 'custom' && this.customStyleGuide.trim()) {
      return this.customStyleGuide;
    }
    
    return WRITING_PERSONAS[this.writingStyle] || WRITING_PERSONAS['development_economist'];
  }

  /**
   * Returns the appropriate role description based on the selected persona.
   */
  private getRoleDescription(): string {
    const roleDescriptions: Record<string, string> = {
      development_economist: "You are a Senior Development Economist writing analytical reports in the style of UNDP/World Bank publications.",
      policy_briefing: "You are a policy analyst preparing concise briefings for decision-makers and executives.",
      data_extractor: "You are a data reporting assistant that presents survey findings in a clear, factual manner without interpretation.",
      custom: "You are a survey data analyst presenting findings according to the user's specified style guide."
    };
    
    return roleDescriptions[this.writingStyle] || roleDescriptions['development_economist'];
  }

  private initAgents(onProgress?: ProgressCallback) {
    console.log("--- 🟢 Initializing Survey Agent ---");

    if (this.questionnaire.length === 0) {
      console.warn("⚠️ Questionnaire is empty.");
      return;
    }

    // --- CSV Header Detection ---
    const firstRow = this.questionnaire[0];
    const headers = Object.keys(firstRow);
    const typeCol = headers.find(h => h.toLowerCase().trim() === 'type') || 'type';
    const nameCol = headers.find(h => h.toLowerCase().trim() === 'name') || 'name';
    const labelCol = headers.find(h => 
      h.toLowerCase().includes('label::english') || 
      h.toLowerCase() === 'label'
    ) || 'label';

    // --- Variable Analysis ---
    const relevantQuestions = this.questionnaire.filter(q => {
      const typeRaw = q[typeCol];
      const name = q[nameCol];
      if (!name) return false;

      const type = (typeRaw || '').toLowerCase().trim();
      
      const isSelect = type.includes('select_one') || type.includes('select_multiple');
      const isNumeric = type === 'integer' || type === 'decimal' || type === 'calculate';
      const isText = type === 'text';

      return isSelect || isNumeric || isText;
    });

    this.validQuestionNames = new Set(relevantQuestions.map(q => q[nameCol]?.trim()));

    // --- Build Context String for Questionnaire Variables ---
    // We visually tag variables so the LLM knows which tool to use.
    const questionnaireContext = relevantQuestions
      .map(q => {
        const labelRaw = q[labelCol] || 'No Label';
        const cleanLabel = labelRaw.replace(/\s+/g, ' ').trim();
        const cleanName = q[nameCol]?.trim();
        const cleanType = (q[typeCol] || '').split(' ')[0]; 
        
        // Determine Tool Hint
        let toolHint = "[QUANTITATIVE]";
        if (cleanType === 'text') toolHint = "[QUALITATIVE]";

        return `- Variable: "${cleanName}" | Type: ${cleanType} ${toolHint} | Question: "${cleanLabel}"`;
      })
      .join('\n');

    // --- Extract Analysis-Time Variables from Excel Data ---
    const traceId = onProgress?.onStepStart("Identifying analysis-time variables...");
    
    // These are variables that exist in the results but not in the questionnaire
    const resultsVariables = new Set(this.results.map(r => r.question?.trim()).filter(Boolean));
    const analysisTimeVars: string[] = [];
    
    for (const varName of resultsVariables) {
      if (!this.validQuestionNames.has(varName)) {
        analysisTimeVars.push(varName);
        this.validQuestionNames.add(varName); // Add to valid names so Selector can use them
      }
    }

    // Build context for analysis-time variables
    let analysisContext = '';
    if (analysisTimeVars.length > 0) {
      console.log(`📈 Found ${analysisTimeVars.length} analysis-time variables:`, analysisTimeVars);
      this.analysisTimeVariables = analysisTimeVars; // Store for trace
      analysisContext = '\n\n--- Analysis-Time Variables (created during data processing) ---\n' +
        analysisTimeVars
          .map(v => `- Variable: "${v}" | Type: analysis [QUANTITATIVE] | Question: "Analysis variable"`)
          .join('\n');
    } else {
      console.log("📈 No analysis-time variables found (all results variables exist in questionnaire)");
      this.analysisTimeVariables = []; // Store empty array for trace
    }
    
    if (traceId && onProgress) {
      onProgress.onStepComplete(traceId, {
        variables: this.analysisTimeVariables
      });
    }

    // Combine both context strings
    this.questionContextString = questionnaireContext + analysisContext;

    // --- Main System Instruction ---
    const disaggregationList = this.disaggregationValues.map(v => `'${v}'`).join(', ');
    const systemInstruction = `
      ${this.getRoleDescription()}
      You have access to both Quantitative (Numbers) and Qualitative (Themes/Quotes) survey data.

      ===== DATA SOURCES & TOOLS =====
      
      1. **Quantitative Data**: Accessed via '${QUANT_TOOL_NAME}'.
         - Use for variables marked [QUANTITATIVE] (select_one, integer, etc.).
         - Requires 'disaggregation' parameter. Available values: ${disaggregationList}.
      
      2. **Qualitative Data**: Accessed via '${QUAL_TOOL_NAME}'.
         - Use for variables marked [QUALITATIVE] (text).
         - Returns Executive Summaries, Themes, and Direct Quotes.
         - *No disaggregation parameter needed* for this tool.

      ===== YOUR PROCESS =====
      
      1. Analyze the user's request using the [System Note] which lists relevant variables.
      2. **Decide** which tools to call:
         - If the user asks about a topic and there are both Quant AND Qual variables, **call BOTH tools**.
         - Combine the findings. Use numbers to show prevalence and quotes/themes to explain the "why".
      3. **Synthesize** using the Writing Style Guide below.

      ===== TOOL RULES =====
      
      - Prefer using variables identified in the [System Note].
      - If the user explicitly mentions a specific variable name, you may query it directly even if it's not in the System Note - these may be analysis-time variables.
      - If a variable is marked [QUALITATIVE], do NOT use the Quant tool on it.
      - If a variable is marked [QUANTITATIVE], do NOT use the Qual tool on it.

      ===== WRITING STYLE GUIDE =====
${this.getWritingStyleGuide()}

      ===== DRAFTING NOTES =====
      
      When appropriate (especially for complex requests), begin your response with a brief **[Drafting Notes]** section that:
      - Lists the data sources/variables you queried
      - Notes any data limitations or caveats
      - Outlines the structure you will follow
      
      Then proceed with the main content after a separator (---).
    `;

    // Build quantitative tool dynamically with extracted disaggregation values
    const querySurveyDataTool = buildQuantSurveyTool(this.disaggregationValues);
    const tools: Tool[] = [{ functionDeclarations: [querySurveyDataTool, queryQualitativeDataTool] }];

    this.chatSession = this.ai.chats.create({
      model: this.mainModel,
      config: {
        systemInstruction,
        tools,
      },
    });
  }

  /**
   * Updates the writing style and reinitializes the chat session.
   * This allows changing personas mid-conversation.
   */
  public updateWritingStyle(writingStyle: string, customStyleGuide?: string) {
    this.writingStyle = writingStyle;
    if (customStyleGuide !== undefined) {
      this.customStyleGuide = customStyleGuide;
    }
    console.log(`🎭 Updating writing style to: ${writingStyle}`);
    
    // Reinitialize the chat session with new style guide
    this.initAgents();
  }

  /**
   * Updates the AI model and reinitializes the chat session.
   * This allows changing models mid-conversation.
   */
  public updateModel(mainModel: string) {
    this.mainModel = mainModel;
    console.log(`🤖 Updating model to: ${mainModel}`);
    
    // Reinitialize the chat session with new model
    this.initAgents();
  }

  /**
   * Returns the initialization trace with disaggregation values and analysis-time variables.
   * This is used to display what data structure was discovered at initialization.
   */
  public getInitializationTrace() {
    return {
      disaggregationValues: this.disaggregationValues,
      analysisTimeVariables: this.analysisTimeVariables
    };
  }

  // --- Selector Agent (Unchanged logic, but now sees [QUALITATIVE] tags in context) ---
  private async identifyRelevantQuestions(userText: string): Promise<string[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: this.selectorModel,
        contents: `
          You are a **Questionnaire Selector Agent**.
          Map the User Request to relevant survey variables.
          
          **User Request:** "${userText}"

          **Available Variables:**
          ${this.questionContextString}
          
          **Task:**
          Return a JSON array of string variable names (exact matches only) that are relevant.
          Prioritize finding BOTH Quantitative and Qualitative variables if they exist for the topic.
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      const text = response.text;
      if (!text) return [];
      
      const rawVariables = JSON.parse(text) as string[];
      const validVars = rawVariables.filter(v => this.validQuestionNames.has(v));
      
      console.log("🔍 Selector Agent Identified Variables:", validVars);
      
      return validVars;
    } catch (e) {
      console.error("Selector Error:", e);
      return [];
    }
  }

  // --- Tool Execution: Quantitative ---
  private executeQuantQuery(question_name: string, disaggregation: string): any[] {
    console.log(`📊 Executing QUANT Query: ${question_name}, disaggregation: ${disaggregation}`);
    return this.results
      .filter(row => row.question === question_name && row.disaggregation === disaggregation)
      .map(row => ({
        answer: row.answer_option_eng || row.answer_option_tag,
        value: row.value,
        unit: row.indicator,
        sample_size: row.sample_size,
        // Include the group value if this is a disaggregated query
        group: disaggregation !== 'all' ? row[disaggregation] : 'all'
      }));
  }

  // --- Tool Execution: Qualitative ---
  private executeQualQuery(question_name: string): any {
    console.log(`📝 Executing QUAL Query: ${question_name}`);
    
    // 1. Get all rows for this question
    const rows = this.qualitativeData.filter(r => r.question === question_name);

    if (rows.length === 0) {
      return { message: "No qualitative analysis found for this variable." };
    }

    // 2. Find Executive Summary
    const execSummary = rows.find(r => r.theme === 'Executive Summary');

    // 3. Find Themes
    const themes = rows.filter(r => r.theme !== 'Executive Summary').map(t => ({
      theme: t.theme,
      prevalence: t.proportion_percent ? `${(Number(t.proportion_percent) * 100).toFixed(1)}%` : 'N/A',
      count: t.frequency,
      insight: t.summary,
      quotes: t.quotes ? t.quotes.split('\n---\n').map(q => q.trim()).filter(q => q) : []
    }));

    return {
      variable: question_name,
      overview: execSummary?.summary || "No executive summary available.",
      total_respondents: execSummary?.total_respondents,
      themes: themes
    };
  }

  // --- Main Message Handler ---
  public async sendMessage(
    userMessage: string, 
    signal?: AbortSignal,
    onProgress?: ProgressCallback
  ): Promise<{ text: string, dataUsed?: any[], trace?: TraceMetadata }> {
    try {
      // Check if already aborted
      if (signal?.aborted) {
        throw new DOMException('Request cancelled', 'AbortError');
      }

      const varTraceId = onProgress?.onStepStart("Identifying variables...");
      const relevantVars = await this.identifyRelevantQuestions(userMessage);
      
      if (varTraceId && onProgress) {
        onProgress.onStepComplete(varTraceId, { variables: relevantVars });
      }

      // Check again after identifyRelevantQuestions
      if (signal?.aborted) {
        throw new DOMException('Request cancelled', 'AbortError');
      }

      let messageToSend = userMessage;
      if (relevantVars.length > 0) {
        messageToSend = `${userMessage}\n\n[System Note: Relevant variables identified: ${relevantVars.join(', ')}. Decide whether to use Quant or Qual tools based on the variable type in your system instruction.]`;
      } else {
        messageToSend = `${userMessage}\n\n[System Note: No direct variables found. Ask for clarification if needed.]`;
      }
      
      // Create a promise that can be aborted
      const sendMessagePromise = this.chatSession.sendMessage({ message: messageToSend });

      // Race between the API call and abort signal
      let response;
      if (signal) {
        const abortPromise = new Promise<never>((_, reject) => {
          const abortHandler = () => {
            console.log('Abort signal received in service');
            reject(new DOMException('Request cancelled', 'AbortError'));
          };
          
          // Check if already aborted
          if (signal.aborted) {
            abortHandler();
          } else {
            signal.addEventListener('abort', abortHandler);
          }
        });
        
        response = await Promise.race([sendMessagePromise, abortPromise]);
      } else {
        response = await sendMessagePromise;
      }
      
      let functionCalls = response.functionCalls;
      let collectedData: any[] = [];
      let maxLoops = 5;

      while (functionCalls && functionCalls.length > 0 && maxLoops > 0) {
        // Process each function call with individual progress updates
        const parts: any[] = [];
        
        for (const call of functionCalls) {
          const args = call.args as any;
          const variableName = args.question_name || 'unknown';

          if (call.name === QUANT_TOOL_NAME) {
            const queryTraceId = onProgress?.onStepStart(
              `Querying: ${variableName} (quantitative)...`
            );
            
            const result = this.executeQuantQuery(args.question_name, args.disaggregation);
            collectedData.push({ query: args, result, type: 'Quantitative' });
            
            if (queryTraceId && onProgress) {
              onProgress.onStepComplete(queryTraceId, {
                query: {
                  questionName: args.question_name,
                  type: 'Quantitative',
                  disaggregation: args.disaggregation,
                  resultCount: result.length,
                  sampleSize: result[0]?.sample_size ? Number(result[0].sample_size) : undefined
                }
              });
            }
            
            parts.push({
              functionResponse: {
                name: call.name,
                response: { result: result },
                id: call.id
              }
            });
          } else if (call.name === QUAL_TOOL_NAME) {
            const queryTraceId = onProgress?.onStepStart(
              `Querying: ${variableName} (qualitative)...`
            );
            
            const result = this.executeQualQuery(args.question_name);
            collectedData.push({ query: args, result, type: 'Qualitative' });
            
            if (queryTraceId && onProgress) {
              onProgress.onStepComplete(queryTraceId, {
                query: {
                  questionName: args.question_name,
                  type: 'Qualitative',
                  resultCount: result.themes ? result.themes.length : 1,
                  sampleSize: result.total_respondents ? Number(result.total_respondents) : undefined
                }
              });
            }
            
            parts.push({
              functionResponse: {
                name: call.name,
                response: { result: result },
                id: call.id
              }
            });
          } else {
            parts.push({
              functionResponse: {
                name: call.name,
                response: { result: "Unknown tool" },
                id: call.id
              }
            });
          }
        }

        // Start thinking trace before API call
        const thinkingTraceId = onProgress?.onStepStart("Thinking...");
        
        // Race between the API call and abort signal for function calls too
        if (signal) {
          const abortPromise = new Promise<never>((_, reject) => {
            const abortHandler = () => {
              console.log('Abort signal received in service (function call loop)');
              reject(new DOMException('Request cancelled', 'AbortError'));
            };
            
            // Check if already aborted
            if (signal.aborted) {
              abortHandler();
            } else {
              signal.addEventListener('abort', abortHandler);
            }
          });
          
          response = await Promise.race([
            this.chatSession.sendMessage({ message: parts }),
            abortPromise
          ]);
        } else {
          response = await this.chatSession.sendMessage({ message: parts });
        }

        // Complete the thinking trace immediately after response
        if (thinkingTraceId && onProgress) {
          onProgress.onStepComplete(thinkingTraceId, {});
        }

        functionCalls = response.functionCalls;
        maxLoops--;
      }

      return {
        text: response.text || "Processed data but no text response generated.",
        dataUsed: collectedData,
        trace: {
          identifiedVariables: relevantVars,
          queriesExecuted: collectedData.map(d => ({
            type: d.type,
            questionName: d.query.question_name,
            disaggregation: d.query.disaggregation,
            resultCount: Array.isArray(d.result) ? d.result.length : (d.result.themes ? d.result.themes.length : 1),
            sampleSize: Array.isArray(d.result) && d.result[0]?.sample_size ? Number(d.result[0].sample_size) : undefined
          })),
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      // Re-throw AbortError so it can be handled by the caller
      if (error.name === 'AbortError') {
        console.log('AbortError caught in service, re-throwing');
        throw error;
      }
      console.error("Gemini Error:", error);
      return { text: "I encountered an error. Please check your data or try again." };
    }
  }
}