# Local signup email proposal

The signup screen places a linked Terms acceptance and Privacy Policy acknowledgement immediately before Create Account. It has one optional, initially unchecked marketing checkbox. There is no reminders checkbox. The existing required health-data and sharing acceptance gates remain intact, including Guardian approval where required.

This is a prototype in the email-consent-preview worktree. No live signup, provider configuration, database migration, or email sender has been changed. `/signup-preview` exists only on a development server and simulates submission without creating accounts or sending emails. The separate Email Communications document and all its links have been removed. The Terms briefly clarify existing support, security, identity and essential service email purposes.

The only optional signup wording is: "I agree to receive marketing emails from Lodario. I can unsubscribe at any time." Its wording identifier is `marketing-email-2026-10-07-v1.1`. There is no extra email disclaimer below the checkbox.

Normal signup passes the selected marketing choice as `marketing_signup_preference` in signup metadata with the exact text, version, and pending status. This metadata is user-editable and is not immutable consent evidence. No sender should use it as permission to email. Adopting marketing later requires trusted server records, age/Guardian eligibility checks, and a working withdrawal/unsubscribe process before enabling any campaigns.

Legal design rationale: electronic acceptance of Terms is generally possible when the terms are clearly provided before the affirmative action; this is not a guarantee about every jurisdiction or every clause. Privacy notices explain processing and are acknowledged, rather than treated as blanket GDPR consent. Clicking Create Account does not consent to health-data processing, coach sharing or marketing. Those purposes remain separate.

Sources checked on 7 October 2026:

- Portuguese electronic-contract rules, Articles 25–28: https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/2004-73199154-73219186
- EDPB consent guidance, including paragraph 81 on separating consent from contract acceptance: https://www.edpb.europa.eu/sites/default/files/files/file1/edpb_guidelines_202005_consent_en.pdf
- Mailjet form guidance: https://documentation.mailjet.com/hc/en-us/articles/14434182223003-Subscription-Form-Builder
