import { Brain, Lightbulb, Cpu, Hash, StickyNote, AudioLines, FileType, ArrowRightFromLine, BarChart3 } from "lucide-react";

export const tabs = [
  { key: "summary", label: "Summary", icon: Brain },
  { key: "business", label: "Business Insights", icon: Lightbulb },
  { key: "technical", label: "Technical Insights", icon: Cpu },
  { key: "topics", label: "Key Topics", icon: Hash },
  { key: "notes", label: "Notes", icon: StickyNote },
];

export const placeholderContent = {
  summary: "A concise summary of your meeting will appear here after analysis...",
  business: "Business-relevant insights, action items, and strategic takeaways will be extracted here...",
  technical: "Technical discussions, architecture decisions, and implementation details will be highlighted here...",
  topics: "Key topics, themes, and discussion points will be identified and listed here...",
  notes: "Structured markdown notes with headers, bullet points, and action items will be generated here...",
};

export const transcriptPlaceholder = "The full conversation transcript will appear here after analysis...";

export const mockAnalyzedContent = {
  transcript: JSON.stringify([
    { speaker: "Alex", time: "00:00", text: "Good morning everyone, let's get started with our weekly standup." },
    { speaker: "Jordan", time: "00:05", text: "Sure. I've been working on the authentication module. The OAuth2 integration is nearly complete — just need to handle the refresh token flow." },
    { speaker: "Alex", time: "00:18", text: "Great progress. Any blockers?" },
    { speaker: "Jordan", time: "00:21", text: "The only thing is we need the API keys from the third-party provider. I've submitted the request but haven't heard back yet." },
    { speaker: "Sam", time: "00:30", text: "On my end, the dashboard redesign is about 70% done. I'm implementing the new chart components using Recharts. The real-time data feed is working well." },
    { speaker: "Alex", time: "00:45", text: "Excellent. Let's make sure we have the responsive breakpoints covered. Any concerns about the timeline?" },
    { speaker: "Sam", time: "00:52", text: "We should be on track for the Friday demo if the design review happens by Wednesday." },
    { speaker: "Alex", time: "01:02", text: "Perfect. I'll schedule that review. Let's wrap up — everyone knows their priorities." },
  ]),
  summary: `## Meeting Summary\n\n**Date:** ${new Date().toLocaleDateString()}\n**Duration:** ~1 minute\n**Participants:** 3 speakers\n\n### Key Points\n- OAuth2 authentication integration is near completion\n- Dashboard redesign at 70% progress with Recharts implementation\n- API keys pending from third-party provider\n- Design review needed by Wednesday for Friday demo\n\n### Action Items\n1. ⏳ Follow up on third-party API key request\n2. 📅 Schedule design review by Wednesday\n3. ✅ Ensure responsive breakpoints are covered`,
  business: `## Business Insights\n\n### Timeline Risk: Low\nThe team appears on track for the Friday demo, contingent on the Wednesday design review.\n\n### Dependencies\n- **External:** Third-party API key delivery is a potential bottleneck\n- **Internal:** Design review scheduling is critical path\n\n### Resource Utilization\n- Team is working efficiently across parallel workstreams\n- No resource conflicts identified\n\n### Recommendations\n- Escalate the API key request if no response by EOD\n- Consider a backup auth implementation in case of delay`,
  technical: `## Technical Insights\n\n### Architecture Decisions\n- **OAuth2 with refresh tokens** — Standard implementation for secure token management\n- **Recharts for visualization** — Good choice for React-based real-time charts\n\n### Implementation Notes\n- Refresh token flow needs careful handling of token rotation\n- Real-time data feed is operational — consider WebSocket vs polling tradeoffs\n- Responsive breakpoints should follow mobile-first approach\n\n### Code Quality Considerations\n- Ensure OAuth2 state parameter is validated to prevent CSRF\n- Chart components should be memoized for performance with real-time data`,
  topics: `## Key Topics Discussed\n\n1. **Authentication & Security** — OAuth2 integration, refresh tokens, API keys\n2. **UI/UX Development** — Dashboard redesign, chart components, responsive design\n3. **Project Timeline** — Friday demo, Wednesday design review\n4. **External Dependencies** — Third-party API key request\n5. **Team Coordination** — Standup format, priority alignment`,
  notes: `# Meeting Notes — Weekly Standup\n\n## 🔐 Authentication Module\n- OAuth2 integration ~95% complete\n- **Blocker:** Awaiting third-party API keys\n- TODO: Handle refresh token rotation\n\n## 📊 Dashboard Redesign\n- Progress: 70%\n- Using Recharts for chart components\n- Real-time data feed ✅\n- [ ] Responsive breakpoints\n- [ ] Design review (schedule by Wed)\n\n## 📋 Action Items\n- [ ] Follow up on API keys — *Speaker 2*\n- [ ] Schedule design review — *Speaker 1*\n- [ ] Complete responsive layouts — *Speaker 3*\n\n## 📅 Next Milestone\n**Friday Demo** — Requires design review approval by Wednesday`,
};

export const allSectionKeys = [
  { key: "summary", label: "Summary" },
  { key: "business", label: "Business Insights" },
  { key: "technical", label: "Technical Insights" },
  { key: "topics", label: "Key Topics" },
  { key: "notes", label: "Notes" },
];

export const shareOptions = [
  { key: "audio", label: "Audio Recording", icon: AudioLines, desc: ".mp3", needsAnalysis: false, needsAudio: true },
  { key: "transcript", label: "Transcription", icon: FileType, desc: ".txt", needsAnalysis: true, needsAudio: false },
  { key: "translation", label: "Translation (EN)", icon: ArrowRightFromLine, desc: ".txt", needsAnalysis: true, needsAudio: false },
  { key: "analysis", label: "Full Analysis", icon: BarChart3, desc: ".txt", needsAnalysis: true, needsAudio: false },
];

const speakerColors = {};
const colorPalette = [
  "bg-primary/10 text-primary",
  "bg-accent/10 text-accent",
  "bg-green-500/10 text-green-600 dark:text-green-400",
  "bg-orange-500/10 text-orange-600 dark:text-orange-400",
];

export function getSpeakerColor(speaker) {
  if (!speakerColors[speaker]) {
    const idx = Object.keys(speakerColors).length % colorPalette.length;
    speakerColors[speaker] = colorPalette[idx];
  }
  return speakerColors[speaker];
}
