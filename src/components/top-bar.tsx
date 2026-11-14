import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/language-switch";
import { Link } from "@/i18n/navigation";

/** SH-1. View switch, search and the GitHub link arrive with their features. */
export async function TopBar() {
  const t = await getTranslations("shell");

  return (
    <header className="border-b border-hairline bg-surface">
      <nav aria-label={t("primaryNav")} className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="rounded-md text-base font-semibold tracking-tight">
          Synchronic
        </Link>
        <LanguageSwitch legend={t("language")} />
      </nav>
    </header>
  );
}
