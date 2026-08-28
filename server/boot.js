// Point d'entrée réel : charge .env (s'il existe) AVANT d'importer le serveur,
// afin que les modules important process.env.JWT_SECRET au chargement (voir
// server/services/authService.js) voient bien la valeur définie dans .env.
// (Un `import` ES module classique serait hoisté avant ce code et s'exécuterait
// trop tôt — d'où ce petit fichier de démarrage séparé avec un import dynamique.)
try {
  process.loadEnvFile();
} catch {
  // Pas de .env trouvé (ex : variables déjà fournies par l'environnement d'hébergement) — normal.
}

await import("./index.js");
