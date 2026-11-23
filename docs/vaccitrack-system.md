# VacciTrack Diagrams

These diagrams summarize the implemented VacciTrack system. They use Mermaid's neutral theme for a simple black-and-white appearance.

## Implemented Features

- **Accounts and access:** registration and sign-in, role-based workspaces, account verification, staff invitations, profile settings, English/Tagalog/Hiligaynon language preference, password recovery, and SMS one-time codes for supported account changes. Roles include client, BHW, and admin; super-admin tools are provided through a separate restricted dashboard.
- **Animal registry:** register and update dogs and cats, pet or stray classification, owner/contact details, breed, age, sex, neuter status, notes, vaccination details, location, and identification photos. Staff can search/filter records, view animal profiles, and export registry data as CSV.
- **Vaccination tracking:** vaccination history, due and overdue status, planning lists, vaccine reference data, dashboard counts, and risk/coverage summaries by purok and animal groups. Dashboard data refreshes every 30 seconds and when the browser regains focus.
- **Appointments:** staff can schedule visits, assign staff, and update appointment status; owners can view their own appointments.
- **Maps and location:** Leaflet coverage maps, map pins, purok coverage, search and filters, clusters, heat density, location selection, and place lookup through OpenStreetMap Nominatim.
- **Reports and stray/pound records:** animal, vaccination, map/coverage, and stray/pound reports with PDF, Word, Excel, CSV, and print options; track impound area and statuses for observation, adoption, or reclamation.
- **Notifications and messaging:** in-app notifications, scheduled vaccination reminders, staff SMS messaging, delivery/message history, and SMS audit records through Semaphore.
- **Operations and administration:** team management, user verification and account management, staff invites, feedback handling, audit log, and SMS testing/custom messages.

## IPOO

```mermaid
%%{init: {"theme":"neutral"}}%%
flowchart LR
  I["INPUT<br/>User accounts and roles<br/>Animals and owners<br/>Vaccination records<br/>Puroks and locations<br/>Appointments and feedback"]
  P["PROCESS<br/>Authenticate users<br/>Manage animal records<br/>Track vaccination status<br/>Manage appointments<br/>Prepare maps and reports<br/>Send reminders"]
  O["OUTPUT<br/>Animal registry<br/>Vaccination dashboard<br/>Coverage map<br/>Appointment schedule<br/>Reports and alerts"]
  O2["OUTCOME<br/>Timely vaccination follow-up<br/>Clearer coverage monitoring<br/>Traceable community operations"]
  I --> P --> O --> O2
```

## Entity Relationship Diagram (ERD)

The ERD focuses on the main records used by the registry, vaccination, and appointment workflows.

