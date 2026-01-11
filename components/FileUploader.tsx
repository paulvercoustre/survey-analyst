import React, { useRef } from 'react';

interface FileUploaderProps {
  label: string;
  accept: string;
  onFileSelect: (file: File) => void;
  isLoaded: boolean;
  fileName?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ label, accept, onFileSelect, isLoaded, fileName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col mb-4 w-full">
      <label className="text-sm font-medium text-slate-600 mb-1">{label}</label>
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex items-center justify-between p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${isLoaded 
            ? 'border-green-400 bg-green-50' 
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }
        `}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept={accept}
          onChange={handleFileChange}
        />
        
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isLoaded ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
            {isLoaded ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            )}
          </div>
          <div className="flex flex-col">
            <span className={`text-sm font-semibold ${isLoaded ? 'text-green-800' : 'text-slate-700'}`}>
              {isLoaded ? 'File Loaded' : 'Upload File'}
            </span>
            <span className="text-xs text-slate-500 max-w-[200px] truncate">
              {fileName || 'Click to browse...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUploader;