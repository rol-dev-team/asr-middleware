import axiosInstance from "./axiosInstance";

export const transcribeAudio = async (audioBlob, title = "Untitled", taskId = null) => {
  const formData = new FormData();

  const mimeType = audioBlob.type || "audio/webm";
  const extension = mimeType.includes("mp4") ? "mp4"
    : mimeType.includes("ogg") ? "ogg"
    : mimeType.includes("wav") ? "wav"
    : "webm";

  const file = new File([audioBlob], `recording-${Date.now()}.${extension}`, {
    type: mimeType,
  });

  formData.append("file", file);

  const params = {
    title,
    generate_markdown: true,
    ...(taskId ? { task_id: taskId } : {}),
  };

  const { data } = await axiosInstance.post(
    `/api/v1/utils/full-analysis`,
    formData,
    {
      params,
      headers: { "Content-Type": undefined },
      timeout: 300_000,
    }
  );

  return data;
};

export const getAllAudios = async ({ skip = 0, limit = 100 } = {}) => {
  const { data } = await axiosInstance.get("/api/v1/audios", {
    params: { skip, limit },
  });
  return data;
};

export const getAudioById = async (audioId) => {
  const { data } = await axiosInstance.get(`/api/v1/audios/${audioId}`);
  return data;
};

export const getTranslationsByAudioId = async (audioId) => {
  const { data } = await axiosInstance.get(`/api/v1/audios/${audioId}/translations`);
  return data;
};

export const parseTranscriptionToMessages = (rawText) => {
  if (!rawText) return [];

  const lines = rawText.split(/\r?\n/).filter((l) => l.trim());
  const messages = [];
  const lineRegex = /^\[\s*([^\]]+)\]\s*(.+?):\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(lineRegex);
    if (match) {
      messages.push({
        speaker: match[2].trim(),
        time: match[1].trim(),
        text: match[3].trim(),
      });
    }
  }

  if (messages.length === 0 && rawText.trim()) {
    messages.push({ speaker: "Transcript", time: "0m0s", text: rawText.trim() });
  }

  return messages;
};