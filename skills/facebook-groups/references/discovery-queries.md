# Group Discovery Queries

Template search queries and URL patterns for finding Facebook groups on any topic.

## Web Search Templates

Use `web_search` with these query patterns. Replace `{topic}` with the user's topic.

### Primary Queries

```
best Facebook groups for {topic}
top Facebook groups {topic} 2025
Facebook group {topic} recommendations
```

### Community Recommendation Queries

```
Facebook group {topic} recommendations reddit
what Facebook groups for {topic} site:reddit.com
best {topic} communities on Facebook
```

### Niche / Regional Queries

When the topic includes a location:

```
Facebook group {topic} {location}
{topic} community {location} Facebook
```

When the topic is broad, add specificity:

```
Facebook group {sub-topic} tips
Facebook group {topic} beginners
Facebook group {topic} professionals
```

## Facebook Search URLs

### Group Search

```
https://www.facebook.com/search/groups/?q={url_encoded_topic}
```

URL-encode the topic: spaces become `%20`, special chars encoded.

Examples:

| Topic             | URL                                                               |
| ----------------- | ----------------------------------------------------------------- |
| home gardening    | `https://www.facebook.com/search/groups/?q=home%20gardening`      |
| marathon training | `https://www.facebook.com/search/groups/?q=marathon%20training`   |
| budget travel     | `https://www.facebook.com/search/groups/?q=budget%20travel`       |
| dog training tips | `https://www.facebook.com/search/groups/?q=dog%20training%20tips` |

### Post Search (within a group)

```
https://www.facebook.com/groups/{group_id}/search/?q={query}
```

Useful for finding specific content within a group after discovery.

## Broadening & Narrowing

### Broadening (if too few groups found)

Use synonyms and related terms:

| Original Topic    | Broader / Synonym Terms                                                            |
| ----------------- | ---------------------------------------------------------------------------------- |
| home gardening    | vegetable gardening, raised beds, container gardening, urban farming, permaculture |
| marathon training | running, distance running, race preparation, jogging, 5K to marathon               |
| budget travel     | cheap flights, backpacking, travel hacking, hostel travel, solo travel             |
| home cooking      | meal prep, recipes, home chef, cooking tips                                        |
| running           | jogging, marathon training, trail running, 5K training                             |

### Narrowing (if too many groups / low relevance)

Add qualifiers:

- **Location**: "home gardening Seattle" → "home gardening Pacific Northwest"
- **Specificity**: "cooking" → "Indian cooking" or "vegan meal prep"
- **Skill level**: "photography" → "beginner photography" or "professional photography"
- **Time frame**: add "2024" or "2025" for active/current groups

## Evaluating Search Results

### From Web Search

Look for results from:

- Reddit threads recommending Facebook groups (high signal)
- Blog posts listing "best Facebook groups for X"
- Forum discussions about communities

Extract group names and search for them on Facebook directly if URLs aren't provided.

### From Facebook Search

Evaluate groups by:

| Signal         | Good                      | Mediocre                |
| -------------- | ------------------------- | ----------------------- |
| Member count   | > 5,000                   | < 500                   |
| Recent posts   | "10+ new posts today"     | "Last post 2 weeks ago" |
| Privacy        | Public (easier to browse) | Private (need to join)  |
| Description    | Clear topic focus         | Vague or off-topic      |
| Admin activity | Active moderation         | Spam-filled feed        |

### Red Flags (skip these groups)

- Groups with mostly promotional content / buy-sell focus (unless that's the topic)
- Groups with very low activity relative to member count (dead community)
- Groups that require answering questions to join (adds friction, may not be worth it)
- Groups where the name doesn't match the topic closely
