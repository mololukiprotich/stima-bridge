# Stima Bridge

Prototype for Global Energy Hackathon Brief 09, Prepaid token lockouts.
Stima Bridge estimates when prepaid homes go dark, ranks need, and lets households borrow a small block of units on a basic phone.

**All data in this repo is synthetic. Nothing here is connected to Kenya Power, EPRA or any mobile network.**

## Parts

| Part | Location |
|---|---|
| Synthetic data generator, with settings the detector never reads | `generator/` |
| Dark Days detector | `src/core/detector.js` |
| HEVS need score | `src/core/hevs.js` |
| USSD logic | `src/core/ussd.js` |
| Dashboard and USSD prototype | `web/` |
| Evaluation results | `results/` |

## Run it

Requires Node 20 or newer. There are no dependencies.

```bash
npm run generate
npm run tune
npm run evaluate
npm test
npm run serve
```

Then open http://localhost:4173/web/ for the dashboard and http://localhost:4173/web/ussd.html for the USSD prototype.

USSD records are saved by the local server as `data/records/users.csv`, `reports.csv` and `transactions.csv`. These files are not encrypted and are not committed, so use made-up details only.

The Vercel demo is static, so it has no CSV files. Each visitor's records stay in their own browser.

## Testing rule

Detector settings are tuned on the training set only. The test set uses a different seed and different household settings, and it is scored after tuning is fixed.

See `CHANGELOG.md` for what was built during the sprint.
