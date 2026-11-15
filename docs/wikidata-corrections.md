# Wikidata corrections (drafts)

Errors found while auditing the data. Each is ready to post on the item's talk page or to make as an edit. Nothing has been sent; a maintainer should make the change from their own Wikidata account.

## Q3893833 — Ata'ollah Mohajerani: not Prime Minister of Iran

**Statement:** `Q3893833$77EE8B81-B046-4651-8751-C5634B6C27DA`
P39 (position held) = Q13561063 (Prime Minister of Iran), P580 start 1985, P582 end 1989. Its only reference is P143 "imported from Wikimedia project".

**Problem.** Mohajerani was never Prime Minister of Iran. From 1985 to 1989 he was *Deputy* Prime Minister for Legal and Parliamentary Affairs under Prime Minister Mir-Hossein Mousavi, who held the office from 1981 until it was abolished in 1989. The statement makes Iran appear to have two prime ministers at once from 1985 to 1989.

**Sources.**
- English Wikipedia, "Ata'ollah Mohajerani", infobox: "Deputy Prime Minister of Iran for Legal and Parliamentary Affairs, In office 1985–1989, Prime Minister Mir-Hossein Mousavi".
- English Wikipedia, "Mir-Hossein Mousavi", infobox: Prime Minister of Iran, 31 October 1981 – 3 August 1989.

**Proposed edit.** Change the value of this P39 statement from Q13561063 (Prime Minister of Iran) to the deputy prime minister position. If no item exists for that position, set the statement's rank to *deprecated* with P2241 (reason for deprecated rank) = Q41755623 (incorrect value), and add a reference to the English Wikipedia article.

**Suggested talk-page note.**

> The P39 statement "Prime Minister of Iran, 1985–1989" on this item looks wrong: from 1985 to 1989 Mohajerani was Deputy Prime Minister for Legal and Parliamentary Affairs under Mir-Hossein Mousavi, who was Prime Minister throughout 1981–1989 (see the infoboxes of both English Wikipedia articles). The statement is only referenced as "imported from Wikimedia project". Could it be changed to the deputy position, or deprecated as an incorrect value?

## Smaller differences noted, not errors

- **Q2027257 Ivan Shcheglovitov** has P6 (head of government) on the Russian Empire for 1917. He chaired the State Council, not the Council of Ministers, so P6 looks wrong there; worth checking before proposing an edit.
- **Q968038 Dong Biwu / Q17132 Soong Ching-ling**: both carry P35 on China for 1968–1975. Their English Wikipedia infoboxes split the acting chairmanship into Soong (with Dong), 31 October 1968 – 24 February 1972, and Dong alone, 24 February 1972 – 17 January 1975.
