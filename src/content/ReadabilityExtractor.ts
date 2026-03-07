import { Readability } from '@mozilla/readability';
import type { ExtractedContent } from '../shared/messages.js';

export function extractContent(): ExtractedContent {
  // Clone the document since Readability mutates the DOM
  const clone = document.cloneNode(true) as Document;

  let title = document.title;
  let content = '';
  let textContent = '';
  let excerpt = '';

  try {
    const reader = new Readability(clone);
    const article = reader.parse();
    if (article) {
      title = article.title || title;
      content = article.content || '';
      textContent = article.textContent || '';
      excerpt = article.excerpt || '';
    }
  } catch {
    // Readability failed — fall through to fallback
  }

  // Fallback: use body text directly
  if (!textContent) {
    textContent = document.body?.innerText || '';
    content = document.body?.innerHTML || '';
    excerpt = textContent.slice(0, 200);
  }

  const wordCount = textContent.split(/\s+/).filter(Boolean).length;

  return {
    title,
    content,
    textContent,
    wordCount,
    excerpt,
    url: window.location.href,
  };
}
