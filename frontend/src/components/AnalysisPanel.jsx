import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import TranscriptPanel from "./analysis/TranscriptPanel";
import StatusCard from "./analysis/StatusCard";
import ExportsCard from "./analysis/ExportsCard";
import FullAnalysis from "./analysis/FullAnalysis";
import DocumentPreview from "./analysis/DocumentPreview";
import ShareSection from "./analysis/ShareSection";
import { transcribeAudio, parseTranscriptionToMessages } from "@/api/audioApi";

const AnalysisPanel = ({
  audioBlob,
  isRecording,
  meetingTitle = "Untitled",
  recordingDuration = null,
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [transcriptMessages, setTranscriptMessages] = useState([]);
  const [rawTranscription, setRawTranscription] = useState("");
  const [transcriptionRecord, setTranscriptionRecord] = useState(null); // full DB record
  const [error, setError] = useState(null);

  // Guard against re-triggering if audioBlob reference changes but upload already ran
  const hasUploadedRef = useRef(false);

  useEffect(() => {
    if (!audioBlob || isRecording || hasUploadedRef.current) return;

    hasUploadedRef.current = true;

    const runTranscription = async () => {
      setIsAnalyzing(true);
      setIsAnalyzed(false);
      setError(null);

      try {
        const record = await transcribeAudio(audioBlob, meetingTitle);

        setTranscriptionRecord(record);
        setRawTranscription(record.transcription_text);

        // Parse the Gemini-returned Banglish transcription into chat messages
        const messages = parseTranscriptionToMessages(record.transcription_text);
        setTranscriptMessages(messages);

        setIsAnalyzed(true);
      } catch (err) {
        const detail = err.response?.data?.detail;
        setError(
          typeof detail === "string"
            ? detail
            : "Transcription failed. Please try again."
        );
      } finally {
        setIsAnalyzing(false);
      }
    };

    runTranscription();
  }, [audioBlob, isRecording, meetingTitle]);

  // Serialize messages to JSON string — TranscriptPanel does JSON.parse internally
  const transcriptContent = isAnalyzed
    ? JSON.stringify(transcriptMessages)
    : "The full conversation transcript will appear here after analysis...";

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="w-full mt-6 flex flex-col gap-4 px-2"
    >
      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium"
        >
          ⚠ {error}
        </motion.div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <TranscriptPanel
          isAnalyzing={isAnalyzing}
          isAnalyzed={isAnalyzed}
          transcriptContent={transcriptContent}
          messageCount={transcriptMessages.length}
          speakerCount={new Set(transcriptMessages.map((m) => m.speaker)).size}
        />
        <div className="lg:flex-1 flex flex-col gap-3 lg:self-stretch">
          {/* <StatusCard
            isRecording={isRecording}
            isAnalyzing={isAnalyzing}
            isAnalyzed={isAnalyzed}
          /> */}
          <StatusCard
            isRecording={isRecording}
            isAnalyzing={isAnalyzing}
            isAnalyzed={isAnalyzed}
            transcriptionRecord={transcriptionRecord}
            recordingDuration={recordingDuration}
          />
          <ExportsCard
            isRecording={isRecording}
            isAnalyzed={isAnalyzed}
            audioBlob={audioBlob}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <FullAnalysis isAnalyzed={isAnalyzed} />
        <DocumentPreview
          isAnalyzed={isAnalyzed}
          transcriptContent={transcriptContent}
        />
      </div>

      <ShareSection
        isAnalyzed={isAnalyzed}
        audioBlob={audioBlob}
        isRecording={isRecording}
        meetingTitle={meetingTitle} 
      />
    </motion.div>
  );
};

export default AnalysisPanel;
