import { useState, useEffect, Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Search, Plus, Sparkles, Bell, ChevronDown, LayoutGrid, Users,
  ClipboardList, UserCog, FlaskConical, ScanLine, Pill as PillIcon, Scissors, HeartPulse,
  Ambulance, Receipt, Boxes, FileText, Map, Building2, Package, CheckSquare,
  MessageSquare, TriangleAlert, BedDouble, LogOut, IndianRupee, MoreHorizontal,
  Share2, ExternalLink, Send, Maximize2, Activity, ShieldAlert,
  FileWarning, ArrowUpRight, Stethoscope, Download, Filter, Eye, Mic, Folder, Calendar,
  Settings, Phone, Pencil, RefreshCw, Clock, ChevronRight,
  TestTubes, Droplet, Beaker, FileCheck, XCircle,
  Brain, Bone, Waves, ZoomIn, Move, Contrast, SlidersHorizontal, Ruler, Triangle,
  RotateCcw, Film, Copy, SunMedium, Bold, Italic, Underline, List, ListOrdered,
  AlignLeft, AlignCenter, Save, PenLine, Columns3, Wind,
  TrendingUp, Truck, Star, CreditCard, Wallet, Landmark,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useOsOverview, useOsBilling, useOsInventory, useOsSurgery, useOsPatients, useOsPatient } from "./osApi";
import type { OsPatient } from "./osApi";
import { getOsSession, clearOsSession, osInitials, fetchOsMe } from "./osSession";

/* ------------------------------------------------------------------ data --- */

const STATUS = [
  { label: "Hospital Status", value: "Operational", dot: "#16a34a" },
  { label: "Occupancy", value: "72%", trend: true },
  { label: "ER Wait Time", value: "24 min", trend: true },
  { label: "ICU Occupancy", value: "87%", trend: true },
  { label: "Beds Available", value: "18" },
];

const NAV_WORKSPACE = [
  { label: "Command Center", icon: LayoutGrid, active: true },
  { label: "Patients", icon: Users },
  { label: "Admissions", icon: ClipboardList },
  { label: "Care Team", icon: UserCog },
  { label: "Labs", icon: FlaskConical },
  { label: "Radiology", icon: ScanLine },
  { label: "Pharmacy", icon: PillIcon },
  { label: "Surgery / OT", icon: Scissors },
  { label: "ICU", icon: HeartPulse },
  { label: "Emergency", icon: Ambulance },
  { label: "Billing", icon: Receipt },
  { label: "Inventory", icon: Boxes },
  { label: "Reports", icon: FileText },
];
const NAV_TWIN = [
  { label: "Hospital Map", icon: Map },
  { label: "Departments", icon: Building2 },
  { label: "Assets", icon: Package },
];
const NAV_SYSTEM = [
  { label: "Alerts", icon: ShieldAlert, badge: 8 },
  { label: "Tasks", icon: CheckSquare, badge: 14 },
  { label: "Messages", icon: MessageSquare, badge: 6 },
  { label: "Settings", icon: Settings },
];

const KPIS = [
  { value: "3", label: "Critical Labs", action: "View All", icon: TriangleAlert, color: "#D13438" },
  { value: "18", label: "Beds Available", action: "View Occupancy", icon: BedDouble, color: "#107C10" },
  { value: "42", label: "Prescriptions Pending", action: "Review", icon: PillIcon, color: "#CA5010" },
  { value: "24", label: "ER Patients", action: "View Queue", icon: Ambulance, color: "#0078d4" },
  { value: "12", label: "Discharges Today", action: "View List", icon: LogOut, color: "#038387" },
  { value: "\u20B9 8.6M", label: "Today's Revenue", action: "View Analytics", icon: IndianRupee, color: "#8764B8" },
];

const IDENTITY = [
  { label: "Blood Group", value: "B+" },
  { label: "Allergies", value: "Penicillin *" },
  { label: "Insurance", value: "Jubilee Health" },
  { label: "Location", value: "ICU-07" },
];

const PATIENT_TABS = ["Overview", "Timeline", "Vitals", "Labs", "Imaging", "Medications", "Procedures", "Documents", "Care Plan", "Encounters", "Notes"];

const TIMELINE = [
  { date: "May 10", year: "2024", kind: "Admission", time: "09:30 AM", dept: "Cardiology", detail: "Chief Complaint: Chest pain since 2 hours", sub: "Attending: Dr. Ahmed Ali", status: "Completed", tone: "#16a34a" },
  { date: "May 10", kind: "Labs", time: "11:20 AM", dept: "Lab", detail: "Troponin I: 1.52 ng/mL (High)", sub: "CK-MB: 24 U/L (High)", status: "Abnormal", tone: "#D13438" },
  { date: "May 11", kind: "Procedure", time: "02:45 PM", dept: "Cath Lab", detail: "Coronary Angiography", sub: "Findings: 90% blockage in LAD", status: "Completed", tone: "#16a34a" },
  { date: "May 12", kind: "Transfer", time: "08:10 AM", dept: "ICU", detail: "Transferred to ICU-07", sub: "Reason: Post Procedure Monitoring", status: "Completed", tone: "#16a34a" },
  { date: "May 13", kind: "Discharge", time: "04:30 PM", dept: "Cardiology", detail: "Condition: Stable", sub: "Follow up on: 20 May 2024", status: "Planned", tone: "#0078d4" },
];

const PROBLEMS = ["NSTEMI", "Type 2 Diabetes Mellitus", "Hypertension", "Hyperlipidemia"];
const VITALS = [
  { label: "BP", value: "128/80 mmHg" },
  { label: "HR", value: "76 bpm" },
  { label: "SpO2", value: "99 %" },
  { label: "Temp", value: "98.6 \u00B0F" },
  { label: "RR", value: "18 /min" },
];
const MEDS = [
  { name: "Aspirin", dose: "75 mg", freq: "OD" },
  { name: "Clopidogrel", dose: "75 mg", freq: "OD" },
  { name: "Atorvastatin", dose: "40 mg", freq: "HS" },
  { name: "Metoprolol", dose: "25 mg", freq: "BD" },
];

const TASKS = [
  { label: "Review 3 Critical Labs", tag: "ICU", time: "18 min ago" },
  { label: "Sign 4 Pending Orders", tag: "OPD", time: "25 min ago" },
  { label: "Discharge Summary \u2013 Ahmed Khan", tag: "ICU-07", time: "35 min ago" },
  { label: "Follow up: 2 Patients", tag: "OPD", time: "1 hour ago" },
];

const ACTIVITY = [
  { who: "Dr. Sara Malik", what: "added a note for Ahmed Khan", time: "2 min ago", icon: FileText },
  { who: "Lab result", what: "(Troponin I) is Abnormal", time: "5 min ago", icon: FlaskConical },
  { who: "Nurse Aysha", what: "updated vitals for Bed ICU-07", time: "10 min ago", icon: Activity },
  { who: "Prescription", what: "issued by Dr. Ahmed Ali", time: "15 min ago", icon: PillIcon },
  { who: "Payment received", what: "from Patient Zara Ali", time: "20 min ago", icon: IndianRupee },
];

const INSIGHTS = [
  { title: "High Troponin", body: "Troponin levels are elevated. Monitor and review ECG.", time: "5 min ago", icon: TriangleAlert, tone: "#D13438" },
  { title: "Drug Interaction", body: "Clopidogrel may interact with Omeprazole.", time: "15 min ago", icon: FileWarning, tone: "#CA5010" },
  { title: "Risk Alert", body: "Readmission risk is Moderate. Ensure follow up.", time: "30 min ago", icon: ShieldAlert, tone: "#8764B8" },
];
const ACTIONS = [
  { label: "Review ECG", cta: "Open" },
  { label: "Repeat Troponin in 6 hours", cta: "Order" },
  { label: "Echocardiogram", cta: "Schedule" },
  { label: "Monitor BP closely", cta: "Add Note" },
];
const QUICK_ASK = ["Summarize this patient", "Why is troponin high?", "Show latest ECG", "What are the discharge criteria?"];

/* --- Patient 360 tab data (Ahmed Khan · NSTEMI) --- */

const VITAL_CARDS = [
  { label: "Blood Pressure", value: "128/80", unit: "mmHg", color: "#0078d4" },
  { label: "Heart Rate", value: "76", unit: "bpm", color: "#16a34a" },
  { label: "SpO2", value: "98", unit: "%", color: "#0891b2" },
  { label: "Temperature", value: "98.6", unit: "°F", color: "#CA5010" },
  { label: "Respiratory Rate", value: "18", unit: "/min", color: "#8764B8" },
];
const VITALS_TABLE = [
  { t: "13 May 2024, 10:15 AM", bp: "128/80", hr: "76", spo2: "98", temp: "98.6", rr: "18", src: "Monitor" },
  { t: "13 May 2024, 06:00 AM", bp: "132/84", hr: "82", spo2: "97", temp: "98.8", rr: "20", src: "Monitor", flag: true },
  { t: "12 May 2024, 10:15 AM", bp: "126/78", hr: "74", spo2: "98", temp: "98.4", rr: "18", src: "Monitor" },
  { t: "12 May 2024, 04:15 AM", bp: "140/90", hr: "88", spo2: "95", temp: "99.1", rr: "22", src: "Monitor", flag: true },
  { t: "11 May 2024, 10:15 AM", bp: "130/82", hr: "78", spo2: "98", temp: "98.6", rr: "18", src: "Manual" },
];

const LAB_STATUS_TONE = { Low: "#0891b2", High: "#D13438", Normal: "#16a34a" };
const LAB_GROUPS = [
  { group: "CBC (Complete Blood Count)", rows: [
    { test: "Hemoglobin", result: "10.2", unit: "g/dL", range: "13.5 – 17.5", status: "Low" },
    { test: "WBC Count", result: "12.5", unit: "×10⁹/L", range: "4.0 – 10.0", status: "High" },
    { test: "Platelet Count", result: "180", unit: "×10⁹/L", range: "150 – 400", status: "Normal" },
  ] },
  { group: "LFT (Liver Function Test)", rows: [
    { test: "ALT (SGPT)", result: "78", unit: "U/L", range: "7 – 56", status: "High" },
    { test: "AST (SGOT)", result: "62", unit: "U/L", range: "10 – 40", status: "High" },
    { test: "Total Bilirubin", result: "1.3", unit: "mg/dL", range: "0.3 – 1.2", status: "High" },
  ] },
  { group: "RFT (Renal Function Test)", rows: [
    { test: "Creatinine", result: "1.6", unit: "mg/dL", range: "0.7 – 1.3", status: "High" },
    { test: "BUN", result: "24", unit: "mg/dL", range: "7 – 20", status: "High" },
    { test: "eGFR", result: "52", unit: "mL/min/1.73m²", range: "≥ 90", status: "Low" },
  ] },
  { group: "Cardiac Markers", rows: [
    { test: "Troponin I", result: "1.52", unit: "ng/mL", range: "< 0.04", status: "High" },
    { test: "CK-MB", result: "24", unit: "U/L", range: "< 25", status: "Normal" },
  ] },
];

const IMAGING_STUDIES = [
  { name: "Chest X-Ray PA View", date: "13 May 2024, 08:30 AM", finding: "Normal", report: "Clear lung fields. Normal cardiac silhouette. No acute cardiopulmonary abnormality." },
  { name: "CT Brain (Plain)", date: "11 May 2024, 03:10 PM", finding: "Normal", report: "No intracranial hemorrhage, mass effect or midline shift. Age-appropriate involutional changes." },
  { name: "Coronary Angiography", date: "10 May 2024, 03:20 PM", finding: "Abnormal", active: true, report: "90% blockage in LAD (Left Anterior Descending Artery). Recommendation: Consider revascularization." },
  { name: "12 Lead ECG", date: "10 May 2024, 09:05 AM", finding: "Abnormal", report: "ST-segment depression in leads V4\u2013V6 suggestive of myocardial ischemia. No new ST-elevation." },
  { name: "Chest X-Ray", date: "09 May 2024, 11:40 AM", finding: "Normal", report: "No focal consolidation, effusion or pneumothorax. Unremarkable study." },
  { name: "MRI Brain", date: "09 May 2024, 02:10 PM", finding: "Normal", report: "No acute infarct or restricted diffusion. Normal study." },
  { name: "USG Abdomen", date: "08 May 2024, 09:00 AM", finding: "Normal", report: "Normal hepatobiliary system and kidneys. No free fluid. Unremarkable." },
  { name: "CT Chest (HRCT)", date: "07 May 2024, 04:00 PM", finding: "Abnormal", report: "Mild bibasilar atelectasis. No consolidation or pulmonary embolism." },
];

const MEDS_ACTIVE = [
  { name: "Aspirin", dose: "75 mg", freq: "Once Daily", route: "Oral", by: "Dr. Ahmed Ali", start: "13 May 2024" },
  { name: "Clopidogrel", dose: "75 mg", freq: "Once Daily", route: "Oral", by: "Dr. Ahmed Ali", start: "13 May 2024" },
  { name: "Atorvastatin", dose: "80 mg", freq: "Once Daily (Night)", route: "Oral", by: "Dr. Ahmed Ali", start: "11 May 2024" },
  { name: "Metoprolol Succinate", dose: "25 mg", freq: "Once Daily", route: "Oral", by: "Dr. Ahmed Ali", start: "11 May 2024" },
  { name: "Pantoprazole", dose: "40 mg", freq: "Once Daily", route: "Oral", by: "Dr. Ahmed Ali", start: "11 May 2024" },
  { name: "Insulin Glargine", dose: "16 Units", freq: "At Bedtime", route: "Subcutaneous", by: "Dr. Ahmed Ali", start: "11 May 2024" },
];
const MEDS_HISTORY = [
  { name: "Insulin Lispro", detail: "5 Units · TDS before Meals · Subcutaneous · Prescribed by Dr. Ahmed Ali", when: "13 May 2024, 10:15 AM", discontinued: true },
  { name: "Furosemide", detail: "40 mg · Once Daily · Oral · Prescribed by Dr. Ahmed Ali", when: "13 May 2024, 09:15 AM", discontinued: true },
  { name: "Omeprazole", detail: "40 mg · Once Daily · Oral · Prescribed by Dr. Ahmed Ali", when: "10 May 2024, 11:00 AM" },
  { name: "Enoxaparin", detail: "40 mg · Once Daily · Subcutaneous · Prescribed by Dr. Ahmed Ali", when: "08 May 2024, 08:55 AM" },
  { name: "Nitroglycerin Infusion", detail: "10 mcg/min · Continuous · IV · Prescribed by Dr. Ahmed Ali", when: "08 May 2024, 10:00 AM", discontinued: true },
];

const PROC_DONE = [
  { date: "10 May 2024", name: "Coronary Angiography", type: "Surgical", by: "Dr. Ahmed Ali", note: "90% blockage in LAD. Stent placed in LAD.", status: "Successful", tone: "#16a34a" },
  { date: "09 May 2024", name: "Echocardiogram", type: "Diagnostic", by: "Dr. Sara Malik", note: "LVEF 45%, Mild LV dysfunction.", status: "Completed", tone: "#0078d4" },
  { date: "08 May 2024", name: "Central Line Insertion", type: "Procedure", by: "Dr. Imran Haider", note: "Right IJ line inserted for vasopressors.", status: "Completed", tone: "#0078d4" },
  { date: "07 May 2024", name: "Arterial Line Insertion", type: "Procedure", by: "Dr. Fatima Noor", note: "Left radial arterial line inserted.", status: "Completed", tone: "#0078d4" },
  { date: "06 May 2024", name: "Endotracheal Intubation", type: "Procedure", by: "Dr. Waseem Ahmed", note: "Intubated for respiratory support.", status: "Completed", tone: "#0078d4" },
];
const PROC_UPCOMING = [
  { date: "16 May 2024, 09:00 AM", name: "Percutaneous Coronary Intervention (PCI)", type: "Surgical", by: "Dr. Ahmed Ali", priority: "High", ptone: "#D13438" },
  { date: "18 May 2024, 11:00 AM", name: "Temporary Pacemaker Insertion", type: "Procedure", by: "Dr. Iman Haider", priority: "Medium", ptone: "#CA5010" },
];

const DOC_FOLDERS = [
  { name: "All Documents", count: 124 },
  { name: "Discharge Summaries", count: 28 },
  { name: "Consent Forms", count: 16 },
  { name: "Referral Letters", count: 12 },
  { name: "Insurance Documents", count: 22 },
  { name: "Lab Reports", count: 16 },
  { name: "Imaging Reports", count: 14 },
  { name: "Other Documents", count: 12 },
  { name: "Deleted Items", count: null },
];
const DOCS = [
  { name: "Discharge Summary – 12 May 2024.pdf", cat: "Discharge Summaries", on: "12 May 2024, 02:15 PM", by: "Dr. Ahmed Ali" },
  { name: "PD Consent Form.pdf", cat: "Consent Forms", on: "10 May 2024, 09:15 AM", by: "Dr. Sara Malik" },
  { name: "Referral Letter – Cardiology.docx", cat: "Referral Letters", on: "08 May 2024, 11:20 AM", by: "Dr. Imran Haider" },
  { name: "Insurance Pre-Auth Approval.pdf", cat: "Insurance Documents", on: "09 May 2024, 03:00 PM", by: "Admin User" },
  { name: "Echocardiogram Report.pdf", cat: "Imaging Reports", on: "09 May 2024, 09:15 AM", by: "Dr. Sara Malik" },
  { name: "ICU Progress Note – 10 May.docx", cat: "Other Documents", on: "10 May 2024, 08:30 PM", by: "Nurse Ayesha" },
];

const CP_SUMMARY = [
  { label: "Primary Diagnosis", value: "NSTEMI" },
  { label: "Care Plan Status", value: "Active" },
  { label: "Start Date", value: "10 May 2024" },
  { label: "Review Date", value: "17 May 2024" },
  { label: "Last Updated", value: "12 May 2024, 02:30 PM" },
];
const CP_GOALS = [
  { goal: "Improve cardiac function and stabilize vitals", target: "17 May 2024", pct: 75 },
  { goal: "Prevent complications and support recovery", target: "17 May 2024", pct: 60 },
  { goal: "Restore mobility and functional independence", target: "24 May 2024", pct: 40 },
];
const CP_TEAM = [
  { name: "Dr. Ahmed Ali", role: "Cardiologist", badge: "Lead" },
  { name: "Nurse Ayesha", role: "ICU Nurse", badge: "Primary" },
  { name: "Dr. Sara Malik", role: "Resident Doctor" },
  { name: "Zain Ali", role: "Physiotherapist" },
  { name: "Fatima Noor", role: "Clinical Pharmacist" },
];
const CP_TASKS = [
  { task: "Monitor vitals and hemodynamics", type: "Monitoring", freq: "Continuous", who: "Nurse Ayesha", start: "10 May", target: "17 May", pct: 90, status: "In Progress" },
  { task: "Administer dual antiplatelet therapy", type: "Medication", freq: "Daily", who: "Clinical Pharmacist", start: "10 May", target: "17 May", pct: 80, status: "In Progress" },
  { task: "Cardiac rehabilitation (Phase I)", type: "Therapy", freq: "Daily", who: "Zain Ali", start: "12 May", target: "24 May", pct: 60, status: "In Progress" },
  { task: "Diabetes management and control", type: "Management", freq: "Daily", who: "Dr. Sara Malik", start: "10 May", target: "24 May", pct: 30, status: "Pending" },
  { task: "Nutritional plan and counseling", type: "Education", freq: "Weekly", who: "Nurse Ayesha", start: "12 May", target: "24 May", pct: 0, status: "Pending" },
];

const ENCOUNTERS = [
  { date: "10 May 2024, 10:30 AM", type: "IPD Admission", dept: "Cardiology - ICU", by: "Dr. Ahmed Ali", note: "Admitted with chest pain. NSTEMI diagnosed. Started on antiplatelet and anticoagulant therapy.", tone: "#0078d4" },
  { date: "09 May 2024, 02:15 PM", type: "ER Visit", dept: "Emergency", by: "Dr. Imran Haider", note: "Presented with acute chest pain and diaphoresis. ECG showed ST depression.", tone: "#D13438" },
  { date: "05 May 2024, 11:00 AM", type: "OPD Visit", dept: "Cardiology OPD", by: "Dr. Ahmed Ali", note: "Complaints of exertional chest pain. Referred for angiography.", tone: "#16a34a" },
  { date: "01 May 2024, 05:30 PM", type: "Teleconsultation", dept: "Cardiology", by: "Dr. Sara Malik", note: "Follow-up teleconsultation. Symptoms persisted. Advised admission.", tone: "#8764B8" },
  { date: "03 May 2024, 09:00 AM", type: "OPD Visit", dept: "General Medicine", by: "Dr. Fatima Noor", note: "Routine check-up for diabetes and hypertension.", tone: "#16a34a" },
];

const NOTES_LIST = [
  { kind: "SOAP Note", dept: "Cardiology", when: "13 May 2024, 02:15 AM", by: "Dr. Ahmed Ali", excerpt: "Patient reports mild chest discomfort. No shortness of breath.", tone: "#0078d4", active: true, body: "" },
  { kind: "Progress Note", dept: "Cardiology", when: "12 May 2024, 06:30 PM", by: "Dr. Sara Malik", excerpt: "Hemodynamically stable. Troponin trending down.", tone: "#16a34a", body: "Hemodynamically stable overnight. Troponin trending down (1.52 \u2192 0.98 ng/mL). Continuing dual antiplatelet therapy. Vitals within acceptable limits. Plan: continue current management and reassess in the morning." },
  { kind: "Nursing Note", dept: "Nursing", when: "12 May 2024, 08:00 AM", by: "Nurse Ayesha", excerpt: "Patient alert and oriented. Assisted with oral intake.", tone: "#CA5010", body: "Patient alert and oriented \u00d73. Assisted with oral intake, tolerated well. Ambulated to chair with assistance. IV site clean and dry. Pain 2/10. Vitals stable and recorded." },
  { kind: "Consult Note", dept: "Endocrinology", when: "11 May 2024, 04:20 PM", by: "Dr. Zain Ali", excerpt: "Consult for glycemic evaluation. Recommends titration.", tone: "#8764B8", body: "Consulted for glycemic evaluation. HbA1c 8.4%. Recommend titration of insulin glargine and initiation of a structured diabetic diet. Follow-up in 1 week." },
  { kind: "Discharge Summary (Draft)", dept: "Cardiology", when: "13 May 2024, 09:00 AM", by: "Dr. Ahmed Ali", excerpt: "Draft discharge summary for initial admission.", tone: "#5B6472", body: "Draft discharge summary. Diagnosis: NSTEMI, managed with PCI and stent placement. Discharge medications as per chart. Advise cardiac rehabilitation and follow-up with cardiology in 1 week." },
];
const SOAP = [
  { k: "S", label: "Subjective", body: "Patient reports mild chest discomfort on exertion. Denies shortness of breath at rest. No palpitations or syncope." },
  { k: "O", label: "Objective", body: "BP: 128/80 mmHg, HR: 76 bpm, SpO2: 98% on room air, Temp 98.6°F. CVS: S1 S2 normal, no murmur. RS: Bilateral air entry equal, no added sounds. ECG: No acute ST-T changes." },
  { k: "A", label: "Assessment", body: "NSTEMI – stable. Hypertension – controlled. Type 2 Diabetes Mellitus. Dyslipidemia." },
  { k: "P", label: "Plan", body: "Continue dual antiplatelet therapy. Monitor vitals and cardiac enzymes. Optimize antihypertensive and statin therapy. Early mobilization and cardiac rehab referral." },
];

/* --- Patients view (rich Patient 360 overview) --- */

const CARE_TEAM_OV = [
  { name: "Dr. Ahmed Ali", role: "Cardiologist", badge: "Attending" },
  { name: "Nurse Ayesha", role: "Primary Nurse" },
  { name: "Dr. Sara Malik", role: "Consultant" },
  { name: "Dr. Imran Haider", role: "Interventional Cardiologist" },
];
const LATEST_LABS = [
  { test: "Troponin I", value: "1.52 ng/mL", status: "High" },
  { test: "CK-MB", value: "24 U/L", status: "High" },
  { test: "Creatinine", value: "1.1 mg/dL", status: "Normal" },
  { test: "K+ (Potassium)", value: "5.2 mmol/L", status: "High" },
  { test: "HbA1c", value: "8.3 %", status: "High" },
];
const RECENT_IMAGING = [
  { name: "Coronary Angiography", date: "10 May 2024, 02:15 PM", finding: "Abnormal" },
  { name: "Echo Cardiogram", date: "10 May 2024, 11:20 AM", finding: "Abnormal" },
  { name: "Chest X-Ray", date: "10 May 2024, 09:00 AM", finding: "Normal" },
  { name: "CT Chest (HRCT)", date: "07 May 2024, 06:00 PM", finding: "Abnormal" },
];
const MEDS_OV = [
  { name: "Aspirin", dose: "75 mg", freq: "OD", route: "Oral" },
  { name: "Clopidogrel", dose: "75 mg", freq: "OD", route: "Oral" },
  { name: "Atorvastatin", dose: "40 mg", freq: "HS", route: "Oral" },
  { name: "Metoprolol", dose: "25 mg", freq: "BD", route: "Oral" },
  { name: "Insulin Glargine", dose: "10 Units", freq: "HS", route: "SC" },
  { name: "Pantoprazole", dose: "40 mg", freq: "OD", route: "Oral" },
];
const PROBLEMS_OV = [
  { name: "NSTEMI", primary: true },
  { name: "Type 2 Diabetes Mellitus" },
  { name: "Hypertension" },
  { name: "Hyperlipidemia" },
  { name: "Obesity" },
];
const RECENT_ENC = [
  { date: "10 May 2024", time: "09:30 AM", kind: "Admission", tag: "ICU", detail: "Chest pain since 2 hours", icon: BedDouble, tone: "#0078d4" },
  { date: "10 May 2024", time: "11:20 AM", kind: "Lab Result", tag: "", detail: "Troponin I 1.52 ng/mL (High)", icon: FlaskConical, tone: "#D13438" },
  { date: "10 May 2024", time: "", kind: "Coronary Angiography", tag: "", detail: "90% blockage in LAD", icon: Activity, tone: "#8764B8" },
  { date: "11 May 2024", time: "08:10 AM", kind: "ICU Transfer", tag: "", detail: "Post procedure Monitoring", icon: ArrowUpRight, tone: "#0078d4" },
  { date: "12 May 2024", time: "", kind: "Medication Updated", tag: "", detail: "Dual antiplatelet therapy", icon: PillIcon, tone: "#CA5010" },
  { date: "13 May 2024", time: "10:30 AM", kind: "Discharge Plan", tag: "", detail: "Planned discharge on 15 May 2024", icon: LogOut, tone: "#16a34a" },
];
const ADMISSION_BAR = [
  { label: "Admission Type", value: "Emergency" },
  { label: "Admission Date", value: "10 May 2024 09:30 AM" },
  { label: "Current Location", value: "ICU-07, Bed-01" },
  { label: "Length of Stay", value: "3 Days 2 Hours" },
  { label: "Insurance", value: "Jubilee Health" },
  { label: "Policy No.", value: "JH-78654321" },
  { label: "Next Review", value: "14 May 2024" },
];
const VITAL_SHORT = ["BP", "HR", "SpO2", "Temp", "RR"];

/* --- Admissions view --- */

const ADM_KPIS = [
  { value: "24", label: "Admissions Today", sub: "↑ 12% vs yesterday", icon: Users, color: "#0078d4" },
  { value: "11", label: "Pending Admissions", sub: "Needs bed assignment", icon: ClipboardList, color: "#CA5010" },
  { value: "18", label: "Bed Availability", sub: "Across all floors", icon: BedDouble, color: "#107C10" },
  { value: "16", label: "Waiting Queue (ER)", sub: "Avg. wait time 28 min", icon: TriangleAlert, color: "#D13438" },
  { value: "12", label: "Discharges Today", sub: "↑ 5% vs yesterday", icon: LogOut, color: "#8764B8" },
];
const ADM_QUEUE = [
  { priority: "High", name: "Ahmed Khan", sex: "♂", age: "58 Y / Male", mrn: "CLN-00012345", source: "ER", reason: "Chest pain, NSTEMI", wait: "45 min", status: "Bed Pending" },
  { priority: "High", name: "Sara Noor", sex: "♀", age: "44 Y / Female", mrn: "CLN-00012346", source: "ER", reason: "Severe Breathlessness", wait: "32 min", status: "Triage" },
  { priority: "Medium", name: "Imran Ali", sex: "♂", age: "63 Y / Male", mrn: "CLN-00012347", source: "Ref.", reason: "Uncontrolled Diabetes", wait: "25 min", status: "Registration" },
  { priority: "Medium", name: "Fatima Zahra", sex: "♀", age: "37 Y / Female", mrn: "CLN-00012348", source: "OPD", reason: "Abdominal Pain", wait: "18 min", status: "Bed Pending" },
  { priority: "Low", name: "Bilal Ahmed", sex: "♂", age: "29 Y / Male", mrn: "CLN-00012349", source: "ER", reason: "Fever, Viral Infection", wait: "10 min", status: "Triage" },
];
const REG_FIELDS = [
  { label: "Full Name", value: "Ahmed Khan" },
  { label: "Date of Birth", value: "12 May 1966" },
  { label: "Gender", value: "Male" },
  { label: "Phone", value: "0300-1234567" },
  { label: "CNIC / National ID", value: "42201-1234567-1" },
  { label: "Address", value: "House 45, Street 12, F-8/2, Islamabad", full: true },
  { label: "Emergency Contact", value: "Ali Khan (Brother)" },
  { label: "", value: "0300-7654321" },
];
const INSURANCE = [
  { label: "Provider", value: "Jubilee Health Insurance" },
  { label: "Policy No.", value: "JH-78654321" },
  { label: "Plan Type", value: "Health Plus" },
  { label: "Expiry", value: "31 Dec 2025" },
];
const BED_SUGGEST = [
  { bed: "ICU-07", loc: "ICU - Floor 3", status: "Available", sex: "Male" },
  { bed: "ICU-09", loc: "ICU - Floor 3", status: "Available", sex: "Male" },
  { bed: "HDU-04", loc: "HDU - Floor 2", status: "Available", sex: "Male" },
];
const TRIAGE_STATUS = [
  { label: "Red (Critical)", count: 2, sub: "Immediate attention", tone: "#D13438" },
  { label: "Yellow (High)", count: 5, sub: "Within 30 min", tone: "#CA8A04" },
  { label: "Green (Stable)", count: 7, sub: "Within 120 min", tone: "#16a34a" },
  { label: "Blue (Low)", count: 2, sub: "Non-urgent", tone: "#0078d4" },
];
const CHECKLIST = [
  { label: "Patient Registration", time: "09:10 AM", done: true },
  { label: "Insurance Verification", time: "09:12 AM", done: true },
  { label: "Initial Assessment", time: "09:15 AM", done: true },
  { label: "Consent Form", time: "09:18 AM", done: true },
  { label: "Bed Assignment", time: "", done: false },
  { label: "Admission Orders", time: "", done: false },
  { label: "Welcome Kit Provided", time: "", done: false },
];
const ADM_TIMELINE = [
  { time: "09:05 AM", kind: "Registered", by: "ER Reception", done: true },
  { time: "09:10 AM", kind: "Triage", by: "Dr. Sara Malik", done: true },
  { time: "09:15 AM", kind: "Assessment", by: "Dr. Ahmed Ali", done: true },
  { time: "09:18 AM", kind: "Insurance Verified", by: "System", done: true },
  { time: "09:22 AM", kind: "Bed Assigned", by: "ICU-07", done: true },
  { time: "", kind: "Pending", by: "Admission Orders", done: false },
];
const TRANSFERS = [
  { name: "Fatima Zahra", from: "Ward B-12", to: "ICU-07", reason: "Clinical Deterioration", on: "10 May 09:25 AM", status: "Pending", tone: "#CA5010" },
  { name: "Kashif Ali", from: "HDU-02", to: "Ward A-08", reason: "Step Down", on: "10 May 08:40 AM", status: "Approved", tone: "#16a34a" },
];
const ADM_INSIGHTS = [
  { title: "High Troponin Cases", body: "5 patients admitted. Monitor and review ECGs.", time: "5 min ago", icon: TriangleAlert, tone: "#D13438" },
  { title: "Bed Demand Alert", body: "ICU occupancy is 87%. Consider step-down planning.", time: "12 min ago", icon: BedDouble, tone: "#CA5010" },
  { title: "Discharge Delays", body: "4 patients delayed >24h. Review and take action.", time: "18 min ago", icon: Clock, tone: "#CA8A04" },
];
const ADM_ACTIONS = [
  { label: "Assign Bed for Ahmed Khan", cta: "Open" },
  { label: "Generate Admission Orders", cta: "Create" },
  { label: "Review Consent Form", cta: "Open" },
  { label: "Notify Care Team", cta: "Send" },
];
const ADM_QUICK = ["Show high risk admissions", "Which beds will be free in 2 hrs?", "Show pending admissions"];

/* --- Care Team view --- */

