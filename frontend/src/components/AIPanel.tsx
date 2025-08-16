import React, { useState } from 'react'
import { Bot, Scissors, Palette, Sparkles, Upload, Wand2, MessageSquare } from 'lucide-react'

interface AIPanelProps {
  onAIProcess: (type: string, file?: File, prompt?: string, size?: string) => void
}

export function AIPanel({ onAIProcess }: AIPanelProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [textPrompt, setTextPrompt] = useState('')
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [imageSize, setImageSize] = useState('512x512')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleAIProcess = async (type: string) => {
    if (!selectedFile && type !== 'enhance' && type !== 'text-to-image') return
    if (type === 'text-to-image' && !textPrompt.trim()) return
    
    setIsProcessing(true)
    setProgress(0)
    
    try {
      if (type === 'text-to-image') {
        setProgressMessage('Loading AI model...')
        setProgress(20)
        
        // Simulate progress for text-to-image
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev < 80) return prev + 5
            return prev
          })
        }, 500)
        
        await onAIProcess(type, selectedFile || undefined, textPrompt, imageSize)
        
        clearInterval(progressInterval)
        setProgress(100)
        setProgressMessage('Image generated successfully!')
        
        setTimeout(() => {
          setProgress(0)
          setProgressMessage('')
        }, 2000)
      } else {
        setProgressMessage('Processing image...')
        setProgress(50)
        await onAIProcess(type, selectedFile || undefined, textPrompt)
        setProgress(100)
        setProgressMessage('Processing complete!')
        
        setTimeout(() => {
          setProgress(0)
          setProgressMessage('')
        }, 1000)
      }
    } catch (error) {
      setProgressMessage('Processing failed')
      console.error('AI processing error:', error)
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

      {/* Text to Image Generation */}
      <div className="glass p-4 rounded-lg border border-purple-400/20">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 className="text-purple-400" size={18} />
          <label className="block text-sm font-medium">
            OpenJourney Text to Image
          </label>
        </div>
        <textarea
          value={textPrompt}
          onChange={(e) => setTextPrompt(e.target.value)}
          placeholder="Describe the image you want to generate... (e.g., 'a beautiful sunset over mountains, digital art')" 
          className="w-full glass-input px-3 py-2 rounded text-sm h-20 resize-none mb-3"
        />
        <div className="mb-3">
          <label className="block text-xs font-medium mb-1">Image Size</label>
          <select 
            value={imageSize} 
            onChange={(e) => setImageSize(e.target.value)}
            className="w-full glass-input px-3 py-2 rounded text-sm"
          >
            <option value="512x512">512x512 (Square)</option>
            <option value="768x512">768x512 (Landscape)</option>
            <option value="512x768">512x768 (Portrait)</option>
            <option value="1024x512">1024x512 (Wide)</option>
            <option value="512x1024">512x1024 (Tall)</option>
          </select>
        </div>
        <button
          onClick={() => handleAIProcess('text-to-image')}
          disabled={!textPrompt.trim() || isProcessing}
          className={`w-full glass-button p-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
            !textPrompt.trim() || isProcessing 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-purple-500/20 border-purple-400/30'
          }`}
        >
          <Wand2 size={16} />
          <span className="font-medium">
            {isProcessing ? 'Generating...' : 'Generate Image'}
          </span>
        </button>
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

        <button
          onClick={() => handleAIProcess('generate-caption')}
          disabled={!selectedFile || isProcessing}
          className={`w-full glass-button p-3 rounded-lg flex items-center gap-3 transition-all ${
            !selectedFile || isProcessing 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:bg-white/20'
          }`}
        >
          <MessageSquare className="text-green-400" size={16} />
          <div className="text-left">
            <div className="font-medium">Generate Caption</div>
            <div className="text-xs text-white/70">AI image captioning</div>
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
        <div className="glass p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            <span className="text-sm">{progressMessage || 'Processing with AI...'}</span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-white/10 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-blue-400 to-purple-400 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          
          <div className="text-xs text-white/70 mt-1 text-center">
            {progress}%
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