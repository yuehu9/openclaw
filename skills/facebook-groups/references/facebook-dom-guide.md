# Facebook DOM Guide

Facebook obfuscates CSS class names on every deploy. Rely on **semantic attributes** (`role`, `aria-*`, `data-*`, HTML tags) which are far more stable.

## Table of Contents

- [Stable Selectors](#stable-selectors)
- [Post Structure](#post-structure)
- [Engagement Counts](#engagement-counts)
- [Author & Timestamp](#author--timestamp)
- [Group Metadata](#group-metadata)
- [Image Extraction](#image-extraction)
- [Comment Threads](#comment-threads)
- [Fallback: AI Snapshot Parsing](#fallback-ai-snapshot-parsing)
- [When Selectors Break](#when-selectors-break)

## Stable Selectors

These selectors have remained reliable across Facebook DOM updates:

| Element             | Selector              | Notes                               |
| ------------------- | --------------------- | ----------------------------------- |
| Post/article        | `[role="article"]`    | Each post in the feed is an article |
| Feed container      | `[role="feed"]`       | The scrollable post feed            |
| Main content area   | `[role="main"]`       | Contains the group feed and header  |
| Navigation          | `[role="navigation"]` | Sidebar, top bar                    |
| Dialog/modal        | `[role="dialog"]`     | Login prompts, post detail views    |
| Pagelet sections    | `[data-pagelet]`      | Facebook's section wrappers         |
| Interactive buttons | `[role="button"]`     | Like, comment, share buttons        |
| Links               | `a[role="link"]`      | Profile links, post links           |

## Post Structure

A typical Facebook post (`[role="article"]`) contains:

```
[role="article"]
├── Author section
│   ├── h2/h3/h4 > a[href]          (author name + profile link)
│   ├── img (profile photo, small ~40px)
│   └── abbr / time / a[href]        (timestamp, often links to post permalink)
├── Content section
│   ├── [data-ad-preview="message"]   (post text, when present)
│   ├── div with text content         (post body)
│   └── a[href] (inline links)
├── Media section
│   ├── img[src] (post images, >100px wide)
│   └── video / [data-video-id]       (video content)
├── Engagement section
│   ├── [aria-label*="reaction"]      (like/reaction count)
│   ├── [aria-label*="comment"]       (comment count)
│   └── [aria-label*="share"]         (share count)
└── Action bar
    ├── [role="button"] Like
    ├── [role="button"] Comment
    └── [role="button"] Share
```

## Engagement Counts

Engagement data can be found in multiple places (try in order):

**Strategy 1: aria-label attributes (most reliable)**

```js
article.querySelectorAll("[aria-label]");
// Look for labels containing: "like", "reaction", "comment", "share"
// Examples: "234 reactions", "89 comments", "12 shares"
// Also: "2.3K likes", "1M reactions"
```

**Strategy 2: Text content patterns**

```js
const text = article.innerText;
text.match(/([\d,.]+[KkMm]?)\s*(?:likes?|reactions?)/i);
text.match(/([\d,.]+[KkMm]?)\s*comments?/i);
text.match(/([\d,.]+[KkMm]?)\s*shares?/i);
```

**Strategy 3: Tooltip text on hover elements**

Some engagement counts are hidden behind hover tooltips. These are only accessible after hovering, which is impractical for extraction. Skip this strategy.

### Parsing Counts

Facebook formats numbers differently based on size:

| Display | Parsed Value |
| ------- | ------------ |
| `234`   | 234          |
| `1,234` | 1234         |
| `2.3K`  | 2300         |
| `1.5M`  | 1500000      |

## Author & Timestamp

### Author Name + Profile Link

Try these selectors in order:

1. `h2 a[href]`, `h3 a[href]`, `h4 a[href]` — heading links (most common for group posts)
2. `strong a[href*="facebook.com"]` — bold profile links
3. `a[href*="/user/"]`, `a[href*="profile.php"]` — explicit profile URLs

### Timestamps

1. `abbr[data-utime]` — Unix timestamp in `data-utime` attribute
2. `abbr[title]` — Human-readable timestamp in title attribute
3. `time[datetime]` — Standard HTML5 time element
4. `a[aria-label*="hour"]`, `a[aria-label*="day"]` — Relative time links

### Post Permalink

Post URLs follow these patterns (try in order):

1. `a[href*="/posts/"]` — Standard post URL
2. `a[href*="/permalink/"]` — Permalink format
3. `a[href*="story_fbid"]` — Story-based URL
4. `a[href*="/photos/"]` — Photo post
5. `a[href*="/videos/"]` — Video post
6. Timestamp link's `href` — Often the timestamp text links to the post

## Group Metadata

Extract from the group header area (`[role="main"]` top section):

```js
// Group name
document.title; // Usually "Group Name | Facebook"

// Member count — look for text patterns
header.innerText.match(/([\d,.]+[KkMm]?\s*members)/i);

// Privacy status
header.innerText.match(/(Public|Private)\s*group/i);

// Description
header.querySelector('[data-ad-preview="message"]')?.textContent;

// Recent activity
header.innerText.match(/(\d+\+?\s*(?:posts? (?:a|per) (?:day|week|month)|new posts? today))/i);
```

## Image Extraction

### Content Images vs. UI Images

Filter out non-content images:

| Skip if...                        | Reason                     |
| --------------------------------- | -------------------------- |
| `width < 50` or `height < 50`     | Profile pics, emoji, icons |
| `src` contains `emoji`            | Emoji images               |
| `src` contains `rsrc.php`         | Facebook static resources  |
| `src` contains `static`           | UI elements                |
| `alt` is empty and image is small | Decorative elements        |

### Getting Full-Size Images

Facebook serves scaled images. The `src` attribute on feed images is typically a medium resolution. For higher resolution:

- Check for `data-src` attribute (lazy-loaded original)
- Click into the photo viewer for full-resolution URLs
- The photo viewer URL usually contains `/photo/` and provides the highest resolution

## Comment Threads

When drilling into a post's comments:

```js
// After clicking into a post, the first [role="article"] is the post itself.
// Subsequent [role="article"] elements are comments.
document.querySelectorAll('[role="article"]').forEach((el, i) => {
  if (i === 0) return; // skip the main post
  // el is a comment
  const author = el.querySelector('a[role="link"]')?.textContent;
  const text = el.innerText?.slice(0, 1000);
  const likes = el.querySelector('[aria-label*="like"]')?.textContent;
});
```

Comments may be paginated. Look for "View more comments" buttons:

```js
// Click to load more comments
document.querySelector('[role="button"]'); // that contains text "View more comments"
```

Use AI snapshot + click refs for this instead of evaluate, since you need to interact with the button.

## Fallback: AI Snapshot Parsing

When `evaluate` is disabled (`browser.evaluateEnabled=false`), use AI snapshot:

```
browser action=snapshot profile="facebook" maxChars=80000
```

In the snapshot text, posts appear as blocks separated by engagement lines. Look for patterns:

```
Author Name
Timestamp (e.g., "2h", "Yesterday at 3:45 PM")
Post text content...
👍 234  💬 89 comments  ↗ 12 shares
Like  Comment  Share
```

The AI model can parse this structure from the snapshot text, though it's less precise than evaluate-based extraction.

## When Selectors Break

Facebook updates their DOM regularly. If extraction returns empty or unexpected results:

1. **Take an AI snapshot** and inspect the output manually
2. **Look for new semantic attributes**: Facebook tends to keep `role` and `aria-*` attributes even when restructuring
3. **Try broader selectors**: if `[role="article"]` stops working, try `[data-pagelet*="Feed"] > div > div` to find post containers
4. **Check for new patterns**: Facebook occasionally wraps posts in new container elements. The content structure (author → text → media → engagement) stays consistent
5. **Report**: update this guide with new patterns when discovered

### Common DOM Changes

- Class name obfuscation: changes every deploy, never rely on class names
- New wrapper divs: Facebook adds/removes nesting layers periodically
- Attribute renames: `data-ad-preview` may become `data-ad-comet-preview` or similar
- React portals: some content (modals, tooltips) renders outside the main tree
