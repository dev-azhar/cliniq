"""Bulk-seed the pharmacy formulary with 1000+ distinct medicines so the Doctor
Workspace prescription search (and the Pharmacy Live Stock Monitor) have a large,
realistic catalog to search/fetch from — not just the ~100 "core" items seeded by
app/seed.py.

Purely additive/idempotent: safe to re-run. Never touches/drops the existing core
stock list (referenced by smoke tests / demo scripts) — only INSERTs drug_name
values that don't already exist in `pharmacy_stock`.

Generates combinations of (generic base drug) x (strength/form variant) across
every major therapeutic class, using a deterministic RNG for stock qty/price so
re-runs produce identical data for names not yet present.

Run:  cd backend && .venv/bin/python seed_bulk_pharmacy.py
"""
from __future__ import annotations

import random
from datetime import date

from sqlalchemy import select

from app import models
from app.core.database import SessionLocal, init_db

TARGET_TOTAL = 1000

# Each entry: (generic_name, drug_class, strengths[], forms[])
# `forms` combine with `strengths` to generate distinct catalog SKUs, e.g.
# "Amoxicillin 250mg Capsule", "Amoxicillin 500mg Tablet", etc.
BASE_DRUGS: list[tuple[str, str, list[str], list[str]]] = [
    # -- Antibiotics / anti-infectives
    ("Amoxicillin", "penicillin", ["125mg", "250mg", "500mg"], ["Tablet", "Capsule", "Syrup"]),
    ("Ampicillin", "penicillin", ["250mg", "500mg"], ["Capsule", "Injection"]),
    ("Cloxacillin", "penicillin", ["250mg", "500mg"], ["Capsule"]),
    ("Piperacillin-Tazobactam", "penicillin", ["4.5g"], ["Injection"]),
    ("Azithromycin", "macrolide", ["250mg", "500mg"], ["Tablet", "Syrup"]),
    ("Clarithromycin", "macrolide", ["250mg", "500mg"], ["Tablet"]),
    ("Erythromycin", "macrolide", ["250mg", "500mg"], ["Tablet", "Syrup"]),
    ("Roxithromycin", "macrolide", ["150mg", "300mg"], ["Tablet"]),
    ("Cefixime", "cephalosporin", ["100mg", "200mg"], ["Tablet", "Syrup"]),
    ("Cefuroxime", "cephalosporin", ["250mg", "500mg"], ["Tablet", "Injection"]),
    ("Cefpodoxime", "cephalosporin", ["100mg", "200mg"], ["Tablet"]),
    ("Ceftriaxone", "cephalosporin", ["1g", "2g"], ["Injection"]),
    ("Cefotaxime", "cephalosporin", ["1g"], ["Injection"]),
    ("Cefazolin", "cephalosporin", ["1g"], ["Injection"]),
    ("Ciprofloxacin", "fluoroquinolone", ["250mg", "500mg", "750mg"], ["Tablet", "Injection"]),
    ("Levofloxacin", "fluoroquinolone", ["250mg", "500mg", "750mg"], ["Tablet", "Injection"]),
    ("Ofloxacin", "fluoroquinolone", ["100mg", "200mg", "400mg"], ["Tablet"]),
    ("Moxifloxacin", "fluoroquinolone", ["400mg"], ["Tablet"]),
    ("Norfloxacin", "fluoroquinolone", ["400mg"], ["Tablet"]),
    ("Doxycycline", "tetracycline", ["100mg"], ["Capsule", "Tablet"]),
    ("Minocycline", "tetracycline", ["50mg", "100mg"], ["Capsule"]),
    ("Metronidazole", "nitroimidazole", ["200mg", "400mg"], ["Tablet", "Syrup", "Injection"]),
    ("Tinidazole", "nitroimidazole", ["500mg"], ["Tablet"]),
    ("Ornidazole", "nitroimidazole", ["500mg"], ["Tablet"]),
    ("Amoxicillin-Clavulanate", "penicillin", ["375mg", "625mg", "1g"], ["Tablet"]),
    ("Nitrofurantoin", "urinary_antiseptic", ["50mg", "100mg"], ["Capsule"]),
    ("Fluconazole", "antifungal", ["50mg", "150mg", "200mg"], ["Tablet", "Capsule"]),
    ("Itraconazole", "antifungal", ["100mg", "200mg"], ["Capsule"]),
    ("Ketoconazole", "antifungal", ["200mg"], ["Tablet"]),
    ("Voriconazole", "antifungal", ["50mg", "200mg"], ["Tablet"]),
    ("Terbinafine", "antifungal", ["250mg"], ["Tablet"]),
    ("Vancomycin", "glycopeptide", ["500mg", "1g"], ["Injection"]),
    ("Linezolid", "oxazolidinone", ["600mg"], ["Tablet", "Injection"]),
    ("Clindamycin", "lincosamide", ["150mg", "300mg"], ["Capsule", "Injection"]),
    ("Gentamicin", "aminoglycoside", ["80mg"], ["Injection"]),
    ("Amikacin", "aminoglycoside", ["500mg"], ["Injection"]),
    ("Acyclovir", "antiviral", ["200mg", "400mg", "800mg"], ["Tablet"]),
    ("Valacyclovir", "antiviral", ["500mg", "1g"], ["Tablet"]),
    ("Oseltamivir", "antiviral", ["75mg"], ["Capsule"]),

    # -- Anti-TB / antimalarial
    ("Isoniazid", "antitubercular", ["100mg", "300mg"], ["Tablet"]),
    ("Rifampicin", "antitubercular", ["150mg", "450mg", "600mg"], ["Tablet", "Capsule"]),
    ("Pyrazinamide", "antitubercular", ["500mg", "750mg"], ["Tablet"]),
    ("Ethambutol", "antitubercular", ["400mg", "800mg"], ["Tablet"]),
    ("Artemether-Lumefantrine", "antimalarial", ["20/120mg"], ["Tablet"]),
    ("Chloroquine", "antimalarial", ["250mg"], ["Tablet"]),
    ("Primaquine", "antimalarial", ["7.5mg", "15mg"], ["Tablet"]),
    ("Albendazole", "anthelmintic", ["200mg", "400mg"], ["Tablet", "Syrup"]),
    ("Mebendazole", "anthelmintic", ["100mg"], ["Tablet"]),

    # -- Analgesics / anti-inflammatory
    ("Paracetamol", "analgesic", ["500mg", "650mg", "1g"], ["Tablet", "Syrup", "Injection"]),
    ("Ibuprofen", "nsaid", ["200mg", "400mg", "600mg"], ["Tablet", "Syrup"]),
    ("Diclofenac", "nsaid", ["25mg", "50mg", "75mg", "100mg"], ["Tablet", "Injection", "Gel"]),
    ("Aceclofenac", "nsaid", ["100mg", "200mg"], ["Tablet"]),
    ("Naproxen", "nsaid", ["250mg", "500mg"], ["Tablet"]),
    ("Ketorolac", "nsaid", ["10mg", "30mg"], ["Tablet", "Injection"]),
    ("Mefenamic Acid", "nsaid", ["250mg", "500mg"], ["Tablet", "Syrup"]),
    ("Etoricoxib", "nsaid", ["60mg", "90mg", "120mg"], ["Tablet"]),
    ("Celecoxib", "nsaid", ["100mg", "200mg"], ["Capsule"]),
    ("Nimesulide", "nsaid", ["100mg"], ["Tablet"]),
    ("Tramadol", "opioid", ["50mg", "100mg"], ["Tablet", "Injection"]),
    ("Morphine", "opioid", ["10mg", "15mg", "30mg"], ["Tablet", "Injection"]),
    ("Fentanyl", "opioid", ["25mcg", "50mcg"], ["Patch", "Injection"]),
    ("Aspirin", "antiplatelet", ["75mg", "150mg", "325mg"], ["Tablet"]),

    # -- Cardiology / hypertension / lipids
    ("Atenolol", "beta_blocker", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Metoprolol", "beta_blocker", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Bisoprolol", "beta_blocker", ["2.5mg", "5mg", "10mg"], ["Tablet"]),
    ("Carvedilol", "beta_blocker", ["3.125mg", "6.25mg", "12.5mg"], ["Tablet"]),
    ("Propranolol", "beta_blocker", ["10mg", "40mg"], ["Tablet"]),
    ("Amlodipine", "ccb", ["2.5mg", "5mg", "10mg"], ["Tablet"]),
    ("Nifedipine", "ccb", ["10mg", "20mg", "30mg"], ["Tablet"]),
    ("Diltiazem", "ccb", ["30mg", "60mg", "90mg"], ["Tablet"]),
    ("Verapamil", "ccb", ["40mg", "80mg"], ["Tablet"]),
    ("Losartan", "arb", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Telmisartan", "arb", ["20mg", "40mg", "80mg"], ["Tablet"]),
    ("Olmesartan", "arb", ["20mg", "40mg"], ["Tablet"]),
    ("Valsartan", "arb", ["80mg", "160mg"], ["Tablet"]),
    ("Ramipril", "ace_inhibitor", ["2.5mg", "5mg", "10mg"], ["Tablet"]),
    ("Enalapril", "ace_inhibitor", ["2.5mg", "5mg", "10mg"], ["Tablet"]),
    ("Lisinopril", "ace_inhibitor", ["5mg", "10mg", "20mg"], ["Tablet"]),
    ("Perindopril", "ace_inhibitor", ["2mg", "4mg", "8mg"], ["Tablet"]),
    ("Atorvastatin", "statin", ["10mg", "20mg", "40mg", "80mg"], ["Tablet"]),
    ("Rosuvastatin", "statin", ["5mg", "10mg", "20mg"], ["Tablet"]),
    ("Simvastatin", "statin", ["10mg", "20mg", "40mg"], ["Tablet"]),
    ("Clopidogrel", "antiplatelet", ["75mg"], ["Tablet"]),
    ("Ticagrelor", "antiplatelet", ["90mg"], ["Tablet"]),
    ("Furosemide", "diuretic", ["20mg", "40mg"], ["Tablet", "Injection"]),
    ("Spironolactone", "diuretic", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Hydrochlorothiazide", "diuretic", ["12.5mg", "25mg"], ["Tablet"]),
    ("Chlorthalidone", "diuretic", ["6.25mg", "12.5mg"], ["Tablet"]),
    ("Digoxin", "cardiac_glycoside", ["0.25mg"], ["Tablet"]),
    ("Isosorbide Mononitrate", "nitrate", ["10mg", "20mg", "40mg"], ["Tablet"]),
    ("Isosorbide Dinitrate", "nitrate", ["5mg", "10mg"], ["Tablet"]),
    ("Nicorandil", "vasodilator", ["5mg", "10mg"], ["Tablet"]),
    ("Ivabradine", "if_channel_inhibitor", ["5mg", "7.5mg"], ["Tablet"]),
    ("Warfarin", "anticoagulant", ["1mg", "3mg", "5mg"], ["Tablet"]),
    ("Heparin", "anticoagulant", ["5000IU"], ["Injection"]),
    ("Enoxaparin", "anticoagulant", ["40mg", "60mg"], ["Injection"]),
    ("Rivaroxaban", "anticoagulant", ["10mg", "15mg", "20mg"], ["Tablet"]),
    ("Apixaban", "anticoagulant", ["2.5mg", "5mg"], ["Tablet"]),

    # -- Diabetes / endocrine
    ("Metformin", "biguanide", ["500mg", "850mg", "1g"], ["Tablet"]),
    ("Glimepiride", "sulfonylurea", ["1mg", "2mg", "4mg"], ["Tablet"]),
    ("Gliclazide", "sulfonylurea", ["40mg", "80mg"], ["Tablet"]),
    ("Glipizide", "sulfonylurea", ["5mg", "10mg"], ["Tablet"]),
    ("Sitagliptin", "dpp4_inhibitor", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Vildagliptin", "dpp4_inhibitor", ["50mg"], ["Tablet"]),
    ("Linagliptin", "dpp4_inhibitor", ["5mg"], ["Tablet"]),
    ("Empagliflozin", "sglt2_inhibitor", ["10mg", "25mg"], ["Tablet"]),
    ("Dapagliflozin", "sglt2_inhibitor", ["5mg", "10mg"], ["Tablet"]),
    ("Canagliflozin", "sglt2_inhibitor", ["100mg", "300mg"], ["Tablet"]),
    ("Pioglitazone", "thiazolidinedione", ["15mg", "30mg"], ["Tablet"]),
    ("Voglibose", "alpha_glucosidase_inhibitor", ["0.2mg", "0.3mg"], ["Tablet"]),
    ("Insulin Glargine", "insulin", ["100IU/mL"], ["Injection"]),
    ("Insulin Aspart", "insulin", ["100IU/mL"], ["Injection"]),
    ("Insulin Lispro", "insulin", ["100IU/mL"], ["Injection"]),
    ("Insulin NPH", "insulin", ["100IU/mL"], ["Injection"]),
    ("Levothyroxine", "thyroid_hormone", ["25mcg", "50mcg", "100mcg"], ["Tablet"]),
    ("Carbimazole", "antithyroid", ["5mg", "10mg"], ["Tablet"]),
    ("Propylthiouracil", "antithyroid", ["50mg"], ["Tablet"]),
    ("Prednisolone", "corticosteroid", ["5mg", "10mg", "20mg"], ["Tablet"]),
    ("Hydrocortisone", "corticosteroid", ["100mg"], ["Injection"]),
    ("Dexamethasone", "corticosteroid", ["0.5mg", "4mg"], ["Tablet", "Injection"]),

    # -- Gastroenterology
    ("Omeprazole", "ppi", ["20mg", "40mg"], ["Capsule", "Injection"]),
    ("Pantoprazole", "ppi", ["20mg", "40mg"], ["Tablet", "Injection"]),
    ("Esomeprazole", "ppi", ["20mg", "40mg"], ["Tablet"]),
    ("Rabeprazole", "ppi", ["20mg"], ["Tablet"]),
    ("Ranitidine", "h2_blocker", ["150mg", "300mg"], ["Tablet"]),
    ("Famotidine", "h2_blocker", ["20mg", "40mg"], ["Tablet"]),
    ("Domperidone", "prokinetic", ["10mg"], ["Tablet", "Syrup"]),
    ("Ondansetron", "antiemetic", ["4mg", "8mg"], ["Tablet", "Injection"]),
    ("Metoclopramide", "prokinetic", ["10mg"], ["Tablet", "Injection"]),
    ("Lactulose", "laxative", ["10g/15mL"], ["Syrup"]),
    ("Bisacodyl", "laxative", ["5mg"], ["Tablet"]),
    ("Ispaghula Husk", "laxative", ["3.5g"], ["Powder"]),
    ("Loperamide", "antidiarrheal", ["2mg"], ["Tablet"]),
    ("Oral Rehydration Salts", "electrolyte", ["21g"], ["Sachet"]),
    ("Mesalamine", "aminosalicylate", ["400mg", "800mg"], ["Tablet"]),
    ("Sucralfate", "mucosal_protectant", ["1g"], ["Tablet", "Syrup"]),
    ("Simethicone", "antiflatulent", ["40mg", "80mg"], ["Tablet"]),
    ("Ursodeoxycholic Acid", "gallstone_dissolution", ["150mg", "300mg"], ["Tablet"]),

    # -- Respiratory / ENT / allergy
    ("Salbutamol", "bronchodilator", ["2mg", "4mg"], ["Tablet", "Syrup", "Inhaler"]),
    ("Levosalbutamol", "bronchodilator", ["1mg", "2mg"], ["Tablet", "Inhaler"]),
    ("Terbutaline", "bronchodilator", ["2.5mg"], ["Tablet", "Injection"]),
    ("Theophylline", "bronchodilator", ["100mg", "200mg", "400mg"], ["Tablet"]),
    ("Budesonide", "corticosteroid_inhaled", ["100mcg", "200mcg"], ["Inhaler"]),
    ("Budesonide+Formoterol", "corticosteroid_inhaled", ["160/4.5mcg"], ["Inhaler"]),
    ("Fluticasone", "corticosteroid_inhaled", ["50mcg", "125mcg"], ["Inhaler", "Nasal Spray"]),
    ("Beclomethasone", "corticosteroid_inhaled", ["50mcg", "100mcg"], ["Inhaler"]),
    ("Montelukast", "leukotriene_antagonist", ["4mg", "5mg", "10mg"], ["Tablet"]),
    ("Cetirizine", "antihistamine", ["5mg", "10mg"], ["Tablet", "Syrup"]),
    ("Levocetirizine", "antihistamine", ["2.5mg", "5mg"], ["Tablet"]),
    ("Loratadine", "antihistamine", ["10mg"], ["Tablet", "Syrup"]),
    ("Fexofenadine", "antihistamine", ["60mg", "120mg", "180mg"], ["Tablet"]),
    ("Chlorpheniramine", "antihistamine", ["4mg"], ["Tablet", "Syrup"]),
    ("Ambroxol", "mucolytic", ["30mg", "60mg"], ["Tablet", "Syrup"]),
    ("Bromhexine", "mucolytic", ["8mg"], ["Tablet", "Syrup"]),
    ("Dextromethorphan", "antitussive", ["10mg", "15mg"], ["Syrup"]),
    ("Xylometazoline", "nasal_decongestant", ["0.05%", "0.1%"], ["Nasal Spray"]),
    ("Oxymetazoline", "nasal_decongestant", ["0.05%"], ["Nasal Spray"]),
    ("Clotrimazole", "otic_antifungal", ["1%"], ["Ear Drops", "Cream"]),

    # -- Dermatology
    ("Clobetasol", "topical_corticosteroid", ["0.05%"], ["Cream", "Ointment"]),
    ("Betamethasone", "topical_corticosteroid", ["0.05%", "0.1%"], ["Cream", "Ointment"]),
    ("Hydrocortisone Cream", "topical_corticosteroid", ["1%"], ["Cream"]),
    ("Mupirocin", "topical_antibiotic", ["2%"], ["Ointment"]),
    ("Fusidic Acid", "topical_antibiotic", ["2%"], ["Cream"]),
    ("Terbinafine Cream", "topical_antifungal", ["1%"], ["Cream"]),
    ("Clotrimazole Cream", "topical_antifungal", ["1%"], ["Cream"]),
    ("Ketoconazole Cream", "topical_antifungal", ["2%"], ["Cream", "Shampoo"]),
    ("Calamine", "topical_soothing", ["15%"], ["Lotion"]),
    ("Permethrin", "scabicide", ["5%"], ["Cream"]),
    ("Benzoyl Peroxide", "acne", ["2.5%", "5%"], ["Gel"]),
    ("Adapalene", "acne", ["0.1%"], ["Gel"]),
    ("Tretinoin", "acne", ["0.025%", "0.05%"], ["Cream"]),
    ("Silver Sulfadiazine", "burn_care", ["1%"], ["Cream"]),

    # -- Ophthalmology
    ("Moxifloxacin Eye Drops", "ophthalmic_antibiotic", ["0.5%"], ["Eye Drops"]),
    ("Ciprofloxacin Eye Drops", "ophthalmic_antibiotic", ["0.3%"], ["Eye Drops"]),
    ("Tobramycin Eye Drops", "ophthalmic_antibiotic", ["0.3%"], ["Eye Drops"]),
    ("Timolol Eye Drops", "ophthalmic_beta_blocker", ["0.25%", "0.5%"], ["Eye Drops"]),
    ("Latanoprost Eye Drops", "ophthalmic_prostaglandin", ["0.005%"], ["Eye Drops"]),
    ("Carboxymethylcellulose", "ophthalmic_lubricant", ["0.5%", "1%"], ["Eye Drops"]),
    ("Prednisolone Eye Drops", "ophthalmic_steroid", ["1%"], ["Eye Drops"]),
    ("Olopatadine Eye Drops", "ophthalmic_antihistamine", ["0.1%"], ["Eye Drops"]),

    # -- Dentistry
    ("Chlorhexidine", "antiseptic_mouthwash", ["0.2%"], ["Mouthwash"]),
    ("Benzocaine", "topical_anesthetic", ["20%"], ["Gel"]),
    ("Lidocaine", "local_anesthetic", ["2%"], ["Injection", "Gel"]),

    # -- Psychiatry / neurology
    ("Sertraline", "ssri", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Escitalopram", "ssri", ["5mg", "10mg", "20mg"], ["Tablet"]),
    ("Fluoxetine", "ssri", ["10mg", "20mg"], ["Capsule"]),
    ("Paroxetine", "ssri", ["10mg", "20mg"], ["Tablet"]),
    ("Venlafaxine", "snri", ["37.5mg", "75mg", "150mg"], ["Tablet"]),
    ("Duloxetine", "snri", ["20mg", "30mg", "60mg"], ["Capsule"]),
    ("Alprazolam", "benzodiazepine", ["0.25mg", "0.5mg", "1mg"], ["Tablet"]),
    ("Clonazepam", "benzodiazepine", ["0.25mg", "0.5mg"], ["Tablet"]),
    ("Diazepam", "benzodiazepine", ["2mg", "5mg", "10mg"], ["Tablet", "Injection"]),
    ("Lorazepam", "benzodiazepine", ["1mg", "2mg"], ["Tablet"]),
    ("Olanzapine", "antipsychotic", ["2.5mg", "5mg", "10mg"], ["Tablet"]),
    ("Risperidone", "antipsychotic", ["1mg", "2mg", "4mg"], ["Tablet"]),
    ("Quetiapine", "antipsychotic", ["25mg", "100mg", "200mg"], ["Tablet"]),
    ("Haloperidol", "antipsychotic", ["1.5mg", "5mg"], ["Tablet", "Injection"]),
    ("Aripiprazole", "antipsychotic", ["5mg", "10mg", "15mg"], ["Tablet"]),
    ("Sodium Valproate", "anticonvulsant", ["200mg", "500mg"], ["Tablet"]),
    ("Levetiracetam", "anticonvulsant", ["250mg", "500mg", "1g"], ["Tablet"]),
    ("Carbamazepine", "anticonvulsant", ["100mg", "200mg", "400mg"], ["Tablet"]),
    ("Phenytoin", "anticonvulsant", ["100mg"], ["Tablet", "Injection"]),
    ("Lamotrigine", "anticonvulsant", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Topiramate", "anticonvulsant", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Gabapentin", "anticonvulsant", ["100mg", "300mg", "400mg"], ["Capsule"]),
    ("Pregabalin", "anticonvulsant", ["75mg", "150mg"], ["Capsule"]),
    ("Amitriptyline", "tricyclic_antidepressant", ["10mg", "25mg"], ["Tablet"]),
    ("Trihexyphenidyl", "anticholinergic", ["2mg"], ["Tablet"]),
    ("Donepezil", "cholinesterase_inhibitor", ["5mg", "10mg"], ["Tablet"]),
    ("Memantine", "nmda_antagonist", ["5mg", "10mg"], ["Tablet"]),
    ("Sumatriptan", "triptan", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Betahistine", "vertigo", ["8mg", "16mg", "24mg"], ["Tablet"]),
    ("Piracetam", "nootropic", ["400mg", "800mg"], ["Tablet"]),

    # -- Obstetrics & Gynaecology / supplements
    ("Folic Acid", "vitamin", ["1mg", "5mg"], ["Tablet"]),
    ("Ferrous Sulfate/Folic Acid", "hematinic", ["100mg/0.5mg"], ["Tablet"]),
    ("Calcium Carbonate/Cholecalciferol", "supplement", ["500mg/250IU"], ["Tablet"]),
    ("Progesterone", "hormone", ["100mg", "200mg"], ["Capsule", "Injection"]),
    ("Medroxyprogesterone", "hormone", ["10mg", "150mg"], ["Tablet", "Injection"]),
    ("Ethinylestradiol/Levonorgestrel", "oral_contraceptive", ["0.03/0.15mg"], ["Tablet"]),
    ("Misoprostol", "prostaglandin", ["200mcg"], ["Tablet"]),
    ("Oxytocin", "uterotonic", ["10IU"], ["Injection"]),
    ("Clomiphene", "ovulation_induction", ["50mg"], ["Tablet"]),
    ("Magnesium Sulfate", "anticonvulsant_obstetric", ["50%"], ["Injection"]),

    # -- Urology / nephrology
    ("Tamsulosin", "alpha_blocker", ["0.2mg", "0.4mg"], ["Capsule"]),
    ("Finasteride", "5_alpha_reductase_inhibitor", ["1mg", "5mg"], ["Tablet"]),
    ("Sildenafil", "pde5_inhibitor", ["25mg", "50mg", "100mg"], ["Tablet"]),
    ("Tadalafil", "pde5_inhibitor", ["5mg", "10mg", "20mg"], ["Tablet"]),
    ("Sodium Bicarbonate", "alkalinizer", ["500mg"], ["Tablet"]),
    ("Potassium Citrate", "urinary_alkalinizer", ["1080mg"], ["Tablet"]),
    ("Sevelamer", "phosphate_binder", ["400mg", "800mg"], ["Tablet"]),
    ("Erythropoietin", "growth_factor", ["2000IU", "4000IU"], ["Injection"]),

    # -- Oncology-support / hematinics
    ("Filgrastim", "growth_factor", ["300mcg"], ["Injection"]),
    ("Ondansetron Injection", "antiemetic", ["8mg"], ["Injection"]),
    ("Leucovorin", "folate_rescue", ["15mg"], ["Tablet", "Injection"]),
    ("Tamoxifen", "serm", ["10mg", "20mg"], ["Tablet"]),
    ("Letrozole", "aromatase_inhibitor", ["2.5mg"], ["Tablet"]),
    ("Anastrozole", "aromatase_inhibitor", ["1mg"], ["Tablet"]),
    ("Methotrexate", "antimetabolite", ["2.5mg", "10mg"], ["Tablet", "Injection"]),
    ("Cyclophosphamide", "alkylating_agent", ["50mg", "500mg"], ["Tablet", "Injection"]),

    # -- Vitamins / supplements
    ("Cyanocobalamin", "vitamin", ["500mcg", "1000mcg"], ["Tablet", "Injection"]),
    ("Multivitamin", "supplement", ["1 tablet"], ["Tablet"]),
    ("Zinc Sulfate", "supplement", ["20mg"], ["Syrup", "Tablet"]),
    ("Ascorbic Acid", "vitamin", ["500mg"], ["Tablet"]),
    ("Vitamin D3", "vitamin", ["1000IU", "60000IU"], ["Tablet", "Sachet"]),
    ("Vitamin B Complex", "vitamin", ["1 tablet"], ["Tablet", "Injection"]),
    ("Biotin", "vitamin", ["5mg", "10mg"], ["Tablet"]),
    ("Coenzyme Q10", "supplement", ["100mg"], ["Capsule"]),
    ("Omega-3 Fatty Acids", "supplement", ["1000mg"], ["Capsule"]),
    ("Probiotic Blend", "supplement", ["1 sachet"], ["Sachet", "Capsule"]),

    # -- Vaccines (stocked by pharmacy for OPD administration)
    ("Tetanus Toxoid", "vaccine", ["0.5mL"], ["Injection"]),
    ("Influenza Vaccine", "vaccine", ["0.5mL"], ["Injection"]),
    ("Hepatitis B Vaccine", "vaccine", ["1mL"], ["Injection"]),
    ("Pneumococcal Vaccine", "vaccine", ["0.5mL"], ["Injection"]),
    ("Rabies Vaccine", "vaccine", ["1mL"], ["Injection"]),

    # -- IV fluids / critical care
    ("Normal Saline 0.9%", "iv_fluid", ["500mL", "1000mL"], ["Infusion"]),
    ("Ringer Lactate", "iv_fluid", ["500mL", "1000mL"], ["Infusion"]),
    ("Dextrose 5%", "iv_fluid", ["500mL", "1000mL"], ["Infusion"]),
    ("Dextrose 25%", "iv_fluid", ["100mL"], ["Infusion"]),
    ("Mannitol", "osmotic_diuretic", ["20%"], ["Infusion"]),
    ("Noradrenaline", "vasopressor", ["2mg/mL"], ["Injection"]),
    ("Dopamine", "vasopressor", ["40mg/mL"], ["Injection"]),
    ("Adrenaline", "vasopressor", ["1mg/mL"], ["Injection"]),
    ("Atropine", "anticholinergic", ["0.6mg"], ["Injection"]),
    ("Midazolam", "benzodiazepine", ["1mg/mL", "5mg/mL"], ["Injection"]),
    ("Propofol", "anesthetic", ["10mg/mL"], ["Injection"]),
    ("Ketamine", "anesthetic", ["50mg/mL"], ["Injection"]),
    ("Succinylcholine", "muscle_relaxant", ["50mg/mL"], ["Injection"]),
    ("Neostigmine", "cholinesterase_inhibitor", ["0.5mg/mL"], ["Injection"]),

    # -- Additional antibiotics / anti-infectives
    ("Cefadroxil", "cephalosporin", ["250mg", "500mg"], ["Tablet", "Syrup"]),
    ("Cefaclor", "cephalosporin", ["250mg", "500mg"], ["Capsule", "Syrup"]),
    ("Cephalexin", "cephalosporin", ["250mg", "500mg"], ["Capsule", "Syrup"]),
    ("Sulbactam-Cefoperazone", "cephalosporin", ["1.5g"], ["Injection"]),
    ("Meropenem", "carbapenem", ["500mg", "1g"], ["Injection"]),
    ("Imipenem-Cilastatin", "carbapenem", ["500mg"], ["Injection"]),
    ("Ertapenem", "carbapenem", ["1g"], ["Injection"]),
    ("Colistin", "polymyxin", ["1MIU"], ["Injection"]),
    ("Teicoplanin", "glycopeptide", ["200mg", "400mg"], ["Injection"]),
    ("Rifaximin", "antibiotic_gi", ["200mg", "550mg"], ["Tablet"]),
    ("Faropenem", "penem", ["150mg", "300mg"], ["Tablet"]),
    ("Amoxicillin Pediatric Drops", "penicillin", ["100mg/mL"], ["Drops"]),
    ("Azithromycin Pediatric Syrup", "macrolide", ["100mg/5mL", "200mg/5mL"], ["Syrup"]),
    ("Cefpodoxime Pediatric Syrup", "cephalosporin", ["50mg/5mL"], ["Syrup"]),
    ("Griseofulvin", "antifungal", ["125mg", "250mg"], ["Tablet"]),
    ("Nystatin", "antifungal", ["100000IU"], ["Oral Suspension"]),
    ("Amphotericin B", "antifungal", ["50mg"], ["Injection"]),
    ("Caspofungin", "antifungal", ["50mg", "70mg"], ["Injection"]),
    ("Doxycycline Pediatric Syrup", "tetracycline", ["50mg/5mL"], ["Syrup"]),
    ("Ivermectin", "anthelmintic", ["3mg", "6mg", "12mg"], ["Tablet"]),
    ("Diethylcarbamazine", "anthelmintic", ["50mg", "100mg"], ["Tablet"]),
    ("Praziquantel", "anthelmintic", ["600mg"], ["Tablet"]),
    ("Pyrantel Pamoate", "anthelmintic", ["125mg", "250mg"], ["Tablet", "Syrup"]),
    ("Lamivudine", "antiviral", ["100mg", "150mg"], ["Tablet"]),
    ("Tenofovir", "antiviral", ["300mg"], ["Tablet"]),
    ("Efavirenz", "antiviral", ["200mg", "600mg"], ["Tablet"]),
    ("Ritonavir", "antiviral", ["100mg"], ["Tablet"]),
    ("Remdesivir", "antiviral", ["100mg"], ["Injection"]),
    ("Favipiravir", "antiviral", ["200mg", "400mg"], ["Tablet"]),

    # -- Additional cardiology / anticoagulant / lipid
    ("Fenofibrate", "fibrate", ["145mg", "160mg"], ["Tablet"]),
    ("Gemfibrozil", "fibrate", ["300mg", "600mg"], ["Tablet"]),
    ("Ezetimibe", "cholesterol_absorption_inhibitor", ["10mg"], ["Tablet"]),
    ("Nebivolol", "beta_blocker", ["2.5mg", "5mg"], ["Tablet"]),
    ("Labetalol", "beta_blocker", ["100mg", "200mg"], ["Tablet", "Injection"]),
    ("Amlodipine-Atenolol", "combination_antihypertensive", ["5/50mg"], ["Tablet"]),
    ("Amlodipine-Telmisartan", "combination_antihypertensive", ["5/40mg"], ["Tablet"]),
    ("Losartan-Hydrochlorothiazide", "combination_antihypertensive", ["50/12.5mg"], ["Tablet"]),
    ("Sacubitril-Valsartan", "arni", ["24/26mg", "49/51mg", "97/103mg"], ["Tablet"]),
    ("Trimetazidine", "anti_anginal", ["20mg", "35mg"], ["Tablet"]),
    ("Amiodarone", "antiarrhythmic", ["100mg", "200mg"], ["Tablet", "Injection"]),
    ("Adenosine", "antiarrhythmic", ["6mg"], ["Injection"]),
    ("Streptokinase", "thrombolytic", ["1.5MIU"], ["Injection"]),
    ("Alteplase", "thrombolytic", ["50mg"], ["Injection"]),
    ("Dabigatran", "anticoagulant", ["110mg", "150mg"], ["Capsule"]),
    ("Fondaparinux", "anticoagulant", ["2.5mg"], ["Injection"]),
    ("Cilostazol", "antiplatelet", ["50mg", "100mg"], ["Tablet"]),
    ("Nicorandil ER", "vasodilator", ["10mg", "20mg"], ["Tablet"]),

    # -- Additional GI
    ("Domperidone SR", "prokinetic", ["30mg"], ["Tablet"]),
    ("Itopride", "prokinetic", ["50mg"], ["Tablet"]),
    ("Drotaverine", "antispasmodic", ["40mg", "80mg"], ["Tablet", "Injection"]),
    ("Dicyclomine", "antispasmodic", ["10mg", "20mg"], ["Tablet", "Syrup"]),
    ("Hyoscine Butylbromide", "antispasmodic", ["10mg", "20mg"], ["Tablet", "Injection"]),
    ("Pancreatin", "digestive_enzyme", ["10000IU"], ["Tablet", "Capsule"]),
    ("Activated Charcoal", "antidote", ["250mg"], ["Tablet"]),
    ("Rifaximin Syrup", "antibiotic_gi", ["100mg/5mL"], ["Syrup"]),
    ("Zinc + ORS", "electrolyte", ["20mg"], ["Dispersible Tablet"]),
    ("Racecadotril", "antidiarrheal", ["10mg", "100mg"], ["Sachet", "Capsule"]),

    # -- Additional respiratory / ENT
    ("Formoterol", "bronchodilator", ["6mcg", "12mcg"], ["Inhaler"]),
    ("Tiotropium", "bronchodilator", ["18mcg"], ["Inhaler"]),
    ("Ipratropium Bromide", "bronchodilator", ["20mcg"], ["Inhaler", "Nebuliser Solution"]),
    ("Salbutamol Nebuliser Solution", "bronchodilator", ["2.5mg/2.5mL"], ["Nebuliser Solution"]),
    ("Acetylcysteine", "mucolytic", ["200mg", "600mg"], ["Sachet", "Tablet"]),
    ("Guaifenesin", "expectorant", ["100mg"], ["Syrup"]),
    ("Codeine-Phenylephrine Syrup", "antitussive", ["10/5mg per 5mL"], ["Syrup"]),
    ("Beclomethasone Nasal Spray", "corticosteroid_inhaled", ["50mcg"], ["Nasal Spray"]),
    ("Mometasone Nasal Spray", "corticosteroid_inhaled", ["50mcg"], ["Nasal Spray"]),
    ("Azelastine Nasal Spray", "antihistamine", ["0.1%"], ["Nasal Spray"]),
    ("Saline Nasal Spray", "nasal_decongestant", ["0.9%"], ["Nasal Spray"]),
    ("Ofloxacin Ear Drops", "otic_antibiotic", ["0.3%"], ["Ear Drops"]),
    ("Neomycin-Polymyxin Ear Drops", "otic_antibiotic", ["combination"], ["Ear Drops"]),

    # -- Additional dermatology
    ("Salicylic Acid", "keratolytic", ["6%"], ["Ointment", "Gel"]),
    ("Coal Tar", "antipsoriatic", ["5%"], ["Ointment"]),
    ("Calcipotriol", "antipsoriatic", ["0.005%"], ["Ointment"]),
    ("Tacrolimus", "topical_immunosuppressant", ["0.03%", "0.1%"], ["Ointment"]),
    ("Minoxidil", "hair_growth", ["2%", "5%"], ["Solution"]),
    ("Finasteride Topical", "hair_growth", ["0.25%"], ["Solution"]),
    ("Hydroquinone", "depigmenting", ["2%", "4%"], ["Cream"]),
    ("Diphenhydramine Cream", "antihistamine", ["1%"], ["Cream"]),
    ("Povidone Iodine", "antiseptic", ["5%", "10%"], ["Solution", "Ointment"]),
    ("Framycetin", "topical_antibiotic", ["1%"], ["Ointment"]),

    # -- Additional psychiatry / neurology
    ("Bupropion", "antidepressant", ["150mg", "300mg"], ["Tablet"]),
    ("Mirtazapine", "antidepressant", ["15mg", "30mg"], ["Tablet"]),
    ("Trazodone", "antidepressant", ["50mg", "100mg"], ["Tablet"]),
    ("Lithium Carbonate", "mood_stabilizer", ["300mg", "400mg"], ["Tablet"]),
    ("Clozapine", "antipsychotic", ["25mg", "100mg"], ["Tablet"]),
    ("Ziprasidone", "antipsychotic", ["20mg", "40mg"], ["Capsule"]),
    ("Chlorpromazine", "antipsychotic", ["25mg", "100mg"], ["Tablet"]),
    ("Baclofen", "muscle_relaxant", ["10mg", "25mg"], ["Tablet"]),
    ("Tizanidine", "muscle_relaxant", ["2mg", "4mg"], ["Tablet"]),
    ("Thiocolchicoside", "muscle_relaxant", ["4mg", "8mg"], ["Tablet", "Injection"]),
    ("Rivastigmine", "cholinesterase_inhibitor", ["1.5mg", "3mg", "4.5mg"], ["Capsule", "Patch"]),
    ("Ropinirole", "antiparkinsonian", ["0.25mg", "0.5mg", "1mg"], ["Tablet"]),
    ("Levodopa-Carbidopa", "antiparkinsonian", ["100/25mg"], ["Tablet"]),
    ("Naratriptan", "triptan", ["2.5mg"], ["Tablet"]),
    ("Flunarizine", "antimigraine", ["5mg", "10mg"], ["Tablet"]),
    ("Propranolol Migraine", "beta_blocker", ["20mg", "40mg"], ["Tablet"]),
    ("Cinnarizine", "vertigo", ["25mg"], ["Tablet"]),

    # -- Additional obstetrics / gynaecology / pediatrics
    ("Dydrogesterone", "hormone", ["10mg"], ["Tablet"]),
    ("Ethamsylate", "hemostatic", ["250mg", "500mg"], ["Tablet", "Injection"]),
    ("Tranexamic Acid", "hemostatic", ["500mg"], ["Tablet", "Injection"]),
    ("Carbetocin", "uterotonic", ["100mcg"], ["Injection"]),
    ("Methylergometrine", "uterotonic", ["0.2mg"], ["Tablet", "Injection"]),
    ("Nifedipine Tocolytic", "tocolytic", ["10mg"], ["Tablet"]),
    ("Isoxsuprine", "tocolytic", ["10mg"], ["Tablet"]),
    ("Clindamycin Vaginal Cream", "topical_antibiotic", ["2%"], ["Vaginal Cream"]),
    ("Fluconazole Vaginal", "antifungal", ["150mg"], ["Vaginal Capsule"]),
    ("Metronidazole Vaginal Gel", "nitroimidazole", ["0.75%"], ["Vaginal Gel"]),
    ("Paracetamol Pediatric Drops", "analgesic", ["100mg/mL"], ["Drops"]),
    ("Ibuprofen Pediatric Suspension", "nsaid", ["100mg/5mL"], ["Suspension"]),
    ("Cough Syrup Pediatric", "antitussive", ["combination"], ["Syrup"]),
    ("Multivitamin Pediatric Drops", "vitamin", ["1mL"], ["Drops"]),
    ("Iron Pediatric Syrup", "hematinic", ["50mg/5mL"], ["Syrup"]),

    # -- Additional urology / nephrology / oncology-support
    ("Solifenacin", "antimuscarinic", ["5mg", "10mg"], ["Tablet"]),
    ("Oxybutynin", "antimuscarinic", ["2.5mg", "5mg"], ["Tablet"]),
    ("Dutasteride", "5_alpha_reductase_inhibitor", ["0.5mg"], ["Capsule"]),
    ("Alfuzosin", "alpha_blocker", ["10mg"], ["Tablet"]),
    ("Silodosin", "alpha_blocker", ["4mg", "8mg"], ["Capsule"]),
    ("Calcitriol", "vitamin_d_analog", ["0.25mcg", "0.5mcg"], ["Capsule"]),
    ("Cinacalcet", "calcimimetic", ["30mg", "60mg"], ["Tablet"]),
    ("Darbepoetin", "growth_factor", ["40mcg", "60mcg"], ["Injection"]),
    ("Ondansetron ODT", "antiemetic", ["4mg", "8mg"], ["Dispersible Tablet"]),
    ("Aprepitant", "antiemetic", ["80mg", "125mg"], ["Capsule"]),
    ("Palonosetron", "antiemetic", ["0.25mg"], ["Injection"]),
    ("Zoledronic Acid", "bisphosphonate", ["4mg"], ["Injection"]),
    ("Alendronate", "bisphosphonate", ["70mg"], ["Tablet"]),
    ("Denosumab", "bone_resorption_inhibitor", ["60mg", "120mg"], ["Injection"]),
    ("Docetaxel", "taxane", ["20mg", "80mg"], ["Injection"]),
    ("Paclitaxel", "taxane", ["30mg", "100mg"], ["Injection"]),
    ("Carboplatin", "platinum_agent", ["150mg", "450mg"], ["Injection"]),
    ("Cisplatin", "platinum_agent", ["10mg", "50mg"], ["Injection"]),
    ("Oxaliplatin", "platinum_agent", ["50mg", "100mg"], ["Injection"]),
    ("5-Fluorouracil", "antimetabolite", ["250mg", "500mg"], ["Injection"]),
    ("Doxorubicin", "anthracycline", ["10mg", "50mg"], ["Injection"]),
    ("Bevacizumab", "monoclonal_antibody", ["100mg", "400mg"], ["Injection"]),
    ("Trastuzumab", "monoclonal_antibody", ["150mg", "440mg"], ["Injection"]),
    ("Rituximab", "monoclonal_antibody", ["100mg", "500mg"], ["Injection"]),
    ("Imatinib", "tyrosine_kinase_inhibitor", ["100mg", "400mg"], ["Tablet"]),
    ("Erlotinib", "tyrosine_kinase_inhibitor", ["100mg", "150mg"], ["Tablet"]),
    ("Osimertinib", "tyrosine_kinase_inhibitor", ["40mg", "80mg"], ["Tablet"]),

    # -- Additional vitamins / supplements / OTC
    ("Vitamin E", "vitamin", ["400IU"], ["Capsule"]),
    ("Vitamin A", "vitamin", ["25000IU", "50000IU"], ["Capsule"]),
    ("Vitamin K", "vitamin", ["10mg"], ["Tablet", "Injection"]),
    ("Selenium", "supplement", ["100mcg"], ["Tablet"]),
    ("Chromium Picolinate", "supplement", ["200mcg"], ["Tablet"]),
    ("L-Carnitine", "supplement", ["500mg"], ["Tablet"]),
    ("Glucosamine-Chondroitin", "joint_supplement", ["500/400mg"], ["Tablet"]),
    ("Methylcobalamin", "vitamin", ["500mcg", "1500mcg"], ["Tablet"]),
    ("Alpha Lipoic Acid", "supplement", ["100mg", "300mg"], ["Tablet"]),
    ("Evening Primrose Oil", "supplement", ["500mg", "1000mg"], ["Capsule"]),
    ("Cod Liver Oil", "supplement", ["500mg"], ["Capsule"]),
    ("Rehydration Electrolyte Powder", "electrolyte", ["1 sachet"], ["Sachet"]),
    ("Antacid Suspension", "antacid", ["combination"], ["Suspension"]),
    ("Magnesium Hydroxide", "antacid", ["400mg"], ["Suspension", "Tablet"]),
    ("Aluminium Hydroxide", "antacid", ["500mg"], ["Suspension", "Tablet"]),

    # -- Additional vaccines / immunology
    ("BCG Vaccine", "vaccine", ["0.1mL"], ["Injection"]),
    ("MMR Vaccine", "vaccine", ["0.5mL"], ["Injection"]),
    ("DPT Vaccine", "vaccine", ["0.5mL"], ["Injection"]),
    ("Oral Polio Vaccine", "vaccine", ["2 drops"], ["Drops"]),
    ("Typhoid Vaccine", "vaccine", ["0.5mL"], ["Injection"]),
    ("Varicella Vaccine", "vaccine", ["0.5mL"], ["Injection"]),
    ("HPV Vaccine", "vaccine", ["0.5mL"], ["Injection"]),
    ("Immunoglobulin", "immunoglobulin", ["100mg/mL"], ["Injection"]),

    # -- Additional IV fluids / critical care / anesthesia
    ("Sevoflurane", "inhalational_anesthetic", ["250mL"], ["Inhalation"]),
    ("Isoflurane", "inhalational_anesthetic", ["250mL"], ["Inhalation"]),
    ("Nitrous Oxide", "inhalational_anesthetic", ["cylinder"], ["Inhalation"]),
    ("Bupivacaine", "local_anesthetic", ["0.5%"], ["Injection"]),
    ("Ropivacaine", "local_anesthetic", ["0.75%"], ["Injection"]),
    ("Vecuronium", "muscle_relaxant", ["4mg"], ["Injection"]),
    ("Rocuronium", "muscle_relaxant", ["50mg"], ["Injection"]),
    ("Dexmedetomidine", "sedative", ["100mcg/mL"], ["Injection"]),
    ("Naloxone", "opioid_antagonist", ["0.4mg"], ["Injection"]),
    ("Flumazenil", "benzodiazepine_antagonist", ["0.5mg"], ["Injection"]),
    ("Protamine Sulfate", "heparin_antidote", ["50mg"], ["Injection"]),
    ("Calcium Gluconate", "electrolyte_replacement", ["10%"], ["Injection"]),
    ("Potassium Chloride", "electrolyte_replacement", ["15%"], ["Injection"]),
    ("Sodium Chloride 3%", "iv_fluid", ["100mL"], ["Infusion"]),
    ("Human Albumin", "plasma_expander", ["20%"], ["Infusion"]),

    # -- Extra coverage (pediatric/ geriatric/ combination formulations) to round out the catalog
    ("Paracetamol-Ibuprofen", "analgesic", ["325/200mg"], ["Tablet"]),
    ("Paracetamol-Tramadol", "analgesic", ["325/37.5mg"], ["Tablet"]),
    ("Aceclofenac-Paracetamol", "nsaid", ["100/325mg"], ["Tablet"]),
    ("Diclofenac-Paracetamol", "nsaid", ["50/325mg"], ["Tablet"]),
    ("Amoxicillin-Clavulanate Pediatric Syrup", "penicillin", ["228.5mg/5mL", "457mg/5mL"], ["Syrup"]),
    ("Cefixime-Ofloxacin", "cephalosporin", ["200/200mg"], ["Tablet"]),
    ("Cefpodoxime-Clavulanate", "cephalosporin", ["200/125mg"], ["Tablet"]),
    ("Amlodipine-Losartan", "combination_antihypertensive", ["5/50mg"], ["Tablet"]),
    ("Metformin-Glimepiride", "combination_antidiabetic", ["500/1mg", "500/2mg"], ["Tablet"]),
    ("Metformin-Sitagliptin", "combination_antidiabetic", ["500/50mg", "1000/50mg"], ["Tablet"]),
    ("Metformin-Voglibose", "combination_antidiabetic", ["500/0.2mg"], ["Tablet"]),
    ("Metformin-Pioglitazone", "combination_antidiabetic", ["500/15mg"], ["Tablet"]),
    ("Glimepiride-Pioglitazone", "combination_antidiabetic", ["2/15mg"], ["Tablet"]),
    ("Rosuvastatin-Fenofibrate", "combination_lipid", ["10/145mg"], ["Tablet"]),
    ("Atorvastatin-Clopidogrel", "combination_cardio", ["10/75mg"], ["Tablet"]),
    ("Amlodipine-Atorvastatin", "combination_cardio", ["5/10mg"], ["Tablet"]),
    ("Pantoprazole-Domperidone", "combination_gi", ["40/10mg"], ["Tablet"]),
    ("Rabeprazole-Domperidone", "combination_gi", ["20/30mg"], ["Capsule"]),
    ("Omeprazole-Domperidone", "combination_gi", ["20/10mg"], ["Capsule"]),
    ("Ranitidine-Domperidone", "combination_gi", ["150/10mg"], ["Tablet"]),
    ("Cetirizine-Phenylephrine", "cold_combination", ["5/10mg"], ["Tablet", "Syrup"]),
    ("Paracetamol-Phenylephrine-Chlorpheniramine", "cold_combination", ["500/5/2mg"], ["Tablet"]),
    ("Levocetirizine-Montelukast", "combination_respiratory", ["5/10mg"], ["Tablet"]),
    ("Salbutamol-Bromhexine", "combination_respiratory", ["2/8mg"], ["Syrup"]),
    ("Amoxicillin Pediatric Suspension 250mg", "penicillin", ["250mg/5mL"], ["Suspension"]),
    ("Azithromycin Pediatric Suspension 100mg", "macrolide", ["100mg/5mL"], ["Suspension"]),
    ("Ondansetron Pediatric Syrup", "antiemetic", ["4mg/5mL"], ["Syrup"]),
    ("Domperidone Pediatric Syrup", "prokinetic", ["5mg/5mL"], ["Syrup"]),
    ("Cetirizine Pediatric Drops", "antihistamine", ["2.5mg/mL"], ["Drops"]),
    ("Vitamin D3 Pediatric Drops", "vitamin", ["400IU/mL"], ["Drops"]),
    ("Calcium Pediatric Syrup", "supplement", ["equiv 250mg/5mL"], ["Syrup"]),
    ("Lactobacillus Sachet", "probiotic", ["1 sachet"], ["Sachet"]),
    ("Saccharomyces Boulardii", "probiotic", ["250mg"], ["Capsule", "Sachet"]),
    ("Ferrous Ascorbate Syrup", "hematinic", ["30mg/5mL"], ["Syrup"]),
    ("Ferrous Ascorbate Tablet", "hematinic", ["100mg"], ["Tablet"]),
    ("Iron Sucrose Injection", "hematinic", ["100mg/5mL"], ["Injection"]),
    ("Folic Acid Pediatric Drops", "vitamin", ["0.5mg/mL"], ["Drops"]),
    ("Zinc Pediatric Dispersible Tablet", "supplement", ["20mg"], ["Dispersible Tablet"]),
    ("Amlodipine ODT", "ccb", ["5mg"], ["Dispersible Tablet"]),
    ("Levetiracetam Syrup", "anticonvulsant", ["100mg/mL"], ["Syrup"]),
    ("Sodium Valproate Syrup", "anticonvulsant", ["200mg/5mL"], ["Syrup"]),
    ("Phenobarbitone", "anticonvulsant", ["30mg", "60mg"], ["Tablet"]),
    ("Clobazam", "benzodiazepine", ["5mg", "10mg"], ["Tablet"]),
    ("Modafinil", "wakefulness_agent", ["100mg", "200mg"], ["Tablet"]),
    ("Atomoxetine", "adhd_medication", ["10mg", "25mg", "40mg"], ["Capsule"]),
    ("Methylphenidate", "adhd_medication", ["10mg", "18mg"], ["Tablet"]),
    ("Melatonin", "sleep_aid", ["3mg", "5mg"], ["Tablet"]),
    ("Zolpidem", "sedative_hypnotic", ["5mg", "10mg"], ["Tablet"]),
    ("Eszopiclone", "sedative_hypnotic", ["2mg", "3mg"], ["Tablet"]),
    ("Hydroxyzine", "antihistamine", ["10mg", "25mg"], ["Tablet", "Syrup"]),
    ("Promethazine", "antihistamine", ["10mg", "25mg"], ["Tablet", "Syrup"]),
    ("Meclizine", "antivertigo", ["25mg"], ["Tablet"]),
    ("Prochlorperazine", "antiemetic", ["5mg", "10mg"], ["Tablet", "Injection"]),
]


def _generate_catalog() -> list[tuple[str, str, str, int, float, bool]]:
    """Expand BASE_DRUGS x strengths x forms into distinct catalog rows.

    Returns list of (drug_name, salt, drug_class, quantity_available, unit_price, formulary).
    """
    rng = random.Random(20260723)
    rows: list[tuple[str, str, str, int, float, bool]] = []
    seen: set[str] = set()
    for generic, drug_class, strengths, forms in BASE_DRUGS:
        for strength in strengths:
            for form in forms:
                name = f"{generic} {strength} {form}"
                if len(name) > 120 or name in seen:
                    continue
                seen.add(name)
                qty = rng.choice([0, 0] + list(range(10, 400, 10)))  # a few deliberately out-of-stock
                price = round(rng.uniform(1.5, 500.0), 2)
                formulary = rng.random() > 0.05  # ~95% formulary, a few non-formulary for the badge
                rows.append((name, generic, drug_class, qty, price, formulary))
    return rows


def seed_bulk_pharmacy() -> None:
    init_db()
    db = SessionLocal()
    try:
        existing_names = set(db.scalars(select(models.PharmacyStock.drug_name)).all())
        current_total = len(existing_names)
        catalog = _generate_catalog()

        added = 0
        for name, salt, drug_class, qty, price, formulary in catalog:
            if name in existing_names:
                continue
            if current_total + added >= TARGET_TOTAL:
                break
            db.add(models.PharmacyStock(
                drug_name=name, salt=salt, drug_class=drug_class,
                quantity_available=qty, quantity_reserved=0,
                unit_price=price, formulary=formulary,
                batch="B-2026-BLK", expiry_date=date(2027, 12, 31),
                location="Pharmacy 1",
            ))
            existing_names.add(name)
            added += 1

        db.commit()
        total_count = len(db.scalars(select(models.PharmacyStock.drug_name)).all())
        print(f"Added {added} new pharmacy_stock rows (catalog generated {len(catalog)} distinct SKUs).")
        print(f"Total pharmacy_stock rows now: {total_count} (target {TARGET_TOTAL}).")
    finally:
        db.close()


if __name__ == "__main__":
    seed_bulk_pharmacy()
