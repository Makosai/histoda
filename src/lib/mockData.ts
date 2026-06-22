export interface Station {
	id: string;
	name: string;
	country: string;
	latitude: number;
	longitude: number;
	elevation: number;
	period: string;
}

export interface Earthquake {
	id: string;
	name: string;
	country: string;
	year: number;
	magnitude: number;
	depth: number;
	tsunami: number;
	casualties: number;
	description: string;
}

export interface Conflict {
	id: string;
	name: string;
	region: string;
	startYear: number;
	endYear: number;
	combatants: string[];
	casualties: number;
	duration: string;
	description: string;
}

export const defaultStations: Station[] = [
	{ id: 'paris', name: 'Paris Charles de Gaulle', country: 'France', latitude: 49.0097, longitude: 2.5479, elevation: 119, period: '1880 - 2026' },
	{ id: 'tampa', name: 'Tampa International', country: 'United States', latitude: 27.9506, longitude: -82.4572, elevation: 8, period: '1880 - 2026' },
	{ id: 'new_york', name: 'New York Central Park', country: 'United States', latitude: 40.7829, longitude: -73.9654, elevation: 40, period: '1880 - 2026' },
	{ id: 'toronto', name: 'Toronto Pearson International', country: 'Canada', latitude: 43.6777, longitude: -79.6248, elevation: 173, period: '1880 - 2026' },
	{ id: 'lagos', name: 'Lagos International', country: 'Nigeria', latitude: 6.5774, longitude: 3.3212, elevation: 40, period: '1880 - 2026' },
	{ id: 'london', name: 'London Heathrow', country: 'United Kingdom', latitude: 51.4776, longitude: -0.4614, elevation: 25, period: '1880 - 2026' },
	{ id: 'tokyo', name: 'Tokyo International', country: 'Japan', latitude: 35.5533, longitude: 139.7811, elevation: 6, period: '1880 - 2026' },
	{ id: 'cairo', name: 'Cairo International', country: 'Egypt', latitude: 30.1219, longitude: 31.4056, elevation: 74, period: '1880 - 2026' },
	{ id: 'sydney', name: 'Sydney Observatory Hill', country: 'Australia', latitude: -33.8598, longitude: 151.2052, elevation: 39, period: '1880 - 2026' }
];

export const earthquakes: Earthquake[] = [
	{ id: 'valdivia', name: 'Valdivia Earthquake', country: 'Chile', year: 1960, magnitude: 9.5, depth: 33, tsunami: 1, casualties: 6000, description: 'The most powerful earthquake ever recorded, triggering massive tsunamis across the Pacific.' },
	{ id: 'alaska', name: 'Great Alaska Earthquake', country: 'United States', year: 1964, magnitude: 9.2, depth: 25, tsunami: 1, casualties: 131, description: 'The second largest earthquake in recorded history, causing significant ground fissures and tsunamis.' },
	{ id: 'sumatra', name: 'Indian Ocean Earthquake', country: 'Indonesia', year: 2004, magnitude: 9.1, depth: 30, tsunami: 1, casualties: 227898, description: 'Triggered a series of devastating tsunamis along the coasts of most landmasses bordering the Indian Ocean.' },
	{ id: 'tohoku', name: 'Tohoku Earthquake', country: 'Japan', year: 2011, magnitude: 9.0, depth: 29, tsunami: 1, casualties: 19759, description: 'A massive undersea megathrust earthquake that triggered a highly destructive tsunami and the Fukushima disaster.' },
	{ id: 'tangshan', name: 'Tangshan Earthquake', country: 'China', year: 1976, magnitude: 7.5, depth: 15, tsunami: 0, casualties: 242769, description: 'One of the deadliest earthquakes in recorded history, decimating the industrial city of Tangshan.' },
	{ id: 'sichuan', name: 'Sichuan Earthquake', country: 'China', year: 2008, magnitude: 7.9, depth: 19, tsunami: 0, casualties: 87587, description: 'Also known as the Great Wenchuan earthquake, causing severe landslides and massive destruction.' },
	{ id: 'haiti', name: 'Haiti Earthquake', country: 'Haiti', year: 2010, magnitude: 7.0, depth: 13, tsunami: 1, casualties: 316000, description: 'A catastrophic earthquake that struck Haiti, leaving hundreds of thousands of casualties and extreme devastation.' },
	{ id: 'kobe', name: 'Kobe Earthquake', country: 'Japan', year: 1995, magnitude: 6.9, depth: 16, tsunami: 0, casualties: 6434, description: 'Also known as the Great Hanshin earthquake, causing massive damage in the city of Kobe.' },
	{ id: 'san_francisco', name: 'San Francisco Earthquake', country: 'United States', year: 1906, magnitude: 7.9, depth: 8, tsunami: 0, casualties: 3000, description: 'One of the most significant earthquakes of all time, destroying over 80% of San Francisco.' }
];

