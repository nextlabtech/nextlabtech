#!/usr/bin/env node
import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const configPath = path.join(root, "cms.config.json");

async function loadConfig() {
  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.warn("[cms] No cms.config.json found. Skipping sync.");
    return null;
  }
}

async function fetchFile(apiBase, token, slug, fileId) {
  const response = await fetch(`${apiBase}/projects/${slug}/files/${fileId}`, {
    headers: {
      "x-once-admin-token": token,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${fileId}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  return payload.content ?? "";
}

async function writeTarget(pathRelative, contents) {
  const targetPath = path.join(root, pathRelative);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, contents, "utf-8");
  console.log(`[cms] Updated ${pathRelative}`);
}

async function main() {
  const config = await loadConfig();
  if (!config) return;

  const apiBase = process.env.ONCE_ADMIN_API_URL || "http://localhost:3333/api";
  const token = process.env.ONCE_ADMIN_TOKEN || process.env.ADMIN_SESSION_TOKEN;

  if (!apiBase || !token) {
    console.warn("[cms] ONCE_ADMIN_API_URL or ONCE_ADMIN_TOKEN not set. Skipping sync.");
    return;
  }

  for (const file of config.files) {
    try {
      const content = await fetchFile(apiBase, token, config.slug, file.id);
      await writeTarget(file.path, content);
    } catch (error) {
      console.error(`[cms] ${error.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[cms] Sync failed:", error);
  process.exit(1);
});
