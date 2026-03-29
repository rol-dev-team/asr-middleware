import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import MeetingForm from "@/components/MeetingForm";
import RecordingBar from "@/components/RecordingBar";
import AnalysisPanel from "@/components/AnalysisPanel";
import FeatureStrip from "@/components/FeatureStrip";

const Index = ({ onLogout, user }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(null);
  const [recordingStopped, setRecordingStopped] = useState(false);

  const handleStartRecording = (title) => {
    setMeetingTitle(title);
    setIsRecording(true);
    setAudioBlob(null);
    setRecordingDuration(null);
    setRecordingStopped(false);
  };

  const handleStopRecording = (blob, duration) => {
    setAudioBlob(blob);
    setRecordingDuration(duration);
    setIsRecording(false);
    setRecordingStopped(true);
  };

  const showAnalysisView = isRecording || recordingStopped;

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] h-[400px] w-[400px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <Navbar onLogout={onLogout} user={user} />
      <main className="relative z-10 flex flex-col items-center px-4 pt-24 pb-16 min-h-screen">
        <AnimatePresence mode="wait">
          {!showAnalysisView ? (
            <div key="form" className="flex flex-row items-center justify-center flex-1 w-full gap-8">
  <FeatureStrip />
  <MeetingForm onStart={handleStartRecording} user={user} />
</div>
          ) : (
            <div key="recording" className="w-full flex flex-col gap-2">
              {isRecording && (
                <RecordingBar title={meetingTitle} onStop={handleStopRecording} />
              )}
              {recordingStopped && !isRecording && (
                <div className="w-full px-2">
                  <div className="rounded-2xl border border-border/50 glass-strong p-4 px-6 gradient-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
                        </div>
                        <div>
                          <p className="text-xs font-mono uppercase tracking-wider text-green-600 dark:text-green-400 font-semibold">Recording Saved</p>
                          <p className="text-sm font-semibold text-foreground">{meetingTitle}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => { setRecordingStopped(false); setAudioBlob(null); setRecordingDuration(null); }}
                        className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        New Recording
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <AnalysisPanel
                audioBlob={audioBlob}
                isRecording={isRecording}
                meetingTitle={meetingTitle}
                recordingDuration={recordingDuration}
              />
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Index;
