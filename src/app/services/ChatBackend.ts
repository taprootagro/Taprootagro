// ============================================================================
// THIS FILE IS A SERVER-SIDE REFERENCE ONLY
// ============================================================================
// This code is meant to run on your Supabase Edge Function (Deno runtime),
// NOT in the browser. The frontend should NEVER import this file directly
// (only the type interfaces at the bottom are imported by ChatProxyService).
//
// Supabase Edge Function path: supabase/functions/chat-proxy/index.ts
//
// The frontend calls these endpoints via fetch() through ChatProxyService.ts
//
// SUPPORTED IM PROVIDERS (selected via ConfigManager → Backend Proxy):
//   - Alibaba Cloud IM (互动消息)  — Server SDK + REST API
//   - Sendbird                    — Platform API + Server SDK
//   - CometChat                   — REST API + Server SDK
//
// All provider API keys/secrets are stored as Supabase Edge Function Secrets.
// The frontend only sends the provider name — the Edge Function routes
// to the correct provider implementation.
// ============================================================================

/*
// --- Supabase Edge Function: supabase/functions/chat-proxy/index.ts ---

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// Provider secrets from Supabase Dashboard → Secrets
const ALIYUN_APP_ID = Deno.env.get("ALIYUN_IM_APP_ID")!;
const ALIYUN_APP_KEY = Deno.env.get("ALIYUN_IM_APP_KEY")!;
const SENDBIRD_APP_ID = Deno.env.get("SENDBIRD_APP_ID")!;
const SENDBIRD_API_TOKEN = Deno.env.get("SENDBIRD_API_TOKEN")!;
const COMETCHAT_APP_ID = Deno.env.get("COMETCHAT_APP_ID")!;
const COMETCHAT_API_KEY = Deno.env.get("COMETCHAT_API_KEY")!;
const COMETCHAT_REGION = Deno.env.get("COMETCHAT_REGION") || "us";

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  try {
    // ---- POST /chat-proxy/token ----
    if (path === "token" && req.method === "POST") {
      const { channelName, uid, provider } = await req.json();

      if (!channelName || uid === undefined) {
        return new Response(
          JSON.stringify({ error: "channelName and uid are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let token = "";
      let appId = "";

      switch (provider) {
        case "aliyun-im":
          // Call Alibaba Cloud IM token API
          // https://help.aliyun.com/document_detail/xxx
          appId = ALIYUN_APP_ID;
          // token = await generateAliyunIMToken(ALIYUN_APP_ID, ALIYUN_APP_KEY, uid);
          token = `aliyun-token-placeholder-${Date.now()}`;
          break;

        case "sendbird":
          // Create/get Sendbird user session token
          // POST https://api-{SENDBIRD_APP_ID}.sendbird.com/v3/users/{uid}/token
          appId = SENDBIRD_APP_ID;
          // const sbRes = await fetch(
          //   `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/users/${uid}/token`,
          //   { method: "POST", headers: { "Api-Token": SENDBIRD_API_TOKEN, "Content-Type": "application/json" } }
          // );
          // const sbData = await sbRes.json();
          // token = sbData.token;
          token = `sendbird-token-placeholder-${Date.now()}`;
          break;

        case "cometchat":
          // Create CometChat auth token
          // POST https://{appId}.api-{region}.cometchat.io/v3/users/{uid}/auth_tokens
          appId = COMETCHAT_APP_ID;
          // const ccRes = await fetch(
          //   `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3/users/${uid}/auth_tokens`,
          //   { method: "POST", headers: { apiKey: COMETCHAT_API_KEY, "Content-Type": "application/json" } }
          // );
          // const ccData = await ccRes.json();
          // token = ccData.data.authToken;
          token = `cometchat-token-placeholder-${Date.now()}`;
          break;

        default:
          return new Response(
            JSON.stringify({ error: `Unknown provider: ${provider}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
      }

      return new Response(
        JSON.stringify({ token, appId, uid, channelName }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- POST /chat-proxy/message ----
    if (path === "message" && req.method === "POST") {
      const { channelName, targetUserId, provider, message } = await req.json();

      // Validate content based on message type:
      //   - "text": content required, max 2000 chars
      //   - "voice": content can be empty (audio binary handled separately)
      //   - "image": content can be a URL or base64, allow up to 10MB base64
      const msgType = message?.type || "text";
      if (msgType === "text" && (!message?.content || message.content.length > 2000)) {
        return new Response(
          JSON.stringify({ error: "Invalid text message content (empty or > 2000 chars)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (msgType === "image" && message?.content && message.content.length > 10_000_000) {
        return new Response(
          JSON.stringify({ error: "Image content too large (> 10MB)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // voice messages: no content validation needed (duration is the key field)

      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: "targetUserId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Route to the configured IM provider's send message API
      // switch (provider) {
      //   case "sendbird":
      //     // POST https://api-{APP_ID}.sendbird.com/v3/group_channels/{channel_url}/messages
      //     // Body: { message_type: "MESG", user_id: message.senderId, message: message.content }
      //     // Or for 1-to-1: create/get channel between senderId and targetUserId first
      //     await fetch(
      //       `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/group_channels/${channelName}/messages`,
      //       {
      //         method: "POST",
      //         headers: { "Api-Token": SENDBIRD_API_TOKEN, "Content-Type": "application/json" },
      //         body: JSON.stringify({
      //           message_type: "MESG",
      //           user_id: message.senderId,
      //           message: message.content,
      //         }),
      //       }
      //     );
      //     break;
      //
      //   case "cometchat":
      //     // POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/messages
      //     // Body: { receiver: targetUserId, receiverType: "user", type: "text", data: { text: content } }
      //     await fetch(
      //       `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3/messages`,
      //       {
      //         method: "POST",
      //         headers: {
      //           apiKey: COMETCHAT_API_KEY,
      //           "Content-Type": "application/json",
      //           onBehalfOf: message.senderId,
      //         },
      //         body: JSON.stringify({
      //           receiver: targetUserId,
      //           receiverType: "user",
      //           type: message.type === "text" ? "text" : "file",
      //           data: { text: message.content },
      //         }),
      //       }
      //     );
      //     break;
      //
      //   case "aliyun-im":
      //     // Call Alibaba Cloud IM SendMessage API
      //     // Uses AKSK signature, sends from senderId to targetUserId
      //     break;
      // }

      // Optionally store in Supabase DB for history
      // await supabaseAdmin.from("chat_messages").insert({
      //   id: message.id,
      //   channel_name: channelName,
      //   sender_id: message.senderId,
      //   target_user_id: targetUserId,
      //   content: message.content,
      //   type: message.type,
      //   timestamp: Date.now(),
      // });

      return new Response(
        JSON.stringify({ success: true, serverTimestamp: Date.now() }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- GET /chat-proxy/history?channel=xxx ----
    if (path === "history" && req.method === "GET") {
      const channelName = url.searchParams.get("channel");
      // In production: fetch from IM provider or Supabase DB
      return new Response(
        JSON.stringify({ messages: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- GET /chat-proxy/poll?channel=xxx&since=timestamp&userId=xxx ----
    // Long-polling endpoint: returns new messages since the given timestamp
    // The Edge Function queries Supabase DB (populated by provider webhooks)
    if (path === "poll" && req.method === "GET") {
      const channelName = url.searchParams.get("channel");
      const since = parseInt(url.searchParams.get("since") || "0", 10);
      const userId = url.searchParams.get("userId") || "";

      // In production:
      // 1. Query Supabase table `chat_messages` WHERE channel = channelName
      //    AND timestamp > since AND sender_id != userId
      //    ORDER BY timestamp ASC LIMIT 50
      //
      // const { data } = await supabaseAdmin
      //   .from("chat_messages")
      //   .select("*")
      //   .eq("channel_name", channelName)
      //   .gt("timestamp", since)
      //   .neq("sender_id", userId)
      //   .order("timestamp", { ascending: true })
      //   .limit(50);

      return new Response(
        JSON.stringify({ messages: [], hasMore: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- POST /chat-proxy/webhook ----
    // Webhook receiver: IM providers push events here
    // This endpoint is called BY the IM provider, not by the frontend.
    //
    // Setup per provider:
    //   Sendbird:  Dashboard → Settings → Webhooks → URL = https://<supabase>.co/functions/v1/chat-proxy/webhook
    //   CometChat: Dashboard → Extensions → Webhooks → URL = same
    //   Aliyun IM: Console → 回调配置 → URL = same
    //
    // The webhook stores incoming messages into Supabase DB so /poll can serve them.
    if (path === "webhook" && req.method === "POST") {
      const body = await req.json();

      // Identify which provider sent this webhook (by header or body structure)
      // const providerSignature = req.headers.get("x-sendbird-signature")
      //   || req.headers.get("x-cometchat-signature")
      //   || body.aliyunSignature;
      //
      // switch (detected_provider) {
      //   case "sendbird":
      //     // Sendbird webhook payload: { category: "group_channel:message_send", ... }
      //     // Extract: channel_url, message.user_id, message.message, message.type
      //     // Verify signature: HMAC-SHA256(body, SENDBIRD_API_TOKEN)
      //     if (body.category === "group_channel:message_send") {
      //       await supabaseAdmin.from("chat_messages").insert({
      //         id: body.payload.message_id,
      //         channel_name: body.channel.channel_url,
      //         sender_id: body.sender.user_id,
      //         content: body.payload.message,
      //         type: body.payload.type === "MESG" ? "text" : body.payload.type === "FILE" ? "image" : "text",
      //         timestamp: body.payload.created_at,
      //       });
      //     }
      //     break;
      //
      //   case "cometchat":
      //     // CometChat webhook: { event: "message_sent", data: { ... } }
      //     if (body.event === "message_sent") {
      //       await supabaseAdmin.from("chat_messages").insert({
      //         id: body.data.id,
      //         channel_name: body.data.conversationId,
      //         sender_id: body.data.sender.uid,
      //         content: body.data.text || body.data.data,
      //         type: body.data.type === "text" ? "text" : "image",
      //         timestamp: body.data.sentAt * 1000,
      //       });
      //     }
      //     break;
      //
      //   case "aliyun-im":
      //     // Alibaba Cloud IM callback
      //     // Verify signature with AKSK
      //     // Extract message fields from body
      //     break;
      // }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- POST /chat-proxy/register ----
    // Register a user on the configured IM provider
    if (path === "register" && req.method === "POST") {
      const { userId, nickname, avatarUrl, provider } = await req.json();

      if (!userId) {
        return new Response(
          JSON.stringify({ error: "userId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // switch (provider) {
      //   case "sendbird":
      //     // POST https://api-{APP_ID}.sendbird.com/v3/users
      //     // Body: { user_id, nickname, profile_url }
      //     // Headers: { "Api-Token": SENDBIRD_API_TOKEN }
      //     const sbRes = await fetch(
      //       `https://api-${SENDBIRD_APP_ID}.sendbird.com/v3/users`,
      //       {
      //         method: "POST",
      //         headers: { "Api-Token": SENDBIRD_API_TOKEN, "Content-Type": "application/json" },
      //         body: JSON.stringify({ user_id: userId, nickname: nickname || userId, profile_url: avatarUrl || "" }),
      //       }
      //     );
      //     break;
      //
      //   case "cometchat":
      //     // POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users
      //     // Body: { uid, name, avatar }
      //     // Headers: { apiKey: COMETCHAT_API_KEY }
      //     const ccRes = await fetch(
      //       `https://${COMETCHAT_APP_ID}.api-${COMETCHAT_REGION}.cometchat.io/v3/users`,
      //       {
      //         method: "POST",
      //         headers: { apiKey: COMETCHAT_API_KEY, "Content-Type": "application/json" },
      //         body: JSON.stringify({ uid: userId, name: nickname || userId, avatar: avatarUrl || "" }),
      //       }
      //     );
      //     break;
      //
      //   case "aliyun-im":
      //     // Call Alibaba Cloud IM ImportSingleConversation / RegisterUser API
      //     // Uses AKSK signature (aliyun SDK)
      //     break;
      // }

      return new Response(
        JSON.stringify({ success: true, userId, provider }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- POST /chat-proxy/auth ----
    // Authenticate user via Supabase Auth, return server-assigned user ID.
    // This is the ONLY way a user gets a trusted ID for IM registration.
    //
    // Flow:
    //   1. Frontend sends { method: "phone"|"email", credential, code }
    //   2. Edge Function verifies via Supabase Auth (OTP / magic link / OAuth)
    //   3. Returns { userId: user.id } — a server-generated UUID
    //   4. Frontend stores this UUID and uses it for all IM operations
    //
    // Security: The userId is NEVER generated client-side in production.
    //   - Only the server can assign IDs after successful authentication
    //   - The IM provider trusts this ID because it came through a verified path
    //   - Client cannot forge or guess another user's UUID
    if (path === "auth" && req.method === "POST") {
      const { method, credential, code } = await req.json();

      if (!credential) {
        return new Response(
          JSON.stringify({ error: "credential is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ---- Supabase Auth integration ----
      // import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
      // const supabaseAdmin = createClient(
      //   Deno.env.get("SUPABASE_URL")!,
      //   Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      // );
      //
      // let userId: string;
      //
      // if (method === "phone") {
      //   // Verify phone OTP
      //   const { data, error } = await supabaseAdmin.auth.verifyOtp({
      //     phone: credential,
      //     token: code,
      //     type: "sms",
      //   });
      //   if (error || !data.user) {
      //     return new Response(
      //       JSON.stringify({ error: error?.message || "OTP verification failed" }),
      //       { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      //     );
      //   }
      //   userId = data.user.id; // Server-assigned UUID
      //
      // } else if (method === "email") {
      //   // Verify email OTP or magic link
      //   const { data, error } = await supabaseAdmin.auth.verifyOtp({
      //     email: credential,
      //     token: code,
      //     type: "email",
      //   });
      //   if (error || !data.user) {
      //     return new Response(
      //       JSON.stringify({ error: error?.message || "Email verification failed" }),
      //       { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      //     );
      //   }
      //   userId = data.user.id;
      //
      // } else {
      //   // Social login (wechat, google, etc.) — handled via Supabase OAuth flow
      //   // The OAuth redirect will have already created the user in Supabase Auth
      //   // Frontend should pass the access_token from OAuth callback
      //   const { data, error } = await supabaseAdmin.auth.getUser(code); // code = access_token
      //   if (error || !data.user) {
      //     return new Response(
      //       JSON.stringify({ error: "OAuth token invalid" }),
      //       { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      //     );
      //   }
      //   userId = data.user.id;
      // }
      //
      // return new Response(
      //   JSON.stringify({ userId, method }),
      //   { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      // );

      // Placeholder response (uncomment above for production)
      return new Response(
        JSON.stringify({ error: "Auth endpoint not configured — using local fallback" }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- POST /chat-proxy/send-code ----
    // Send OTP verification code via SMS or email using Supabase Auth.
    //
    // Request: { method: "phone"|"email", credential: "+1234567890" | "user@email.com" }
    // Response: { success: true } or { success: false, error: "..." }
    //
    // Supabase Auth automatically handles:
    //   - Phone: sends SMS via configured provider (Twilio, MessageBird, Vonage)
    //   - Email: sends magic link or OTP via configured email provider
    //
    // Setup required in Supabase Dashboard:
    //   1. Authentication → Providers → Enable Phone / Email
    //   2. Authentication → SMS Provider → Configure Twilio/MessageBird
    //   3. Authentication → Email Templates → Customize OTP template
    if (path === "send-code" && req.method === "POST") {
      const { method, credential } = await req.json();

      if (!credential) {
        return new Response(
          JSON.stringify({ success: false, error: "credential is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ---- Supabase Auth OTP ----
      // import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
      // const supabaseAdmin = createClient(
      //   Deno.env.get("SUPABASE_URL")!,
      //   Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      // );
      //
      // if (method === "phone") {
      //   const { error } = await supabaseAdmin.auth.signInWithOtp({ phone: credential });
      //   if (error) {
      //     return new Response(
      //       JSON.stringify({ success: false, error: error.message }),
      //       { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      //     );
      //   }
      // } else {
      //   const { error } = await supabaseAdmin.auth.signInWithOtp({ email: credential });
      //   if (error) {
      //     return new Response(
      //       JSON.stringify({ success: false, error: error.message }),
      //       { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      //     );
      //   }
      // }
      //
      // return new Response(
      //   JSON.stringify({ success: true }),
      //   { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      // );

      // Placeholder (uncomment above for production)
      return new Response(
        JSON.stringify({ success: false, error: "send-code endpoint not configured" }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- POST /chat-proxy/oauth-exchange ----
    // Exchange OAuth authorization code for user identity.
    //
    // Request: { provider: "google"|"facebook"|..., code: "auth_code", redirectUri: "..." }
    // Response: { userId: "uuid-..." } or { error: "..." }
    //
    // Flow:
    //   1. Frontend redirects user to provider's authorize URL
    //   2. Provider redirects back with ?code=xxx
    //   3. Frontend POSTs the code here
    //   4. Edge Function exchanges code for access token with provider
    //   5. Gets user profile, creates/finds Supabase Auth user
    //   6. Returns server-assigned userId
    //
    // Provider OAuth endpoints:
    //   Google:   POST https://oauth2.googleapis.com/token
    //   Facebook: GET  https://graph.facebook.com/v19.0/oauth/access_token
    //   Apple:    POST https://appleid.apple.com/auth/token
    //   WeChat:   GET  https://api.weixin.qq.com/sns/oauth2/access_token
    //   Alipay:   POST https://openapi.alipay.com/gateway.do (method=alipay.system.oauth.token)
    //   Twitter:  POST https://api.twitter.com/2/oauth2/token
    //   LINE:     POST https://api.line.me/oauth2/v2.1/token
    if (path === "oauth-exchange" && req.method === "POST") {
      const { provider, code, redirectUri } = await req.json();

      if (!provider || !code) {
        return new Response(
          JSON.stringify({ error: "provider and code are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ---- Token exchange implementation ----
      // const OAUTH_SECRETS: Record<string, { clientId: string; clientSecret: string }> = {
      //   google: {
      //     clientId: Deno.env.get("GOOGLE_CLIENT_ID")!,
      //     clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      //   },
      //   facebook: {
      //     clientId: Deno.env.get("FACEBOOK_APP_ID")!,
      //     clientSecret: Deno.env.get("FACEBOOK_APP_SECRET")!,
      //   },
      //   // ... add other providers
      // };
      //
      // const secrets = OAUTH_SECRETS[provider];
      // if (!secrets) {
      //   return new Response(
      //     JSON.stringify({ error: `Provider ${provider} not configured` }),
      //     { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      //   );
      // }
      //
      // // Example: Google token exchange
      // if (provider === "google") {
      //   const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      //     method: "POST",
      //     headers: { "Content-Type": "application/x-www-form-urlencoded" },
      //     body: new URLSearchParams({
      //       code,
      //       client_id: secrets.clientId,
      //       client_secret: secrets.clientSecret,
      //       redirect_uri: redirectUri,
      //       grant_type: "authorization_code",
      //     }),
      //   });
      //   const tokenData = await tokenRes.json();
      //   if (tokenData.error) {
      //     return new Response(
      //       JSON.stringify({ error: tokenData.error_description || tokenData.error }),
      //       { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      //     );
      //   }
      //
      //   // Get user info
      //   const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      //     headers: { Authorization: `Bearer ${tokenData.access_token}` },
      //   });
      //   const userInfo = await userRes.json();
      //
      //   // Create or find Supabase Auth user
      //   // Option A: Use Supabase Admin to create user with provider info
      //   const { data, error } = await supabaseAdmin.auth.admin.createUser({
      //     email: userInfo.email,
      //     email_confirm: true,
      //     user_metadata: {
      //       full_name: userInfo.name,
      //       avatar_url: userInfo.picture,
      //       provider: "google",
      //       provider_id: userInfo.id,
      //     },
      //   });
      //   // If user already exists, find them
      //   if (error?.message?.includes("already")) {
      //     const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
      //     const user = existing.users.find(u => u.email === userInfo.email);
      //     if (user) return respond({ userId: user.id });
      //   }
      //   if (data?.user) {
      //     return respond({ userId: data.user.id });
      //   }
      // }

      // Placeholder (uncomment above for production)
      return new Response(
        JSON.stringify({ error: "oauth-exchange endpoint not configured" }),
        { status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
*/

