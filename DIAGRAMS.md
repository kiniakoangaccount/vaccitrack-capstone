# VacciTrack — System Diagrams

Mermaid source for the capstone documentation set. Paste any block below into
the [Mermaid Live Editor](https://mermaid.live), a Mermaid-aware Notion/Confluence
page, or a `.md` file rendered on GitHub/GitLab — no changes needed.

## IPOO

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}, 'themeVariables': {'fontSize': '17px'}}}%%
flowchart LR
  classDef stage text-align:left,font-size:16px,stroke-width:2px;

  I["<div style='text-align:left'><b>INPUT</b><br/>- Civilian & staff account details<br/>- Animal profile & owner info<br/>- Vaccination records<br/>- Purok / geolocation data<br/>- Feedback messages<br/>- Valid-ID verification photo</div>"]:::stage
  P["<div style='text-align:left'><b>PROCESS</b><br/>- Role-based registration & ID review<br/>- Animal registry management<br/>- Vaccination scheduling & status calc.<br/>- Coverage & risk analysis<br/>- Report & CSV generation<br/>- SMS reminder queuing<br/>- Audit logging</div>"]:::stage
  O["<div style='text-align:left'><b>OUTPUT</b><br/>- Digital animal registry<br/>- Vaccination status dashboard<br/>- Coverage map & risk report<br/>- Printable / CSV vaccination reports<br/>- SMS vaccination reminders<br/>- Audit trail</div>"]:::stage
  C["<div style='text-align:left'><b>OUTCOME</b><br/>- Higher rabies vaccination coverage<br/>- Fewer missed / overdue vaccinations<br/>- Data-driven barangay health planning<br/>- Faster record-keeping than paper logs<br/>- Transparent, auditable operations</div>"]:::stage

  I --> P --> O --> C
  linkStyle default stroke-width:2px;
```

## System Architecture

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}, 'themeVariables': {'fontSize': '17px'}}}%%
flowchart TB
  classDef default stroke-width:2px;

  subgraph CLIENT["Client — Browser"]
    UI["Next.js client components<br/>(workspace tabs, forms, Leaflet map)"]
  end

  subgraph VERCEL["Vercel — Next.js runtime"]
    MW["Middleware<br/>(admin route guard)"]
    RSC["Server Components<br/>(hidden admin dashboard, SSR)"]
    SA["Server Actions<br/>(register, export, CRUD, invites, OTP, geocode)"]
    CRON["Cron route<br/>/api/cron/vaccination-alerts"]
  end

  subgraph SUPABASE["Supabase"]
    AUTH["Auth"]
    DB[("Postgres DB<br/>+ Row-Level Security")]
    STORAGE["Storage<br/>(id-documents bucket)"]
  end

  TWILIO["Twilio<br/>SMS API"]
  NOMINATIM["Nominatim<br/>(OpenStreetMap geocoding)"]

  UI -- "sign in (anon key)" --> AUTH
  UI -- "RLS-scoped reads/writes<br/>(anon key)" --> DB
  UI -- "privileged actions" --> SA
  UI -- "admin session cookie" --> MW --> RSC
  SA -- "service-role key<br/>(bypasses RLS)" --> DB
  SA --> STORAGE
  SA -- "OTP verification code<br/>(username/password change)" --> TWILIO
  SA -- "place search" --> NOMINATIM
  RSC -- "service-role key" --> DB
  CRON -- "read overdue + log alert<br/>(service-role key)" --> DB
  CRON -- "send reminder" --> TWILIO
  linkStyle default stroke-width:2px;
```

