export function mergeDictation(draft: string, transcript: string): string {
  const prefix = draft.trimEnd();
  const speech = transcript.trim();
  return prefix && speech ? `${prefix} ${speech}` : prefix || speech;
}
