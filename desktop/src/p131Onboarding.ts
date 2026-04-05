/**
 * P131: first-trial onboarding — milestones and dismissible hints (localStorage).
 */

const STORAGE_KEY = "torqa.p131.v1";

export type P131Snapshot = {
  folder: boolean;
  buildOk: boolean;
  preview: boolean;
  compare: boolean;
  dismissed: string[];
};

const defaultSnap = (): P131Snapshot => ({
  folder: false,
  buildOk: false,
  preview: false,
  compare: false,
  dismissed: [],
});

export function loadP131(): P131Snapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSnap();
    const o = JSON.parse(raw) as Partial<P131Snapshot>;
    return {
      ...defaultSnap(),
      folder: Boolean(o.folder),
      buildOk: Boolean(o.buildOk),
      preview: Boolean(o.preview),
      compare: Boolean(o.compare),
      dismissed: Array.isArray(o.dismissed) ? o.dismissed.filter((x) => typeof x === "string") : [],
    };
  } catch {
    return defaultSnap();
  }
}

function saveP131(s: P131Snapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private mode */
  }
}

export type P131Milestone = "folder" | "buildOk" | "preview" | "compare";

export function markP131Milestone(key: P131Milestone): P131Snapshot {
  const s = loadP131();
  if (s[key]) return s;
  const next = { ...s, [key]: true };
  saveP131(next);
  return next;
}

export function dismissP131Hint(hintId: string): P131Snapshot {
  const s = loadP131();
  if (s.dismissed.includes(hintId)) return s;
  const next = { ...s, dismissed: [...s.dismissed, hintId] };
  saveP131(next);
  return next;
}

export const P131_HINT_WELCOME_HOME = "p131_welcome_home";
export const P131_HINT_READY_BUILD = "p131_ready_build";
export const P131_HINT_TRY_PREVIEW = "p131_try_preview";
export const P131_HINT_TRY_COMPARE = "p131_try_compare";

export function shouldShowHint(snap: P131Snapshot, hintId: string, condition: boolean): boolean {
  return condition && !snap.dismissed.includes(hintId);
}
