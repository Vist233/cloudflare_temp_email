import { Context } from "hono";
import { Jwt } from "hono/utils/jwt";

import { getZhangAuthUrl } from "../utils";
import { ensureLocalUserFromOidc, issueLocalUserJwt } from "./user";

const transactionCookie = "__Host-tmpmail-oidc";
const resultCookie = "__Host-tmpmail-oidc-result";
const transactionLifetimeSeconds = 600;
const providerName = "https://auth.zhangyvjing.com";
const redirectUri = "https://tmpmail.zhangyvjing.com/user_api/oidc/callback";

type Discovery = {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
    jwks_uri: string;
};

type Transaction = { state: string; nonce: string; verifier: string; exp: number };
type IdToken = { iss: string; sub: string; aud: string | string[]; exp: number; nonce?: string; email?: string; email_verified?: boolean };

let cachedDiscovery: { value: Discovery; expiresAt: number } | null = null;
let cachedJwks: { value: { keys: JsonWebKey[] }; expiresAt: number } | null = null;

function requiredConfig(c: Context<HonoCustomType>) {
    const issuer = getZhangAuthUrl(c);
    const clientId = c.env.ZHANG_AUTH_CLIENT_ID?.trim();
    const clientSecret = c.env.ZHANG_AUTH_CLIENT_SECRET?.trim();
    const cookieSecret = c.env.TMPMAIL_OIDC_COOKIE_SECRET?.trim();
    if (!issuer || !clientId || !clientSecret || !cookieSecret) throw new Error("Zhang Auth OIDC is not configured");
    if (issuer !== providerName) throw new Error("Unexpected Zhang Auth issuer");
    return { issuer, clientId, clientSecret, cookieSecret };
}

