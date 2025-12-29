import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";

interface FAQ {
  id: string;
  question: string;
  question_en: string | null;
  answer: string;
  answer_en: string | null;
  display_order: number;
}

export const FAQSection = () => {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    try {
      const { data, error } = await supabase
        .from("faq")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error("Error loading FAQs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (faqs.length === 0) {
    return null;
  }

  return (
    <section className="relative z-10 py-12 sm:py-16 md:py-20 px-4 pb-16 sm:pb-20 md:pb-24">
      <div className="container mx-auto">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow animate-float">
              <HelpCircle className="w-8 h-8 text-primary-foreground" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
              <span className="animate-gradient-text">Часті запитання</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Відповіді на найпопулярніші питання про наш сервіс
            </p>
          </div>

          <div className="glass-effect rounded-3xl border border-primary/20 p-4 sm:p-6 md:p-8">
            <Accordion type="single" collapsible className="w-full space-y-2">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={faq.id}
                  value={faq.id}
                  className="border border-border/50 rounded-xl px-4 data-[state=open]:bg-primary/5 transition-all duration-300"
                >
                  <AccordionTrigger className="text-left text-sm sm:text-base font-medium hover:text-primary transition-colors py-4">
                    <span className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      <span>{faq.question}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm sm:text-base text-muted-foreground pb-4 pl-9">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
};
