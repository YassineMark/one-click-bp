import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { repondreChatbot, chatbotDisponible } from "../services/chatbotService.js";

export const chatbotRouter = Router();

chatbotRouter.get("/status", requireAuth, (req, res) => {
  res.json({ disponible: chatbotDisponible() });
});

chatbotRouter.post("/message", requireAuth, async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "MESSAGES_REQUIS", message: "Aucun message fourni." });
  }

  try {
    const reply = await repondreChatbot(messages);
    res.json({ reply });
  } catch (e) {
    if (e.code === "CHATBOT_INDISPONIBLE") {
      return res.status(503).json({
        error: "CHATBOT_INDISPONIBLE",
        message: "L'assistant n'est pas configuré (clé API manquante).",
      });
    }
    if (e.code === "MESSAGE_INVALIDE") {
      return res.status(400).json({
        error: "MESSAGE_INVALIDE",
        message: "Le dernier message doit provenir de l'utilisateur.",
      });
    }
    console.error("Erreur chatbot:", e);
    res.status(502).json({
      error: "ERREUR_CHATBOT",
      message: "L'assistant est momentanément indisponible, réessayez.",
    });
  }
});
