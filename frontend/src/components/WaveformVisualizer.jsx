import { motion } from "framer-motion";

const WaveformVisualizer = () => {
  const bars = Array.from({ length: 24 }, (_, i) => ({
    height: Math.random() * 24 + 8,
    delay: i * 0.08,
  }));

  return (
    <div className="flex items-end justify-center gap-[3px] h-10">
      {bars.map((bar, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-primary/60"
          style={{ "--wave-height": `${bar.height}px` }}
          animate={{ height: [12, bar.height, 12] }}
          transition={{ duration: 1.2 + Math.random() * 0.8, repeat: Infinity, delay: bar.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
};

export default WaveformVisualizer;
