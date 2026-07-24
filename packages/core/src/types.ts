export type AgentTarget = "claude" | "cursor" | "windsurf" | "opencode" | "codex" | "copilot";

export interface Config {
  version: 1;
  targets: Record<AgentTarget, boolean>;
}

export interface DetectedFile {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  modifiedAt: Date;
  content: string;
}

export interface RuleFile {
  name: string;
  path: string;
}

export interface CommandFile {
  name: string;
  path: string;
}

export interface SkillFile {
  name: string;
  path: string;
  description: string;
  mode: "ask" | "edit" | "agent";
  content: string;
}

export interface SymlinkEntry {
  symlinkPath: string;
  target: string;
  label: string;
}

export interface SymlinkCheck extends SymlinkEntry {
  exists: boolean;
  valid: boolean;
}

export interface StatusResult {
  symlinks: SymlinkCheck[];
  opencode: OpenCodeCheck;
}

export interface OpenCodeCheck {
  exists: boolean;
  valid: boolean;
}
