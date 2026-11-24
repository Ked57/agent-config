export function fakeIds(prefix: string): () => string {
  let count = 0;
  return () => {
    count += 1;
    return `${prefix}_${String(count).padStart(16, "0")}`;
  };
}
