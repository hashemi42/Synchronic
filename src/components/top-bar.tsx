import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/language-switch";
import { GithubLink, SearchTrigger, ViewSwitch } from "@/components/top-bar-actions";
import { Link } from "@/i18n/navigation";

/** SH-1: logo, view switch, search, language switch and the GitHub link. */
export async function TopBar() {
  const t = await getTranslations("shell");

  return (
    <header className="border-b border-hairline bg-surface">
      <nav
        aria-label={t("primaryNav")}
        className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2"
      >
        <div className="flex items-center gap-4">
          <Link href="/" className="rounded-md text-base font-semibold tracking-tight">
            Synchronic
          </Link>
          <ViewSwitch />
        </div>
        <div className="flex items-center gap-2">
          <SearchTrigger />
          <LanguageSwitch legend={t("language")} />
          <GithubLink />
        </div>
      </nav>
    </header>
  );
}