## Front-end

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}, 'themeVariables': {'fontSize': '17px'}}}%%
flowchart TB
  classDef default stroke-width:2px;

  LAND["Landing page"] --> AUTHUI["Sign in / Register<br/>(Supabase Auth)"]
  AUTHUI --> WS

  subgraph WS["Authenticated workspace (role-aware tabs)"]
    direction TB
    ALL["All roles<br/>Overview · Feedback · Profile · Settings"]
    CLIENTX["Client adds<br/>My animals (own records) · Export my report"]
    STAFF["Staff only — admin, bhw<br/>Registry (all) · Planning · Reports · Risk<br/>Coverage map · Stray & pound · Team"]
    ADMINX["Admin only<br/>Audit log"]
  end

  HURL["Unlisted admin URL<br/>+ admin login<br/>(separate session cookie)"] --> HIDDEN

  subgraph HIDDEN["Hidden super-admin dashboard"]
    HTABS["Overview · User accounts · Pending verification ·<br/>Invite staff · Feedback inbox · Coverage map · Audit log"]
  end
  linkStyle default stroke-width:2px;
```

## Back-end

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}, 'themeVariables': {'fontSize': '17px'}}}%%
flowchart LR
  classDef default stroke-width:2px;

  ACCT["Accounts & access<br/>signin-action · register-action ·<br/>invite-register-action ·<br/>profile-actions (OTP) · team-actions"]
  DOMAIN["Registry & vaccination domain<br/>vaccination-actions · pound-actions ·<br/>settings-actions (breeds, vaccines, puroks) ·<br/>audit-actions (CSV export, audit log) ·<br/>geocode-action (place search)"]
  ENGAGE["Engagement<br/>notification-actions ·<br/>reminder-actions (in-app reminders)"]
  ADMIN["Super-admin only<br/>crud-actions (users, invites, resets)"]
  CRONJOB["Scheduled<br/>/api/cron/vaccination-alerts"]

  DB[("Supabase Postgres<br/>+ Auth + RLS")]
  STORE["Supabase Storage<br/>(ID documents)"]
  SMS["Twilio SMS"]
  GEO["Nominatim<br/>(place search)"]

  ACCT --> DB
  ACCT -- "ID photo upload" --> STORE
  ACCT -- "OTP verification code" --> SMS
  DOMAIN --> DB
  DOMAIN -- "place search" --> GEO
  ENGAGE -- "in-app notification" --> DB
  ADMIN --> DB
  CRONJOB --> DB
  CRONJOB -- "send scheduled<br/>reminder SMS" --> SMS
  linkStyle default stroke-width:2px;
```

## ERD

Every foreign key below is drawn from the table it actually references in
`supabase/schema.sql` — most of them point straight at `auth.users`, not at
`profiles` (`profiles.id` is itself just a 1:1 extension of `auth.users`).
`breeds`, `vaccines`, and `login_attempts` are included as standalone tables:
`animals.breed`/`vaccine_type` are free-text (no FK to `breeds`/`vaccines`),
and `login_attempts` is keyed by the attempted email, not a user id — so none
of the three have a relationship to draw.

