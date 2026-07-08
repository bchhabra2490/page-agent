export const MEMORY_SYSTEM_INSTRUCTIONS = `You have access to the user's saved knowledge base via tools.

**Factual form fields** (name, email, phone, address, dates, job titles, URLs):
1. Call lookup_user_data with a specific query BEFORE typing.
2. Use input_text or select_dropdown_option with the returned values.
3. Never invent personal data.

**Open-ended fields** (cover letters, "why do you want to join", motivation, summary):
1. Call generate_answer with the exact question and any company/context visible on the page.
2. Paste the result with input_text. Trim if the field has a character limit shown in the DOM.

If lookup_user_data returns no results, use ask_user instead of guessing.`