// ============================================================================
// API Contract (for frontend ChatProxyService to consume)
// ============================================================================

/** POST /functions/v1/chat-proxy/token */
export interface TokenRequest {
  channelName: string;
  uid: string | number;
  provider?: string;  // 'aliyun-im' | 'sendbird' | 'cometchat'
}

export interface TokenResponse {
  token: string;
  appId: string;
  uid: string | number;
  channelName: string;
}

/** POST /functions/v1/chat-proxy/message */
export interface SendMessageRequest {
  channelName: string;
  targetUserId: string;     // IM user ID of the recipient (merchant's imUserId)
  provider: string;         // 'aliyun-im' | 'sendbird' | 'cometchat'
  message: {
    id: string;
    senderId: string;
    content: string;
    type: "text" | "image" | "voice";
    timestamp: number;
    duration?: number;
  };
}

export interface SendMessageResponse {
  success: boolean;
  serverTimestamp: number;
}

/** GET /functions/v1/chat-proxy/history?channel=xxx */
export interface HistoryResponse {
  messages: ChatMessageDTO[];
}

export interface ChatMessageDTO {
  id: string;
  channelName: string;
  senderId: string;
  content: string;
  type: "text" | "image" | "voice";
  timestamp: number;
  duration?: number;
  status: "sent";
  read: boolean;
}

/** POST /functions/v1/chat-proxy/register */
export interface RegisterUserRequest {
  userId: string;
  nickname: string;
  avatarUrl: string;
  provider: string; // 'aliyun-im' | 'sendbird' | 'cometchat'
}

export interface RegisterUserResponse {
  success: boolean;
  userId: string;
  provider: string;
}

/** GET /functions/v1/chat-proxy/poll?channel=xxx&since=timestamp&userId=xxx */
export interface PollResponse {
  messages: ChatMessageDTO[];
  hasMore: boolean;
}

/** POST /functions/v1/chat-proxy/webhook (called by IM provider, not frontend) */
// No frontend interface needed — this is server-to-server

/** POST /functions/v1/chat-proxy/auth */
export interface AuthRequest {
  method: "phone" | "email" | string;  // "phone", "email", or social provider name
  credential: string;                   // phone number, email, or OAuth platform name
  code: string;                         // OTP code or OAuth access_token
}

export interface AuthResponse {
  userId: string;   // Server-assigned UUID from Supabase Auth
  method: string;   // Echo of the method used
}