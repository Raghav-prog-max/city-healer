# Security Specification: City Healer Healthcare Platform

## 1. Zero-Trust Data Invariants

Our healthcare ecosystem demands ironclad security constraints to guarantee patient privacy (PII protection), clinical record integrity (anti-forgery), and real-time operational safety (preventing bed inventory/emergency SOS tampering).

*   **User Profiles (`/users/{userId}`)**: Users must only read and write their own profile information. No one can spoof another user's identity or self-assign a higher privilege role (e.g., changing their role from `PATIENT` to `ADMIN` or `DOCTOR`).
*   **Hospitals (`/hospitals/{hospitalId}`)**: Facility details, coordinate pins, and total bed counts are system-controlled. Authenticated clients may read hospital statistics, but editing bed inventory, ambulance count, or emergency occupancy must require strict authentication/validation parameters (or administrative privileges).
*   **Doctors (`/doctors/{doctorId}`)**: Authenticated users can search practitioner profiles. Modifying clinician profiles or online/offline toggle statuses must be locked down to verified doctors or admin accounts.
*   **Appointments (`/appointments/{appointmentId}`)**: Booking records are private to the patient who registered them or the doctor conducting the visit. One patient must never view, intercept, or tamper with another patient's booking status.
*   **Queue Tokens (`/queue/{tokenId}`)**: OPD registration tokens are public/readable for live telemetry, but tokens can only be requested (created) by authenticated clients for their own IDs, and token states (`status`) can only be updated by the clinic or doctor.
*   **Medical Records (`/records/{recordId}`)**: Highly sensitive diagnostic histories. They can only be created by authenticated patients (uploading reports) or consulting doctors, and are private—only accessible to the owner (`patientId` matches `auth.uid`) or authorized doctors. Blanket reading of medical records is strictly forbidden.
*   **Prescriptions (`/prescriptions/{prescriptionId}`)**: Prescriptions can only be created by authenticated doctors or integrated medical providers. Patients may read prescriptions addressed to them but can never edit or create them.
*   **Medicine Catalog (`/medicines/{medicineId}`)**: Read-only directory of pharmacy products for the general public. Modifying prices or inventory levels must be restricted to administrators or authorized logistics roles.
*   **Medicine Orders (`/medicineOrders/{orderId}`)**: Orders containing addresses and personal drug choices are private to the patient who placed them. Order creation must validate that the `patientId` matches `auth.uid` and that the total amount is correct.
*   **Emergency Alerts (`/emergencyAlerts/{alertId}`)**: SOS alarms are critical life-saving pipelines. Anyone can trigger an SOS (write access with coordinate parameters), but once written, only dispatch services or responding ambulances/hospitals can update the response status (`status`). Patients may read their own active SOS records, but general public reads are completely blocked.
*   **Active Chats (`/activeChats/{appointmentId}`)**: Consultation chats are strictly private. Only the patient booking the consultation or the doctor assigned to the appointment can read or write chat messages.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent specific attacks attempting to breach platform authentication, spoof administrative records, leak private PII, or trigger malicious state transitions.

### Payload 1: Privilege Escalation (User Spoofing)
*   **Target**: `/users/attacker-uid`
*   **Intended Abuse**: Attacker registers or updates their own profile with `role: "ADMIN"` or `role: "DOCTOR"` to gain system-wide privileges.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 2: Hostile Takeover of Clinic Coordinates
*   **Target**: `/hospitals/hosp-1`
*   **Intended Abuse**: Attacker tries to modify the coordinate location (`lat`/`lng`) or phone number of Apollo Hospital to route emergency traffic elsewhere.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 3: Hospital Bed Spoofing
*   **Target**: `/hospitals/hosp-2`
*   **Intended Abuse**: Unauthorized user attempts to change `availableBeds` or `icuAvailable` to zero to simulate a panic/shortage.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 4: Doctor Impersonation Toggles
*   **Target**: `/doctors/doc-2`
*   **Intended Abuse**: Competitor or malicious patient tries to force Dr. Naresh Trehan to `online: false` or change his `waitTimeMin` to 500 minutes.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 5: Booking Snooping (Eavesdropping Attack)
*   **Target**: `/appointments/app-101` (Owned by Raghav)
*   **Intended Abuse**: Authenticated user (Attacker Bob) attempts to read Raghav's private virtual consultation booking details.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 6: Appointment Hijack & Status Shortcutting
*   **Target**: `/appointments/app-101`
*   **Intended Abuse**: Patient attempts to forcefully update their appointment status from `PENDING` to `ACCEPTED` or bypass the doctor's decision.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 7: Diagnostic Report Theft (PII Leak)
*   **Target**: `/records/rec-1` (Patient Raghav's ECG Scan)
*   **Intended Abuse**: Client with no relational ownership attempts to fetch or download Raghav's private clinical summary.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 8: Prescription Forgery
*   **Target**: `/prescriptions/rx-fake-1`
*   **Intended Abuse**: Patient attempts to forge a prescription containing controlled substances and write it with their own patient ID as issuer.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 9: Pharmacy Inventory Vandalism
*   **Target**: `/medicines/med-1`
*   **Intended Abuse**: Standard user attempts to change the price of Crocin from 35.0 to 0.1 INR or deplete `stock` to zero.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 10: Medicine Order Snoop
*   **Target**: `/medicineOrders/ord-9999` (Belongs to Alice)
*   **Intended Abuse**: Attacker tries to list/read Alice's medicine home delivery details, including her address and custom drugs.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 11: Emergency Alarm Vandalism
*   **Target**: `/emergencyAlerts/sos-1` (Active cardiac arrest dispatch)
*   **Intended Abuse**: Malicious user attempts to write a fake update changing `status` to `RESOLVED` to recall an active ambulance.
*   **Expected Result**: `PERMISSION_DENIED`

### Payload 12: Private Consultation Chat Eavesdropping
*   **Target**: `/activeChats/app-101`
*   **Intended Abuse**: An unassigned patient tries to read the live chat transcript between Raghav and Dr. Sharma.
*   **Expected Result**: `PERMISSION_DENIED`

---

## 3. Security Rules Verification Plan

A suite of verification assertions will be evaluated against our rules:
1.  **Read user context verification**: All read/writes must be authorized based on verified, non-null auth IDs.
2.  **Strict schema checks**: Write operations must match validation shapes and character size limits.
3.  **Owner ID checks**: Relational attributes must be verified against `request.auth.uid`.
4.  **Immutability enforcement**: Essential system properties like `createdAt` and `id` must be immutable once created.
