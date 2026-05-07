## Summary

-

## Verification

- [ ] `npm run build:src`
- [ ] `npm run build:admin-dashboard`
- [ ] Focused backend tests for touched admin modules
- [ ] `npm run test:admin-dashboard-actions` when dashboard server actions or mutation forms change
- [ ] `npm run test:admin-durable-storage` when admin job/audit persistence changes
- [ ] `npm run smoke:admin-dashboard` when dashboard deployment or health behavior changes
- [ ] `npm run smoke:admin-dashboard:e2e` when dashboard navigation, auth, jobs, media actions, or layout changes

## Admin Dashboard Safety

- [ ] Destructive admin actions require typed confirmation and an operator reason
- [ ] Dangerous dashboard actions propagate idempotency keys
- [ ] New admin endpoints keep OPERATOR auth on the API boundary
- [ ] Job and audit payloads remain DTOs, not raw TypeORM entities
- [ ] Browser smoke screenshots or equivalent visual artifacts were reviewed for changed dashboard pages
