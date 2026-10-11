
const fs = require("fs");
const path = require("path");

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function findAnswer(question, faqs) {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "am", "do", "does",
    "did", "i", "me", "my", "we", "you", "your", "how",
    "what", "where", "when", "can", "could", "would",
    "should", "to", "for", "of", "in", "on", "with",
    "and", "or", "it", "if", "please", "tell"
  ]);

  const queryWords = new Set(
    normalize(question).filter(word => !stopWords.has(word))
  );

  if (queryWords.size === 0) return null;

  let bestFaq = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const faqWords = new Set(
      normalize(
        `${faq.question} ${faq.category}`
      ).filter(word => !stopWords.has(word))
    );

    let matches = 0;
    for (const word of queryWords) {
      if (faqWords.has(word)) matches++;
    }

    const score = matches / queryWords.size;

    if (score > bestScore) {
      bestScore = score;
      bestFaq = faq;
    }
  }

  // Avoid returning an answer when the match is too weak.
  return bestScore >= 0.5 ? bestFaq : null;
}

module.exports = (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      fulfillmentText: "Please send a POST request."
    });
  }

  try {
    const faqPath = path.join(process.cwd(), "faq.json");
    const faqs = JSON.parse(
      fs.readFileSync(faqPath, "utf8")
    );

    const question =
      req.body?.queryResult?.queryText || "";

    const match = findAnswer(question, faqs);

    if (match) {
      return res.status(200).json({
        fulfillmentText:
          `${match.answer}\n\nSource: ${match.source_url}`
      });
    }

    return res.status(200).json({
      fulfillmentText:
        "I couldn't find a reliable answer in my DigiLocker FAQ. " +
        "Please check the official FAQ: " +
        "https://www.digilocker.gov.in/web/about/faq"
    });
  } catch (error) {
    console.error("FAQ webhook error:", error);

    return res.status(500).json({
      fulfillmentText:
        "Sorry, I couldn't retrieve the FAQ right now. Please try again."
    });
  }
};