```mermaid
%%{init: {"theme":"neutral"}}%%
erDiagram
  AUTH_USERS ||--o| PROFILES : has
  PROFILES o|--o{ ANIMALS : owns
  PUROKS ||--o{ ANIMALS : contains
  ANIMALS ||--o{ VACCINATION_HISTORY : has
  PROFILES o|--o{ VACCINATION_HISTORY : records
  ANIMALS ||--o{ VACCINATION_APPOINTMENTS : scheduled_for
  PROFILES ||--o{ VACCINATION_APPOINTMENTS : owner
  PROFILES o|--o{ VACCINATION_APPOINTMENTS : assigned_staff
  ANIMALS ||--o{ VACCINATION_ALERTS : triggers
  PROFILES ||--o{ VACCINATION_ALERTS : receives
  PROFILES ||--o{ NOTIFICATIONS : receives
  PROFILES o|--o{ FEEDBACK : submits
  PROFILES o|--o{ AUDIT_LOG : performs
  AUTH_USERS o|--o{ STAFF_INVITES : redeems
  AUTH_USERS o|--o{ ACCOUNT_OTPS : requests
  ANIMALS o|--o{ APPOINTMENTS : legacy_schedule
  AUTH_USERS o|--o{ LOGIN_ATTEMPTS : has

  AUTH_USERS {
    uuid id PK
    text email
  }
  PROFILES {
    uuid id PK, FK
    text full_name
    enum role
    text contact_number
    enum status
  }
  PUROKS {
    bigint id PK
    text name UK
    numeric latitude
    numeric longitude
  }
  ANIMALS {
    bigint id PK
    bigint purok_id FK
    uuid user_id FK
    text name
    text species
    text breed
    date vaccine_date
    date next_due_date
  }
  VACCINATION_HISTORY {
    bigint id PK
    bigint animal_id FK
    uuid recorded_by FK
    date vaccine_date
    date next_due_date
  }
  VACCINATION_APPOINTMENTS {
    bigint id PK
    bigint animal_id FK
    uuid owner_id FK
    uuid assigned_staff_id FK
    timestamptz appointment_at
    text status
  }
  VACCINATION_ALERTS {
    bigint id PK
    bigint animal_id FK
    uuid user_id FK
    date due_date
    text status
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
    text status
  }
  AUDIT_LOG {
    bigint id PK
    uuid user_id FK
    text action
    text table_name
  }
  STAFF_INVITES {
    bigint id PK
    text token UK
    text role
    timestamptz expires_at
    uuid used_by FK
  }
  ACCOUNT_OTPS {
    bigint id PK
    uuid user_id FK
    text purpose
    text channel
  }
  LOGIN_ATTEMPTS {
    bigint id PK
    text username
    text ip_address
    boolean success
  }
  APPOINTMENTS {
    bigint id PK
    bigint animal_id FK
    uuid assigned_to FK
    date scheduled_date
    text status
  }
  MESSAGE_HISTORY {
    bigint id PK
    text channel
    text message_type
    text recipient_address
    text status
  }
```

## Data Flow Diagram (DFD) - Level 0

```mermaid
%%{init: {"theme":"neutral"}}%%
flowchart LR
  OWNER[Pet Owner]
  STAFF[Admin or BHW]
  SUPER[Super Admin]
  SYSTEM([VacciTrack System])
  SMS[Semaphore SMS Service]
  OSM[OpenStreetMap Nominatim]

  OWNER -->|Account, own records, feedback, settings| SYSTEM
  SYSTEM -->|Own animal records, appointments, notifications| OWNER
  STAFF -->|Registry, vaccination, appointment, map updates| SYSTEM
  SYSTEM -->|Dashboard, planning, risk, map, reports| STAFF
  SUPER -->|Accounts, verification, invites, audit, SMS requests| SYSTEM
  SYSTEM -->|User administration and audit information| SUPER
  SYSTEM -->|Reminder messages| SMS
  SMS -->|Delivery status| SYSTEM
  SYSTEM -->|Place search request| OSM
  OSM -->|Location suggestions| SYSTEM
```

## Data Flow Diagram (DFD) - Level 1

```mermaid
%%{init: {"theme":"neutral"}}%%
flowchart LR
  USER[Users]

  subgraph PROCESS[System Processes]
    AUTH([1. Authenticate and authorize])
    REG([2. Manage animal registry])
    VAX([3. Track vaccinations])
    APPT([4. Manage appointments])
    MAP([5. Prepare coverage map])
    REPORT([6. Prepare reports and alerts])
    ADMIN([7. Manage users, feedback, and audit])
  end

  subgraph STORE[Data Stores]
    PROFILE[(Profiles)]
    ANIMAL[(Animals)]
    PUROK[(Puroks)]
    HISTORY[(Vaccination history)]
    APPOINTMENT[(Appointments)]
    NOTICE[(Notifications and alerts)]
    FEEDBACK[(Feedback)]
    AUDIT[(Audit log and message history)]
  end

  SMS[Semaphore SMS Service]

  USER --> AUTH --> PROFILE
  USER --> REG
  REG <--> ANIMAL
  PUROK --> REG
  ANIMAL --> VAX
  VAX <--> HISTORY
  USER --> APPT
  APPT <--> APPOINTMENT
  ANIMAL --> APPT
  PUROK --> MAP
  ANIMAL --> MAP
  ANIMAL --> REPORT
  HISTORY --> REPORT
  APPOINTMENT --> REPORT
  USER --> ADMIN
  ADMIN <--> PROFILE
  ADMIN <--> FEEDBACK
  ADMIN --> AUDIT
  REG --> AUDIT
  VAX --> AUDIT
  APPT --> AUDIT
  REPORT --> NOTICE
  NOTICE --> SMS
  SMS --> NOTICE
```

