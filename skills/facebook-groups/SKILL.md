---
name: facebook-groups
description: "Browse Facebook groups on any topic to discover popular groups, extract top posts, summarize discussions, and find helpful contributors. Use when the user wants to research a topic via Facebook groups (e.g., 'find Facebook groups about home gardening', 'what are people saying about marathon training on Facebook', 'browse Facebook groups for photography tips'). Uses the browser tool with a dedicated Facebook profile and web_search for group discovery. General-purpose: the user provides any topic."
metadata: { "openclaw": { "emoji": "👥", "os": ["darwin", "linux"] } }
---

# Facebook Groups Browser

Browse Facebook groups on any topic using the `browser` and `web_search` tools.

**Priority: Extract content, not list groups.** Group discovery is a means to an end. The goal is to go deep into posts and comments to extract actionable information: tips, brand/product recommendations, store/contractor names, useful resources, pricing, lessons learned, and warnings. The final output should be organized by content type (tips, brands, resources, etc.), not by group. A brief group list belongs in a small appendix at the end.

## References

- `references/facebook-dom-guide.md` — DOM selectors, post structure, and extraction fallbacks for Facebook pages
- `references/discovery-queries.md` — Template search queries and URL patterns for finding groups on any topic

## 1. Prerequisites & Session Setup

### Browser Profile

Always use a dedicated `facebook` profile to isolate cookies from the default `openclaw` profile:

```
browser action=start profile="facebook"
```

Profile persists cookies at `~/.openclaw/browser/facebook/user-data/`. User logs in once manually; session lasts weeks/months.

### Verify Login

Every run, verify the session is alive:

```
browser action=navigate targetUrl="https://www.facebook.com" profile="facebook"
browser action=snapshot profile="facebook"
```

Check the snapshot for login prompts or "Log In" buttons. If the session is expired:

