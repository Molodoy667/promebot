import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, apiId, apiHash, phoneNumber, phoneCode, phoneCodeHash, sessionString } = req.body;

    if (!apiId || !apiHash) {
      return res.status(400).json({ error: 'apiId and apiHash are required' });
    }

    const client = new TelegramClient(
      new StringSession(sessionString || ''),
      parseInt(apiId),
      apiHash,
      { connectionRetries: 5 }
    );

    await client.connect();

    // Action 1: Send code
    if (action === 'send_code') {
      if (!phoneNumber) {
        return res.status(400).json({ error: 'phoneNumber is required' });
      }

      console.log(`[Vercel MTProto] Sending code to ${phoneNumber}`);
      
      const result = await client.sendCode(
        { apiId: parseInt(apiId), apiHash },
        phoneNumber
      );

      // Save session to pass to sign_in
      const tempSession = client.session.save() as unknown as string;
      await client.disconnect();

      return res.status(200).json({
        success: true,
        phoneCodeHash: result.phoneCodeHash,
        sessionString: tempSession, // Return session to frontend
      });
    }

    // Action 2: Sign in
    if (action === 'sign_in') {
      if (!phoneNumber || !phoneCode || !phoneCodeHash) {
        return res.status(400).json({ 
          error: 'phoneNumber, phoneCode, and phoneCodeHash are required' 
        });
      }

      console.log(`[Vercel MTProto] Signing in with code`);
      console.log(`[Vercel MTProto] Session string length:`, sessionString?.length || 0);
      console.log(`[Vercel MTProto] phoneCodeHash:`, phoneCodeHash);

      try {
        // Use invoke directly with auth.signIn
        const result = await client.invoke(
          new Api.auth.SignIn({
            phoneNumber: phoneNumber,
            phoneCodeHash: phoneCodeHash,
            phoneCode: phoneCode,
          })
        );

        const session = client.session.save() as unknown as string;
        await client.disconnect();

        console.log(`[Vercel MTProto] Successfully authorized!`, result);

        return res.status(200).json({
          success: true,
          sessionString: session,
          isAuthorized: true,
        });
      } catch (signInError: any) {
        await client.disconnect();
        console.error('[Vercel MTProto] Sign in error:', signInError);
        return res.status(400).json({
          error: signInError.message || 'Failed to sign in'
        });
      }
    }

    // Action 3: Check auth
    if (action === 'check_auth') {
      const isAuthorized = await client.isUserAuthorized();
      await client.disconnect();

      return res.status(200).json({
        success: true,
        isAuthorized,
        hasSession: !!sessionString,
      });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (error: any) {
    console.error('[Vercel MTProto] Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
