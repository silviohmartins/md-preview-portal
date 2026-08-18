export function countWords(text: string): number {
  let count = 0;
  const words = /\S+/g;
  while (words.exec(text) !== null) count += 1;
  return count;
}