## Front-end

```mermaid
%%{init: {"theme":"neutral"}}%%
flowchart TB
  USER[Pet Owner, Admin, BHW, or Super Admin]
  SIGNIN[Sign in or registration]
  WORKSPACE[Role-aware Next.js workspace]

  USER --> SIGNIN --> WORKSPACE

  WORKSPACE --> OVERVIEW[Overview and live dashboard]
  WORKSPACE --> REGISTRY[Animal registry, profiles, search, and CSV export]
  WORKSPACE --> PLAN[Due-soon and overdue planning]
  WORKSPACE --> APPOINTMENTS[Schedule, assign, and update appointments]
  WORKSPACE --> RISK[Risk and coverage analysis]
  WORKSPACE --> MAP[Coverage map and animal locations]
  WORKSPACE --> POUND[Stray and pound tracking]
  WORKSPACE --> REPORTS[Animal, vaccination, map, and pound reports]
  WORKSPACE --> FEEDBACK[Feedback]
  WORKSPACE --> TEAM[Team management]
  WORKSPACE --> SMS[SMS messaging and reminders]
  WORKSPACE --> AUDIT[Audit log]
  WORKSPACE --> SETTINGS[Profile, language, and SMS settings]
  WORKSPACE --> ADMIN[Restricted super-admin dashboard]
  ADMIN --> ADMIN_TOOLS[User accounts, verification, invites, feedback, map, SMS, message history, and audit]
```

## Back-end

```mermaid
%%{init: {"theme":"neutral"}}%%
flowchart LR
  FRONTEND[Next.js front-end]
  PROXY[Next.js proxy and access checks]
  ACTIONS[Server actions and route handlers]
  AUTHFLOW[Registration, verification, OTP, and session handling]
  DATAFLOW[Registry, vaccination, appointments, reports, and audit operations]
  CRON[Scheduled vaccination reminder route]
  AUTH[Supabase Auth]
  DB[(Supabase Postgres<br/>Row Level Security)]
  STORAGE[(Private Supabase Storage)]
  SMS[Semaphore SMS API]
  LOCATION[Location search action]
  OSM[OpenStreetMap Nominatim]

  FRONTEND --> PROXY --> AUTHFLOW
  FRONTEND --> ACTIONS --> DATAFLOW
  AUTHFLOW --> AUTH
  DATAFLOW --> DB
  DATAFLOW --> STORAGE
  DATAFLOW --> SMS
  ACTIONS --> LOCATION --> OSM
  CRON --> DB
  CRON --> SMS
```

## System Architecture

```mermaid
%%{init: {"theme":"neutral"}}%%
flowchart LR
  subgraph BROWSER[Client Browser]
    UI[Role-aware Next.js workspace]
    MAP[Leaflet coverage map]
  end

  subgraph VERCEL[Vercel Runtime]
    GUARD[Proxy and role guard]
    ACTIONS[Server actions]
    CRON[Scheduled reminder route]
  end

  subgraph SUPABASE[Supabase]
    AUTH[Authentication]
    DB[(Postgres with RLS)]
    STORAGE[(Private storage buckets)]
  end

  LOCATION[Server-side location lookup]
  OSM[OpenStreetMap Nominatim]
  SMS[Semaphore SMS API]

  UI --> GUARD
  GUARD --> UI
  UI --> MAP
  MAP --> LOCATION --> OSM
  UI --> ACTIONS
  ACTIONS --> AUTH
  ACTIONS --> DB
  ACTIONS --> STORAGE
  ACTIONS --> SMS
  CRON --> DB
  CRON --> SMS
```
