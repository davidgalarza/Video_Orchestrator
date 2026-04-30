import os
from google.cloud import storage
from datetime import timedelta
from dotenv import load_dotenv

import logging

load_dotenv()

logger = logging.getLogger(__name__)

GCS_BUCKET_NAME = os.getenv("GCS_BUCKET_NAME")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

def get_storage_client():
    if GOOGLE_APPLICATION_CREDENTIALS:
        return storage.Client.from_service_account_json(GOOGLE_APPLICATION_CREDENTIALS)
    return storage.Client()

def upload_to_gcs(file_content: bytes, destination_blob_name: str) -> str:
    if not GCS_BUCKET_NAME:
        raise ValueError("GCS_BUCKET_NAME is not set in environment variables.")
    
    try:
        client = get_storage_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(destination_blob_name)
        blob.upload_from_string(file_content)
        return f"gs://{GCS_BUCKET_NAME}/{destination_blob_name}"
    except Exception as e:
        logger.error(f"Detailed GCS Error: {str(e)}")
        raise e

from google import genai
from google.genai import types

def generate_video_veo(
    prompt: str,
    reference_images: list = None,
    first_frame_image: str = None,
    aspect_ratio: str = "16:9",
    provider: str = "vertex",
    model: str = "veo-3.1-generate-preview"
):
    if provider == "vertex":
        client = genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location="us-central1")
        if not model.startswith("publishers/"):
            model_name = f"publishers/google/models/{model}"
        else:
            model_name = model
    else:
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        model_name = model
        if not model_name.startswith("models/"):
            model_name = f"models/{model_name}"
    
    # Process reference images (handle both GCS URIs and raw bytes)
    genai_refs = []
    if reference_images:
        for ref in reference_images:
            image_obj = None
            if ref.get("uri"):
                image_obj = types.Image(gcs_uri=ref["uri"])
            elif ref.get("data"):
                # Use File API for data if possible or pass content directly
                # google-genai SDK handles content=bytes in types.Image
                image_obj = types.Image(content=ref["data"])
            
            if image_obj:
                genai_refs.append(types.VideoGenerationReferenceImage(
                    image=image_obj,
                    reference_type=ref.get("type", "ASSET")
                ))

    image_obj = None
    if first_frame_image:
        image_obj = types.Image(gcs_uri=first_frame_image)

    config_params = {
        "aspect_ratio": aspect_ratio,
    }
    
    if genai_refs:
        config_params["reference_images"] = genai_refs
    
    if provider == "vertex":
        config_params["output_gcs_uri"] = f"gs://{GCS_BUCKET_NAME}/outputs/"

    operation = client.models.generate_videos(
        model=model_name,
        prompt=prompt,
        image=image_obj,
        config=types.GenerateVideosConfig(**config_params)
    )
    return operation.name

def generate_signed_url(gcs_uri: str) -> str:
    if not gcs_uri:
        return None
    
    if not gcs_uri.startswith("gs://"):
        return gcs_uri
    
    # Extract bucket and path from gs://bucket-name/path/to/file
    parts = gcs_uri.replace("gs://", "").split("/", 1)
    if len(parts) < 2:
        return gcs_uri
    
    bucket_name = parts[0]
    path = parts[1]
    
    public_fallback_url = f"https://storage.googleapis.com/{bucket_name}/{path}"

    try:
        client = get_storage_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(path)
        
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=60),
            method="GET"
        )
        return url
    except Exception as e:
        logger.warning(f"Could not generate signed URL for {gcs_uri}: {e}")
        logger.info(f"Falling back to public URL: {public_fallback_url}")
        return public_fallback_url
