import { motion } from "framer-motion";
import { MessageSquare, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSpeakerColor } from "./data";

// const TranscriptChat = ({ messages }) => {
//   const speakerSides = {};
//   messages.forEach(({ speaker }) => {
//     if (!(speaker in speakerSides)) {
//       speakerSides[speaker] = Object.keys(speakerSides).length === 0 ? "left" : "right";
//     }
//   });

const TranscriptChat = ({ messages }) => {
  const speakerSides = {};
  let lastAssignedSide = "left";

  messages.forEach(({ speaker }) => {
    if (!(speaker in speakerSides)) {
      // New speaker gets opposite of whatever side was last assigned
      const newSide = lastAssignedSide === "left" ? "right" : "left";
      speakerSides[speaker] = newSide;
      lastAssignedSide = newSide;
    }
  });

  return (
    <div className="flex flex-col gap-3">
      {messages.map((msg, i) => {
        const isLeft = speakerSides[msg.speaker] === "left";
        const color = getSpeakerColor(msg.speaker);
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className={`flex flex-col gap-1 ${isLeft ? "items-start" : "items-end"}`}
          >
            {/* Speaker chip */}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${color}`}>
              {msg.speaker}
            </span>

            {/* Chat bubble */}
            <div
              className={`max-w-[80%] rounded-2xl ${
                isLeft ? "rounded-tl-md" : "rounded-tr-md"
              } bg-gray-50 border border-border/20 px-4 py-2.5 shadow-sm`}
            >
              <p className="text-sm text-foreground/90 leading-relaxed">{msg.text}</p>
              <p className={`text-[10px] font-mono text-muted-foreground/50 mt-1.5 ${isLeft ? "text-left" : "text-right"}`}>
                {msg.time}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

const ChatSkeleton = () => {
  const rows = [
    { isLeft: true, width: "w-[65%]", lines: 2 },
    { isLeft: false, width: "w-[50%]", lines: 1 },
    { isLeft: true, width: "w-[75%]", lines: 3 },
    { isLeft: false, width: "w-[55%]", lines: 2 },
    { isLeft: true, width: "w-[45%]", lines: 1 },
    { isLeft: false, width: "w-[70%]", lines: 2 },
  ];

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.35 }}
          className={`flex flex-col gap-1 ${row.isLeft ? "items-start" : "items-end"}`}
        >
          {/* Speaker chip skeleton */}
          <div className="h-4 w-16 rounded-md bg-muted/60 animate-pulse" />

          {/* Bubble skeleton */}
          <div
            className={`${row.width} rounded-2xl ${
              row.isLeft ? "rounded-tl-md" : "rounded-tr-md"
            } bg-secondary/40 border border-border/20 px-4 py-3 flex flex-col gap-1.5`}
          >
            {Array.from({ length: row.lines }).map((_, li) => (
              <div
                key={li}
                className={`h-2.5 rounded-full bg-muted/60 animate-pulse ${
                  li === row.lines - 1 && row.lines > 1 ? "w-3/5" : "w-full"
                }`}
                style={{ animationDelay: `${(i * row.lines + li) * 80}ms` }}
              />
            ))}
            {/* Timestamp skeleton */}
            <div className={`h-2 w-10 rounded-full bg-muted/40 animate-pulse mt-1 ${row.isLeft ? "self-start" : "self-end"}`} />
          </div>
        </motion.div>
      ))}
    </div>
  );
};

const TranscriptPanel = ({
  isAnalyzing,
  isAnalyzed,
  transcriptContent,
  messageCount = 0,
  speakerCount = 0,
}) => {
  const messages = (() => {
    if (!isAnalyzed) return [];
    try {
      return JSON.parse(transcriptContent);
    } catch {
      return [];
    }
  })();

  const subtitleText = isAnalyzing
    ? "Transcribing conversation..."
    : isAnalyzed
    ? `${messageCount} message${messageCount !== 1 ? "s" : ""} • ${speakerCount} speaker${speakerCount !== 1 ? "s" : ""}`
    : "Awaiting analysis...";

  return (
    <div className="lg:flex-[3] rounded-2xl border border-border/50 glass-strong gradient-border overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-3 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Full Transcript</h3>
            <p className="text-[11px] text-muted-foreground">{subtitleText}</p>
          </div>
        </div>
        {isAnalyzing && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-medium text-primary">Processing</span>
          </div>
        )}
        {isAnalyzed && !isAnalyzing && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Ready</span>
          </div>
        )}
      </div>

      <div className="px-3 pb-5 pt-1 flex-1">
        <ScrollArea className="h-[420px] rounded-xl bg-white border border-border/20 p-4">
          <div className="min-h-[300px]">
            {isAnalyzing ? (
              <ChatSkeleton />
            ) : isAnalyzed && messages.length > 0 ? (
              <TranscriptChat messages={messages} />
            ) : isAnalyzed && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[300px] gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
                  <FileText className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground max-w-[220px]">
                  No transcript lines could be parsed from the response.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50">
                  <FileText className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground max-w-[220px]">
                  The full conversation transcript will appear here after analysis.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default TranscriptPanel;