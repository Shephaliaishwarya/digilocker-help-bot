
const { GoogleAuth } = require("google-auth-library");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Please send a POST request." });
  }

  try {
    const question = req.body?.message;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "Please enter a question." });
    }

    const credentials = JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    );

    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();

    const projectId = credentials.project_id;
    const sessionId = "digilocker-web-session";

    const url =
      `https://dialogflow.googleapis.com/v2/projects/${projectId}` +
      `/agent/sessions/${sessionId}:detectIntent`;

    const response = await client.request({
      url,
      method: "POST",
      data: {
        queryInput: {
          text: {
            text: question,
            languageCode: "en",
          },
        },
      },
    });

    const answer =
      response.data?.queryResult?.fulfillmentText ||
      "Sorry, I couldn't find an answer. Please try another question.";

    return res.status(200).json({ answer });
  } catch (error) {
    console.error("Dialogflow chat error:", error.message);

    return res.status(500).json({
      error: "Sorry, the chatbot is temporarily unavailable.",
    });
  }
};
