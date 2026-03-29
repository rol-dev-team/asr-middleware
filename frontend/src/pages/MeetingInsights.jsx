import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, Search, Calendar, Clock, Loader2, Timer, Users } from "lucide-react";
import Navbar from "@/components/Navbar";

import { mockAnalyzedContent } from "@/components/analysis/data";

const mockTranscript = [
  { speaker: "Alex", time: "00:00", text: "Good morning everyone, let's get started with our weekly standup." },
  { speaker: "Jordan", time: "00:05", text: "Sure. I've been working on the authentication module. The OAuth2 integration is nearly complete." },
  { speaker: "Sam", time: "00:30", text: "On my end, the dashboard redesign is about 70% done. I'm implementing the new chart components." },
  { speaker: "Alex", time: "01:02", text: "Perfect. I'll schedule that review. Let's wrap up — everyone knows their priorities." },
];

const mockMeetings = [
  { id: "1", meeting_title: "Sprint Planning Q1", created_at: "2026-03-28T10:30:00Z", duration_seconds: 1845, speakers: 4, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "2", meeting_title: "Product Roadmap Review", created_at: "2026-03-27T14:00:00Z", duration_seconds: 3200, speakers: 6, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "3", meeting_title: "Design System Sync", created_at: "2026-03-26T09:15:00Z", duration_seconds: 920, speakers: 3, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "4", meeting_title: "Client Onboarding Call", created_at: "2026-03-25T16:45:00Z", duration_seconds: 2400, speakers: 5, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "5", meeting_title: "Backend Architecture Discussion", created_at: "2026-03-24T11:00:00Z", duration_seconds: 4100, speakers: 4, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "6", meeting_title: "Marketing Strategy Brainstorm", created_at: "2026-03-23T13:30:00Z", duration_seconds: 2750, speakers: 7, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "7", meeting_title: "QA Testing Retrospective", created_at: "2026-03-22T10:00:00Z", duration_seconds: 1500, speakers: 5, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "8", meeting_title: "Investor Update Prep", created_at: "2026-03-21T15:00:00Z", duration_seconds: 3600, speakers: 3, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "9", meeting_title: "DevOps Pipeline Review", created_at: "2026-03-20T09:45:00Z", duration_seconds: 1200, speakers: 4, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "10", meeting_title: "Customer Feedback Debrief", created_at: "2026-03-19T14:30:00Z", duration_seconds: 2100, speakers: 6, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "11", meeting_title: "Security Audit Kickoff", created_at: "2026-03-18T11:15:00Z", duration_seconds: 1800, speakers: 4, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "12", meeting_title: "Hiring Panel Sync", created_at: "2026-03-17T16:00:00Z", duration_seconds: 2900, speakers: 5, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
  { id: "13", meeting_title: "API Integration Workshop", created_at: "2026-03-16T10:30:00Z", duration_seconds: 3400, speakers: 8, status: "completed", transcript: mockTranscript, analysis: mockAnalyzedContent },
];

function getInitials(title) {
  return title
    .split(" ")
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const initialsColors = [
  "bg-primary/15 text-primary",
  "bg-accent/15 text-accent",
  "bg-green-500/15 text-green-600 dark:text-green-400",
  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  "bg-purple-500/15 text-purple-600 dark:text-purple-400",
];

const MeetingInsights = ({ onLogout, user }) => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // TODO: Replace with real API call
    const timer = setTimeout(() => {
      setMeetings(mockMeetings);
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const filtered = meetings.filter((m) =>
    m.meeting_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleView = (meeting) => {
    navigate("/", { state: { meeting } });
  };

  const ITEMS_PER_PAGE = 6;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="relative h-screen bg-background overflow-hidden flex flex-col">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[10%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] h-[400px] w-[400px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <Navbar onLogout={onLogout} user={user} activePage="insights" />

      <main className="relative z-10 px-6 pt-24 pb-6 flex-1 flex flex-col max-w-full mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex-1 flex flex-col"
        >
          {/* Header + Search */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Meeting Insights</h1>
              <p className="text-sm text-muted-foreground mt-1">Browse and revisit your processed recordings</p>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border/50 bg-secondary/30 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Loading meetings...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No meetings match your search" : "No meetings recorded yet"}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2.5 flex-1">
                {paginated.map((meeting, idx) => (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                    className="group rounded-2xl border border-border/50 glass-strong gradient-border p-4 px-5 flex items-center gap-4 hover:border-primary/30 transition-all duration-200"
                  >
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${initialsColors[idx % initialsColors.length]}`}>
                      {getInitials(meeting.meeting_title)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{meeting.meeting_title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(meeting.created_at)}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(meeting.created_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Timer className="h-4.5 w-4.5 text-primary" />
                        {formatDuration(meeting.duration_seconds)}
                      </span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="h-4.5 w-4.5 text-accent" />
                        {meeting.speakers} speakers
                      </span>
                    </div>
                    <button
                      onClick={() => handleView(meeting)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200 opacity-70 group-hover:opacity-100"
                      title="View analysis"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 pt-4">
                  <span className="text-xs text-muted-foreground mr-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 rounded-lg border border-border/50 bg-secondary/30 text-foreground text-xs flex items-center justify-center hover:bg-primary/10 hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 rounded-lg border border-border/50 bg-secondary/30 text-foreground text-xs flex items-center justify-center hover:bg-primary/10 hover:text-primary disabled:opacity-40 disabled:pointer-events-none transition-all"
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default MeetingInsights;
