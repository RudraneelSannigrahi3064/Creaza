import React, { useState } from 'react'
import { Bot, Scissors, Palette, Sparkles, Upload } from 'lucide-react'

interface AIPanelProps {
  onAIProcess: (type: string, file?: File) => void
}

export function AIPanel({ onAIProcess }: AIPanelProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleAIProcess = async (type: string) => {
    if (!selectedFile && type !== 'enhance') return
    
    setIsProcessing(true)
    try {
      await onAIProcess(type, selectedFile || undefined)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Bot className="text-purple-400" size={20} />
        <h3 className="text-lg font-semibold">AI Features</h3>
      </div>

      {/* File Upload */}
      <div className="glass p-4 rounded-lg">
        <label className="block text-sm font-medium mb-2">
          Upload Image for AI Processing
        </label>
        <div className="relative">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="ai-file-input"
          />
          <label
            htmlFor="ai-file-input"
            className="glass-button w-full p-3 rounded-lg cursor-pointer flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
          >
            <Upload size={16} />
            {selectedFile ? selectedFile.name : 'Choose Image'}
          </label>
        </div>
      </div>

      {/* AI Tools */}
      <div className="space-y-3">
        <button
          onClick={() => handleAIProcess('remove-background')}
          disabled={!selectedFile || isProcessing}
          className={`w-full glass-button p-3 rounded-lg flex items-center gap-3 transition-all ${
            !selectedFile || isProcessing 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-white/20'
          }`}
        >
          <Scissors className="text-blue-400" size={16} />
          <div className="text-left">
            <div className="font-medium">Remove Background</div>
            <div className="text-xs text-white/70">AI-powered background removal</div>
          </div>
        </button>

        <button
          onClick={() => handleAIProcess('style-transfer')}
          disabled={!selectedFile || isProcessing}
          className={`w-full glass-button p-3 rounded-lg flex items-center gap-3 transition-all ${
            !selectedFile || isProcessing 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-white/20'
          }`}
        >
          <Palette className="text-pink-400" size={16} />
          <div className="text-left">
            <div className="font-medium">Style Transfer</div>
            <div className="text-xs text-white/70">Apply artistic styles</div>
          </div>
        </button>

        <button
          onClick={() => handleAIProcess('enhance')}
          disabled={isProcessing}
          className={`w-full glass-button p-3 rounded-lg flex items-center gap-3 transition-all ${
            isProcessing 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-white/20'
          }`}
        >
          <Sparkles className="text-yellow-400" size={16} />
          <div className="text-left">
            <div className="font-medium">Enhance Image</div>
            <div className="text-xs text-white/70">AI-powered enhancement</div>
          </div>
        </button>
      </div>

      {/* Style Transfer Options */}
      <div className="glass p-3 rounded-lg">
        <label className="block text-sm font-medium mb-2">Style Options</label>
        <select className="w-full glass-input px-3 py-2 rounded text-sm">
          <option value="artistic">Artistic</option>
          <option value="cartoon">Cartoon</option>
          <option value="oil_painting">Oil Painting</option>
          <option value="watercolor">Watercolor</option>
        </select>
      </div>

      {/* Processing Status */}
      {isProcessing && (
        <div className="glass p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            <span className="text-sm">Processing with AI...</span>
          </div>
        </div>
      )}

      {/* AI Service Status */}
      <div className="glass p-3 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm">AI Service</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">Connected</span>
          </div>
        </div>
      </div>
    </div>
  )
}