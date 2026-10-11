
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
  const text = String(question || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;

  // Match specific topics before using general keyword matching.
  const topicRules = [
    {
      keywords: [
        "register", "registration", "sign up", "signup",
        "create account", "new account"
      ],
      categoryWords: ["registration", "register", "account creation"]
    },
    {
      keywords: [
        "otp", "one time password", "verification code",
        "not receiving", "not received", "sms code"
      ],
      categoryWords: ["otp", "verification", "login"]
    },
    {
      keywords: [
        "digital document", "issued document", "certificate",
        "download document", "access document", "my documents"
      ],
      categoryWords: ["document", "certificate", "issued documents"]
    }
  ];

  for (const rule of topicRules) {
    if (rule.keywords.some(keyword => text.includes(keyword))) {
      const candidates = faqs.filter(faq => {
        const content =
          `${faq.question || ""} ${faq.category || ""}`.toLowerCase();

        return rule.categoryWords.some(keyword =>
          content.includes(keyword)
        );
      });

      if (candidates.length === 1) return candidates[0];

      if (candidates.length > 1) {
        const queryWords = new Set(text.split(" "));
        let best = null;
        let bestScore = 0;

        for (const faq of candidates) {
          const faqText =
            `${faq.question || ""} ${faq.category || ""}`
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, " ");

          const faqWords = new Set(faqText.split(/\s+/));
          let score = 0;

          for (const word of queryWords) {
            if (word.length > 2 && faqWords.has(word)) score++;
          }

          if (score > bestScore) {
            bestScore = score;
            best = faq;
          }
        }

        if (best && bestScore >= 1) return best;
      }
    }
  }

  // Conservative fallback: only answer when enough words overlap.
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "am", "do", "does",
    "did", "i", "me", "my", "we", "you", "your", "how",
    "what", "where", "when", "can", "could", "would",
    "should", "to", "for", "of", "in", "on", "with",
    "and", "or", "it", "if", "please", "tell"
  ]);

  const queryWords = new Set(
    text.split(" ").filter(word => word && !stopWords.has(word))
  );

  if (queryWords.size === 0) return null;

  let bestFaq = null;
  let bestScore = 0;

  for (const faq of faqs) {
    const faqWords = new Set(
      `${faq.question || ""} ${faq.category || ""}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter(word => word && !stopWords.has(word))
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

  return bestScore >= 0.7 ? bestFaq : null;
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