function randomToken(size = 32): string {
    const bytes = crypto.getRandomValues(new Uint8Array(size));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Base64Url(value: string): Promise<string> {
    const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function cookie(name: string, value: string, maxAge: number): string {
    return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(c: Context<HonoCustomType>, name: string): string | null {
    const entry = c.req.header("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
    return entry ? decodeURIComponent(entry.slice(name.length + 1)) : null;
}

async function discovery(issuer: string): Promise<Discovery> {
    if (cachedDiscovery && cachedDiscovery.expiresAt > Date.now()) return cachedDiscovery.value;
    const response = await fetch(`${issuer}/.well-known/openid-configuration`);
    const value = await response.json<Discovery>();
    if (!response.ok || value.issuer !== issuer || !value.authorization_endpoint || !value.token_endpoint || !value.jwks_uri) throw new Error("Invalid OIDC discovery document");
    cachedDiscovery = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
    return value;
}

async function jwks(uri: string): Promise<{ keys: JsonWebKey[] }> {
    if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.value;
    const response = await fetch(uri);
    const value = await response.json<{ keys: JsonWebKey[] }>();
    if (!response.ok || !Array.isArray(value.keys)) throw new Error("Invalid OIDC JWKS");
    cachedJwks = { value, expiresAt: Date.now() + 60 * 60 * 1000 };
    return value;
}

function base64UrlBytes(value: string): Uint8Array {
    const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

async function verifyIdToken(token: string, config: ReturnType<typeof requiredConfig>, metadata: Discovery, expectedNonce: string, refreshed = false): Promise<IdToken> {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed ID token");
    const header = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[0]))) as { alg?: string; kid?: string };
    const payload = JSON.parse(new TextDecoder().decode(base64UrlBytes(parts[1]))) as IdToken;
    if (header.alg !== "ES256" || !header.kid) throw new Error("Unsupported ID token header");
    const keys = await jwks(metadata.jwks_uri);
    const key = keys.keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "EC" && candidate.crv === "P-256");
    if (!key && !refreshed) { cachedJwks = null; return verifyIdToken(token, config, metadata, expectedNonce, true); }
    if (!key) throw new Error("Unknown ID token signing key");
    const publicKey = await crypto.subtle.importKey("jwk", key, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, publicKey, base64UrlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!valid || payload.iss !== config.issuer || !audience.includes(config.clientId) || payload.exp <= Math.floor(Date.now() / 1000) || payload.nonce !== expectedNonce || !payload.sub) throw new Error("ID token validation failed");
    return payload;
}

async function existingIdentity(c: Context<HonoCustomType>, subject: string): Promise<{ userId: number; email: string } | null> {
    const row = await c.env.DB.prepare(
        "SELECT users.id AS userId, users.user_email AS email FROM user_identities JOIN users ON users.id = user_identities.user_id WHERE provider = ? AND subject = ?"
    ).bind(providerName, subject).first<{ userId: number; email: string }>();
    return row ?? null;
}

export default {
    login: async (c: Context<HonoCustomType>) => {
        try {
            const config = requiredConfig(c);
            const metadata = await discovery(config.issuer);
            const state = randomToken();
            const nonce = randomToken();
            const verifier = randomToken(48);
            const transaction = await Jwt.sign({ state, nonce, verifier, exp: Math.floor(Date.now() / 1000) + transactionLifetimeSeconds }, config.cookieSecret, "HS256");
            const url = new URL(metadata.authorization_endpoint);
            url.search = new URLSearchParams({ response_type: "code", client_id: config.clientId, redirect_uri: redirectUri, scope: "openid profile email", state, nonce, code_challenge: await sha256Base64Url(verifier), code_challenge_method: "S256" }).toString();
            const response = c.redirect(url.toString(), 302);
            response.headers.append("Set-Cookie", cookie(transactionCookie, transaction, transactionLifetimeSeconds));
            return response;
        } catch (error) {
            console.error("Unable to start Zhang Auth OIDC", error);
            return c.text("Zhang Auth OIDC is unavailable", 503);
        }
    },

    callback: async (c: Context<HonoCustomType>) => {
        const clearTransaction = cookie(transactionCookie, "", 0);
        try {
            const config = requiredConfig(c);
            const code = c.req.query("code");
            const state = c.req.query("state");
            const rawTransaction = readCookie(c, transactionCookie);
            if (!code || !state || !rawTransaction) throw new Error("Missing OIDC callback transaction");
            const transaction = await Jwt.verify(rawTransaction, config.cookieSecret, "HS256") as Transaction;
            if (transaction.exp < Math.floor(Date.now() / 1000) || transaction.state !== state) throw new Error("OIDC state validation failed");
            const metadata = await discovery(config.issuer);
            const response = await fetch(metadata.token_endpoint, {
                method: "POST",
                headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}` },
                body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: transaction.verifier }).toString(),
            });
            const tokens = await response.json<{ id_token?: string }>();
            if (!response.ok || !tokens.id_token) throw new Error("OIDC token exchange failed");
            const identity = await verifyIdToken(tokens.id_token, config, metadata, transaction.nonce);
            let local = await existingIdentity(c, identity.sub);
            if (!local) {
                if (!identity.email || identity.email_verified !== true) throw new Error("A verified email is required for first tmpmail sign-in");
                const userId = await ensureLocalUserFromOidc(c, identity.email);
                await c.env.DB.prepare("INSERT INTO user_identities (provider, subject, user_id) VALUES (?, ?, ?)").bind(providerName, identity.sub, userId).run();
                local = { userId, email: identity.email.trim().toLowerCase() };
            }
            const localJwt = await issueLocalUserJwt(c, local.email, local.userId);
            const result = await Jwt.sign({ jwt: localJwt, exp: Math.floor(Date.now() / 1000) + 60 }, config.cookieSecret, "HS256");
            const redirect = c.redirect("/user?oidc=1", 302);
            redirect.headers.append("Set-Cookie", clearTransaction);
            redirect.headers.append("Set-Cookie", cookie(resultCookie, result, 60));
            return redirect;
        } catch (error) {
            console.error("Zhang Auth OIDC callback failed", error);
            const response = c.redirect("/user?oidc_error=1", 302);
            response.headers.append("Set-Cookie", clearTransaction);
            return response;
        }
    },

    complete: async (c: Context<HonoCustomType>) => {
        try {
            const config = requiredConfig(c);
            const raw = readCookie(c, resultCookie);
            if (!raw) return c.text("OIDC sign-in result is missing", 400);
            const result = await Jwt.verify(raw, config.cookieSecret, "HS256") as { jwt?: string; exp?: number };
            if (!result.jwt || !result.exp || result.exp < Math.floor(Date.now() / 1000)) return c.text("OIDC sign-in result expired", 400);
            const response = c.json({ jwt: result.jwt });
            response.headers.append("Set-Cookie", cookie(resultCookie, "", 0));
            return response;
        } catch {
            return c.text("OIDC sign-in result is invalid", 400);
        }
    },
};
