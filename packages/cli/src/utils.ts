import { note } from "@clack/prompts";
import { detectDeprecatedCommandFiles } from "@moskala/oneagent-core";

export async function warnDeprecatedCommandFiles(root: string): Promise<void> {
  const deprecated = await detectDeprecatedCommandFiles(root);
  if (deprecated.length === 0) return;
  const dirs = [...new Set(deprecated.map((f) => f.split("/").slice(0, 2).join("/")))];
  note(
    deprecated.map((f) => `  • ${f}`).join("\n") +
      "\n\n  Move them to .oneagent/skills/ to manage them with oneagent.",
    `${dirs.join(", ")} — use .oneagent/skills/ instead`,
  );
}

export function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
