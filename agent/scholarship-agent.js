/**
 * scholarship-agent.js — ScholarHub AI Agent
 * Runs every 2 hours via GitHub Actions.
 * Uses Gemini to research new scholarships and saves them
 * as drafts in Supabase for admin review before publishing.
 */

import fetch from 'node-fetch';

const GEMINI_API_KEY    = process.env.GEMINI_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

/* ------------------------------------------
   STEP 1: Ask Gemini to research scholarships
------------------------------------------ */

async function researchScholarships() {
  console.log('Asking Gemini to research new scholarships...');

  const prompt = `You are a scholarship research assistant. Research and find 5 real, currently open scholarships that would be relevant for Nigerian, African, or international students.

For each scholarship, provide the following in valid JSON format only (no markdown, no explanation, just the JSON array):

[
  {
    "id": "unique-id-with-hyphens-lowercase",
    "title": "Full scholarship name",
    "organization": "Awarding organization name",
    "emoji": "One relevant emoji",
    "description": "2-3 sentence description of the scholarship, who it is for, and what it covers",
    "amount": "Fully Funded OR Partial OR specific amount",
    "level": ["undergraduate", "postgraduate", or "phd" - include all that apply],
    "region": ["nigeria", "africa", "international" - include all that apply],
    "country_of_study": "Country where studies take place",
    "deadline": "YYYY-MM-DD format if known, or null",
    "link": "Official application URL",
    "tags": ["relevant", "tags", "here"],
    "featured": false
  }
]

Focus on scholarships that:
- Are currently open or opening soon in 2025-2026
- Are fully funded or significant partial funding
- Are legitimate and from reputable organizations
- Have not been commonly listed (find fresh opportunities)

Return ONLY the JSON array. No other text.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Gemini API error: ' + err);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error('No response from Gemini');

  // Strip any markdown code blocks if Gemini adds them
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse Gemini response:', cleaned);
    throw new Error('Gemini returned invalid JSON');
  }
}

/* ------------------------------------------
   STEP 2: Check for duplicates in Supabase
------------------------------------------ */

async function getExistingIds() {
  const response = await fetch(
    SUPABASE_URL + '/rest/v1/scholarships?select=id',
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      },
    }
  );

  if (!response.ok) throw new Error('Failed to fetch existing scholarships');
  const data = await response.json();
  return new Set(data.map(s => s.id));
}

/* ------------------------------------------
   STEP 3: Save new scholarships as drafts
------------------------------------------ */

async function saveDraft(scholarship) {
  const body = {
    ...scholarship,
    status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const response = await fetch(
    SUPABASE_URL + '/rest/v1/scholarships',
    {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Failed to save draft: ' + err);
  }

  return true;
}

/* ------------------------------------------
   MAIN
------------------------------------------ */

async function main() {
  console.log('ScholarHub AI Agent starting...');
  console.log('Time:', new Date().toISOString());

  try {
    // Research new scholarships
    const scholarships = await researchScholarships();
    console.log(`Gemini found ${scholarships.length} scholarships`);

    // Get existing IDs to avoid duplicates
    const existingIds = await getExistingIds();
    console.log(`${existingIds.size} scholarships already in database`);

    // Save new ones as drafts
    let saved = 0;
    let skipped = 0;

    for (const scholarship of scholarships) {
      // Skip if ID already exists
      if (existingIds.has(scholarship.id)) {
        console.log(`Skipping duplicate: ${scholarship.id}`);
        skipped++;
        continue;
      }

      // Validate required fields
      if (!scholarship.id || !scholarship.title || !scholarship.organization) {
        console.log('Skipping invalid entry:', scholarship);
        skipped++;
        continue;
      }

      // Ensure ID is URL-safe
      scholarship.id = scholarship.id
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 80);

      try {
        await saveDraft(scholarship);
        console.log(`Saved draft: ${scholarship.title}`);
        saved++;
      } catch (err) {
        console.error(`Failed to save ${scholarship.title}:`, err.message);
        skipped++;
      }
    }

    console.log(`\nAgent complete. Saved: ${saved}, Skipped: ${skipped}`);

  } catch (err) {
    console.error('Agent failed:', err.message);
    process.exit(1);
  }
}

main();
