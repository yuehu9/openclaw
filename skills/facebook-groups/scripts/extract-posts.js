// Facebook Groups Post Extraction Script
// Run via: browser act kind=evaluate fn="<this file contents>"
// Returns: Array of post objects with text, engagement, author info, links, images
//
// Facebook obfuscates class names but keeps semantic attributes stable.
// This script uses role, aria-*, and data-* selectors that survive most UI updates.
// See references/facebook-dom-guide.md for selector rationale and fallback patterns.

(() => {
  // --- Helpers ---

  function parseEngagementCount(text) {
    if (!text) return 0;
    const cleaned = text.replace(/,/g, "");
    const match = cleaned.match(/([\d.]+)\s*([KkMm]?)/);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    const suffix = match[2].toUpperCase();
    if (suffix === "K") return Math.round(num * 1000);
    if (suffix === "M") return Math.round(num * 1000000);
    return Math.round(num);
  }

  function extractEngagement(article) {
    // Strategy 1: aria-label on reaction buttons (most reliable)
    const reactionLabels = article.querySelectorAll("[aria-label]");
    let likes = 0,
      comments = 0,
      shares = 0;

    for (const el of reactionLabels) {
      const label = el.getAttribute("aria-label") || "";
      const lowerLabel = label.toLowerCase();

      if (
        lowerLabel.includes("like") ||
        lowerLabel.includes("reaction") ||
        lowerLabel.includes("love") ||
        lowerLabel.includes("haha") ||
        lowerLabel.includes("wow") ||
        lowerLabel.includes("sad") ||
        lowerLabel.includes("angry")
      ) {
        const count = parseEngagementCount(label);
        if (count > likes) likes = count;
      }
      if (lowerLabel.includes("comment")) {
        const count = parseEngagementCount(label);
        if (count > comments) comments = count;
      }
      if (lowerLabel.includes("share")) {
        const count = parseEngagementCount(label);
        if (count > shares) shares = count;
      }
    }

    // Strategy 2: text content patterns (fallback)
    if (likes === 0 && comments === 0) {
      const text = article.innerText || "";
      const likeMatch = text.match(/([\d,.]+[KkMm]?)\s*(?:likes?|reactions?)/i);
      const commentMatch = text.match(/([\d,.]+[KkMm]?)\s*comments?/i);
      const shareMatch = text.match(/([\d,.]+[KkMm]?)\s*shares?/i);

      if (likeMatch) likes = parseEngagementCount(likeMatch[1]);
      if (commentMatch) comments = parseEngagementCount(commentMatch[1]);
      if (shareMatch) shares = parseEngagementCount(shareMatch[1]);
    }

    return { likes, comments, shares };
  }

  function extractPostUrl(article) {
    // Strategy 1: permalink or posts links
    const permalinkSelectors = [
      'a[href*="/posts/"]',
      'a[href*="/permalink/"]',
      'a[href*="story_fbid"]',
      'a[href*="/photos/"]',
      'a[href*="/videos/"]',
    ];

    for (const sel of permalinkSelectors) {
      const link = article.querySelector(sel);
      if (link?.href) {
        try {
          const url = new URL(link.href);
          url.search = "";
          return url.toString();
        } catch {
          return link.href;
        }
      }
    }

    // Strategy 2: timestamp links (often link to the post)
    const timeLink = article.querySelector("a[href] abbr, a[href] [data-utime], a[href] time");
    if (timeLink) {
      const anchor = timeLink.closest("a[href]");
      if (anchor?.href?.includes("facebook.com")) return anchor.href;
    }

    return null;
  }

  function extractAuthor(article) {
    // Strategy 1: heading links (h2, h3, h4 — Facebook uses these for post author names)
    const headingSelectors = ["h2 a[href]", "h3 a[href]", "h4 a[href]"];
    for (const sel of headingSelectors) {
      const link = article.querySelector(sel);
      if (link?.textContent?.trim() && link.href?.includes("facebook.com")) {
        return {
          name: link.textContent.trim(),
          url: link.href.split("?")[0],
        };
      }
    }

    // Strategy 2: strong tags with profile links
    const strongLink = article.querySelector('strong a[href*="facebook.com"]');
    if (strongLink?.textContent?.trim()) {
      return {
        name: strongLink.textContent.trim(),
        url: strongLink.href.split("?")[0],
      };
    }

    // Strategy 3: first meaningful profile link
    const profileLink = article.querySelector(
      'a[href*="/user/"], a[href*="profile.php"], a[href*="facebook.com/"][role="link"]',
    );
    if (
      profileLink?.textContent?.trim()?.length > 1 &&
      profileLink.textContent.trim().length < 80
    ) {
      return {
        name: profileLink.textContent.trim(),
        url: profileLink.href.split("?")[0],
      };
    }

    return { name: null, url: null };
  }

  function extractTimestamp(article) {
    // abbr elements often contain timestamps
    const abbr = article.querySelector("abbr[data-utime], abbr[title], abbr");
    if (abbr) {
      return (
        abbr.getAttribute("title") || abbr.getAttribute("data-utime") || abbr.textContent?.trim()
      );
    }

    // time elements
    const time = article.querySelector("time[datetime]");
    if (time) return time.getAttribute("datetime");

    // Aria-label timestamps on links
    const timeLink = article.querySelector(
      'a[aria-label*="hour"], a[aria-label*="minute"], a[aria-label*="day"], a[aria-label*="week"]',
    );
    if (timeLink) return timeLink.getAttribute("aria-label");

    return null;
  }

  // --- Main extraction ---

  const articles = document.querySelectorAll('[role="article"]');
  const posts = [];
  const seenTexts = new Set();

  for (const article of articles) {
    const rawText = article.innerText?.trim();
    if (!rawText || rawText.length < 20) continue;

    // Truncate text for dedup check
    const textPrefix = rawText.slice(0, 100);
    if (seenTexts.has(textPrefix)) continue;
    seenTexts.add(textPrefix);

    const text = rawText.slice(0, 2000);
    const author = extractAuthor(article);
    const postUrl = extractPostUrl(article);
    const engagement = extractEngagement(article);
    const timestamp = extractTimestamp(article);

    // Extract links
    const links = [];
    const seenHrefs = new Set();
    for (const a of article.querySelectorAll("a[href]")) {
      const href = a.href;
      if (!href || seenHrefs.has(href)) continue;
      if (href.includes("facebook.com/hashtag")) continue;
      if (href === author.url) continue;
      if (href === postUrl) continue;
      seenHrefs.add(href);
      links.push({ text: a.textContent?.trim()?.slice(0, 100), href });
    }

    // Extract images
    const images = [];
    const seenSrcs = new Set();
    for (const img of article.querySelectorAll("img[src]")) {
      const src = img.src;
      if (!src || seenSrcs.has(src)) continue;
      // Skip tiny images (profile pics, emoji, icons)
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      if (width > 0 && width < 50) continue;
      if (height > 0 && height < 50) continue;
      // Skip common non-content patterns
      if (src.includes("emoji") || src.includes("rsrc.php")) continue;
      seenSrcs.add(src);
      images.push({ alt: img.alt?.slice(0, 200), src });
    }

    posts.push({
      text,
      authorName: author.name,
      authorUrl: author.url,
      postUrl,
      timestamp,
      likes: engagement.likes,
      comments: engagement.comments,
      shares: engagement.shares,
      engagementScore: engagement.likes + engagement.comments + engagement.shares,
      links: links.slice(0, 10),
      images: images.slice(0, 5),
    });
  }

  // Sort by engagement (highest first)
  posts.sort((a, b) => b.engagementScore - a.engagementScore);

  return posts;
})();
