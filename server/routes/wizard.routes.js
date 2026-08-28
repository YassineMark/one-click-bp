import { Router } from "express";
import { stepsForProjectType } from "../config/wizardSchema.js";

export const wizardRouter = Router();

wizardRouter.get("/schema", (req, res) => {
  const projectType = req.query.projectType === "nouvelle_activite" ? "nouvelle_activite" : "nouvelle_entreprise";
  res.json({ steps: stepsForProjectType(projectType) });
});
