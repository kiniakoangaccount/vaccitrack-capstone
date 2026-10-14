"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";

const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1440;

async function compressPhoto(source: Blob): Promise<File> {
  const image = await createImageBitmap(source);
  try {
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is not available in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!compressed) throw new Error("Could not prepare this photo. Please choose another image.");
    return new File([compressed], "profile-photo.jpg", { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    image.close();
  }
}

export default function ProfilePhotoInput({
  value,
  onChange,
}: {
  value: File | null;
  onChange: (photo: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef("");

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      setError("Could not start the camera preview. Please check camera access or choose a photo instead.");
    });
  }, [cameraOpen]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function setPreview(photo: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = photo ? URL.createObjectURL(photo) : "";
    setPreviewUrl(previewUrlRef.current);
  }

  async function preparePhoto(source: Blob) {
    setError("");
    setIsPreparing(true);
    onChange(null);
    setPreview(null);
    try {
      const photo = await compressPhoto(source);
      onChange(photo);
      setPreview(photo);
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : "Could not prepare this photo. Please try another image.");
    } finally {
      setIsPreparing(false);
    }
  }

  async function openCamera() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not available in this browser. Choose a photo instead.");
      return;
    }
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
      });
      setCameraOpen(true);
    } catch {
      setError("Camera access was blocked or unavailable. Allow camera access in your browser settings, or choose a photo instead.");
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("The camera is still starting. Please try again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture the photo. Please choose an image instead.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!photo) {
      setError("Could not capture the photo. Please try again.");
      return;
    }
    closeCamera();
    await preparePhoto(photo);
  }

  return (
    <div className="photo-field">
      <span className="photo-field-label">Photo of you</span>
      <p className="photo-field-help">Add a clear photo of yourself. You can upload one or take a photo with your camera.</p>
      {previewUrl && (
        <div className="photo-preview">
          <img src={previewUrl} alt="Preview of your registration photo" />
          <div>
            <strong>Photo ready</strong>
            <span>{value?.name}</span>
            <button type="button" className="photo-remove-button" onClick={() => { onChange(null); setPreview(null); }}>Remove photo</button>
          </div>
        </div>
      )}
      <div className="photo-actions">
        <label className="secondary-button photo-file-button">
          <ImagePlus size={17} />
          Choose photo
          <input
            type="file"
            accept="image/*"
            capture="user"
            aria-label="Choose a photo of yourself"
            disabled={isPreparing}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (!file.type.startsWith("image/")) {
                setError("Choose an image file.");
                return;
              }
              if (file.size > MAX_SOURCE_PHOTO_BYTES) {
                setError("Choose an image smaller than 20MB.");
                return;
              }
              void preparePhoto(file);
            }}
          />
        </label>
        <button type="button" className="secondary-button photo-camera-button" onClick={() => void openCamera()} disabled={isPreparing}>
          <Camera size={17} />
          Use camera
        </button>
      </div>
      {isPreparing && <p className="photo-status" role="status" aria-live="polite">Preparing your photo for upload...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {cameraOpen && (
        <div className="modal-backdrop photo-camera-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCamera()}>
          <section className="modal photo-camera-modal" role="dialog" aria-modal="true" aria-labelledby="photo-camera-title">
            <div className="modal-heading">
              <div>
                <p className="eyebrow">REGISTRATION PHOTO</p>
                <h2 id="photo-camera-title">Take a photo</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close camera" onClick={closeCamera}><X size={18} /></button>
            </div>
            <video ref={videoRef} autoPlay muted playsInline className="photo-camera-video" />
            <p className="photo-field-help">Position your face in view, then capture your photo.</p>
            <div className="photo-actions">
              <button type="button" className="secondary-button" onClick={closeCamera}>Cancel</button>
              <button type="button" className="primary-button" onClick={() => void capturePhoto()}>Capture photo</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
