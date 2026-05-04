// import { motion } from "framer-motion";
// import { Mic, FileText, Brain, Zap, ChevronRight } from "lucide-react";

// const steps = [
//   { icon: Mic, label: "Record", desc: "Capture meeting audio", color: "text-primary" },
//   { icon: FileText, label: "Transcribe", desc: "Speech-to-text AI", color: "text-accent" },
//   { icon: Brain, label: "Analyze", desc: "Extract insights", color: "text-primary" },
//   { icon: Zap, label: "Deliver", desc: "Actionable notes", color: "text-accent" },
// ];

// const FeatureStrip = () => {
//   return (
//     <motion.div
//       initial={{ opacity: 0, y: 20 }}
//       animate={{ opacity: 1, y: 0 }}
//       transition={{ delay: 0.8, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
//       className="mt-14 w-full max-w-2xl mx-auto"
//     >
//       <div className="flex items-center justify-center gap-2 mb-6">
//         <div className="h-px flex-1 bg-border/50" />
//         <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pipeline</span>
//         <div className="h-px flex-1 bg-border/50" />
//       </div>
//       <div className="flex items-center justify-center gap-2 md:gap-3">
//         {steps.map((step, i) => (
//           <motion.div
//             key={step.label}
//             initial={{ opacity: 0, scale: 0.9 }}
//             animate={{ opacity: 1, scale: 1 }}
//             transition={{ delay: 0.9 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
//             className="flex items-center gap-2 md:gap-3"
//           >
//             <div className="group relative flex flex-col items-center gap-2 rounded-2xl border border-border/50 glass p-4 md:px-5 md:py-4 text-center transition-all duration-300 hover:border-primary/30 hover:glow-primary cursor-default">
//               <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/8 transition-colors group-hover:bg-primary/15">
//                 <step.icon className={`h-4 w-4 ${step.color}`} />
//               </div>
//               <span className="text-[11px] font-bold font-mono text-foreground">{step.label}</span>
//               <span className="text-[9px] text-muted-foreground leading-tight hidden md:block">{step.desc}</span>
//             </div>
//             {i < steps.length - 1 && (
//               <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
//             )}
//           </motion.div>
//         ))}
//       </div>
//     </motion.div>
//   );
// };

// export default FeatureStrip;


import { motion } from "framer-motion";
import { Mic, FileText, Brain, Zap } from "lucide-react";

const steps = [
  { icon: Mic, label: "Record", desc: "Capture meeting audio in real-time", color: "text-primary", num: "01" },
  { icon: FileText, label: "Transcribe", desc: "AI-powered speech-to-text", color: "text-accent", num: "02" },
  { icon: Brain, label: "Analyze", desc: "Extract key insights & actions", color: "text-primary", num: "03" },
  { icon: Zap, label: "Deliver", desc: "Share polished notes instantly", color: "text-accent", num: "04" },
];

const FeatureStrip = () => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-sm flex flex-col justify-center"
    >
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mb-6"
      >
        <p className="text-[10px] font-mono font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-2">How it works</p>
        <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
          From voice to <span className="text-gradient">insight</span>
        </h2>
      </motion.div>

      {/* Vertical step list */}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <motion.div
            key={step.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="group flex items-center gap-4 rounded-2xl border border-border/40 glass p-4 transition-all duration-300 hover:border-primary/30 hover:glow-primary cursor-default"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 transition-colors group-hover:bg-primary/15 shrink-0">
              <step.icon className={`h-[18px] w-[18px] ${step.color}`} />
              <span className="absolute -top-1 -right-1 text-[8px] font-mono font-bold text-muted-foreground/40 bg-background rounded-full h-4 w-4 flex items-center justify-center border border-border/50">{step.num}</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold font-mono text-foreground leading-tight">{step.label}</h3>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{step.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default FeatureStrip;
