// Language + RTL provider for LEXICON.
// Toggle persists in localStorage. Arabic flips <html dir="rtl"> and swaps
// brand wordmark + chrome strings. AI calls receive `language` so dossiers,
// Oracle answers, and AI covers come back in Arabic too.
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Lang = "en" | "ar";

const KEY = "lexicon-lang";

interface Ctx {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
}

const LangCtx = createContext<Ctx | null>(null);

// Pragmatic dictionary — keys mirror the English string so unknown keys
// gracefully fall back to English. Add freely as more pages get translated.
const AR: Record<string, string> = {
  // Brand
  "LEXICON": "ليكسيكون",
  "EST.": "تأسس",

  // Nav
  "Shelf": "الرف",
  "Recommendations": "التوصيات",
  "Concierge": "العرّاف",
  "Oracle": "العرّاف",
  "Reading Ritual": "طقس القراءة",
  "Quotes Vault": "خزانة الاقتباسات",
  "Book History": "سجل الكتب",
  "Archive": "الأرشيف",
  "Review Desk": "طاولة المراجعة",
  "Settings": "الإعدادات",
  "Admin Panel": "لوحة الإدارة",

  // Common buttons / chrome
  "Generate": "أنشِئ",
  "Generate dossier": "أنشئ الملف",
  "Open dossier": "افتح الملف",
  "Regenerate": "أعد الإنشاء",
  "Extend": "وسّع",
  "Improve details": "حسّن التفاصيل",
  "Delete": "احذف",
  "Save": "احفظ",
  "Cancel": "ألغِ",
  "Search": "ابحث",
  "Loading…": "جارٍ التحميل…",
  "LOADING…": "جارٍ التحميل…",
  "Sign in": "سجّل الدخول",
  "Sign out": "سجّل الخروج",
  "Sign in to sync": "سجّل الدخول للمزامنة",
  "Guest shelf": "رف الضيف",
  "Toggle sidebar": "بدّل الشريط الجانبي",

  // Sidebar/footer copy
  "Edit": "حرّر",

  // Settings page
  "Language": "اللغة",
  "Choose your preferred language. The interface, brand, and AI responses will all switch.": "اختر لغتك المفضلة. ستتغير الواجهة والاسم وردود الذكاء الاصطناعي معًا.",
  "English": "الإنجليزية",
  "Arabic": "العربية",
  "House": "تدبير",
  "keeping": "المنزل",
  "The Workshop": "الورشة",
  "Backup, import, choose a binding for your library.": "نسخ احتياطي، استيراد، واختيار تجليد لمكتبتك.",

  // Page headers
  "The Shelf": "الرف",
  "The library,": "المكتبة،",
  "in spines": "بالأسلاك",
  "The Oracle": "العرّاف",
  "Ask,": "اسأل،",
  "earnestly": "بصدق",
  "An AI fluent in your library. The more you read, the sharper it gets.": "ذكاء اصطناعي يجيد مكتبتك. كلما قرأتَ أكثر، صار أحدّ.",

  // PDF / dossier UI bits
  "Export PDF": "تصدير PDF",
  "Summary": "ملخّص",
  "Themes": "موضوعات",
  "Main Ideas": "أفكار رئيسية",
  "Characters": "شخصيات",
  "Timeline": "خط زمني",
  "Key Quotes": "اقتباسات مفتاحية",
  "Symbols": "رموز",
  "Lessons": "دروس",
  "Discussion": "نقاش",
  "Criticisms": "انتقادات",
  "If You Liked": "إن أعجبك",
  "Ending": "النهاية",
  "Twists": "منعطفات",
  "Spoilers ahead": "تحذير: حرق أحداث",
  "Reveal": "اكشف",
  "Hide": "أخفِ",
};

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) as Lang | null;
    return stored === "ar" || stored === "en" ? stored : "en";
  });

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === "ar" ? "rtl" : "ltr";
    html.dataset.lang = lang;
  }, [lang]);

  const value = useMemo<Ctx>(() => ({
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    setLang: (l) => {
      localStorage.setItem(KEY, l);
      setLangState(l);
    },
    t: (key, fallback) => {
      if (lang === "ar") return AR[key] ?? fallback ?? key;
      return fallback ?? key;
    },
  }), [lang]);

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}

// For non-component code (edge function payloads, lib utils).
export function getCurrentLang(): Lang {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem(KEY);
  return stored === "ar" ? "ar" : "en";
}
