/**
 * scholarship-agent.js — ScholarHub AI Agent
 * Runs every 2 hours via GitHub Actions.
 * 1. Researches fresh scholarships → saves as drafts
 * 2. Writes new blog guides/tips → saves as drafts
 */

import fetch from 'node-fetch';

const GROQ_API_KEY         = process.env.GROQ_API_KEY;
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!GROQ_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

/* ------------------------------------------
   GROQ HELPER — send a prompt, get text back
------------------------------------------ */

async function askGroq(systemPrompt, userPrompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + GROQ_API_KEY,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature: 0.7,
      max_tokens:  3000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Groq API error: ' + err);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('No response from Groq');
  return text;
}

/* ------------------------------------------
   SUPABASE HELPERS
------------------------------------------ */

async function supabaseGet(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Supabase GET failed (' + res.status + '): ' + err);
  }
  return res.json();
}

async function supabasePost(table, body) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Supabase POST failed (' + res.status + '): ' + err);
  }
  return true;
}

/* ------------------------------------------
   PART 1: SCHOLARSHIP DISCOVERY
------------------------------------------ */

async function discoverScholarships() {
  console.log('\n--- PART 1: Scholarship Discovery ---');

  const today    = new Date();
  const year     = today.getFullYear();
  const month    = today.toLocaleString('en-US', { month: 'long' });
  const nextYear = year + 1;

  const userPrompt = `Today is ${month} ${year}.

Find 5 scholarships that are CURRENTLY OPEN with deadlines in ${year} or early ${nextYear}.
Focus on fresh opportunities relevant for Nigerian, African, or international students.
Do NOT include Chevening, Fulbright, DAAD, Commonwealth — find less commonly listed ones.
All deadlines must be in the future (after ${month} ${year}).

Return ONLY a valid JSON array, no other text:
[
  {
    "id": "scholarship-name-${year}",
    "title": "Full Scholarship Name",
    "organization": "Organization Name",
    "emoji": "🎓",
    "description": "2-3 sentences describing who it is for and what it covers.",
    "amount": "Fully Funded",
    "level": ["postgraduate"],
    "region": ["nigeria", "africa"],
    "country_of_study": "Country",
    "deadline": "${year}-12-01",
    "link": "https://official-link.com",
    "tags": ["fully-funded", "postgraduate"],
    "featured": false
  }
]

Rules: IDs lowercase with hyphens, level options: undergraduate/postgraduate/phd, region options: nigeria/africa/international, return exactly 5 items, JSON only.`;

  const raw      = await askGroq('You are a scholarship research assistant. Return only valid JSON arrays, no other text.', userPrompt);
  const cleaned  = raw.replace(/```json|```/g, '').trim();

  let scholarships;
  try {
    scholarships = JSON.parse(cleaned);
    if (!Array.isArray(scholarships)) throw new Error('Not an array');
  } catch (e) {
    console.error('Failed to parse scholarship JSON:', cleaned.slice(0, 300));
    throw new Error('Invalid scholarship JSON: ' + e.message);
  }

  console.log('Groq found ' + scholarships.length + ' scholarships');

  // Get existing IDs to avoid duplicates
  const existing = await supabaseGet('scholarships?select=id');
  const existingIds = new Set(existing.map(s => s.id));
  console.log(existingIds.size + ' scholarships already in database');

  let saved = 0, skipped = 0;

  for (const s of scholarships) {
    if (!s.id || !s.title || !s.organization) { skipped++; continue; }

    // Sanitise ID
    s.id = s.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

    if (existingIds.has(s.id)) {
      console.log('Duplicate skipped: ' + s.id);
      skipped++; continue;
    }

    try {
      await supabasePost('scholarships', { ...s, status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      console.log('Draft saved: ' + s.title);
      saved++;
    } catch (err) {
      console.error('Failed to save ' + s.title + ': ' + err.message);
      skipped++;
    }
  }

  console.log('Scholarships — Saved: ' + saved + ', Skipped: ' + skipped);
}

/* ------------------------------------------
   PART 2: BLOG POST / GUIDE WRITING
------------------------------------------ */

async function writeGuides() {
  console.log('\n--- PART 2: Blog Guide Writing ---');

  const today = new Date();
  const year  = today.getFullYear();
  const month = today.toLocaleString('en-US', { month: 'long' });

  // Get existing post IDs to avoid duplicates
  const existing    = await supabaseGet('blog_posts?select=id');
  const existingIds = new Set(existing.map(p => p.id));
  console.log(existingIds.size + ' blog posts already in database');

  // Step 1: Ask Groq for 2 guide ideas
  const ideasPrompt = `Today is ${month} ${year}. You help students find and win scholarships.

Suggest 2 fresh, practical blog post ideas for Nigerian and African students applying for scholarships in ${year}.
Focus on specific, actionable topics not commonly covered — like visa tips, reference letter strategies, specific country scholarship guides, interview prep for specific scholarships, etc.

Return ONLY a JSON array:
[
  {
    "id": "unique-post-id-${year}",
    "title": "Blog Post Title",
    "category": "Application Tips",
    "excerpt": "One sentence summary of what the post covers."
  }
]

Category options: Application Tips, Scholarship Lists, Guides, Interviews
Return exactly 2 ideas, JSON only.`;

  const ideasRaw    = await askGroq('You are a scholarship blog editor. Return only valid JSON.', ideasPrompt);
  const ideasClean  = ideasRaw.replace(/```json|```/g, '').trim();

  let ideas;
  try {
    ideas = JSON.parse(ideasClean);
    if (!Array.isArray(ideas)) throw new Error('Not an array');
  } catch (e) {
    console.error('Failed to parse blog ideas:', ideasClean.slice(0, 300));
    throw new Error('Invalid ideas JSON: ' + e.message);
  }

  console.log('Groq suggested ' + ideas.length + ' blog post ideas');

  let saved = 0, skipped = 0;

  for (const idea of ideas) {
    if (!idea.id || !idea.title) { skipped++; continue; }

    // Sanitise ID
    idea.id = idea.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

    if (existingIds.has(idea.id)) {
      console.log('Duplicate post skipped: ' + idea.id);
      skipped++; continue;
    }

    // Step 2: Write the full post content
    console.log('Writing post: ' + idea.title);

    const contentPrompt = `Write a detailed, practical blog post for Nigerian and African scholarship applicants.

Title: "${idea.title}"
Category: ${idea.category}

Write the full post content in HTML format using these tags only: <h2>, <h3>, <p>, <ul>, <li>, <strong>.
Use <div class="callout"> for important tips or warnings.
Write at least 5 sections with <h2> headings.
Be specific, practical, and encouraging. Avoid generic advice.
Include real examples where possible.

Return ONLY the HTML content, no other text, no markdown.`;

    let content;
    try {
      content = await askGroq('You are an expert scholarship coach writing for Nigerian and African students.', contentPrompt);
      // Strip any accidental markdown
      content = content.replace(/```html|```/g, '').trim();
    } catch (err) {
      console.error('Failed to write content for ' + idea.title + ': ' + err.message);
      skipped++; continue;
    }

    // Estimate read time (avg 200 words/minute)
    const wordCount = content.replace(/<[^>]+>/g, '').split(/\s+/).length;
    const readTime  = Math.max(3, Math.round(wordCount / 200)) + ' min read';

    try {
      await supabasePost('blog_posts', {
        id:         idea.id,
        title:      idea.title,
        category:   idea.category,
        excerpt:    idea.excerpt || '',
        content:    content,
        image:      '',
        read_time:  readTime,
        date:       new Date().toISOString().split('T')[0],
        featured:   false,
        status:     'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      console.log('Blog draft saved: ' + idea.title);
      saved++;
    } catch (err) {
      console.error('Failed to save post ' + idea.title + ': ' + err.message);
      skipped++;
    }
  }

  console.log('Blog posts — Saved: ' + saved + ', Skipped: ' + skipped);
}

/* ------------------------------------------
   MAIN
------------------------------------------ */

async function main() {
  console.log('ScholarHub AI Agent starting...');
  console.log('Time:', new Date().toISOString());

  try {
    await discoverScholarships();
  } catch (err) {
    console.error('Scholarship discovery failed:', err.message);
  }

  try {
    await writeGuides();
  } catch (err) {
    console.error('Guide writing failed:', err.message);
  }

  console.log('\nAgent complete.');
}

main();
