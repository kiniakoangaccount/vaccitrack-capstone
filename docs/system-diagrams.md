# VacciTrack System Diagrams

These diagrams describe the current Next.js and Supabase implementation. `profiles`, `animals`, `puroks`, `vaccination_history`, `notifications`, and `vaccination_alerts` are defined in `supabase/schema.sql`. Breed and vaccine names are currently stored as text on animal/history records; the `breeds` and `vaccines` lookup tables are not foreign-keyed to those fields.

## ERD

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        string email
        json raw_user_meta_data
    }
    PROFILES {
        uuid id PK, FK
        string full_name
        enum role
        string username UK
        string contact_number
        string id_document_reference
        enum status
        datetime created_at
    }
    PUROKS {
        bigint id PK
        string name UK
        decimal latitude
        decimal longitude
        datetime created_at
    }
    ANIMALS {
        bigint id PK
        bigint purok_id FK
        uuid user_id FK "nullable owner"
        string name
        enum species
        enum classification
        string owner_name
        string contact_number
        string breed
        integer age
        string sex
        boolean vaccinated
        date vaccine_date
        date next_due_date
        string vaccine_type
        string pound_status
        decimal latitude
        decimal longitude
        string color
        string notes
        datetime created_at
        datetime updated_at
    }
    VACCINATION_HISTORY {
        bigint id PK
        bigint animal_id FK
        uuid recorded_by FK
        date vaccine_date
        date next_due_date
        string vaccine_type
        string administered_by
        string notes
        datetime created_at
    }
    BREEDS {
        bigint id PK
        string name
        enum species
        datetime created_at
    }
    VACCINES {
        bigint id PK
        string name UK
        datetime created_at
    }
    NOTIFICATIONS {
        bigint id PK
        uuid user_id FK
        string title
        string message
        string type
        boolean is_read
        string dedupe_key UK
        datetime created_at
    }
    VACCINATION_ALERTS {
        bigint id PK
        bigint animal_id FK
        uuid user_id FK
        date due_date
        string alert_type
        string channel
        string status
        string provider_message_id
        string error_message
        datetime sent_at
        datetime created_at
    }
    FEEDBACK {
        bigint id PK
        uuid user_id FK
        string name
        string contact
        string category
        string message
        string status
        string admin_notes
        datetime created_at
        datetime updated_at
    }
    AUDIT_LOG {
        bigint id PK
        uuid user_id FK
        string action
        string table_name
        bigint record_id
        string notes
        datetime created_at
    }
    STAFF_INVITES {
        bigint id PK
        string token UK
        enum role
        datetime expires_at
        datetime used_at
        uuid used_by FK
        datetime created_at
    }
    ACCOUNT_OTPS {
        bigint id PK
        uuid user_id FK
        string purpose
        string channel
        string code_hash
        datetime expires_at
        datetime consumed_at
        datetime created_at
    }
    LOGIN_ATTEMPTS {
        bigint id PK
        string email
        string ip_address
        boolean success
        datetime created_at
    }

    AUTH_USERS ||--o| PROFILES : has
    AUTH_USERS o|--o{ ANIMALS : owns
    PUROKS ||--o{ ANIMALS : locates
    ANIMALS ||--o{ VACCINATION_HISTORY : has
    AUTH_USERS o|--o{ VACCINATION_HISTORY : records
    AUTH_USERS o|--o{ NOTIFICATIONS : receives
    ANIMALS ||--o{ VACCINATION_ALERTS : triggers
    AUTH_USERS ||--o{ VACCINATION_ALERTS : receives
    AUTH_USERS o|--o{ FEEDBACK : submits
    AUTH_USERS o|--o{ AUDIT_LOG : performs
    AUTH_USERS o|--o{ STAFF_INVITES : redeems
    AUTH_USERS ||--o{ ACCOUNT_OTPS : verifies
```

`LOGIN_ATTEMPTS` has no foreign key. Animal `breed` and `vaccine_type` are text values rather than references to `BREEDS` and `VACCINES`. Animal photos are not currently represented in the schema.

## DFD Level 0: Context

```mermaid
flowchart LR
    owner[Pet owner / client]
    staff[Barangay staff: BHW or admin]
    superadmin[Platform administrator]
    cron[Vercel scheduled cron]
    system((VacciTrack system))
    supabase[(Supabase Auth, Postgres and Storage)]
    semaphore[Semaphore SMS service]
    osm[OpenStreetMap tile service]

    owner -->|Sign in, register animals, view schedules and notifications, submit feedback| system
    system -->|Animal status, schedules, confirmations and notifications| owner
    staff -->|Manage animal registry, vaccination records, pound statuses, reports and feedback| system
    system -->|Dashboards, maps, reports and operational alerts| staff
    superadmin -->|Manage staff accounts and invitations| system
    system -->|Account and invite results| superadmin
    cron -->|Daily vaccination-alert request with cron secret| system
    system -->|SMS requests for 7-day, 1-day and overdue alerts| semaphore
    semaphore -->|Delivery result and message ID| system
    system <-->|Authentication, records, policies and ID-document files| supabase
    system -->|Map tile requests| osm
    osm -->|Map tiles| system
```

## DFD Level 1: Core Processes and Data Stores

```mermaid
flowchart LR
    owner[Pet owner / client]
    staff[Admin / BHW]
    platformadmin[Platform administrator]
    cron[Vercel cron]
    sms[Semaphore SMS]
    maptiles[OpenStreetMap]

    p1([1.0 Authenticate and authorize])
    p2([2.0 Manage animal registry and location])
    p3([3.0 Record vaccinations and calculate status])
    p4([4.0 Generate and deliver reminders])
    p5([5.0 Handle feedback and audit activity])
    p6([6.0 Manage staff invitations and accounts])

    d1[(D1 Supabase Auth and profiles)]
    d2[(D2 Animals and puroks)]
    d3[(D3 Vaccination history)]
    d4[(D4 Notifications and vaccination alerts)]
    d5[(D5 Feedback and audit log)]
    d6[(D6 Staff invites and account OTPs)]
    d7[(D7 Private ID-document storage)]

    owner -->|Credentials and session| p1
    staff -->|Credentials and session| p1
    p1 <-->|Verify user and role| d1
    p1 -->|Authorized session| p2
    p1 -->|Authorized session| p3
    p1 -->|Authorized session| p5

    owner -->|Own-animal registration and feedback| p2
    staff -->|Animal, purok and pound updates| p2
    p2 <-->|Read/write records; row-level policies| d2
    p2 -->|Map coordinates and animal markers| maptiles
    maptiles -->|Map tiles| p2
    p2 -->|Animal selection and details| owner
    p2 -->|Registry, pound and map views| staff

    staff -->|Vaccination event| p3
    owner -->|View vaccination schedule| p3
    p3 <-->|Read and write animal dates/status| d2
    p3 <-->|Vaccination event history| d3
    p3 -->|Schedule and status| owner
    p3 -->|Planning and risk summaries| staff

    cron -->|Daily scheduled invocation| p4
    p4 <-->|Find 7-day, 1-day and overdue cases; claim/send status| d2
    p4 <-->|Persist per-event deduplication and in-app notices| d4
    p4 -->|Personalized SMS| sms
    sms -->|Provider result| p4
    p4 -->|Vaccination notifications| owner

    owner -->|Feedback message| p5
    staff -->|Feedback review and operational actions| p5
    p5 <-->|Feedback records and audit entries| d5
    p5 -->|Feedback status and audit view| staff

    platformadmin -->|Create staff invite| p6
    p6 <-->|Staff profile and invite state| d1
    p6 <-->|Single-use invite and OTP state| d6
    p6 -->|ID document reference| d7
    p6 -->|Invite and account status| platformadmin
```

## System Architecture

```mermaid
flowchart TB
    subgraph users[Users]
        client[Pet owner / client browser]
        operator[Admin / BHW browser]
        superadmin[Platform administrator browser]
    end

    subgraph vercel[Vercel deployment]
        nextui[Next.js App Router UI\nOverview, Registry, Planning, Reports, Risk, Map, Pound, Feedback, Team, Audit]
        pages[Profile and Settings routes\nHidden staff-management dashboard]
        middleware[Middleware\nHidden dashboard session gate]
        actions[Server actions\nRegistration, reminders, vaccination, profile and admin operations]
        cronroute[API route\n/api/cron/vaccination-alerts]
        scheduler[Vercel Cron\nDaily at 16:00 UTC]
    end

    subgraph supabase[Supabase project]
        auth[Supabase Auth]
        db[(PostgreSQL\nRLS-protected tables and triggers)]
        storage[(Supabase Storage\nPrivate ID documents)]
    end

    semaphore[Semaphore SMS API]
    osm[OpenStreetMap tiles]

    client --> nextui
    operator --> nextui
    superadmin --> middleware --> pages
    nextui -->|Browser client with user session| auth
    nextui -->|RLS-scoped reads and writes| db
    nextui -->|Map rendering| osm
    nextui --> actions
    pages --> actions
    actions -->|Cookie-scoped Supabase client| auth
    actions -->|RLS-scoped database operations| db
    actions -->|Privileged operations using server-only service role| db
    actions --> storage
    scheduler --> cronroute
    cronroute -->|Server-only service role| db
    cronroute -->|Personalized SMS request| semaphore
    semaphore -->|Provider response| cronroute
    db -->|Overdue notification trigger| db
```

The Supabase service-role key and Semaphore API key are server-only. Browser and cookie-scoped clients use the authenticated user's session and are subject to row-level security. The hidden dashboard has an additional middleware cookie gate.

## IPOO

```mermaid
flowchart LR
    input["INPUT\n• User credentials and roles\n• Animal, owner and purok details\n• Vaccination dates and history\n• Feedback and staff actions\n• Scheduled alert invocation"]
    process["PROCESS\n• Authenticate and enforce role/RLS rules\n• Validate and save animal records\n• Calculate due, due-soon and overdue status\n• Build maps, reports and risk summaries\n• Deduplicate and send vaccination alerts\n• Record feedback and audit activity"]
    output["OUTPUT\n• Animal registry and profiles\n• Vaccination schedules and history\n• Map markers and operational reports\n• In-app notifications\n• SMS reminders and delivery status\n• Feedback and audit records"]
    outcome["OUTCOME\n• Better vaccination follow-up\n• Earlier response to overdue cases\n• Improved barangay-level visibility\n• Traceable animal-health operations"]

    input --> process --> output --> outcome
```

## Frontend and Backend

```mermaid
flowchart LR
    subgraph frontend[Frontend: Next.js client experience]
        workspace[Main workspace tabs\nOverview, Registry, Planning, Reports, Risk, Map, Pound, Feedback, Team, Audit]
        profileui[Profile and Settings pages]
        adminui[Hidden staff-management dashboard]
        mapui[Leaflet map\nAnimal markers, search and heat layer]
        forms[Registration and feedback forms\nNotification and profile controls]
        workspace --> mapui
        workspace --> forms
    end

    subgraph backend[Backend: Next.js server and Supabase]
        middleware[Middleware session gate]
        serveractions[Server actions\nAuth checks, validation and mutations]
        cronapi[Daily vaccination-alert API route]
        supabaseauth[Supabase Auth]
        postgres[(PostgreSQL\nRLS, triggers and relational data)]
        objectstore[(Supabase Storage\nPrivate ID documents)]
    end

    sms[Semaphore SMS API]
    osm[OpenStreetMap]

    frontend -->|Authenticated browser requests| supabaseauth
    frontend -->|RLS-scoped data access| postgres
    frontend -->|Map tiles| osm
    frontend -->|Mutations and privileged operations| serveractions
    profileui --> serveractions
    adminui --> middleware --> serveractions
    serveractions --> supabaseauth
    serveractions --> postgres
    serveractions --> objectstore
    cronapi -->|Query eligible vaccinations and persist send results| postgres
    cronapi -->|Send SMS| sms
    postgres -->|Automatic overdue notification trigger| postgres
```

Current implementation note: animal records and client/server views do not have a pet-photo column or upload workflow. The only image storage flow is private ID-document upload during account registration.
