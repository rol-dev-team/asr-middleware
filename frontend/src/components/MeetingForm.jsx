// import { useState } from "react";
// import { motion } from "framer-motion";
// import { Mic, ArrowRight, Shield, Radio } from "lucide-react";
// import WaveformVisualizer from "./WaveformVisualizer";

// const MeetingForm = ({ onStart, user }) => {
//   const [title, setTitle] = useState("");
//   const [isFocused, setIsFocused] = useState(false);

//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 40 }}
//       animate={{ opacity: 1, y: 0 }}
//       transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
//       className="relative w-full max-w-lg mx-auto"
//     >
//       <div className="relative rounded-3xl border border-border/50 glass-strong p-8 md:p-10 gradient-border ambient-glow overflow-hidden">
//         <div className="absolute top-4 right-4 flex gap-1.5">
//           <div className="h-2 w-2 rounded-full bg-destructive/60" />
//           <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
//           <div className="h-2 w-2 rounded-full bg-primary/50" />
//         </div>
//         <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="relative z-10 mb-8">
//           <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary animate-float">
//             <Mic className="h-7 w-7 text-primary" />
//           </div>
//           <WaveformVisualizer />
//         </motion.div>
//         <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="relative z-10 text-center mb-8">
//           <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">
//             Start a New <span className="text-gradient">Meeting</span>
//           </h1>
//           <p className="text-sm text-muted-foreground max-w-xs mx-auto">Enter a title and we'll handle recording, transcription, and analysis</p>
//         </motion.div>
//         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, ease: [0.22, 1, 0.36, 1] }} className="relative z-10 space-y-4">
//           <div>
//             {/* <label className="mb-2 block text-xs font-semibold tracking-wider uppercase text-muted-foreground font-mono">Meeting Title <span className="text-primary">*</span></label> */}
//             <div className="relative">
//   <input
//     type="text"
//     value={title}
//     onChange={(e) => setTitle(e.target.value)}
//     placeholder=""
//     className="peer w-full rounded-xl border border-border bg-secondary/40 px-4 py-3.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
//   />

//   {!title && (
//     <label className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold tracking-wider uppercase font-mono text-muted-foreground/60 pointer-events-none">
//       Meeting Title <span className="text-primary">*</span>
//     </label>
//   )}
// </div>

//           </div>
        
//           <button disabled={!title.trim()} onClick={() => onStart?.(title.trim())} className="shine group relative w-full rounded-xl btn-gradient px-6 py-4 text-sm font-bold text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
//             <span className="relative z-10 flex items-center justify-center gap-2.5">
//               <Mic className="h-4 w-4" />
//               Start Recording
//               <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
//             </span>
//           </button>
//           <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/30 p-3.5">
//             <Shield className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
//             <p className="text-[11px] text-muted-foreground leading-relaxed">
//               <span className="font-semibold text-foreground">Note:</span> Microphone permission required. Audio is securely processed for transcription & analysis.
//             </p>
//           </div>
//         </motion.div>
//       </div>
//     </motion.div>
//   );
// };

// export default MeetingForm;


import { useState } from "react";
import { motion } from "framer-motion";
import { Mic, ArrowRight, Shield } from "lucide-react";
import WaveformVisualizer from "./WaveformVisualizer";

const MeetingForm = ({ onStart, user }) => {
  const [title, setTitle] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-lg"
    >
      <div className="relative rounded-3xl border border-border/50 glass-strong p-8 md:p-10 gradient-border ambient-glow overflow-hidden">
        <div className="absolute top-4 right-4 flex gap-1.5">
          <div className="h-2 w-2 rounded-full bg-destructive/60" />
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <div className="h-2 w-2 rounded-full bg-primary/50" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="relative z-10 mb-8"
        >
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-primary animate-float">
            <Mic className="h-7 w-7 text-primary" />
          </div>
          <WaveformVisualizer />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative z-10 text-center mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-2">
            Start a New <span className="text-gradient">Meeting</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Enter a title and we'll handle recording, transcription, and analysis
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 space-y-4"
        >
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
              className="peer w-full rounded-xl border border-border bg-secondary/40 px-4 py-3.5 text-sm text-foreground focus:outline-none focus:border-primary/50"
            />
            {!title && (
              <label className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-semibold tracking-wider uppercase font-mono text-muted-foreground/60 pointer-events-none">
                Meeting Title <span className="text-primary">*</span>
              </label>
            )}
          </div>

          <button
            disabled={!title.trim()}
            onClick={() => onStart?.(title.trim())}
            className="shine group relative w-full rounded-xl btn-gradient px-6 py-4 text-sm font-bold text-primary-foreground disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            <span className="relative z-10 flex items-center justify-center gap-2.5">
              <Mic className="h-4 w-4" />
              Start Recording
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </button>
          <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/30 p-3.5">
            <Shield className="mt-0.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Note:</span> Microphone permission required. Audio is
              securely processed for transcription & analysis.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default MeetingForm;
