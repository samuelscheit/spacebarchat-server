# Route Coverage

## GET /channels/{channel_id}

- catalog: CHANNEL (xhyrom:data/client/routes.json)
- methods: GET
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:f83cdcd13e69b2ae9a17e8ecaccbd1e7474749d83a730ce05b8a7f4125a7ce10

## GET /channels/{channel_id}/messages

- catalog: MESSAGES (xhyrom:data/client/routes.json)
- methods: GET
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:61d83d01ca5ccadb3c054e0e1ab41128e2f5480506a049edff152d99bd4c7090

## GET /content-inventory/users/@me

- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## GET /games/detectable/exclusions

- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:038f30c12c43492c20a3f1758a65e95ca82971fc46f99725af85b2176cdf8610

## GET /guilds/{guild_id}/entitlements

- catalog: GUILD_ENTITLEMENTS (xhyrom:data/client/routes.json)
- methods: GET
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /guilds/{guild_id}/integrations

- catalog: GUILD_INTEGRATIONS (xhyrom:data/client/routes.json)
- methods: GET
- features: message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:068dd3c92aadb60e2d78392ace887e0ca551334dcc5d20cee51cb24fbf7f17f6

## GET /partner-sdk/storefront-config

- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:b07133b0287c9006dfebd738f0ded9ed1cf90d5c1aa26f7dba1a89612700725f

## GET /partner-sdk/storefront-eligibility

- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## GET /promotions

- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /scheduled-maintenances/upcoming.json

- methods: GET
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:8b56135b00799c77d735c4fdc631449d82ad476c0e259a590568cfeacdba4eb0

## GET /store/published-listings/skus

- catalog: STORE_PUBLISHED_LISTINGS_SKUS (xhyrom:data/client/routes.json)
- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## GET /users/@me/affinities/guilds

- catalog: GUILD_AFFINITIES (xhyrom:data/client/routes.json)
- methods: GET
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:a71a454d2b1e3f4d6b5f705c81756af858d2dffd4cb36c8aaddd238f27010bf2

## GET /users/@me/applications/{application_id}/entitlements

- catalog: ENTITLEMENTS_FOR_APPLICATION (xhyrom:data/client/routes.json)
- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: none

## GET /users/@me/billing/checkout-recovery

- catalog: CHECKOUT_RECOVERY (xhyrom:data/client/routes.json)
- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:343e5e3408bea653f4a7124bb7e27ae0fa3b7a55a3ac6a12a575b23028888b41

## GET /users/@me/billing/payment-sources

- catalog: BILLING_PAYMENT_SOURCES (xhyrom:data/client/routes.json)
- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/billing/subscriptions

- catalog: BILLING_SUBSCRIPTIONS (xhyrom:data/client/routes.json)
- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/collectibles-marketing

- catalog: COLLECTIBLES_MARKETING (xhyrom:data/client/routes.json)
- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:9713ac6dba59eed9eeae7beffb5c51d37553ac247d8af1aa05fc165825498086

## GET /users/@me/mfa/webauthn/credentials

- catalog: MFA_WEBAUTHN_CREDENTIALS (xhyrom:data/client/routes.json)
- methods: GET
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:41d649c2d6e734ec1707b6dbaa42abcf48d685261d9d52cbfc769224914e8e67

## GET /users/@me/survey

- catalog: USER_SURVEY (xhyrom:data/client/routes.json)
- methods: GET
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:03c791a2bff466a1f917bc4db83ed31cddd76160e2ce2fe94070faff2bd6e015

## GET /users/@me/unclaimed-games

- methods: GET
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36

## POST /channels/{channel_id}/messages

- catalog: MESSAGES (xhyrom:data/client/routes.json)
- methods: POST
- features: message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:82011c80e8e943e58547779a442f0d07e69c103c20a46586be727175aa1d604a
- response shapes: sha256:a6c15cd7b5edb5f961664e1e274d78124188b9a8519e8319404c31eb807522da

## POST /guilds/{guild_id}/migrate-command-scope

- catalog: GUILD_MIGRATE_COMMAND_SCOPE (xhyrom:data/client/routes.json)
- methods: POST
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: none
- response shapes: sha256:f248e244bf1528c3a9e627b6c71fd5b02fc0f9f265f60cbe5b87fba10c6b46ed

## POST /science

- catalog: TRACK (xhyrom:data/client/routes.json)
- methods: POST
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:07327848d6f8c081cf17050e2ac224b8de88c5e51da24dc31e9607dc58333e67, sha256:14da7baadfe540c32f08d923dc774d52da3681158e3ff51707525b1f2c6a4ccf, sha256:1aebb28c001c387021181022bbf7ea88eb1192e6431f15e15933ac7806a35576, sha256:44a364094da3a9e1c23db40d7de035f984fe72f5674fe0881730c5400950e7fd, sha256:46bff3d2916d9a4afe0b8dde4fde094617a17f44f2dd5038ec3016324b2ca491, sha256:47a7ac59a8c17466f0b82603b056b74c470b6e5dc599989304a441e0c2769089, sha256:4a54b4032616d3d384ef0cb2cd1787ec5ec92541c9364fd14fbbf1fc7cf2dad7, sha256:6be5c7419af6d9c0cff96e1e84b9a29a50607b2e0c225e611d90db5c5424cf7d, sha256:b2250594cbac35267a2e85ed6d37faf4dbc52740582f421c1da864745ccf8c57, sha256:ba8670b045a5e9fa7ff7923f29e51dc43f7b567b83248728596c36d34a131788, sha256:c07e1317891ff2c40e7f4d79110a9a31e945feb3c47d7757ee4c974bd535a59f, sha256:c0b0f62c0027f5505f261208d646670fc4bf627706b89d7d0cdd0413006ac145
- response shapes: none

## POST /users/@me/billing/user-offer

- catalog: USER_OFFER (xhyrom:data/client/routes.json)
- methods: POST
- features: message.send.basic
- runs: 2026-05-07T23-06-28Z-stable-local
- builds: 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36
- response shapes: none

## PUT /guilds/{guild_id}/members/@me

- catalog: GUILD_JOIN (xhyrom:data/client/routes.json)
- methods: PUT
- features: bootstrap.idle.session, message.send.basic
- runs: 2026-05-07T16-20-38Z-canary-local -> 2026-05-07T23-06-28Z-stable-local
- builds: 62340613904021af99e815460d34bee516355b2a -> 98b5be2c2533f17f926b290d360986344ddddc9c
- request shapes: sha256:224ba2de93fabd5dd383fc762f8e714485fae9e856a9ace460f2cd6677257a36
- response shapes: none
