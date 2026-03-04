export type AgentTarget = "claude" | "cursor" | "windsurf" | "opencode" | "copilot";

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
  generatedFiles: GeneratedFileCheck[];
  opencode: OpenCodeCheck;
}

export interface GeneratedFileCheck {
  path: string;
  exists: boolean;
  upToDate: boolean;
}

export interface OpenCodeCheck {
  exists: boolean;
  valid: boolean;
}