```mermaid
%%{init: {'themeVariables': {'fontSize': '17px'}}}%%
erDiagram
  AUTH_USERS ||--|| PROFILES : "has account"
  AUTH_USERS ||--o{ ANIMALS : owns
  PUROKS ||--o{ ANIMALS : "located in"
  ANIMALS ||--o{ VACCINATION_HISTORY : "vaccinated in"
  AUTH_USERS ||--o{ VACCINATION_HISTORY : records
  ANIMALS ||--o{ VACCINATION_ALERTS : triggers
  AUTH_USERS ||--o{ VACCINATION_ALERTS : "notified via"
  AUTH_USERS ||--o{ NOTIFICATIONS : receives
  AUTH_USERS ||--o{ FEEDBACK : submits
  AUTH_USERS ||--o{ AUDIT_LOG : "acted in"
  AUTH_USERS ||--o{ STAFF_INVITES : redeems
  AUTH_USERS ||--o{ ACCOUNT_OTPS : requests

  AUTH_USERS {
    uuid id PK
    text email
  }
  PROFILES {
    uuid id PK
    text full_name
    enum role "admin bhw client viewer"
    enum status "active pending disabled"
    text username
    text contact_number
  }
  PUROKS {
    bigint id PK
    text name
    numeric latitude
    numeric longitude
  }
  ANIMALS {
    bigint id PK
    uuid user_id FK
    bigint purok_id FK
    text name
    enum species "Dog Cat"
    enum classification "Pet Stray"
    boolean vaccinated
    date next_due_date
    text pound_status
  }
  VACCINATION_HISTORY {
    bigint id PK
    bigint animal_id FK
    uuid recorded_by FK
    date vaccine_date
    date next_due_date
  }
  VACCINATION_ALERTS {
    bigint id PK
    bigint animal_id FK
    uuid user_id FK
    date due_date
    text status "pending sent failed"
  }
  NOTIFICATIONS {
    bigint id PK
    uuid user_id FK
    text title
    boolean is_read
  }
  FEEDBACK {
    bigint id PK
    uuid user_id FK
    text category
    text status "New Reviewed Resolved"
  }
  AUDIT_LOG {
    bigint id PK
    uuid user_id FK
    text action
    text table_name
  }
  STAFF_INVITES {
    bigint id PK
    text token
    enum role "bhw admin"
    uuid used_by FK
  }
  ACCOUNT_OTPS {
    bigint id PK
    uuid user_id FK
    text purpose
    text channel
  }
  BREEDS {
    bigint id PK
    text name
    enum species "Dog Cat"
  }
  VACCINES {
    bigint id PK
    text name
  }
  LOGIN_ATTEMPTS {
    bigint id PK
    text email
    text ip_address
    boolean success
  }
```

## DFD — Level 0 (Context Diagram)

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}, 'themeVariables': {'fontSize': '17px'}}}%%
flowchart LR
  classDef default stroke-width:2px;

  CIV["Civilian /<br/>Pet Owner"]
  STAFF["Barangay Health Worker /<br/>Administrator"]
  SUPER["Super Admin"]
  SMS["SMS Gateway<br/>(Twilio)"]

  SYS(("0<br/>VacciTrack<br/>System"))

  CIV -- "registration info, own animal & vaccination data, feedback" --> SYS
  SYS -- "account status, animal records, SMS reminders" --> CIV

  STAFF -- "animal & vaccination records, report requests, verification decisions" --> SYS
  SYS -- "reports, coverage map, risk analysis, audit views" --> STAFF

  SUPER -- "user & role management, staff invites" --> SYS
  SYS -- "system-wide audit log, user directory" --> SUPER

  SYS -- "reminder & OTP<br/>verification SMS" --> SMS
  linkStyle default stroke-width:2px;
```

## DFD — Level 1

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}, 'themeVariables': {'fontSize': '17px'}}}%%
flowchart TB
  classDef default stroke-width:2px;

  CIV["Civilian / Pet Owner"]
  STAFF["BHW / Administrator"]
  SUPER["Super Admin"]
  SMSGW["SMS Gateway"]
  GEOSVC["Geocoding Service<br/>(Nominatim)"]

  P1(("1.0<br/>Manage Accounts<br/>& Access"))
  P2(("2.0<br/>Manage Animal<br/>Registry"))
  P3(("3.0<br/>Track<br/>Vaccinations"))
  P4(("4.0<br/>Generate Reports<br/>& Analytics"))
  P5(("5.0<br/>Manage<br/>Feedback"))
  P6(("6.0<br/>Send Notifications<br/>& Alerts"))
  P7(("7.0<br/>Audit & Security<br/>Logging"))

  D1[("D1  Profiles")]
  D2[("D2  Staff Invites /<br/>OTP codes")]
  D4[("D4  Puroks")]
  D3[("D3  Animals")]
  D5[("D5  Vaccination<br/>History")]
  D6[("D6  Feedback")]
  D7[("D7  Notifications /<br/>Alerts")]
  D8[("D8  Audit Log")]

  CIV -- "registration, login" --> P1
  SUPER -- "invite, approve, role changes" --> P1
  P1 <--> D1
  P1 <--> D2
  P1 -- "OTP verification code<br/>(username/password change)" --> SMSGW

  CIV -- "register own animal" --> P2
  STAFF -- "manage any animal" --> P2
  P2 <--> D4
  P2 <--> D3
  P2 -- "place search query" --> GEOSVC

  STAFF -- "record vaccination" --> P3
  P3 --> D3
  P3 <--> D5

  STAFF -- "request report" --> P4
  P4 -- "coverage / risk / CSV report" --> STAFF
  D4 --> P4
  D3 --> P4
  D5 --> P4

  CIV -- "submit feedback" --> P5
  STAFF -- "review feedback" --> P5
  P5 <--> D6

  STAFF -- "queue reminder" --> P6
  D3 --> P6
  D5 --> P6
  P6 <--> D7
  P6 -- "in-app notice" --> CIV
  P6 -- "reminder<br/>(scheduled cron job only)" --> SMSGW

  P1 --> P7
  P2 --> P7
  P3 --> P7
  P7 <--> D8
  P7 -- "audit trail" --> SUPER
  P7 -- "audit trail" --> STAFF
  linkStyle default stroke-width:2px;
```