export const conflicts: Conflict[] = [
	{ id: 'ww2', name: 'World War II', region: 'Global', startYear: 1939, endYear: 1945, combatants: ['Allies', 'Axis'], casualties: 75000000, duration: '6 years', description: 'The deadliest conflict in human history, involving the vast majority of the world\'s countries.' },
	{ id: 'ww1', name: 'World War I', region: 'Europe/Global', startYear: 1914, endYear: 1918, combatants: ['Entente', 'Central Powers'], casualties: 20000000, duration: '4 years', description: 'One of the deadliest conflicts in history, leading to major political changes and empires collapsing.' },
	{ id: 'vietnam', name: 'Vietnam War', region: 'Southeast Asia', startYear: 1955, endYear: 1975, combatants: ['North Vietnam & Allies', 'South Vietnam & US Allies'], casualties: 3800000, duration: '19 years', description: 'A major Cold War-era conflict fought in Vietnam, Laos, and Cambodia.' },
	{ id: 'korean', name: 'Korean War', region: 'East Asia', startYear: 1950, endYear: 1953, combatants: ['North Korea & China', 'South Korea & UN Allies'], casualties: 3000000, duration: '3 years', description: 'Fought between North and South Korea, which quickly escalated to include international superpowers.' },
	{ id: 'napoleon', name: 'Napoleonic Wars', region: 'Europe/Global', startYear: 1803, endYear: 1815, combatants: ['French Empire', 'Coalitions'], casualties: 3500000, duration: '12 years', description: 'A series of major conflicts pitting the French Empire against opposing global coalitions.' },
	{ id: 'civil_war', name: 'American Civil War', region: 'United States', startYear: 1861, endYear: 1865, combatants: ['Union', 'Confederacy'], casualties: 620000, duration: '4 years', description: 'Fought between the Northern states (Union) and Southern states (Confederacy) over slavery and states\' rights.' },
	{ id: 'thirty_years', name: 'Thirty Years\' War', region: 'Europe', startYear: 1618, endYear: 1648, combatants: ['Protestants (Sweden, France)', 'Habsburg Allies'], casualties: 8000000, duration: '30 years', description: 'One of the longest and most destructive conflicts in European history, starting as a religious war.' },
	{ id: 'crusades', name: 'The Crusades', region: 'Middle East', startYear: 1095, endYear: 1291, combatants: ['Christian Crusaders', 'Seljuk & Ayyubids'], casualties: 2000000, duration: '196 years', description: 'A series of religious wars initiated, supported, and directed by the Latin Church in the medieval period.' }
];

/**
 * Generate mock seismic timeline data around the earthquake event
 */
export function generateMockSeismic(eq: Earthquake): any[] {
	const eventYear = eq.year;
	const mockSeismic: any[] = [];
	for (let year = eventYear - 15; year <= Math.min(2026, eventYear + 15); year++) {
		// Base background magnitude noise (usually minor: 1.0 to 4.0)
		let mag = 2.0 + (Math.sin(year * 17) * 0.8) + (Math.cos(year * 3) * 0.4);
		let frequency = 10 + Math.floor(Math.sin(year * 2) * 5);
		
		// Insert the major earthquake spike
		if (year === eventYear) {
			mag = eq.magnitude;
			frequency = 120; // High count of aftershocks
		} else if (year === eventYear + 1) {
			mag = eq.magnitude - 1.5; // High aftershock spike
			frequency = 45;
		}

		mockSeismic.push({
			year,
			mag: parseFloat(mag.toFixed(1)),
			frequency
		});
	}
	return mockSeismic;
}

/**
 * Generate battle activity index data for the conflict duration
 */
export function generateMockConflict(conflict: Conflict): any[] {
	const start = conflict.startYear;
	const end = conflict.endYear;
	const mockConflicts: any[] = [];
	for (let year = start - 5; year <= Math.min(2026, end + 5); year++) {
		let battleCount = 0;
		let intensity = 0;

		if (year >= start && year <= end) {
			const progress = (year - start) / (end - start);
			// Curve intensity peaks in the middle/latter half of the conflict
			intensity = 40 + Math.sin(progress * Math.PI) * 50 + (Math.cos(year * 5) * 10);
			battleCount = Math.floor(intensity / 3) + 2;
		} else {
			// Peace period minor skirmish noise
			intensity = 2 + Math.floor(Math.abs(Math.sin(year * 11) * 3));
			battleCount = intensity > 3 ? 1 : 0;
		}

		mockConflicts.push({
			year,
			intensity: parseFloat(intensity.toFixed(1)),
			battleCount
		});
	}
	return mockConflicts;
}
