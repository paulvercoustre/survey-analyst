import React, { useState, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader';
import ChatMessageBubble from './components/ChatMessage';
import ProgressiveTraceComponent from './components/ProgressiveTrace';
import { parseCSV } from './utils/csv';
import { parseExcelResults, parseExcelQualitative } from './utils/excel';
import { SurveyAgent } from './services/geminiService';
import { QuestionnaireRow, ResultRow, QualitativeAnalysisRow, ChatMessage, FileType, ProgressiveTrace, ProgressCallback } from './types';

const App: React.FC = () => {
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireRow[] | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [qualitativeData, setQualitativeData] = useState<QualitativeAnalysisRow[] | null>(null);
  
  const [qFileName, setQFileName] = useState<string>("");
  const [rFileName, setRFileName] = useState<string>("");
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agent, setAgent] = useState<SurveyAgent | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [pendingInput, setPendingInput] = useState<string>("");
  const [progressiveTraces, setProgressiveTraces] = useState<ProgressiveTrace[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");
  const [selectedPersona, setSelectedPersona] = useState<string>("development_economist");
  const [customStyleGuide, setCustomStyleGuide] = useState<string>("");
  const [editingCustomStyleGuide, setEditingCustomStyleGuide] = useState<string>("");
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isInitialMount = useRef<boolean>(true);
  const isInitialModelMount = useRef<boolean>(true);
  const progressiveTracesRef = useRef<ProgressiveTrace[]>([]);
  const previousPersonaRef = useRef<string>(selectedPersona);

  const apiKey = process.env.API_KEY;

  // Available Gemini models
  const availableModels = [
    { value: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
    { value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-lite" },
  ];

  // Available writing personas
  const availablePersonas = [
    { value: "development_economist", label: "Development Economist", description: "UNDP/World Bank style with economic analysis" },
    { value: "policy_briefing", label: "Policy Briefing", description: "Concise, action-oriented, executive-friendly" },
    { value: "data_extractor", label: "Data Extractor", description: "Factual reporting without interpretation" },
    { value: "custom", label: "Custom...", description: "Define your own writing style" },
  ];

  // Initialize agent when files are loaded
  useEffect(() => {
    // We strictly need questionnaire and quantitative results. Qualitative is optional but recommended.
    if (questionnaire && results && apiKey && !agent) {
      console.log("Initializing Agent with model:", selectedModel, "and persona:", selectedPersona);
      
      // Collect initialization traces locally
      const initTraces: ProgressiveTrace[] = [];
      
      // Create progress callback for initialization
      const initProgressCallback: ProgressCallback = {
        onStepStart: (stepName: string) => {
          const id = `trace-${Date.now()}-${Math.random()}`;
          initTraces.push({
            id,
            status: 'loading',
            stepName,
            timestamp: Date.now()
          });
          return id;
        },
        onStepComplete: (traceId: string, details?: any) => {
          const trace = initTraces.find(t => t.id === traceId);
          if (trace) {
            let completedStepName = 'Step completed';
            
            if (trace.stepName.includes('disaggregation')) {
              completedStepName = 'Identified disaggregation levels';
            } else if (trace.stepName.includes('analysis-time')) {
              completedStepName = 'Identified analysis-time variables';
            }
            
            trace.status = 'completed';
            trace.stepName = completedStepName;
            trace.details = details;
          }
        }
      };
      
      // Pass qualitativeData (can be null/empty, handled in service)
      const newAgent = new SurveyAgent(
        apiKey, 
        results, 
        questionnaire, 
        qualitativeData || [],
        selectedModel,
        "gemini-3-flash-preview", // Selector model - keeping fast
        selectedPersona,
        customStyleGuide,
        initProgressCallback
      );
      setAgent(newAgent);
      
      const personaLabel = availablePersonas.find(p => p.value === selectedPersona)?.label || selectedPersona;
      addMessage({
        id: 'init',
        role: 'system',
        content: `I'm ready! I have analyzed the questionnaire, the quantitative data, and the qualitative themes. Using ${availableModels.find(m => m.value === selectedModel)?.label} with ${personaLabel} writing style. Ask me to write a report section, analyze challenges, or synthesize findings.`,
        traces: initTraces
      });
    }
  }, [questionnaire, results, qualitativeData, apiKey, agent, selectedModel, selectedPersona, customStyleGuide]);

  // Handle persona switching mid-conversation
  useEffect(() => {
    // Skip on initial mount to avoid duplicate message
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (agent && selectedPersona) {
      console.log("Persona changed to:", selectedPersona);
      agent.updateWritingStyle(selectedPersona, customStyleGuide);
      
      // Add a system message to notify the user
      const personaLabel = availablePersonas.find(p => p.value === selectedPersona)?.label || selectedPersona;
      addMessage({
        id: `persona-change-${Date.now()}`,
        role: 'system',
        content: `Writing style updated to: ${personaLabel}`
      });
    }
  }, [selectedPersona]); // Only trigger on persona change, not customStyleGuide

  // Handle model switching mid-conversation
  useEffect(() => {
    // Skip on initial mount to avoid duplicate message
    if (isInitialModelMount.current) {
      isInitialModelMount.current = false;
      return;
    }

    if (agent && selectedModel) {
      console.log("Model changed to:", selectedModel);
      agent.updateModel(selectedModel);
      
      // Add a system message to notify the user
      const modelLabel = availableModels.find(m => m.value === selectedModel)?.label || selectedModel;
      addMessage({
        id: `model-change-${Date.now()}`,
        role: 'system',
        content: `AI model updated to: ${modelLabel}`
      });
    }
  }, [selectedModel]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  };

  // Progressive trace management functions
  const addTrace = (stepName: string): string => {
    const id = `trace-${Date.now()}-${Math.random()}`;
    
    // Update ref synchronously FIRST to avoid race conditions
    const newTrace = {
      id,
      status: 'loading' as const,
      stepName,
      timestamp: Date.now()
    };
    const newTraces = [...progressiveTracesRef.current, newTrace];
    progressiveTracesRef.current = newTraces;
    
    // Then update state for UI
    setProgressiveTraces(newTraces);
    
    return id;
  };

  const updateTrace = (id: string, updates: Partial<ProgressiveTrace>) => {
    // Update ref synchronously FIRST
    const newTraces = progressiveTracesRef.current.map(t => 
      t.id === id ? { ...t, ...updates } : t
    );
    progressiveTracesRef.current = newTraces;
    
    // Then update state for UI
    setProgressiveTraces(newTraces);
  };

  const clearTraces = () => {
    setProgressiveTraces([]);
    progressiveTracesRef.current = [];
  };

  const handleFileSelect = async (type: FileType, file: File) => {
    try {
      if (type === FileType.QUESTIONNAIRE) {
        // Parse CSV
        const text = await readFileAsText(file);
        const parsed = parseCSV<QuestionnaireRow>(text);
        setQuestionnaire(parsed);
        setQFileName(file.name);
      } else {
        // Parse Excel
        const buffer = await readFileAsArrayBuffer(file);
        
        // 1. Quant Data (Sheet 1)
        const parsedResults = parseExcelResults(buffer);
        setResults(parsedResults);

        // 2. Qual Data (Sheet 2) - Attempt to parse, safe fail if empty
        try {
          const parsedQual = parseExcelQualitative(buffer);
          if (parsedQual && parsedQual.length > 0) {
            setQualitativeData(parsedQual);
            console.log(`Loaded ${parsedQual.length} rows of qualitative data.`);
          } else {
            console.warn("No qualitative data found in second sheet.");
            setQualitativeData([]);
          }
        } catch (qualError) {
          console.warn("Could not parse qualitative data (Sheet 2 might be missing).", qualError);
          setQualitativeData([]);
        }

        setRFileName(file.name);
      }
    } catch (e) {
      console.error(e);
      alert(`Error parsing file: ${file.name}. Please check the format.`);
    }
  };

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const handleSend = async () => {
    if (!input.trim() || !agent || isProcessing) return;

    const userText = input;
    console.log('handleSend: saving userText:', userText);
    setPendingInput(userText);
    setInput(""); // Clear the input immediately
    setIsProcessing(true);
    const controller = new AbortController();
    setAbortController(controller);

    addMessage({ id: Date.now().toString(), role: 'user', content: userText });

    // Create progress callback for real-time traces
    const progressCallback: ProgressCallback = {
      onStepStart: (stepName: string) => addTrace(stepName),
      onStepComplete: (traceId: string, details?: any) => {
        // Update ref FIRST (synchronously), then update state
        const currentTraces = progressiveTracesRef.current;
        const trace = currentTraces.find(t => t.id === traceId);
        let completedStepName = 'Step completed';
        
        if (trace) {
          if (trace.stepName.includes('Identifying')) {
            completedStepName = 'Identified variables';
          } else if (trace.stepName.includes('Querying')) {
            completedStepName = `Queried: ${details?.query?.questionName || 'data'}`;
          } else if (trace.stepName.includes('Thinking')) {
            completedStepName = 'Thought';
          }
        }
        
        const newTraces = currentTraces.map(t => 
          t.id === traceId 
            ? { ...t, status: 'completed' as const, stepName: completedStepName, details } 
            : t
        );
        
        // Update ref synchronously FIRST
        progressiveTracesRef.current = newTraces;
        
        // Then update state for UI
        setProgressiveTraces(newTraces);
      }
    };

    try {
      const response = await agent.sendMessage(userText, controller.signal, progressCallback);

      // Use ref to get current traces (avoids closure issues)
      const capturedTraces = [...progressiveTracesRef.current];
      console.log('Captured traces for message:', capturedTraces.length, 'traces -', capturedTraces.map(t => t.stepName));
      
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response.text,
        traces: capturedTraces
      });
      
      clearTraces();
      setPendingInput("");
    } catch (error: any) {
      console.log('Error caught in handleSend:', error.name, error.message, 'pendingInput:', userText);
      if (error.name === 'AbortError') {
        // Request was cancelled, remove the user message and restore input
        console.log('Restoring input with:', userText);
        setMessages(prev => prev.slice(0, -1));
        setInput(userText); // Use the captured userText instead of pendingInput state
        setPendingInput("");
        clearTraces(); // Clear traces on cancel
      } else {
        // Other error occurred
        console.log('Other error:', error);
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `Error: ${error.message}`
        });
        setPendingInput("");
        clearTraces(); // Clear traces on error
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCancel = () => {
    console.log('Cancel clicked, pendingInput:', pendingInput);
    if (abortController) {
      console.log('Aborting controller');
      abortController.abort();
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 160; // 10rem = 160px
      const minHeight = 56; // 3.5rem = 56px
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  if (!apiKey) {
      return <div className="flex items-center justify-center h-screen bg-slate-50 text-red-500 font-semibold">API Key Missing</div>
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar for Setup */}
      <div className="w-80 bg-slate-50 border-r border-slate-200 flex flex-col p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">SurveyBot</h1>
        <p className="text-slate-500 text-sm mb-6">Upload your Kobo data to generate report content.</p>

        {/* Model Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            AI Model
          </label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {availableModels.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Can be changed anytime
          </p>
        </div>

        {/* Persona Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Writing Style
          </label>
          <select
            value={selectedPersona}
            onChange={(e) => {
              const newPersona = e.target.value;
              if (newPersona === 'custom') {
                // Save current persona before opening modal
                previousPersonaRef.current = selectedPersona;
                // Load current custom style into editing state
                setEditingCustomStyleGuide(customStyleGuide);
                setShowCustomModal(true);
              } else {
                previousPersonaRef.current = newPersona;
                setSelectedPersona(newPersona);
              }
            }}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {availablePersonas.map((persona) => (
              <option key={persona.value} value={persona.value}>
                {persona.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            {availablePersonas.find(p => p.value === selectedPersona)?.description || 'Can be changed anytime'}
          </p>
        </div>

        <FileUploader 
          label="1. Questionnaire (CSV)"
          accept=".csv"
          isLoaded={!!questionnaire}
          fileName={qFileName}
          onFileSelect={(f) => handleFileSelect(FileType.QUESTIONNAIRE, f)}
        />

        <FileUploader 
          label="2. Survey Results (Excel)"
          accept=".xlsx, .xls"
          isLoaded={!!results}
          fileName={rFileName}
          onFileSelect={(f) => handleFileSelect(FileType.RESULTS, f)}
        />

        {questionnaire && results && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <h3 className="font-semibold text-blue-800 text-sm mb-1">Data Loaded</h3>
            <div className="text-xs text-blue-600 space-y-1">
              <p>Variables: {questionnaire.length}</p>
              <p>Quant Rows: {results.length}</p>
              <p>Qual Rows: {qualitativeData?.length || 0}</p>
            </div>
            {agent && (
              <button
                onClick={() => {
                  setAgent(null);
                  setMessages([]);
                }}
                className="mt-3 w-full px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors"
              >
                Clear Chat History
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        {!agent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">Please upload files to start</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <div className="max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <ChatMessageBubble key={msg.id} message={msg} />
                ))}
                {/* Show active progressive traces (during processing) */}
                {progressiveTraces.length > 0 && (
                  <div className="mb-6">
                    {progressiveTraces.map((trace) => (
                      <ProgressiveTraceComponent key={trace.id} trace={trace} />
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-4 bg-white border-t border-slate-100">
              <div className="max-w-3xl mx-auto relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about the survey..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none overflow-y-auto"
                  style={{ height: '56px' }}
                />
                <button
                  onClick={isProcessing ? handleCancel : handleSend}
                  disabled={isProcessing ? false : !input.trim() || isProcessing}
                  className={`absolute right-2 bottom-3 p-2 text-white rounded-lg transition-colors ${
                    isProcessing
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
                  }`}
                >
                  {isProcessing ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">
                AI can make mistakes. Verify important information.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Custom Style Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Custom Writing Style</h2>
              <p className="text-sm text-slate-500 mt-1">
                Define your own writing style guide. This will replace the "Writing Style Guide" section in the system prompt.
              </p>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Writing Style Instructions
              </label>
              <textarea
                value={editingCustomStyleGuide}
                onChange={(e) => setEditingCustomStyleGuide(e.target.value)}
                placeholder={`Example structure:

**1. Tone and Voice**
- Use conversational language
- Address the reader directly

**2. Structure**
- Start with key findings
- Follow with supporting data
- End with implications

**3. Data Presentation**
- Lead with percentages
- Use bullet points for lists
- Include relevant quotes

Add your custom instructions here...`}
                className="w-full h-96 px-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none font-mono"
              />
              <p className="text-xs text-slate-400 mt-2">
                Tip: Focus on tone, structure, and how to present data. The system will handle data fetching automatically.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  // Revert to previous persona on cancel (don't save editing changes)
                  setSelectedPersona(previousPersonaRef.current);
                  setShowCustomModal(false);
                }}
                className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (editingCustomStyleGuide.trim()) {
                    // Apply the custom style guide
                    setCustomStyleGuide(editingCustomStyleGuide);
                    previousPersonaRef.current = 'custom';
                    setSelectedPersona('custom');
                    setShowCustomModal(false);
                  } else {
                    alert('Please enter a custom style guide or click Cancel');
                  }
                }}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                Save Custom Style
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;