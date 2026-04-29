import os
from google.cloud import storage
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

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
        print(f"Detailed GCS Error: {str(e)}")
        raise e

from google import genai
from google.genai import types

def generate_video_veo(
    prompt: str,
    reference_images: list = None,
    first_frame_image: str = None,
    aspect_ratio: str = "16:9"
):
    client = genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location="us-central1")
    
    config = {
        "action": "generate",
        "parameters": {
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }
    }
    
    if reference_images:
        config["parameters"]["reference_images"] = reference_images
    
    if first_frame_image:
        config["parameters"]["first_frame_image"] = {"uri": first_frame_image}

    # Using the google-genai SDK for Veo
    # Note: The exact method name might vary based on the SDK version, 
    # but typically it's under models.generate_content or a specialized method.
    # As of current knowledge, it's often through the 'veo-3.1-generate-001' model.
    
    operation = client.models.generate_video(
        model="veo-3.1-generate-001",
        prompt=prompt,
        config=types.GenerateVideoConfig(
            aspect_ratio=aspect_ratio,
            reference_images=reference_images,
            first_frame_image=first_frame_image
        )
    )
    return operation.name

def generate_signed_url(gcs_uri: str) -> str:
    if not gcs_uri or not GCS_BUCKET_NAME:
        return None
    
    if not gcs_uri.startswith("gs://"):
        return gcs_uri
    
    try:
        path = gcs_uri.replace(f"gs://{GCS_BUCKET_NAME}/", "")
        client = get_storage_client()
        bucket = client.bucket(GCS_BUCKET_NAME)
        blob = bucket.blob(path)
        
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=60),
            method="GET"
        )
        return url
    except Exception as e:
        print(f"Warning: Could not generate signed URL for {gcs_uri}: {e}")
        return None
