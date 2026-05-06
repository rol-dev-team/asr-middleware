import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { tabs, placeholderContent, mockAnalyzedContent } from "./data";

const FullAnalysis = ({ isAnalyzed }) => {
  const [activeTab, setActiveTab] = useState("summary");

  const otherSectionsContent = isAnalyzed
    ? mockAnalyzedContent[activeTab]
    : placeholderContent[activeTab];

  return (
    <div className="lg:flex-1 rounded-2xl border border-border/50 glass-strong gradient-border overflow-hidden flex flex-col">
      <div className="flex items-center gap-1 px-4 pt-4 pb-2 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all duration-200 ${activeTab === tab.key ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}>
            <tab.icon className="h-3.5 w-3.5" />{tab.label}
          </button>
        ))}
      </div>
      <div className="px-3 pb-3 pt-1 flex-1 min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex-1 min-h-0">
            <ScrollArea className="h-[400px] lg:h-full rounded-xl bg-background/50 border border-border/20 p-4">
              <div className="min-h-[200px]">
                {isAnalyzed ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-h2:text-2xl prose-h2:font-semibold prose-h2:mt-8 prose-h2:mb-6 prose-h3:text-xl prose-h3:font-medium prose-h3:mt-6 prose-h3:mb-4 prose-p:text-base prose-p:text-foreground/85 prose-p:mb-4 prose-li:text-foreground/85 prose-li:text-base prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-hr:border-border/30">
                    <ReactMarkdown components={{
                      h1: ({ children }) => <h1 className="text-xl font-semibold mt-4 mb-3 text-foreground">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-2 text-foreground">{children}</h3>,
                      p: ({ children }) => <p className="text-sm leading-relaxed mb-3 text-foreground/85">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-1 text-sm">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-1 text-sm">{children}</ol>,
                      li: ({ children }) => <li className="text-sm leading-relaxed text-foreground/85">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    }}>{otherSectionsContent}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground italic">{otherSectionsContent}</p>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FullAnalysis;
