import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendCodeRequest {
  userId: string;
  email: string;
}

interface VerifyCodeRequest {
  userId: string;
  code: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { action, ...data } = await req.json();

    if (action === "send") {
      const { userId, email }: SendCodeRequest = data;

      // Перевірка чи користувач вже підтверджений
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("email_verified")
        .eq("id", userId)
        .single();

      if (profile?.email_verified) {
        return new Response(
          JSON.stringify({ success: false, error: "Email вже підтверджено" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Генерація 6-значного коду
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 хвилин

      // Видалити старі коди для цього email
      await supabaseClient
        .from("password_reset_codes")
        .delete()
        .eq("email", `verify_${userId}`);

      // Зберегти новий код (використовуємо prefix verify_ для розрізнення)
      const { error: insertError } = await supabaseClient
        .from("password_reset_codes")
        .insert({
          email: `verify_${userId}`,
          code,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Error inserting verification code:", insertError);
        throw new Error("Помилка збереження коду");
      }

      // Відправити email з кодом
      const emailResponse = await resend.emails.send({
        from: "PromoBot <onboarding@resend.dev>",
        to: [email],
        subject: "Підтвердження email",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Підтвердження email адреси</h2>
            <p>Вітаємо! Для підтвердження вашої email адреси введіть наступний код:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #6366f1; margin: 0; font-size: 32px; letter-spacing: 8px;">${code}</h1>
            </div>
            <p>Цей код діє протягом <strong>10 хвилин</strong>.</p>
            <p>Якщо ви не запитували підтвердження email, проігноруйте цей лист.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #888; font-size: 12px;">PromoBot - Автоматизація Telegram каналів</p>
          </div>
        `,
      });

      console.log("Email verification code sent:", emailResponse);

      return new Response(
        JSON.stringify({ success: true, message: "Код відправлено на ваш email" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (action === "verify") {
      const { userId, code }: VerifyCodeRequest = data;

      // Перевірка коду
      const { data: verificationCode, error: codeError } = await supabaseClient
        .from("password_reset_codes")
        .select("*")
        .eq("email", `verify_${userId}`)
        .eq("code", code)
        .eq("used", false)
        .maybeSingle();

      if (codeError || !verificationCode) {
        return new Response(
          JSON.stringify({ success: false, error: "Невірний код" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Перевірка чи не минув час дії
      if (new Date(verificationCode.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Код прострочений" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Оновити профіль - встановити email_verified = true
      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update({ email_verified: true })
        .eq("id", userId);

      if (updateError) {
        console.error("Error updating profile:", updateError);
        throw new Error("Помилка підтвердження email");
      }

      // Позначити код як використаний
      await supabaseClient
        .from("password_reset_codes")
        .update({ used: true })
        .eq("id", verificationCode.id);

      return new Response(
        JSON.stringify({ success: true, message: "Email успішно підтверджено" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Невідома дія" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in verify-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
