import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Tool } from './Toolbar'

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number
  blendMode: string
  imageData?: ImageData
  originalImageData?: ImageData
  filters?: Record<string, number>
}

interface CanvasProps {
  layers: Layer[]
  activeLayer: string | null
  tool: Tool
  onLayerUpdate?: (layerId: string, imageData: ImageData) => void
}

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  ({ layers, activeLayer, tool, onLayerUpdate }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
    const isDrawingRef = useRef(false)
    const [brushSize, setBrushSize] = React.useState(10)
    const [brushColor, setBrushColor] = React.useState('#ff0000')
    const [cropStart, setCropStart] = React.useState<{ x: number; y: number } | null>(null)
    const [cropEnd, setCropEnd] = React.useState<{ x: number; y: number } | null>(null)
    const [isCropping, setIsCropping] = React.useState(false)
    const [showCropConfirm, setShowCropConfirm] = React.useState(false)
    const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(null)
    const [imagePosition, setImagePosition] = React.useState({ x: 0, y: 0 })
    const [canvasOffset, setCanvasOffset] = React.useState({ x: 0, y: 0 })

    const [fontSize, setFontSize] = React.useState(20)
    const [textValue, setTextValue] = React.useState('')

    const [scale, setScale] = React.useState(1)
    const [imageScale, setImageScale] = React.useState(1)

    useImperativeHandle(ref, () => canvasRef.current!)

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      ctxRef.current = ctx
      
      // Set canvas size to fit screen
      const container = canvas.parentElement
      if (container) {
        canvas.width = container.clientWidth - 50
        canvas.height = container.clientHeight - 50
      }
      
      // Fill with white background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }, [])

    useEffect(() => {
      // Render all visible layers
      const canvas = canvasRef.current
      const ctx = ctxRef.current
      if (!canvas || !ctx) return

      // Clear canvas first
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Render only the active layer
      const activeLayerData = layers.find(layer => layer.id === activeLayer)
      if (activeLayerData && activeLayerData.visible && activeLayerData.imageData) {
        try {
          // Create temp canvas for layer with opacity
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = activeLayerData.imageData.width
          tempCanvas.height = activeLayerData.imageData.height
          const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })!
          tempCtx.putImageData(activeLayerData.imageData, 0, 0)
          
          // Apply opacity and blend mode
          ctx.globalAlpha = activeLayerData.opacity
          ctx.globalCompositeOperation = activeLayerData.blendMode as GlobalCompositeOperation
          ctx.drawImage(tempCanvas, 0, 0)
        } catch (e) {
          console.log('ImageData size mismatch for layer:', activeLayerData.name)
        }
      }
      
      // Reset context settings
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }, [layers, activeLayer])

    const getMousePos = (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      
      const rect = canvas.getBoundingClientRect()
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      }
    }

    const handleMouseDown = (e: React.MouseEvent) => {
      const pos = getMousePos(e)
      const ctx = ctxRef.current

      if (!ctx) return

      isDrawingRef.current = true

      if (tool === 'brush' || tool === 'eraser') {
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
        
        if (tool === 'brush') {
          ctx.globalCompositeOperation = 'source-over'
          ctx.strokeStyle = brushColor
        } else {
          ctx.globalCompositeOperation = 'destination-out'
        }
        
        ctx.lineWidth = brushSize
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        

      } else if (tool === 'crop') {
        setIsCropping(true)
        setCropStart(pos)
        setCropEnd(pos)
      } else if (tool === 'move') {
        setDragStart(pos)
      } else if (tool === 'pan') {
        setDragStart(pos)
      } else if (tool === 'text' && textValue.trim()) {
        // Add text directly to canvas
        ctx.font = `${fontSize}px Arial`
        ctx.fillStyle = brushColor
        ctx.fillText(textValue, pos.x, pos.y)
        
        if (activeLayer && onLayerUpdate) {
          const canvas = canvasRef.current!
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          onLayerUpdate(activeLayer, imageData)
        }
      }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
      const pos = getMousePos(e)
      const ctx = ctxRef.current
      if (!ctx) return

      if (isDrawingRef.current) {
        if (tool === 'brush' || tool === 'eraser') {
          ctx.lineTo(pos.x, pos.y)
          ctx.stroke()

        } else if (tool === 'crop' && isCropping && cropStart) {
          setCropEnd(pos)
        } else if (tool === 'pan' && dragStart) {
          const deltaX = pos.x - dragStart.x
          const deltaY = pos.y - dragStart.y
          setCanvasOffset(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY
          }))
          setDragStart(pos)
        } else if (tool === 'move' && dragStart && activeLayer) {
          const deltaX = pos.x - dragStart.x
          const deltaY = pos.y - dragStart.y
          
          const newX = imagePosition.x + deltaX
          const newY = imagePosition.y + deltaY
          
          setImagePosition({ x: newX, y: newY })
          setDragStart(pos)
          
          // Move the image content
          const canvas = canvasRef.current!
          const ctx = ctxRef.current!
          const activeLayerData = layers.find(l => l.id === activeLayer)
          
          if (activeLayerData?.imageData) {
            // Clear canvas
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // Draw image at new position
            ctx.putImageData(activeLayerData.imageData, newX, newY)
          }
        }
      }
    }

    const handleMouseUp = () => {
      const canvas = canvasRef.current
      const ctx = ctxRef.current
      if (!canvas || !ctx) return

      isDrawingRef.current = false
      
      if (tool === 'brush' || tool === 'eraser') {
        ctx.closePath()
        
        // Update layer with current canvas data
        if (activeLayer && onLayerUpdate) {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          onLayerUpdate(activeLayer, imageData)
        }
      } else if (tool === 'crop' && cropStart && cropEnd) {
        const width = Math.abs(cropEnd.x - cropStart.x)
        const height = Math.abs(cropEnd.y - cropStart.y)
        
        if (width > 10 && height > 10) {
          setShowCropConfirm(true)
        } else {
          setIsCropping(false)
          setCropStart(null)
          setCropEnd(null)
        }
      } else if (tool === 'pan') {
        setDragStart(null)
      } else if (tool === 'move' && activeLayer) {
        // Update layer with new position
        const canvas = canvasRef.current!
        const ctx = ctxRef.current!
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        if (onLayerUpdate) {
          onLayerUpdate(activeLayer, imageData)
        }
        setDragStart(null)
      }
    }

    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <canvas
          ref={canvasRef}
          className={`border-2 border-gray-400 shadow-lg bg-white transition-opacity duration-300 ease-in-out ${
            tool === 'move' ? 'cursor-move' : 
            tool === 'pan' ? 'cursor-grab' : 
            tool === 'select' ? 'cursor-pointer' : 'cursor-crosshair'
          }`}
          style={{
            transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${scale})`,
            transition: tool === 'pan' && !dragStart ? 'transform 0.1s ease-out' : 'none'
          }}
          onWheel={(e) => {
            if (tool === 'zoom') {
              e.preventDefault()
              const delta = e.deltaY > 0 ? 0.9 : 1.1
              setScale(prev => Math.max(0.1, Math.min(3, prev * delta)))
            } else if (e.ctrlKey && activeLayer) {
              e.preventDefault()
              const delta = e.deltaY > 0 ? 0.9 : 1.1
              const newScale = Math.max(0.1, Math.min(3, imageScale * delta))
              setImageScale(newScale)
              
              // Apply resize to active layer
              const canvas = canvasRef.current!
              const ctx = ctxRef.current!
              const activeLayerData = layers.find(l => l.id === activeLayer)
              
              if (activeLayerData?.imageData) {
                const tempCanvas = document.createElement('canvas')
                tempCanvas.width = activeLayerData.imageData.width
                tempCanvas.height = activeLayerData.imageData.height
                const tempCtx = tempCanvas.getContext('2d')!
                tempCtx.putImageData(activeLayerData.imageData, 0, 0)
                
                ctx.fillStyle = 'white'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                
                const scaledWidth = tempCanvas.width * newScale
                const scaledHeight = tempCanvas.height * newScale
                const x = (canvas.width - scaledWidth) / 2
                const y = (canvas.height - scaledHeight) / 2
                
                ctx.drawImage(tempCanvas, x, y, scaledWidth, scaledHeight)
                
                if (onLayerUpdate) {
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                  onLayerUpdate(activeLayer, imageData)
                }
              }
            }
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        
        {/* Tool options overlay */}
        {(tool === 'brush' || tool === 'eraser') && (
          <div className="absolute top-4 left-4 bg-black/80 p-3 rounded-lg text-white">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Size:</label>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-xs">{brushSize}px</span>
              {tool === 'brush' && (
                <>
                  <label className="text-sm font-medium">Color:</label>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-8 h-8 rounded"
                  />
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Text tool options */}
        {tool === 'text' && (
          <div className="absolute top-4 left-4 bg-black/80 p-3 rounded-lg text-white">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-sm font-medium">Size:</label>
              <input
                type="range"
                min="10"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-xs">{fontSize}px</span>
              <label className="text-sm font-medium">Color:</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-8 h-8 rounded"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="Enter text..."
                className="px-2 py-1 text-black rounded text-sm flex-1"
              />
              <button
                onClick={() => setTextValue('')}
                className="px-2 py-1 bg-red-500 rounded text-xs"
              >
                Clear
              </button>
            </div>
          </div>
        )}
        
        {/* Zoom controls */}
        {tool === 'zoom' && (
          <div className="absolute top-4 right-4 bg-black/80 p-3 rounded-lg text-white">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setScale(prev => Math.max(0.1, prev * 0.8))}
                className="px-2 py-1 bg-gray-600 rounded text-xs"
              >
                -
              </button>
              <span className="text-xs">{Math.round(scale * 100)}%</span>
              <button
                onClick={() => setScale(prev => Math.min(3, prev * 1.2))}
                className="px-2 py-1 bg-gray-600 rounded text-xs"
              >
                +
              </button>
              <button
                onClick={() => setScale(1)}
                className="px-2 py-1 bg-blue-600 rounded text-xs"
              >
                Reset
              </button>
            </div>
          </div>
        )}
        
        {/* Image resize hint */}
        {activeLayer && (
          <div className="absolute bottom-4 left-4 bg-black/80 p-2 rounded text-white text-xs">
            Hold Ctrl + Scroll to resize image | Image: {Math.round(imageScale * 100)}%
          </div>
        )}
        
        {/* Crop overlay */}
        {tool === 'crop' && cropStart && cropEnd && canvasRef.current && (() => {
          const canvas = canvasRef.current
          const rect = canvas.getBoundingClientRect()
          const containerRect = canvas.parentElement?.getBoundingClientRect()
          if (!containerRect) return null
          
          const canvasLeft = rect.left - containerRect.left
          const canvasTop = rect.top - containerRect.top
          
          return (
            <div 
              className="absolute border-2 border-blue-400 border-dashed bg-blue-400/20 pointer-events-none"
              style={{
                left: canvasLeft + Math.min(cropStart.x, cropEnd.x),
                top: canvasTop + Math.min(cropStart.y, cropEnd.y),
                width: Math.abs(cropEnd.x - cropStart.x),
                height: Math.abs(cropEnd.y - cropStart.y)
              }}
            >
              <div className="absolute -top-6 left-0 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                {Math.round(Math.abs(cropEnd.x - cropStart.x))} × {Math.round(Math.abs(cropEnd.y - cropStart.y))}
              </div>
            </div>
          )
        })()}
        
        {/* Crop confirmation */}
        {showCropConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h3 className="text-lg font-semibold mb-4 text-black">Apply Crop?</h3>
              <p className="text-gray-600 mb-4">Crop to selected area?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (cropStart && cropEnd && activeLayer && onLayerUpdate) {
                      const canvas = canvasRef.current!
                      const ctx = ctxRef.current!
                      const x = Math.min(cropStart.x, cropEnd.x)
                      const y = Math.min(cropStart.y, cropEnd.y)
                      const width = Math.abs(cropEnd.x - cropStart.x)
                      const height = Math.abs(cropEnd.y - cropStart.y)
                      
                      const croppedData = ctx.getImageData(x, y, width, height)
                      
                      // Clear canvas and fill with white
                      ctx.fillStyle = 'white'
                      ctx.fillRect(0, 0, canvas.width, canvas.height)
                      
                      // Put cropped image at top-left corner
                      ctx.putImageData(croppedData, 0, 0)
                      
                      // Get the full canvas as new image data
                      const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                      onLayerUpdate(activeLayer, newImageData)
                    }
                    setShowCropConfirm(false)
                    setIsCropping(false)
                    setCropStart(null)
                    setCropEnd(null)
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setShowCropConfirm(false)
                    setIsCropping(false)
                    setCropStart(null)
                    setCropEnd(null)
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)