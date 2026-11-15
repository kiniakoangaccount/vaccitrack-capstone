"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImagePlus, X } from "lucide-react";

const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTO_DIMENSION = 1440;

async function compressPhoto(source: Blob): Promise<File> {
  const image = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is not available in this browser.");

    let scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(image.width, image.height));
    for (let attempt = 0; attempt < 4; attempt++) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressed = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82 - attempt * 0.12)
      );
      if (!compressed) throw new Error("Could not prepare this photo. Please choose another image.");
      if (compressed.size <= MAX_UPLOAD_PHOTO_BYTES) {
        return new File([compressed], "profile-photo.jpg", { type: "image/jpeg", lastModified: Date.now() });
      }
      scale *= 0.8;
    }

    throw new Error("This photo could not be reduced below 5MB. Choose a different image.");
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
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef("");
  const cameraButtonRef = useRef<HTMLButtonElement>(null);
  const cameraRequestRef = useRef(0);
  const mountedRef = useRef(false);

  const closeCamera = useCallback(() => {
    cameraRequestRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
    setIsCameraStarting(false);
    setIsCameraReady(false);
    cameraButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    let active = true;
    const stream = streamRef.current;
    const markReady = () => {
      if (active && video.videoWidth > 0 && video.videoHeight > 0) setIsCameraReady(true);
    };

    video.srcObject = stream;
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("playing", markReady);
    void video.play().then(markReady).catch(() => {
      if (!active) return;
      setError("Could not start the camera preview. Check camera access or choose a photo instead.");
      closeCamera();
    });

    return () => {
      active = false;
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("playing", markReady);
      video.srcObject = null;
    };
  }, [cameraOpen, closeCamera]);

  useEffect(() => {
    if (!cameraOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeCamera();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cameraOpen, closeCamera]);

  function setPreview(photo: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = photo ? URL.createObjectURL(photo) : "";
    setPreviewUrl(previewUrlRef.current);
  }

  async function preparePhoto(source: Blob) {
    setError("");
    setIsPreparing(true);
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
    if (isCameraStarting || cameraOpen || isPreparing) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not available in this browser. Choose a photo instead.");
      return;
    }
    const requestId = ++cameraRequestRef.current;
    setIsCameraStarting(true);
    setIsCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } },
      });
      if (!mountedRef.current || requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      if (mountedRef.current && requestId === cameraRequestRef.current) {
        setError("Camera access was blocked or unavailable. Allow camera access in your browser settings, or choose a photo instead.");
      }
    } finally {
      if (mountedRef.current && requestId === cameraRequestRef.current) {
        setIsCameraStarting(false);
      }
    }
  }

  function cancelCameraRequest() {
    cameraRequestRef.current++;
    setIsCameraStarting(false);
  }

  async function capturePhoto() {
    setError("");
    const video = videoRef.current;
    if (!isCameraReady || !video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("The camera is still starting. Please try again in a moment.");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not capture the photo. Choose an image instead.");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
      if (!photo) throw new Error("Could not capture the photo. Please try again.");
      closeCamera();
      await preparePhoto(photo);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Could not capture the photo. Please try again.");
    }
  }

  return (
    <div className="photo-field" aria-busy={isPreparing || isCameraStarting}>
      <span className="photo-field-label" id="profile-photo-label">Photo of you</span>
      <p className="photo-field-help" id="profile-photo-help">Add a clear photo of yourself. You can upload one or take a photo with your camera.</p>
      {previewUrl && (
        <div className="photo-preview">
          <Image src={previewUrl} alt="Preview of your registration photo" width={72} height={72} unoptimized />
          <div>
            <strong>Photo ready</strong>
            <span>{value?.name || "Camera photo"}</span>
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
            id="profile-photo-file"
            aria-labelledby="profile-photo-label"
            aria-describedby="profile-photo-help"
            disabled={isPreparing || isCameraStarting}
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
        <button ref={cameraButtonRef} type="button" className="secondary-button photo-camera-button" onClick={() => isCameraStarting ? cancelCameraRequest() : void openCamera()} disabled={isPreparing || cameraOpen}>
          <Camera size={17} />
          {isCameraStarting ? "Cancel camera request" : "Use camera"}
        </button>
      </div>
      {isPreparing && <p className="photo-status" role="status" aria-live="polite">Preparing your photo for upload...</p>}
      {isCameraStarting && <p className="photo-status" role="status" aria-live="polite">Waiting for camera permission...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {cameraOpen && (
        <div className="modal-backdrop photo-camera-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeCamera()}>
        <section className="modal photo-camera-modal" role="dialog" aria-modal="true" aria-labelledby="photo-camera-title" aria-busy={!isCameraReady}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">REGISTRATION PHOTO</p>
                <h2 id="photo-camera-title">Take a photo</h2>
              </div>
              <button type="button" className="icon-button" aria-label="Close camera" onClick={closeCamera} autoFocus><X size={18} /></button>
            </div>
            <video ref={videoRef} autoPlay muted playsInline className="photo-camera-video" aria-label="Live camera preview" />
            {!isCameraReady && !error && <p className="photo-status" role="status">Starting camera preview...</p>}
            <p className="photo-field-help">Position your face in view, then capture your photo.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="photo-actions">
              <button type="button" className="secondary-button" onClick={closeCamera}>Cancel</button>
              <button type="button" className="primary-button" onClick={() => void capturePhoto()} disabled={!isCameraReady || isPreparing}>Capture photo</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