const CT_KPIS = [
  { value: "42", label: "Doctors On Duty", sub: "↑ 8% vs yesterday", icon: Stethoscope, color: "#0078d4" },
  { value: "128", label: "Nurses On Duty", sub: "↑ 5% vs yesterday", icon: HeartPulse, color: "#038387" },
  { value: "256", label: "Active Patients", sub: "Across all units", icon: Users, color: "#8764B8" },
  { value: "23", label: "Critical Cases", sub: "↓ 3 vs yesterday", icon: TriangleAlert, color: "#D13438" },
  { value: "6", label: "Shift Changes (Today)", sub: "Upcoming", icon: Clock, color: "#CA5010" },
];
const CT_ROSTER = [
  { name: "Dr. Ahmed Ali", role: "Consultant", dept: "Cardiology", shift: "Day (7 AM - 3 PM)", patients: 18 },
  { name: "Dr. Sara Malik", role: "Consultant", dept: "Cardiology", shift: "Day (7 AM - 3 PM)", patients: 16 },
  { name: "Dr. Imran Haider", role: "Assistant Prof.", dept: "ICU", shift: "Night (3 PM - 11 PM)", patients: 12 },
  { name: "Nurse Ayesha", role: "Staff Nurse", dept: "ICU", shift: "Day (7 AM - 3 PM)", patients: 8 },
  { name: "Nurse Fatima Zahra", role: "Staff Nurse", dept: "Cardiology", shift: "Day (7 AM - 3 PM)", patients: 10 },
];
const MDT = [
  { role: "Primary Physician", name: "Dr. Ahmed Ali", tag: "P" },
  { role: "Charge Nurse", name: "Nurse Ayesha", tag: "C" },
  { role: "ICU Consultant", name: "Dr. Imran Haider", sub: "Intensivist" },
  { role: "Physiotherapist", name: "Ali Raza", sub: "Physiotherapy" },
  { role: "Clinical Pharmacist", name: "Dr. Usman", sub: "Pharmacy" },
];
const PHYS_ASSIGN = [
  { name: "Dr. Ahmed Ali", dept: "Cardiology", patients: 18 },
  { name: "Dr. Sara Malik", dept: "Cardiology", patients: 16 },
  { name: "Dr. Imran Haider", dept: "ICU", patients: 12 },
  { name: "Dr. Hassan Raza", dept: "Emergency", patients: 15 },
  { name: "Dr. Marium Shah", dept: "Neurology", patients: 10 },
];
const NURSE_ASSIGN = [
  { name: "Nurse Ayesha", dept: "ICU", patients: 8 },
  { name: "Nurse Fatima Zahra", dept: "Cardiology", patients: 10 },
  { name: "Nurse Sidra Khan", dept: "ICU", patients: 6 },
  { name: "Nurse Maham", dept: "Emergency", patients: 9 },
  { name: "Nurse Hina", dept: "Surgery", patients: 7 },
];
const COVERAGE: { unit: string; shifts: [number, number][] }[] = [
  { unit: "ICU", shifts: [[28, 30], [26, 30], [24, 30]] },
  { unit: "Cardiology", shifts: [[42, 45], [38, 45], [40, 45]] },
  { unit: "Emergency", shifts: [[18, 20], [22, 20], [16, 20]] },
  { unit: "Surgery", shifts: [[16, 18], [14, 18], [10, 18]] },
  { unit: "Neurology", shifts: [[12, 15], [10, 15], [8, 15]] },
];
const SHIFT_SCHED = [
  { shift: "Day", time: "7A - 3P", vals: [142, 148, 140, 136, 120, 110, 132] },
  { shift: "Evening", time: "3P - 11P", vals: [126, 128, 125, 120, 112, 105, 118] },
  { shift: "Night", time: "11P - 7A", vals: [118, 120, 114, 110, 98, 95, 102] },
];
const SCHED_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WORKLOAD = [
  { dept: "ICU", pct: 26, count: 49, color: "#0078d4" },
  { dept: "Cardiology", pct: 24, count: 45, color: "#038387" },
  { dept: "Emergency", pct: 18, count: 33, color: "#D13438" },
  { dept: "Surgery", pct: 15, count: 28, color: "#8764B8" },
  { dept: "Others", pct: 17, count: 31, color: "#94a3b8" },
];
const COMMS = [
  { who: "ICU Team", msg: "Bed ICU-09 is now available for transfer.", time: "10:15 AM", icon: BedDouble, tone: "#0078d4" },
  { who: "Cardiology Team", msg: "New protocol for NSTEMI management.", time: "09:40 AM", icon: HeartPulse, tone: "#038387" },
  { who: "Nursing Supervisor", msg: "Please ensure handover notes are updated.", time: "09:20 AM", icon: ClipboardList, tone: "#CA5010" },
];
const HANDOFF = [
  { label: "Total Handovers", value: 24, tone: "#334155" },
  { label: "Completed", value: 22, tone: "#16a34a" },
  { label: "Pending", value: 2, tone: "#CA5010" },
  { label: "Overdue", value: 0, tone: "#D13438" },
];
const CT_INSIGHTS = [
  { title: "High Workload Alert", body: "Emergency department is over capacity by 2 staff.", time: "5 min ago", icon: TriangleAlert, tone: "#D13438" },
  { title: "ICU Staffing", body: "Night shift ICU is running at 90% capacity.", time: "12 min ago", icon: HeartPulse, tone: "#CA5010" },
  { title: "Shift Conflict", body: "2 shift conflicts detected for tomorrow.", time: "18 min ago", icon: Clock, tone: "#CA8A04" },
];
const CT_ACTIONS = [
  { label: "Reassign 2 Nurses to Emergency", cta: "Review" },
  { label: "Add On-Call Cardiologist", cta: "Add" },
  { label: "Adjust ICU Night Shift", cta: "Optimize" },
  { label: "Review Pending Handovers", cta: "Open" },
];
const CT_REASSIGN = [
  { name: "Nurse Hina", from: "Surgery", to: "Emergency Day Shift", match: "99%" },
  { name: "Dr. Hassan Raza", from: "Emergency", to: "ICU Evening Shift", match: "95%" },
];
const CT_QUICK = ["Who is on duty in ICU?", "Which unit is over capacity?", "Show me today's shift changes"];

const LAB_KPIS = [
  { value: "1,248", label: "Total Samples", sub: "\u2191 12% vs yesterday", icon: TestTubes, color: "#0078d4" },
  { value: "188", label: "Pending Collection", sub: "\u2191 8% vs yesterday", icon: Droplet, color: "#8764B8" },
  { value: "426", label: "In Process", sub: "\u2014", icon: Beaker, color: "#0a5aa8" },
  { value: "962", label: "Results Ready", sub: "\u2191 10% vs yesterday", icon: FileCheck, color: "#16a34a" },
  { value: "18", label: "Critical Results", sub: "\u2193 5 vs yesterday", icon: TriangleAlert, color: "#D13438" },
  { value: "22", label: "Rejected Samples", sub: "\u2193 12% vs yesterday", icon: XCircle, color: "#CA5010" },
];
const LAB_TABS = ["Overview", "Sample Management", "Results", "Quality Control", "Analytics", "Instrument Status", "Departments", "Configuration"];
const LAB_STATUS = [
  { label: "Pending Collection", value: "188", pct: "15%", ring: 15, color: "#8764B8" },
  { label: "In Process", value: "426", pct: "34%", ring: 34, color: "#0078d4" },
  { label: "Results Ready", value: "962", pct: "77%", ring: 45, color: "#16a34a" },
  { label: "Critical", value: "18", pct: "1%", ring: 2, color: "#D13438" },
  { label: "Rejected", value: "22", pct: "2%", ring: 4, color: "#94a3b8" },
];
const TAT_SERIES = [52, 47, 55, 44, 49, 58, 51, 62, 57];
const TAT_XLABELS = ["12 AM", "04 AM", "08 AM", "12 PM", "04 PM", "08 PM"];
const SAMPLES_PRIORITY = [
  { label: "Routine", value: "892", pct: 71, tone: "#0078d4" },
  { label: "STAT", value: "228", pct: 18, tone: "#8764B8" },
  { label: "Urgent", value: "106", pct: 8, tone: "#CA5010" },
  { label: "ASAP", value: "22", pct: 2, tone: "#CA8A04" },
];
const RECENT_SAMPLES = [
  { id: "SMP-2024-001245", name: "Ahmed Khan", mrn: "CLN-00012345", test: "Troponin I", prio: "STAT", when: "May 12, 2024 09:15 AM", status: "Results Ready", tat: "45 min" },
  { id: "SMP-2024-001246", name: "Sara Noor", mrn: "CLN-00012346", test: "Lipid Profile", prio: "Routine", when: "May 12, 2024 09:20 AM", status: "In Process", tat: "\u2014" },
  { id: "SMP-2024-001247", name: "Imran Ali", mrn: "CLN-00012347", test: "CBC", prio: "Routine", when: "May 12, 2024 09:25 AM", status: "Results Ready", tat: "30 min" },
  { id: "SMP-2024-001248", name: "Fatima Zahra", mrn: "CLN-00012348", test: "CRP", prio: "Urgent", when: "May 12, 2024 09:30 AM", status: "In Process", tat: "\u2014" },
  { id: "SMP-2024-001249", name: "Bilal Ahmed", mrn: "CLN-00012349", test: "Liver Function Test", prio: "Routine", when: "May 12, 2024 09:35 AM", status: "Pending Collection", tat: "\u2014" },
];
const CRITICAL_RESULTS = [
  { name: "Ahmed Khan", test: "Troponin I", value: "1.52 ng/mL", loc: "ICU-07", time: "5 min ago" },
  { name: "Imran Ali", test: "Potassium", value: "6.2 mmol/L", loc: "Ward-B14", time: "7 min ago" },
  { name: "Sara Noor", test: "CRP", value: "98 mg/L", loc: "ER", time: "12 min ago" },
  { name: "Kashif Ali", test: "D-Dimer", value: "1.3 mg/L", loc: "OPD", time: "15 min ago" },
];
const INSTRUMENTS = [
  { name: "Cobas 8000", dept: "Biochemistry", status: "Online", tone: "#16a34a" },
  { name: "XN-550", dept: "Hematology", status: "Online", tone: "#16a34a" },
  { name: "Architect i2000", dept: "Immunoassay", status: "Warning", tone: "#CA8A04" },
  { name: "Bact/ALERT 3D", dept: "Microbiology", status: "Online", tone: "#16a34a" },
  { name: "GeneXpert IV", dept: "Molecular", status: "Maintenance", tone: "#94a3b8" },
];
const TAT_BY_DEPT = [
  { dept: "ICU", min: 42, tone: "#16a34a" },
  { dept: "Emergency", min: 51, tone: "#16a34a" },
  { dept: "Cardiology", min: 48, tone: "#16a34a" },
  { dept: "Surgery", min: 65, tone: "#CA5010" },
  { dept: "OPD", min: 72, tone: "#CA5010" },
];
const QC_BREAKDOWN = [
  { label: "Within Range", pct: "95%", tone: "#16a34a" },
  { label: "Warning", pct: "3%", tone: "#CA8A04" },
  { label: "Out of Range", pct: "2%", tone: "#D13438" },
];
const LAB_INSIGHTS = [
  { title: "18 Critical Results", body: "Require immediate review.", time: "5 min ago", icon: TriangleAlert, tone: "#D13438" },
  { title: "TAT Performance", body: "Average TAT is 58 min. Within target.", time: "10 min ago", icon: Activity, tone: "#0078d4" },
  { title: "Sample Rejection", body: "22 samples rejected today. Check QC for Hemolysis.", time: "15 min ago", icon: FileWarning, tone: "#CA8A04" },
];
const LAB_ACTIONS = [
  { label: "Review Critical Results", cta: "Open" },
  { label: "Approve Pending Results", cta: "Review" },
  { label: "Check Instrument Alerts", cta: "View" },
  { label: "Verify Rejected Samples", cta: "Check" },
];
const LAB_QUICK = ["Show critical results", "Which samples are delayed?", "TAT by department", "Yesterday vs today?"];

const RAD_KPIS = [
  { label: "CT Queue", value: "12", icon: ScanLine, color: "#0078d4" },
  { label: "MRI Queue", value: "8", icon: Brain, color: "#8764B8" },
  { label: "X-Ray Queue", value: "18", icon: Bone, color: "#0a5aa8" },
  { label: "US Queue", value: "6", icon: Waves, color: "#038387" },
  { label: "Pending Reports", value: "24", icon: FileText, color: "#CA5010" },
  { label: "Critical Results", value: "3", icon: TriangleAlert, color: "#D13438" },
];
const RAD_WL_TABS = [{ label: "All", n: 68 }, { label: "STAT", n: 3 }, { label: "High Priority", n: 8 }, { label: "Routine", n: 57 }];
const RAD_WORKLIST = [
  { prio: "STAT", name: "Ahmed Khan", age: "58 Y, M", mrn: "CLN-00012345", mod: "CT", study: "CT Chest w/ Contrast", by: "Dr. Sarah Khan", status: "Pending", sla: "15 min", slaRed: true, alert: true },
  { prio: "High", name: "Sara Ali", age: "45 Y, F", mrn: "CLN-00067890", mod: "MRI", study: "MRI Brain w/o Contrast", by: "Dr. Michael Lee", status: "In Review", sla: "40 min", slaRed: false, alert: false },
  { prio: "High", name: "Ali Mahmood", age: "62 Y, M", mrn: "CLN-00011223", mod: "CT", study: "CT Abdomen & Pelvis", by: "Dr. Ahmed Ali", status: "Acquired", sla: "1 hr", slaRed: false, alert: false },
  { prio: "Normal", name: "Zara Noor", age: "34 Y, F", mrn: "CLN-00055678", mod: "X-Ray", study: "X-Ray Knee (Right)", by: "Dr. Sarah Khan", status: "Ready", sla: "2 hr", slaRed: false, alert: false },
  { prio: "Normal", name: "Usman Tariq", age: "50 Y, M", mrn: "CLN-00033445", mod: "US", study: "USG Abdomen", by: "Dr. Michael Lee", status: "Pending", sla: "2 hr", slaRed: false, alert: false },
];
const RAD_SERIES = [
  { name: "Axial", range: "1-120", active: true },
  { name: "Coronal", range: "1-80", active: false },
  { name: "Sagittal", range: "1-90", active: false },
  { name: "Lung", range: "1-40", active: false },
];
const RAD_TOOLS = [
  { label: "Zoom", icon: ZoomIn }, { label: "Pan", icon: Move }, { label: "Window", icon: Contrast },
  { label: "Level", icon: SlidersHorizontal }, { label: "Length", icon: Ruler }, { label: "Angle", icon: Triangle },
  { label: "Annotate", icon: Pencil }, { label: "Reset", icon: RotateCcw }, { label: "More", icon: MoreHorizontal },
];
const RAD_VIEWER_BOTTOM = [
  { label: "Layout", icon: LayoutGrid }, { label: "CINE", icon: Film }, { label: "Compare", icon: Copy },
  { label: "Measurements", icon: Ruler }, { label: "Windowing Presets", icon: SunMedium },
];
const RAD_PATIENT = [
  { label: "Patient Name", value: "Ahmed Khan" },
  { label: "Age / Gender", value: "58 Y / Male" },
  { label: "MRN", value: "CLN-00012345" },
  { label: "Accession", value: "ACC-2024-0012345" },
  { label: "Referring Diagnosis", value: "Shortness of breath, chest pain", full: true },
  { label: "Ordering Physician", value: "Dr. Sarah Khan (Cardiology)" },
  { label: "Allergies", value: "Penicillin" },
  { label: "Height / Weight", value: "178 cm / 82 kg" },
];
const RAD_TEMPLATES = ["CT Chest (Normal)", "CT Abdomen & Pelvis", "MRI Brain", "X-Ray Chest", "USG Abdomen"];
const RAD_PRIOR = [
  { title: "CT Chest w/ Contrast", date: "12 May 2024" },
  { title: "CT Chest w/o Contrast", date: "10 Dec 2023" },
  { title: "X-Ray Chest", date: "14 Aug 2023" },
];
const RAD_FINDINGS = ["No pulmonary nodule detected", "Mild emphysematous changes", "No pleural effusion", "Heart size within normal limits"];
const RAD_SUGGESTED = ["Correlate clinically", "Consider PFT if clinically indicated", "Follow-up CT in 12 months (optional)"];
const RAD_QUICK = ["Summarize this study", "Compare with prior", "Any critical findings?", "Suggest follow-up"];

const PH_KPIS = [
  { label: "New Prescriptions", value: "128", action: "View All", icon: ClipboardList, color: "#0078d4" },
  { label: "Inpatient Orders", value: "96", action: "View Queue", icon: BedDouble, color: "#8764B8" },
  { label: "Outpatient Orders", value: "118", action: "View Queue", icon: Users, color: "#038387" },
  { label: "Returns / Reversals", value: "16", action: "View List", icon: RotateCcw, color: "#CA5010" },
  { label: "Critical Alerts", value: "5", action: "View Alerts", icon: TriangleAlert, color: "#D13438", critical: true },
  { label: "Stock Alerts", value: "7", action: "View Details", icon: Boxes, color: "#CA8A04" },
];
const PH_WL_TABS = [{ label: "All", n: 342 }, { label: "New", n: 128 }, { label: "In Progress", n: 43 }, { label: "Ready", n: 132 }, { label: "Completed", n: 289 }];
const PH_WORKLIST = [
  { prio: "High", rx: "RX-00012345", name: "Ahmed Khan", age: "58 Y, M", med: "Enoxaparin", dose: "40 mg / 0.4 mL", form: "Injection · SC", by: "Dr. Sarah Khan", status: "Pending", sla: "15 min", slaRed: true },
  { prio: "Normal", rx: "RX-00012346", name: "Sara Ali", age: "45 Y, F", med: "Atorvastatin", dose: "20 mg", form: "Tablet · Oral", by: "Dr. Michael Lee", status: "In Progress", sla: "30 min", slaRed: false },
  { prio: "Normal", rx: "RX-00012347", name: "Ali Mahmood", age: "62 Y, M", med: "Metformin", dose: "500 mg", form: "Tablet · Oral", by: "Dr. Ahmed Ali", status: "Ready", sla: "45 min", slaRed: false },
  { prio: "Low", rx: "RX-00012348", name: "Zara Noor", age: "34 Y, F", med: "Paracetamol", dose: "650 mg", form: "Tablet · Oral", by: "Dr. Sarah Khan", status: "Ready", sla: "1 hr", slaRed: false },
  { prio: "High", rx: "RX-00012349", name: "Usman Tariq", age: "50 Y, M", med: "Piperacillin / Tazobactam", dose: "4.5 g", form: "IV", by: "Dr. Michael Lee", status: "Pending", sla: "15 min", slaRed: true },
];
const PH_INV_STATS = [
  { label: "Available Items", value: "1,256", sub: "", icon: Package, tone: "#0078d4" },
  { label: "Low Stock Items", value: "23", sub: "", icon: TriangleAlert, tone: "#CA8A04" },
  { label: "Out of Stock Items", value: "8", sub: "", icon: XCircle, tone: "#D13438" },
  { label: "Expiring Soon", value: "31", sub: "\u2264 30 days", icon: Calendar, tone: "#CA5010" },
];
const PH_LOW_STOCK = [
  { med: "Heparin 5000 IU Inj.", avail: 10, reorder: 20, unit: "Vial" },
  { med: "Meropenem 1 g Inj.", avail: 15, reorder: 30, unit: "Vial" },
  { med: "Insulin Glargine 100 IU/mL", avail: 8, reorder: 15, unit: "Vial" },
  { med: "Salbutamol Inhaler", avail: 5, reorder: 10, unit: "Inhaler" },
  { med: "Amikacin 500 mg Inj.", avail: 7, reorder: 15, unit: "Vial" },
];
const PH_DISPENSED = [
  { rx: "RX-00012340", name: "John Smith", med: "Amlodipine 5 mg", by: "Pharm. Ayesha", time: "10:24 AM" },
  { rx: "RX-00012341", name: "Fatima Zahra", med: "Losartan 50 mg", by: "Pharm. Imran", time: "10:20 AM" },
  { rx: "RX-00012342", name: "Bilal Ahmed", med: "Omeprazole 20 mg", by: "Pharm. Ayesha", time: "09:58 AM" },
  { rx: "RX-00012343", name: "Maryam Khan", med: "Azithromycin 500 mg", by: "Pharm. Imran", time: "09:40 AM" },
  { rx: "RX-00012344", name: "Sajad Hussain", med: "Clopidogrel 75 mg", by: "Pharm. Ayesha", time: "09:15 AM" },
];
const PH_UTIL = [
  { label: "Total Expenditure", value: "\u20B9 8.62M", sub: "+12.5% vs last month", subTone: "#16a34a" },
  { label: "Top Therapeutic Class", value: "Antibiotics", sub: "\u20B9 2.14M (24.8%)", subTone: "#64748b" },
  { label: "Most Used Medication", value: "Piperacillin / Tazobactam", sub: "1,245 units", subTone: "#64748b" },
  { label: "Cost Savings", value: "\u20B9 1.26M", sub: "Potential savings identified", subTone: "#0a5aa8" },
];
const PH_TREND = [520, 610, 470, 690, 560, 640, 600, 720, 540, 675, 610, 660, 585, 700];
const PH_TREND_X = ["May 7", "May 14", "May 21", "May 28"];
const PH_INSIGHTS = [
  { title: "Drug Interaction", body: "5 prescriptions have potential drug interactions.", icon: ShieldAlert, tone: "#8764B8" },
  { title: "Therapeutic Duplication", body: "3 patients have duplicate therapy.", icon: Copy, tone: "#0078d4" },
  { title: "Dose Alerts", body: "2 prescriptions may require dose adjustment.", icon: Activity, tone: "#CA5010" },
];
const PH_CRITICAL = [
  { title: "Heparin 5000 IU Injection", body: "Low stock: 10 vials remaining", tone: "#D13438" },
  { title: "Meropenem 1 g Injection", body: "Expiring in 5 days", tone: "#CA5010" },
  { title: "Vancomycin 1 g Injection", body: "Recall issued by manufacturer", tone: "#CA5010" },
];
const PH_TASKS = ["Verify 12 high priority orders", "Follow up on 5 drug interaction alerts", "Review 3 therapeutic duplications", "Approve 7 return requests", "Check expiring stock items"];
const PH_QUICK = ["Show critical alerts", "Any drug interactions?", "What's expiring soon?", "Top low stock items"];

const ICU_KPIS = [
  { label: "Total Beds", value: "24", action: "View Beds", icon: BedDouble, color: "#0078d4" },
  { label: "Occupied Beds", value: "20", action: "83%", icon: BedDouble, color: "#8764B8" },
  { label: "Available Beds", value: "4", action: "17%", icon: BedDouble, color: "#16a34a" },
  { label: "Invasive Ventilators", value: "18", action: "In Use", icon: Wind, color: "#0a5aa8" },
  { label: "CRRT in Use", value: "3", action: "View Details", icon: Droplet, color: "#038387" },
  { label: "ECMO in Use", value: "1", action: "View Details", icon: HeartPulse, color: "#CA5010" },
  { label: "High Priority Alerts", value: "6", action: "View Alerts", icon: TriangleAlert, color: "#D13438", critical: true },
];
const ICU_PT_TABS = [{ label: "All", n: 20 }, { label: "High Risk", n: 6 }, { label: "Ventilated", n: 18 }, { label: "Isolation", n: 4 }];
const ICU_STATUS_TONE: Record<string, string> = { Critical: "#D13438", Serious: "#CA5010", Stable: "#16a34a", Improving: "#0078d4" };
const ICU_PATIENTS = [
  { bed: "ICU-01", name: "Ahmed Khan", age: "58 Y, M", dx: "Severe Pneumonia", status: "Critical", vent: "Yes", score: "APACHE II: 24", los: "3d 12h", alert: true },
  { bed: "ICU-02", name: "Sara Ali", age: "45 Y, F", dx: "Post Op - CABG", status: "Stable", vent: "No", score: "SOFA: 6", los: "2d 4h", alert: false },
  { bed: "ICU-03", name: "Bilal Ahmed", age: "62 Y, M", dx: "Septic Shock", status: "Critical", vent: "Yes", score: "APACHE II: 28", los: "1d 18h", alert: true },
  { bed: "ICU-04", name: "Maryam Khan", age: "34 Y, F", dx: "Acute Respiratory Failure", status: "Serious", vent: "Yes", score: "SOFA: 10", los: "5d 2h", alert: false },
  { bed: "ICU-05", name: "Usman Tariq", age: "50 Y, M", dx: "Diabetic Ketoacidosis", status: "Stable", vent: "No", score: "SOFA: 4", los: "1d 6h", alert: false },
  { bed: "ICU-06", name: "Zara Noor", age: "28 Y, F", dx: "Status Asthmaticus", status: "Improving", vent: "Yes", score: "SOFA: 7", los: "2d 10h", alert: false },
];
const ICU_LIVE = [
  { bed: "ICU-01", status: "Critical", dx: "Severe Pneumonia", score: "APACHE II: 24", pct: 92 },
  { bed: "ICU-02", status: "Stable", dx: "Post Op - CABG", score: "SOFA: 6", pct: 35 },
  { bed: "ICU-03", status: "Critical", dx: "Septic Shock", score: "APACHE II: 28", pct: 95 },
  { bed: "ICU-04", status: "Serious", dx: "Acute Respiratory Failure", score: "SOFA: 10", pct: 60 },
  { bed: "ICU-05", status: "Stable", dx: "Diabetic Ketoacidosis", score: "SOFA: 4", pct: 25 },
];
const ICU_VITALS = [
  { label: "HR", value: "112 bpm", color: "#D13438" },
  { label: "BP", value: "98/56 mmHg", color: "#8764B8" },
  { label: "SpO2", value: "92 %", color: "#CA5010" },
  { label: "RR", value: "24 /min", color: "#0078d4" },
  { label: "Temp", value: "38.6 \u00B0C", color: "#16a34a" },
];
const ICU_IO = [
  { label: "Intake", value: "2,150 ml", tone: "#0078d4", hl: false },
  { label: "Output", value: "1,650 ml", tone: "#CA5010", hl: false },
  { label: "Net Balance", value: "+500 ml", tone: "#16a34a", hl: true },
  { label: "Urine Output", value: "1,250 ml", tone: "#334155", hl: false },
  { label: "Fluid Balance Status", value: "Positive", tone: "#D13438", hl: false },
];
const ICU_VENT = [
  { label: "Mode", value: "VCV" }, { label: "FiO2", value: "50 %" }, { label: "PEEP", value: "8 cmH2O" },
  { label: "Tidal Volume", value: "450 ml" }, { label: "RR Set", value: "16 /min" }, { label: "PIP", value: "24 cmH2O" },
];
const ICU_CURRENT = [
  { label: "Diagnosis", value: "Septic Shock" },
  { label: "Attending Dr.", value: "Dr. Imran Ali" },
  { label: "Admitted", value: "May 8, 2024 08:20 AM" },
  { label: "LOS", value: "1d 18h" },
  { label: "Code Status", value: "Full Code" },
  { label: "Isolation", value: "Contact" },
];
const ICU_ALERTS = [
  { title: "High Lactate Trend", sub: "ICU-03 · Bilal Ahmed", pct: 92, tone: "#D13438" },
  { title: "Low SpO2", sub: "ICU-01 · Ahmed Khan", pct: 35, tone: "#CA5010" },
  { title: "Low Urine Output", sub: "ICU-04 · Maryam Khan", pct: 95, tone: "#D13438" },
  { title: "Pending Lab Results", sub: "6 pending results", pct: 60, tone: "#0078d4" },
  { title: "Medication Due", sub: "3 medications due", pct: 25, tone: "#8764B8" },
];
const ICU_TASKS = [
  { t: "Review high risk patients", done: false }, { t: "ICU rounds", done: true },
  { t: "Follow up pending labs", done: false }, { t: "Review ventilation weaning", done: false },
  { t: "Check fluid balance alerts", done: false },
];
const ICU_BED_STATS = [
  { label: "Total Beds", value: "24", sub: "", tone: "#334155" },
  { label: "Occupied", value: "20", sub: "83%", tone: "#D13438" },
  { label: "Available", value: "4", sub: "17%", tone: "#16a34a" },
  { label: "Cleaning", value: "1", sub: "", tone: "#CA8A04" },
  { label: "Under Maintenance", value: "0", sub: "", tone: "#94a3b8" },
];
const ICU_BED_TONE: Record<string, string> = { Occupied: "#D13438", Available: "#16a34a", Cleaning: "#0078d4", Maintenance: "#94a3b8" };
const ICU_BEDS = [
  { id: "ICU-01", status: "Occupied" }, { id: "ICU-02", status: "Occupied" }, { id: "ICU-03", status: "Occupied" }, { id: "ICU-04", status: "Occupied" },
  { id: "ICU-05", status: "Occupied" }, { id: "ICU-06", status: "Occupied" }, { id: "ICU-07", status: "Available" }, { id: "ICU-08", status: "Cleaning" },
];
const ICU_ORDERS = [
  { time: "10:10 AM", order: "ABG", pt: "ICU-03", status: "Completed" },
  { time: "10:05 AM", order: "Blood Culture", pt: "ICU-01", status: "In Progress" },
  { time: "09:58 AM", order: "CXR", pt: "ICU-01", status: "Completed" },
  { time: "09:45 AM", order: "Lactate", pt: "ICU-03", status: "In Progress" },
  { time: "09:30 AM", order: "Electrolytes", pt: "ICU-04", status: "Completed" },
];
const ICU_UTIL = [
  { label: "Occupied", value: "83% (20 beds)", color: "#0078d4" },
  { label: "Available", value: "17% (4 beds)", color: "#16a34a" },
  { label: "Average LOS", value: "3.6 Days", color: "#8764B8" },
  { label: "Ventilator Utilization", value: "75%", color: "#CA5010" },
];
const ICU_INSIGHTS = ["ICU-03 has high risk of deterioration in next 6 hours.", "Consider early weaning for ICU-02.", "Sepsis bundle compliance is 82% this week.", "3 patients may benefit from nutrition review."];
const ICU_QUICK = ["Who may deteriorate?", "Weaning candidates?", "Sepsis bundle status", "Fluid balance alerts"];

const ED_KPIS = [
  { label: "Arrivals (Last 24h)", value: "84", action: "View Trends", icon: Users, color: "#0078d4" },
  { label: "In Triage", value: "12", action: "View Triage", icon: ClipboardList, color: "#8764B8" },
  { label: "In Treatment", value: "14", action: "View Patients", icon: Stethoscope, color: "#0a5aa8" },
  { label: "Awaiting Disposition", value: "18", action: "View List", icon: Clock, color: "#CA8A04" },
  { label: "Critical Patients", value: "7", action: "View List", icon: TriangleAlert, color: "#D13438", critical: true },
  { label: "Boarded Patients", value: "9", action: "View List", icon: BedDouble, color: "#CA5010" },
  { label: "Available ED Beds", value: "6", action: "View Beds", icon: BedDouble, color: "#16a34a" },
];
const ED_TABS = [{ label: "All", n: 12 }, { label: "CTAS 1", n: 2 }, { label: "CTAS 2", n: 3 }, { label: "CTAS 3", n: 4 }, { label: "CTAS 4", n: 2 }, { label: "CTAS 5", n: 1 }];
const CTAS_TONE: Record<string, string> = { "1": "#D13438", "2": "#CA5010", "3": "#CA8A04", "4": "#16a34a", "5": "#0078d4" };
const ED_STATUS_TONE: Record<string, string> = { "In Treatment": "#0078d4", "In Triage": "#8764B8", "Waiting": "#CA5010" };
const ED_TRIAGE = [
  { ctas: "1", name: "Ahmed Khan", mrn: "CLN-00011223", age: "58 Y, M", cc: "Chest Pain", arr: "08:12 AM", wait: "10 min", waitRed: true, status: "In Treatment", prov: "Dr. Sara Khan", alert: true },
  { ctas: "1", name: "Sara Ali", mrn: "CLN-00067890", age: "45 Y, F", cc: "Shortness of Breath", arr: "08:18 AM", wait: "6 min", waitRed: true, status: "In Treatment", prov: "Dr. Michael Lee", alert: true },
  { ctas: "2", name: "Bilal Ahmed", mrn: "CLN-00011224", age: "62 Y, M", cc: "Abdominal Pain", arr: "08:25 AM", wait: "12 min", waitRed: false, status: "In Treatment", prov: "Dr. Ahmed Ali", alert: false },
  { ctas: "3", name: "Maryam Khan", mrn: "CLN-00033445", age: "34 Y, F", cc: "Fever, Cough", arr: "08:35 AM", wait: "18 min", waitRed: false, status: "In Triage", prov: "\u2014", alert: false },
  { ctas: "3", name: "Usman Tariq", mrn: "CLN-00055678", age: "50 Y, M", cc: "Back Pain", arr: "08:42 AM", wait: "24 min", waitRed: true, status: "Waiting", prov: "\u2014", alert: false },
  { ctas: "4", name: "Zara Noor", mrn: "CLN-00077891", age: "28 Y, F", cc: "Headache", arr: "08:50 AM", wait: "28 min", waitRed: true, status: "Waiting", prov: "\u2014", alert: false },
];
const ED_LIVE = [
  { area: "Ambulance Bay", count: "2", note: "Occupancy", icon: Ambulance, tone: "#0078d4" },
  { area: "Trauma Bay", count: "3", note: "In Use", icon: HeartPulse, tone: "#D13438" },
  { area: "Isolation Room", count: "2", note: "Available", icon: ShieldAlert, tone: "#16a34a" },
  { area: "Procedure Rooms", count: "1", note: "Available", icon: Stethoscope, tone: "#16a34a" },
  { area: "Fast Track", count: "3", note: "In Use", icon: Activity, tone: "#CA5010" },
];
const ED_CRITICAL = [
  { title: "Sepsis Alert", sub: "Ahmed Khan · CTAS 1", time: "08:22 AM", tone: "#D13438" },
  { title: "High Lactate", sub: "Sara Ali · CTAS 1", time: "08:19 AM", tone: "#D13438" },
  { title: "Hypotension", sub: "Bilal Ahmed · CTAS 2", time: "08:25 AM", tone: "#CA5010" },
  { title: "Overdue Reassessment", sub: "Maryam Khan · CTAS 3", time: "08:35 AM", tone: "#CA8A04" },
  { title: "Lab Critical", sub: "Usman Tariq · CTAS 3", time: "08:42 AM", tone: "#CA8A04" },
];
const ED_CURRENT = [
  { label: "Chief Complaint", value: "Chest Pain" },
  { label: "Arrival", value: "08:12 AM" },
  { label: "Provider", value: "Dr. Sara Khan" },
  { label: "Status", value: "In Treatment" },
];
const ED_VITALS = [
  { label: "HR", value: "102 bpm", color: "#D13438" },
  { label: "BP", value: "140/90 mmHg", color: "#8764B8" },
  { label: "SpO2", value: "96 %", color: "#CA5010" },
  { label: "RR", value: "22 /min", color: "#0078d4" },
  { label: "Temp", value: "37.8 \u00B0C", color: "#16a34a" },
];
const ED_SCORE = [
  { label: "APACHE II Score", value: "18", tag: "High Risk", tagTone: "#D13438" },
  { label: "ESI Level", value: "2", tag: "", tagTone: "" },
  { label: "Risk of Mortality", value: "24.5%", tag: "", tagTone: "" },
  { label: "Predicted LOS", value: "2.8 Days", tag: "", tagTone: "" },
];
const ED_ORDERS = [
  { label: "Labs", value: "18", icon: FlaskConical }, { label: "Imaging", value: "7", icon: ScanLine },
  { label: "Medications", value: "12", icon: Beaker }, { label: "Procedures", value: "4", icon: Stethoscope },
  { label: "Consults", value: "5", icon: Users },
];
const ED_TASKS = ["Review 8 pending lab results", "Reassess 5 patients", "Follow up on 3 imaging requests", "Discharge summaries — 6 pending", "Update bed status"];
const ED_BED_STATS = [
  { label: "Total Beds", value: "24", sub: "", tone: "#334155" },
  { label: "Occupied", value: "18", sub: "75%", tone: "#D13438" },
  { label: "Available", value: "6", sub: "25%", tone: "#16a34a" },
  { label: "Cleaning", value: "1", sub: "", tone: "#CA8A04" },
];
const ED_ZONES = [
  { zone: "Zone A", beds: "8 Beds", occ: 4, total: 8 },
  { zone: "Zone B", beds: "8 Beds", occ: 4, total: 8 },
  { zone: "Zone C", beds: "6 Beds", occ: 4, total: 6 },
  { zone: "Resus", beds: "2 Beds", occ: 1, total: 2 },
];
const ED_ARRIVALS = [
  { time: "08:16 AM", name: "Sara Ali", ctas: "1", cc: "Chest Pain" },
  { time: "08:25 AM", name: "Bilal Ahmed", ctas: "2", cc: "Abdominal Pain" },
  { time: "08:35 AM", name: "Maryam Khan", ctas: "3", cc: "Fever, Cough" },
  { time: "08:42 AM", name: "Usman Tariq", ctas: "3", cc: "Back Pain" },
  { time: "08:50 AM", name: "Zara Noor", ctas: "4", cc: "Headache" },
];
const ED_BOARDED = [
  { label: "ICU", value: "5", hl: false }, { label: "Ward", value: "3", hl: false }, { label: "Step Down", value: "1", hl: false }, { label: "Psych", value: "0", hl: false }, { label: "Total", value: "9", hl: true },
];
const ED_UTIL = [
  { label: "Patient Throughput", value: "62", color: "#0078d4" },
  { label: "Avg LOS", value: "3h 24m", color: "#8764B8" },
  { label: "LWBS", value: "6 (7.1%)", color: "#CA5010" },
  { label: "Revisit (72h)", value: "8 (9.5%)", color: "#D13438" },
];
const ED_INSIGHTS = ["7 patients at risk of clinical deterioration.", "Consider early sepsis bundle for 2 patients.", "High ED occupancy expected in next 2 hours.", "Fast track patients can be expedited."];
const ED_QUICK = ["Who is critical?", "Any sepsis alerts?", "ED bed availability?", "Longest waiting?"];

