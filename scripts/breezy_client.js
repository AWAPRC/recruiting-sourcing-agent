#!/usr/bin/env node
/**
 * breezy_client.js — shared Breezy HR API client for the recruiting sourcing agent.
 * Auth + URL pattern reused exactly from the P&C Recruiting Dashboard project
 * (scripts/pull_breezy.js), which is the proven-working reference: Breezy's v3 API
 * requires the actual companyId in every path (fetched via GET /companies), and uses
 * singular /position/ and /candidate/ segments for individual-resource routes.
 */
const https = require("https");

const BASE_URL = "https://api.breezy.hr/v3";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function requestOnce(method, p, body, token) {
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
        res.on("end", () => resolve({ statusCode: res.statusCode, raw }));
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Retries automatically on 429 (rate limit) with exponential backoff, so
// scheduled/unattended runs (daily check, outreach send) self-recover
// instead of just failing when Breezy throttles us.
async function request(method, p, body, token, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const { statusCode, raw } = await requestOnce(method, p, body, token);
    if (statusCode === 429 && attempt < retries) {
      const waitMs = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s, 16s
      console.error(`DEBUG rate limited (429) on ${method} ${p}, retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(waitMs);
      continue;
    }
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (statusCode >= 400) { console.error("DEBUG failed request:", method, p); throw new Error(`API ${statusCode}: ${raw.slice(0, 300)}`); }
      return parsed;
    } catch (e) {
      if (e.message && e.message.startsWith("API ")) throw e;
      throw new Error(`parse fail: ${raw.slice(0, 300)}`);
    }
  }
}

class BreezyClient {
  constructor(email, password) {
    this.email = email;
    this.password = password;
    this.token = null;
    this.company = null;
  }
  async getToken() {
    if (this.token) return this.token;
    const r = await request("POST", "/signin", { email: this.email, password: this.password }, null);
    if (!r.access_token) throw new Error("Breezy signin failed");
    this.token = r.access_token;
    return this.token;
  }
  async getCompanyId() {
    if (this.company) return this.company;
    const cs = await this.api("GET", "/companies");
    console.error("DEBUG /companies raw response:", JSON.stringify(cs));
    this.company = cs[0]._id;
    console.error("DEBUG resolved companyId:", JSON.stringify(this.company));
    return this.company;
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
  async listPositions(stateFilter) {
    const company = await this.getCompanyId();
    const qs = stateFilter ? `?state=${encodeURIComponent(stateFilter)}` : "";
    return this.api("GET", `/company/${company}/positions${qs}`);
  }
  async getPosition(positionId) {
    const company = await this.getCompanyId();
    return this.api("GET", `/company/${company}/position/${positionId}`);
  }
  async listCandidates(positionId) {
    const company = await this.getCompanyId();
    return this.api("GET", `/company/${company}/position/${positionId}/candidates`);
  }
  async getCandidate(positionId, candidateId) {
    const company = await this.getCompanyId();
    return this.api("GET", `/company/${company}/position/${positionId}/candidate/${candidateId}`);
  }
  async getCandidateStream(positionId, candidateId) {
    const company = await this.getCompanyId();
    return this.api("GET", `/company/${company}/position/${positionId}/candidate/${candidateId}/stream`);
  }
}

module.exports = { BreezyClient };
