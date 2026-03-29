// import { motion } from "framer-motion";
// import { Clock, Users, FileDown } from "lucide-react";

// const StatusCard = ({ isRecording, isAnalyzing, isAnalyzed }) => {
//   return (
//     <div className="rounded-2xl border border-border/50 glass p-4 flex flex-col gap-3 flex-1">
//       <div className="flex items-center gap-2">
//         <div className={`h-2 w-2 rounded-full ${isRecording ? "bg-destructive animate-pulse" : isAnalyzing ? "bg-primary animate-pulse" : isAnalyzed ? "bg-green-500" : "bg-muted-foreground/30"}`} />
//         <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
//           {isRecording ? "Recording" : isAnalyzing ? "Analyzing..." : isAnalyzed ? "Complete" : "Waiting"}
//         </span>
//       </div>
//       {isAnalyzed && (
//         <div className="space-y-3">
//           <div className="space-y-1.5">
//             <div className="flex justify-between text-[10px] font-mono text-muted-foreground"><span>Sections</span><span className="text-foreground">6/6</span></div>
//             <div className="h-1 rounded-full bg-secondary overflow-hidden"><div className="h-full w-full rounded-full bg-primary transition-all duration-1000" /></div>
//           </div>
//           <div className="border-t border-border/30 pt-3 space-y-2.5">
//             {[
//               { label: "Duration", value: "1m 02s", icon: Clock },
//               { label: "Speakers", value: "3 detected", icon: Users },
//               { label: "File Size", value: "1.2 MB", icon: FileDown },
//             ].map((stat) => (
//               <div key={stat.label} className="flex items-center justify-between">
//                 <div className="flex items-center gap-1.5"><stat.icon className="h-3 w-3 text-muted-foreground/50" /><span className="text-[10px] font-mono text-muted-foreground">{stat.label}</span></div>
//                 <span className="text-[10px] font-mono font-medium text-foreground">{stat.value}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}
//       {isAnalyzing && (
//         <div className="space-y-1.5">
//           <div className="h-1 rounded-full bg-secondary overflow-hidden">
//             <motion.div className="h-full rounded-full bg-primary" initial={{ width: "0%" }} animate={{ width: "70%" }} transition={{ duration: 2.5, ease: "easeOut" }} />
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default StatusCard;

import { motion } from "framer-motion";
import { Clock, Users, FileDown } from "lucide-react";

const formatDuration = (seconds) => {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatFileSize = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getSpeakerCount = (transcriptionText) => {
  if (!transcriptionText) return null;
  const matches = transcriptionText.match(/Speaker \d+/g);
  if (!matches) return null;
  return new Set(matches).size;
};

const StatusCard = ({
  isRecording,
  isAnalyzing,
  isAnalyzed,
  transcriptionRecord,
  recordingDuration,
}) => {
  const speakerCount = getSpeakerCount(transcriptionRecord?.transcription_text);
  const fileSize = formatFileSize(transcriptionRecord?.file_size);
  const duration = formatDuration(recordingDuration);

  return (
    <div className="rounded-2xl border border-border/50 glass p-4 flex flex-col gap-3 flex-1">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${
          isRecording ? "bg-destructive animate-pulse"
          : isAnalyzing ? "bg-primary animate-pulse"
          : isAnalyzed ? "bg-green-500"
          : "bg-muted-foreground/30"
        }`} />
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {isRecording ? "Recording" : isAnalyzing ? "Analyzing..." : isAnalyzed ? "Complete" : "Waiting"}
        </span>
      </div>

      {isAnalyzed && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>Sections</span><span className="text-foreground">6/6</span>
            </div>
            <div className="h-1 rounded-full bg-secondary overflow-hidden">
              <div className="h-full w-full rounded-full bg-primary transition-all duration-1000" />
            </div>
          </div>
          <div className="border-t border-border/30 pt-3 space-y-2.5">
            {[
              { label: "Duration", value: duration, icon: Clock },
              { label: "Speakers", value: speakerCount ? `${speakerCount} detected` : "—", icon: Users },
              { label: "File Size", value: fileSize, icon: FileDown },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <stat.icon className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-[10px] font-mono text-muted-foreground">{stat.label}</span>
                </div>
                <span className="text-[10px] font-mono font-medium text-foreground">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="space-y-1.5">
          <div className="h-1 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: "0%" }}
              animate={{ width: "70%" }}
              transition={{ duration: 2.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusCard;