## Use Case Diagram

```mermaid
%%{init: {'flowchart': {'curve': 'linear'}, 'themeVariables': {'fontSize': '17px'}}}%%
flowchart LR
  classDef default stroke-width:2px;

  CIV["Civilian /<br/>Pet Owner"]
  VIEW["Viewer"]

  subgraph UC_ACCT["Account"]
    direction TB
    UC1(["Sign in"])
    UC2(["Register account"])
    UC3(["Manage own profile"])
  end

  subgraph UC_CIV["Civilian self-service"]
    direction TB
    UC4(["Register own animal"])
    UC5(["View own animal records"])
    UC6(["Export own report"])
  end

  subgraph UC_COMMON["Shared"]
    direction TB
    UC7(["Submit feedback"])
    UC8(["View overview dashboard"])
  end

  subgraph UC_ACCT2["Account "]
    direction TB
    UC1B(["Sign in"])
    UC3B(["Manage own profile"])
  end

  subgraph UC_COMMON2["Shared "]
    direction TB
    UC7B(["Submit feedback"])
    UC8B(["View overview dashboard"])
  end

  subgraph UC_STAFF["Field operations — staff"]
    direction TB
    UC9(["Manage full animal registry"])
    UC10(["Record vaccination"])
    UC11(["Plan vaccination drives"])
    UC12(["View reports & risk analysis"])
    UC13(["View coverage map"])
    UC14(["Manage stray & pound records"])
    UC15(["Export CSV report"])
    UC16(["Queue vaccination<br/>reminders (in-app)"])
  end

  subgraph UC_ADMIN["Administration"]
    direction TB
    UC17(["View audit log"])
  end

  subgraph UC_SUPER["Super-admin console"]
    direction TB
    UC18(["Approve / reject registrations"])
    UC19(["Manage user accounts"])
    UC20(["Invite staff"])
    UC21(["Reset account password"])
  end

  BHW["Barangay<br/>Health Worker"]
  ADMIN["Administrator"]
  SUPER["Super Admin"]

  CIV --> UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7 & UC8
  VIEW --> UC1 & UC3 & UC7 & UC8

  UC1B & UC3B & UC7B & UC8B & UC9 & UC10 & UC11 & UC12 & UC13 & UC14 & UC15 & UC16 --> BHW
  UC1B & UC3B & UC7B & UC8B & UC9 & UC10 & UC11 & UC12 & UC13 & UC14 & UC15 & UC16 & UC17 --> ADMIN
  UC1B & UC17 & UC18 & UC19 & UC20 & UC21 --> SUPER

  UC8 ~~~ UC1B
  linkStyle default stroke-width:2px;
```
