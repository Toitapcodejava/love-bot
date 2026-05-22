import EventSource from "react-native-sse";
import { storage } from "./storage";

export type ToolCall = { name: string; args: any; id: string };
export type MoodData = { mood: string; reaction_emoji: string };

export async function chatStream(
  message: string,
  onText: (t: string) => void,
  onTools: (t: ToolCall[]) => void,
  onMood: (m: MoodData) => void,
  onDone: () => void,
  onError: (e: any) => void,
  statusContext?: string,
) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const es = new EventSource(`${base}/chat`, {
    method: "POST",
    headers: { "x-app-key": key, "content-type": "application/json" },
    body: JSON.stringify({ message, user_status: statusContext }),
    pollingInterval: 0,
  });
  es.addEventListener("text", (e: any) => onText(e.data));
  es.addEventListener("tool", (e: any) => onTools(JSON.parse(e.data)));
  es.addEventListener("mood", (e: any) => onMood(JSON.parse(e.data)));
  es.addEventListener("done", () => { es.close(); onDone(); });
  es.addEventListener("error", (e: any) => { es.close(); onError(e); });
  return () => es.close();
}

export async function postJSON(path: string, body: any) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "x-app-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function getJSON(path: string) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const r = await fetch(`${base}${path}`, { headers: { "x-app-key": key } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function deleteJSON(path: string) {
  const base = await storage.getBase();
  const key = await storage.getKey();
  const r = await fetch(`${base}${path}`, { method: "DELETE", headers: { "x-app-key": key } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
