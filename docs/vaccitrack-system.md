# VacciTrack System Documentation

This document describes the implemented Next.js, Supabase, Vercel, and Semaphore system. It replaces the older duplicate diagram and task-tracking documents.

## System Objectives

| Objective | Implemented area |
|---|---|
| 1 | Live vaccination monitoring, status calculation, notifications, and dashboard refresh |
| 2 | Geospatial mapping, purok coverage, filters, heatmap, and clusters |
| 3 | Refer to the capstone proposal for the exact external objective text |
| 4 | Staff scheduling and tracking of vaccination appointments |
| 5 | Dashboard and registry reporting, coverage breakdowns, and exports |

## System Architecture

```mermaid
flowchart TB
  subgraph Browser[Client Browser]
    UI[Role-aware Next.js workspace]
    MAP[Leaflet coverage map]
  end

  subgraph Vercel[Vercel Runtime]
    ACTIONS[Server Actions]
    CRON[Cron vaccination-alert route]
    MIDDLEWARE[Proxy and super-admin guard]
  end

  subgraph Supabase[Supabase]
    AUTH[Auth]
    DB[(Postgres with RLS)]
    STORAGE[(Private Storage buckets)]
  end

  SEMAPHORE[Semaphore SMS API]
  OSM[OpenStreetMap Nominatim]

  UI --> AUTH
  UI --> DB
  UI --> ACTIONS
  UI --> MAP
  MAP --> OSM
  ACTIONS --> DB
  ACTIONS --> STORAGE
  ACTIONS --> SEMAPHORE
  CRON --> DB
  CRON --> SEMAPHORE
  MIDDLEWARE --> UI
```

## IPOO

```mermaid
flowchart LR
  I["INPUT<br/>Accounts and roles<br/>Animal and owner records<br/>Vaccination history<br/>Puroks and locations<br/>Appointments and feedback"]
  P["PROCESS<br/>Authenticate and authorize<br/>Validate and store records<br/>Calculate vaccination status<br/>Build maps and reports<br/>Schedule reminders and appointments"]
  O["OUTPUT<br/>Registry and animal profiles<br/>Vaccination dashboard<br/>Coverage map<br/>Appointment schedule<br/>SMS and in-app alerts"]
  C["OUTCOME<br/>Earlier vaccination follow-up<br/>Better barangay coverage visibility<br/>Reduced overdue cases<br/>Traceable health operations"]

  I --> P --> O --> C
```

## Data Flow Diagram - Level 0

```mermaid
flowchart LR
  C[Client or Pet Owner]
  S[Admin or BHW]
  SA[Super Admin]
  SYS[VacciTrack System]
  SMS[Semaphore SMS]

  C -->|Registration, account, feedback| SYS
  C -->|Own animal and appointment data| SYS
  S -->|Animal, vaccination, appointment, report actions| SYS
  SA -->|User, invite, verification, audit actions| SYS
  SYS -->|Registry, reports, notifications| C
  SYS -->|Operational dashboard and reports| S
  SYS -->|Administrative information| SA
  SYS -->|Vaccination reminders| SMS
  SMS -->|Delivery result| SYS
```

## Data Flow Diagram - Level 1

```mermaid
flowchart TD
  USER[Users]

  subgraph Processes
    AUTH[1.0 Authentication and authorization]
    REG[2.0 Animal registry]
    VAX[3.0 Vaccination monitoring]
    MAP[4.0 Map and geospatial coverage]
    APPT[5.0 Appointment management]
    REPORT[6.0 Reports and exports]
    ENGAGE[7.0 Feedback and notifications]
  end

  subgraph Stores
    PROFILES[(Profiles)]
    ANIMALS[(Animals)]
    HISTORY[(Vaccination history)]
    PUROKS[(Puroks)]
    APPTS[(Vaccination appointments)]
    ALERTS[(Vaccination alerts and notifications)]
    FEEDBACK[(Feedback)]
    AUDIT[(Audit log)]
  end

  USER --> AUTH
  AUTH --> PROFILES

  USER --> REG
  REG --> ANIMALS
  PUROKS --> REG

  ANIMALS --> VAX
  VAX --> HISTORY
  VAX --> ALERTS

  PUROKS --> MAP
  ANIMALS --> MAP

  USER --> APPT
  APPT --> APPTS
  ANIMALS --> APPT
  APPTS --> AUDIT

  ANIMALS --> REPORT
  HISTORY --> REPORT

  USER --> ENGAGE
  ENGAGE --> FEEDBACK
  ENGAGE --> ALERTS
  ENGAGE --> AUDIT
```

