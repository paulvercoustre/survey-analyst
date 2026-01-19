import React, { useState, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader';
import ChatMessageBubble from './components/ChatMessage';
import { parseCSV } from './utils/csv';
import { parseExcelResults, parseExcelQualitative } from './utils/excel';
import { SurveyAgent } from './services/geminiService';
import { QuestionnaireRow, ResultRow, QualitativeAnalysisRow, ChatMessage, FileType } from './types';

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
  const [processingStage, setProcessingStage] = useState<string>("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const apiKey = process.env.API_KEY;

  // Initialize agent when files are loaded
  useEffect(() => {
    // We strictly need questionnaire and quantitative results. Qualitative is optional but recommended.
    if (questionnaire && results && apiKey && !agent) {
      console.log("Initializing Agent...");
      // Pass qualitativeData (can be null/empty, handled in service)
      const newAgent = new SurveyAgent(apiKey, results, questionnaire, qualitativeData || []);
      setAgent(newAgent);
      addMessage({
        id: 'init',
        role: 'system',
        content: "I'm ready! I have analyzed the questionnaire, the quantitative data, and the qualitative themes. Ask me to write a report section, analyze challenges, or synthesize findings."
      });
    }
  }, [questionnaire, results, qualitativeData, apiKey, agent]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
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

    try {
      const response = await agent.sendMessage(userText, controller.signal, setProcessingStage);
      console.log('Response received successfully');
      setProcessingStage("");

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response.text,
        relatedData: response.dataUsed
      });
      
      // Only clear pending input on success
      setPendingInput("");
    } catch (error: any) {
      console.log('Error caught in handleSend:', error.name, error.message, 'pendingInput:', userText);
      if (error.name === 'AbortError') {
        // Request was cancelled, remove the user message and restore input
        console.log('Restoring input with:', userText);
        setMessages(prev => prev.slice(0, -1));
        setInput(userText); // Use the captured userText instead of pendingInput state
        setPendingInput("");
      } else {
        // Other error occurred
        console.log('Other error:', error);
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `Error: ${error.message}`
        });
        setPendingInput("");
      }
    } finally {
      setIsProcessing(false);
      setAbortController(null);
      setProcessingStage("");
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
        <p className="text-slate-500 text-sm mb-8">Upload your Kobo data to generate report content.</p>

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
                {isProcessing && (
                  <div className="flex justify-start animate-pulse mb-6">
                    <div className="bg-slate-100 rounded-2xl rounded-bl-none px-5 py-3 text-sm text-slate-500">
                      {processingStage || "Thinking..."}
                    </div>
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
    </div>
  );
};

export default App;