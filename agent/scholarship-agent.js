/**
 * scholarship-agent.js — ScholarHub AI Agent
 * Uses Groq API (free, no credit card) instead of Gemini.
 * Groq runs Llama 3 which is excellent for structured data tasks.
 * Runs every 2 hours via GitHub Actions.
 */

import fetch from 'node-fetch';

const GROQ_API_KEY      = process.env.GROQ_API_KEY;
const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!GROQ_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables.');
  process.exit(1);
}

/* ------------------------------------------
   STEP 1: Ask Groq/Llama to research scholarships
   Groq is free: 14,400 requests/day, no credit card
------------------------------------------ */

async function researchScholarships() {
  console.log('Asking Groq AI to research new scholarships...');

  const today = new Date();
  const year  = today.getFullYear();
  const month = today.toLocaleString('en-US', { month: 'long' });

  const prompt = `You are a real-time scholarship discovery agent. Today is ${month} ${year}.

Your job is to find 5 scholarships that are:
- CURRENTLY OPEN with deadlines in ${year} or early ${year + 1}
- Recently announced or newly opened — not scholarships that closed months ago
- Relevant for Nigerian, African, or international students
- From reputable organizations (governments, universities, foundations, NGOs)

Do NOT return scholarships with deadlines that have already passed.
Do NOT return well-known ones like Chevening, Fulbright, DAAD, Commonwealth — find FRESH ones.
Focus on scholarships announced or opened in the last few weeks or months of ${year}.

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks:

[
  {
    "id": "unique-lowercase-id-with-hyphens-${year}",
    "title": "Full scholarship name",
    "organization": "Awarding organization",
    "emoji": "🎓",
    "description": "2-3 sentences about who it is for, what it covers, and why it matters",
    "amount": "Fully Funded",
    "level": ["postgraduate"],
    "region": ["nigeria", "africa"],
    "country_of_study": "Country where studies take place",
    "deadline": "${year}-11-30",
    "link": "https://official-application-url.com",
    "tags": ["fully-funded", "postgraduate"],
    "featured": false
  }
]

Rules:
- All deadlines must be in ${year} or ${year + 1} — no past deadlines
- IDs: lowercase, hyphens only, include the year e.g. "gates-cambridge-${year}"
- level: undergraduate, postgraduate, or phd
- region: nigeria, africa, international
- Return exactly 5 scholarships
- Return ONLY the JSON array, absolutely nothing else`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + GROQ_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a scholarship research assistant. Always respond with valid JSON only, no other text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error('Groq API error: ' + err);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) throw new Error('No response from Groq');

  // Strip any accidental markdown fences
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Response is not an array');
    return parsed;
  } catch (e) {
    console.error('Failed to parse Groq response:', cleaned.slice(0, 500));
    throw new Error('Groq returned invalid JSON: ' + e.message);
  }
}

/* ------------------------------------------
   STEP 2: Check for duplicates in Supabase
------------------------------------------ */

async function getExistingIds() {
  const url = SUPABASE_URL + '/rest/v1/scholarships?select=id';
  console.log('Fetching from:', url);
  console.log('Using service key (first 20 chars):', SUPABASE_SERVICE_KEY.slice(0, 20));
  
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
    },
  });
  
  console.log('Supabase response status:', response.status);
  
  if (!response.ok) {
    const errText = await response.text();
    console.error('Supabase error body:', errText);
    throw new Error('Failed to fetch existing scholarships: ' + response.status + ' ' + errText);
  }
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

  const response = await fetch(SUPABASE_URL + '/rest/v1/scholarships', {
    method: 'POST',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Content-Type':  'application/json',
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(body),
  });

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
    const scholarships = await researchScholarships();
    console.log('Groq found ' + scholarships.length + ' scholarships');

    const existingIds = await getExistingIds();
    console.log(existingIds.size + ' scholarships already in database');

    let saved = 0;
    let skipped = 0;

    for (const scholarship of scholarships) {
      if (!scholarship.id || !scholarship.title || !scholarship.organization) {
        console.log('Skipping invalid entry (missing required fields)');
        skipped++;
        continue;
      }

      // Sanitise ID to be URL-safe
      scholarship.id = scholarship.id
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

      if (existingIds.has(scholarship.id)) {
        console.log('Skipping duplicate: ' + scholarship.id);
        skipped++;
        continue;
      }

      try {
        await saveDraft(scholarship);
        console.log('Saved draft: ' + scholarship.title);
        saved++;
      } catch (err) {
        console.error('Failed to save ' + scholarship.title + ': ' + err.message);
        skipped++;
      }
    }

    console.log('\nAgent complete. Saved: ' + saved + ', Skipped: ' + skipped);

  } catch (err) {
    console.error('Agent failed:', err.message);
    process.exit(1);
  }
}

main();
