/**
 * Deploys to Cloud Run in the two steps this app actually needs.
 *
 * `gcloud run deploy --source .` on its own is not enough, and fails in the
 * quietest possible way. Next inlines NEXT_PUBLIC_* at build time, so the
 * Firebase web configuration has to reach `docker build` as build args — and
 * `--set-build-env-vars` does not do that for a Dockerfile build. gcloud
 * accepts the flag, drops it, and ships an image whose config is empty
 * strings. Nothing errors. The app serves every page normally and the sign-in
 * button just cannot work.
 *
 * So: build through cloudbuild.yaml, which passes the args explicitly, then
 * deploy that image.
 *
 * Reads the values from the environment, or from .env.local if present.
 */
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT ?? "promptwar-501405";
const REGION = process.env.CLOUD_RUN_REGION ?? "asia-south1";
const SERVICE = process.env.CLOUD_RUN_SERVICE ?? "kavach";
const IMAGE = `${REGION}-docker.pkg.dev/${PROJECT}/cloud-run-source-deploy/${SERVICE}:latest`;

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !env[match[1]]) env[match[1]] = match[2];
  }
}

const SUBSTITUTIONS = {
  _FB_API_KEY: "NEXT_PUBLIC_FIREBASE_API_KEY",
  _FB_AUTH_DOMAIN: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  _FB_PROJECT_ID: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  _FB_STORAGE_BUCKET: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  _FB_SENDER_ID: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  _FB_APP_ID: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

const missing = Object.values(SUBSTITUTIONS).filter((name) => !env[name]);
if (missing.length) {
  // Refuse rather than ship the silent failure this script exists to prevent.
  console.error(
    `Refusing to deploy: missing ${missing.join(", ")}.\n` +
      `Put them in .env.local or the environment — see .env.example.`
  );
  process.exit(1);
}

const subs = Object.entries(SUBSTITUTIONS)
  .map(([key, name]) => `${key}=${env[name]}`)
  .join(",");

function run(label, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync("gcloud", args, { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("build", [
  "builds", "submit",
  "--config", "cloudbuild.yaml",
  "--region", REGION,
  "--project", PROJECT,
  `--substitutions=${subs},_IMAGE=${IMAGE}`,
  "--quiet",
]);

run("deploy", [
  "run", "deploy", SERVICE,
  "--image", IMAGE,
  "--region", REGION,
  "--project", PROJECT,
  "--quiet",
]);

console.log("\nDeployed. Verify the config actually shipped:");
console.log(
  `  curl -s https://<service-url>/_next/static/chunks/*.js | grep -c 'apiKey:""'   # expect 0`
);