## Entity Relationship Diagram

```mermaid
erDiagram
  AUTH_USERS ||--o| PROFILES : has
  AUTH_USERS o|--o{ ANIMALS : owns
  PUROKS ||--o{ ANIMALS : locates

  ANIMALS ||--o{ VACCINATION_HISTORY : has
  AUTH_USERS o|--o{ VACCINATION_HISTORY : records

  ANIMALS o|--o{ APPOINTMENTS : has_legacy
  AUTH_USERS o|--o{ APPOINTMENTS : manages

  ANIMALS ||--o{ VACCINATION_APPOINTMENTS : scheduled_for
  AUTH_USERS o|--o{ VACCINATION_APPOINTMENTS : owns
  PROFILES o|--o{ VACCINATION_APPOINTMENTS : assigned_to
  AUTH_USERS o|--o{ VACCINATION_APPOINTMENTS : creates

  ANIMALS ||--o{ VACCINATION_ALERTS : triggers
  AUTH_USERS ||--o{ VACCINATION_ALERTS : receives
  AUTH_USERS o|--o{ NOTIFICATIONS : receives

  AUTH_USERS o|--o{ FEEDBACK : submits
  AUTH_USERS o|--o{ AUDIT_LOG : performs
  AUTH_USERS o|--o{ ACCOUNT_OTPS : requests
  AUTH_USERS o|--o{ STAFF_INVITES : redeems

  AUTH_USERS {
    uuid id PK
    text email
    json raw_user_meta_data
  }

  PROFILES {
    uuid id PK, FK
    text full_name
    enum role
    text username UK
    text contact_number
    text id_document_reference
    enum status
    boolean notify_sms
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
    enum species
    enum classification
    boolean neutered
    text breed
    integer age
    string sex
    boolean vaccinated
    date vaccine_date
    date next_due_date
    text vaccine_type
    text pound_status
    numeric latitude
    numeric longitude
    text[] image_references
  }

  VACCINATION_HISTORY {
    bigint id PK
    bigint animal_id FK
    uuid recorded_by FK
    date vaccine_date
    date next_due_date
    text vaccine_type
  }

  APPOINTMENTS {
    bigint id PK
    bigint animal_id FK
    uuid assigned_to FK
    date scheduled_date
    text status
  }

  VACCINATION_APPOINTMENTS {
    bigint id PK
    bigint animal_id FK
    uuid owner_id FK
    uuid assigned_staff_id FK
    uuid created_by FK
    timestamptz appointment_at
    text vaccine_type
    text location
    text status
  }

  VACCINATION_ALERTS {
    bigint id PK
    bigint animal_id FK
    uuid user_id FK
    date due_date
    text channel
    text reminder_type
    text status
    text recipient
  }

  NOTIFICATIONS {
    bigint id PK
    uuid user_id FK
    text title
    text type
    boolean is_read
    text dedupe_key UK
  }

  FEEDBACK {
    bigint id PK
    uuid user_id FK
    text category
    text message
    text status
  }

  AUDIT_LOG {
    bigint id PK
    uuid user_id FK
    text action
    text table_name
    bigint record_id
  }

  STAFF_INVITES {
    bigint id PK
    text token UK
    enum role
    uuid claim_id
    datetime expires_at
  }

  ACCOUNT_OTPS {
    bigint id PK
    uuid user_id FK
    text purpose
    text channel
    text code_hash
  }

  LOGIN_ATTEMPTS {
    bigint id PK
    text username
    text ip_address
    boolean success
  }

  MESSAGE_HISTORY {
    bigint id PK
    text channel
    text message_type
    text recipient_address
    text status
  }
```

## Front-end and Role Views

