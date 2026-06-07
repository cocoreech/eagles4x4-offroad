// ============================================================
// Common vehicles in the Philippines for the booking form
// ============================================================
// Comprehensive list covering all major brands selling in PH:
//   - Top sellers: Toyota, Mitsubishi, Nissan, Honda, Hyundai, Ford, Isuzu
//   - Chinese: MG, Geely, Foton, Chery, Changan, BAIC, BYD, GAC, JAC, Maxus, DFSK
//   - Premium: BMW, Mercedes, Audi, Lexus, Land Rover, Porsche, Jaguar, Volvo
//   - Other: Subaru, Mazda, Kia, Chevrolet, Jeep, Suzuki, VW, Mini, Tata, Mahindra
//
// Models include current line-up + popular discontinued models still on PH roads.
// Server-side validation (isValidMakeModel) ensures only listed entries are accepted —
// hacker cannot inject arbitrary text.

export const VEHICLE_MAKES_MODELS: Record<string, string[]> = {
  'Audi': [
    'A3', 'A4', 'A5', 'A6', 'A7', 'A8',
    'Q2', 'Q3', 'Q5', 'Q7', 'Q8',
    'e-tron', 'e-tron GT',
    'RS3', 'RS5', 'RS6', 'RS7',
  ],
  'BAIC': [
    'BJ40', 'BJ80',
    'X25', 'X35', 'X55', 'X65',
    'MZ40', 'MZ45',
    'Beijing X7', 'M50S',
  ],
  'BMW': [
    '1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series',
    'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7',
    'iX', 'iX1', 'iX3',
    'M2', 'M3', 'M4', 'M5',
    'Z4',
  ],
  'BYD': [
    'Atto 3', 'Dolphin', 'Seal', 'Sealion 6', 'Sealion 7',
    'Han', 'Tang', 'Yuan Plus',
    'Song Plus', 'Qin',
  ],
  'Changan': [
    'Alsvin',
    'CS35 Plus', 'CS55 Plus', 'CS75 Plus',
    'Hunter Plus', 'Hunter EV',
    'Lumin',
    'UNI-T', 'UNI-K', 'UNI-Z',
  ],
  'Chery': [
    'Arrizo 5', 'Arrizo 6',
    'Tiggo 2 Pro', 'Tiggo 4', 'Tiggo 4 Pro', 'Tiggo 7', 'Tiggo 7 Pro', 'Tiggo 8', 'Tiggo 8 Pro', 'Tiggo 8 Pro Max',
    'Omoda 5',
  ],
  'Chevrolet': [
    'Aveo', 'Sail', 'Spark',
    'Trax', 'Tracker', 'Trailblazer', 'Captiva', 'Equinox',
    'Colorado',
    'Silverado', 'Suburban', 'Tahoe',
    'Camaro', 'Corvette',
    'Spin',
  ],
  'DFSK': [
    'Glory 500', 'Glory 580', 'Glory 600',
    'C31', 'C32', 'C35', 'C37',
    'Mini Truck', 'Mini Van', 'Super Cab',
  ],
  'Ford': [
    'EcoSport', 'Escape', 'Territory',
    'Ranger', 'Ranger Raptor', 'Ranger Wildtrak',
    'Everest', 'Bronco', 'Bronco Sport',
    'Explorer', 'Expedition',
    'F-150', 'F-250',
    'Mustang', 'Mustang Mach-E',
  ],
  'Foton': [
    'Gratour iM6', 'Gratour iM8',
    'Thunder', 'Tornado', 'Toplander', 'Tunland',
    'View', 'View Transvan', 'View Traveller', 'Toano',
    'TM-PRO',
  ],
  'GAC': [
    'Emkoo', 'Empow',
    'GS3 Emzoom', 'GS4', 'GS8',
  ],
  'Geely': [
    'Azkarra', 'Boyue',
    'Coolray', 'Emgrand', 'Emgrand X7',
    'GX3 Pro',
    'Monjaro', 'Okavango', 'Tugella',
  ],
  'GMC': [
    'Acadia', 'Canyon', 'Sierra', 'Sierra Denali', 'Terrain',
    'Yukon', 'Yukon Denali', 'Yukon XL',
    'Hummer EV',
  ],
  'Haval': [
    'H6', 'Jolion',
  ],
  'Honda': [
    'Accord', 'Brio', 'BR-V',
    'City', 'City Hatchback',
    'Civic', 'Civic Type R',
    'CR-V', 'HR-V', 'Mobilio',
    'Odyssey', 'Passport', 'Pilot',
  ],
  'Hyundai': [
    'Accent', 'Creta', 'Eon',
    'Galloper', 'H100', 'H350',
    'Ioniq 5', 'Ioniq 6',
    'Kona', 'Palisade', 'Reina',
    'Santa Fe', 'Stargazer', 'Staria', 'Staria Cargo',
    'Tucson',
  ],
  'Isuzu': [
    'Crosswind', 'D-Max', 'D-Max V-Cross',
    'Hi-Lander', 'MU-X',
    'NLR', 'NPR', 'Traviz', 'Trooper',
  ],
  'JAC': [
    'JS3', 'JS4', 'JS6', 'JS8',
    'Sunray', 'T6', 'T8', 'T9',
  ],
  'Jaguar': [
    'E-Pace', 'F-Pace', 'I-Pace',
    'F-Type',
    'XE', 'XF', 'XJ',
  ],
  'Jeep': [
    'Cherokee', 'Grand Cherokee', 'Grand Cherokee L', 'Grand Wagoneer',
    'Compass', 'Renegade',
    'Gladiator',
    'Wrangler', 'Wrangler Rubicon', 'Wagoneer',
  ],
  'Kia': [
    'Carens', 'Carnival', 'Grand Carnival',
    'EV6', 'EV9',
    'K5', 'Mohave', 'Picanto',
    'Seltos', 'Soluto', 'Sorento', 'Sportage', 'Stonic', 'Telluride',
  ],
  'Land Rover': [
    'Defender', 'Defender 90', 'Defender 110', 'Defender 130',
    'Discovery', 'Discovery Sport',
    'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar',
  ],
  'Lexus': [
    'ES', 'GS', 'IS', 'LS',
    'GX', 'LM', 'LX', 'LX 600', 'NX', 'RX', 'RX 350', 'UX',
    'RC',
  ],
  'Mahindra': [
    'Bolero', 'Scorpio', 'Thar',
    'XUV300', 'XUV500', 'XUV700',
  ],
  'Maxus': [
    'D60', 'D90', 'D90 Pro',
    'G10', 'G50',
    'MIFA',
    'T60', 'T70', 'T90',
    'V80',
  ],
  'Mazda': [
    '2', '3', '6',
    'BT-50',
    'CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-9',
    'MX-5',
  ],
  'Mercedes-Benz': [
    'A-Class', 'C-Class', 'CLA', 'CLS', 'E-Class', 'S-Class',
    'EQB', 'EQC', 'EQE', 'EQS',
    'G-Class', 'G63 AMG',
    'GLA', 'GLB', 'GLC', 'GLE', 'GLS',
    'Sprinter', 'Vito', 'V-Class',
  ],
  'MG': [
    'MG3', 'MG5', 'MG6',
    'GS', 'HS', 'RX5', 'RX8',
    'ZS', 'ZS EV',
  ],
  'Mini': [
    'Cooper', 'Cooper S', 'Cooper Clubman', 'Cooper Countryman',
    'John Cooper Works',
  ],
  'Mitsubishi': [
    'Adventure', 'ASX',
    'L300',
    'Mirage', 'Mirage G4',
    'Montero Sport',
    'Outlander', 'Outlander PHEV',
    'Pajero', 'Pajero Sport',
    'Strada', 'Triton',
    'Xpander', 'Xpander Cross',
  ],
  'Nissan': [
    'Almera', 'Frontier',
    'Juke', 'Kicks', 'Kicks e-Power',
    'Navara', 'Navara Pro-4X', 'NP300',
    'NV350', 'Patrol', 'Patrol Royale',
    'Pathfinder', 'Sylphy',
    'Terra', 'Urvan', 'X-Trail',
  ],
  'Peugeot': [
    '2008', '3008', '5008',
  ],
  'Porsche': [
    '718 Boxster', '718 Cayman', '911',
    'Cayenne', 'Macan',
    'Panamera', 'Taycan',
  ],
  'Subaru': [
    'Ascent', 'BRZ',
    'Crosstrek', 'Forester',
    'Impreza', 'Levorg',
    'Outback', 'WRX', 'WRX STI', 'XV',
  ],
  'Suzuki': [
    'Alto', 'APV',
    'Carry', 'Celerio', 'Ciaz',
    'Dzire', 'Ertiga',
    'Grand Vitara', 'Jimny', 'Jimny 5-door',
    'S-Cross', 'S-Presso', 'Swift', 'Vitara', 'XL7',
  ],
  'Tata': [
    'Nexon', 'Safari', 'Xenon',
  ],
  'Tesla': [
    'Model 3', 'Model S', 'Model X', 'Model Y',
  ],
  'Toyota': [
    'Alphard',
    'Avanza',
    'bZ4X',
    'Camry', 'Corolla Altis', 'Corolla Cross',
    'Coaster',
    'Crown',
    'Fortuner', 'Fortuner GR-S',
    'GR86', 'GR Corolla', 'GR Yaris', 'Supra',
    'Hiace', 'Hiace Commuter', 'Hiace Super Grandia',
    'Hilux', 'Hilux GR-S',
    'Innova', 'Innova Zenix', 'Innova Reborn',
    'Land Cruiser', 'Land Cruiser 70', 'Land Cruiser 250', 'Land Cruiser Prado',
    '4Runner', 'RAV4',
    'Rush',
    'Sequoia', 'Sienna',
    'Tacoma', 'Tundra',
    'Vellfire', 'Veloz', 'Vios', 'Wigo', 'Yaris', 'Yaris Cross',
    'Lite Ace',
  ],
  'Volkswagen': [
    'Amarok',
    'Golf', 'Polo', 'Polo Sedan',
    'Lavida', 'Lamando', 'Santana',
    'T-Cross', 'T-Roc', 'Tharu', 'Tiguan', 'Touareg',
    'Multivan',
  ],
  'Volvo': [
    'S60', 'S90',
    'V60', 'V90',
    'XC40', 'XC60', 'XC90',
  ],
  'Other / Not Listed': [],  // gets the "Other" fallback model added below
}