1. Send a message: "Your Facebook session has expired. Please log in manually in the browser window."
2. Wait for the user to confirm login is complete.
3. Re-check snapshot to verify logged-in state (look for the user's name, notification icons, or a news feed).

### Resume Previous Session

Check for saved progress before starting fresh:

```bash
ls ~/.openclaw/facebook-groups/session-*.json 2>/dev/null
```

If a session file exists and is < 24 hours old, ask the user: "Found a previous session with data for N groups. Resume where we left off?"

- If yes: load the session file, skip already-extracted groups
- If no: start fresh (existing files are kept as archive)

## 2. Discover Groups

The user provides a topic (e.g., "home gardening", "marathon training", "budget travel").

### Step 1: Web Search

Use `web_search` with multiple queries to find recommended groups. See `references/discovery-queries.md` for query templates.

```
web_search query="best Facebook groups for {topic}"
web_search query="Facebook group {topic} recommendations reddit"
```

Collect group names and URLs from search results.

### Step 2: Facebook Group Search

Navigate to Facebook's group search:

```
browser action=navigate targetUrl="https://www.facebook.com/search/groups/?q={url_encoded_topic}" profile="facebook"
```

Wait 3 seconds for results to load, then extract group listings:

```
browser action=act profile="facebook" request={"kind":"evaluate","fn":"() => { const groups = []; document.querySelectorAll('[role=\"listitem\"], [data-pagelet*=\"Group\"]').forEach(el => { const link = el.querySelector('a[href*=\"/groups/\"]'); const name = link?.textContent?.trim(); const href = link?.href; const meta = el.innerText; groups.push({name, href, meta}); }); return groups; }"}
```

If `evaluate` fails (disabled or blocked), fall back to AI snapshot:

```
browser action=snapshot profile="facebook" maxChars=60000
```

Parse group names and member counts from the snapshot text.

### Step 3: Assess & Rank Candidates

Visit each candidate group (max 5 per session):

```
browser action=navigate targetUrl="{group_url}" profile="facebook"
browser action=act profile="facebook" request={"kind":"wait","timeMs":3000}
```

Extract group metadata:

```
browser action=act profile="facebook" request={"kind":"evaluate","fn":"() => { const header = document.querySelector('[role=\"main\"]'); return { name: document.title, memberText: header?.innerText?.match(/(\\d[\\d,.KMkm]*\\s*members)/)?.[1], privacy: header?.innerText?.match(/(Public|Private) group/i)?.[1], description: header?.querySelector('[data-ad-preview=\"message\"]')?.textContent?.slice(0,500), recentActivity: header?.innerText?.match(/(\\d+\\+?\\s*(?:posts? (?:a|per) (?:day|week|month)|new posts? today))/i)?.[1] }; }"}
```

**Rank by**: member count (higher = better), recent activity (frequent posts), relevance to the topic, public > private (public groups are easier to browse).

Send progress update:

> "Found 5 candidate groups: **{Group1}** ({members}), **{Group2}** ({members})..."

### Step 4: Handle Private Groups

For private groups where content isn't visible:

- If the user is already a member: content will be visible, proceed normally
- If not a member: note it in the report and skip extraction. Optionally ask: "Want me to request to join {group name}?"

## 3. Browse & Extract Posts

For each group (max 5 groups per session):

### Step 1: Navigate & Orient

```
browser action=navigate targetUrl="{group_url}" profile="facebook"
browser action=act profile="facebook" request={"kind":"wait","timeMs":3000}
browser action=snapshot profile="facebook"
```

Use the AI snapshot to confirm the feed is visible and the page is loaded.

Send progress update:

> "Now browsing: **{Group Name}** ({member_count} members)"

Take a progress screenshot:

```
browser action=screenshot profile="facebook"
```

### Step 2: Extract Posts (Hybrid)

Run the bundled extraction script. Read it first, then pass its content to evaluate:

```
browser action=act profile="facebook" request={"kind":"evaluate","fn":"<contents of {baseDir}/scripts/extract-posts.js>"}
```

The script returns an array of post objects with: `text`, `authorName`, `authorUrl`, `postUrl`, `engagementText`, `likes`, `comments`, `shares`, `links`, `images`.

See `references/facebook-dom-guide.md` for selector details and fallback patterns.

**Fallback** (if `evaluate` is disabled — `browser.evaluateEnabled=false`):

```
browser action=snapshot profile="facebook" maxChars=80000
```

Parse the snapshot text manually. Posts appear as blocks with author names, timestamps, and engagement counts.

### Step 3: Scroll & Paginate

Repeat up to 5 scroll cycles to load more posts:

```
browser action=act profile="facebook" request={"kind":"press","key":"End"}
browser action=act profile="facebook" request={"kind":"wait","timeMs":3000}
```

After each scroll, re-run the extraction script. Deduplicate posts by `postUrl` or text prefix (first 100 chars).

### Step 4: Quality Filter

Remove low-quality posts:

- **Spam indicators**: very short text (< 50 chars) with external links, "DM me", "inbox me", phone numbers, price-only posts
- **No engagement**: 0 likes and 0 comments (unless the group is very small)
- **Ads**: posts containing "sponsored", "promotion", or marked as admin announcements with commercial intent

### Step 5: Rank by Engagement

Sort remaining posts by `likes + comments` descending. Focus reporting on the top 10-15 posts per group.

### Step 6: Deep Dive (Required — this is where the real value is)

For the top 5-10 most engaging posts, **always** click into the comment thread. Comments often contain the most actionable content — specific brand names, store recommendations, pricing, lessons learned, and resource links that aren't in the original post:

```
browser action=act profile="facebook" request={"kind":"click","ref":"{post_link_ref}"}
browser action=act profile="facebook" request={"kind":"wait","timeMs":3000}
browser action=act profile="facebook" request={"kind":"evaluate","fn":"() => { const comments = []; document.querySelectorAll('[role=\"article\"]').forEach((el, i) => { if (i === 0) return; comments.push({ author: el.querySelector('a[role=\"link\"]')?.textContent, text: el.innerText?.slice(0,1000), likes: el.querySelector('[aria-label*=\"like\"], [aria-label*=\"reaction\"]')?.textContent }); }); return comments.slice(0, 20); }"}
```

Navigate back after extracting comments.

### Step 7: Save Intermediate Results

After finishing each group, persist results to disk:

```bash
mkdir -p ~/.openclaw/facebook-groups/groups
```

Write per-group JSON:

```bash
# ~/.openclaw/facebook-groups/groups/{group-slug}.json
{
  "groupName": "...",
  "groupUrl": "...",
  "memberCount": "...",
  "extractedAt": "2025-01-15T10:30:00Z",
  "posts": [ ... ],
  "topContributors": [ ... ]
}
```

Update session file:

```bash
# ~/.openclaw/facebook-groups/session-{YYYY-MM-DD}.json
{
  "topic": "home gardening",
  "startedAt": "...",
  "groupsFound": [ ... ],
  "groupsCompleted": ["group-slug-1", "group-slug-2"],
  "groupsPending": ["group-slug-3"],
  "status": "in_progress"
}
```

Send progress update:

> "Finished **{Group Name}** — {N} high-quality posts saved. Moving to next group ({M}/{total})..."
> "Progress saved to disk. {M}/{total} groups complete — safe to interrupt if needed."

## 4. Summarize & Report

**The report must be content-first, not group-first.** The user wants actionable information extracted from the groups, not a list of groups to visit. Organize by what was learned, not where it was found.

### Primary Report: Content Digest (deliver first, this is the main output)

Organize extracted content into these sections. Each item should include a source link back to the original post/comment.

**1. Tips & Best Practices** (largest section)

- Actionable advice that appeared in posts or comments
- Deduplicate across groups — note consensus ("mentioned by 4+ people")
- Include specific details: measurements, timelines, costs, techniques
- Example: "Start seeds indoors 6-8 weeks before last frost — multiple people said transplanting too early killed their seedlings"

**2. Recommended Brands, Products & Materials**

- Specific brand/product names with context on why they're recommended
- Include price ranges when mentioned
- Note any products people warned against
- Example: "FoxFarm Ocean Forest soil — recommended by 8 people for container gardening, ~$15-20 per bag"

**3. Recommended Shops, Stores & Contractors**

- Local business names with locations
- Online retailers and specific product links
- Contractors/professionals people vouched for (name + area they serve)
- Include any discount codes or tips for getting better pricing

**4. Useful Resources & Links**

- YouTube channels, blogs, tutorials people shared
- Tools, apps, or calculators mentioned
- Government permits, regulations, or codes referenced
- Specific product links or comparison guides

**5. Common Mistakes & Warnings**

- Things people wish they'd known before starting
- Products/contractors to avoid (with reasons)
- Regulatory pitfalls or permit issues
- Budget overruns and what caused them

**6. Photo Highlights**

- Before/after photos with context
- Product photos showing results
- Include image URLs or describe what the images show

Every item must link back to the source post or comment where it was found.

### Secondary: Groups Browsed (brief appendix)

A short table at the end listing groups browsed — not the focus, just context:

| Group                   | Members | Posts Extracted | Link   |
| ----------------------- | ------- | --------------- | ------ |
| Gardening Tips & Tricks | 45K     | 15              | [link] |
| Urban Home Gardeners    | 22K     | 12              | [link] |

Include a note on any notable contributors (people who gave consistently good advice across multiple posts).

### Clean Up Old Sessions

After delivering the final summary, mark the session as complete:

```bash
# Update session status
# Keep files for 7 days, then auto-clean:
find ~/.openclaw/facebook-groups/ -name "session-*.json" -mtime +7 -delete
```

## 5. Progress Updates

Send specific, named updates via `message` throughout the workflow:

| Phase          | Example Update                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery      | "Found 5 candidate groups. Entering the most active one first..."                                                                                       |
| Entering group | "Now browsing: **Gardening Tips & Tricks** (45,000 members)" + screenshot                                                                               |
| Extraction     | "Extracted 15 posts, diving into comments on top 5. Found mentions of specific soil brands, a nursery recommendation, and a seasonal planting guide..." |
| Deep dive      | "Reading comments on 'My raised bed setup that finally worked' (234 likes, 89 comments) — lots of product recs and tips here..."                        |
| Group done     | "Finished Gardening Tips & Tricks — found 12 brand/product recs, 8 tips, 3 store names. Moving to next group (2/5)..."                                  |
| Save           | "Progress saved to disk. 3/5 groups complete — safe to interrupt if needed."                                                                            |
| Final          | Content-first digest: tips, brands, stores, resources, warnings — organized by what was learned, not by group                                           |

Take progress screenshots with `browser action=screenshot profile="facebook"` when entering each group.

## 6. Anti-Detection Rules

Facebook aggressively detects automation. Follow these rules strictly:

- **Delays**: 2-4 seconds between actions (randomize, never constant). 5-10 seconds between group visits.
- **Rate limits**: Max 5 groups per session. Max 5 scroll cycles per group.
- **Profile**: Always use `profile="facebook"` (same cookies = looks like a real returning user).
- **No rapid navigation**: Never open multiple tabs or navigate faster than a human would.
- **CAPTCHA/block**: If a CAPTCHA or "suspicious activity" warning appears in the snapshot, **stop immediately**. Notify the user: "Facebook is showing a security check. Please resolve it manually in the browser window, then let me know to continue."
- **Session pacing**: If browsing more than 3 groups, take a 30-second pause between groups 3 and 4.

## 7. Cron Integration (Optional)

Set up a weekly digest for ongoing topic monitoring:

```json
{
  "name": "facebook-groups-weekly",
  "description": "Weekly Facebook groups digest for {topic}",
  "enabled": true,
  "schedule": { "kind": "cron", "expr": "0 9 * * 1", "tz": "America/Los_Angeles" },
  "sessionTarget": "isolated",
  "wakeMode": "now",
  "payload": {
    "kind": "agentTurn",
    "message": "Run the weekly Facebook groups digest for '{topic}'. Browse our saved groups, extract new posts since last week, and deliver a summary.",
    "deliver": true,
    "bestEffortDeliver": true
  },
  "delivery": {
    "mode": "announce"
  }
}
```

## 8. Troubleshooting

| Problem                          | Solution                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Session expired                  | Navigate to facebook.com, check snapshot for login prompt, ask user to log in manually                             |
| CAPTCHA / security check         | Stop immediately, ask user to resolve in browser window                                                            |
| Private group (not a member)     | Skip extraction, note in report, optionally offer to request membership                                            |
| Empty snapshot                   | Page may still be loading — add `wait timeMs=5000` before snapshot. Check if Facebook redirected to login          |
| `evaluate` disabled              | Fall back to AI snapshot with `maxChars=80000`. Parsing is less structured but still works                         |
| Rate limited / "try again later" | Stop session. Wait at least 1 hour before resuming. Reduce groups per session                                      |
| Group not found / URL changed    | Try searching by group name on Facebook directly. Groups can be renamed or deleted                                 |
| No posts visible                 | Group may be empty, archived, or require membership. Check group header for status                                 |
| Extraction returns empty         | Facebook may have changed DOM structure. See `references/facebook-dom-guide.md` for fallback selectors             |
| Browser won't start              | Run `browser action=status profile="facebook"` to diagnose. Check if another Chrome instance is using the CDP port |
