import sqlite3 from "sqlite3";
import path from "path";
import { 
  hospitals as seedHospitals, 
  doctors as seedDoctors, 
  medicineProducts as seedMedicines,
  appointments as seedAppointments,
  queueTokens as seedQueueTokens,
  medicalRecords as seedMedicalRecords
} from "./seedData";

const dbPath = path.resolve(process.cwd(), "city_healer.db");

// Connect to SQLite Database
export const sqliteDb = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("[SQLite] Error connecting to database:", err.message);
  } else {
    console.log("[SQLite] Connected to local SQLite database at:", dbPath);
  }
});

// Promisified DB execution functions
export function dbRun(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function dbGet<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    sqliteDb.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  });
}

export function dbAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve((rows as T[]) || []);
    });
  });
}

export function dbExec(sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sqliteDb.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Initialize tables and seed baseline metrics
export async function initializeDatabase() {
  console.log("[SQLite] Initializing database schema...");

  try {
    // 1. Users
    await dbExec(`
      CREATE TABLE IF NOT EXISTS users (
        uid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT,
        phone TEXT,
        role TEXT DEFAULT 'PATIENT',
        age INTEGER DEFAULT 34,
        gender TEXT DEFAULT 'Male',
        bloodGroup TEXT DEFAULT 'O+',
        policyNo TEXT,
        createdAt TEXT,
        updatedAt TEXT
      )
    `);

    // 2. Hospitals
    await dbExec(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        totalBeds INTEGER DEFAULT 0,
        availableBeds INTEGER DEFAULT 0,
        icuBeds INTEGER DEFAULT 0,
        icuAvailable INTEGER DEFAULT 0,
        emergencyOccupancy REAL DEFAULT 0,
        lat REAL DEFAULT 0,
        lng REAL DEFAULT 0,
        phone TEXT,
        rating REAL DEFAULT 0,
        specialties TEXT, -- JSON array
        categories TEXT, -- JSON array
        hasAmbulanceSupport INTEGER DEFAULT 1,
        ambulanceSupportCount INTEGER DEFAULT 0,
        isGovernment INTEGER DEFAULT 0,
        hasTelemedicine INTEGER DEFAULT 1,
        hasOpdBooking INTEGER DEFAULT 1,
        email TEXT,
        doctorsAvailableCount INTEGER DEFAULT 0
      )
    `);

    // 3. Doctors
    await dbExec(`
      CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        specialty TEXT NOT NULL,
        rating REAL DEFAULT 0,
        experience INTEGER DEFAULT 0,
        patientsServed INTEGER DEFAULT 0,
        online INTEGER DEFAULT 0,
        queueCount INTEGER DEFAULT 0,
        hospitalName TEXT,
        waitTimeMin INTEGER DEFAULT 0,
        imageUrl TEXT
      )
    `);

    // 4. Appointments
    await dbExec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        patientName TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT,
        specialty TEXT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        status TEXT DEFAULT 'PENDING',
        symptoms TEXT,
        type TEXT DEFAULT 'VIRTUAL',
        prescriptionJson TEXT -- JSON object
      )
    `);

    // 5. Outpatient Queue Tokens
    await dbExec(`
      CREATE TABLE IF NOT EXISTS queue_tokens (
        id TEXT PRIMARY KEY,
        tokenNumber TEXT NOT NULL,
        patientId TEXT,
        patientName TEXT,
        doctorId TEXT NOT NULL,
        doctorName TEXT,
        estimatedWaitTimeMin INTEGER DEFAULT 0,
        status TEXT DEFAULT 'WAITING',
        checkpointTime TEXT
      )
    `);

    // 6. Medical Records
    await dbExec(`
      CREATE TABLE IF NOT EXISTS medical_records (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        date TEXT NOT NULL,
        title TEXT NOT NULL,
        doctorName TEXT,
        diagnoseSummary TEXT,
        attachmentName TEXT
      )
    `);

    // 7. Medicines
    await dbExec(`
      CREATE TABLE IF NOT EXISTS medicines (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        description TEXT,
        requiresPrescription INTEGER DEFAULT 0,
        dosageForm TEXT,
        imageUrl TEXT,
        pillsColor TEXT,
        pillsShape TEXT,
        pillsMarkings TEXT
      )
    `);

    // 8. Medicine Orders
    await dbExec(`
      CREATE TABLE IF NOT EXISTS medicine_orders (
        id TEXT PRIMARY KEY,
        patientId TEXT NOT NULL,
        patientName TEXT,
        itemsJson TEXT NOT NULL, -- JSON array
        totalAmount REAL NOT NULL,
        status TEXT DEFAULT 'PENDING',
        prescriptionAttached INTEGER DEFAULT 0,
        prescriptionName TEXT,
        deliveryAddress TEXT,
        createdAt TEXT
      )
    `);

    // 9. Emergency Alerts
    await dbExec(`
      CREATE TABLE IF NOT EXISTS emergency_alerts (
        id TEXT PRIMARY KEY,
        patientId TEXT,
        patientName TEXT,
        patientPhone TEXT NOT NULL,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        address TEXT,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'REPORTED',
        timestamp TEXT NOT NULL,
        assignedAmbulanceRef TEXT,
        hospitalName TEXT
      )
    `);

    // 10. Chat Messages
    await dbExec(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        appointmentId TEXT NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);

    console.log("[SQLite] Schema verified. Checking for seed data...");

    // Seed Hospitals if empty
    const hospCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM hospitals");
    if (hospCount && hospCount.count === 0) {
      console.log("[SQLite Seeding] Seeding hospitals...");
      await dbExec("BEGIN TRANSACTION");
      for (const h of seedHospitals) {
        await dbRun(`
          INSERT INTO hospitals (
            id, name, address, totalBeds, availableBeds, icuBeds, icuAvailable, 
            emergencyOccupancy, lat, lng, phone, rating, specialties, categories, 
            hasAmbulanceSupport, ambulanceSupportCount, isGovernment, hasTelemedicine, 
            hasOpdBooking, email, doctorsAvailableCount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          h.id, h.name, h.address, h.totalBeds, h.availableBeds, h.icuBeds, h.icuAvailable,
          h.emergencyOccupancy, h.lat, h.lng, h.phone, h.rating, 
          JSON.stringify(h.specialties), JSON.stringify(h.categories),
          h.hasAmbulanceSupport ? 1 : 0, h.ambulanceSupportCount, h.isGovernment ? 1 : 0,
          h.hasTelemedicine ? 1 : 0, h.hasOpdBooking ? 1 : 0, h.email, h.doctorsAvailableCount
        ]);
      }
      await dbExec("COMMIT");
      console.log(`[SQLite Seeding] Seeded ${seedHospitals.length} hospitals.`);
    }

    // Seed Doctors if empty
    const docCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM doctors");
    if (docCount && docCount.count === 0) {
      console.log("[SQLite Seeding] Seeding doctors...");
      await dbExec("BEGIN TRANSACTION");
      for (const d of seedDoctors) {
        await dbRun(`
          INSERT INTO doctors (
            id, name, specialty, rating, experience, patientsServed, 
            online, queueCount, hospitalName, waitTimeMin, imageUrl
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          d.id, d.name, d.specialty, d.rating, d.experience, d.patientsServed,
          d.online ? 1 : 0, d.queueCount, d.hospitalName, d.waitTimeMin, d.imageUrl
        ]);
      }
      await dbExec("COMMIT");
      console.log(`[SQLite Seeding] Seeded ${seedDoctors.length} doctors.`);
    }

    // Seed Medicines if empty
    const medCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM medicines");
    if (medCount && medCount.count === 0) {
      console.log("[SQLite Seeding] Seeding medicines...");
      await dbExec("BEGIN TRANSACTION");
      for (const m of seedMedicines) {
        await dbRun(`
          INSERT INTO medicines (
            id, name, category, price, stock, description, 
            requiresPrescription, dosageForm, imageUrl, pillsColor, pillsShape, pillsMarkings
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          m.id, m.name, m.category, m.price, m.stock, m.description,
          m.requiresPrescription ? 1 : 0, m.dosageForm, m.imageUrl, m.pillsColor, m.pillsShape, m.pillsMarkings
        ]);
      }
      await dbExec("COMMIT");
      console.log(`[SQLite Seeding] Seeded ${seedMedicines.length} medicines.`);
    }

    // Seed default appointments for baseline display if empty
    const apptCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM appointments");
    if (apptCount && apptCount.count === 0 && seedAppointments && seedAppointments.length > 0) {
      console.log("[SQLite Seeding] Seeding appointments...");
      await dbExec("BEGIN TRANSACTION");
      for (const a of seedAppointments) {
        await dbRun(`
          INSERT INTO appointments (
            id, patientId, patientName, doctorId, doctorName, specialty, 
            date, time, status, symptoms, type, prescriptionJson
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          a.id, a.patientId, a.patientName, a.doctorId, a.doctorName, a.specialty,
          a.date, a.time, a.status, a.symptoms, a.type, a.prescriptionJson ? JSON.stringify(a.prescriptionJson) : null
        ]);
      }
      await dbExec("COMMIT");
      console.log(`[SQLite Seeding] Seeded ${seedAppointments.length} appointments.`);
    }

    // Seed default queue tokens if empty
    const qCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM queue_tokens");
    if (qCount && qCount.count === 0 && seedQueueTokens && seedQueueTokens.length > 0) {
      console.log("[SQLite Seeding] Seeding queue tokens...");
      await dbExec("BEGIN TRANSACTION");
      for (const q of seedQueueTokens) {
        await dbRun(`
          INSERT INTO queue_tokens (
            id, tokenNumber, patientId, patientName, doctorId, doctorName, 
            estimatedWaitTimeMin, status, checkpointTime
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          q.id, q.tokenNumber, q.patientId, q.patientName, q.doctorId, q.doctorName,
          q.estimatedWaitTimeMin, q.status, q.checkpointTime
        ]);
      }
      await dbExec("COMMIT");
      console.log(`[SQLite Seeding] Seeded ${seedQueueTokens.length} queue tokens.`);
    }

    // Seed medical records if empty
    const recsCount = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM medical_records");
    if (recsCount && recsCount.count === 0 && seedMedicalRecords && seedMedicalRecords.length > 0) {
      console.log("[SQLite Seeding] Seeding medical records...");
      await dbExec("BEGIN TRANSACTION");
      for (const r of seedMedicalRecords) {
        await dbRun(`
          INSERT INTO medical_records (
            id, patientId, date, title, doctorName, diagnoseSummary, attachmentName
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          r.id, r.patientId, r.date, r.title, r.doctorName, r.diagnoseSummary, r.attachmentName
        ]);
      }
      await dbExec("COMMIT");
      console.log(`[SQLite Seeding] Seeded ${seedMedicalRecords.length} medical records.`);
    }

    console.log("[SQLite] Database initialization completed successfully.");
  } catch (err: any) {
    console.error("[SQLite Error] Initialization failed:", err);
    throw err;
  }
}
