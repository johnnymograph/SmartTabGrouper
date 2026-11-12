// Lista robusta de palabras vacías (stop-words)
export const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'y', 'o', 'pero', 'si', 'en', 'de', 'del', 'a', 'al', 'por', 'para', 'con', 'sin', 'sobre', 'entre', 'que', 'como', 'su', 'sus',
  'the', 'and', 'for', 'with', 'from', 'to', 'in', 'on', 'at', 'by', 'an', 'of', 'as', 'is', 'it', 'that', 'this', 'how', 'watch', 'video', 'youtube', 'google', 'com',
  'your', 'you', 'yours', 'my', 'mine', 'our', 'ours', 'their', 'theirs', 'his', 'her', 'its', 'can', 'will', 'just', 'get', 'all', 'out', 'new', 'free', 'download',
  'html', 'htm', 'php', 'index', 'main'
]);

export function extractSemanticTokens(text) {
  if (!text) return new Set();
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^\w\s]/gi, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !STOP_WORDS.has(word))
  );
}

export function extractPathTokens(urlString) {
  try {
    const url = new URL(urlString);
    const segments = url.pathname.split('/').filter(seg => seg.length > 3);
    let pathTokens = new Set();
    segments.forEach(seg => {
      let cleaned = seg.replace(/[-_]/g, ' ').toLowerCase();
      cleaned.split(/\s+/).forEach(word => {
        if (word.length > 3 && !STOP_WORDS.has(word)) {
          pathTokens.add(word);
        }
      });
    });
    return pathTokens;
  } catch (e) {
    return new Set();
  }
}

export function calculateJaccard(setA, setB) {
  let intersection = new Set([...setA].filter(x => setB.has(x)));
  let union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

export function generateConceptTitle(cluster) {
  let tokenCounts = {};
  cluster.forEach(tab => {
    if (!tab.tokens) return;
    tab.tokens.forEach(token => {
      tokenCounts[token] = (tokenCounts[token] || 0) + 1;
    });
  });

  let sortedTokens = Object.entries(tokenCounts).sort((a, b) => b[1] - a[1]);
  
  for (let [token] of sortedTokens) {
    if (token.length > 3) {
      return token.charAt(0).toUpperCase() + token.slice(1);
    }
  }

  let fallback = cluster[0].title.split(/[-|–—:]/)[0].trim();
  return fallback.length > 18 ? fallback.substring(0, 16) + "..." : fallback;
}

export function getRandomGroupColor(index) {
  const colors = ["blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"];
  return colors[index % colors.length];
}