/* ------------------------------------------------------------- primitives --- */

const card =
  "rounded-2xl border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,253,.9),rgba(250,248,243,.74))] shadow-[0_10px_26px_rgba(28,33,51,.07),inset_0_1px_0_rgba(255,255,255,.9)]";

function Spark({ color = "#0078d4" }: { color?: string }) {
  return (
    <svg width="66" height="20" viewBox="0 0 66 20" fill="none" className="shrink-0">
      <polyline
        points="0,14 10,10 18,13 26,6 34,9 42,4 50,8 58,5 66,7"
        stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
      />
    </svg>
  );
}

function NavRow({ label, icon: Icon, active, badge, onClick }: { label: string; icon: ComponentType<{ size?: number | string; color?: string }>; active?: boolean; badge?: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] font-medium transition"
      style={{
        color: active ? "#004578" : "#4b5563",
        background: active ? "rgba(0,120,212,.12)" : "transparent",
        boxShadow: active ? "inset 3px 0 0 #0078d4" : "none",
      }}
    >
      <Icon size={16} color={active ? "#0078d4" : "#6b7280"} />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && (
        <span className="rounded-full bg-[rgba(0,120,212,.14)] px-1.5 py-0.5 text-[10.5px] font-bold text-[#0078d4]">{badge}</span>
      )}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[0.13em] text-slate-400">{children}</div>;
}

