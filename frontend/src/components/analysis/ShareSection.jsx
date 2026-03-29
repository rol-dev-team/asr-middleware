import { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Mail, Send, Loader2, Paperclip, Plus, X, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import RichTextEditor from "@/components/RichTextEditor";
import { shareOptions } from "./data";

const SEND_EMAIL_API = "/api/send-email";

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const ShareSection = ({ isAnalyzed, audioBlob, isRecording, meetingTitle }) => {
  const [emails, setEmails] = useState([]);
  const [emailInput, setEmailInput] = useState("");
  const [bodyContent, setBodyContent] = useState(null);
  const [selected, setSelected] = useState(new Set(["analysis"]));
  const [sending, setSending] = useState(false);
  const emailInputRef = useRef(null);

  const addEmail = (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      toast({ title: "Invalid email", description: `"${trimmed}" is not a valid email.`, variant: "destructive" });
      return;
    }
    if (emails.includes(trimmed)) return;
    setEmails((prev) => [...prev, trimmed]);
    setEmailInput("");
  };

  const removeEmail = (emailToRemove) => {
    setEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  const handleEmailKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      addEmail(emailInput);
    }
    if (e.key === "Backspace" && !emailInput && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handleEmailPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const parts = pasted.split(/[,;\s]+/).filter(Boolean);
    const valid = [];
    parts.forEach((p) => {
      const t = p.trim();
      if (isValidEmail(t) && !emails.includes(t) && !valid.includes(t)) valid.push(t);
    });
    if (valid.length) setEmails((prev) => [...prev, ...valid]);
  };

  // Dynamic subject: "Meeting Analysis — {title} — {date}"
  const dynamicSubject = useMemo(() => {
    const title = meetingTitle || "Untitled Meeting";
    const date = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return `Meeting Analysis — ${title} — ${date}`;
  }, [meetingTitle]);

  const fullSubject = dynamicSubject;

  const optionalOptions = shareOptions.filter((o) => o.key !== "analysis");

  const toggleOption = (key) => {
    if (key === "analysis") return; // non-removable
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isDisabled = (opt) =>
    (opt.needsAudio && (!audioBlob || isRecording)) ||
    (opt.needsAnalysis && !isAnalyzed);

  const handleSend = async () => {
    // Add any typed-but-not-submitted email
    if (emailInput.trim()) addEmail(emailInput);
    const finalEmails = emailInput.trim() && isValidEmail(emailInput.trim())
      ? [...emails, emailInput.trim()].filter((v, i, a) => a.indexOf(v) === i)
      : emails;

    if (finalEmails.length === 0) {
      toast({ title: "No recipients", description: "Add at least one email address.", variant: "destructive" });
      return;
    }

    setSending(true);
    const attachments = [...selected].filter(Boolean);

    try {
      const formData = new FormData();
      formData.append("to", JSON.stringify(finalEmails));
      formData.append("subject", fullSubject);
      formData.append("body", bodyContent ? JSON.stringify(bodyContent) : "");
      formData.append("attachments", JSON.stringify(attachments));

      if (selected.has("audio") && audioBlob) {
        formData.append("audioFile", audioBlob, "recording.webm");
      }

      const res = await fetch(SEND_EMAIL_API, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error (${res.status})`);
      }

      const attachLabels = selected.size > 0
        ? [...selected].map((s) => shareOptions.find((o) => o.key === s)?.label).join(", ")
        : "None";
      toast({ title: "Email Sent!", description: `Sent to ${finalEmails.length} recipient(s) with: ${attachLabels}` });
      setEmails([]);
      setEmailInput("");
      setSelected(new Set(["analysis"]));
    } catch (err) {
      toast({
        title: "Failed to send",
        description: err.message || "Could not send email. Check your backend connection.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="rounded-2xl border border-border/50 glass-strong gradient-border overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3 border-b border-border/30">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 shrink-0">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Compose Email</h3>
          <p className="text-[11px] text-muted-foreground">Send meeting analysis with attachments</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* To field — multi-email chip input */}
        <div
          className="flex flex-wrap items-center gap-1.5 min-h-[40px] rounded-xl border border-border/40 bg-background/60 px-3 py-1.5 focus-within:ring-1 focus-within:ring-ring cursor-text"
          onClick={() => emailInputRef.current?.focus()}
        >
          <Mail className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          {emails.map((em) => (
            <span
              key={em}
              className="inline-flex items-center gap-1 rounded-md bg-secondary/70 border border-border/40 px-2 py-0.5 text-[11px] text-foreground font-medium"
            >
              {em}
              <button
                onClick={(e) => { e.stopPropagation(); removeEmail(em); }}
                className="h-3.5 w-3.5 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
              </button>
            </span>
          ))}
          <input
            ref={emailInputRef}
            type="text"
            placeholder={emails.length === 0 ? "Add recipients — press Enter or comma to add" : ""}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value.replace(",", ""))}
            onKeyDown={handleEmailKeyDown}
            onPaste={handleEmailPaste}
            onBlur={() => { if (emailInput.trim()) addEmail(emailInput); }}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Subject field — with non-editable chip + optional extra text */}
        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-background/60 px-3 h-10 focus-within:ring-1 focus-within:ring-ring">
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary whitespace-nowrap shrink-0">
            Subject
          </span>
          <span className="text-xs text-muted-foreground truncate shrink-0 max-w-[60%]" title={dynamicSubject}>
            {dynamicSubject}
          </span>
        </div>

        {/* Attached files as chips — shown above body */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Analysis — always attached, non-removable */}
          <div className="flex items-center gap-1.5 rounded-lg bg-primary/8 border border-primary/20 px-2.5 py-1 text-[11px]">
            <BarChart3 className="h-3 w-3 text-primary" />
            <span className="text-foreground font-medium">Full Analysis</span>
            <span className="text-muted-foreground/60">.txt</span>
          </div>

          {/* Other selected attachments */}
          {[...selected]
            .filter((key) => key !== "analysis")
            .map((key) => {
              const opt = shareOptions.find((o) => o.key === key);
              if (!opt) return null;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 rounded-lg bg-secondary/60 border border-border/40 px-2.5 py-1 text-[11px] group"
                >
                  <opt.icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-foreground font-medium">{opt.label}</span>
                  <span className="text-muted-foreground/60">{opt.desc}</span>
                  <button
                    onClick={() => toggleOption(key)}
                    className="ml-0.5 h-4 w-4 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors opacity-60 group-hover:opacity-100"
                  >
                    <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              );
            })}

          {/* Add more attachments — inline button with popover-style options */}
          {optionalOptions.filter((opt) => !selected.has(opt.key)).length > 0 && (
            <AttachmentAdder
              options={optionalOptions.filter((opt) => !selected.has(opt.key))}
              isDisabled={isDisabled}
              onAdd={toggleOption}
            />
          )}
        </div>

        {/* Body — rich text editor, no label */}
        <RichTextEditor value={bodyContent} onChange={setBodyContent} placeholder="Compose your email body..." />

        {/* Send */}
        <div className="flex justify-end pt-1">
          <Button
            onClick={handleSend}
            disabled={(emails.length === 0 && !emailInput.trim()) || sending}
            className="h-10 rounded-xl gap-2 text-sm font-medium px-6"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending..." : "Send Email"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

/* Inline attachment adder with dropdown */
const AttachmentAdder = ({ options, isDisabled, onAdd }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded-lg border border-dashed border-border/50 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary/40 hover:border-border hover:text-foreground transition-all"
      >
        <Paperclip className="h-3 w-3" />
        <Plus className="h-2.5 w-2.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-1.5 z-50 min-w-[180px] rounded-xl border border-border/60 bg-popover shadow-lg p-1.5 space-y-0.5">
            {options.map((opt) => {
              const disabled = isDisabled(opt);
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    onAdd(opt.key);
                    if (options.length <= 1) setOpen(false);
                  }}
                  disabled={disabled}
                  className="flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <opt.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-muted-foreground/60 ml-auto text-[10px]">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ShareSection;