```mermaid
flowchart TB
  START[Sign in or registration]
  START --> WORKSPACE[Role-aware workspace]

  WORKSPACE --> OVERVIEW[Overview]
  WORKSPACE --> REGISTRY[Registry and animal profiles]
  WORKSPACE --> MAP[Coverage map]
  WORKSPACE --> REPORTS[Reports and exports]
  WORKSPACE --> FEEDBACK[Feedback]
  WORKSPACE --> SETTINGS[Profile and settings]

  WORKSPACE --> STAFF[Admin and BHW only]
  STAFF --> PLANNING[Planning]
  STAFF --> APPOINTMENTS[Appointments]
  STAFF --> RISK[Risk analysis]
  STAFF --> POUND[Pound and stray records]
  STAFF --> TEAM[Team and SMS]

  WORKSPACE --> ADMIN[Admin only]
  ADMIN --> AUDIT[Audit log]

  START --> HIDDEN[Hidden super-admin route]
  HIDDEN --> USERS[User accounts]
  HIDDEN --> PENDING[Verification and invites]
  HIDDEN --> ADMIN_FEEDBACK[Feedback management]
  HIDDEN --> ADMIN_MAP[Coverage map]
  HIDDEN --> SMS[Test and custom SMS]
```

## Storage and Security

```mermaid
flowchart LR
  PROFILE[Profile owner] --> IDDOC[Private id-documents bucket]
  OWNER[Animal owner] --> ANIMALIMG[Private animal-images bucket]
  STAFF[Admin or BHW] --> READ[Read through RLS or server actions]

  IDDOC --> RLSP[Owner and admin policies]
  ANIMALIMG --> RLSS[Owner and staff policies]
  READ --> DATABASE[(Supabase Postgres)]

  DATABASE --> RLS[Row Level Security]
  DATABASE --> AUDIT[Audit log]
```

## Objective 1 Monitoring

```mermaid
flowchart LR
  SESSION[Authenticated session] --> POLL[30-second browser refresh]
  SESSION --> FOCUS[Focus and visibility refresh]
  DB[(Supabase)] --> RECORDS[Animal records]
  DB --> COUNTS[Dashboard counts]
  DB --> NOTICE[Unread notifications]
  RECORDS --> STATUS[Vaccination status calculation]
  COUNTS --> DASHBOARD[Live dashboard]
  STATUS --> DASHBOARD
  NOTICE --> DASHBOARD
```

## Objective 2 Geospatial Coverage

```mermaid
flowchart LR
  ANIMALS[(Animals)] --> POSITION[Resolve coordinates or purok center]
  PUROKS[(Puroks)] --> POSITION
  POSITION --> MARKERS[Vaccination-status markers]
  MARKERS --> SEARCH[Search and filters]
  SEARCH --> HEAT[Heat density]
  SEARCH --> CLUSTERS[Zoom-aware clusters]
  SEARCH --> DETAIL[Animal detail popup]
```

## Objective 4 Appointments

```mermaid
sequenceDiagram
  participant Staff
  participant App as VacciTrack
  participant DB as Supabase
  participant Owner

  Staff->>App: Schedule appointment
  App->>DB: Insert vaccination appointment
  App->>Owner: Create in-app notification
  App->>DB: Record audit entry
  Staff->>App: Confirm or reschedule
  App->>DB: Update appointment status
  Staff->>App: Complete or cancel
  App->>DB: Update final status and audit entry
```

## Objective 5 Reports

```mermaid
flowchart LR
  ANIMALS[(Animals)] --> FILTER[Date and registry filters]
  HISTORY[(Vaccination history)] --> FILTER
  FILTER --> SUMMARY[Totals and coverage]
  FILTER --> BREAKDOWN[Breed, age, vaccine, and purok]
  FILTER --> POUND[Pound and status report]
  SUMMARY --> EXPORT[PDF, Word, Excel, or CSV export]
  BREAKDOWN --> EXPORT
  POUND --> EXPORT
```

## Implementation Note

`vaccination_appointments` is the detailed appointment workflow used by the current implementation. `appointments` remains in the schema for compatibility with the legacy appointment model. Animal breed and vaccine type are text fields rather than foreign keys to `breeds` and `vaccines`.
