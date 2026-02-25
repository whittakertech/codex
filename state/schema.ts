export interface EngineRef {
  owner: string; // e.g. "whittakertech"
  repo:  string; // e.g. "midas"
  ref:   string; // git commit SHA
}

export interface VirgilState {
  lock:     Record<string, string>; // id → input hash
  manifest: Record<string, string>; // id → output filename
}

export type ToolState = VirgilState; // union as tools grow
