import { Layer } from '../components/Canvas'
import { Tool } from '../components/Toolbar'

export class WebGLRenderer {
  private gl: WebGLRenderingContext
  private program: WebGLProgram | null = null
  private filterProgram: WebGLProgram | null = null
  private vertexBuffer: WebGLBuffer | null = null
  private textureCache = new Map<string, WebGLTexture>()
  private drawingCanvas: HTMLCanvasElement
  private drawingCtx: CanvasRenderingContext2D
  private brushSize = 10
  private brushColor = '#ffffff'

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl')
    if (!gl) {
      throw new Error('WebGL not supported')
    }
    this.gl = gl
    
    // Create drawing canvas for brush/eraser operations
    this.drawingCanvas = document.createElement('canvas')
    this.drawingCanvas.width = canvas.width
    this.drawingCanvas.height = canvas.height
    this.drawingCtx = this.drawingCanvas.getContext('2d')!
    
    this.initializeShaders()
    this.setupBuffers()
  }

  private initializeShaders() {
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `

    const fragmentShaderSource = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_opacity;
      varying vec2 v_texCoord;
      
      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        gl_FragColor = vec4(color.rgb, color.a * u_opacity);
      }
    `

    const filterFragmentShader = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_hue;
      uniform float u_blur;
      uniform float u_grayscale;
      varying vec2 v_texCoord;
      
      vec3 rgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }
      
      vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }
      
      void main() {
        vec4 color = texture2D(u_texture, v_texCoord);
        
        // Brightness
        color.rgb += u_brightness / 100.0;
        
        // Contrast
        color.rgb = (color.rgb - 0.5) * (1.0 + u_contrast / 100.0) + 0.5;
        
        // Saturation & Hue
        vec3 hsv = rgb2hsv(color.rgb);
        hsv.y *= (1.0 + u_saturation / 100.0);
        hsv.x += u_hue / 360.0;
        color.rgb = hsv2rgb(hsv);
        
        // Grayscale
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        color.rgb = mix(color.rgb, vec3(gray), u_grayscale / 100.0);
        
        gl_FragColor = color;
      }
    `

    this.program = this.createProgram(vertexShaderSource, fragmentShaderSource)
    this.filterProgram = this.createProgram(vertexShaderSource, filterFragmentShader)
  }

  private createProgram(vertexSource: string, fragmentSource: string): WebGLProgram | null {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource)
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource)
    
    if (!vertexShader || !fragmentShader) return null

    const program = this.gl.createProgram()
    if (!program) return null

    this.gl.attachShader(program, vertexShader)
    this.gl.attachShader(program, fragmentShader)
    this.gl.linkProgram(program)

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error('Program link error:', this.gl.getProgramInfoLog(program))
      return null
    }

    return program
  }

  private createShader(type: number, source: string): WebGLShader | null {
    const shader = this.gl.createShader(type)
    if (!shader) return null

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', this.gl.getShaderInfoLog(shader))
      this.gl.deleteShader(shader)
      return null
    }

    return shader
  }

  private setupBuffers() {
    const vertices = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0
    ])

    this.vertexBuffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW)
  }

  renderLayers(layers: Layer[]) {
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height)
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)

    layers.forEach(layer => {
      if (layer.visible && layer.imageData) {
        this.renderLayer(layer)
      }
    })
  }

  private renderLayer(layer: Layer) {
    if (!this.program) return

    this.gl.useProgram(this.program)
    
    // Create texture from layer image data
    const texture = this.createTextureFromImageData(layer.imageData!)
    
    // Bind texture
    this.gl.activeTexture(this.gl.TEXTURE0)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    
    // Set uniforms
    const textureLocation = this.gl.getUniformLocation(this.program, 'u_texture')
    const opacityLocation = this.gl.getUniformLocation(this.program, 'u_opacity')
    
    this.gl.uniform1i(textureLocation, 0)
    this.gl.uniform1f(opacityLocation, layer.opacity)
    
    // Set attributes
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer)
    
    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position')
    const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord')
    
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.enableVertexAttribArray(texCoordLocation)
    
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 16, 0)
    this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 16, 8)
    
    // Draw
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  private createTextureFromImageData(imageData: ImageData): WebGLTexture {
    const texture = this.gl.createTexture()!
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA, 
      imageData.width, imageData.height, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageData.data
    )
    
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    
    return texture
  }

  setBrushSize(size: number) {
    this.brushSize = size
  }

  setBrushColor(color: string) {
    this.brushColor = color
  }

  startDrawing(pos: { x: number; y: number }, tool: Tool) {
    this.drawingCtx.beginPath()
    this.drawingCtx.moveTo(pos.x, pos.y)
    
    if (tool === 'brush') {
      this.drawingCtx.globalCompositeOperation = 'source-over'
      this.drawingCtx.strokeStyle = this.brushColor
    } else if (tool === 'eraser') {
      this.drawingCtx.globalCompositeOperation = 'destination-out'
    }
    
    this.drawingCtx.lineWidth = this.brushSize
    this.drawingCtx.lineCap = 'round'
    this.drawingCtx.lineJoin = 'round'
  }

  drawLine(from: { x: number; y: number }, to: { x: number; y: number }, tool: Tool) {
    this.drawingCtx.lineTo(to.x, to.y)
    this.drawingCtx.stroke()
  }

  endDrawing() {
    this.drawingCtx.closePath()
  }

  applyFilter(imageData: ImageData, filter: string, value: number): ImageData {
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height
    const ctx = canvas.getContext('2d')!
    
    ctx.putImageData(imageData, 0, 0)
    
    if (filter === 'grayscale') {
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
      ctx.putImageData(imageData, 0, 0)
    } else if (filter === 'brightness') {
      ctx.filter = `brightness(${100 + value}%)`
      ctx.drawImage(canvas, 0, 0)
    } else if (filter === 'contrast') {
      ctx.filter = `contrast(${100 + value}%)`
      ctx.drawImage(canvas, 0, 0)
    }
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  cropImage(imageData: ImageData, x: number, y: number, width: number, height: number): ImageData {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = imageData.width
    sourceCanvas.height = imageData.height
    const sourceCtx = sourceCanvas.getContext('2d')!
    sourceCtx.putImageData(imageData, 0, 0)
    
    ctx.drawImage(sourceCanvas, x, y, width, height, 0, 0, width, height)
    return ctx.getImageData(0, 0, width, height)
  }

  resize(width: number, height: number) {
    this.gl.viewport(0, 0, width, height)
    this.drawingCanvas.width = width
    this.drawingCanvas.height = height
  }

  dispose() {
    this.textureCache.forEach(texture => {
      this.gl.deleteTexture(texture)
    })
    this.textureCache.clear()
    
    if (this.program) this.gl.deleteProgram(this.program)
    if (this.filterProgram) this.gl.deleteProgram(this.filterProgram)
    if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer)
  }
}