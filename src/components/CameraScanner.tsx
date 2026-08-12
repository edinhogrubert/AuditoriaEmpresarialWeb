import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { CameraOff, RefreshCw, Video, Camera, ExternalLink, Info } from 'lucide-react';

interface CameraScannerProps {
  onScan: (barcode: string, format: string) => void;
  active: boolean;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScan, active }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize camera system
  const initCameraSystem = async () => {
    setIsInitializing(true);
    setError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasPermission(false);
      setError('O seu navegador ou conexão não suporta acesso à câmera (requer HTTPS ou permissão do navegador).');
      setIsInitializing(false);
      return;
    }

    try {
      // 1. Request getUserMedia to prompt user for permission
      let initialStream: MediaStream | null = null;
      try {
        // Try basic video first to maximize compatibility across Linux/Ubuntu/Windows/Mobile
        initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (e) {
        // Try environment facing mode as fallback for mobile devices
        initialStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
      }

      setHasPermission(true);

      // Stop temporary track stream so ZXing can bind smoothly
      if (initialStream) {
        initialStream.getTracks().forEach((track) => track.stop());
      }

      // 2. Enumerate available video input devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((device) => device.kind === 'videoinput');
      setCameras(videoDevices);

      if (videoDevices.length > 0) {
        // Prefer back camera if available, otherwise default to first webcam
        const backCam = videoDevices.find(
          (d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('traseira') ||
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('rear')
        );
        setSelectedCameraId(backCam ? backCam.deviceId : videoDevices[0].deviceId);
      } else {
        setSelectedCameraId(null);
      }
    } catch (err: any) {
      console.error('Camera permission or init error:', err);
      setHasPermission(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Permissão de câmera negada no navegador. Clique no ícone de CADEADO na barra de endereços para permitir.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Nenhuma câmera/webcam foi detectada no seu dispositivo.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('A câmera está sendo usada por outro aplicativo ou processo no Ubuntu/Linux.');
      } else {
        setError('Não foi possível acessar a câmera. Verifique as permissões de vídeo no navegador.');
      }
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (active) {
      initCameraSystem();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [active]);

  // Spawn ZXing scanning loop
  useEffect(() => {
    if (!active || hasPermission === false || !videoRef.current) {
      return;
    }

    let isMounted = true;

    const startScanning = async () => {
      setIsInitializing(true);
      setError(null);

      try {
        stopCamera();
        const reader = new BrowserMultiFormatReader();
        codeReaderRef.current = reader;

        if (selectedCameraId) {
          await reader.decodeFromVideoDevice(
            selectedCameraId,
            videoRef.current!,
            (result, err) => {
              if (isMounted && result && result.getText()) {
                onScan(result.getText(), result.getBarcodeFormat().toString());
              }
            }
          );
        } else {
          // Fallback to generic constraints
          await reader.decodeFromConstraints(
            { video: true },
            videoRef.current!,
            (result, err) => {
              if (isMounted && result && result.getText()) {
                onScan(result.getText(), result.getBarcodeFormat().toString());
              }
            }
          );
        }

        if (isMounted) setIsInitializing(false);
      } catch (err: any) {
        console.warn('Primary camera decode failed, trying fallback constraints...', err);
        try {
          if (codeReaderRef.current && videoRef.current) {
            await codeReaderRef.current.decodeFromConstraints(
              { video: true },
              videoRef.current,
              (result, err) => {
                if (isMounted && result && result.getText()) {
                  onScan(result.getText(), result.getBarcodeFormat().toString());
                }
              }
            );
            if (isMounted) setIsInitializing(false);
            return;
          }
        } catch (fallbackErr: any) {
          console.error('Camera fallback failed:', fallbackErr);
        }

        if (isMounted) {
          setError('Não foi possível iniciar a câmera do dispositivo.');
          setIsInitializing(false);
        }
      }
    };

    startScanning();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [active, hasPermission, selectedCameraId, onScan]);

  const stopCamera = () => {
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (e) {
        // ignore reset errors on unmount
      }
      codeReaderRef.current = null;
    }
  };

  const handleCameraCycle = () => {
    if (cameras.length <= 1) return;
    const currentIdx = cameras.findIndex((c) => c.deviceId === selectedCameraId);
    const nextIdx = (currentIdx + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIdx].deviceId);
  };

  const openInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  if (!active) {
    return (
      <div className="absolute inset-0 bg-[#0A0D14] flex flex-col items-center justify-center p-8 text-center border-b border-gray-950">
        <Video className="w-16 h-16 text-gray-700 mb-4 animate-pulse" />
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
          Câmera Inativa.<br />Toque no botão para iniciar a leitura.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      {/* HTML5 Live Video Feed */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        autoPlay
        muted
      />

      {/* Camera overlay guide with targeted laser animation */}
      {active && !error && !isInitializing && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
          <div className="w-full text-center pt-16">
            <span className="text-[10px] font-black uppercase tracking-wider bg-black/60 text-white px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-xs">
              Aponte a webcam para o QR Code na tela
            </span>
          </div>

          {/* Central Target bracket guide */}
          <div className="relative w-64 h-56 mx-auto self-center border-2 border-white/20 rounded-2xl flex items-center justify-center overflow-hidden">
            {/* Holographic Laser lines */}
            <div className="w-full h-0.5 bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-scanner-laser absolute" />
          </div>

          <div className="w-full text-center pb-20">
            {cameras.length > 1 && (
              <button
                onClick={handleCameraCycle}
                className="pointer-events-auto mx-auto px-4 py-2.5 rounded-xl bg-black/70 text-white border border-white/10 text-xs font-bold flex items-center gap-2 backdrop-blur-xs active:scale-95 transition-all shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Alternar Câmera ({cameras.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Initializing indicator */}
      {isInitializing && (
        <div className="absolute inset-0 bg-[#0A0D14] flex flex-col items-center justify-center p-8 text-center z-10">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mb-3" />
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
            Conectando à câmera do Notebook...
          </p>
        </div>
      )}

      {/* Permissions or Hardware failure alert */}
      {(hasPermission === false || error) && (
        <div className="absolute inset-0 bg-[#0A0D14] flex flex-col items-center justify-center p-6 text-center z-20 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shadow-sm mx-auto">
            <CameraOff className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <h3 className="text-sm font-black text-white uppercase tracking-wide">Câmera Não Detectada / Bloqueada</h3>
            <p className="text-xs text-gray-300 font-medium leading-relaxed">
              {error || 'O navegador ou sistema Ubuntu bloqueou o acesso à webcam.'}
            </p>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-left text-[11px] text-gray-400 space-y-1 mt-2">
              <div className="flex items-center gap-1.5 font-bold text-gray-300">
                <Info className="w-3.5 h-3.5 text-orange-400" />
                <span>Dicas para Ubuntu / HP Notebook:</span>
              </div>
              <p>• Clique no ícone de 🔒 na barra do navegador e permita a Câmera.</p>
              <p>• Se estiver usando o modo iFrame, abra a aplicação em uma aba própria.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs pt-1">
            <button
              onClick={initCameraSystem}
              className="flex-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
            >
              <Camera className="w-4 h-4" />
              <span>Tentar Novamente</span>
            </button>
            <button
              onClick={openInNewTab}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 active:scale-95 transition-all border border-slate-700"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Abrir em Nova Aba</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


