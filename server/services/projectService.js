import crypto from "node:crypto";
import { run, get, all } from "../db/db.js";

function parseProject(row) {
  if (!row) return null;
  return { ...row, form_data: JSON.parse(row.form_data || "{}") };
}

export function createProject(userId, projectType) {
  const id = crypto.randomUUID();
  run("INSERT INTO projects (id, user_id, project_type, form_data) VALUES (?, ?, ?, ?)", [id, userId, projectType, "{}"]);
  return getProject(userId, id);
}

export function getProject(userId, projectId) {
  const row = get("SELECT * FROM projects WHERE id = ? AND user_id = ?", [projectId, userId]);
  return parseProject(row);
}

export function listProjects(userId) {
  const rows = all("SELECT id, project_type, status, current_step, created_at, updated_at, form_data FROM projects WHERE user_id = ? ORDER BY updated_at DESC", [userId]);
  return rows.map((r) => ({ ...parseProject(r), nomProjet: JSON.parse(r.form_data || "{}")?.projet?.nomProjet || "Projet sans nom" }));
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      target[key] = deepMerge(target[key] && typeof target[key] === "object" ? target[key] : {}, source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

export function updateProjectFormData(userId, projectId, partialFormData, currentStep) {
  const project = getProject(userId, projectId);
  if (!project) return null;
  const merged = deepMerge(project.form_data, partialFormData || {});
  const step = currentStep !== undefined ? currentStep : project.current_step;
  run("UPDATE projects SET form_data = ?, current_step = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?", [JSON.stringify(merged), step, projectId, userId]);
  return getProject(userId, projectId);
}

export function setProjectStatus(userId, projectId, status) {
  run("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?", [status, projectId, userId]);
}

export function deleteProject(userId, projectId) {
  run("DELETE FROM projects WHERE id = ? AND user_id = ?", [projectId, userId]);
}