function PanelHead({ title, action }: { title: string; action?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-[12.5px] font-bold text-[#0c3b63]">{title}</h3>
      {action && <button type="button" className="text-[11px] font-semibold text-[#0078d4] hover:underline">{action}</button>}
    </div>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${tone}1a`, color: tone }}>{children}</span>;
}
function Bar({ pct, tone = "#16a34a" }: { pct: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.07]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
    </div>
  );
}
function FilterChip({ icon: Icon, label }: { icon: ComponentType<{ size?: number | string }>; label: string }) {
  return (
    <button type="button" className="flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-600">
      <Icon size={13} /> {label} <ChevronDown size={12} className="text-slate-400" />
    </button>
  );
}
const initials = (n: string) => n.replace(/^(Dr\.|Nurse)\s+/, "").split(" ").map((x) => x[0]).slice(0, 2).join("");
const cellHead = "pb-1.5 pr-3 font-bold";
const th = "text-[10px] uppercase tracking-wide text-slate-400";
function copilotReply(q: string): string {
  const s = q.toLowerCase();
  if (s.includes("critical result")) return "18 critical results are pending review. Top priority: Ahmed Khan Troponin I 1.52 ng/mL (ICU-07) and Imran Ali Potassium 6.2 mmol/L (Ward-B14). All have been flagged to the on-call physician.";
  if (s.includes("delayed")) return "7 samples are past their target TAT \u2014 mostly OPD (72 min avg) and Surgery (65 min). The Architect i2000 immunoassay analyzer is in a warning state, which is contributing to the immunoassay backlog.";
  if (s.includes("tat by") || s.includes("turnaround") || s.includes("tat performance")) return "Average TAT today is 58 min, within the < 60 min goal. By department: ICU 42, Cardiology 48, Emergency 51, Surgery 65, OPD 72 min. Surgery and OPD are above target.";
  if (s.includes("reject")) return "22 samples were rejected today (2%), mostly due to hemolysis and insufficient volume. Re-collection is recommended for the 4 STAT samples affected.";
  if (s.includes("instrument") || s.includes("analyzer")) return "Instrument status: Cobas 8000, XN-550 and Bact/ALERT 3D are Online. Architect i2000 (Immunoassay) is in Warning; GeneXpert IV (Molecular) is under Maintenance.";
  if (s.includes("pending results") || s.includes("approve pending")) return "962 results are ready and 188 samples are still pending collection. 42 verified results are awaiting pathologist approval \u2014 batch-approve the routine CBC and lipid panels to clear the queue.";
  if (s.includes("yesterday")) return "Vs yesterday: total samples +12% (1,248), results ready +10% (962), critical results -5 (18), rejected samples -12% (22). Throughput is up with a stable rejection rate.";
  if (s.includes("pulmonary embolism") || s.includes("critical finding") || s.includes("notify physician")) return "AI has flagged a suspected pulmonary embolism \u2014 a filling defect in the right lower lobe pulmonary artery (AI confidence 94%), marked critical at 10:28 AM. Recommend immediate physician notification and CTPA correlation.";
  if (s.includes("compare") || s.includes("comparison") || s.includes("prior study")) return "Compared with the prior CT Chest (12 May 2024): no significant interval change. Mild emphysematous changes are stable, with no new nodule or effusion.";
  if (s.includes("follow-up") || s.includes("follow up")) return "Suggested follow-up: correlate clinically, consider PFTs if indicated, and a follow-up CT in 12 months (optional) given the mild emphysematous changes.";
  if (s.includes("this study") || s.includes("findings summary") || s.includes("summarize the study")) return "CT Chest w/ Contrast: no pulmonary nodule detected, mild emphysematous changes, no pleural effusion, and heart size within normal limits (overall AI confidence 92%).";
  if (s.includes("nodule")) return "No pulmonary nodule is detected on the current CT Chest study (AI confidence 92%).";
  if (s.includes("drug interaction")) return "5 prescriptions have potential drug interactions today. The highest-severity is Enoxaparin + Clopidogrel (bleeding risk) for Ahmed Khan \u2014 recommend pharmacist review before dispensing.";
  if (s.includes("therapeutic duplication") || s.includes("duplicate therapy")) return "3 patients have therapeutic duplication (e.g., two PPIs or overlapping NSAIDs). Consolidate to a single agent and notify the prescriber.";
  if (s.includes("dose alert") || s.includes("dose adjust")) return "2 prescriptions may need dose adjustment based on renal function \u2014 review Enoxaparin and Piperacillin/Tazobactam dosing against the latest eGFR.";
  if (s.includes("expiring") || s.includes("expiry")) return "31 items expire within 30 days; Meropenem 1 g is expiring in 5 days. Prioritize near-expiry stock for dispensing (FEFO) and flag unused lots for return.";
  if (s.includes("low stock") || s.includes("stock alert") || s.includes("out of stock")) return "7 stock alerts: 23 items low, 8 out of stock. Top reorders: Salbutamol Inhaler (5/10), Amikacin 500 mg (7/15), Insulin Glargine (8/15). Purchase orders can be auto-generated.";
  if (s.includes("recall")) return "Vancomycin 1 g Injection has a manufacturer recall. Quarantine affected lots, halt dispensing, and notify wards holding current stock.";
  if (s.includes("critical alert")) return "5 critical pharmacy alerts: Heparin low stock (10 vials), Meropenem expiring in 5 days, and a Vancomycin recall are the most urgent. Open Critical Alerts to action each.";
  if (s.includes("return")) return "7 return/reversal requests are pending approval \u2014 mostly unused inpatient doses. Approve to restock, or route near-expiry items for supplier return.";
  if (s.includes("deteriorat")) return "ICU-03 (Bilal Ahmed, septic shock) has the highest predicted risk of deterioration in the next 6 hours \u2014 rising lactate and worsening SOFA. Recommend closer monitoring and early escalation.";
  if (s.includes("weaning") || s.includes("wean")) return "ICU-02 (post-op CABG) is the best ventilator weaning candidate \u2014 stable gas exchange with low FiO2/PEEP. Consider a spontaneous breathing trial today. 18 vents are currently in use.";
  if (s.includes("sepsis bundle")) return "Sepsis bundle compliance is 82% this week. ICU-01 and ICU-03 are missing timely lactate re-checks \u2014 complete them to reach the 90% target.";
  if (s.includes("fluid balance")) return "ICU-03 is net positive +500 ml over 24h with low urine output \u2014 review diuresis vs CRRT. ICU-04 is also flagged for fluid balance.";
  if (s.includes("who is critical") || s.includes("critical patient")) return "7 ED patients are critical. The two highest-acuity are Ahmed Khan (CTAS 1, chest pain \u2014 sepsis alert) and Sara Ali (CTAS 1, shortness of breath \u2014 high lactate). Both are in treatment.";
  if (s.includes("sepsis")) return "Active ED sepsis alert: Ahmed Khan (CTAS 1) flagged at 08:22 with a high lactate. Recommend the sepsis bundle \u2014 cultures, broad-spectrum antibiotics, and fluid resuscitation within the hour.";
  if (s.includes("ed bed") || s.includes("bed availab") || s.includes("available bed")) return "6 ED beds are available (25%). Zone A 4/8, Zone B 4/8, Zone C 4/6, Resus 1/2. 9 patients are boarded (5 to ICU) \u2014 expediting those transfers would free capacity.";
  if (s.includes("waiting") || s.includes("longest wait") || s.includes("wait time")) return "Longest waits are Zara Noor (CTAS 4, 28 min) and Usman Tariq (CTAS 3, 24 min), both still Waiting. Maryam Khan (CTAS 3) is overdue for reassessment.";
  if (s.includes("lwbs") || s.includes("left without")) return "6 patients left without being seen today (7.1%). Occupancy is high and rising over the next 2 hours \u2014 consider fast-tracking CTAS 4/5 to reduce LWBS.";
  if (s.includes("throughput") || s.includes("occupancy")) return "Patient throughput is 62 today; ED utilization is 75% and expected to climb. Avg LOS 3h 24m, revisit rate 9.5%. Fast-track patients can be expedited to protect capacity.";
  if (s.includes("troponin")) return "Ahmed Khan's Troponin I is 1.52 ng/mL (ref < 0.04) \u2014 markedly elevated, consistent with the NSTEMI diagnosis, and trending down from the admission peak. Continue serial cardiac enzymes every 6 hours.";
  if (s.includes("ecg")) return "The latest 12-lead ECG shows ST-segment depression in V4\u2013V6, suggestive of ischemia, with no new ST-elevation. See the Imaging tab to compare with the prior ECG.";
  if (s.includes("discharge")) return "Discharge criteria: hemodynamically stable \u2265 24h, troponin trending down, ambulating without chest pain, and dual antiplatelet + statin therapy optimized. Ahmed is close, pending the PCI scheduled for 16 May.";
  if (s.includes("summar") || s.includes("patient")) return "58-year-old male, NSTEMI, in ICU-07 on dual antiplatelet therapy. History of T2DM, hypertension and hyperlipidemia. Hemodynamically stable; troponin elevated but trending down. Readmission risk moderate (36%) \u2014 ensure cardiac rehab referral and follow-up.";
  if (s.includes("bed")) return "3 ICU/HDU beds are available now (ICU-07, ICU-09, HDU-04). With planned discharges, ~2 more ICU beds should free up within 2 hours.";
  if (s.includes("high risk") || s.includes("high-risk")) return "5 high-risk admissions today, incl. Ahmed Khan (NSTEMI) and Sara Noor (severe breathlessness) \u2014 both flagged for priority bed assignment.";
  if (s.includes("pending admission") || s.includes("pending")) return "11 pending admissions; 2 high-priority awaiting a bed (Ahmed Khan, Fatima Zahra). Average ER wait time is 28 min.";
  if (s.includes("on duty")) return "On duty in ICU: Dr. Imran Haider (Intensivist), Nurse Ayesha and Nurse Sidra Khan. ICU is at 28/30 day-shift coverage.";
  if (s.includes("capacity")) return "Emergency is over capacity (22/20 on the evening shift); ICU night shift is at 90%. Suggest reassigning 2 nurses to Emergency.";
  if (s.includes("shift change")) return "6 shift changes today and 2 conflicts detected for tomorrow. Suggested: move Nurse Hina (Surgery) to the Emergency day shift (99% skills match).";
  return "Based on Ahmed Khan's chart (NSTEMI, ICU-07): hemodynamically stable on dual antiplatelet therapy with a PCI scheduled. Ask me about his vitals, labs, medications, imaging, or care plan.";
}

/* --------------------------------------------------------- Patient 360 tabs --- */

function TimelineTab({ data }: { data?: OsPatient }) {
  const items = data
    ? data.timeline.map((e) => ({ date: e.date, year: "", kind: e.kind, time: e.time, dept: "", detail: e.detail, sub: "", status: e.status, tone: e.tone }))
    : TIMELINE;
  return (
    <div className="max-w-3xl">
      {data && items.length === 0 && <div className={`${card} p-6 text-center text-[11.5px] text-slate-400`}>No timeline activity for this patient.</div>}
      {items.map((e, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex w-12 shrink-0 flex-col items-end pt-0.5 text-right">
            <span className="text-[11px] font-bold text-slate-600">{e.date}</span>
            {e.year && <span className="text-[9.5px] text-slate-400">{e.year}</span>}
          </div>
          <div className="flex flex-col items-center">
            <span className="mt-1 grid h-7 w-7 place-items-center rounded-full border border-black/[0.08] bg-white" style={{ color: e.tone }}><Stethoscope size={13} /></span>
            {i < items.length - 1 && <span className="my-0.5 w-px flex-1 bg-black/[0.09]" />}
          </div>
          <div className={`${card} mb-2.5 flex flex-1 items-start justify-between p-2.5`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[12.5px] font-bold text-slate-700">
                {e.kind}<span className="text-[10.5px] font-medium text-slate-400">{e.time}{e.dept ? ` · ${e.dept}` : ""}</span>
              </div>
              {e.detail && <div className="mt-0.5 text-[11.5px] text-slate-600">{e.detail}</div>}
              {e.sub && <div className="text-[11px] text-slate-400">{e.sub}</div>}
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-1.5"><Pill tone={e.tone}>{e.status}</Pill><ChevronDown size={14} className="text-slate-300" /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewTab() {
  const abnormal = LAB_GROUPS.flatMap((g) => g.rows).filter((r) => r.status !== "Normal").slice(0, 5);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className={`${card} p-3`}>
          <PanelHead title="Current Problems" action="View All" />
          <ol className="space-y-1">
            {PROBLEMS.map((p, i) => (<li key={p} className="flex gap-2 text-[12px] text-slate-600"><span className="font-bold text-slate-400">{i + 1}.</span>{p}</li>))}
          </ol>
        </div>
        <div className={`${card} p-3`}>
          <PanelHead title="Recent Vitals" action="View Trends" />
          <div className="space-y-1.5">
            {VITALS.map((v) => (
              <div key={v.label} className="flex items-center justify-between">
                <span className="text-[11.5px] font-semibold text-slate-500">{v.label}</span>
                <span className="text-[12px] font-bold text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>{v.value}</span>
                <Spark />
              </div>
            ))}
          </div>
        </div>
        <div className={`${card} p-3`}>
          <PanelHead title="Active Medications" action="View All" />
          <div className="space-y-1.5">
            {MEDS.map((m) => (
              <div key={m.name} className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-slate-700">{m.name}</span>
                <span className="text-slate-500">{m.dose}</span>
                <span className="w-8 text-right font-bold text-slate-400">{m.freq}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className={`${card} p-3`}>
          <PanelHead title="Latest Lab Results" action="View All" />
          <div className="space-y-1.5">
            {abnormal.map((r) => (
              <div key={r.test} className="flex items-center justify-between text-[12px]">
                <span className="font-semibold text-slate-700">{r.test}</span>
                <span className="text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>{r.result} {r.unit}</span>
                <Pill tone={LAB_STATUS_TONE[r.status as keyof typeof LAB_STATUS_TONE]}>{r.status}</Pill>
              </div>
            ))}
          </div>
        </div>
        <div className={`${card} p-3`}>
          <PanelHead title="Care Team" action="View All" />
          <div className="space-y-1.5">
            {CP_TEAM.slice(0, 4).map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[10px] font-bold text-[#0078d4]">{initials(m.name)}</span>
                <span className="flex-1 text-[12px] font-semibold text-slate-700">{m.name}</span>
                <span className="text-[10.5px] text-slate-400">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VitalsTab({ data }: { data?: OsPatient }) {
  const cards = data ? [
    { label: "Blood Pressure", value: data.vitals.bp ?? "—", unit: "mmHg", color: "#0078d4" },
    { label: "Heart Rate", value: data.vitals.hr != null ? String(data.vitals.hr) : "—", unit: "bpm", color: "#D13438" },
    { label: "SpO₂", value: data.vitals.spo2 != null ? `${data.vitals.spo2}%` : "—", unit: "SpO₂", color: "#16a34a" },
    { label: "Temperature", value: data.vitals.temp != null ? `${data.vitals.temp}°` : "—", unit: "°C", color: "#CA5010" },
    { label: "Resp Rate", value: data.vitals.rr != null ? String(data.vitals.rr) : "—", unit: "br/min", color: "#8764B8" },
  ] : VITAL_CARDS;
  const history = data
    ? data.vitalsHistory.map((v) => ({ t: v.date, bp: v.bp, hr: v.hr != null ? String(v.hr) : "—", spo2: v.spo2 != null ? `${v.spo2}%` : "—", temp: v.temp != null ? `${v.temp}°` : "—", rr: v.rr != null ? String(v.rr) : "—", src: "Encounter", flag: v.flag }))
    : VITALS_TABLE;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((v) => (
          <div key={v.label} className={`${card} p-3`}>
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-semibold text-slate-500">{v.label}</span>
              <span className="text-[9.5px] text-slate-400">{data?.vitals.capturedTs ?? "10:15 AM"}</span>
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-[20px] font-extrabold text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>{v.value}</span>
              <span className="text-[11px] text-slate-400">{v.unit}</span>
            </div>
            <div className="mt-1"><Spark color={v.color} /></div>
          </div>
        ))}
      </div>
      <div className={`${card} p-3`}>
        <PanelHead title="Historical Readings" action="View Full History" />
        {history.length === 0 && <div className="py-4 text-center text-[11.5px] text-slate-400">No vitals recorded.</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[11.5px]">
            <thead><tr className={th}>
              <th className={cellHead}>Date &amp; Time</th><th className={cellHead}>BP</th><th className={cellHead}>HR</th><th className={cellHead}>SpO2</th><th className={cellHead}>Temp</th><th className={cellHead}>RR</th><th className="pb-1.5 font-bold">Source</th>
            </tr></thead>
            <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
              {history.map((r, i) => (
                <tr key={i} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3 text-slate-600">{r.t}</td>
                  <td className="py-1.5 pr-3" style={{ color: r.flag ? "#D13438" : "#334155", fontWeight: r.flag ? 700 : 400 }}>{r.bp}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{r.hr}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{r.spo2}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{r.temp}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{r.rr}</td>
                  <td className="py-1.5 text-slate-400">{r.src}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LabsTab({ data }: { data?: OsPatient }) {
  const labTone = (s: string) => (/critical/i.test(s) ? "#D13438" : /high|low/i.test(s) ? "#CA5010" : "#16a34a");
  return (
    <div className={`${card} p-3`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <FilterChip icon={Calendar} label="Recent" />
        <FilterChip icon={Filter} label="All Results" />
        <FilterChip icon={FlaskConical} label="All Sources" />
        <button type="button" className="ml-auto flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600"><Download size={13} /> Download</button>
      </div>
      {data && data.labs.length === 0 && <div className="py-6 text-center text-[11.5px] text-slate-400">No lab results for this patient.</div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[11.5px]">
          <thead><tr className={th}>
            <th className={cellHead}>Test</th><th className={cellHead}>Result</th><th className={cellHead}>Unit</th><th className={cellHead}>Reference Range</th><th className={cellHead}>Status</th><th className={cellHead}>Trend</th><th className="pb-1.5 font-bold">Collected On</th>
          </tr></thead>
          <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
            {data
              ? data.labs.map((r) => {
                const tone = labTone(r.status);
                return (
                  <tr key={r.test + r.date} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{r.test}</td>
                    <td className="py-1.5 pr-3 font-bold" style={{ color: tone }}>{r.result}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.unit}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.range}</td>
                    <td className="py-1.5 pr-3"><Pill tone={tone}>{r.status}</Pill></td>
                    <td className="py-1.5 pr-3"><Spark color={tone} /></td>
                    <td className="py-1.5 text-slate-400">{r.date}</td>
                  </tr>
                );
              })
              : LAB_GROUPS.map((g) => (
                <Fragment key={g.group}>
                  <tr><td colSpan={7} className="pb-1 pt-3 text-[11px] font-bold text-[#0c3b63]">{g.group}</td></tr>
                  {g.rows.map((r) => {
                    const tone = LAB_STATUS_TONE[r.status as keyof typeof LAB_STATUS_TONE];
                    return (
                      <tr key={r.test} className="border-t border-black/[0.05]">
                        <td className="py-1.5 pr-3 font-semibold text-slate-700">{r.test}</td>
                        <td className="py-1.5 pr-3 font-bold" style={{ color: tone }}>{r.result}</td>
                        <td className="py-1.5 pr-3 text-slate-500">{r.unit}</td>
                        <td className="py-1.5 pr-3 text-slate-500">{r.range}</td>
                        <td className="py-1.5 pr-3"><Pill tone={tone}>{r.status}</Pill></td>
                        <td className="py-1.5 pr-3"><Spark color={tone} /></td>
                        <td className="py-1.5 text-slate-400">13 May 2024</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ImagingTab({ data }: { data?: OsPatient }) {
  const studies = data
    ? data.imaging.map((im) => ({ name: im.name, date: im.date, finding: im.type, report: `Document type: ${im.type}. Stored in the patient record.`, active: false, uri: im.uri }))
    : IMAGING_STUDIES.map((s) => ({ ...s, uri: null as string | null }));
  const [sel, setSel] = useState(0);
  if (data && studies.length === 0) {
    return (
      <div className={`${card} p-6 text-center`}>
        <ScanLine size={26} className="mx-auto mb-2 text-slate-300" />
        <div className="text-[12.5px] font-semibold text-slate-500">No imaging studies on record</div>
        <div className="text-[11px] text-slate-400">Radiology documents for this patient will appear here.</div>
      </div>
    );
  }
  const study = studies[Math.min(sel, studies.length - 1)];
  const selTone = study.finding === "Abnormal" ? "#D13438" : "#16a34a";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip icon={ScanLine} label="All Modalities" />
        <FilterChip icon={Calendar} label="Recent" />
        <FilterChip icon={Filter} label="All Status" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="mb-2 text-[12px] font-bold text-[#0c3b63]">Imaging Studies ({studies.length})</div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {studies.map((s, i) => {
              const tone = s.finding === "Abnormal" ? "#D13438" : "#16a34a";
              return (
                <button key={s.name + i} type="button" data-fn onClick={() => setSel(i)} className={`${card} overflow-hidden text-left transition ${i === sel ? "ring-2 ring-[#0078d4]" : ""}`}>
                  <div className="grid h-20 place-items-center bg-[linear-gradient(135deg,#1e293b,#0f172a)] text-slate-500"><ScanLine size={22} /></div>
                  <div className="p-2">
                    <div className="truncate text-[11px] font-semibold text-slate-700">{s.name}</div>
                    <div className="text-[9.5px] text-slate-400">{s.date}</div>
                    <div className="mt-1"><Pill tone={tone}>{data ? s.finding : `AI: ${s.finding}`}</Pill></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className={`${card} p-3`}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-bold text-slate-700">{study.name}</span>
            <span className="text-[10px] text-slate-400">{study.date}</span>
          </div>
          <div className="grid h-40 place-items-center rounded-lg bg-[linear-gradient(135deg,#1e293b,#0f172a)] text-slate-500"><Activity size={30} /></div>
          <div className="mt-2 rounded-lg border p-2.5" style={{ borderColor: `${selTone}30`, background: `${selTone}0d` }}>
            <div className="mb-1 flex items-center gap-1.5"><Sparkles size={13} className="text-[#0a5aa8]" /><span className="text-[11.5px] font-bold text-slate-700">{data ? "Details" : "AI Findings"}</span><Pill tone={selTone}>{study.finding}</Pill></div>
            <p className="text-[11px] leading-snug text-slate-600">{study.report}</p>
            {data && study.uri && <a href={study.uri} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#0078d4]"><ExternalLink size={11} /> Open document</a>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MedsTab({ data }: { data?: OsPatient }) {
  const meds = data ? data.medications.map((m) => ({ name: m.name, dose: m.dose, freq: "—", route: "—", by: "—", start: "—" })) : MEDS_ACTIVE;
  return (
    <div className="space-y-3">
      {!data && (
        <div className="flex items-center gap-2 rounded-xl border border-[rgba(209,52,56,.2)] bg-[rgba(209,52,56,.06)] px-3 py-2">
          <TriangleAlert size={15} className="shrink-0 text-[#D13438]" />
          <span className="flex-1 text-[11.5px] text-slate-600"><b className="text-[#b91c1c]">Potential Drug Interaction Detected</b> — Clopidogrel may interact with Omeprazole and reduce antiplatelet effect.</span>
          <button type="button" className="shrink-0 rounded-md border border-[rgba(209,52,56,.3)] bg-white px-2 py-1 text-[10.5px] font-semibold text-[#b91c1c]">View Details</button>
        </div>
      )}
      <div className={`${card} p-3`}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12.5px] font-bold text-[#0c3b63]">Active Medications ({meds.length})</h3>
          <button type="button" className="flex items-center gap-1 text-[11px] font-semibold text-[#0078d4]"><Plus size={13} /> Add Medication</button>
        </div>
        {meds.length === 0 && <div className="py-6 text-center text-[11.5px] text-slate-400">No active medications.</div>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[11.5px]">
            <thead><tr className={th}>
              <th className={cellHead}>Medication</th><th className={cellHead}>Dose</th><th className={cellHead}>Frequency</th><th className={cellHead}>Route</th><th className={cellHead}>Prescribed By</th><th className={cellHead}>Start Date</th><th className="pb-1.5 font-bold">Status</th>
            </tr></thead>
            <tbody>
              {meds.map((m) => (
                <tr key={m.name} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3 font-semibold text-slate-700">{m.name}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{m.dose}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{m.freq}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{m.route}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{m.by}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{m.start}</td>
                  <td className="py-1.5"><Pill tone="#16a34a">Active</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {!data && (
        <div className={`${card} p-3`}>
          <PanelHead title="Medication History" />
          <div className="space-y-2">
            {MEDS_HISTORY.map((m, i) => (
              <div key={i} className="flex items-start gap-2.5 border-t border-black/[0.05] pt-2 first:border-0 first:pt-0">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: m.discontinued ? "#cbd5e1" : "#0078d4" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-[12px] font-semibold text-slate-700">{m.name}</span>{m.discontinued && <Pill tone="#D13438">Discontinued</Pill>}</div>
                  <div className="text-[11px] text-slate-500">{m.detail}</div>
                </div>
                <span className="shrink-0 text-[10px] text-slate-400">{m.when}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProceduresTab() {
  return (
    <div className="space-y-3">
      <div className={`${card} p-3`}>
        <PanelHead title="Performed Procedures" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-[11.5px]">
            <thead><tr className={th}>
              <th className={cellHead}>Date</th><th className={cellHead}>Procedure</th><th className={cellHead}>Type</th><th className={cellHead}>Performed By</th><th className={cellHead}>Notes</th><th className="pb-1.5 font-bold">Outcome</th>
            </tr></thead>
            <tbody>
              {PROC_DONE.map((p) => (
                <tr key={p.name} className="border-t border-black/[0.05] align-top">
                  <td className="py-1.5 pr-3 text-slate-500">{p.date}</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-700">{p.name}</td>
                  <td className="py-1.5 pr-3"><Pill tone="#0078d4">{p.type}</Pill></td>
                  <td className="py-1.5 pr-3 text-slate-500">{p.by}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{p.note}</td>
                  <td className="py-1.5"><Pill tone={p.tone}>{p.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className={`${card} p-3`}>
        <PanelHead title="Upcoming / Scheduled Procedures" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[11.5px]">
            <thead><tr className={th}>
              <th className={cellHead}>Date</th><th className={cellHead}>Procedure</th><th className={cellHead}>Type</th><th className={cellHead}>Planned By</th><th className={cellHead}>Priority</th><th className="pb-1.5 font-bold">Status</th>
            </tr></thead>
            <tbody>
              {PROC_UPCOMING.map((p) => (
                <tr key={p.name} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3 text-slate-500">{p.date}</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-700">{p.name}</td>
                  <td className="py-1.5 pr-3"><Pill tone="#0078d4">{p.type}</Pill></td>
                  <td className="py-1.5 pr-3 text-slate-500">{p.by}</td>
                  <td className="py-1.5 pr-3"><Pill tone={p.ptone}>{p.priority}</Pill></td>
                  <td className="py-1.5"><Pill tone="#0078d4">Scheduled</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ data }: { data?: OsPatient }) {
  const [folder, setFolder] = useState("All Documents");
  const [q, setQ] = useState("");
  const liveDocs = data ? data.documents.map((d) => ({ name: d.name, cat: d.category, on: d.date, by: "System", uri: d.uri })) : null;
  const liveFolders = liveDocs
    ? [{ name: "All Documents", count: liveDocs.length }, ...Array.from(new Set(liveDocs.map((d) => d.cat))).map((c) => ({ name: c, count: liveDocs.filter((d) => d.cat === c).length }))]
    : DOC_FOLDERS;
  const source = liveDocs ?? DOCS.map((d) => ({ ...d, uri: null as string | null }));
  const rows = source.filter((d) => (folder === "All Documents" || d.cat === folder) && d.name.toLowerCase().includes(q.toLowerCase()));
  const total = (liveFolders.find((f) => f.name === folder)?.count) ?? rows.length;
  return (
    <div className={`${card} p-3`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[12.5px] font-bold text-[#0c3b63]">Documents</h3>
        <div className="flex gap-1.5">
          <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600"><Download size={13} /> Upload Document</button>
          <button type="button" className="flex items-center gap-1 rounded-lg bg-[#0078d4] px-2.5 py-1.5 text-[11px] font-semibold text-white"><Plus size={13} /> New Folder</button>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[190px_1fr]">
        <div className="space-y-0.5">
          {liveFolders.map((f) => {
            const on = folder === f.name;
            return (
              <button key={f.name} type="button" data-fn onClick={() => setFolder(f.name)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[11.5px] font-medium transition"
                style={{ color: on ? "#004578" : "#4b5563", background: on ? "rgba(0,120,212,.1)" : "transparent" }}>
                <Folder size={13} className="text-slate-400" />
                <span className="flex-1 truncate">{f.name}</span>
                {f.count != null && <span className="text-[10px] text-slate-400">{f.count}</span>}
              </button>
            );
          })}
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2">
            <label className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 text-slate-400">
              <Search size={13} /><input value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search documents..." />
            </label>
            <FilterChip icon={Filter} label="Filter" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[11.5px]">
              <thead><tr className={th}>
                <th className={cellHead}>Document Name</th><th className={cellHead}>Category</th><th className={cellHead}>Uploaded On</th><th className={cellHead}>Uploaded By</th><th className="pb-1.5 font-bold">Actions</th>
              </tr></thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.name + d.on} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3"><span className="flex items-center gap-2 font-semibold text-slate-700"><FileText size={13} className="text-[#D13438]" /> {d.name}</span></td>
                    <td className="py-1.5 pr-3 text-slate-500">{d.cat}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{d.on}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{d.by}</td>
                    <td className="py-1.5"><div className="flex gap-2 text-slate-400"><Eye size={14} /><Download size={14} /><MoreHorizontal size={14} /></div></td>
                  </tr>
                ))}
                {rows.length === 0 && (<tr><td colSpan={5} className="py-4 text-center text-[11px] text-slate-400">{data ? "No documents on record." : "No documents match."}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10.5px] text-slate-400">
            <span>Showing {rows.length} of {total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarePlanTab() {
  const statusTone = (s: string) => (s === "Pending" ? "#CA5010" : "#0078d4");
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className={`${card} p-3`}>
          <PanelHead title="Care Plan Summary" />
          <div className="space-y-2">
            {CP_SUMMARY.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{s.label}</span>
                <span className="text-[12px] font-semibold text-slate-700">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={`${card} p-3`}>
          <PanelHead title="Goals" />
          <div className="space-y-2.5">
            {CP_GOALS.map((g) => (
              <div key={g.goal}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-slate-700">{g.goal}</span>
                  <span className="shrink-0 text-[11px] font-bold text-slate-500">{g.pct}%</span>
                </div>
                <Bar pct={g.pct} tone="#0078d4" />
                <div className="mt-0.5 text-[9.5px] text-slate-400">Target: {g.target}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={`${card} p-3`}>
          <PanelHead title="Care Team" />
          <div className="space-y-2">
            {CP_TEAM.map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[10px] font-bold text-[#0078d4]">{initials(m.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-slate-700">{m.name}</div>
                  <div className="text-[10px] text-slate-400">{m.role}</div>
                </div>
                {m.badge && <Pill tone={m.badge === "Lead" ? "#8764B8" : "#0078d4"}>{m.badge}</Pill>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={`${card} p-3`}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12.5px] font-bold text-[#0c3b63]">Interventions &amp; Tasks</h3>
          <button type="button" className="flex items-center gap-1 text-[11px] font-semibold text-[#0078d4]"><Plus size={13} /> Add Intervention</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[11.5px]">
            <thead><tr className={th}>
              <th className={cellHead}>Intervention / Task</th><th className={cellHead}>Type</th><th className={cellHead}>Frequency</th><th className={cellHead}>Assigned To</th><th className={cellHead}>Target</th><th className={cellHead}>Progress</th><th className="pb-1.5 font-bold">Status</th>
            </tr></thead>
            <tbody>
              {CP_TASKS.map((t) => (
                <tr key={t.task} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3 font-semibold text-slate-700">{t.task}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{t.type}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{t.freq}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{t.who}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{t.target}</td>
                  <td className="py-1.5 pr-3"><div className="flex items-center gap-1.5"><Bar pct={t.pct} tone={t.pct >= 60 ? "#16a34a" : "#CA5010"} /><span className="w-8 text-[10px] font-bold text-slate-500">{t.pct}%</span></div></td>
                  <td className="py-1.5"><Pill tone={statusTone(t.status)}>{t.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EncountersTab({ data }: { data?: OsPatient }) {
  const encTone = (s: string) => (/emergency|admit/i.test(s) ? "#D13438" : /discharge|complete/i.test(s) ? "#16a34a" : "#0078d4");
  const rows = data
    ? data.encounters.map((e) => ({ type: e.type, dept: e.department, by: "—", date: `${e.date} ${e.time}`, note: e.status, tone: encTone(e.status) }))
    : ENCOUNTERS;
  return (
    <div className={`${card} p-3`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[12.5px] font-bold text-[#0c3b63]">Encounter History</h3>
        <button type="button" className="text-[11px] font-semibold text-[#0078d4] hover:underline">View All Encounters</button>
      </div>
      {rows.length === 0 && <div className="py-6 text-center text-[11.5px] text-slate-400">No encounters recorded.</div>}
      <div className="space-y-0">
        {rows.map((e, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center pt-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white" style={{ background: e.tone }} />
              {i < rows.length - 1 && <span className="my-0.5 w-px flex-1 bg-black/[0.09]" />}
            </div>
            <div className="flex-1 border-b border-black/[0.05] pb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={e.tone}>{e.type}</Pill>
                <span className="text-[11px] font-semibold text-slate-600">{e.dept}</span>
                <span className="text-[10px] text-slate-400">· {e.by}</span>
                <span className="ml-auto text-[10px] text-slate-400">{e.date}</span>
              </div>
              <p className="mt-1 text-[11.5px] text-slate-600">{e.note}</p>
            </div>
          </div>
        ))}
      </div>
      {!data && (
        <div className="mt-2 flex items-center justify-between text-[10.5px] text-slate-400">
          <span>Showing 1 to 5 of 28 encounters</span>
          <div className="flex items-center gap-1">
            {["1", "2", "3", "4", "5", "6", "…"].map((p, i) => (
              <span key={i} className="grid h-6 min-w-6 place-items-center rounded-md px-1.5 font-semibold" style={{ background: i === 0 ? "#0078d4" : "transparent", color: i === 0 ? "#fff" : "#64748b" }}>{p}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NotesTab({ data }: { data?: OsPatient }) {
  const notes = data
    ? data.notes.map((n) => ({ kind: n.kind === "SOAP" ? "SOAP Note" : n.kind, dept: n.status, when: n.date, by: n.author, tone: n.status === "APPROVED" ? "#16a34a" : "#CA5010", excerpt: (n.excerpt || "").slice(0, 90), body: n.excerpt || "No content." }))
    : NOTES_LIST;
  const [sel, setSel] = useState(0);
  const note = notes[Math.min(sel, Math.max(0, notes.length - 1))];
  const isSoap = !data && !!note && note.kind === "SOAP Note";
  const isDraft = !!note && (isSoap || note.kind.includes("Draft"));
  if (data && notes.length === 0) {
    return <div className={`${card} p-6 text-center text-[11.5px] text-slate-400`}>No clinical notes for this patient.</div>;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-[290px_1fr]">
      <div className={`${card} p-3`}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12.5px] font-bold text-[#0c3b63]">Clinical Notes</h3>
          <button type="button" className="flex items-center gap-1 text-[11px] font-semibold text-[#0078d4]"><Plus size={13} /> New Note</button>
        </div>
        <label className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 text-slate-400">
          <Search size={13} /><input className="w-full bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-slate-400" placeholder="Search notes..." />
        </label>
        <div className="space-y-1.5">
          {notes.map((n, i) => (
            <button key={n.kind + n.when} type="button" data-fn onClick={() => setSel(i)} className="w-full rounded-lg border p-2 text-left transition"
              style={{ borderColor: i === sel ? "rgba(0,120,212,.4)" : "rgba(0,0,0,.06)", background: i === sel ? "rgba(0,120,212,.05)" : "rgba(255,255,255,.6)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-700">{n.kind}</span>
                <Pill tone={n.tone}>{n.dept}</Pill>
              </div>
              <div className="text-[10px] text-slate-400">{n.when} · {n.by}</div>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{n.excerpt}</p>
            </button>
          ))}
        </div>
      </div>
      <div className={`${card} flex flex-col p-3`}>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <span className="text-[12.5px] font-bold text-slate-700">{note.kind}</span>
            {isDraft && <Pill tone="#CA5010"><span className="ml-1">Draft</span></Pill>}
            <div className="text-[10px] text-slate-400">{note.when} · {note.dept} · {note.by}</div>
          </div>
          <button type="button" className="flex items-center gap-1 rounded-lg border border-[rgba(0,120,212,.3)] bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-[#0a5aa8]"><Sparkles size={13} /> Generate Summary</button>
        </div>
        <div className="space-y-2.5">
          {isSoap ? SOAP.map((s) => (
            <div key={s.k} className="flex gap-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.12)] text-[12px] font-extrabold text-[#0078d4]">{s.k}</span>
              <div className="flex-1 rounded-lg border border-black/[0.06] bg-white/60 p-2.5">
                <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{s.label}</div>
                <p className="text-[11.5px] leading-snug text-slate-600">{s.body}</p>
              </div>
            </div>
          )) : (
            <div className="rounded-lg border border-black/[0.06] bg-white/60 p-3">
              <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Note</div>
              <p className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-slate-600">{note.body}</p>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-black/[0.06] pt-2.5">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-500"><Mic size={15} /></button>
          <button type="button" className="rounded-lg border border-black/[0.08] bg-white/70 px-3 py-1.5 text-[11.5px] font-semibold text-slate-600">Save Draft</button>
          <button type="button" className="rounded-lg bg-[#0078d4] px-3 py-1.5 text-[11.5px] font-semibold text-white">Sign Note</button>
        </div>
      </div>
    </div>
  );
}

function PatientOverview({ data }: { data?: OsPatient }) {
  const vitalCards = data
    ? [
      { label: "Blood Pressure", short: "BP", value: data.vitals.bp ?? "—", unit: "mmHg", color: "#0078d4" },
      { label: "Heart Rate", short: "HR", value: data.vitals.hr != null ? String(data.vitals.hr) : "—", unit: "bpm", color: "#D13438" },
      { label: "SpO₂", short: "SpO₂", value: data.vitals.spo2 != null ? `${data.vitals.spo2}%` : "—", unit: "SpO₂", color: "#16a34a" },
      { label: "Temp", short: "Temp", value: data.vitals.temp != null ? `${data.vitals.temp}°` : "—", unit: "°C", color: "#CA5010" },
      { label: "Resp Rate", short: "RR", value: data.vitals.rr != null ? String(data.vitals.rr) : "—", unit: "br/min", color: "#8764B8" },
    ]
    : VITAL_CARDS.map((v, i) => ({ label: v.label, short: VITAL_SHORT[i], value: v.value, unit: v.unit, color: v.color }));
  const labs = data ? data.labs : LATEST_LABS.map((l) => ({ test: l.test, value: l.value, status: l.status, date: "" }));
  const meds = data ? data.medications.map((m) => ({ name: m.name, dose: m.dose, freq: "", route: "" })) : MEDS_OV;
  const problems = data ? data.problems.map((p, i) => ({ name: p.name, primary: i === 0 })) : PROBLEMS_OV;
  const careTeam = data ? data.careTeam : CARE_TEAM_OV;
  const encounters = data
    ? data.encounters.map((e) => ({ date: e.date, time: e.time, kind: e.type, tag: e.department, detail: e.status, tone: "#0078d4", icon: Stethoscope }))
    : RECENT_ENC;
  const labTone = (s: string) => (/critical/i.test(s) ? "#D13438" : /high|low/i.test(s) ? "#CA5010" : "#16a34a");
  const summaryText = data
    ? (data.summary || `${data.name} · ${data.age ?? "—"} ${data.gender ?? ""}. ${data.problems.length ? `Active problems: ${data.problems.map((p) => p.name).join(", ")}.` : "No active problems recorded."} ${data.department !== "—" ? `Latest encounter: ${data.department}.` : ""}`.trim())
    : "Ahmed is a 58-year-old male admitted with NSTEMI. He has a history of Type 2 Diabetes Mellitus, Hypertension and Hyperlipidemia. Currently in ICU on dual antiplatelet therapy. Troponin levels are elevated. Hemodynamically stable.";
  const riskColor = data ? (data.riskLevel === "High" ? "#D13438" : data.riskLevel === "Moderate" ? "#CA5010" : "#16a34a") : "#D13438";
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_1.5fr_1fr]">
        <div className={`${card} p-3`}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#0a5aa8]"><Sparkles size={13} /> Clinical Summary (AI)</span>
            <span className="text-[9.5px] text-slate-400">{data ? "Live" : "Generated 2 min ago"}</span>
          </div>
          <p className="text-[11.5px] leading-relaxed text-slate-600">{summaryText}</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/70 p-2">
              <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Risk Level</div>
              <div className="text-[16px] font-extrabold" style={{ color: riskColor }}>{data ? data.riskLevel : "85%"}</div>
              <div className="text-[10px] font-semibold" style={{ color: riskColor }}>{data ? `${data.abnormalLabs} abnormal labs` : "High"}</div>
            </div>
            <div className="rounded-lg bg-white/70 p-2">
              <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Active Problems</div>
              <div className="text-[16px] font-extrabold text-[#CA5010]">{data ? problems.length : "36%"}</div>
              <div className="text-[10px] font-semibold text-[#CA5010]">{data ? "conditions" : "Moderate"}</div>
            </div>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-bold text-[#0c3b63]">Latest Vitals</span>
            <span className="text-[10px] text-slate-400">{data?.vitals.capturedTs ?? "10:15 AM"}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {vitalCards.map((v) => (
              <div key={v.label} className="rounded-lg border border-black/[0.05] bg-white/60 p-2 text-center">
                <div className="text-[9.5px] font-semibold text-slate-400">{v.short}</div>
                <div className="text-[13.5px] font-extrabold text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>{v.value}</div>
                <div className="text-[8.5px] text-slate-400">{v.unit}</div>
                <div className="mt-0.5 flex justify-center"><Spark color={v.color} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Care Team" action="View All" />
          <div className="space-y-1.5">
            {careTeam.length === 0 && <div className="text-[11px] text-slate-400">No care team assigned.</div>}
            {careTeam.map((m) => (
              <div key={m.name} className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[10px] font-bold text-[#0078d4]">{initials(m.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-semibold text-slate-700">{m.name}</div>
                  <div className="text-[10px] text-slate-400">{m.role}</div>
                </div>
                {m.badge && <Pill tone="#16a34a">{m.badge}</Pill>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${card} p-3`}>
          <PanelHead title="Latest Labs" action="View All" />
          <div className="space-y-1">
            {labs.length === 0 && <div className="text-[11px] text-slate-400">No lab results.</div>}
            {labs.map((l) => (
              <div key={l.test} className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="flex-1 truncate font-semibold text-slate-700">{l.test}</span>
                <span className="text-slate-500">{l.value}</span>
                <Pill tone={data ? labTone(l.status) : LAB_STATUS_TONE[l.status as keyof typeof LAB_STATUS_TONE]}>{l.status}</Pill>
              </div>
            ))}
          </div>
          {labs[0] && "date" in labs[0] && labs[0].date && <div className="mt-1.5 text-[9.5px] text-slate-400">{labs[0].date}</div>}
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Recent Imaging" action="View All" />
          <div className="space-y-1.5">
            {data && data.imaging.length === 0 && <div className="text-[11px] text-slate-400">No imaging on record.</div>}
            {(data ? data.imaging.map((im) => ({ name: im.name, date: im.date, finding: im.type })) : RECENT_IMAGING).map((im) => (
              <div key={im.name} className="flex items-center gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[linear-gradient(135deg,#1e293b,#0f172a)] text-slate-500"><ScanLine size={15} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11.5px] font-semibold text-slate-700">{im.name}</div>
                  <div className="text-[9.5px] text-slate-400">{im.date}</div>
                </div>
                <Pill tone={im.finding === "Abnormal" ? "#D13438" : "#16a34a"}>{im.finding}</Pill>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12.5px] font-bold text-[#0c3b63]">Active Medications ({meds.length})</h3>
          </div>
          <div className="space-y-1">
            {meds.length === 0 && <div className="text-[11px] text-slate-400">No active medications.</div>}
            {meds.map((m) => (
              <div key={m.name} className="flex items-center justify-between gap-1 text-[11.5px]">
                <span className="flex-1 truncate font-semibold text-slate-700">{m.name}</span>
                <span className="text-slate-500">{m.dose}</span>
                <span className="w-7 text-right text-[10px] font-bold text-slate-400">{m.freq}</span>
                <span className="w-8 text-right text-[10px] text-slate-400">{m.route}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Current Problems" action="View All" />
          <ol className="space-y-1">
            {problems.length === 0 && <li className="text-[11px] text-slate-400">No active problems.</li>}
            {problems.map((p, i) => (
              <li key={p.name} className="flex items-center gap-2 text-[11.5px] text-slate-600">
                <span className="font-bold text-slate-400">{i + 1}.</span>
                <span className="flex-1">{p.name}</span>
                {p.primary && <Pill tone="#0078d4">Primary</Pill>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={`${card} p-3`}>
        <PanelHead title="Recent Encounters" action="View All" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {encounters.length === 0 && <div className="text-[11px] text-slate-400">No recent encounters.</div>}
          {encounters.map((e, i) => (
            <div key={i} className="flex items-stretch gap-2">
              <div className="w-[160px] shrink-0">
                <div className="text-[10px] text-slate-400">{e.date} {e.time}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: `${e.tone}1a`, color: e.tone }}><e.icon size={13} /></span>
                  <span className="text-[12px] font-bold text-slate-700">{e.kind}</span>
                </div>
                {e.tag && <div className="mt-0.5 text-[10px] font-semibold text-slate-400">{e.tag}</div>}
                <div className="mt-0.5 text-[10.5px] leading-snug text-slate-500">{e.detail}</div>
              </div>
              {i < encounters.length - 1 && <div className="mt-3 h-px w-5 shrink-0 self-start bg-black/10" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PatientsView({ search = "" }: { search?: string }) {
  const [tab, setTab] = useState("Overview");
  const [picked, setPicked] = useState<string | null>(null);
  const { data: list } = useOsPatients();
  const patients = list?.patients ?? [];
  const q = search.trim().toLowerCase();
  const filtered = q ? patients.filter((p) => p.name.toLowerCase().includes(q) || (p.mrn || "").toLowerCase().includes(q)) : patients;
  const pid = picked ?? filtered[0]?.patientId ?? patients[0]?.patientId ?? null;
  const { data: pt } = useOsPatient(pid);
  const riskColor = pt?.riskLevel === "High" ? "#D13438" : pt?.riskLevel === "Moderate" ? "#CA5010" : "#16a34a";
  const allergyText = pt?.allergies.map((a) => a.substance) ?? ["Penicillin", "Aspirin"];
  return (
    <div className="space-y-4">
      {/* patient header */}
      <div className={`${card} p-4`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-2xl text-[22px] font-extrabold text-white" style={{ background: "linear-gradient(150deg,#3a96e0,#0078d4)" }}>{pt ? initials(pt.name) : "AK"}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[18px] font-extrabold text-slate-800">{pt?.name ?? "Ahmed Khan"}</span>
              <span className="text-slate-400">{pt?.gender === "Female" ? "♀" : "♂"}</span>
              <Pill tone={riskColor}><span className="flex items-center gap-1"><TriangleAlert size={10} /> {pt ? `${pt.riskLevel} Risk` : "High Risk"}</span></Pill>
              {/* patient picker */}
              <div className="relative ml-1">
                <select data-fn value={pid ?? ""} onChange={(e) => setPicked(e.target.value)}
                  className="max-w-[220px] cursor-pointer rounded-lg border border-black/[0.1] bg-white/80 py-1 pl-2.5 pr-7 text-[12px] font-semibold text-slate-600 outline-none focus:border-[#0078d4]">
                  {filtered.map((p) => <option key={p.patientId} value={p.patientId}>{p.name} · {p.mrn}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-0.5 text-[12px] text-slate-500">{pt ? `${pt.age ?? "—"} Y · ${pt.gender ?? "—"} · MRN: ${pt.mrn ?? "—"} · ${pt.department}` : "58 Y · Male · MRN: CLN-00012345 · IPD: ICU-07"}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-slate-500">
              <span className="flex items-center gap-1"><Phone size={12} /> {pt?.mobile ?? "0300-1234567"}</span>
              <span className="text-slate-300">·</span><span>{pt?.bloodGroup ?? "B+"}</span>
              <span className="text-slate-300">·</span><span>{pt?.status ?? "Jubilee Health"}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Admitted / Arrival</div>
              <div className="text-[12.5px] font-semibold text-slate-700">{pt?.admittedOn ?? "10 May 2024"}</div>
              <div className="text-[10px] text-slate-400">{pt?.admittedTime ?? "09:30 AM"}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Attending Physician</div>
              <div className="text-[12.5px] font-semibold text-slate-700">{pt?.attendingPhysician ?? "Dr. Ahmed Ali"}</div>
              <div className="text-[10px] text-slate-400">{pt?.attendingDept ?? "Cardiology"}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Allergies</div>
              <div className="text-[12.5px] font-semibold text-[#D13438]">{allergyText[0] ?? "None"}</div>
              <div className="text-[10px] text-[#D13438]">{allergyText.slice(1).join(", ")}</div>
            </div>
            <div>
              <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Encounter Status</div>
              <div className="flex items-center gap-1 text-[12.5px] font-semibold text-slate-700">{pt?.status ?? "Full Code"}</div>
            </div>
          </div>
          <button type="button" aria-label="More options" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-x-5 gap-y-1 overflow-x-auto border-b border-black/[0.07]">
        {PATIENT_TABS.map((t) => (
          <button key={t} type="button" data-fn onClick={() => setTab(t)}
            className="relative shrink-0 whitespace-nowrap pb-2 text-[12.5px] font-semibold transition"
            style={{ color: tab === t ? "#0078d4" : "#6b7280" }}>
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-[#0078d4]" />}
          </button>
        ))}
      </div>

      {/* content */}
      <div>
        {tab === "Overview" && <PatientOverview data={pt} />}
        {tab === "Timeline" && <TimelineTab data={pt} />}
        {tab === "Vitals" && <VitalsTab data={pt} />}
        {tab === "Labs" && <LabsTab data={pt} />}
        {tab === "Imaging" && <ImagingTab data={pt} />}
        {tab === "Medications" && <MedsTab data={pt} />}
        {tab === "Procedures" && <ProceduresTab />}
        {tab === "Documents" && <DocumentsTab data={pt} />}
        {tab === "Care Plan" && <CarePlanTab />}
        {tab === "Encounters" && <EncountersTab data={pt} />}
        {tab === "Notes" && <NotesTab data={pt} />}
      </div>
    </div>
  );
}

function AdmissionsView() {
  const prio = (p: string) => (p === "High" ? "#D13438" : p === "Medium" ? "#CA5010" : "#16a34a");
  const qstat = (s: string) => (s === "Bed Pending" ? "#CA5010" : s === "Triage" ? "#0078d4" : "#8764B8");
  const done = CHECKLIST.filter((c) => c.done).length;
  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {ADM_KPIS.map((k) => (
          <div key={k.label} className={`${card} relative overflow-hidden p-3.5`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: k.color }} />
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${k.color}1a`, color: k.color }}><k.icon size={18} /></div>
            <div className="text-[22px] font-extrabold leading-none text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            <div className="mt-1 text-[11.5px] font-medium text-slate-500">{k.label}</div>
            <div className="mt-0.5 text-[10px] text-slate-400">{k.sub}</div>
            <div className="mt-1"><Spark color={k.color} /></div>
          </div>
        ))}
      </div>

      {/* queue + registration/insurance */}
      <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-[#0c3b63]">Admission Queue <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500">11</span></h3>
            <div className="flex items-center gap-1.5">
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Filter size={12} /> Filters</button>
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><RefreshCw size={12} /> Refresh</button>
              <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><MoreHorizontal size={15} /></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[11px]">
              <thead><tr className={th}>
                <th className={cellHead}>Priority</th><th className={cellHead}>Patient</th><th className={cellHead}>Age / Gender</th><th className={cellHead}>MRN</th><th className={cellHead}>Source</th><th className={cellHead}>Diagnosis / Reason</th><th className={cellHead}>Waiting</th><th className={cellHead}>Status</th><th className="pb-1.5 font-bold">Actions</th>
              </tr></thead>
              <tbody>
                {ADM_QUEUE.map((r) => (
                  <tr key={r.mrn} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3"><Pill tone={prio(r.priority)}>{r.priority}</Pill></td>
                    <td className="py-1.5 pr-3"><span className="font-semibold text-slate-700">{r.name} <span className="text-slate-400">{r.sex}</span></span></td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.age}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.mrn}</td>
                    <td className="py-1.5 pr-3"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{r.source}</span></td>
                    <td className="py-1.5 pr-3 text-slate-600">{r.reason}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.wait}</td>
                    <td className="py-1.5 pr-3"><Pill tone={qstat(r.status)}>{r.status}</Pill></td>
                    <td className="py-1.5"><div className="flex gap-2 text-slate-400"><Eye size={14} /><MoreHorizontal size={14} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="mx-auto mt-2 block text-[11px] font-semibold text-[#0078d4]">View All Queue →</button>
        </div>

        <div className="space-y-3">
          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-[#0c3b63]">Patient Registration</h3>
              <button type="button" className="flex items-center gap-1 text-[11px] font-semibold text-[#0078d4]"><Pencil size={12} /> Edit</button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {REG_FIELDS.map((f, i) => (
                <div key={i} className={f.full ? "col-span-2" : ""}>
                  <div className="mb-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{f.label || "\u00a0"}</div>
                  <div className="rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1.5 text-[11.5px] text-slate-700">{f.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-[#0c3b63]">Insurance Verification</h3>
              <Pill tone="#16a34a"><span className="flex items-center gap-1"><CheckSquare size={10} /> Verified</span></Pill>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {INSURANCE.map((x) => (
                <div key={x.label}>
                  <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{x.label}</div>
                  <div className="text-[12px] font-semibold text-slate-700">{x.value}</div>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">View Policy Details →</button>
          </div>
        </div>
      </div>

      {/* bed assignment + triage + checklist */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center gap-2"><BedDouble size={14} className="text-[#0078d4]" /><h3 className="text-[13px] font-bold text-[#0c3b63]">Bed Assignment</h3></div>
          <div className="mb-2 flex gap-3 border-b border-black/[0.06] text-[11.5px]">
            <span className="border-b-2 border-[#0078d4] pb-1 font-semibold text-[#0078d4]">Suggested Beds (3)</span>
            <span className="pb-1 text-slate-400">All Floors</span>
          </div>
          <div className="space-y-1.5">
            {BED_SUGGEST.map((b) => (
              <div key={b.bed} className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white/60 p-2">
                <BedDouble size={15} className="text-slate-400" />
                <div className="min-w-0 flex-1"><div className="text-[12px] font-semibold text-slate-700">{b.bed}</div><div className="text-[9.5px] text-slate-400">{b.loc}</div></div>
                <Pill tone="#16a34a">{b.status}</Pill>
                <span className="text-[10px] text-slate-400">{b.sex}</span>
                <button type="button" className="rounded-md bg-[#0078d4] px-2 py-1 text-[10.5px] font-semibold text-white">Assign</button>
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">View Bed Dashboard →</button>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center gap-2"><TriangleAlert size={14} className="text-[#CA5010]" /><h3 className="text-[13px] font-bold text-[#0c3b63]">Triage Status</h3></div>
          <div className="grid grid-cols-2 gap-2">
            {TRIAGE_STATUS.map((t) => (
              <div key={t.label} className="rounded-lg border p-2.5" style={{ borderColor: `${t.tone}30`, background: `${t.tone}0d` }}>
                <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: t.tone }} /><span className="text-[11px] font-semibold" style={{ color: t.tone }}>{t.label}</span></div>
                <div className="mt-1 text-[20px] font-extrabold text-slate-800">{t.count}</div>
                <div className="text-[9.5px] text-slate-400">{t.sub}</div>
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">View Triage Board →</button>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-1 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Admission Checklist</h3><span className="text-[10.5px] text-slate-400">{done} / {CHECKLIST.length} Completed</span></div>
          <div className="mb-2"><Bar pct={Math.round((done / CHECKLIST.length) * 100)} tone="#16a34a" /></div>
          <div className="space-y-1.5">
            {CHECKLIST.map((c) => (
              <div key={c.label} className="flex items-center gap-2">
                {c.done ? <CheckSquare size={15} className="text-[#16a34a]" /> : <span className="h-3.5 w-3.5 rounded border border-slate-300" />}
                <span className={`flex-1 text-[11.5px] ${c.done ? "text-slate-600" : "text-slate-400"}`}>{c.label}</span>
                {c.time && <span className="text-[10px] text-slate-400">{c.time}</span>}
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">Open Full Checklist →</button>
        </div>
      </div>

      {/* timeline + transfers */}
      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className={`${card} p-3`}>
          <div className="mb-3 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Admission Timeline</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View Full Journey →</button></div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {ADM_TIMELINE.map((e, i) => (
              <div key={i} className="flex items-start gap-1">
                <div className="w-[120px] shrink-0 text-center">
                  <div className="text-[9.5px] text-slate-400">{e.time || "—"}</div>
                  <div className="my-1 flex justify-center">{e.done ? <span className="grid h-6 w-6 place-items-center rounded-full bg-[#16a34a] text-white"><CheckSquare size={13} /></span> : <span className="h-6 w-6 rounded-full border-2 border-slate-300" />}</div>
                  <div className="text-[11px] font-bold text-slate-700">{e.kind}</div>
                  <div className="text-[9.5px] text-slate-400">{e.by}</div>
                </div>
                {i < ADM_TIMELINE.length - 1 && <div className="mt-[26px] h-0.5 w-5 shrink-0" style={{ background: e.done ? "#16a34a" : "#e2e8f0" }} />}
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-2 text-[13px] font-bold text-[#0c3b63]">Transfer Requests <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500">2</span></h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All →</button></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[11px]">
              <thead><tr className={th}><th className={cellHead}>Patient</th><th className={cellHead}>From</th><th className={cellHead}>To</th><th className={cellHead}>Reason</th><th className="pb-1.5 font-bold">Status</th></tr></thead>
              <tbody>
                {TRANSFERS.map((t) => (
                  <tr key={t.name} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{t.name}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{t.from}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{t.to}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{t.reason}</td>
                    <td className="py-1.5"><Pill tone={t.tone}>{t.status}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function CareTeamView() {
  const covTone = (s: number, c: number) => (s > c ? "#D13438" : s / c >= 0.92 ? "#CA5010" : "#16a34a");
  let acc = 0;
  const workloadGrad = WORKLOAD.map((w) => { const seg = `${w.color} ${acc}% ${acc + w.pct}%`; acc += w.pct; return seg; }).join(", ");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight text-[#0c3b63]">Care Team Overview</h1>
          <p className="text-[12px] text-slate-400">Real-time overview of hospital staffing and assignments</p>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {CT_KPIS.map((k) => (
          <div key={k.label} className={`${card} relative overflow-hidden p-3.5`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: k.color }} />
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${k.color}1a`, color: k.color }}><k.icon size={18} /></div>
            <div className="text-[22px] font-extrabold leading-none text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            <div className="mt-1 text-[11.5px] font-medium text-slate-500">{k.label}</div>
            <div className="mt-0.5 text-[10px] text-slate-400">{k.sub}</div>
            <div className="mt-1"><Spark color={k.color} /></div>
          </div>
        ))}
      </div>

      {/* roster + MDT */}
      <div className="grid gap-3 xl:grid-cols-[1.55fr_1fr]">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Care Team Roster <span className="text-[10.5px] font-normal text-slate-400">Total 12 staff</span></h3>
            <div className="flex items-center gap-1.5">
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Filter size={12} /> Filters</button>
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600">Department: All <ChevronDown size={11} /></button>
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600">Shift: All <ChevronDown size={11} /></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead><tr className={th}>
                <th className={cellHead}>Staff Name</th><th className={cellHead}>Role</th><th className={cellHead}>Department</th><th className={cellHead}>Shift</th><th className={cellHead}>Status</th><th className={cellHead}>Patients</th><th className="pb-1.5 font-bold">Contact</th>
              </tr></thead>
              <tbody>
                {CT_ROSTER.map((r) => (
                  <tr key={r.name} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3"><span className="flex items-center gap-2 font-semibold text-slate-700"><span className="grid h-6 w-6 place-items-center rounded-full bg-[rgba(0,120,212,.1)] text-[9px] font-bold text-[#0078d4]">{initials(r.name)}</span>{r.name}</span></td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.role}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.dept}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.shift}</td>
                    <td className="py-1.5 pr-3"><Pill tone="#16a34a">On Duty</Pill></td>
                    <td className="py-1.5 pr-3 font-semibold text-slate-600">{r.patients}</td>
                    <td className="py-1.5"><div className="flex gap-2 text-slate-400"><Phone size={13} /><MessageSquare size={13} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">View All Staff →</button>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Multidisciplinary Care Team</h3>
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-600">Patient: Ahmed Khan <ChevronDown size={11} /></button>
          </div>
          <div className="mb-2 text-[10px] text-slate-400">MRN: CLN-00012345 · ICU-07 · <span className="font-semibold text-[#D13438]">High Risk</span></div>
          <div className="space-y-1.5">
            {MDT.map((m) => (
              <div key={m.role} className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white/60 p-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[10px] font-bold text-[#0078d4]">{initials(m.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-slate-400">{m.role}</div>
                  <div className="text-[12px] font-semibold text-slate-700">{m.name}</div>
                </div>
                {m.tag ? <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0078d4] text-[9px] font-bold text-white">{m.tag}</span> : <span className="text-[10px] text-slate-400">{m.sub}</span>}
              </div>
            ))}
          </div>
          <button type="button" className="mt-2 text-[11px] font-semibold text-[#0078d4]">+ Add Team Member</button>
        </div>
      </div>

      {/* assignments + coverage + schedule */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Physician Assignments</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="space-y-1.5">
            {PHYS_ASSIGN.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[rgba(0,120,212,.1)] text-[9px] font-bold text-[#0078d4]">{initials(p.name)}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold text-slate-700">{p.name}</div><div className="truncate text-[9.5px] text-slate-400">{p.dept} · {p.patients} pts</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Nurse Assignments</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="space-y-1.5">
            {NURSE_ASSIGN.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[rgba(3,131,135,.12)] text-[9px] font-bold text-[#038387]">{initials(p.name)}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold text-slate-700">{p.name}</div><div className="truncate text-[9.5px] text-slate-400">{p.dept} · {p.patients} pts</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 text-[12.5px] font-bold text-[#0c3b63]">Patient Coverage Matrix</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[260px] text-left text-[10.5px]">
              <thead><tr className={th}><th className="pb-1 pr-2 font-bold">Unit</th><th className="pb-1 pr-2 font-bold">Day</th><th className="pb-1 pr-2 font-bold">Eve</th><th className="pb-1 font-bold">Night</th></tr></thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {COVERAGE.map((r) => (
                  <tr key={r.unit} className="border-t border-black/[0.05]">
                    <td className="py-1 pr-2 font-semibold text-slate-600">{r.unit}</td>
                    {r.shifts.map(([sV, cV], i) => (
                      <td key={i} className="py-1 pr-2 font-bold" style={{ color: covTone(sV, cV) }}>{sV} / {cV}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[9px] text-slate-500">
            {[["#16a34a", "Within Capacity"], ["#CA5010", "High Load"], ["#D13438", "Over Capacity"]].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Shift Scheduling</h3><button type="button" className="text-[10px] font-semibold text-[#0078d4]">View Calendar</button></div>
          <div className="mb-1 text-[10px] text-slate-400">May 12 - May 18, 2024</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-[10px]">
              <thead><tr className={th}><th className="pb-1 pr-2 font-bold">Shift</th>{SCHED_DAYS.map((d) => <th key={d} className="pb-1 pr-1.5 font-bold">{d}</th>)}</tr></thead>
              <tbody style={{ fontVariantNumeric: "tabular-nums" }}>
                {SHIFT_SCHED.map((r) => (
                  <tr key={r.shift} className="border-t border-black/[0.05]">
                    <td className="py-1 pr-2"><div className="font-semibold text-slate-600">{r.shift}</div><div className="text-[8.5px] text-slate-400">{r.time}</div></td>
                    {r.vals.map((v, i) => <td key={i} className="py-1 pr-1.5 text-slate-500">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* workload + comms + handoff */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className={`${card} p-3`}>
          <div className="mb-2 text-[12.5px] font-bold text-[#0c3b63]">Workload Distribution <span className="text-[10px] font-normal text-slate-400">Across Departments</span></div>
          <div className="flex items-center gap-4">
            <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${workloadGrad})` }}>
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center">
                <div><div className="text-[16px] font-extrabold text-slate-800">186</div><div className="text-[8.5px] text-slate-400">Total Staff</div></div>
              </div>
            </div>
            <div className="flex-1 space-y-1">
              {WORKLOAD.map((w) => (
                <div key={w.dept} className="flex items-center gap-1.5 text-[10.5px]">
                  <span className="h-2 w-2 rounded-full" style={{ background: w.color }} />
                  <span className="flex-1 text-slate-600">{w.dept}</span>
                  <span className="font-semibold text-slate-500">{w.pct}% ({w.count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 text-[12.5px] font-bold text-[#0c3b63]">Communication Center</div>
          <div className="mb-2 flex gap-3 border-b border-black/[0.06] text-[11px]">
            <span className="border-b-2 border-[#0078d4] pb-1 font-semibold text-[#0078d4]">All</span>
            <span className="pb-1 text-slate-400">Team Chat</span>
            <span className="pb-1 text-slate-400">Announcements</span>
            <span className="pb-1 text-slate-400">Alerts</span>
          </div>
          <div className="space-y-2">
            {COMMS.map((c, i) => (
              <div key={i} className="flex gap-2">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${c.tone}1a`, color: c.tone }}><c.icon size={14} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between"><span className="text-[11.5px] font-bold text-slate-700">{c.who}</span><span className="text-[9.5px] text-slate-400">{c.time}</span></div>
                  <p className="text-[11px] leading-snug text-slate-500">{c.msg}</p>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mx-auto mt-2 block text-[11px] font-semibold text-[#0078d4]">Open Communication Center →</button>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 text-[12.5px] font-bold text-[#0c3b63]">Handoff Status <span className="text-[10px] font-normal text-slate-400">Today Overview</span></div>
          <div className="flex items-center gap-4">
            <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(#16a34a 0 92%, #e2e8f0 92% 100%)" }}>
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-center">
                <div><div className="text-[16px] font-extrabold text-[#16a34a]">92%</div><div className="text-[8.5px] text-slate-400">Completed</div></div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {HANDOFF.map((h) => (
                <div key={h.label} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">{h.label}</span>
                  <span className="font-bold" style={{ color: h.tone }}>{h.value}</span>
                </div>
              ))}
            </div>
          </div>
          <button type="button" className="mx-auto mt-2 block text-[11px] font-semibold text-[#0078d4]">View Handoff Board →</button>
        </div>
      </div>
    </div>
  );
}

function LabsView() {
  const [labTab, setLabTab] = useState("Overview");
  const prioTone = (p: string) => (p === "STAT" ? "#8764B8" : p === "Urgent" ? "#CA5010" : p === "ASAP" ? "#CA8A04" : "#64748b");
  const sampTone = (s: string) => (s === "Results Ready" ? "#16a34a" : s === "In Process" ? "#0078d4" : "#CA5010");
  let acc = 0;
  const statusGrad = LAB_STATUS.map((s) => { const seg = `${s.color} ${acc}% ${acc + s.ring}%`; acc += s.ring; return seg; }).join(", ");
  const n = TAT_SERIES.length;
  const tatPts = TAT_SERIES.map((v, i) => `${(i / (n - 1)) * 520},${150 - (v / 90) * 150}`).join(" ");
  const goalY = 150 - (60 / 90) * 150;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight text-[#0c3b63]">Laboratory Dashboard</h1>
          <p className="text-[12px] text-slate-400">Real-time overview of laboratory operations</p>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {LAB_KPIS.map((k) => (
          <div key={k.label} className={`${card} relative overflow-hidden p-3.5`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: k.color }} />
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${k.color}1a`, color: k.color }}><k.icon size={18} /></div>
            <div className="text-[22px] font-extrabold leading-none text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
            <div className="mt-1 text-[11.5px] font-medium text-slate-500">{k.label}</div>
            <div className="mt-0.5 text-[10px] text-slate-400">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* tabs */}
      <div className="flex gap-x-5 gap-y-1 overflow-x-auto border-b border-black/[0.07]">
        {LAB_TABS.map((t) => (
          <button key={t} type="button" onClick={() => setLabTab(t)}
            className="relative shrink-0 whitespace-nowrap pb-2 text-[12.5px] font-semibold transition"
            style={{ color: labTab === t ? "#0078d4" : "#6b7280" }}>
            {t}
            {labTab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-[#0078d4]" />}
          </button>
        ))}
      </div>

      {labTab !== "Overview" ? (
        <div className={`${card} grid h-64 place-items-center text-center`}>
          <div>
            <FlaskConical size={30} className="mx-auto mb-2 text-slate-300" />
            <div className="text-[13px] font-bold text-[#0c3b63]">{labTab}</div>
            <div className="text-[11.5px] text-slate-400">This section is part of the LIS module.</div>
          </div>
        </div>
      ) : (
      <>
        {/* row 1: sample status + TAT + priority */}
        <div className="grid gap-3 xl:grid-cols-[1fr_1.35fr_1fr]">
          <div className={`${card} p-3`}>
            <h3 className="mb-2 text-[12.5px] font-bold text-[#0c3b63]">Sample Status</h3>
            <div className="flex items-center gap-3">
              <div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${statusGrad})` }}>
                <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-white text-center">
                  <div><div className="text-[17px] font-extrabold text-slate-800">1,248</div><div className="text-[8.5px] text-slate-400">Total Samples</div></div>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {LAB_STATUS.map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5 text-[10.5px]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="flex-1 text-slate-600">{s.label}</span>
                    <span className="font-semibold text-slate-500">{s.value} ({s.pct})</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 text-center text-[10px] text-slate-400">Total Samples (Today)</div>
          </div>

          <div className={`${card} p-3`}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[12.5px] font-bold text-[#0c3b63]">TAT Performance <span className="text-[10px] font-normal text-slate-400">(Average)</span></h3>
              <span className="text-[10px] font-semibold text-slate-400">Goal: &lt; 60 min</span>
            </div>
            <div className="mb-1 text-[22px] font-extrabold text-slate-800">58 min</div>
            <div className="flex gap-2">
              <div className="flex flex-col justify-between py-0.5 text-[8.5px] text-slate-400" style={{ height: 120 }}>
                <span>90 min</span><span>60 min</span><span>30 min</span><span>0 min</span>
              </div>
              <div className="flex-1">
                <svg viewBox="0 0 520 150" className="w-full" style={{ height: 120 }}>
                  {[0, 50, 100, 150].map((y) => <line key={y} x1="0" y1={y} x2="520" y2={y} stroke="#00000010" strokeWidth="1" />)}
                  <line x1="0" y1={goalY} x2="520" y2={goalY} stroke="#0078d4" strokeWidth="1.4" strokeDasharray="6 6" opacity="0.5" />
                  <polyline points={tatPts} fill="none" stroke="#0078d4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  {TAT_SERIES.map((v, i) => <circle key={i} cx={(i / (n - 1)) * 520} cy={150 - (v / 90) * 150} r="3.5" fill="#fff" stroke="#0078d4" strokeWidth="2" />)}
                </svg>
                <div className="mt-1 flex justify-between text-[8.5px] text-slate-400">
                  {TAT_XLABELS.map((x) => <span key={x}>{x}</span>)}
                </div>
              </div>
            </div>
          </div>

          <div className={`${card} p-3`}>
            <h3 className="mb-3 text-[12.5px] font-bold text-[#0c3b63]">Samples by Priority</h3>
            <div className="space-y-2.5">
              {SAMPLES_PRIORITY.map((p) => (
                <div key={p.label}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">{p.label}</span>
                    <span className="text-slate-400">{p.value} ({p.pct}%)</span>
                  </div>
                  <Bar pct={p.pct} tone={p.tone} />
                </div>
              ))}
            </div>
            <button type="button" className="mt-3 text-[11px] font-semibold text-[#0078d4]">View All Analytics →</button>
          </div>
        </div>

        {/* row 2: recent samples */}
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Recent Samples</h3>
            <div className="flex items-center gap-1.5">
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600">All Status <ChevronDown size={11} /></button>
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Calendar size={12} /> Today</button>
              <button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[11px]">
              <thead><tr className={th}>
                <th className={cellHead}>Sample ID</th><th className={cellHead}>Patient Name</th><th className={cellHead}>MRN</th><th className={cellHead}>Test / Profile</th><th className={cellHead}>Priority</th><th className={cellHead}>Collected On</th><th className={cellHead}>Status</th><th className={cellHead}>TAT</th><th className="pb-1.5 font-bold">Actions</th>
              </tr></thead>
              <tbody>
                {RECENT_SAMPLES.map((r) => (
                  <tr key={r.id} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{r.id}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{r.name}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.mrn}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{r.test}</td>
                    <td className="py-1.5 pr-3"><Pill tone={prioTone(r.prio)}>{r.prio}</Pill></td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.when}</td>
                    <td className="py-1.5 pr-3"><Pill tone={sampTone(r.status)}>{r.status}</Pill></td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.tat}</td>
                    <td className="py-1.5"><div className="flex gap-2 text-slate-400"><Eye size={14} /><MoreHorizontal size={14} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* row 3: critical / instruments / TAT dept / QC */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#0c3b63]"><TriangleAlert size={13} className="text-[#D13438]" /> Critical Results <span className="rounded-full bg-[rgba(209,52,56,.12)] px-1.5 text-[10px] font-bold text-[#D13438]">18</span></h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
            <div className="space-y-2">
              {CRITICAL_RESULTS.map((c) => (
                <div key={c.name} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D13438]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-semibold text-slate-700">{c.name}</div>
                    <div className="text-[10.5px] text-slate-500">{c.test}: <span className="font-semibold text-[#D13438]">{c.value}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-semibold text-slate-500">{c.loc}</div>
                    <div className="text-[9px] text-slate-400">{c.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Instrument Status</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
            <div className="space-y-1.5">
              {INSTRUMENTS.map((m) => (
                <div key={m.name} className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white/60 p-2">
                  <div className="min-w-0 flex-1"><div className="text-[11.5px] font-semibold text-slate-700">{m.name}</div><div className="text-[9.5px] text-slate-400">{m.dept}</div></div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: m.tone }}><span className="h-2 w-2 rounded-full" style={{ background: m.tone }} />{m.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${card} p-3`}>
            <h3 className="mb-3 text-[12.5px] font-bold text-[#0c3b63]">Test Turnaround Time by Department</h3>
            <div className="space-y-2.5">
              {TAT_BY_DEPT.map((d) => (
                <div key={d.dept}>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-600">{d.dept}</span>
                    <span className="text-slate-400">{d.min} min</span>
                  </div>
                  <Bar pct={(d.min / 90) * 100} tone={d.tone} />
                </div>
              ))}
            </div>
          </div>

          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Quality Control</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
            <div className="flex items-center gap-3">
              <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(#16a34a 0 95%, #CA8A04 95% 98%, #D13438 98% 100%)" }}>
                <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center">
                  <div><div className="text-[15px] font-extrabold text-[#16a34a]">95%</div><div className="text-[8px] text-slate-400">Within Range</div></div>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {QC_BREAKDOWN.map((q) => (
                  <div key={q.label} className="flex items-center gap-1.5 text-[10.5px]">
                    <span className="h-2 w-2 rounded-full" style={{ background: q.tone }} />
                    <span className="flex-1 text-slate-600">{q.label}</span>
                    <span className="font-semibold text-slate-500">{q.pct}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 text-center text-[10px] text-slate-400">Total QC Samples: 520</div>
          </div>
        </div>

        {/* footer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-[10.5px] text-slate-400">
          <span>Last updated: May 12, 2024 10:15 AM</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /> Auto refresh in 45 sec</span>
          <span className="ml-auto">LIS Version: 3.2.1</span>
        </div>
      </>
      )}
    </div>
  );
}

function CtSlice({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="200" fill="#0a0a0a" />
      <ellipse cx="100" cy="106" rx="82" ry="70" fill="#2f2f2f" stroke="#5f5f5f" strokeWidth="2" />
      <ellipse cx="100" cy="106" rx="74" ry="62" fill="#1c1c1c" />
      <ellipse cx="66" cy="100" rx="27" ry="42" fill="#0c0c0c" />
      <ellipse cx="134" cy="100" rx="27" ry="42" fill="#0c0c0c" />
      <ellipse cx="100" cy="122" rx="24" ry="30" fill="#6f6f6f" opacity="0.9" />
      <ellipse cx="106" cy="126" rx="15" ry="20" fill="#8f8f8f" opacity="0.75" />
      <ellipse cx="100" cy="120" rx="8" ry="12" fill="#3a3a3a" />
      <ellipse cx="100" cy="162" rx="11" ry="10" fill="#d6d6d6" />
      <rect x="96" y="150" width="8" height="8" rx="2" fill="#c2c2c2" />
      <rect x="96.5" y="52" width="7" height="7" rx="2" fill="#d6d6d6" />
      <circle cx="120" cy="112" r="3" fill="#cfcfcf" />
      <circle cx="86" cy="116" r="2.4" fill="#bcbcbc" />
      <path d="M40 96 A60 60 0 0 1 60 60" stroke="#4a4a4a" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  );
}

function RadiologyView() {
  const [wlTab, setWlTab] = useState("All");
  const [repTab, setRepTab] = useState("Report");
  const prio = (p: string) => (p === "STAT" ? "#D13438" : p === "High" ? "#CA5010" : "#16a34a");
  const rstat = (s: string) => (s === "In Review" ? "#0078d4" : s === "Acquired" ? "#8764B8" : s === "Ready" ? "#16a34a" : "#334155");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight text-[#0c3b63]">Radiology Command Center</h1>
          <p className="text-[12px] text-slate-400">Live overview of radiology operations</p>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
      </div>

      {/* queue KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {RAD_KPIS.map((k) => (
          <div key={k.label} className={`${card} flex items-center gap-3 p-3`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${k.color}1a`, color: k.color }}><k.icon size={19} /></span>
            <div className="min-w-0">
              <div className="text-[10.5px] font-medium leading-tight text-slate-500">{k.label}</div>
              <div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums", color: k.color === "#D13438" ? "#D13438" : "#1f2937" }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Imaging Worklist */}
      <div className={`${card} p-3`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Imaging Worklist</h3>
            <div className="flex items-center gap-3">
              {RAD_WL_TABS.map((t) => (
                <button key={t.label} type="button" onClick={() => setWlTab(t.label)} className="flex items-center gap-1 pb-1 text-[12px] font-semibold" style={{ color: wlTab === t.label ? "#0078d4" : "#64748b", borderBottom: wlTab === t.label ? "2px solid #0078d4" : "2px solid transparent" }}>
                  {t.label} <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{t.n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Filter size={12} /> Filters</button>
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Columns3 size={12} /> Columns</button>
            <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><RefreshCw size={13} /></button>
            <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><MoreHorizontal size={15} /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[11px]">
            <thead><tr className={th}>
              <th className={cellHead}>Priority</th><th className={cellHead}>Patient</th><th className={cellHead}>MRN</th><th className={cellHead}>Modality</th><th className={cellHead}>Study Description</th><th className={cellHead}>Ordered By</th><th className={cellHead}>Status</th><th className={cellHead}>SLA</th><th className="pb-1.5 font-bold">Alerts</th>
            </tr></thead>
            <tbody>
              {RAD_WORKLIST.map((r) => (
                <tr key={r.mrn} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3"><span className="flex items-center gap-1.5 font-bold" style={{ color: prio(r.prio) }}><span className="h-2 w-2 rounded-full" style={{ background: prio(r.prio) }} />{r.prio}</span></td>
                  <td className="py-1.5 pr-3"><div className="font-semibold text-slate-700">{r.name}</div><div className="text-[9.5px] text-slate-400">{r.age}</div></td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.mrn}</td>
                  <td className="py-1.5 pr-3"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{r.mod}</span></td>
                  <td className="py-1.5 pr-3 text-slate-600">{r.study}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.by}</td>
                  <td className="py-1.5 pr-3"><span className="font-semibold" style={{ color: rstat(r.status) }}>{r.status}</span></td>
                  <td className="py-1.5 pr-3 font-semibold" style={{ color: r.slaRed ? "#D13438" : "#64748b" }}>{r.sla}</td>
                  <td className="py-1.5">{r.alert && <TriangleAlert size={14} className="text-[#D13438]" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Showing 1 to 5 of 68 results</span>
          <div className="flex items-center gap-1">
            <button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><ChevronRight size={13} className="rotate-180" /></button>
            {[1, 2, 3, 4, 5].map((p) => (
              <button key={p} type="button" className="grid h-6 min-w-6 place-items-center rounded px-1.5 text-[11px] font-semibold" style={{ background: p === 1 ? "#0078d4" : "transparent", color: p === 1 ? "#fff" : "#64748b", border: p === 1 ? "none" : "1px solid rgba(0,0,0,.08)" }}>{p}</button>
            ))}
            <button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><ChevronRight size={13} /></button>
          </div>
        </div>
      </div>

      {/* Imaging Viewer */}
      <div className="overflow-hidden rounded-2xl border border-black/10 bg-[#0b0e14] shadow-[0_10px_26px_rgba(28,33,51,.12)]">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <span className="text-[12px] font-bold text-white/90">Imaging Viewer</span>
          <button type="button" className="grid h-6 w-6 place-items-center rounded text-white/50 hover:bg-white/10"><Maximize2 size={13} /></button>
        </div>
        <div className="grid grid-cols-[84px_1fr_104px] gap-2 p-2">
          <div className="space-y-1.5">
            {RAD_SERIES.map((s, i) => (
              <div key={s.name} className="cursor-pointer rounded-lg border p-1" style={{ borderColor: s.active ? "#0078d4" : "rgba(255,255,255,.12)", background: s.active ? "rgba(0,120,212,.15)" : "rgba(255,255,255,.03)" }}>
                <div className="relative overflow-hidden rounded">
                  <CtSlice className="h-12 w-full" />
                  <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[8px] font-bold text-white">{i + 1}</span>
                </div>
                <div className="mt-1 text-[9.5px] font-semibold text-white/90">{s.name}</div>
                <div className="text-[8.5px] text-white/50">{s.range}</div>
              </div>
            ))}
          </div>
          <div className="relative min-h-[300px] overflow-hidden rounded-lg bg-black">
            <CtSlice className="absolute inset-0 h-full w-full" />
            <div className="absolute left-3 top-2 text-[10px] leading-tight text-white/80">
              <div className="font-bold">Ahmed Khan</div><div>MRN: CLN-00012345</div><div>58 Y, M</div>
            </div>
            <div className="absolute right-3 top-2 text-right text-[10px] leading-tight text-white/80">
              <div className="font-bold">CT Chest w/ Contrast</div><div>12 May 2024 10:24 AM</div><div>Series 1 · Image 45/120</div>
            </div>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-white/70">R</span>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-white/70">L</span>
          </div>
          <div className="space-y-0.5">
            {RAD_TOOLS.map((t) => (
              <button key={t.label} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[10.5px] font-medium text-white/70 hover:bg-white/10"><t.icon size={14} /> {t.label}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 border-t border-white/10 px-3 py-2">
          {RAD_VIEWER_BOTTOM.map((b) => (
            <button key={b.label} type="button" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-medium text-white/70 hover:bg-white/10"><b.icon size={13} /> {b.label}</button>
          ))}
          <span className="ml-auto text-[10.5px] font-semibold text-white/60">WW: 1500 · WL: -600</span>
        </div>
      </div>

      {/* patient info + report + prior */}
      <div className="grid gap-3 xl:grid-cols-[1fr_1.15fr_0.85fr]">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Patient Information</h3>
            <button type="button" className="flex items-center gap-1 text-[11px] font-semibold text-[#0078d4]"><Pencil size={12} /> Edit</button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {RAD_PATIENT.map((f) => (
              <div key={f.label} className={f.full ? "col-span-2" : ""}>
                <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</div>
                <div className="text-[12px] font-semibold text-slate-700">{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center gap-4 border-b border-black/[0.06]">
            {["Report", "Templates"].map((t) => (
              <button key={t} type="button" onClick={() => setRepTab(t)} className="relative pb-2 text-[12.5px] font-semibold" style={{ color: repTab === t ? "#0078d4" : "#6b7280" }}>
                {t}{repTab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-[#0078d4]" />}
              </button>
            ))}
          </div>
          {repTab === "Templates" ? (
            <div className="space-y-1.5">
              {RAD_TEMPLATES.map((t) => (
                <button key={t} type="button" className="flex w-full items-center justify-between rounded-lg border border-black/[0.07] bg-white/70 px-2.5 py-2 text-[12px] font-medium text-slate-600 hover:border-[#0078d4]/40"><span className="flex items-center gap-2"><FileText size={13} className="text-slate-400" /> {t}</span><ChevronRight size={13} className="text-slate-300" /></button>
              ))}
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-black/[0.08] bg-slate-50/70 p-1 text-slate-500">
                <button type="button" className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold hover:bg-white">Normal <ChevronDown size={11} /></button>
                <span className="mx-0.5 h-4 w-px bg-black/10" />
                {[Bold, Italic, Underline].map((Ic, i) => <button key={i} type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white"><Ic size={13} /></button>)}
                <span className="mx-0.5 h-4 w-px bg-black/10" />
                {[List, ListOrdered].map((Ic, i) => <button key={i} type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white"><Ic size={13} /></button>)}
                <span className="mx-0.5 h-4 w-px bg-black/10" />
                {[AlignLeft, AlignCenter].map((Ic, i) => <button key={i} type="button" className="grid h-6 w-6 place-items-center rounded hover:bg-white"><Ic size={13} /></button>)}
                <span className="mx-0.5 h-4 w-px bg-black/10" />
                <button type="button" className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold hover:bg-white"><Plus size={12} /> Insert</button>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="mb-1 text-[11px] font-bold tracking-wide text-slate-500">FINDINGS:</div>
                  <textarea rows={3} placeholder="Enter findings..." className="w-full resize-none rounded-lg border border-black/[0.1] bg-white p-2 text-[12px] text-slate-700 outline-none focus:border-[#0078d4]" />
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-bold tracking-wide text-slate-500">IMPRESSION:</div>
                  <textarea rows={2} placeholder="Enter impression..." className="w-full resize-none rounded-lg border border-black/[0.1] bg-white p-2 text-[12px] text-slate-700 outline-none focus:border-[#0078d4]" />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="flex items-center gap-1.5 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-600"><Save size={13} /> Save Draft</button>
                <button type="button" className="flex items-center gap-1.5 rounded-lg border border-black/[0.1] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-slate-600"><Mic size={13} /> Dictate</button>
                <button type="button" className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#0078d4] px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_4px_12px_rgba(0,120,212,.24)]"><PenLine size={13} /> Sign Report</button>
                <button type="button" className="flex items-center gap-1.5 rounded-lg border border-[rgba(0,120,212,.35)] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#0a5aa8]"><Send size={13} /> Send Result</button>
              </div>
            </>
          )}
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Prior Studies</h3>
            <button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All</button>
          </div>
          <div className="space-y-2">
            {RAD_PRIOR.map((p) => (
              <div key={p.title + p.date} className="flex items-center gap-2.5">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-black/10"><CtSlice className="h-full w-full" /></div>
                <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold text-slate-700">{p.title}</div><div className="text-[10px] text-slate-400">{p.date}</div></div>
                <button type="button" className="rounded-md border border-black/[0.1] bg-white px-3 py-1 text-[10.5px] font-semibold text-slate-600">View</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PharmacyView() {
  const [wlTab, setWlTab] = useState("All");
  const prio = (p: string) => (p === "High" ? "#D13438" : p === "Low" ? "#0078d4" : "#16a34a");
  const pstat = (s: string) => (s === "Pending" ? "#CA5010" : s === "In Progress" ? "#0078d4" : s === "Ready" ? "#16a34a" : "#8764B8");
  const nT = PH_TREND.length;
  const trendPts = PH_TREND.map((v, i) => `${(i / (nT - 1)) * 520},${150 - (v / 1000) * 150}`).join(" ");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight text-[#0c3b63]">Pharmacy Command Center</h1>
          <p className="text-[12px] text-slate-400">Live overview of pharmacy operations</p>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {PH_KPIS.map((k) => (
          <div key={k.label} className={`${card} relative overflow-hidden p-3.5`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: k.color }} />
            <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${k.color}1a`, color: k.color }}><k.icon size={18} /></div>
            <div className="text-[22px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums", color: k.critical ? "#D13438" : "#1f2937" }}>{k.value}</div>
            <div className="mt-1 text-[11.5px] font-medium text-slate-500">{k.label}</div>
            <button type="button" className="mt-1.5 text-[11px] font-semibold hover:underline" style={{ color: k.color }}>{k.action}</button>
          </div>
        ))}
      </div>

      {/* Prescription Worklist */}
      <div className={`${card} p-3`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Prescription Worklist</h3>
            <div className="flex items-center gap-3">
              {PH_WL_TABS.map((t) => (
                <button key={t.label} type="button" onClick={() => setWlTab(t.label)} className="flex items-center gap-1 pb-1 text-[12px] font-semibold" style={{ color: wlTab === t.label ? "#0078d4" : "#64748b", borderBottom: wlTab === t.label ? "2px solid #0078d4" : "2px solid transparent" }}>
                  {t.label} <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{t.n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Filter size={12} /> Filters</button>
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Columns3 size={12} /> Columns</button>
            <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><RefreshCw size={13} /></button>
            <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><MoreHorizontal size={15} /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[11px]">
            <thead><tr className={th}>
              <th className={cellHead}>Priority</th><th className={cellHead}>Rx Number</th><th className={cellHead}>Patient</th><th className={cellHead}>Medication</th><th className={cellHead}>Dose / Form</th><th className={cellHead}>Ordered By</th><th className={cellHead}>Status</th><th className={cellHead}>SLA</th><th className="pb-1.5 font-bold">Actions</th>
            </tr></thead>
            <tbody>
              {PH_WORKLIST.map((r) => (
                <tr key={r.rx} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3"><Pill tone={prio(r.prio)}>{r.prio}</Pill></td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-700">{r.rx}</td>
                  <td className="py-1.5 pr-3"><div className="font-semibold text-slate-700">{r.name}</div><div className="text-[9.5px] text-slate-400">{r.age}</div></td>
                  <td className="py-1.5 pr-3 font-medium text-slate-700">{r.med}</td>
                  <td className="py-1.5 pr-3"><div className="font-medium text-slate-600">{r.dose}</div><div className="text-[9.5px] text-slate-400">{r.form}</div></td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.by}</td>
                  <td className="py-1.5 pr-3"><Pill tone={pstat(r.status)}>{r.status}</Pill></td>
                  <td className="py-1.5 pr-3 font-semibold" style={{ color: r.slaRed ? "#D13438" : "#64748b" }}>{r.sla}</td>
                  <td className="py-1.5"><button type="button" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-black/[0.04]"><MoreHorizontal size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Showing 1 to 5 of 342 results</span>
          <div className="flex items-center gap-1">
            <button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><ChevronRight size={13} className="rotate-180" /></button>
            {[1, 2, 3, 4, 5].map((p) => (
              <button key={p} type="button" className="grid h-6 min-w-6 place-items-center rounded px-1.5 text-[11px] font-semibold" style={{ background: p === 1 ? "#0078d4" : "transparent", color: p === 1 ? "#fff" : "#64748b", border: p === 1 ? "none" : "1px solid rgba(0,0,0,.08)" }}>{p}</button>
            ))}
            <span className="px-1 text-[11px] text-slate-400">…</span>
            <button type="button" className="grid h-6 min-w-6 place-items-center rounded border border-black/[0.08] px-1.5 text-[11px] font-semibold text-slate-600">69</button>
            <button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><ChevronRight size={13} /></button>
          </div>
        </div>
      </div>

      {/* inventory + dispensed */}
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Inventory Overview</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PH_INV_STATS.map((s) => (
              <div key={s.label} className="rounded-lg border border-black/[0.06] bg-white/60 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${s.tone}1a`, color: s.tone }}><s.icon size={14} /></span>
                  <span className="text-[18px] font-extrabold leading-none text-slate-800">{s.value}</span>
                </div>
                <div className="mt-1.5 text-[10px] font-medium leading-tight text-slate-500">{s.label}</div>
                {s.sub && <div className="text-[9px] text-slate-400">{s.sub}</div>}
              </div>
            ))}
          </div>
          <div className="mb-1 mt-3 text-[11.5px] font-bold text-slate-600">Top Low Stock Items</div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[380px] text-left text-[11px]">
              <thead><tr className={th}><th className={cellHead}>Medication</th><th className={cellHead}>Available</th><th className={cellHead}>Reorder Level</th><th className={cellHead}>Unit</th><th className="pb-1.5 font-bold">Action</th></tr></thead>
              <tbody>
                {PH_LOW_STOCK.map((m) => (
                  <tr key={m.med} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-medium text-slate-700">{m.med}</td>
                    <td className="py-1.5 pr-3 font-bold text-[#D13438]">{m.avail}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{m.reorder}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{m.unit}</td>
                    <td className="py-1.5"><button type="button" className="text-[11px] font-semibold text-[#0078d4] hover:underline">Reorder</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Recent Dispensed Orders</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[11px]">
              <thead><tr className={th}><th className={cellHead}>Rx Number</th><th className={cellHead}>Patient</th><th className={cellHead}>Medication</th><th className={cellHead}>Dispensed By</th><th className="pb-1.5 font-bold">Time</th></tr></thead>
              <tbody>
                {PH_DISPENSED.map((d) => (
                  <tr key={d.rx} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{d.rx}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{d.name}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{d.med}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{d.by}</td>
                    <td className="py-1.5 text-slate-500">{d.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* drug utilization */}
      <div className={`${card} p-3`}>
        <h3 className="mb-3 text-[13px] font-bold text-[#0c3b63]">Drug Utilization <span className="text-[10.5px] font-normal text-slate-400">(This Month)</span></h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.7fr]">
          {PH_UTIL.map((u) => (
            <div key={u.label} className="min-w-0 border-black/[0.06] xl:border-r xl:pr-4 xl:last:border-r-0">
              <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{u.label}</div>
              <div className="mt-1 text-[16px] font-extrabold leading-tight text-slate-800">{u.value}</div>
              <div className="mt-0.5 text-[10.5px] font-semibold" style={{ color: u.subTone }}>{u.sub}</div>
            </div>
          ))}
          <div className="min-w-0">
            <div className="mb-1 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Daily Expenditure Trend</div>
            <div className="flex gap-2">
              <div className="flex flex-col justify-between py-0.5 text-[8px] text-slate-400" style={{ height: 100 }}><span>1M</span><span>500K</span><span>0</span></div>
              <div className="flex-1">
                <svg viewBox="0 0 520 150" className="w-full" style={{ height: 100 }}>
                  {[0, 75, 150].map((y) => <line key={y} x1="0" y1={y} x2="520" y2={y} stroke="#00000010" strokeWidth="1" />)}
                  <polyline points={trendPts} fill="none" stroke="#0078d4" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  {PH_TREND.map((v, i) => <circle key={i} cx={(i / (nT - 1)) * 520} cy={150 - (v / 1000) * 150} r="3" fill="#fff" stroke="#0078d4" strokeWidth="2" />)}
                </svg>
                <div className="mt-1 flex justify-between text-[8px] text-slate-400">{PH_TREND_X.map((x) => <span key={x}>{x}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ICUView() {
  const [ptTab, setPtTab] = useState("All");
  const st = (s: string) => ICU_STATUS_TONE[s] || "#334155";
  const ostat = (s: string) => (s === "Completed" ? "#16a34a" : "#CA5010");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight text-[#0c3b63]">ICU Command Center</h1>
          <p className="text-[12px] text-slate-400">Real-time overview of ICU operations</p>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {ICU_KPIS.map((k) => (
          <div key={k.label} className={`${card} relative overflow-hidden p-3`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: k.color }} />
            <div className="mb-2 grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${k.color}1a`, color: k.color }}><k.icon size={16} /></div>
            <div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums", color: k.critical ? "#D13438" : "#1f2937" }}>{k.value}</div>
            <div className="mt-1 text-[10.5px] font-medium leading-tight text-slate-500">{k.label}</div>
            <button type="button" className="mt-1 text-[10px] font-semibold hover:underline" style={{ color: k.color }}>{k.action}</button>
          </div>
        ))}
      </div>

      {/* patient overview + live status + alerts/tasks */}
      <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr_1fr]">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <h3 className="text-[13px] font-bold text-[#0c3b63]">ICU Patient Overview</h3>
              <div className="flex items-center gap-3">
                {ICU_PT_TABS.map((t) => (
                  <button key={t.label} type="button" onClick={() => setPtTab(t.label)} className="flex items-center gap-1 pb-1 text-[11.5px] font-semibold" style={{ color: ptTab === t.label ? "#0078d4" : "#64748b", borderBottom: ptTab === t.label ? "2px solid #0078d4" : "2px solid transparent" }}>
                    {t.label} <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{t.n}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-600"><Filter size={11} /> Filters</button>
              <button type="button" className="grid h-6 w-6 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><RefreshCw size={12} /></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead><tr className={th}>
                <th className={cellHead}>Bed</th><th className={cellHead}>Patient</th><th className={cellHead}>Age / Gender</th><th className={cellHead}>Diagnosis</th><th className={cellHead}>Status</th><th className={cellHead}>Vent.</th><th className={cellHead}>Score</th><th className={cellHead}>LOS</th><th className="pb-1.5 font-bold">Alerts</th>
              </tr></thead>
              <tbody>
                {ICU_PATIENTS.map((r) => (
                  <tr key={r.bed} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-[#0078d4]">{r.bed}</td>
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{r.name}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.age}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{r.dx}</td>
                    <td className="py-1.5 pr-3"><Pill tone={st(r.status)}>{r.status}</Pill></td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.vent}</td>
                    <td className="py-1.5 pr-3 font-semibold text-slate-600">{r.score}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.los}</td>
                    <td className="py-1.5">{r.alert && <TriangleAlert size={14} className="text-[#D13438]" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button type="button" className="text-[11px] font-semibold text-[#0078d4]">View all 20 patients</button>
            <div className="flex items-center gap-1">
              <button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><ChevronRight size={13} className="rotate-180" /></button>
              {[1, 2, 3, 4, 5].map((p) => <button key={p} type="button" className="grid h-6 min-w-6 place-items-center rounded px-1.5 text-[11px] font-semibold" style={{ background: p === 1 ? "#0078d4" : "transparent", color: p === 1 ? "#fff" : "#64748b", border: p === 1 ? "none" : "1px solid rgba(0,0,0,.08)" }}>{p}</button>)}
              <button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><ChevronRight size={13} /></button>
            </div>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Live ICU Status</h3></div>
          <div className="space-y-1.5">
            {ICU_LIVE.map((r) => (
              <div key={r.bed} className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white/60 p-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${st(r.status)}1a`, color: st(r.status) }}><HeartPulse size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5"><span className="text-[11.5px] font-bold text-slate-700">{r.bed}</span><Pill tone={st(r.status)}>{r.status}</Pill></div>
                  <div className="truncate text-[10px] text-slate-500">{r.dx}</div>
                  <div className="text-[9px] text-slate-400">{r.score}</div>
                </div>
                <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${st(r.status)} 0 ${r.pct}%, #e2e8f0 ${r.pct}% 100%)` }}>
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-white text-[8px] font-bold" style={{ color: st(r.status) }}>{r.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Alerts &amp; Notifications</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
            <div className="space-y-2">
              {ICU_ALERTS.map((a) => (
                <div key={a.title} className="flex items-center gap-2">
                  <TriangleAlert size={14} className="shrink-0" style={{ color: a.tone }} />
                  <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold" style={{ color: a.tone }}>{a.title}</div><div className="truncate text-[9.5px] text-slate-400">{a.sub}</div></div>
                  <div className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${a.tone} 0 ${a.pct}%, #e2e8f0 ${a.pct}% 100%)` }}>
                    <div className="grid h-5.5 w-5.5 place-items-center rounded-full bg-white text-[7px] font-bold" style={{ color: a.tone, height: 22, width: 22 }}>{a.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Today's Tasks</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
            <div className="space-y-1.5">
              {ICU_TASKS.map((t) => (
                <label key={t.t} className="flex items-center gap-2.5">
                  <input type="checkbox" defaultChecked={t.done} className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0078d4]" />
                  <span className={`text-[11.5px] ${t.done ? "text-slate-400 line-through" : "text-slate-600"}`}>{t.t}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* current patient + vitals + I/O + ventilator */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Current Patient · ICU-03</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View Chart</button></div>
          <div className="mb-2 flex items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgba(0,120,212,.1)] text-[12px] font-bold text-[#0078d4]">{initials("Bilal Ahmed")}</span>
            <div><div className="text-[13px] font-bold text-slate-800">Bilal Ahmed</div><div className="text-[10px] text-slate-400">MRN: CLN-00011223</div><div className="text-[10px] text-slate-400">62 Y, M · O+</div></div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {ICU_CURRENT.map((f) => (
              <div key={f.label}><div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</div><div className="text-[11px] font-semibold text-slate-700">{f.value}</div></div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Real-time Vitals</h3><span className="flex items-center gap-1 text-[10px] font-semibold text-[#16a34a]"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /> Live</span></div>
          <div className="space-y-1.5">
            {ICU_VITALS.map((v) => (
              <div key={v.label} className="flex items-center justify-between gap-2">
                <span className="w-9 text-[11px] font-semibold text-slate-500">{v.label}</span>
                <span className="text-[11.5px] font-bold text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>{v.value}</span>
                <Spark color={v.color} />
              </div>
            ))}
          </div>
          <div className="mt-2 text-[9.5px] text-slate-400">Last updated: 10:18 AM</div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">I/O Summary <span className="text-[9.5px] font-normal text-slate-400">(Last 24h)</span></h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View Details</button></div>
          <div className="space-y-1">
            {ICU_IO.map((i) => (
              <div key={i.label} className={`flex items-center justify-between rounded-md px-2 py-1.5 ${i.hl ? "bg-[rgba(22,163,74,.08)]" : ""}`}>
                <span className="text-[11px] text-slate-500">{i.label}</span>
                {i.label === "Fluid Balance Status" ? <Pill tone={i.tone}>{i.value}</Pill> : <span className="text-[11.5px] font-bold" style={{ color: i.tone }}>{i.value}</span>}
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[9.5px] text-slate-400">Updated: 10:18 AM</div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Ventilator</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">Settings</button></div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {ICU_VENT.map((v) => (
              <div key={v.label} className="flex items-center justify-between"><span className="text-[10.5px] text-slate-500">{v.label}</span><span className="text-[11.5px] font-bold text-slate-700">{v.value}</span></div>
            ))}
          </div>
          <div className="mt-2 border-t border-black/[0.06] pt-1.5 text-[9.5px] text-slate-400">Since: 08:20 AM</div>
        </div>
      </div>

      {/* bed overview + orders + utilization */}
      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Bed Overview · ICU-1</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {ICU_BED_STATS.map((s) => (
              <div key={s.label} className="rounded-lg border border-black/[0.06] bg-white/60 p-2 text-center">
                <div className="text-[17px] font-extrabold leading-none" style={{ color: s.tone }}>{s.value}</div>
                <div className="mt-1 text-[9px] font-medium leading-tight text-slate-500">{s.label}{s.sub ? ` (${s.sub})` : ""}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {ICU_BEDS.map((b) => (
              <div key={b.id} className="rounded-lg border p-1.5 text-center" style={{ borderColor: `${ICU_BED_TONE[b.status]}40`, background: `${ICU_BED_TONE[b.status]}0d` }}>
                <div className="text-[9px] font-bold text-slate-700">{b.id}</div>
                <div className="text-[7.5px] font-semibold" style={{ color: ICU_BED_TONE[b.status] }}>{b.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Recent Orders</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-[11px]">
              <thead><tr className={th}><th className={cellHead}>Time</th><th className={cellHead}>Order</th><th className={cellHead}>Patient</th><th className="pb-1.5 font-bold">Status</th></tr></thead>
              <tbody>
                {ICU_ORDERS.map((o, i) => (
                  <tr key={i} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 text-slate-500">{o.time}</td>
                    <td className="py-1.5 pr-3 font-medium text-slate-700">{o.order}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{o.pt}</td>
                    <td className="py-1.5"><span className="font-semibold" style={{ color: ostat(o.status) }}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">ICU Utilization <span className="text-[9.5px] font-normal text-slate-400">(This Month)</span></h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View Analytics</button></div>
          <div className="flex items-center gap-3">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(#0078d4 0 83%, #e2e8f0 83% 100%)" }}>
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center">
                <div><div className="text-[15px] font-extrabold text-slate-800">83%</div><div className="text-[8px] text-slate-400">Utilization</div></div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {ICU_UTIL.map((u) => (
                <div key={u.label} className="flex items-center gap-1.5 text-[10.5px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: u.color }} />
                  <span className="flex-1 text-slate-600">{u.label}</span>
                  <span className="font-semibold text-slate-500">{u.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmergencyView() {
  const [tbTab, setTbTab] = useState("All");
  const ctas = (c: string) => CTAS_TONE[c] || "#64748b";
  const estat = (s: string) => ED_STATUS_TONE[s] || "#334155";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-extrabold tracking-tight text-[#0c3b63]">Emergency Command Center</h1>
          <p className="text-[12px] text-slate-400">Real-time overview of ED operations</p>
        </div>
        <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {ED_KPIS.map((k) => (
          <div key={k.label} className={`${card} relative overflow-hidden p-3`}>
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: k.color }} />
            <div className="mb-2 grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${k.color}1a`, color: k.color }}><k.icon size={16} /></div>
            <div className="text-[20px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums", color: k.critical ? "#D13438" : "#1f2937" }}>{k.value}</div>
            <div className="mt-1 text-[10.5px] font-medium leading-tight text-slate-500">{k.label}</div>
            <button type="button" className="mt-1 text-[10px] font-semibold hover:underline" style={{ color: k.color }}>{k.action}</button>
          </div>
        ))}
      </div>

      {/* triage board + live status + critical alerts/tasks */}
      <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr_1fr]">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-4">
              <h3 className="text-[13px] font-bold text-[#0c3b63]">Triage Board</h3>
              <div className="flex items-center gap-3">
                {ED_TABS.map((t) => (
                  <button key={t.label} type="button" onClick={() => setTbTab(t.label)} className="flex items-center gap-1 pb-1 text-[11.5px] font-semibold" style={{ color: tbTab === t.label ? "#0078d4" : "#64748b", borderBottom: tbTab === t.label ? "2px solid #0078d4" : "2px solid transparent" }}>
                    {t.label} <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{t.n}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10px] font-semibold text-slate-600"><Filter size={11} /> Filters</button>
              <button type="button" className="grid h-6 w-6 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><RefreshCw size={12} /></button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[11px]">
              <thead><tr className={th}>
                <th className={cellHead}>CTAS</th><th className={cellHead}>Patient</th><th className={cellHead}>Age / Gender</th><th className={cellHead}>Chief Complaint</th><th className={cellHead}>Arrival</th><th className={cellHead}>Waiting</th><th className={cellHead}>Status</th><th className={cellHead}>Provider</th><th className="pb-1.5 font-bold">Alerts</th>
              </tr></thead>
              <tbody>
                {ED_TRIAGE.map((r) => (
                  <tr key={r.mrn} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3"><span className="grid h-5 w-5 place-items-center rounded text-[10px] font-bold text-white" style={{ background: ctas(r.ctas) }}>{r.ctas}</span></td>
                    <td className="py-1.5 pr-3"><div className="font-semibold text-slate-700">{r.name}</div><div className="text-[9px] text-slate-400">MRN: {r.mrn}</div></td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.age}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{r.cc}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.arr}</td>
                    <td className="py-1.5 pr-3 font-semibold" style={{ color: r.waitRed ? "#D13438" : "#64748b" }}>{r.wait}</td>
                    <td className="py-1.5 pr-3"><Pill tone={estat(r.status)}>{r.status}</Pill></td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.prov}</td>
                    <td className="py-1.5">{r.alert && <TriangleAlert size={14} className="text-[#D13438]" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Showing 1 to 6 of 12 patients</span>
            <div className="flex items-center gap-1">
              <button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><ChevronRight size={13} className="rotate-180" /></button>
              {[1, 2].map((p) => <button key={p} type="button" className="grid h-6 min-w-6 place-items-center rounded px-1.5 text-[11px] font-semibold" style={{ background: p === 1 ? "#0078d4" : "transparent", color: p === 1 ? "#fff" : "#64748b", border: p === 1 ? "none" : "1px solid rgba(0,0,0,.08)" }}>{p}</button>)}
              <button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><ChevronRight size={13} /></button>
            </div>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Live ED Status</h3></div>
          <div className="space-y-1.5">
            {ED_LIVE.map((a) => (
              <div key={a.area} className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white/60 p-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${a.tone}1a`, color: a.tone }}><a.icon size={15} /></span>
                <div className="min-w-0 flex-1"><div className="text-[11.5px] font-semibold text-slate-700">{a.area}</div><div className="text-[9.5px] text-slate-400">{a.note}</div></div>
                <span className="text-[15px] font-extrabold text-slate-800">{a.count}</span>
                <button type="button" className="text-[10px] font-semibold text-[#0078d4]">View</button>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Critical Alerts</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
            <div className="space-y-2">
              {ED_CRITICAL.map((a) => (
                <div key={a.title} className="flex items-start gap-2">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" style={{ color: a.tone }} />
                  <div className="min-w-0 flex-1"><div className="text-[11.5px] font-semibold leading-tight" style={{ color: a.tone }}>{a.title}</div><div className="truncate text-[9.5px] text-slate-400">{a.sub} · {a.time}</div></div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} p-3`}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Today's Tasks</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
            <div className="space-y-1.5">
              {ED_TASKS.map((t) => (
                <label key={t} className="flex items-center gap-2.5">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0078d4]" />
                  <span className="text-[11.5px] text-slate-600">{t}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* current patient + vitals + score + orders */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Current Patient</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View Full Chart</button></div>
          <div className="mb-2 flex items-center gap-2.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[rgba(0,120,212,.1)] text-[12px] font-bold text-[#0078d4]">{initials("Ahmed Khan")}</span>
            <div><div className="flex items-center gap-1.5"><span className="text-[13px] font-bold text-slate-800">Ahmed Khan</span><span className="grid h-4 w-4 place-items-center rounded text-[9px] font-bold text-white" style={{ background: "#D13438" }}>1</span></div><div className="text-[10px] text-slate-400">MRN: CLN-00011223</div><div className="text-[10px] text-slate-400">58 Y, Male</div></div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {ED_CURRENT.map((f) => (
              <div key={f.label}><div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</div><div className="text-[11px] font-semibold text-slate-700">{f.value}</div></div>
            ))}
          </div>
          <button type="button" className="mt-2.5 w-full rounded-lg border border-[rgba(0,120,212,.3)] bg-white/70 py-1.5 text-[11px] font-semibold text-[#0a5aa8]">View Patient Timeline</button>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Real-time Vitals</h3><span className="flex items-center gap-1 text-[10px] font-semibold text-[#16a34a]"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /> Live</span></div>
          <div className="space-y-1.5">
            {ED_VITALS.map((v) => (
              <div key={v.label} className="flex items-center justify-between gap-2">
                <span className="w-9 text-[11px] font-semibold text-slate-500">{v.label}</span>
                <span className="text-[11.5px] font-bold text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>{v.value}</span>
                <Spark color={v.color} />
              </div>
            ))}
          </div>
          <div className="mt-2 text-[9.5px] text-slate-400">Last updated: 08:22 AM</div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">APACHE II / ESI Score</h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View Details</button></div>
          <div className="space-y-2">
            {ED_SCORE.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{s.label}</span>
                {s.tag ? <span className="flex items-center gap-1.5"><span className="text-[13px] font-extrabold text-slate-800">{s.value}</span><Pill tone={s.tagTone}>{s.tag}</Pill></span> : <span className="text-[12.5px] font-bold text-slate-700">{s.value}</span>}
              </div>
            ))}
          </div>
          <div className="mt-2 text-[9.5px] text-slate-400">Last updated: 08:22 AM</div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Orders <span className="text-[9.5px] font-normal text-slate-400">(Last 24h)</span></h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="space-y-1.5">
            {ED_ORDERS.map((o) => (
              <div key={o.label} className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white/60 px-2 py-1.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><o.icon size={14} /></span>
                <span className="flex-1 text-[11.5px] font-medium text-slate-600">{o.label}</span>
                <span className="text-[13px] font-extrabold text-slate-800">{o.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* bed overview + arrivals + boarded + utilization */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">ED Bed Overview</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View Map</button></div>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {ED_BED_STATS.map((s) => (
              <div key={s.label} className="rounded-lg border border-black/[0.06] bg-white/60 p-2 text-center">
                <div className="text-[16px] font-extrabold leading-none" style={{ color: s.tone }}>{s.value}</div>
                <div className="mt-1 text-[8.5px] font-medium leading-tight text-slate-500">{s.label}{s.sub ? ` (${s.sub})` : ""}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ED_ZONES.map((z) => (
              <div key={z.zone} className="rounded-lg border border-black/[0.06] bg-white/60 p-2">
                <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-slate-700">{z.zone}</span><span className="text-[8.5px] text-slate-400">{z.beds}</span></div>
                <div className="my-1"><Bar pct={(z.occ / z.total) * 100} tone="#0078d4" /></div>
                <div className="text-[9px] text-slate-400">{z.occ} / {z.total}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Recent Arrivals</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="space-y-1.5">
            {ED_ARRIVALS.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded text-[9px] font-bold text-white" style={{ background: ctas(a.ctas) }}>{a.ctas}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold text-slate-700">{a.name}</div><div className="truncate text-[9.5px] text-slate-400">{a.time} · {a.cc}</div></div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Boarded Patients</h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View All</button></div>
          <div className="space-y-1.5">
            {ED_BOARDED.map((b) => (
              <div key={b.label} className={`flex items-center justify-between rounded-md px-2 py-1.5 ${b.hl ? "bg-[rgba(0,120,212,.08)]" : ""}`}>
                <span className={`text-[11.5px] ${b.hl ? "font-bold text-slate-700" : "text-slate-500"}`}>{b.label}</span>
                <span className={`text-[13px] font-extrabold ${b.hl ? "text-[#0078d4]" : "text-slate-700"}`}>{b.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">ED Utilization <span className="text-[9.5px] font-normal text-slate-400">(Today)</span></h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View Analytics</button></div>
          <div className="flex items-center gap-3">
            <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(#0078d4 0 75%, #e2e8f0 75% 100%)" }}>
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center">
                <div><div className="text-[15px] font-extrabold text-slate-800">75%</div><div className="text-[8px] text-slate-400">Utilization</div></div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {ED_UTIL.map((u) => (
                <div key={u.label} className="flex items-center gap-1.5 text-[10.5px]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: u.color }} />
                  <span className="flex-1 text-slate-600">{u.label}</span>
                  <span className="font-semibold text-slate-500">{u.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------- Surgery / OT · Billing · Inventory --- */

function donutGradient(segs: { pct: number; color: string }[]): string {
  let acc = 0;
  return segs.map((s) => { const seg = `${s.color} ${acc}% ${acc + s.pct}%`; acc += s.pct; return seg; }).join(", ");
}

/* Lightweight toast bus so any control can acknowledge a click. */
let _toastListeners: ((m: string) => void)[] = [];
function toast(msg: string) { _toastListeners.forEach((l) => l(msg)); }
function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([]);
  useEffect(() => {
    const on = (msg: string) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s.slice(-3), { id, msg }]);
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 2600);
    };
    _toastListeners.push(on);
    return () => { _toastListeners = _toastListeners.filter((l) => l !== on); };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {items.map((i) => (
        <div key={i.id} className="pointer-events-auto flex items-center gap-2 rounded-xl border border-black/10 bg-white/95 px-3.5 py-2.5 text-[12.5px] font-semibold text-slate-700 shadow-[0_12px_30px_rgba(28,33,51,.18)] backdrop-blur">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0078d4] text-white"><CheckSquare size={12} /></span>
          {i.msg}
        </div>
      ))}
    </div>
  );
}

// Decorative/navigational labels that have no destination yet — acknowledge with a toast.
const _DECOR_LABEL = /^(view all|view report|view analytics|view details|view map|view queue|view list|view occupancy|view full report|view denial report|view recovery|view schedule|view patients|view live|view summary|view delays|filters|columns|export|quick action|contact support|contact it admin|forgot password\?|edit|share|download|more options|notifications|all floors|main ot complex)$/i;

function handleConsoleClick(e: React.MouseEvent) {
  const btn = (e.target as HTMLElement).closest("button");
  if (!btn || btn.dataset.fn) return;
  const label = (btn.getAttribute("aria-label") || btn.textContent || "").trim();
  if (label && (/^view\s/i.test(label) || _DECOR_LABEL.test(label))) toast(`${label} — coming soon`);
}

function KpiRow({ items }: { items: { label: string; value: string; icon: ComponentType<{ size?: number | string }>; color: string; sub?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((k) => (
        <div key={k.label} className={`${card} flex items-center gap-3 p-3`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${k.color}1a`, color: k.color }}><k.icon size={19} /></span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium leading-tight text-slate-500">{k.label}</div>
            <div className="text-[19px] font-extrabold leading-none" style={{ fontVariantNumeric: "tabular-nums", color: k.color === "#D13438" ? "#D13438" : "#1f2937" }}>{k.value}</div>
            {k.sub && <div className="mt-0.5 text-[9px] text-slate-400">{k.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ViewHead({ title, subtitle }: { title: string; subtitle: string }) {
  const qc = useQueryClient();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight text-[#0c3b63]">{title}</h1>
        <p className="text-[12px] text-slate-400">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" data-fn onClick={() => { qc.invalidateQueries({ queryKey: ["os"] }); toast("Refreshing live data…"); }} className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white"><RefreshCw size={12} /> Refresh</button>
        <button type="button" aria-label="More options" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
      </div>
    </div>
  );
}

function DonutCard({ title, action, center, sub, segments, legend }: {
  title: string; action?: string; center: string; sub: string;
  segments: { pct: number; color: string }[];
  legend: { label: string; value: string; color: string }[];
}) {
  return (
    <div className={`${card} p-3`}>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">{title}</h3>{action && <button type="button" className="text-[11px] font-semibold text-[#0078d4]">{action}</button>}</div>
      <div className="flex items-center gap-4">
        <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${donutGradient(segments)})` }}>
          <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white text-center">
            <div><div className="text-[15px] font-extrabold text-slate-800">{center}</div><div className="text-[8px] text-slate-400">{sub}</div></div>
          </div>
        </div>
        <div className="flex-1 space-y-1.5">
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5 text-[11px]">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: l.color }} />
              <span className="flex-1 text-slate-600">{l.label}</span>
              <span className="font-semibold text-slate-500" style={{ fontVariantNumeric: "tabular-nums" }}>{l.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, tone }: { name: string; tone: string }) {
  const init = name.replace(/^(dr\.?|nurse|tech)\s+/i, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: tone }}>{init}</span>;
}

function SurgeryView({ search = "" }: { search?: string }) {
  const [orTab, setOrTab] = useState("All ORs");
  const { data: surg } = useOsSurgery();
  const sk = surg?.kpis;
  const kpis = [
    { label: "Scheduled", value: sk ? String(sk.scheduled) : "32", icon: Calendar, color: "#0078d4" },
    { label: "In Pre-Op", value: sk ? String(sk.inPreOp) : "8", icon: Stethoscope, color: "#8764B8" },
    { label: "In Progress", value: sk ? String(sk.inProgress) : "6", icon: Activity, color: "#CA5010" },
    { label: "Post-Op / Recovery", value: sk ? String(sk.postOp) : "10", icon: HeartPulse, color: "#038387" },
    { label: "Completed", value: sk ? String(sk.completed) : "18", icon: CheckSquare, color: "#107C10" },
    { label: "Cancelled", value: sk ? String(sk.cancelled) : "2", icon: XCircle, color: "#D13438" },
  ];
  const schedule = surg?.schedule?.length ? surg.schedule : [
    { time: "08:00 AM", or: "OR 1", name: "Ahmed Khan", mrn: "CLN-00011223", proc: "Laparoscopic Cholecystectomy", surgeon: "Dr. Ahmed Ali", srole: "Chief Surgeon", anes: "Dr. Sara Khan", arole: "General", status: "In Progress", tone: "#CA5010", dur: "90 min", alert: false },
    { time: "09:45 AM", or: "OR 2", name: "Sara Ali", mrn: "CLN-00067890", proc: "Total Knee Replacement", surgeon: "Dr. Rehan Malik", srole: "Orthopedic", anes: "Dr. Imran Shah", arole: "Spinal", status: "In Progress", tone: "#CA5010", dur: "120 min", alert: true },
    { time: "11:30 AM", or: "OR 3", name: "Bilal Ahmed", mrn: "CLN-00011224", proc: "Robotic Prostatectomy", surgeon: "Dr. Ahmed Ali", srole: "Chief Surgeon", anes: "Dr. Ayesha Noor", arole: "General", status: "In Pre-Op", tone: "#8764B8", dur: "150 min", alert: false },
    { time: "01:30 PM", or: "OR 4", name: "Maryam Khan", mrn: "CLN-00033445", proc: "Hysterectomy", surgeon: "Dr. Saba Fatima", srole: "Gynecologist", anes: "Dr. Sara Khan", arole: "General", status: "Scheduled", tone: "#334155", dur: "90 min", alert: false },
    { time: "03:15 PM", or: "OR 5", name: "Usman Tariq", mrn: "CLN-00055678", proc: "Shoulder Arthroscopy", surgeon: "Dr. Rehan Malik", srole: "Orthopedic", anes: "Dr. Imran Shah", arole: "Regional", status: "Scheduled", tone: "#334155", dur: "60 min", alert: false },
  ];
  const orCounts = schedule.reduce((acc, r) => { acc[r.or] = (acc[r.or] || 0) + 1; return acc; }, {} as Record<string, number>);
  const orTabs: readonly (readonly [string, number])[] = [["All ORs", schedule.length], ...["OR 1", "OR 2", "OR 3", "OR 4", "OR 5"].map((o) => [o, orCounts[o] || 0] as const)];
  const cur = surg?.currentSurgery;
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
  const q = search.trim().toLowerCase();
  const shownSchedule = schedule.filter((r) =>
    (orTab === "All ORs" || r.or === orTab) &&
    (!q || r.name.toLowerCase().includes(q) || r.proc.toLowerCase().includes(q) || r.surgeon.toLowerCase().includes(q)));
  const curFields: [string, string][] = cur
    ? [["Procedure", cur.procedure], ["Surgeon", cur.surgeon], ["Anesthesia", cur.anesthesia], ["Start Time", cur.start], ["Expected End", cur.end]]
    : [["Procedure", "Laparoscopic Cholecystectomy"], ["Surgeon", "Dr. Ahmed Ali"], ["Anesthesia", "Dr. Sara Khan (General)"], ["Start Time", "08:00 AM"], ["Expected End", "09:30 AM (in 35 min)"]];
  const otStatus = surg?.otStatus?.length ? surg.otStatus : [
    { or: "OR 1", proc: "Laparoscopic Cholecystectomy", pct: 80, status: "In Progress", tone: "#CA5010" },
    { or: "OR 2", proc: "Total Knee Replacement", pct: 65, status: "In Progress", tone: "#CA5010" },
    { or: "OR 3", proc: "Robotic Prostatectomy", pct: 40, status: "In Pre-Op", tone: "#8764B8" },
    { or: "OR 4", proc: "Next: 03:15 PM", pct: 0, status: "Available", tone: "#16a34a" },
    { or: "OR 5", proc: "Next: 04:30 PM", pct: 0, status: "Cleaning", tone: "#0078d4" },
  ];
  const timeline = [
    { t: "07:15 AM", label: "Patient In", state: "Completed" },
    { t: "07:30 AM", label: "In Pre-Op", state: "Completed" },
    { t: "08:00 AM", label: "Surgery Started", state: "In Progress" },
    { t: "09:30 AM", label: "Surgery End (ETA)", state: "Pending" },
    { t: "09:45 AM", label: "In Recovery (ETA)", state: "Pending" },
  ];
  const team = [
    { name: "Dr. Ahmed Ali", role: "Chief Surgeon", tone: "#0078d4" },
    { name: "Dr. Sara Khan", role: "Anesthesiologist", tone: "#8764B8" },
    { name: "Nurse Ayesha", role: "Scrub Nurse", tone: "#038387" },
    { name: "Nurse Fatima", role: "Circulating Nurse", tone: "#CA5010" },
    { name: "Tech Imran", role: "OT Technician", tone: "#0c3b63" },
  ];
  const vitals = [
    { label: "HR", value: "78 bpm", color: "#D13438" },
    { label: "BP", value: "120/80 mmHg", color: "#0078d4" },
    { label: "SpO₂", value: "98 %", color: "#16a34a" },
    { label: "EtCO₂", value: "35 mmHg", color: "#CA5010" },
    { label: "Temp", value: "36.6 °C", color: "#038387" },
  ];
  const upcoming = surg?.upcoming?.length ? surg.upcoming : [
    { date: "May 21, 08:00 AM", proc: "Heart Bypass Surgery", surgeon: "Dr. Ahmed Ali", or: "OR 1" },
    { date: "May 21, 10:30 AM", proc: "Liver Resection", surgeon: "Dr. Faisal Rana", or: "OR 2" },
    { date: "May 21, 01:00 PM", proc: "Spine Fusion", surgeon: "Dr. Rehan Malik", or: "OR 3" },
  ];
  const tracker = [
    { label: "Instruments", value: "1,234", sub: "Total Sets", icon: Scissors },
    { label: "Implants", value: "856", sub: "Items in Stock", icon: Bone },
    { label: "Due for Sterilization", value: "28", sub: "Today", icon: RefreshCw },
  ];
  const st = (s: string) => (s === "Completed" ? "#16a34a" : s === "In Progress" ? "#0078d4" : "#94a3b8");
  return (
    <div className="space-y-4">
      <ViewHead title="Surgery / OT Command Center" subtitle="Real-time overview of OT operations" />
      <KpiRow items={kpis} />

      <div className="grid gap-3 xl:grid-cols-[1.7fr_1fr]">
        {/* OR Schedule */}
        <div className={`${card} p-3`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">OR Schedule <span className="text-[10px] font-normal text-slate-400">· Today, {today}</span></h3>
            <div className="flex items-center gap-1.5">
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Filter size={12} /> Filters</button>
              <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Columns3 size={12} /> Columns</button>
              <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><RefreshCw size={13} /></button>
            </div>
          </div>
          <div className="mb-2 flex items-center gap-3 overflow-x-auto">
            {orTabs.map(([label, n]) => (
              <button key={label} type="button" onClick={() => setOrTab(label)} className="flex items-center gap-1 whitespace-nowrap pb-1 text-[12px] font-semibold" style={{ color: orTab === label ? "#0078d4" : "#64748b", borderBottom: orTab === label ? "2px solid #0078d4" : "2px solid transparent" }}>
                {label} <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{n}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[11px]">
              <thead><tr className={th}>
                <th className={cellHead}>Time</th><th className={cellHead}>OR</th><th className={cellHead}>Patient</th><th className={cellHead}>Procedure</th><th className={cellHead}>Surgeon</th><th className={cellHead}>Anesthesia</th><th className={cellHead}>Status</th><th className={cellHead}>Duration</th><th className="pb-1.5 font-bold">Alerts</th>
              </tr></thead>
              <tbody>
                {shownSchedule.map((r) => (
                  <tr key={r.mrn} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-slate-600">{r.time}</td>
                    <td className="py-1.5 pr-3"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{r.or}</span></td>
                    <td className="py-1.5 pr-3"><div className="font-semibold text-slate-700">{r.name}</div><div className="text-[9.5px] text-slate-400">MRN: {r.mrn}</div></td>
                    <td className="py-1.5 pr-3 text-slate-600">{r.proc}</td>
                    <td className="py-1.5 pr-3"><div className="font-semibold text-slate-700">{r.surgeon}</div><div className="text-[9.5px] text-slate-400">{r.srole}</div></td>
                    <td className="py-1.5 pr-3"><div className="font-semibold text-slate-700">{r.anes}</div><div className="text-[9.5px] text-slate-400">{r.arole}</div></td>
                    <td className="py-1.5 pr-3"><Pill tone={r.tone}>{r.status}</Pill></td>
                    <td className="py-1.5 pr-3 text-slate-500">{r.dur}</td>
                    <td className="py-1.5">{r.alert ? <TriangleAlert size={14} className="text-[#D13438]" /> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shownSchedule.length === 0 && <div className="py-6 text-center text-[11.5px] text-slate-400">No cases match this filter.</div>}
          <div className="mt-2 text-[11px] text-slate-400">Showing {shownSchedule.length} active {shownSchedule.length === 1 ? "case" : "cases"} on today's board</div>
        </div>

        {/* Live OT Status */}
        <div className={`${card} p-3`}>
          <PanelHead title="Live OT Status" action="View All" />
          <div className="space-y-2.5">
            {otStatus.map((o) => (
              <div key={o.or} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-[12px] font-bold text-slate-700">{o.or}</span><Pill tone={o.tone}>{o.status}</Pill></div>
                  <div className="truncate text-[10.5px] text-slate-400">{o.proc}</div>
                </div>
                <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${o.tone} 0 ${o.pct}%, #e2e8f0 ${o.pct}% 100%)` }}>
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-[9px] font-bold text-slate-700">{o.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current surgery · timeline · team · vitals */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Current Surgery <span className="text-[9.5px] font-normal text-slate-400">· OR 1</span></h3><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View Details</button></div>
          <div className="flex items-center gap-2.5"><Avatar name={cur?.name ?? "Ahmed Khan"} tone="#0078d4" /><div className="min-w-0"><div className="truncate text-[12.5px] font-bold text-slate-700">{cur?.name ?? "Ahmed Khan"}</div><div className="text-[9.5px] text-slate-400">MRN: {cur?.mrn ?? "CLN-00011223"} · {cur?.or ?? "OR 1"}</div></div></div>
          <div className="mt-2.5 space-y-1.5 border-t border-black/[0.06] pt-2.5 text-[11px]">
            {curFields.map(([kk, vv]) => (
              <div key={kk} className="flex justify-between gap-2"><span className="text-slate-400">{kk}</span><span className="text-right font-semibold text-slate-600">{vv}</span></div>
            ))}
          </div>
          <div className="mt-2"><Pill tone="#CA5010">{cur?.status ?? "In Progress"}</Pill></div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Surgery Timeline" />
          <div className="space-y-0">
            {timeline.map((s, i) => (
              <div key={s.label} className="flex gap-2.5">
                <div className="flex flex-col items-center">
                  <span className="grid h-4 w-4 place-items-center rounded-full" style={{ background: st(s.state) }}>{s.state === "Completed" && <CheckSquare size={9} className="text-white" />}</span>
                  {i < timeline.length - 1 && <span className="h-6 w-px" style={{ background: st(s.state) }} />}
                </div>
                <div className="-mt-0.5 pb-1"><div className="text-[9.5px] text-slate-400">{s.t}</div><div className="text-[11.5px] font-semibold text-slate-700">{s.label}</div></div>
                <span className="ml-auto text-[10px] font-semibold" style={{ color: st(s.state) }}>{s.state}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Team in OT" />
          <div className="space-y-2">
            {team.map((m) => (
              <div key={m.name} className="flex items-center gap-2.5"><Avatar name={m.name} tone={m.tone} /><div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold text-slate-700">{m.name}</div><div className="text-[9.5px] text-slate-400">{m.role}</div></div><span className="h-2 w-2 rounded-full bg-[#16a34a]" /></div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-[#0c3b63]">Real-time Vitals</h3><span className="flex items-center gap-1 text-[9.5px] font-semibold text-[#16a34a]"><span className="h-1.5 w-1.5 rounded-full bg-[#16a34a]" /> Live</span></div>
          <div className="space-y-2">
            {vitals.map((v) => (
              <div key={v.label} className="flex items-center gap-2">
                <span className="w-12 text-[11px] font-semibold text-slate-500">{v.label}</span>
                <span className="w-24 text-[12px] font-bold text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>{v.value}</span>
                <Spark color={v.color} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Utilization · Upcoming · Tracker · Sterilization */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DonutCard title="OT Utilization" action="View Analytics" center="78%" sub="Utilization"
          segments={[{ pct: 78, color: "#0078d4" }, { pct: 18, color: "#16a34a" }, { pct: 4, color: "#D13438" }]}
          legend={[{ label: "In Use", value: "19h 40m (78%)", color: "#0078d4" }, { label: "Available", value: "5h 20m (21%)", color: "#16a34a" }, { label: "Blocked", value: "1h 00m (4%)", color: "#D13438" }]} />

        <div className={`${card} p-3`}>
          <PanelHead title="Upcoming High Priority" action="View All" />
          <div className="space-y-2">
            {upcoming.map((u) => (
              <div key={u.proc} className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white/60 px-2 py-1.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><Scissors size={13} /></span>
                <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold text-slate-700">{u.proc}</div><div className="truncate text-[9.5px] text-slate-400">{u.date} · {u.surgeon}</div></div>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600">{u.or}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Implant & Instrument Tracker" action="View" />
          <div className="space-y-2">
            {tracker.map((t) => (
              <div key={t.label} className="flex items-center gap-2.5 rounded-lg border border-black/[0.05] bg-white/60 px-2.5 py-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><t.icon size={15} /></span>
                <div className="min-w-0 flex-1"><div className="text-[15px] font-extrabold leading-none text-slate-800">{t.value}</div><div className="text-[9.5px] text-slate-400">{t.label} · {t.sub}</div></div>
              </div>
            ))}
          </div>
        </div>

        <DonutCard title="Sterilization Status" action="View All" center="92%" sub="Sterile"
          segments={[{ pct: 92, color: "#16a34a" }, { pct: 6, color: "#0078d4" }, { pct: 2, color: "#D13438" }]}
          legend={[{ label: "Sterile", value: "248 (92%)", color: "#16a34a" }, { label: "In Process", value: "16 (6%)", color: "#0078d4" }, { label: "Failed", value: "4 (2%)", color: "#D13438" }]} />
      </div>
    </div>
  );
}

function BillingView({ search = "" }: { search?: string }) {
  const [wlTab, setWlTab] = useState("All");
  const { data: bill } = useOsBilling();
  const k = bill?.kpis;
  const kpis = [
    { label: "Total Invoices", value: k ? k.totalInvoices.toLocaleString() : "1,245", icon: FileText, color: "#0078d4" },
    { label: "Claims Submitted", value: k ? k.claimsSubmitted.toLocaleString() : "672", icon: FileCheck, color: "#8764B8" },
    { label: "Claims Paid", value: k ? k.claimsPaid.toLocaleString() : "512", icon: CheckSquare, color: "#107C10" },
    { label: "Denials", value: k ? k.denials.toLocaleString() : "68", icon: XCircle, color: "#D13438" },
    { label: "Payment Posts", value: k ? k.paymentPosts.toLocaleString() : "328", icon: Wallet, color: "#038387" },
    { label: "Refunds", value: k ? k.refunds.toLocaleString() : "22", icon: RotateCcw, color: "#CA5010" },
  ];
  const wlTabs = [["All", 1245], ["Unpaid", 678], ["Partially Paid", 156], ["Overdue", 411], ["Draft", 32]] as const;
  const invTone = (s: string) => (s === "Paid" ? "#16a34a" : s === "Partially Paid" ? "#0078d4" : s === "Overdue" ? "#D13438" : "#CA5010");
  const invoices = bill?.invoices?.length
    ? bill.invoices.map((r) => ({ invoice: r.invoice, name: r.name, mrn: r.mrn, date: r.date, visit: r.visit, gross: r.gross, balance: r.balance, status: r.status, tone: invTone(r.status), due: "—" }))
    : [
      { invoice: "INV-25050145", name: "Ahmed Khan", mrn: "CLN-00011223", date: "May 20, 2024", visit: "Inpatient", gross: "₹ 85,420", balance: "₹ 45,650", status: "Overdue", tone: "#D13438", due: "May 27, 2024" },
      { invoice: "INV-25050144", name: "Sara Ali", mrn: "CLN-00067890", date: "May 20, 2024", visit: "Outpatient", gross: "₹ 15,230", balance: "₹ 7,230", status: "Unpaid", tone: "#CA5010", due: "Jun 04, 2024" },
      { invoice: "INV-25050143", name: "Bilal Ahmed", mrn: "CLN-00011224", date: "May 19, 2024", visit: "Inpatient", gross: "₹ 1,24,530", balance: "₹ 1,24,530", status: "Unpaid", tone: "#CA5010", due: "Jun 02, 2024" },
      { invoice: "INV-25050142", name: "Maryam Khan", mrn: "CLN-00033445", date: "May 19, 2024", visit: "Emergency", gross: "₹ 22,840", balance: "₹ 11,420", status: "Partially Paid", tone: "#0078d4", due: "Jun 03, 2024" },
      { invoice: "INV-25050141", name: "Usman Tariq", mrn: "CLN-00055678", date: "May 18, 2024", visit: "Outpatient", gross: "₹ 9,860", balance: "₹ 0", status: "Paid", tone: "#16a34a", due: "—" },
    ];
  const denials = [
    { reason: "Medical Necessity", claims: 22, pct: "32.4%", amount: "₹ 52.41 L", tone: "#D13438" },
    { reason: "Authorization Missing", claims: 15, pct: "22.1%", amount: "₹ 31.22 L", tone: "#CA5010" },
    { reason: "Coding Error", claims: 11, pct: "16.2%", amount: "₹ 18.74 L", tone: "#8764B8" },
    { reason: "Duplicate Claim", claims: 8, pct: "11.8%", amount: "₹ 12.36 L", tone: "#0078d4" },
    { reason: "Others", claims: 12, pct: "17.6%", amount: "₹ 17.84 L", tone: "#94a3b8" },
  ];
  const payers = [
    { payer: "Star Health", claims: 128, paid: "₹ 2.48 Cr", denial: "5.2%", days: 18 },
    { payer: "Care Health Insurance", claims: 112, paid: "₹ 1.96 Cr", denial: "6.1%", days: 21 },
    { payer: "MedSave TPA", claims: 96, paid: "₹ 1.64 Cr", denial: "7.8%", days: 24 },
    { payer: "Bajaj Allianz", claims: 84, paid: "₹ 1.28 Cr", denial: "4.6%", days: 16 },
    { payer: "Aditya Birla Health", claims: 76, paid: "₹ 1.08 Cr", denial: "6.3%", days: 19 },
  ];
  const payments = bill?.recentPayments?.length
    ? bill.recentPayments.map((p) => ({ receipt: p.receipt, name: p.name, method: p.method, amount: p.amount, on: p.on }))
    : [
      { receipt: "RCPT-2505210", name: "John Smith", method: "Card", amount: "₹ 85,420", on: "May 21, 2024" },
      { receipt: "RCPT-2505209", name: "Sara Ali", method: "UPI", amount: "₹ 45,230", on: "May 21, 2024" },
      { receipt: "RCPT-2505208", name: "Ahmed Khan", method: "Cash", amount: "₹ 22,000", on: "May 21, 2024" },
      { receipt: "RCPT-2505207", name: "Maryam Khan", method: "Card", amount: "₹ 16,840", on: "May 20, 2024" },
      { receipt: "RCPT-2505206", name: "Bilal Ahmed", method: "Wallet", amount: "₹ 12,450", on: "May 20, 2024" },
    ];
  const pctOf = (n: number, t: number) => (t ? (n / t) * 100 : 0);
  const arPalette = ["#0078d4", "#16a34a", "#CA8A04", "#CA5010", "#D13438"];
  const ar = bill?.arAging && bill.arAging.segments.some((s) => s.pct > 0)
    ? { center: bill.arAging.total, segments: bill.arAging.segments.map((s, i) => ({ pct: s.pct, color: arPalette[i % arPalette.length] })), legend: bill.arAging.segments.map((s, i) => ({ label: s.label, value: `${s.value} · ${s.pct}%`, color: arPalette[i % arPalette.length] })) }
    : { center: "₹ 8.92 Cr", segments: [{ pct: 27.8, color: "#0078d4" }, { pct: 24.2, color: "#16a34a" }, { pct: 19.5, color: "#CA8A04" }, { pct: 13.7, color: "#CA5010" }, { pct: 14.8, color: "#D13438" }], legend: [{ label: "0 – 30 Days", value: "₹ 2.48 Cr · 27.8%", color: "#0078d4" }, { label: "31 – 60 Days", value: "₹ 2.16 Cr · 24.2%", color: "#16a34a" }, { label: "61 – 90 Days", value: "₹ 1.74 Cr · 19.5%", color: "#CA8A04" }, { label: "91 – 120 Days", value: "₹ 1.22 Cr · 13.7%", color: "#CA5010" }, { label: "120+ Days", value: "₹ 1.32 Cr · 14.8%", color: "#D13438" }] };
  const cs = bill?.claimsSummary;
  const claims = cs && cs.total > 0
    ? { center: String(cs.total), segments: [{ pct: pctOf(cs.approved, cs.total), color: "#16a34a" }, { pct: pctOf(cs.denied, cs.total), color: "#D13438" }, { pct: pctOf(cs.pending, cs.total), color: "#CA8A04" }], legend: [{ label: "Approved", value: `${cs.approved} (${pctOf(cs.approved, cs.total).toFixed(1)}%)`, color: "#16a34a" }, { label: "Denied", value: `${cs.denied} (${pctOf(cs.denied, cs.total).toFixed(1)}%)`, color: "#D13438" }, { label: "Pending", value: `${cs.pending} (${pctOf(cs.pending, cs.total).toFixed(1)}%)`, color: "#CA8A04" }] }
    : { center: "672", segments: [{ pct: 76.2, color: "#16a34a" }, { pct: 10.1, color: "#D13438" }, { pct: 13.7, color: "#CA8A04" }], legend: [{ label: "Approved", value: "512 (76.2%)", color: "#16a34a" }, { label: "Denied", value: "68 (10.1%)", color: "#D13438" }, { label: "Pending", value: "92 (13.7%)", color: "#CA8A04" }] };
  const pmPalette = ["#0078d4", "#8764B8", "#16a34a", "#CA5010", "#038387"];
  const pm = bill?.paymentModes?.modes?.length
    ? { center: bill.paymentModes.total, segments: bill.paymentModes.modes.map((m, i) => ({ pct: m.pct, color: pmPalette[i % pmPalette.length] })), legend: bill.paymentModes.modes.map((m, i) => ({ label: m.label, value: `${m.value} · ${m.pct}%`, color: pmPalette[i % pmPalette.length] })) }
    : { center: "₹ 9.72 L", segments: [{ pct: 42.4, color: "#0078d4" }, { pct: 26.1, color: "#8764B8" }, { pct: 19.8, color: "#16a34a" }, { pct: 11.7, color: "#CA5010" }], legend: [{ label: "Net Banking", value: "₹ 4.12 L · 42.4%", color: "#0078d4" }, { label: "Card", value: "₹ 2.54 L · 26.1%", color: "#8764B8" }, { label: "UPI", value: "₹ 1.92 L · 19.8%", color: "#16a34a" }, { label: "Cash", value: "₹ 1.14 L · 11.7%", color: "#CA5010" }] };
  const q = search.trim().toLowerCase();
  const shownInvoices = invoices.filter((r) =>
    (wlTab === "All" || r.status === wlTab) &&
    (!q || r.name.toLowerCase().includes(q) || r.invoice.toLowerCase().includes(q) || (r.mrn || "").toLowerCase().includes(q)));

  return (
    <div className="space-y-4">
      <ViewHead title="Billing Command Center" subtitle="Real-time overview of hospital financial operations" />
      <KpiRow items={kpis} />

      <div className="grid gap-3 md:grid-cols-2">
        <DonutCard title="Accounts Receivable Aging" action="View Analytics" center={ar.center} sub="Total AR" segments={ar.segments} legend={ar.legend} />
        <DonutCard title="Payer Mix" action="View Analytics" center="₹ 18.64 L" sub="Total Charges"
          segments={[{ pct: 66.8, color: "#0078d4" }, { pct: 17.4, color: "#8764B8" }, { pct: 10, color: "#16a34a" }, { pct: 5.8, color: "#CA5010" }]}
          legend={[{ label: "Insurance", value: "₹ 12.45 L · 66.8%", color: "#0078d4" }, { label: "TPA", value: "₹ 3.24 L · 17.4%", color: "#8764B8" }, { label: "Corporate", value: "₹ 1.86 L · 10.0%", color: "#16a34a" }, { label: "Self Pay", value: "₹ 1.09 L · 5.8%", color: "#CA5010" }]} />
      </div>

      {/* Invoice Worklist */}
      <div className={`${card} p-3`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Invoice Worklist</h3>
            <div className="flex items-center gap-3 overflow-x-auto">
              {wlTabs.map(([label, n]) => (
                <button key={label} type="button" onClick={() => setWlTab(label)} className="flex items-center gap-1 whitespace-nowrap pb-1 text-[12px] font-semibold" style={{ color: wlTab === label ? "#0078d4" : "#64748b", borderBottom: wlTab === label ? "2px solid #0078d4" : "2px solid transparent" }}>
                  {label} <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Filter size={12} /> Filters</button>
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Columns3 size={12} /> Columns</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[11px]">
            <thead><tr className={th}>
              <th className={cellHead}>Invoice #</th><th className={cellHead}>Patient</th><th className={cellHead}>MRN</th><th className={cellHead}>Date</th><th className={cellHead}>Visit Type</th><th className={cellHead}>Gross Amount</th><th className={cellHead}>Balance Due</th><th className={cellHead}>Status</th><th className={cellHead}>Due Date</th><th className="pb-1.5 font-bold">Actions</th>
            </tr></thead>
            <tbody>
              {shownInvoices.map((r) => (
                <tr key={r.invoice} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3 font-semibold text-[#0078d4]">{r.invoice}</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-700">{r.name}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.mrn}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.date}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{r.visit}</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>{r.gross}</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>{r.balance}</td>
                  <td className="py-1.5 pr-3"><Pill tone={r.tone}>{r.status}</Pill></td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.due}</td>
                  <td className="py-1.5"><button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><MoreHorizontal size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shownInvoices.length === 0 && <div className="py-6 text-center text-[11.5px] text-slate-400">No invoices match this filter.</div>}
      </div>

      {/* Claims summary · denials · collection trend */}
      <div className="grid gap-3 xl:grid-cols-3">
        <DonutCard title="Claims Summary" action="View Report" center={claims.center} sub="Total Claims" segments={claims.segments} legend={claims.legend} />

        <div className={`${card} p-3`}>
          <PanelHead title="Top Denial Reasons" action="View Denial Report" />
          <div className="space-y-2">
            {denials.map((d) => (
              <div key={d.reason}>
                <div className="flex items-center justify-between text-[11px]"><span className="text-slate-600">{d.reason}</span><span className="font-semibold text-slate-500">{d.claims} ({d.pct})</span></div>
                <div className="my-1"><Bar pct={parseFloat(d.pct)} tone={d.tone} /></div>
                <div className="text-right text-[9.5px] text-slate-400">{d.amount}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <div className="mb-1 flex items-center justify-between"><h3 className="text-[13px] font-bold text-[#0c3b63]">Collection Trend <span className="text-[9.5px] font-normal text-slate-400">(MTD)</span></h3><button type="button" className="text-[11px] font-semibold text-[#0078d4]">View Analytics</button></div>
          <div className="flex items-baseline gap-2"><span className="text-[24px] font-extrabold text-slate-800">82.6%</span><span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#16a34a]"><TrendingUp size={13} /> 6.1% vs last month</span></div>
          <div className="mt-1 text-[9.5px] text-slate-400">Collection Rate · Goal ₹ 15 L</div>
          <div className="mt-2 flex h-24 items-end gap-1.5">
            {[38, 46, 52, 60, 66, 74, 82].map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 6 ? "#0078d4" : "rgba(0,120,212,.28)" }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-slate-400"><span>May 1</span><span>May 8</span><span>May 15</span><span>May 22</span><span>May 29</span></div>
        </div>
      </div>

      {/* Payer performance · recent payments · payment mode */}
      <div className="grid gap-3 xl:grid-cols-3">
        <div className={`${card} p-3`}>
          <PanelHead title="Payer Performance (Top 5)" action="View All" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-[11px]">
              <thead><tr className={th}><th className={cellHead}>Payer</th><th className={cellHead}>Claims</th><th className={cellHead}>Paid</th><th className={cellHead}>Denial</th><th className="pb-1.5 font-bold">Days</th></tr></thead>
              <tbody>
                {payers.map((p) => (
                  <tr key={p.payer} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{p.payer}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{p.claims}</td>
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{p.paid}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{p.denial}</td>
                    <td className="py-1.5 text-slate-500">{p.days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Recent Payments" action="View All" />
          <div className="space-y-1.5">
            {payments.map((p) => (
              <div key={p.receipt} className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white/60 px-2 py-1.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(16,124,16,.12)] text-[#107C10]"><IndianRupee size={13} /></span>
                <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold text-slate-700">{p.name}</div><div className="truncate text-[9.5px] text-slate-400">{p.receipt} · {p.method}</div></div>
                <div className="text-right"><div className="text-[12px] font-bold text-slate-700">{p.amount}</div><div className="text-[9px] text-slate-400">{p.on}</div></div>
              </div>
            ))}
          </div>
        </div>

        <DonutCard title="Payment Mode Summary" action="View Report" center={pm.center} sub="Collected" segments={pm.segments} legend={pm.legend} />
      </div>
    </div>
  );
}

function InventoryView({ search = "" }: { search?: string }) {
  const [wlTab, setWlTab] = useState("All Items");
  const { data: inv } = useOsInventory();
  const ik = inv?.kpis;
  const kpis = [
    { label: "Total Items", value: ik ? ik.totalItems.toLocaleString() : "4,586", icon: Boxes, color: "#0078d4" },
    { label: "Stock Value", value: ik ? ik.stockValue : "₹ 8.64 Cr", icon: IndianRupee, color: "#107C10" },
    { label: "Purchase Orders", value: ik ? ik.purchaseOrders.toLocaleString() : "52", icon: FileText, color: "#8764B8" },
    { label: "GRN Pending", value: ik ? ik.grnPending.toLocaleString() : "18", icon: Truck, color: "#CA5010" },
    { label: "Transfers in Transit", value: ik ? ik.transfersInTransit.toLocaleString() : "14", icon: RefreshCw, color: "#038387" },
    { label: "Suppliers", value: ik ? ik.suppliers.toLocaleString() : "236", icon: Building2, color: "#0c3b63" },
  ];
  const tc = inv?.tabCounts;
  const wlTabs: readonly (readonly [string, number])[] = tc
    ? [["All Items", tc.allItems], ["Low Stock", tc.lowStock], ["Out of Stock", tc.outOfStock], ["Expiring Soon", tc.expiringSoon], ["Non-moving", tc.nonMoving]]
    : [["All Items", 4586], ["Low Stock", 126], ["Out of Stock", 28], ["Expiring Soon", 94], ["Non-moving", 132]];
  const itemTone = (s: string) => (s === "Out of Stock" ? "#D13438" : s === "Low Stock" ? "#CA5010" : s === "Expired" ? "#8764B8" : s === "Non-moving" ? "#94a3b8" : "#16a34a");
  const items = inv?.items?.length
    ? inv.items.map((r) => ({ code: r.code, name: r.name, cat: r.category, unit: r.unit, cur: r.current, min: r.min, max: r.max, status: r.status, tone: itemTone(r.status), upd: r.updated }))
    : [
      { code: "MED-000123", name: "Paracetamol 650mg Tablet", cat: "Pharmaceutical", unit: "Tablet", cur: "1,250", min: "500", max: "2,000", status: "In Stock", tone: "#16a34a", upd: "May 20, 2024" },
      { code: "CON-000456", name: "Surgical Gloves (M)", cat: "Medical Consumable", unit: "Box", cur: "85", min: "100", max: "500", status: "Low Stock", tone: "#CA5010", upd: "May 20, 2024" },
      { code: "CON-000789", name: "IV Cannula 22G", cat: "Medical Consumable", unit: "Pcs", cur: "0", min: "200", max: "1,000", status: "Out of Stock", tone: "#D13438", upd: "May 20, 2024" },
      { code: "SUR-000321", name: "Syringe 5ml", cat: "Medical Consumable", unit: "Pcs", cur: "2,860", min: "500", max: "5,000", status: "In Stock", tone: "#16a34a", upd: "May 20, 2024" },
      { code: "EQU-000654", name: "BP Monitor", cat: "Equipment", unit: "Pcs", cur: "12", min: "5", max: "20", status: "In Stock", tone: "#16a34a", upd: "May 20, 2024" },
    ];
  const poTone = (s: string) => (s === "Delivered" ? "#16a34a" : s === "Approved" ? "#8764B8" : s === "Partially Received" ? "#CA5010" : "#0078d4");
  const orders = inv?.purchaseOrders?.length
    ? inv.purchaseOrders.map((o) => ({ po: o.po, supplier: o.supplier, date: o.date, status: o.status, tone: poTone(o.status), value: o.value }))
    : [
      { po: "PO-240520-001", supplier: "Medlink Pvt Ltd", date: "May 20, 2024", status: "Ordered", tone: "#0078d4", value: "₹ 2.45 L" },
      { po: "PO-240520-010", supplier: "HealthSupplies India", date: "May 19, 2024", status: "Approved", tone: "#8764B8", value: "₹ 1.12 L" },
      { po: "PO-240519-018", supplier: "Surgitech Solutions", date: "May 18, 2024", status: "Partially Received", tone: "#CA5010", value: "₹ 3.68 L" },
      { po: "PO-240518-015", supplier: "PharmaCare Pvt Ltd", date: "May 18, 2024", status: "Delivered", tone: "#16a34a", value: "₹ 0.98 L" },
      { po: "PO-240517-009", supplier: "Global Medicals", date: "May 17, 2024", status: "Ordered", tone: "#0078d4", value: "₹ 1.75 L" },
    ];
  const expiring = inv?.expiring?.length ? inv.expiring : [
    { name: "Ceftriaxone 1gm Inj.", batch: "B240315", exp: "Jun 05, 2024", qty: "150" },
    { name: "Pantoprazole 40mg Inj.", batch: "B240410", exp: "Jun 12, 2024", qty: "90" },
    { name: "Normal Saline 100ml", batch: "B240401", exp: "Jun 18, 2024", qty: "200" },
    { name: "Metronidazole 100ml", batch: "B240310", exp: "Jun 25, 2024", qty: "120" },
    { name: "Meropenem 1gm Inj.", batch: "B240402", exp: "Jun 28, 2024", qty: "60" },
  ];
  const consumed = inv?.topConsumed?.length ? inv.topConsumed : [
    { name: "Paracetamol 650mg Tablet", qty: "12,450", unit: "Tablet" },
    { name: "IV Fluid NS 100ml", qty: "8,320", unit: "Bottle" },
    { name: "Surgical Gloves (M)", qty: "7,850", unit: "Box" },
    { name: "Syringe 5ml", qty: "6,240", unit: "Pcs" },
    { name: "IV Cannula 22G", qty: "5,910", unit: "Pcs" },
  ];
  const stores = inv?.stores?.length ? inv.stores : [
    { store: "Central Store", total: "2,458", inStock: "2,102", low: "86", out: "18", value: "₹ 4.25 Cr" },
    { store: "Pharmacy Store", total: "1,245", inStock: "1,050", low: "28", out: "9", value: "₹ 2.16 Cr" },
    { store: "OT Store", total: "583", inStock: "506", low: "7", out: "5", value: "₹ 1.02 Cr" },
    { store: "ICU Store", total: "300", inStock: "260", low: "3", out: "2", value: "₹ 0.65 Cr" },
  ];
  const suppliers = inv?.suppliers?.length ? inv.suppliers : [
    { name: "Medlink Pvt Ltd", otd: "98%", quality: "4.6", fill: "96%", rating: 5 },
    { name: "HealthSupplies India", otd: "95%", quality: "4.3", fill: "94%", rating: 4 },
    { name: "Surgitech Solutions", otd: "92%", quality: "4.4", fill: "91%", rating: 4 },
    { name: "PharmaCare Pvt Ltd", otd: "90%", quality: "4.1", fill: "88%", rating: 4 },
    { name: "Global Medicals", otd: "89%", quality: "4.2", fill: "87%", rating: 4 },
  ];
  const stockOv = inv?.stockOverview
    ? { center: inv.stockOverview.total, segments: inv.stockOverview.segments.map((s) => ({ pct: s.pct, color: s.color })), legend: inv.stockOverview.segments.map((s) => ({ label: s.label, value: s.value, color: s.color })) }
    : { center: "4,586", segments: [{ pct: 83.8, color: "#16a34a" }, { pct: 2.7, color: "#CA5010" }, { pct: 0.6, color: "#D13438" }, { pct: 2.9, color: "#94a3b8" }, { pct: 1.3, color: "#8764B8" }], legend: [{ label: "In Stock", value: "3,842 (83.8%)", color: "#16a34a" }, { label: "Low Stock", value: "126 (2.7%)", color: "#CA5010" }, { label: "Out of Stock", value: "28 (0.6%)", color: "#D13438" }, { label: "Non-moving (90+ Days)", value: "132 (2.9%)", color: "#94a3b8" }, { label: "Expired", value: "58 (1.3%)", color: "#8764B8" }] };
  const valCat = inv?.valueByCategory
    ? { center: inv.valueByCategory.total, segments: inv.valueByCategory.segments.map((s) => ({ pct: s.pct, color: s.color })), legend: inv.valueByCategory.segments.map((s) => ({ label: s.label, value: `${s.value} · ${s.pct}%`, color: s.color })) }
    : { center: "₹ 8.64 Cr", segments: [{ pct: 37.7, color: "#0078d4" }, { pct: 27.9, color: "#16a34a" }, { pct: 17.6, color: "#CA8A04" }, { pct: 11.1, color: "#8764B8" }, { pct: 5.7, color: "#94a3b8" }], legend: [{ label: "Pharmaceuticals", value: "₹ 3.26 Cr · 37.7%", color: "#0078d4" }, { label: "Medical Consumables", value: "₹ 2.41 Cr · 27.9%", color: "#16a34a" }, { label: "Surgical Items", value: "₹ 1.52 Cr · 17.6%", color: "#CA8A04" }, { label: "Equipment", value: "₹ 0.96 Cr · 11.1%", color: "#8764B8" }, { label: "Others", value: "₹ 0.49 Cr · 5.7%", color: "#94a3b8" }] };
  const q = search.trim().toLowerCase();
  const shownItems = items.filter((r) =>
    (wlTab === "All Items" || r.status === wlTab) &&
    (!q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q)));

  return (
    <div className="space-y-4">
      <ViewHead title="Inventory Command Center" subtitle="Real-time overview of inventory operations" />
      <KpiRow items={kpis} />

      <div className="grid gap-3 md:grid-cols-2">
        <DonutCard title="Stock Overview" action="View Analytics" center={stockOv.center} sub="Total Items" segments={stockOv.segments} legend={stockOv.legend} />
        <DonutCard title="Stock Value by Category" action="View Full Report" center={valCat.center} sub="Total Value" segments={valCat.segments} legend={valCat.legend} />
      </div>

      {/* Inventory Worklist */}
      <div className={`${card} p-3`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <h3 className="text-[13px] font-bold text-[#0c3b63]">Inventory Worklist</h3>
            <div className="flex items-center gap-3 overflow-x-auto">
              {wlTabs.map(([label, n]) => (
                <button key={label} type="button" onClick={() => setWlTab(label)} className="flex items-center gap-1 whitespace-nowrap pb-1 text-[12px] font-semibold" style={{ color: wlTab === label ? "#0078d4" : "#64748b", borderBottom: wlTab === label ? "2px solid #0078d4" : "2px solid transparent" }}>
                  {label} <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500">{n}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Filter size={12} /> Filters</button>
            <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-600"><Download size={12} /> Export</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-[11px]">
            <thead><tr className={th}>
              <th className={cellHead}>Item Code</th><th className={cellHead}>Item Name</th><th className={cellHead}>Category</th><th className={cellHead}>Unit</th><th className={cellHead}>Current Stock</th><th className={cellHead}>Min Level</th><th className={cellHead}>Max Level</th><th className={cellHead}>Status</th><th className={cellHead}>Last Updated</th><th className="pb-1.5 font-bold">Actions</th>
            </tr></thead>
            <tbody>
              {shownItems.map((r) => (
                <tr key={r.code} className="border-t border-black/[0.05]">
                  <td className="py-1.5 pr-3 font-semibold text-[#0078d4]">{r.code}</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-700">{r.name}</td>
                  <td className="py-1.5 pr-3 text-slate-600">{r.cat}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.unit}</td>
                  <td className="py-1.5 pr-3 font-bold" style={{ fontVariantNumeric: "tabular-nums", color: r.status === "Out of Stock" ? "#D13438" : "#1f2937" }}>{r.cur}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.min}</td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.max}</td>
                  <td className="py-1.5 pr-3"><Pill tone={r.tone}>{r.status}</Pill></td>
                  <td className="py-1.5 pr-3 text-slate-500">{r.upd}</td>
                  <td className="py-1.5"><button type="button" className="grid h-6 w-6 place-items-center rounded border border-black/[0.08] text-slate-400"><MoreHorizontal size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shownItems.length === 0 && <div className="py-6 text-center text-[11.5px] text-slate-400">No items match this filter.</div>}
        <div className="mt-2 text-[11px] text-slate-400">Showing {shownItems.length} of {ik ? ik.totalItems.toLocaleString() : "4,586"} items</div>
      </div>

      {/* Purchase orders · expiring · top consumed */}
      <div className="grid gap-3 xl:grid-cols-3">
        <div className={`${card} p-3`}>
          <PanelHead title="Recent Purchase Orders" action="View All" />
          <div className="space-y-1.5">
            {orders.map((o) => (
              <div key={o.po} className="flex items-center gap-2 rounded-lg border border-black/[0.05] bg-white/60 px-2 py-1.5">
                <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold text-[#0078d4]">{o.po}</div><div className="truncate text-[9.5px] text-slate-400">{o.supplier} · {o.date}</div></div>
                <div className="flex flex-col items-end gap-1"><Pill tone={o.tone}>{o.status}</Pill><span className="text-[10.5px] font-bold text-slate-700">{o.value}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Expiring Items (Next 30 Days)" action="View Report" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[280px] text-left text-[11px]">
              <thead><tr className={th}><th className={cellHead}>Item Name</th><th className={cellHead}>Batch No.</th><th className={cellHead}>Expiry Date</th><th className="pb-1.5 font-bold">Qty</th></tr></thead>
              <tbody>
                {expiring.map((e) => (
                  <tr key={e.batch} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{e.name}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{e.batch}</td>
                    <td className="py-1.5 pr-3 font-semibold text-[#CA5010]">{e.exp}</td>
                    <td className="py-1.5 text-slate-500">{e.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Top Consumed Items (This Month)" action="View Report" />
          <div className="space-y-2">
            {consumed.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[rgba(0,120,212,.1)] text-[10px] font-bold text-[#0078d4]">{i + 1}</span>
                <div className="min-w-0 flex-1"><div className="truncate text-[11.5px] font-semibold text-slate-700">{c.name}</div><div className="text-[9.5px] text-slate-400">{c.unit}</div></div>
                <span className="text-[12px] font-bold text-slate-700" style={{ fontVariantNumeric: "tabular-nums" }}>{c.qty}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Store-wise · supplier performance · valuation */}
      <div className="grid gap-3 xl:grid-cols-3">
        <div className={`${card} p-3`}>
          <PanelHead title="Store-wise Stock Status" action="View All" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] text-left text-[11px]">
              <thead><tr className={th}><th className={cellHead}>Store</th><th className={cellHead}>Total</th><th className={cellHead}>In Stock</th><th className={cellHead}>Low</th><th className={cellHead}>Out</th><th className="pb-1.5 font-bold">Value</th></tr></thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.store} className="border-t border-black/[0.05]">
                    <td className="py-1.5 pr-3 font-semibold text-slate-700">{s.store}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{s.total}</td>
                    <td className="py-1.5 pr-3 font-semibold text-[#16a34a]">{s.inStock}</td>
                    <td className="py-1.5 pr-3 font-semibold text-[#CA5010]">{s.low}</td>
                    <td className="py-1.5 pr-3 font-semibold text-[#D13438]">{s.out}</td>
                    <td className="py-1.5 font-semibold text-slate-700">{s.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`${card} p-3`}>
          <PanelHead title="Supplier Performance (Top 5)" action="View Report" />
          <div className="space-y-2">
            {suppliers.map((s) => (
              <div key={s.name} className="rounded-lg border border-black/[0.05] bg-white/60 px-2.5 py-2">
                <div className="flex items-center justify-between"><span className="text-[11.5px] font-semibold text-slate-700">{s.name}</span><span className="flex items-center gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={11} className={i < s.rating ? "fill-[#f5a623] text-[#f5a623]" : "text-slate-300"} />)}</span></div>
                <div className="mt-1 flex items-center gap-3 text-[9.5px] text-slate-500"><span>On-time: <b className="text-slate-700">{s.otd}</b></span><span>Quality: <b className="text-slate-700">{s.quality}</b></span><span>Fill: <b className="text-slate-700">{s.fill}</b></span></div>
              </div>
            ))}
          </div>
        </div>

        <DonutCard title="Inventory Valuation Summary" action="View Report" center={valCat.center} sub="Total Value" segments={valCat.segments} legend={valCat.legend} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page --- */

export default function CommandCenterOS() {
  const navigate = useNavigate();
  const session = getOsSession();
  const [tab, setTab] = useState("Overview");
  const [copilotTab, setCopilotTab] = useState("Insights");
  const [activeNav, setActiveNav] = useState("Command Center");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [userMenu, setUserMenu] = useState(false);
  const [search, setSearch] = useState("");
  const searchable = activeNav === "Billing" || activeNav === "Inventory" || activeNav === "Surgery / OT" || activeNav === "Patients";

  const logout = () => {
    clearOsSession();
    navigate("/os/login", { replace: true });
  };

  // Authoritative server-side token validation + cross-tab logout sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "cliniq.os.session" && !e.newValue) navigate("/os/login", { replace: true });
    };
    window.addEventListener("storage", onStorage);
    fetchOsMe().catch(() => {
      clearOsSession();
      navigate("/os/login", { replace: true });
    });
    return () => window.removeEventListener("storage", onStorage);
  }, [navigate]);

  // Reset the search box when switching workspaces.
  useEffect(() => { setSearch(""); }, [activeNav]);

  // Route guard: no session → back to the login screen.
  if (!session) return <Navigate to="/os/login" replace />;

  // Live data from the backend; merged over the static placeholders so the UI
  // still renders while loading or if the API is unavailable.
  const { data: overview } = useOsOverview();
  const statusItems = STATUS.map((s) => {
    const live = overview && ({
      "Hospital Status": overview.status.hospital,
      "Occupancy": overview.status.occupancy,
      "ER Wait Time": overview.status.erWaitMinutes != null ? `${overview.status.erWaitMinutes} min` : null,
      "ICU Occupancy": overview.status.icuOccupancy,
      "Beds Available": overview.status.bedsAvailable != null ? String(overview.status.bedsAvailable) : null,
    } as Record<string, string | null>)[s.label];
    return live != null ? { ...s, value: live } : s;
  });
  const kpiItems = KPIS.map((k) => {
    const live = overview && ({
      "Critical Labs": overview.kpis.criticalLabs,
      "Beds Available": overview.kpis.bedsAvailable,
      "Prescriptions Pending": overview.kpis.prescriptionsPending,
      "ER Patients": overview.kpis.erPatients,
      "Discharges Today": overview.kpis.dischargesToday,
      "Today's Revenue": overview.kpis.todaysRevenue,
    } as Record<string, number | string | null>)[k.label];
    return live != null ? { ...k, value: String(live) } : k;
  });
  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }, { role: "ai", text: copilotReply(text) }]);
    setDraft("");
    setCopilotTab("Ask Copilot");
  };

  return (
    <div
      onClick={handleConsoleClick}
      className="flex h-screen flex-col overflow-x-auto overflow-y-hidden text-slate-800"
      style={{
        fontFamily: '"Segoe UI Variable Text","Segoe UI",Inter,system-ui,sans-serif',
        background:
          "radial-gradient(1100px 760px at 4% -10%, rgba(23,58,110,.08), transparent 60%)," +
          "radial-gradient(1000px 720px at 99% 0%, rgba(184,148,95,.07), transparent 60%)," +
          "linear-gradient(180deg,#f6f4ef,#fbfaf7)",
      }}
    >
      <Toaster />
      {/* ============================================================ TOP BAR */}
      <header className="relative z-30 flex h-14 min-w-[1180px] shrink-0 items-center gap-3 border-b border-black/[0.06] bg-white/60 px-4 backdrop-blur-xl">
        <div className="flex w-[204px] items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(150deg,#3a96e0,#0078d4)", boxShadow: "0 6px 14px rgba(0,120,212,.24)" }}>
            <HeartPulse size={18} />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-[#0c3b63]">ClinIQ</div>
            <div className="text-[10.5px] text-slate-400">Smart Hospital OS</div>
          </div>
        </div>

        <label className="flex h-9 max-w-[340px] flex-1 items-center gap-2 rounded-xl border border-black/[0.07] bg-white/70 px-3 text-slate-400">
          <Search size={15} />
          <input data-fn value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400" placeholder={searchable ? `Search ${activeNav}…` : "Search anything..."} />
          {search ? (
            <button type="button" data-fn aria-label="Clear search" onClick={() => setSearch("")} className="text-slate-400 hover:text-slate-600"><XCircle size={14} /></button>
          ) : (
            <span className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">⌘ K</span>
          )}
        </label>

        <div className="ml-1 hidden items-center gap-1.5 xl:flex">
          {statusItems.map((s) => (
            <div key={s.label} className="rounded-lg border border-black/[0.06] bg-white/60 px-2.5 py-1">
              <div className="text-[9.5px] font-medium uppercase tracking-wide text-slate-400">{s.label}</div>
              <div className="flex items-center gap-1 text-[12px] font-bold text-slate-700">
                {s.dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />}
                {s.value}
                {s.trend && <ArrowUpRight size={11} className="text-emerald-500" />}
              </div>
            </div>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[#0078d4] px-3 py-2 text-[12.5px] font-semibold text-white shadow-[0_4px_12px_rgba(0,120,212,.24)] hover:bg-[#106ebe]">
            <Plus size={15} /> Quick Action
          </button>
          <button type="button" onClick={() => setCopilotTab("Ask Copilot")} className="flex items-center gap-1.5 rounded-xl border border-[rgba(0,120,212,.35)] bg-white/70 px-3 py-2 text-[12.5px] font-semibold text-[#0a5aa8] hover:bg-[rgba(220,236,249,.4)]">
            <Sparkles size={15} /> Copilot
          </button>
          <button type="button" aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-xl border border-black/[0.07] bg-white/70 text-slate-500">
            <Bell size={17} />
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#D13438] px-1 text-[9px] font-bold text-white">12</span>
          </button>
          <div className="relative">
            <button type="button" onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2 rounded-xl border border-black/[0.07] bg-white/70 py-1 pl-1 pr-2 hover:bg-white">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#0c3b63] text-[11px] font-bold text-white">{osInitials(session.name)}</span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[12px] font-bold text-slate-700">{session.name}</span>
                <span className="block text-[10px] text-slate-400">{session.department}</span>
              </span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {userMenu && (
              <>
                <button type="button" aria-label="Close menu" onClick={() => setUserMenu(false)} className="fixed inset-0 z-10 cursor-default" />
                <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-[0_16px_40px_rgba(28,33,51,.16)]">
                  <div className="border-b border-black/[0.06] px-3.5 py-3">
                    <div className="text-[13px] font-bold text-slate-700">{session.name}</div>
                    <div className="text-[11px] text-slate-400">{session.roleLabel} · {session.department}</div>
                  </div>
                  <button type="button" onClick={logout} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] font-semibold text-[#b42026] hover:bg-[#fdf1f1]">
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* =================================================== BODY: 3 columns */}
      <div className="flex min-h-0 min-w-[1180px] flex-1">
        {/* ---------------------------------------------------------- SIDEBAR */}
        <aside className="flex w-[204px] shrink-0 flex-col overflow-y-auto border-r border-black/[0.06] bg-white/45 px-2.5 py-2 backdrop-blur-xl">
          <SectionLabel>Workspace</SectionLabel>
          {NAV_WORKSPACE.map((n) => <NavRow key={n.label} {...n} active={n.label === activeNav} onClick={() => setActiveNav(n.label)} />)}
          <SectionLabel>Digital Twin</SectionLabel>
          {NAV_TWIN.map((n) => <NavRow key={n.label} {...n} active={n.label === activeNav} onClick={() => setActiveNav(n.label)} />)}
          <SectionLabel>System</SectionLabel>
          {NAV_SYSTEM.map((n) => <NavRow key={n.label} {...n} active={n.label === activeNav} onClick={() => setActiveNav(n.label)} />)}

          <div className="mt-3 px-1">
            <div className="mb-1 text-[10.5px] font-semibold text-slate-400">Floor Selector</div>
            <button type="button" className="flex w-full items-center justify-between rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-2 text-[12px] font-medium text-slate-600">
              All Floors <ChevronDown size={14} className="text-slate-400" />
            </button>
          </div>
        </aside>

        {/* ------------------------------------------------------------- MAIN */}
        <main className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
          {activeNav === "Patients" ? <PatientsView search={search} /> : activeNav === "Admissions" ? <AdmissionsView /> : activeNav === "Care Team" ? <CareTeamView /> : activeNav === "Labs" ? <LabsView /> : activeNav === "Radiology" ? <RadiologyView /> : activeNav === "Pharmacy" ? <PharmacyView /> : activeNav === "Surgery / OT" ? <SurgeryView search={search} /> : activeNav === "Billing" ? <BillingView search={search} /> : activeNav === "Inventory" ? <InventoryView search={search} /> : activeNav === "ICU" ? <ICUView /> : activeNav === "Emergency" ? <EmergencyView /> : (
          <>
          {/* header */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-[19px] font-extrabold tracking-tight text-[#0c3b63]">Command Center</h1>
              <p className="text-[12.5px] text-slate-400">Live overview of hospital operations</p>
            </div>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-black/[0.07] bg-white/70 text-slate-400"><MoreHorizontal size={18} /></button>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {kpiItems.map((k) => (
              <div key={k.label} className={`${card} relative overflow-hidden p-3.5`}>
                <span className="absolute inset-x-0 top-0 h-1" style={{ background: k.color }} />
                <div className="mb-2 grid h-9 w-9 place-items-center rounded-xl" style={{ background: `${k.color}1a`, color: k.color }}>
                  <k.icon size={18} />
                </div>
                <div className="text-[22px] font-extrabold leading-none text-slate-800" style={{ fontVariantNumeric: "tabular-nums" }}>{k.value}</div>
                <div className="mt-1 text-[11.5px] font-medium text-slate-500">{k.label}</div>
                <button type="button" className="mt-1.5 text-[11px] font-semibold hover:underline" style={{ color: k.color }}>{k.action}</button>
              </div>
            ))}
          </div>

          {/* Patient 360 */}
          <div className={`${card} mt-4 p-4`}>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[14px] font-extrabold text-[#0c3b63]">Patient 360 – Digital Twin</h2>
                <span className="flex items-center gap-1 rounded-full bg-[rgba(209,52,56,.12)] px-2 py-0.5 text-[10.5px] font-bold text-[#D13438]"><TriangleAlert size={11} /> High Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600"><FileText size={13} /> Open Chart</button>
                <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600"><Share2 size={13} /> Share</button>
                <button type="button" className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] bg-white/70 text-slate-400"><MoreHorizontal size={16} /></button>
              </div>
            </div>

            {/* identity + AI summary */}
            <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
              <div className="flex gap-3.5">
                <div className="grid h-[86px] w-[86px] shrink-0 place-items-center rounded-2xl border border-black/[0.06] bg-white/70 text-slate-300"><Users size={30} /></div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[17px] font-extrabold text-slate-800">Ahmed Khan <span className="text-slate-400">♂</span></div>
                  <div className="mt-0.5 text-[12px] text-slate-500">58 Y · Male · MRN: CLN-00012345</div>
                  <div className="text-[12px] text-slate-500">Phone: 0300-1234567</div>
                  <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {IDENTITY.map((f) => (
                      <div key={f.label}>
                        <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{f.label}</div>
                        <div className="text-[12px] font-semibold text-slate-700">{f.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[rgba(0,120,212,.14)] bg-[rgba(0,120,212,.04)] p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#0a5aa8]"><Sparkles size={13} /> AI Patient Summary</span>
                  <span className="text-[10px] text-slate-400">Generated 2 min ago</span>
                </div>
                <p className="text-[12px] leading-relaxed text-slate-600">
                  Ahmed is a 58-year-old male admitted with NSTEMI. He has a history of Type 2 Diabetes Mellitus,
                  Hypertension and Hyperlipidemia. Currently in ICU on dual antiplatelet therapy. Troponin levels
                  are elevated. Hemodynamically stable.
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/70 p-2">
                    <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Risk Score</div>
                    <div className="text-[13px] font-bold text-[#D13438]">High (85%)</div>
                  </div>
                  <div className="rounded-lg bg-white/70 p-2">
                    <div className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">Readmission Risk</div>
                    <div className="text-[13px] font-bold text-[#CA5010]">Moderate (36%)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* tabs */}
            <div className="mt-4 flex gap-x-5 gap-y-1 overflow-x-auto border-b border-black/[0.07]">
              {PATIENT_TABS.map((t) => (
                <button
                  key={t} type="button" onClick={() => setTab(t)}
                  className="relative shrink-0 whitespace-nowrap pb-2 text-[12.5px] font-semibold transition"
                  style={{ color: tab === t ? "#0078d4" : "#6b7280" }}
                >
                  {t}
                  {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-[#0078d4]" />}
                </button>
              ))}
            </div>

            {/* tab content */}
            <div className="mt-3">
              {tab === "Overview" && <OverviewTab />}
              {tab === "Timeline" && <TimelineTab />}
              {tab === "Vitals" && <VitalsTab />}
              {tab === "Labs" && <LabsTab />}
              {tab === "Imaging" && <ImagingTab />}
              {tab === "Medications" && <MedsTab />}
              {tab === "Procedures" && <ProceduresTab />}
              {tab === "Documents" && <DocumentsTab />}
              {tab === "Care Plan" && <CarePlanTab />}
              {tab === "Encounters" && <EncountersTab />}
              {tab === "Notes" && <NotesTab />}
            </div>
          </div>

          {/* bottom row */}
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
            {/* digital twin live view */}
            <div className={`${card} p-3.5`}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[12.5px] font-bold text-[#0c3b63]">Hospital Digital Twin – Live View</h3>
                <button type="button" className="flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white/70 px-2 py-1 text-[10.5px] font-semibold text-slate-500">Floor 3 - ICU <ChevronDown size={12} /></button>
              </div>
              <div className="relative grid h-[190px] place-items-center overflow-hidden rounded-xl border border-black/[0.06] bg-[linear-gradient(135deg,#eef3f9,#f7f5f1)]">
                <Building2 size={54} className="text-slate-300" />
                <div className="absolute left-1/2 top-1/2 w-[168px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#0078d4]/40 bg-white/95 p-2 shadow-lg">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">ICU-07 <ExternalLink size={11} className="text-slate-400" /></div>
                  <div className="text-[10.5px] text-slate-500">Ahmed Khan</div>
                  <div className="text-[10px] text-slate-400">Male, 58 Y · NSTEMI</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-emerald-600">Status: Stable</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
                {[["#16a34a", "Available"], ["#D13438", "Occupied"], ["#0078d4", "In Use"], ["#94a3b8", "Out of Service"]].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
                ))}
              </div>
            </div>

            {/* my tasks */}
            <div className={`${card} p-3.5`}>
              <PanelHead title="My Tasks" />
              <div className="space-y-2">
                {TASKS.map((t) => (
                  <label key={t.label} className="flex items-start gap-2.5">
                    <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-[#0078d4]" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium text-slate-700">{t.label}</span>
                      <span className="text-[10px] text-slate-400">{t.tag} · {t.time}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button type="button" className="mx-auto mt-2.5 block text-[11px] font-semibold text-[#0078d4] hover:underline">View All Tasks</button>
            </div>

            {/* activity feed */}
            <div className={`${card} p-3.5`}>
              <PanelHead title="Recent Activity Feed" action="View All" />
              <div className="space-y-2.5">
                {ACTIVITY.map((a, i) => (
                  <div key={i} className="flex gap-2.5">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[#0078d4]"><a.icon size={13} /></span>
                    <div className="text-[11.5px] leading-snug">
                      <span className="font-semibold text-slate-700">{a.who}</span> <span className="text-slate-500">{a.what}</span>
                      <div className="text-[10px] text-slate-400">{a.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          </>
          )}
        </main>

        {/* ---------------------------------------------------------- COPILOT */}
        <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-black/[0.06] bg-white/45 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
            <span className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-[#0a5aa8]"><Sparkles size={15} /> AI Copilot</span>
            <div className="flex items-center gap-1 text-slate-400">
              <button type="button" className="grid h-6 w-6 place-items-center rounded-md hover:bg-black/[0.04]"><ArrowUpRight size={14} /></button>
              <button type="button" className="grid h-6 w-6 place-items-center rounded-md hover:bg-black/[0.04]"><Maximize2 size={13} /></button>
            </div>
          </div>

          <div className="flex gap-4 border-b border-black/[0.06] px-4">
            {["Insights", "Tasks (4)", "Ask Copilot"].map((t) => (
              <button key={t} type="button" onClick={() => setCopilotTab(t)}
                className="relative py-2.5 text-[12px] font-semibold transition"
                style={{ color: copilotTab === t ? "#0078d4" : "#6b7280" }}>
                {t}
                {copilotTab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-[#0078d4]" />}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
            {copilotTab === "Insights" && activeNav !== "Admissions" && activeNav !== "Care Team" && activeNav !== "Labs" && activeNav !== "Radiology" && activeNav !== "Pharmacy" && activeNav !== "ICU" && activeNav !== "Emergency" && (              <>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Clinical Insights</div>
                  <div className="space-y-2">
                    {INSIGHTS.map((n) => (
                      <div key={n.title} className={`${card} flex gap-2.5 p-2.5`}>
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${n.tone}1a`, color: n.tone }}><n.icon size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-slate-700">{n.title}</span>
                            <span className="text-[9.5px] text-slate-400">{n.time}</span>
                          </div>
                          <p className="text-[11px] leading-snug text-slate-500">{n.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Recommended Actions</div>
                  <div className="space-y-1.5">
                    {ACTIONS.map((a) => (
                      <div key={a.label} className="flex items-center justify-between rounded-lg border border-black/[0.07] bg-white/70 px-2.5 py-2">
                        <span className="flex items-center gap-2 text-[11.5px] font-medium text-slate-600"><CheckSquare size={13} className="text-[#0078d4]" /> {a.label}</span>
                        <button type="button" onClick={() => ask(a.label)} className="rounded-md border border-[rgba(0,120,212,.3)] bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#0a5aa8]">{a.cta}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Ask</div>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_ASK.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0078d4]/40 hover:text-[#0a5aa8]">{q}</button>
                    ))}
                  </div>
                </div>

                <div className={`${card} p-3`}>
                  <div className="mb-1 flex items-center gap-1.5 text-[12px] font-bold text-slate-700"><Users size={13} className="text-[#0078d4]" /> Patient Similarity Finder</div>
                  <p className="text-[11px] leading-snug text-slate-500">Find similar patients based on diagnosis and treatment outcomes.</p>
                  <button type="button" className="mt-2 w-full rounded-lg border border-[rgba(0,120,212,.3)] bg-white/70 py-1.5 text-[11.5px] font-semibold text-[#0a5aa8]">Find Similar Patients</button>
                </div>
              </>
            )}

            {copilotTab === "Insights" && activeNav === "Admissions" && (
              <>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Admission Insights</div>
                  <div className="space-y-2">
                    {ADM_INSIGHTS.map((n) => (
                      <div key={n.title} className={`${card} flex gap-2.5 p-2.5`}>
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${n.tone}1a`, color: n.tone }}><n.icon size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-slate-700">{n.title}</span>
                            <span className="text-[9.5px] text-slate-400">{n.time}</span>
                          </div>
                          <p className="text-[11px] leading-snug text-slate-500">{n.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Bed Suggestions</div>
                  <div className={`${card} p-3`}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11.5px] font-bold text-slate-700">Best match for Ahmed Khan</span>
                      <Pill tone="#16a34a">95% Match</Pill>
                    </div>
                    <div className="text-[11.5px] font-semibold text-slate-700">ICU-07 · Floor 3</div>
                    <div className="text-[10px] text-slate-400">Available · Male Bed</div>
                    <button type="button" className="mt-2 w-full rounded-lg bg-[#0078d4] py-1.5 text-[11.5px] font-semibold text-white">Assign</button>
                    <button type="button" className="mt-1.5 w-full text-[11px] font-semibold text-[#0078d4]">View All Available Beds →</button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Insurance Alerts</div>
                  <div className="rounded-xl border border-[rgba(202,138,4,.25)] bg-[rgba(202,138,4,.07)] p-2.5">
                    <div className="mb-0.5 flex items-center gap-1.5 text-[11.5px] font-bold text-slate-700"><ShieldAlert size={13} className="text-[#CA8A04]" /> Jubilee Health Insurance</div>
                    <p className="text-[11px] leading-snug text-slate-600">Pre-authorization required for Angiography on inpatient basis.</p>
                    <button type="button" className="mt-1.5 text-[11px] font-semibold text-[#0078d4]">View Details →</button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Recommended Next Actions</div>
                  <div className="space-y-1.5">
                    {ADM_ACTIONS.map((a) => (
                      <div key={a.label} className="flex items-center justify-between rounded-lg border border-black/[0.07] bg-white/70 px-2.5 py-2">
                        <span className="flex items-center gap-2 text-[11.5px] font-medium text-slate-600"><CheckSquare size={13} className="text-[#0078d4]" /> {a.label}</span>
                        <button type="button" onClick={() => ask(a.label)} className="rounded-md border border-[rgba(0,120,212,.3)] bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#0a5aa8]">{a.cta}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Ask</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ADM_QUICK.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0078d4]/40 hover:text-[#0a5aa8]">{q}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {copilotTab === "Insights" && activeNav === "Care Team" && (
              <>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Staffing Insights</div>
                  <div className="space-y-2">
                    {CT_INSIGHTS.map((n) => (
                      <div key={n.title} className={`${card} flex gap-2.5 p-2.5`}>
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${n.tone}1a`, color: n.tone }}><n.icon size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-slate-700">{n.title}</span>
                            <span className="text-[9.5px] text-slate-400">{n.time}</span>
                          </div>
                          <p className="text-[11px] leading-snug text-slate-500">{n.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-1.5 text-[11px] font-semibold text-[#0078d4]">View All Insights →</button>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Recommended Actions</div>
                  <div className="space-y-1.5">
                    {CT_ACTIONS.map((a) => (
                      <div key={a.label} className="flex items-center justify-between rounded-lg border border-black/[0.07] bg-white/70 px-2.5 py-2">
                        <span className="text-[11.5px] font-medium text-slate-600">{a.label}</span>
                        <button type="button" onClick={() => ask(a.label)} className="rounded-md border border-[rgba(0,120,212,.3)] bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#0a5aa8]">{a.cta}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Suggested Reassignments</div>
                  <div className="space-y-1.5">
                    {CT_REASSIGN.map((r) => (
                      <div key={r.name} className={`${card} p-2.5`}>
                        <div className="flex items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[rgba(0,120,212,.1)] text-[10px] font-bold text-[#0078d4]">{initials(r.name)}</span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11.5px] font-semibold text-slate-700">{r.name}</div>
                            <div className="text-[9.5px] text-slate-400">{r.from} → {r.to}</div>
                          </div>
                          <button type="button" className="rounded-md bg-[#0078d4] px-2 py-1 text-[10px] font-semibold text-white">Reassign</button>
                        </div>
                        <div className="mt-1 text-[9.5px] font-semibold text-[#16a34a]">Skills match {r.match}</div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-1.5 text-[11px] font-semibold text-[#0078d4]">View All Suggestions →</button>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Ask</div>
                  <div className="flex flex-wrap gap-1.5">
                    {CT_QUICK.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0078d4]/40 hover:text-[#0a5aa8]">{q}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {copilotTab === "Insights" && activeNav === "Labs" && (
              <>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Lab Insights</div>
                  <div className="space-y-2">
                    {LAB_INSIGHTS.map((n) => (
                      <div key={n.title} className={`${card} flex gap-2.5 p-2.5`}>
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${n.tone}1a`, color: n.tone }}><n.icon size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-slate-700">{n.title}</span>
                            <span className="text-[9.5px] text-slate-400">{n.time}</span>
                          </div>
                          <p className="text-[11px] leading-snug text-slate-500">{n.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-1.5 text-[11px] font-semibold text-[#0078d4]">View All Insights →</button>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Recommended Actions</div>
                  <div className="space-y-1.5">
                    {LAB_ACTIONS.map((a) => (
                      <div key={a.label} className="flex items-center justify-between rounded-lg border border-black/[0.07] bg-white/70 px-2.5 py-2">
                        <span className="flex items-center gap-2 text-[11.5px] font-medium text-slate-600"><CheckSquare size={13} className="text-[#0078d4]" /> {a.label}</span>
                        <button type="button" onClick={() => ask(a.label)} className="rounded-md border border-[rgba(0,120,212,.3)] bg-white px-2 py-0.5 text-[10.5px] font-semibold text-[#0a5aa8]">{a.cta}</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Ask</div>
                  <div className="flex flex-wrap gap-1.5">
                    {LAB_QUICK.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0078d4]/40 hover:text-[#0a5aa8]">{q}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {copilotTab === "Insights" && activeNav === "Radiology" && (
              <>
                <button type="button" className="flex w-full items-center justify-between rounded-lg border border-black/[0.1] bg-white px-3 py-2 text-[12px] font-semibold text-slate-700">
                  <span><span className="font-normal text-slate-400">Current Study: </span>CT Chest w/ Contrast</span>
                  <ChevronDown size={13} className="text-slate-400" />
                </button>

                <div className={`${card} p-3`}>
                  <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-[#0a5aa8]"><Sparkles size={13} /> AI Findings Summary</div>
                  <ul className="space-y-1.5">
                    {RAD_FINDINGS.map((f) => (
                      <li key={f} className="flex gap-2 text-[11.5px] text-slate-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0078d4]" />{f}</li>
                    ))}
                  </ul>
                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-[10.5px] font-semibold text-slate-500"><span>AI Confidence</span><span className="text-[#16a34a]">92%</span></div>
                    <Bar pct={92} tone="#16a34a" />
                  </div>
                </div>

                <div className={`${card} p-3`}>
                  <div className="mb-1 text-[12px] font-bold text-[#0c3b63]">Comparison with Prior</div>
                  <div className="text-[11px] text-slate-500">CT Chest · 12 May 2024</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11.5px] font-semibold text-[#16a34a]">No Significant Change</span>
                    <button type="button" className="rounded-md border border-[rgba(0,120,212,.3)] bg-white px-2 py-1 text-[10.5px] font-semibold text-[#0a5aa8]">View Comparison</button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Suggested Actions</div>
                  <div className="space-y-1.5">
                    {RAD_SUGGESTED.map((a) => (
                      <div key={a} className="flex items-center gap-2 rounded-lg border border-black/[0.07] bg-white/70 px-2.5 py-2 text-[11.5px] font-medium text-slate-600"><CheckSquare size={13} className="text-[#16a34a]" /> {a}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Critical Findings</span><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
                  <div className="rounded-xl border border-[rgba(209,52,56,.28)] bg-[rgba(209,52,56,.06)] p-2.5">
                    <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#D13438]"><TriangleAlert size={13} /> Pulmonary Embolism Suspected</div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-600">Filling defect in right lower lobe pulmonary artery.</p>
                    <div className="mt-1 text-[10.5px] font-semibold text-slate-500">AI Confidence: <span className="text-[#D13438]">94%</span></div>
                    <div className="mt-2 flex items-center justify-between border-t border-black/[0.06] pt-2">
                      <span className="text-[9.5px] text-slate-400">Marked as Critical · 10:28 AM</span>
                      <button type="button" onClick={() => ask("Notify physician about the critical finding")} className="flex items-center gap-1 rounded-md bg-[#D13438] px-2 py-1 text-[10px] font-semibold text-white"><Bell size={11} /> Notify Physician</button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Ask</div>
                  <div className="flex flex-wrap gap-1.5">
                    {RAD_QUICK.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0078d4]/40 hover:text-[#0a5aa8]">{q}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {copilotTab === "Insights" && activeNav === "Pharmacy" && (
              <>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Insights</div>
                  <div className="space-y-2">
                    {PH_INSIGHTS.map((n) => (
                      <div key={n.title} className={`${card} flex gap-2.5 p-2.5`}>
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${n.tone}1a`, color: n.tone }}><n.icon size={14} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[12px] font-bold text-slate-700">{n.title}</span>
                            <button type="button" className="text-[10px] font-semibold text-[#0078d4]">View All</button>
                          </div>
                          <p className="text-[11px] leading-snug text-slate-500">{n.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-[10.5px] font-semibold text-slate-500"><span>AI Confidence</span><span className="text-[#16a34a]">92%</span></div>
                    <Bar pct={92} tone="#16a34a" />
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Critical Alerts</span><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
                  <div className="space-y-1.5">
                    {PH_CRITICAL.map((c) => (
                      <div key={c.title} className="rounded-lg border-l-2 bg-white/70 p-2" style={{ borderColor: c.tone, boxShadow: "0 1px 3px rgba(28,33,51,.05)" }}>
                        <div className="flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: c.tone }}><TriangleAlert size={12} /> {c.title}</div>
                        <div className="ml-4 text-[10.5px] text-slate-500">{c.body}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">My Tasks</span><button type="button" className="text-[10.5px] font-semibold text-[#0078d4]">View All</button></div>
                  <div className="space-y-1.5">
                    {PH_TASKS.map((t) => (
                      <label key={t} className="flex items-start gap-2.5 rounded-lg border border-black/[0.06] bg-white/70 px-2.5 py-1.5">
                        <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-[#0078d4]" />
                        <span className="text-[11.5px] font-medium text-slate-600">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Ask</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PH_QUICK.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0078d4]/40 hover:text-[#0a5aa8]">{q}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {copilotTab === "Insights" && activeNav === "ICU" && (
              <>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Insights</div>
                  <div className="space-y-2">
                    {ICU_INSIGHTS.map((t) => (
                      <div key={t} className={`${card} flex gap-2 p-2.5`}>
                        <Sparkles size={13} className="mt-0.5 shrink-0 text-[#0a5aa8]" />
                        <p className="text-[11.5px] leading-snug text-slate-600">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Ask</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ICU_QUICK.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0078d4]/40 hover:text-[#0a5aa8]">{q}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {copilotTab === "Insights" && activeNav === "Emergency" && (
              <>
                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Clinical Insights</div>
                  <div className="space-y-2">
                    {ED_INSIGHTS.map((t) => (
                      <div key={t} className={`${card} flex gap-2 p-2.5`}>
                        <Sparkles size={13} className="mt-0.5 shrink-0 text-[#0a5aa8]" />
                        <p className="text-[11.5px] leading-snug text-slate-600">{t}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Quick Ask</div>
                  <div className="flex flex-wrap gap-1.5">
                    {ED_QUICK.map((q) => (
                      <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-[#0078d4]/40 hover:text-[#0a5aa8]">{q}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {copilotTab === "Tasks (4)" && (
              <div className="space-y-2">
                {TASKS.map((t) => (
                  <label key={t.label} className="flex items-start gap-2.5 rounded-lg border border-black/[0.06] bg-white/70 px-2.5 py-2">
                    <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-[#0078d4]" />
                    <span className="min-w-0 flex-1"><span className="block text-[12px] font-medium text-slate-700">{t.label}</span><span className="text-[10px] text-slate-400">{t.tag} · {t.time}</span></span>
                  </label>
                ))}
              </div>
            )}

            {copilotTab === "Ask Copilot" && (
              <div className="flex flex-col gap-2">
                {messages.length === 0 && <div className="mt-6 px-2 text-center text-[11.5px] text-slate-400">Ask anything about Ahmed Khan — his vitals, labs, medications, imaging, or care plan.</div>}
                {messages.map((m, i) => (
                  m.role === "user" ? (
                    <div key={i} className="max-w-[85%] self-end rounded-xl rounded-br-sm bg-[#0078d4] px-3 py-2 text-[11.5px] leading-snug text-white">{m.text}</div>
                  ) : (
                    <div key={i} className="flex max-w-[92%] gap-2 self-start rounded-xl rounded-bl-sm border border-black/[0.06] bg-white/80 px-3 py-2 text-[11.5px] leading-snug text-slate-700">
                      <Sparkles size={13} className="mt-0.5 shrink-0 text-[#0a5aa8]" /><span>{m.text}</span>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-black/[0.06] p-3">
            <label className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white/70 px-3 py-2">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(draft); }} className="w-full bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-slate-400" placeholder={activeNav === "Admissions" ? "Ask anything about admissions..." : activeNav === "Care Team" ? "Ask anything about care team..." : activeNav === "Labs" ? "Ask anything about the lab..." : activeNav === "Radiology" ? "Ask anything about this study..." : activeNav === "Pharmacy" ? "Ask anything about pharmacy..." : activeNav === "ICU" ? "Ask anything about the ICU..." : activeNav === "Emergency" ? "Ask anything about the ED..." : "Ask anything about this patient..."} />
              <button type="button" onClick={() => ask(draft)} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#0078d4] text-white"><Send size={14} /></button>
            </label>
          </div>
        </aside>
      </div>
    </div>
  );
}
