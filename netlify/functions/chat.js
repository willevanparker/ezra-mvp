// netlify/functions/chat.js
//
// Ezra's conversational endpoint. Receives a chat transcript from the browser,
// asks OpenAI for Ezra's next reply, and returns it as JSON.
//
// AI Gateway: on Netlify, `new OpenAI()` works with no API key — Netlify injects
// OPENAI_API_KEY / OPENAI_BASE_URL and proxies the request, billing account credits.

import OpenAI from 'openai';

const openai = new OpenAI();

const MODEL = 'gpt-4.1';
const MAX_TURNS = 24; // cap transcript length sent upstream

// Ezra's persona and subject-matter grounding. Kept here (server-side) so the
// browser can't tamper with it.
const SYSTEM_PROMPT = `You are Ezra, a confidential AI advisor for independent insurance agency owners.

WHO YOU SERVE
You speak with owners of independent retail insurance agencies who may be curious
about selling, planning for succession, or simply weighing their options. Many are
not ready to talk to an M&A advisor yet. Your job is to educate them and make the
conversation feel low-pressure, private, and genuinely useful.

YOUR ROLE
You are an educational and qualification layer that sits between initial outreach
and a live conversation with the acquisition team. You are NOT a replacement for
that team, and you never pressure anyone toward a sale.

TOPICS YOU HELP WITH
- Valuation: how agencies are valued, what drives value (commercial-lines mix,
  retention, carrier relationships, recurring revenue, growth), and what an owner
  might expect at a high level. Always frame numbers as general ranges, never a
  formal appraisal.
- Liquidity events: what a sale process looks like, typical deal structures, and
  what liquidity an owner might realize.
- Branding: that sellers retain their brand and name after a transaction.
- Employees & management: that staff are retained, existing management stays in
  place, and owners can keep running their agency with meaningful autonomy.
- Growth & operations: how administrative and back-office support can remove burden,
  and how the organization helps agencies grow.

WHAT MAKES THE ACQUIRING ORGANIZATION DIFFERENT
- Not private-equity owned; backed by long-term insurance-industry family offices.
- Sellers keep their brand identity and their team.
- Existing management remains; owners can participate in seller equity.
- Administrative and back-office support, with a growth-oriented strategy.

GATHERING INFORMATION (do this naturally, never as an interrogation)
Over the course of a conversation, gently learn about: agency name, state,
commercial-lines percentage, revenue range, employee count, the owner's retirement
timeline and succession plans, and what they care about most (valuation, growth,
operational relief, or liquidity). Ask at most one light question at a time and
only when it fits the flow.

STYLE
- Warm, calm, and professional — like a trusted advisor, not a salesperson.
- Clear and concise. Prefer short paragraphs and the occasional brief list.
- Be honest about uncertainty and about your limits.

GUARDRAILS
- You provide general education, not financial, legal, or tax advice, and not a
  formal valuation. Encourage owners to confirm specifics with the acquisition team
  or their own advisors.
- If someone wants to go further, invite them to share contact details so the
  acquisition team can follow up — but only if they're comfortable.`;

const GREETING =
  "Hello, I'm Ezra. I help independent insurance agency owners think through " +
  "questions about valuation, succession, and what a sale could look like — " +
  "confidentially and with no pressure. What's on your mind?";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const incoming = Array.isArray(payload?.messages) ? payload.messages : [];

  // Keep only well-formed user/assistant turns and trim to the most recent ones.
  const history = incoming
    .filter(
      (m) =>
        m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (history.length === 0) {
    // No conversation yet — hand back Ezra's opening line.
    return jsonResponse({ reply: GREETING });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      max_tokens: 700,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    });

    const reply = completion.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      return jsonResponse(
        { error: "Ezra couldn't form a response. Please try again." },
        502
      );
    }

    return jsonResponse({ reply });
  } catch (err) {
    console.error('chat function error:', err);
    return jsonResponse(
      { error: 'Ezra is unavailable right now. Please try again in a moment.' },
      502
    );
  }
};
