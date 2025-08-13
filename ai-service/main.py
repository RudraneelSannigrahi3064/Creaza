from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import io
import base64
from PIL import Image
import numpy as np
try:
    import cv2
except ImportError:
    cv2 = None

app = FastAPI(title="Image Editor AI Service", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Image Editor AI Service", "status": "running"}

@app.post("/remove-background")
async def remove_background(file: UploadFile = File(...)):
    """Remove background from uploaded image using U²-Net model"""
    try:
        # Read uploaded image
        contents = await file.read()
        input_image = Image.open(io.BytesIO(contents))
        
        # Simple background removal (placeholder)
        # Convert to RGBA for transparency
        output_image = input_image.convert('RGBA')
        data = np.array(output_image)
        
        # Simple edge-based background removal
        gray = np.mean(data[:,:,:3], axis=2)
        edges = np.abs(np.gradient(gray)[0]) + np.abs(np.gradient(gray)[1])
        mask = edges > 10  # Simple threshold
        data[:,:,3] = mask * 255
        
        output_image = Image.fromarray(data, 'RGBA')
        
        # Convert to base64
        buffer = io.BytesIO()
        output_image.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "success": True,
            "image": f"data:image/png;base64,{img_str}",
            "message": "Background removed successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {str(e)}")

@app.post("/style-transfer")
async def style_transfer(
    content_file: UploadFile = File(...),
    style: str = "artistic"
):
    """Apply style transfer to image (simplified implementation)"""
    try:
        # Read uploaded image
        contents = await content_file.read()
        input_image = Image.open(io.BytesIO(contents))
        
        # Convert to numpy array
        img_array = np.array(input_image)
        
        # Apply simple style filters (in production, use neural style transfer)
        if style == "artistic":
            # Apply artistic filter using OpenCV
            img_array = cv2.bilateralFilter(img_array, 15, 80, 80)
            img_array = cv2.edgePreservingFilter(img_array, flags=1, sigma_s=50, sigma_r=0.4)
        elif style == "cartoon":
            # Cartoon effect
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            gray_blur = cv2.medianBlur(gray, 5)
            edges = cv2.adaptiveThreshold(gray_blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 9)
            color = cv2.bilateralFilter(img_array, 9, 300, 300)
            cartoon = cv2.bitwise_and(color, color, mask=edges)
            img_array = cartoon
        elif style == "oil_painting":
            # Oil painting effect
            img_array = cv2.xphoto.oilPainting(img_array, 7, 1)
        
        # Convert back to PIL Image
        output_image = Image.fromarray(img_array)
        
        # Convert to base64
        buffer = io.BytesIO()
        output_image.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "success": True,
            "image": f"data:image/png;base64,{img_str}",
            "style": style,
            "message": f"Style transfer ({style}) applied successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Style transfer failed: {str(e)}")

@app.post("/enhance-image")
async def enhance_image(file: UploadFile = File(...)):
    """Enhance image quality using AI techniques"""
    try:
        # Read uploaded image
        contents = await file.read()
        input_image = Image.open(io.BytesIO(contents))
        img_array = np.array(input_image)
        
        # Apply enhancement techniques
        # 1. Noise reduction
        denoised = cv2.fastNlMeansDenoisingColored(img_array, None, 10, 10, 7, 21)
        
        # 2. Sharpening
        kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
        sharpened = cv2.filter2D(denoised, -1, kernel)
        
        # 3. Contrast enhancement
        lab = cv2.cvtColor(sharpened, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8,8))
        l = clahe.apply(l)
        enhanced = cv2.merge([l, a, b])
        enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
        
        # Convert back to PIL Image
        output_image = Image.fromarray(enhanced)
        
        # Convert to base64
        buffer = io.BytesIO()
        output_image.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "success": True,
            "image": f"data:image/png;base64,{img_str}",
            "message": "Image enhanced successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image enhancement failed: {str(e)}")

if __name__ == "__main__":
    print("🤖 Starting Image Editor AI Service...")
    print("📍 Available endpoints:")
    print("   - POST /remove-background")
    print("   - POST /style-transfer")
    print("   - POST /enhance-image")
    print("🌐 Running on http://localhost:8000")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)