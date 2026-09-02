#!/usr/bin/env node
/**
 * breezy_client.js — shared Breezy HR API client for the recruiting sourcing agent.
 * Auth pattern reused from the P&C Recruiting Dashboard project (scripts/pull_breezy.js).
 */
const https = require("https");

const BASE_URL = "https://api.breezy.hr/v3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function request(method, p, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + p);
    const data = body ? JSON.stringify(body) : null;
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (token) headers["Authorization"] = token;
    if (data) headers["Content-Length"] = Buffer.byteLength(data);
    const req = https.request(
      { hostname: url.hostname, path: url.pathname + url.search, method, headers },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            if (res.statusCode >= 400) reject(new Error(`API ${res.statusCode}: ${raw.slice(0, 300)}`));
            else resolve(parsed);
          } catch { reject(new Error(`parse fail: ${raw.slice(0, 300)}`)); }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

class BreezyClient {
  constructor(email, password) {
    this.email = email;
    this.password = password;
    this.token = null;
  }
  async getToken() {
    if (this.token) return this.token;
    const r = await request("POST", "/signin", { email: this.email, password: this.password }, null);
    if (!r.access_token) throw new Error("Breezy signin failed");
    this.token = r.access_token;
    return this.token;
  }
  async api(method, p, body, retries = 5) {
    const token = await this.getToken();
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await request(method, p, body, token);
      } catch (e) {
        if (/API 429/.test(e.message) && attempt < retries) {
          await sleep(2000 * Math.pow(2, attempt));
          continue;
        }
        throw e;
      }
    }
  }
  listPositions() { return this.api("GET", "/company/positions"); }
  getPosition(positionId) { return this.api("GET", `/company/positions/${positionId}`); }
  listCandidates(positionId) { return this.api("GET", `/company/positions/${positionId}/candidates`); }
  getCandidate(positionId, candidateId) { return this.api("GET", `/company/positions/${positionId}/candidates/${candidateId}`); }
}

module.exports = { BreezyClient };