// Sentinel value used when the customer picks "Other / Not Listed"
export const OTHER_MAKE  = 'Other / Not Listed'
export const OTHER_MODEL = 'Other — describe in notes'

// Append OTHER_MODEL to every make's model list so customers always have a fallback.
// Doing this once at module load keeps the data source clean.
for (const make of Object.keys(VEHICLE_MAKES_MODELS)) {
  VEHICLE_MAKES_MODELS[make] = [
    ...VEHICLE_MAKES_MODELS[make].filter(m => m !== OTHER_MODEL),
    OTHER_MODEL,
  ]
}

// Authoritative list of allowed makes — used for server-side validation.
// Custom sort: alphabetical, but 'Other / Not Listed' always last.
export const ALLOWED_MAKES = Object.keys(VEHICLE_MAKES_MODELS).sort((a, b) => {
  if (a === OTHER_MAKE) return 1
  if (b === OTHER_MAKE) return -1
  return a.localeCompare(b)
})

// Helper: returns true if the make/model combination exists in our list
export function isValidMakeModel(make: string, model: string): boolean {
  const models = VEHICLE_MAKES_MODELS[make]
  return Boolean(models?.includes(model))
}

// Year range — 1990 to next year
export function vehicleYearRange(): number[] {
  const now = new Date().getFullYear()
  const years: number[] = []
  for (let y = now + 1; y >= 1990; y--) years.push(y)
  return years
}
