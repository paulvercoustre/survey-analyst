import React, { useState } from 'react';
import { ProgressiveTrace as ProgressiveTraceType } from '../types';

interface Props {
  trace: ProgressiveTraceType;
}

const ProgressiveTrace: React.FC<Props> = ({ trace }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLoading = trace.status === 'loading';

  return (
    <div className="mb-1 max-w-[85%]">
      {/* Main trace line - just text, no box */}
      <div className="flex items-center gap-2 px-1 py-0.5 text-xs">
        {isLoading ? (
          <>
            {/* Loading spinner */}
            <svg 
              className="animate-spin h-3 w-3 text-slate-400" 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24"
            >
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-slate-500 italic">{trace.stepName}</span>
          </>
        ) : (
          <>
            {/* Completed state with toggle */}
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 flex-1 text-left hover:text-slate-600 transition-colors"
            >
              <svg 
                className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-slate-500">{trace.stepName}</span>
              
              {/* Show summary when collapsed - with better detail visibility */}
              {!isExpanded && trace.details && (
                <span className="text-slate-400 ml-1">
                  {trace.details.variables && `(${trace.details.variables.length} variables)`}
                  {trace.details.disaggregationLevels && `(${trace.details.disaggregationLevels.length} levels)`}
                  {trace.details.query && `(${trace.details.query.resultCount} results)`}
                </span>
              )}
            </button>
          </>
        )}
      </div>
      
      {/* Expanded details - minimal styling */}
      {isExpanded && !isLoading && trace.details && (
        <div className="mt-1 ml-5 pl-3 border-l-2 border-slate-200 text-xs">
          {trace.details.disaggregationLevels && (
            <div className="mb-2 text-slate-600">
              <span className="font-medium">Levels: </span>
              {trace.details.disaggregationLevels.map((level, idx) => (
                <span key={idx}>
                  <span className="font-mono text-slate-700">{level}</span>
                  {idx < trace.details.disaggregationLevels!.length - 1 && ', '}
                </span>
              ))}
            </div>
          )}
          
          {trace.details.variables && (
            <div className="mb-2 text-slate-600">
              <span className="font-medium">Variables: </span>
              {trace.details.variables.map((variable, idx) => (
                <span key={idx}>
                  <span className="font-mono text-slate-700">{variable}</span>
                  {idx < trace.details.variables!.length - 1 && ', '}
                </span>
              ))}
            </div>
          )}
          
          {trace.details.query && (
            <div className="text-slate-600">
              <span className="font-mono font-medium text-slate-700">{trace.details.query.questionName}</span>
              <span className="text-slate-500"> • </span>
              <span className={trace.details.query.type === 'Quantitative' ? 'text-purple-600' : 'text-green-600'}>
                {trace.details.query.type}
              </span>
              {trace.details.query.disaggregation && (
                <>
                  <span className="text-slate-500"> • </span>
                  <span>Disagg: <span className="font-mono">{trace.details.query.disaggregation}</span></span>
                </>
              )}
              <span className="text-slate-500"> • </span>
              <span>{trace.details.query.resultCount} results</span>
              {trace.details.query.sampleSize && (
                <>
                  <span className="text-slate-500"> • </span>
                  <span>n={trace.details.query.sampleSize}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressiveTrace;
