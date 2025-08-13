import React, { useState, useRef } from 'react'
import { Toolbar } from './components/Toolbar'
import { LayerPanel } from './components/LayerPanel'
import { Canvas } from './components/Canvas'
import { FilterPanel } from './components/FilterPanel'
import { AIPanel } from './components/AIPanel'
import { useImageEditor } from './hooks/useImageEditor'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setShowDownloadMenu(false)
    if (showDownloadMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showDownloadMenu])
  const {
    layers,
    activeLayer,
    tool,
    setTool,
    addLayer,
    deleteLayer,
    setActiveLayer,
    undo,
    redo,
    canUndo,
    canRedo,
    openImage,
    saveImage,
    applyFilter,
    updateLayer,
    updateLayerProps,
    moveLayer,
    moveLayerPosition
  } = useImageEditor()

  const downloadImage = (format: string) => {
    if (!activeLayer) return
    
    const activeLayerData = layers.find(layer => layer.id === activeLayer)
    if (!activeLayerData || !activeLayerData.imageData) return
    
    // Find the actual image bounds (non-transparent pixels)
    const imageData = activeLayerData.imageData
    const data = imageData.data
    let minX = imageData.width, minY = imageData.height, maxX = 0, maxY = 0
    
    for (let y = 0; y < imageData.height; y++) {
      for (let x = 0; x < imageData.width; x++) {
        const i = (y * imageData.width + x) * 4
        const alpha = data[i + 3]
        
        if (alpha > 0) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }
    
    if (minX >= maxX || minY >= maxY) return
    
    const width = maxX - minX + 1
    const height = maxY - minY + 1
    
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    
    // Only add white background for JPG
    if (format === 'jpg') {
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, width, height)
    }
    
    // Extract only the image content area
    const croppedImageData = ctx.createImageData(width, height)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIndex = ((minY + y) * imageData.width + (minX + x)) * 4
        const destIndex = (y * width + x) * 4
        
        croppedImageData.data[destIndex] = data[srcIndex]
        croppedImageData.data[destIndex + 1] = data[srcIndex + 1]
        croppedImageData.data[destIndex + 2] = data[srcIndex + 2]
        croppedImageData.data[destIndex + 3] = data[srcIndex + 3]
      }
    }
    
    ctx.putImageData(croppedImageData, 0, 0)
    
    const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${activeLayerData.name}.${format}`
        a.click()
        URL.revokeObjectURL(url)
      }
    }, mimeType)
    
    setShowDownloadMenu(false)
  }

  // Auto-create first layer
  React.useEffect(() => {
    if (layers.length === 0) {
      addLayer()
    }
  }, [layers.length, addLayer])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-dark border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center">
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 160 143" 
                className="fill-current text-blue-400"
              >
                <g transform="translate(0,143) scale(0.1,-0.1)">
                  <path d="M674 1321 l-321 -6 -40 -27 c-54 -36 -89 -82 -103 -138 -7 -31 -10
-175 -8 -455 3 -398 4 -411 25 -450 25 -47 64 -85 113 -111 32 -18 68 -19 443
-22 451 -3 478 -1 548 57 20 17 47 52 60 78 l24 48 0 415 c0 460 0 463 -64
533 -76 85 -111 89 -677 78z m-24 -276 l0 -25 -105 0 -105 0 0 -75 0 -75 -30
0 -30 0 0 100 0 100 135 0 135 0 0 -25z m408 -133 l-143 -141 70 -71 c42 -42
65 -73 60 -78 -8 -7 -551 -227 -615 -249 -8 -3 49 59 128 138 78 79 142 149
142 154 0 6 -27 37 -60 70 -33 33 -59 64 -57 68 3 9 609 258 615 253 1 -2 -62
-66 -140 -144z m180 -459 l3 -103 -136 0 -135 0 0 25 c0 24 1 24 103 27 l102
3 3 65 c3 83 7 92 34 88 22 -3 23 -8 26 -105z"/>
                </g>
              </svg>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Creaza
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openImage}
              className="glass-button px-4 py-2 rounded-lg text-sm font-medium"
            >
              Open Image
            </button>
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowDownloadMenu(!showDownloadMenu)
                }}
                className="glass-button px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
              >
                Download
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Left Sidebar - Tools */}
        <aside className="w-16 glass-dark border-r border-white/10">
          <Toolbar 
            activeTool={tool} 
            onToolChange={setTool}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
          />
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 p-4">
          <div className="h-full canvas-container">
            <Canvas
              ref={canvasRef}
              layers={layers}
              activeLayer={activeLayer}
              tool={tool}
              onLayerUpdate={updateLayer}
              onMoveLayer={moveLayerPosition}
              onSelectLayer={setActiveLayer}
            />
          </div>
        </main>

        {/* Right Sidebar - Layers, Filters & AI */}
        <aside className="w-80 glass-dark border-l border-white/10 flex flex-col">
          <div className="flex-1">
            <LayerPanel
              layers={layers}
              activeLayer={activeLayer}
              onAddLayer={addLayer}
              onDeleteLayer={deleteLayer}
              onSetActiveLayer={setActiveLayer}
              onUpdateLayer={updateLayerProps}
              onMoveLayer={moveLayer}
            />
          </div>
          <div className="flex-1 border-t border-white/10">
            <FilterPanel onApplyFilter={applyFilter} />
          </div>
          <div className="flex-1 border-t border-white/10">
            <AIPanel onAIProcess={async (type, file) => {
              console.log('AI Process:', type, file)
              // Implement AI processing
            }} />
          </div>
        </aside>
      </div>
      
      {/* Download dropdown portal */}
      {showDownloadMenu && (
        <div 
          className="fixed inset-0 z-[99999]"
          onClick={() => setShowDownloadMenu(false)}
        >
          <div 
            className="absolute top-16 right-4 bg-white border border-gray-200 rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => downloadImage('png')} className="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-t-lg">
              PNG
            </button>
            <button onClick={() => downloadImage('jpg')} className="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100">
              JPG
            </button>
            <button onClick={() => downloadImage('webp')} className="block w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded-b-lg">
              WebP
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App