# Feature Diff: message.send.basic

- added: 13
- removed: 0
- changed: 2

## Added Traffic

- GET /content-inventory/users/@me
  - attribution: probable
  - step: send-message
- GET /games/detectable/exclusions
  - attribution: probable
  - step: send-message
  - response shape: sha256:038f30c12c43492c20a3f1758a65e95ca82971fc46f99725af85b2176cdf8610
  - status codes: 200
- GET /partner-sdk/storefront-config
  - attribution: probable
  - step: send-message
  - response shape: sha256:b07133b0287c9006dfebd738f0ded9ed1cf90d5c1aa26f7dba1a89612700725f
  - status codes: 200
- GET /partner-sdk/storefront-eligibility
  - attribution: probable
  - step: send-message
- GET /promotions
  - attribution: probable
  - step: send-message
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - status codes: 200
- GET /store/published-listings/skus
  - attribution: probable
  - step: send-message
- GET /users/@me/applications/{application_id}/entitlements
  - attribution: probable
  - step: send-message
- GET /users/@me/billing/checkout-recovery
  - attribution: probable
  - step: send-message
  - response shape: sha256:343e5e3408bea653f4a7124bb7e27ae0fa3b7a55a3ac6a12a575b23028888b41
  - status codes: 200
- GET /users/@me/billing/payment-sources
  - attribution: probable
  - step: send-message
- GET /users/@me/billing/subscriptions
  - attribution: probable
  - step: send-message
- GET /users/@me/collectibles-marketing
  - attribution: probable
  - step: send-message
  - response shape: sha256:9713ac6dba59eed9eeae7beffb5c51d37553ac247d8af1aa05fc165825498086
  - status codes: 200
- GET /users/@me/mfa/webauthn/credentials
  - attribution: probable
  - step: send-message
  - response shape: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67
  - status codes: 200
- POST /users/@me/billing/user-offer
  - attribution: probable
  - step: send-message
  - request shape: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36

## Removed Traffic

- none

## Changed Traffic

- http:open-channel:POST /science
  - changed fields: request_shape
  - before: attribution=probable, request=sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788
  - after: attribution=probable, request=sha256:c07e1317891ff2c40e7f4d79110a9a31e945feb3c47d7757ee4c974bd535a59f
- http:send-message:POST /science
  - changed fields: request_shape
  - before: attribution=probable, request=sha256:07327848d6f8c081cf17050e2ac224b8de88c5e51da24dc31e9607dc58333e67
  - after: attribution=probable, request=sha256:4a54b4032616d3d384ef0cb2cd1787ec5ec92541c9364fd14fbbf1fc7cf2dad7
