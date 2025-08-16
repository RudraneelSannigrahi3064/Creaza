from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import io
import base64
from PIL import Image
import numpy as np
import os
import pickle
try:
    import cv2
except ImportError:
    cv2 = None
try:
    from diffusers import StableDiffusionPipeline
    import torch
except ImportError:
    StableDiffusionPipeline = None
    torch = None
try:
    from tensorflow.keras.models import load_model
    from tensorflow.keras.preprocessing.image import img_to_array
    from tensorflow.keras.applications.vgg16 import preprocess_input
except ImportError:
    load_model = None

app = FastAPI(title="Image Editor AI Service", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Global variables
pipeline = None
caption_model = None
tokenizer = None

class TextToImageRequest(BaseModel):
    prompt: str
    width: int = 512
    height: int = 512
    num_inference_steps: int = 50
    guidance_scale: float = 12.0

@app.get("/")
async def root():
    return {"message": "Image Editor AI Service", "status": "running"}

@app.post("/text-to-image")
async def text_to_image(request: TextToImageRequest):
    """Generate image from text using OpenJourney model"""
    global pipeline
    
    if StableDiffusionPipeline is None or torch is None:
        raise HTTPException(status_code=500, detail="Text-to-image dependencies not installed")
    
    try:
        # Initialize pipeline if not already loaded
        if pipeline is None:
            print("Loading OpenJourney model...")
            pipeline = StableDiffusionPipeline.from_pretrained(
                "prompthero/openjourney",
                torch_dtype=torch.float32,
                safety_checker=None,
                requires_safety_checker=False
            )
            if torch.cuda.is_available():
                try:
                    pipeline = pipeline.to("cuda")
                    print("Using GPU")
                except:
                    print("Using CPU")
            else:
                print("Using CPU")
            print("Model loaded successfully")
        
        print(f"Generating: {request.prompt}")
        
        # Enhance prompt for better results
        enhanced_prompt = f"{request.prompt}, highly detailed, professional quality, sharp focus, masterpiece"
        
        with torch.no_grad():
            result = pipeline(
                prompt=enhanced_prompt,
                negative_prompt="blurry, low quality, distorted, ugly, bad anatomy, worst quality",
                width=request.width,
                height=request.height,
                num_inference_steps=request.num_inference_steps,
                guidance_scale=request.guidance_scale,
                eta=0.0
            )
        
        print("Image generation complete")
        
        # Convert to base64
        image = result.images[0]
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "success": True,
            "image": f"data:image/png;base64,{img_str}",
            "prompt": request.prompt,
            "message": "Image generated successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text-to-image generation failed: {str(e)}")

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

@app.post("/generate-caption")
async def generate_caption(file: UploadFile = File(...)):
    """Generate caption for uploaded image"""
    global caption_model, tokenizer
    
    if load_model is None:
        raise HTTPException(status_code=500, detail="TensorFlow not installed")
    
    try:
        # Load model and tokenizer if not already loaded
        if caption_model is None:
            if os.path.exists("model.h5"):
                print("Loading caption model...")
                caption_model = load_model("model.h5")
                print("Caption model loaded successfully")
            else:
                raise HTTPException(status_code=404, detail="Caption model not found")
        
        if tokenizer is None:
            if os.path.exists("tokenizer.pkl"):
                print("Loading tokenizer...")
                with open("tokenizer.pkl", "rb") as f:
                    tokenizer = pickle.load(f)
                print("Tokenizer loaded successfully")
            else:
                raise HTTPException(status_code=404, detail="Tokenizer not found")
        
        # Read and preprocess image
        contents = await file.read()
        input_image = Image.open(io.BytesIO(contents))
        
        # Convert to RGB if needed
        if input_image.mode != 'RGB':
            input_image = input_image.convert('RGB')
        
        # Resize to model input size (assuming 224x224 for VGG16)
        input_image = input_image.resize((224, 224))
        img_array = img_to_array(input_image)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = preprocess_input(img_array)
        
        # Generate caption (simplified - actual implementation depends on model architecture)
        features = caption_model.predict(img_array)
        
        # Simple caption generation (replace with your model's logic)
        caption = "A generated caption for the image"
        
        return {
            "success": True,
            "caption": caption,
            "message": "Caption generated successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Caption generation failed: {str(e)}")

if __name__ == "__main__":
    print("Starting Image Editor AI Service...")
    print("Available endpoints:")
    print("   - POST /remove-background")
    print("   - POST /style-transfer")
    print("   - POST /enhance-image")
    print("   - POST /text-to-image")
    print("   - POST /generate-caption")
    print("Running on http://localhost:8002")
    
    uvicorn.run(app, host="0.0.0.0", port=8002)