const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Missing GEMINI_API_KEY");
  process.exit(1);
}

const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
if (!res.ok) {
  console.error(`ListModels failed: ${res.status}`);
  process.exit(1);
}
const data = await res.json();
const models = Array.isArray(data.models) ? data.models : [];
const usable = models.filter(
  (m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent")
);
console.log(JSON.stringify(usable, null, 2));
