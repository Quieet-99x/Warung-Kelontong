export interface NamedItem {
  id: string;
  name: string;
}

const normalize = (value: string) => value
  .toLocaleLowerCase("id-ID")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const tokens = (value: string) => normalize(value).split(/\s+/).filter(Boolean);

function editDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function tokenMatches(queryToken: string, nameToken: string): boolean {
  return nameToken.includes(queryToken) || queryToken.includes(nameToken);
}

function typoScore(queryTokens: string[], nameTokens: string[]): number {
  return queryTokens.reduce((total, queryToken) => total + Math.min(...nameTokens.map(nameToken => {
    const distance = editDistance(queryToken, nameToken);
    return distance / Math.max(queryToken.length, nameToken.length, 1);
  })), 0) / queryTokens.length;
}

export function searchItemNames<T extends NamedItem>(items: T[], query: string, suggestionLimit = 3): { matches: T[]; suggestions: T[] } {
  const queryTokens = tokens(query);
  if (!queryTokens.length) return { matches: items, suggestions: [] };

  const matches = items.filter(item => {
    const nameTokens = tokens(item.name);
    return queryTokens.every(queryToken => nameTokens.some(nameToken => tokenMatches(queryToken, nameToken)));
  });
  if (matches.length) return { matches, suggestions: [] };

  const suggestions = items
    .map(item => ({ item, score: typoScore(queryTokens, tokens(item.name)) }))
    .filter(candidate => candidate.score <= 0.34)
    .sort((left, right) => left.score - right.score || left.item.name.localeCompare(right.item.name, "id-ID"))
    .slice(0, suggestionLimit)
    .map(candidate => candidate.item);
  return { matches, suggestions };
}
