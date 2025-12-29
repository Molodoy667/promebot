import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Service Account credentials
const SERVICE_ACCOUNT = {
  project_id: "gen-lang-client-0925380293",
  private_key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDIJdS+5oE3Rh1b
uj0qIXHfEwS42fT532T6Oe7PKKZ82qGzWv6XZ17Mc+bXsEO2Knu8E8K2bcOMYbhl
O/3rno0LSdYxqel3++EOi70tLoVucQzGyhTS9k5p3WCQ6VJ2snhxWM1VfJ3YZRou
iQP9IkIrCeSVxz7PIB2RdLqSIHwEiB7EXI6MhkRvI6PqIxa66r/O9irhiaqTH3gv
DT3KxFuLlQBdpKe4lgkedEoHoGZYd5oARoeWBGffXGCETthmnqEbRB6PQW/5oR75
hk8vMjQK+eJ4ZDH/gwPlbIMCWcDJz7pcFYmh9+qPWhaVmxWubaYK722Rt3lklOwM
is+4haGNAgMBAAECggEAE3W6LaVzwtAKYrTE5afCzpGmz+JBM1pJExs24OVu6ozH
VAzw2/+s8+wA8c+thbSzuyGguOQLM0b9Crq+gX408HgJX2LJ1GSlCSkFB7OSPZ64
Q0u6ophYH2rqzKwi3G+Vzk94B2vKXRPXa9bekGoYTN71Xqq0rKbOuSnEShjmdfop
1jm/n6QUKzhxAodbB7in16IslimWQxs9BdwXY3SfExkS8FRDM/Xj5EuSBsKp8D9F
7b1upQE9Jc/e9LVZ4ZUaYdJlvwXR85yxMamkK3PQYRlJUukpebhAuNU8tBcVpej8
UhBxK5PhFPKrQQTwukMOCwWx7WnGSvrnG7MFb5vA8QKBgQD9pDJr8mZp4oFDnc36
k5dmespDNwMu/hH8iIVorHiGg+fGwlfbYnLqLZd3WcwtwQUYTpYu4vPXkKg1swls
XrxruARdibouJhMF3D1WLHSLXJYX6IjOR7JvrBE0p065L6wORbhxFB7S/9gOiG5j
F1zzR87l4bmXCk+to0ceYX9tPwKBgQDKAkpcuIJfUXiViEKRBZcu5D278PyVGy3w
mSXA41Fa6CxCY5Fv7FnEDkr41SxrQb5uh5w+PwqxIQXvLGCjMd4xQKqjjk3Y1Gm/
L9AM5NnJ6PrBO7Wb2Svrw3uLsN32hxIQ4uh0y/95PBzw7DkAZwYUYuBfEL84x9Jq
+2suGb+iMwKBgFTil9FSnX3ARTyI2n+K13d/jqNyDMm0U/atBeDjH679BBubvOV6
DDVdLrzNu6xwVbEt08s7Pxocmn7mPTgceHigbC2Vw05ghatHauulExf003KK6wYG
Lqx67IMvnwQQ9UcNhE2ryykYYIl0lWTqU7xDgvWiVoc69zGIXGvJe2jnAoGBAJhw
OAtWFNO3GCbHB2yGanqxM8DSbthaBUXNW8b+AxN1poiGuGZcVbT0EDFMNFPP7dNc
tFPooLnfsKm2tEoSRJioMtxvc2FPkWj7vKUuQQbzr94Hn9k2fcVQ47cbRbRWYxSp
Fj+k/WlQKorHx4/9LoJNxwEWEybW63tdtJi6R3kvAoGBAOWP4QmjtIIHsZ5hSLB7
P1onXAS0xCIkr3Q5he2bLgAGizYgCqMmlx+OZCo68PBamVYBtsQGYeJX1TT+5D/r
t1oagwEePS35wBOgAlJ40QMwW+d14wrdqPis98HALgEsPP3SOPbdwU0AxIkFj2Bj
SUwWKUioDMAlK/py/IAlhz5f
-----END PRIVATE KEY-----`,
  client_email: "promobot@gen-lang-client-0925380293.iam.gserviceaccount.com",
};

async function getAccessToken(): Promise<string> {
  // Create JWT
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" } as const;
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  } as const;

  // Import private key
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(SERVICE_ACCOUNT.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const jwt = await create(header as any, payload as any, privateKey as any);

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Failed to get access token: ${await tokenResponse.text()}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { service, requestBody } = await req.json();

    if (!service || !requestBody) {
      return new Response(
        JSON.stringify({ error: "service and requestBody are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Getting access token...');
    const accessToken = await getAccessToken();
    console.log('Access token obtained');

    // Build Vertex AI endpoint
    let endpoint = '';
    if (service === 'imagen') {
      endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/locations/us-central1/publishers/google/models/imagen-3.0-generate-001:predict`;
    } else if (service === 'gemini') {
      endpoint = `https://us-central1-aiplatform.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/locations/us-central1/publishers/google/models/gemini-1.5-flash:generateContent`;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid service. Use 'imagen' or 'gemini'" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling Vertex AI:', endpoint);

    // Call Vertex AI
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vertex AI error:', errorText);
      return new Response(
        JSON.stringify({ error: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Vertex AI response received');

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
