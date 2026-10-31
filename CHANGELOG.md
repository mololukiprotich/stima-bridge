# Changelog

All entries are sprint work, Sat 31 Oct 2026.

## Built

- Project scaffold and tests
- Synthetic prepaid household generator, with separate training and test settings
- Dark Days detector, tuned on training data only
- HEVS rule-based need score
- Dashboard with CSV upload, settings, meter search and timelines
- USSD prototype in English and Kiswahili
- Phone simulation modelled on a 4-inch Android Go handset: dialer, USSD dialogs, numeric keyboard, SMS alerts and Messages app
- First-use setup: ID number, phone, meter, then terms and privacy policy

## Detector notes

- First version let estimated dark time feed back into the burn rate. That ran away, with about 30% day-level precision on training data.
- Second version estimates burn from token-to-token rates only.
- Held-out test, run once: 73% day-level precision and 75% recall, missing the 80% gate. Average estimated dark days were 3.7 a month against 3.6 actual.
- Any further detector change needs a new test set, because this one has now been seen.

## For the disclosure statement

- HEVS takes its name and general idea from the team's TariffSense document. Its code here was written during the sprint.
- Code and text were drafted with Claude Code.
- No real customer data is used.
