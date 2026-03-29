import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Pause, Square, Play, Mic, Monitor } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BAR_COUNT = 48;

const RecordingBar = ({ title, onStop }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordingStarted, setRecordingStarted] = useState(false);
  const [showStopDialog, setShowStopDialog] = useState(false);
  const [hasSystemAudio, setHasSystemAudio] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioCtxRef = useRef(null);
  const streamsRef = useRef([]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const barWidth = w / BAR_COUNT;
      const gap = 2;
      const step = Math.floor(bufferLength / BAR_COUNT);
      for (let i = 0; i < BAR_COUNT; i++) {
        const value = dataArray[i * step] / 255;
        const barHeight = Math.max(3, value * h * 0.9);
        const ratio = i / BAR_COUNT;
        const r = Math.round(59 + ratio * 20);
        const g = Math.round(130 + ratio * 50);
        const b = Math.round(246 - ratio * 30);
        const alpha = 0.5 + value * 0.5;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        const x = i * barWidth + gap / 2;
        const bw = barWidth - gap;
        const radius = bw / 2;
        const y = (h - barHeight) / 2;
        ctx.roundRect(x, y, bw, barHeight, radius);
        ctx.fill();
      }
    };
    draw();
  }, []);

  const drawMockWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let phase = 0;
    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      phase += 0.05;
      const barWidth = w / BAR_COUNT;
      const gap = 2;
      for (let i = 0; i < BAR_COUNT; i++) {
        const value = 0.15 + 0.35 * Math.sin(phase + i * 0.3) * Math.sin(phase * 0.7 + i * 0.15);
        const barHeight = Math.max(3, Math.abs(value) * h * 0.85);
        const ratio = i / BAR_COUNT;
        const r = Math.round(59 + ratio * 20);
        const g = Math.round(130 + ratio * 50);
        const b = Math.round(246 - ratio * 30);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.4 + Math.abs(value) * 0.4})`;
        ctx.beginPath();
        const x = i * barWidth + gap / 2;
        const bw = barWidth - gap;
        const radius = bw / 2;
        const y = (h - barHeight) / 2;
        ctx.roundRect(x, y, bw, barHeight, radius);
        ctx.fill();
      }
    };
    draw();
  };

  useEffect(() => {
    const allStreams = [];

    const startRecording = async () => {
      try {
        // Get microphone audio
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        allStreams.push(micStream);

        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;

        const micSource = audioCtx.createMediaStreamSource(micStream);

        // Create a destination to mix all audio sources
        const destination = audioCtx.createMediaStreamDestination();

        // Connect mic to destination
        micSource.connect(destination);

        // Try to get system/tab audio via getDisplayMedia
        let systemStream = null;
        try {
          systemStream = await navigator.mediaDevices.getDisplayMedia({
            video: true, // required by browsers, we'll ignore video track
            audio: true,
          });
          allStreams.push(systemStream);

          const systemAudioTracks = systemStream.getAudioTracks();
          if (systemAudioTracks.length > 0) {
            const systemSource = audioCtx.createMediaStreamSource(
              new MediaStream(systemAudioTracks)
            );
            systemSource.connect(destination);
            setHasSystemAudio(true);
          }

          // Stop the video track since we only need audio
          systemStream.getVideoTracks().forEach((t) => t.stop());

          // If the user stops screen sharing, handle gracefully
          systemStream.getAudioTracks().forEach((track) => {
            track.onended = () => setHasSystemAudio(false);
          });
        } catch {
          // User declined screen share or browser doesn't support it
          console.info("System audio not available, recording mic only");
        }

        // Set up analyser for visualization on the mixed output
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.75;
        micSource.connect(analyser);
        analyserRef.current = analyser;

        // Record the mixed destination stream
        const mediaRecorder = new MediaRecorder(destination.stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorder.start(100);
        streamsRef.current = allStreams;
        setRecordingStarted(true);
        drawWaveform();
      } catch {
        console.warn("Microphone access denied, recording in mock mode");
        setRecordingStarted(true);
        drawMockWaveform();
      }
    };

    startRecording();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      allStreams.forEach((s) => s.getTracks().forEach((t) => t.stop()));
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [drawWaveform]);

  useEffect(() => {
    if (!recordingStarted) return;

    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      mediaRecorderRef.current?.pause();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    } else {
      intervalRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
      if (mediaRecorderRef.current?.state === "paused") {
        mediaRecorderRef.current.resume();
      }
      if (analyserRef.current) { drawWaveform(); } else { drawMockWaveform(); }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isPaused, drawWaveform, recordingStarted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) { canvas.width = parent.clientWidth * 2; canvas.height = parent.clientHeight * 2; }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const handleStop = () => setShowStopDialog(true);

  const confirmStop = () => {
    setShowStopDialog(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Stop all streams
    streamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        onStop(blob, elapsed);
      };
      recorder.stop();
    } else {
      onStop(new Blob([], { type: "audio/webm" }), elapsed);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div initial={{ opacity: 0, y: -20, scaleY: 0.8 }} animate={{ opacity: 1, y: 0, scaleY: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="w-full px-2">
      <div className="relative rounded-2xl border border-border/50 glass-strong gradient-border overflow-hidden">
        <div className="flex items-center justify-between gap-4 p-4 px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 shrink-0">
              <Mic className="h-4 w-4 text-destructive" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive animate-pulse-ring" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-mono uppercase tracking-wider text-destructive font-semibold">{!recordingStarted ? "Connecting…" : isPaused ? "Paused" : "Recording"}</p>
                {hasSystemAudio && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                    <Monitor className="h-2.5 w-2.5" /> Tab Audio
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold truncate text-foreground">{title}</p>
            </div>
          </div>
          <div className="font-mono text-2xl font-bold tracking-wider text-foreground tabular-nums">{formatTime(elapsed)}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsPaused(!isPaused)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/50 bg-secondary/50 text-foreground transition-all hover:bg-secondary hover:border-border">
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={handleStop} className="flex h-10 items-center gap-2 rounded-xl bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition-all hover:bg-destructive/90 hover:shadow-lg">
              <Square className="h-3.5 w-3.5" />Stop
            </button>
          </div>
        </div>
        <div className="relative w-full h-16 px-4 pb-3">
          <canvas ref={canvasRef} className="w-full h-full rounded-lg" style={{ imageRendering: "auto" }} />
          {isPaused && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-sm rounded-lg mx-4 mb-3">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Paused</span>
            </div>
          )}
        </div>
      </div>
      <AlertDialog open={showStopDialog} onOpenChange={setShowStopDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Recording?</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to stop recording? This will finalize the current session and begin analysis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowStopDialog(false)}>Continue Recording</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Stop & Analyze</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default RecordingBar;
