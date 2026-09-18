export function createDictationTimeout(stop: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => clearTimeout(timer);
  return {
    clear,
    reset() {
      clear();
      timer = setTimeout(stop, 10_000);
    },
  };
}

export function mergeDictation(draft: string, transcript: string): string {
  const prefix = draft.trimEnd();
  const speech = transcript.trim();
  return prefix && speech ? `${prefix} ${speech}` : prefix || speech;
}
