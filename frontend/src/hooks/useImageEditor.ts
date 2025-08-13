import { useState, useCallback, useRef } from 'react'
import { Layer } from '../components/Canvas'
import { Tool } from '../components/Toolbar'

interface HistoryState {
  layers: Layer[]
  activeLayer: string | null
}

export function useImageEditor() {
  const [layers, setLayers] = useState<Layer[]>([])
  const [activeLayer, setActiveLayer] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('move')
  
  // History management
  const [history, setHistory] = useState<HistoryState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const saveToHistory = useCallback(() => {
    const newState: HistoryState = { layers: [...layers], activeLayer }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newState)
    
    // Limit history to 50 states
    if (newHistory.length > 50) {
      newHistory.shift()
    } else {
      setHistoryIndex(prev => prev + 1)
    }
    
    setHistory(newHistory)
  }, [layers, activeLayer, history, historyIndex])

  const addLayer = useCallback(() => {
    // Create a blank white canvas for the new layer
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 500
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      imageData
    }
    
    setLayers(prev => [...prev, newLayer])
    setActiveLayer(newLayer.id)
    // Don't save to history on initial layer creation
  }, [layers.length])

  const deleteLayer = useCallback((id: string) => {
    setLayers(prev => prev.filter(layer => layer.id !== id))
    if (activeLayer === id) {
      setActiveLayer(layers.length > 1 ? layers[0].id : null)
    }
    saveToHistory()
  }, [activeLayer, layers, saveToHistory])

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setLayers(prevState.layers)
      setActiveLayer(prevState.activeLayer)
      setHistoryIndex(prev => prev - 1)
    }
  }, [history, historyIndex])

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setLayers(nextState.layers)
      setActiveLayer(nextState.activeLayer)
      setHistoryIndex(prev => prev + 1)
    }
  }, [history, historyIndex])

  const openImage = useCallback(() => {
    if (!fileInputRef.current) {
      // Create hidden file input
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.style.display = 'none'
      document.body.appendChild(input)
      fileInputRef.current = input
    }

    fileInputRef.current.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const formData = new FormData()
      formData.append('image', file)

      try {
        const response = await fetch('/api/open-image', {
          method: 'POST',
          body: formData
        })

        if (response.ok) {
          const result = await response.json()
          
          // Create image element to get ImageData
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = 800
            canvas.height = 500
            const ctx = canvas.getContext('2d')!
            
            // Fill with white background
            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // Scale image to fit canvas while maintaining aspect ratio
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height)
            const scaledWidth = img.width * scale
            const scaledHeight = img.height * scale
            const x = (canvas.width - scaledWidth) / 2
            const y = (canvas.height - scaledHeight) / 2
            
            ctx.drawImage(img, x, y, scaledWidth, scaledHeight)
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            
            // Always create new layer
            const newLayer: Layer = {
              id: `layer-${Date.now()}`,
              name: file.name,
              visible: true,
              opacity: 1,
              blendMode: 'normal',
              imageData
            }
            
            setLayers(prev => [...prev, newLayer])
            setActiveLayer(newLayer.id)
            saveToHistory()
          }
          img.src = result.data
        }
      } catch (error) {
        console.error('Failed to open image:', error)
      }
    }

    fileInputRef.current.click()
  }, [saveToHistory])

  const saveImage = useCallback(async () => {
    if (layers.length === 0) return

    // Create composite canvas
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    // Find canvas dimensions from layers
    let maxWidth = 0, maxHeight = 0
    layers.forEach(layer => {
      if (layer.imageData) {
        maxWidth = Math.max(maxWidth, layer.imageData.width)
        maxHeight = Math.max(maxHeight, layer.imageData.height)
      }
    })
    
    canvas.width = maxWidth
    canvas.height = maxHeight
    
    // Composite all visible layers
    layers.forEach(layer => {
      if (layer.visible && layer.imageData) {
        ctx.globalAlpha = layer.opacity
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation
        
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = layer.imageData.width
        tempCanvas.height = layer.imageData.height
        const tempCtx = tempCanvas.getContext('2d')!
        tempCtx.putImageData(layer.imageData, 0, 0)
        
        ctx.drawImage(tempCanvas, 0, 0)
      }
    })

    // Convert to blob and save
    canvas.toBlob(async (blob) => {
      if (!blob) return

      const reader = new FileReader()
      reader.onload = async () => {
        const imageData = reader.result as string
        
        try {
          const response = await fetch('/api/save-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageData,
              filename: `edited-image-${Date.now()}.png`,
              format: 'png'
            })
          })

          if (response.ok) {
            const result = await response.json()
            console.log('Image saved:', result.message)
          }
        } catch (error) {
          console.error('Failed to save image:', error)
        }
      }
      reader.readAsDataURL(blob)
    }, 'image/png')
  }, [layers])

  const updateLayer = useCallback((layerId: string, imageData: ImageData) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, imageData } : layer
    ))
    saveToHistory()
  }, [saveToHistory])

  const updateLayerProps = useCallback((layerId: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, ...updates } : layer
    ))
    saveToHistory()
  }, [saveToHistory])

  const moveLayer = useCallback((layerId: string, direction: 'up' | 'down') => {
    setLayers(prev => {
      const index = prev.findIndex(layer => layer.id === layerId)
      if (index === -1) return prev
      
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev
      
      const newLayers = [...prev]
      const [movedLayer] = newLayers.splice(index, 1)
      newLayers.splice(newIndex, 0, movedLayer)
      return newLayers
    })
    saveToHistory()
  }, [saveToHistory])

  const applyFilter = useCallback((filter: string, value: number) => {
    if (!activeLayer) return
    
    setLayers(prev => prev.map(layer => {
      if (layer.id === activeLayer && layer.imageData) {
        // Store original if not already stored
        if (!layer.originalImageData) {
          layer.originalImageData = layer.imageData
        }
        
        const canvas = document.createElement('canvas')
        canvas.width = layer.originalImageData.width
        canvas.height = layer.originalImageData.height
        const ctx = canvas.getContext('2d')!
        
        // Start with original image
        ctx.putImageData(layer.originalImageData, 0, 0)
        
        if (filter === 'grayscale') {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const data = imageData.data
          
          for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
            const factor = value / 100
            data[i] = data[i] * (1 - factor) + gray * factor
            data[i + 1] = data[i + 1] * (1 - factor) + gray * factor
            data[i + 2] = data[i + 2] * (1 - factor) + gray * factor
          }
          
          ctx.putImageData(imageData, 0, 0)
        } else if (filter === 'blur' && value > 0) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.filter = `blur(${value}px)`
          tempCtx.drawImage(canvas, 0, 0)
          
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(tempCanvas, 0, 0)
        } else if (filter === 'brightness' && value !== 0) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.filter = `brightness(${100 + value}%)`
          tempCtx.drawImage(canvas, 0, 0)
          
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(tempCanvas, 0, 0)
        } else if (filter === 'contrast' && value !== 0) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.filter = `contrast(${100 + value}%)`
          tempCtx.drawImage(canvas, 0, 0)
          
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(tempCanvas, 0, 0)
        } else if (filter === 'saturation' && value !== 0) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.filter = `saturate(${100 + value}%)`
          tempCtx.drawImage(canvas, 0, 0)
          
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(tempCanvas, 0, 0)
        } else if (filter === 'hue' && value !== 0) {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = canvas.width
          tempCanvas.height = canvas.height
          const tempCtx = tempCanvas.getContext('2d')!
          tempCtx.filter = `hue-rotate(${value}deg)`
          tempCtx.drawImage(canvas, 0, 0)
          
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(tempCanvas, 0, 0)
        }
        
        const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        return { ...layer, imageData: newImageData }
      }
      return layer
    }))
  }, [activeLayer])

  return {
    layers,
    activeLayer,
    tool,
    setTool,
    addLayer,
    deleteLayer,
    setActiveLayer,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    openImage,
    saveImage,
    applyFilter,
    updateLayer,
    updateLayerProps,
    moveLayer,
    setLayers
  }
}