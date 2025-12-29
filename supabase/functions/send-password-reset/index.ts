import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
}

interface VerifyCodeRequest {
  email: string;
  code: string;
}

interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { action, ...data } = await req.json();

    if (action === "request") {
      const { email }: PasswordResetRequest = data;

      // Перевірка чи існує користувач
      const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("email")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (profileError || !profile) {
        // Не повертаємо 404, щоб на фронті не було помилки edge function
        return new Response(
          JSON.stringify({
            success: false,
            error: "Користувача з таким email не знайдено",
          }),
          {
            status: 200,
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
        .eq("email", email.toLowerCase());

      // Зберегти новий код
      const { error: insertError } = await supabaseClient
        .from("password_reset_codes")
        .insert({
          email: email.toLowerCase(),
          code,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error("Error inserting reset code:", insertError);
        throw new Error("Помилка збереження коду");
      }

      // Відправити email з кодом
      const emailResponse = await resend.emails.send({
        from: "PromoBot <onboarding@resend.dev>",
        to: [email],
        subject: "Код відновлення паролю",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Відновлення паролю</h2>
            <p>Ви запросили відновлення паролю для вашого акаунту.</p>
            <p>Ваш код відновлення:</p>
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
              <h1 style="color: #6366f1; margin: 0; font-size: 32px; letter-spacing: 8px;">${code}</h1>
            </div>
            <p>Цей код діє протягом <strong>10 хвилин</strong>.</p>
            <p>Якщо ви не запитували відновлення паролю, проігноруйте цей лист.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="color: #888; font-size: 12px;">PromoBot - Автоматизація Telegram каналів</p>
          </div>
        `,
      });

      console.log("Password reset email sent:", emailResponse);

      return new Response(
        JSON.stringify({ success: true, message: "Код відправлено на ваш email" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (action === "verify") {
      const { email, code }: VerifyCodeRequest = data;

      // Перевірка коду
      const { data: resetCode, error: codeError } = await supabaseClient
        .from("password_reset_codes")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("code", code)
        .eq("used", false)
        .maybeSingle();

      if (codeError || !resetCode) {
        return new Response(
          JSON.stringify({ success: false, error: "Невірний код" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Перевірка чи не минув час дії
      if (new Date(resetCode.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Код прострочений" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Код підтверджено" }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    if (action === "reset") {
      const { email, code, newPassword }: ResetPasswordRequest = data;

      // Перевірка коду
      const { data: resetCode, error: codeError } = await supabaseClient
        .from("password_reset_codes")
        .select("*")
        .eq("email", email.toLowerCase())
        .eq("code", code)
        .eq("used", false)
        .maybeSingle();

      if (codeError || !resetCode) {
        return new Response(
          JSON.stringify({ success: false, error: "Невірний код" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Перевірка чи не минув час дії
      if (new Date(resetCode.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ success: false, error: "Код прострочений" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Знайти користувача
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("id")
        .eq("email", email.toLowerCase())
        .single();

      if (!profile) {
        return new Response(
          JSON.stringify({ success: false, error: "Користувача не знайдено" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      // Оновити пароль користувача через Admin API
      const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
        profile.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error("Error updating password:", updateError);
        throw new Error("Помилка зміни паролю");
      }

      // Позначити код як використаний
      await supabaseClient
        .from("password_reset_codes")
        .update({ used: true })
        .eq("id", resetCode.id);

      return new Response(
        JSON.stringify({ success: true, message: "Пароль успішно змінено" }),
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
    console.error("Error in password reset function:", error);
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
