import { Card } from "@/components/ui/card";
import { FileText, Shield, Info } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen">
      <div className="pt-8 pb-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary mb-4">
              <FileText className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-bold mb-2">Угода користувача</h1>
            <p className="text-muted-foreground">
              Останнє оновлення: {new Date().toLocaleDateString('uk-UA')}
            </p>
          </div>

          <Card className="p-8 glass-card space-y-6">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">1. Загальні положення</h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Ця угода визначає умови використання сервісу ПромоБот. Реєструючись 
                та використовуючи наш сервіс, ви автоматично погоджуєтесь з усіма 
                умовами цієї угоди.
              </p>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="text-2xl font-bold">2. Використання сервісу</h2>
              </div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>2.1. ПромоБот надає послуги автоматизації публікацій у Telegram-каналах.</p>
                <p>2.2. Користувач несе відповідальність за контент, який публікується через сервіс.</p>
                <p>2.3. Заборонено використовувати сервіс для розповсюдження незаконного контенту.</p>
                <p>2.4. Користувач зобов'язується не порушувати правила Telegram та чинне законодавство.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">3. Оплата та тарифи</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>3.1. Оплата здійснюється згідно з обраним тарифним планом.</p>
                <p>3.2. Всі ціни вказані в українських гривнях (₴).</p>
                <p>3.3. При зміні тарифного плану різниця коштів не повертається.</p>
                <p>3.4. Автоматичне продовження підписки не здійснюється.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">4. Повернення коштів</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>4.1. Повернення коштів можливе протягом 7 днів з моменту оплати.</p>
                <p>4.2. Повернення здійснюється лише за невикористані послуги.</p>
                <p>4.3. Для повернення коштів необхідно звернутися до служби підтримки.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">5. Конфіденційність</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>5.1. Ми зберігаємо та обробляємо ваші персональні дані згідно з політикою конфіденційності.</p>
                <p>5.2. Токени Telegram-ботів зберігаються в зашифрованому вигляді.</p>
                <p>5.3. Ми не передаємо ваші дані третім особам без вашої згоди.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">6. Відповідальність</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>6.1. Сервіс надається "як є" без будь-яких гарантій.</p>
                <p>6.2. Ми не несемо відповідальності за збої в роботі сторонніх сервісів (Telegram).</p>
                <p>6.3. Користувач самостійно несе відповідальність за контент, що публікується.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">7. Припинення використання</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>7.1. Ми залишаємо за собою право припинити надання послуг без попередження.</p>
                <p>7.2. Користувач може в будь-який момент видалити свій акаунт.</p>
                <p>7.3. При порушенні умов угоди акаунт може бути заблокований.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-3">8. Зміни в угоді</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>8.1. Ми залишаємо за собою право змінювати умови цієї угоди.</p>
                <p>8.2. Про зміни буде повідомлено через email або в особистому кабінеті.</p>
                <p>8.3. Продовження використання сервісу після змін означає згоду з новими умовами.</p>
              </div>
            </section>

          </Card>
        </div>
      </div>
    </div>
  );
};

export default Terms;