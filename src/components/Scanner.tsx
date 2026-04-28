"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Camera, RefreshCw, Scan, Maximize, Minimize } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScannerProps {
  onCapture: (image: string) => void;
  isScanning: boolean;
}

export default function Scanner({ onCapture, isScanning }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [paperSize, setPaperSize] = useState<"A4" | "A3">("A4");
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Camera access denied. Please enable camera permissions.");
    }
  }, [facingMode, stream]);

  useEffect(() => {
    const initCamera = async () => {
      await startCamera();
    };
    initCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const toggleCamera = () => {
    setFacingMode(prev => (prev === "user" ? "environment" : "user"));
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL("image/jpeg", 0.9);
        onCapture(imageData);
      }
    }
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto overflow-hidden rounded-2xl bg-black aspect-[3/4] sm:aspect-video shadow-2xl border-4 border-slate-800">
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white bg-slate-900">
          <Camera className="w-12 h-12 mb-4 text-red-500" />
          <p className="text-lg font-medium">{error}</p>
          <button 
            onClick={startCamera}
            className="mt-4 px-6 py-2 bg-blue-600 rounded-full hover:bg-blue-700 transition"
          >
            Retry Camera
          </button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Overlay Guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className={cn(
                "border-2 border-dashed border-white/50 transition-all duration-300 relative",
                paperSize === "A4" ? "w-[70%] h-[80%]" : "w-[90%] h-[90%]"
              )}
            >
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500" />
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 px-4">
            <button
              onClick={toggleCamera}
              className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition"
              title="Switch Camera"
            >
              <RefreshCw className="w-6 h-6" />
            </button>

            <button
              onClick={captureImage}
              disabled={isScanning}
              className={cn(
                "p-5 rounded-full shadow-xl transition transform active:scale-95 group",
                isScanning ? "bg-slate-600 cursor-not-allowed" : "bg-white hover:bg-blue-50"
              )}
            >
              <div className={cn(
                "w-12 h-12 flex items-center justify-center rounded-full border-4",
                isScanning ? "border-slate-400" : "border-slate-900 group-hover:border-blue-600"
              )}>
                {isScanning ? (
                  <div className="w-6 h-6 border-4 border-t-transparent border-slate-400 rounded-full animate-spin" />
                ) : (
                  <Scan className="w-8 h-8 text-slate-900 group-hover:text-blue-600" />
                )}
              </div>
            </button>

            <button
              onClick={() => setPaperSize(prev => (prev === "A4" ? "A3" : "A4"))}
              className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition"
              title="Toggle Paper Size"
            >
              {paperSize === "A4" ? <Maximize className="w-6 h-6" /> : <Minimize className="w-6 h-6" />}
            </button>
          </div>

          {/* Paper Size Label */}
          <div className="absolute top-4 right-4 px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full text-white text-xs font-bold uppercase tracking-wider">
            {paperSize} Mode
          </div>
        </>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
